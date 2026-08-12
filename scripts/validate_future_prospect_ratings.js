const fs = require('fs');
const vm = require('vm');

const draftSource = fs.readFileSync('js/data/draft_data.js', 'utf8');
const configSource = fs.readFileSync('js/data/simulation_config.js', 'utf8');
const indexSource = fs.readFileSync('index.html', 'utf8');
const offseasonSource = fs.readFileSync('js/offseason.js', 'utf8');
const evidence = JSON.parse(fs.readFileSync('scripts/data/future_prospect_profiles.json', 'utf8')).profiles;
const reviews = JSON.parse(fs.readFileSync('scripts/data/future_prospect_reviews.json', 'utf8')).reviews;
const context = {};
vm.createContext(context);
vm.runInContext(configSource, context);
vm.runInContext(draftSource, context);

const ratings = vm.runInContext('FUTURE_PROSPECT_RATINGS', context);
const weights = vm.runInContext('SIM_CONFIG.OVR_WEIGHTS', context);
const candidates = vm.runInContext('DRAFT_CLASS_2027.concat(ROOKIE_NAMES)', context);
const candidatePools = vm.runInContext('DRAFT_CLASS_2027.concat(ROOKIE_NAMES, STAR_ROOKIES)', context);
const attrKeys = ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','IDEF','BLK','REB','ATH','STR','CLU'];
const profilesByPosition = {
  PG: ['playmaker', 'scoring_guard'],
  SG: ['perimeter_scorer', 'two_way_slasher'],
  SF: ['two_way_wing', 'point_forward'],
  PF: ['interior_forward', 'stretch_four'],
  C: ['rim_protector', 'skilled_big']
};
const errors = [];
const candidateById = Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate]));
const evidenceById = {};
const reviewById = {};

evidence.forEach((profile) => {
  if (evidenceById[profile.id]) errors.push(`${profile.id} 证据档案重复`);
  evidenceById[profile.id] = profile;
});
reviews.forEach((review) => {
  if (reviewById[review.id]) errors.push(`${review.id} 审核记录重复`);
  reviewById[review.id] = review;
});

Object.keys(ratings).forEach((id) => {
  const rating = ratings[id];
  const candidate = candidateById[id];
  const profile = evidenceById[id];
  const review = reviewById[id];
  if (!candidate) errors.push(`${id} 不在未来候选名单`);
  if (!profile) errors.push(`${id} 缺少证据档案`);
  if (!review || review.status !== 'confirmed') errors.push(`${id} 缺少已确认审核记录`);
  if (profile && review && profile.name !== review.name) errors.push(`${id} 证据名 ${profile.name} 与审核名 ${review.name} 不一致`);
  if (!rating || !weights[rating.pos]) errors.push(`${id} 位置无效`);
  if (!rating.height) errors.push(`${id} 缺少身高`);
  if (!profilesByPosition[rating.pos] || !profilesByPosition[rating.pos].includes(rating.profile)) errors.push(`${id} 模板 ${rating.profile} 与位置 ${rating.pos} 不匹配`);
  attrKeys.forEach((key) => {
    const value = rating.attributes && rating.attributes[key];
    if (!Number.isInteger(value) || value < 25 || value > 99) errors.push(`${id} ${key} 无效：${value}`);
  });
  if (rating && weights[rating.pos] && rating.attributes) {
    const calculated = Math.round(attrKeys.reduce((sum, key) => sum + rating.attributes[key] * weights[rating.pos][key], 0));
    if (calculated !== rating.ovr) errors.push(`${id} OVR ${rating.ovr} 与实算 ${calculated} 不一致`);
  }
});

evidence.forEach((profile) => {
  if (!ratings[profile.id]) errors.push(`${profile.id} 有证据档案但尚无固定评分`);
});
reviews.forEach((review) => {
  if (!ratings[review.id]) errors.push(`${review.id} 有审核记录但尚无固定评分`);
});
candidatePools.forEach((candidate) => {
  if (Object.prototype.hasOwnProperty.call(candidate, 'name')) errors.push(`${candidate.id} 仍含临时英文名字段`);
  if (!candidate.id || !candidate.cn) errors.push(`${candidate.id || '未知候选'} 缺少稳定 ID 或中文名`);
});

if (!/FUTURE_PROSPECT_RATINGS\[pick\.ratingId\s*\|\|\s*pick\.id\]/.test(indexSource)) errors.push('generateRookie 未读取未来球员固定评级');
if (!/height:\s*fixedRating\s*\?\s*fixedRating\.height/.test(indexSource)) errors.push('generateRookie 未使用固定身高');
if (!/_usedRookieCandidateNames\[pick\.ratingId\]\s*=\s*true/.test(indexSource)) errors.push('明星评级身份未同步去重，可能重复生成');
const fixedBranches = offseasonSource.match(/(?:rookie|rk)\._fixedProspectRating/g) || [];
if (fixedBranches.length < 2) errors.push('正常选秀或补位流程仍可能覆盖固定评级');

console.log(JSON.stringify({
  fixedFutureRatings: Object.keys(ratings).length,
  evidenceProfiles: evidence.length,
  confirmedReviews: reviews.filter((review) => review.status === 'confirmed').length,
  validationErrors: errors.length,
  errors
}, null, 2));
if (errors.length) process.exit(1);
