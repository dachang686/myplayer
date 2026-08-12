const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js', 'data', 'simulation_config.js'), 'utf8');
const draftSource = fs.readFileSync(path.join(root, 'js', 'data', 'draft_data.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js', 'offseason.js'), 'utf8');
const reviews = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'draft_class_2026_reviews.json'), 'utf8')).reviews;
const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'draft_class_2026_profiles.json'), 'utf8')).profiles;

const context = {};
vm.createContext(context);
vm.runInContext(`${configSource}\n${draftSource}`, context);
const ratings = vm.runInContext('DRAFT_CLASS_2026_RATINGS', context);
const attrKeys = vm.runInContext('SIM_CONFIG.ATTR_LIST', context);
context.ATTR_KEYS = attrKeys;
context.STATE = { position: 'SG' };
const ovrStart = offseasonSource.indexOf('function getOvrPositions');
const ovrEnd = offseasonSource.indexOf('function getCurrentLeagueSeasonNumber', ovrStart);
if (ovrStart >= 0 && ovrEnd > ovrStart) {
  vm.runInContext(offseasonSource.slice(ovrStart, ovrEnd), context, { filename: 'draft-2026-ovr.js' });
}
const draftClassMatch = offseasonSource.match(/var DRAFT_CLASS_2026\s*=\s*(\[[\s\S]*?\n\]);/);

const errors = [];
const ratingIds = Object.keys(ratings).sort();
const reviewIds = reviews.map((review) => review.id);
const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

if (!draftClassMatch) {
  errors.push('未找到 2026 届选秀名单');
} else {
  const draftClass = vm.runInNewContext(draftClassMatch[1]);
  if (draftClass.length !== 60) errors.push(`2026 届选秀名单应为 60 人，实际 ${draftClass.length}`);
  draftClass.forEach((player, index) => {
    if (Object.prototype.hasOwnProperty.call(player, 'name') || Object.prototype.hasOwnProperty.call(player, 'nameEN')) {
      errors.push(`D26-${String(index + 1).padStart(2, '0')} 仍含英文姓名字段`);
    }
    if (!player.cn) errors.push(`D26-${String(index + 1).padStart(2, '0')} 缺少中文名`);
  });
}

if (new Set(reviewIds).size !== reviewIds.length) errors.push('审核记录存在重复 ID');
if (ratingIds.length !== reviews.length) errors.push(`固定能力 ${ratingIds.length} 人，审核记录 ${reviews.length} 人`);

reviews.forEach((review, index) => {
  const expectedId = `D26-${String(index + 1).padStart(2, '0')}`;
  if (review.id !== expectedId) errors.push(`审核顺序错误：第 ${index + 1} 条为 ${review.id}，预期 ${expectedId}`);
  if (!ratings[review.id]) errors.push(`${review.id} 有审核记录但没有固定能力`);
  const profile = profileById.get(review.id);
  if (!profile) errors.push(`${review.id} 缺少官方新秀缓存`);
  else if (profile.name !== review.name) errors.push(`${review.id} 姓名不一致：${profile.name} / ${review.name}`);
});

ratingIds.forEach((id) => {
  const rating = ratings[id];
  if (!vm.runInContext(`!!SIM_CONFIG.OVR_MODEL.positionWeights[${JSON.stringify(rating.pos)}]`, context)) errors.push(`${id} 位置无效：${rating.pos}`);
  const attributes = rating.attributes || {};
  attrKeys.forEach((key) => {
    const value = attributes[key];
    if (!Number.isFinite(value) || value < 25 || value > 99) errors.push(`${id} ${key} 无效：${value}`);
  });
  if (ovrStart >= 0 && ovrEnd > ovrStart) {
    context.ratingProbe = { pos: rating.pos, ovr: rating.ovr, ...attributes };
    vm.runInContext(`normalizeRookieAttributesToOvr(ratingProbe, ${Number(rating.ovr)})`, context);
    const calculated = vm.runInContext('calcOVR(ratingProbe, ratingProbe.pos)', context);
    if (calculated !== rating.ovr) errors.push(`${id} 新公式归一失败：目标 ${rating.ovr}，实算 ${calculated}`);
  }
});

if (!/fixedRating\.attributes\[key\]/.test(offseasonSource)) errors.push('休赛期未读取固定新秀属性');
if (!/normalizeRookieAttributesToOvr\(rookie, fixedRating\.ovr\)/.test(offseasonSource)) errors.push('2026 固定新秀未按审核 OVR 归一属性');

console.log(JSON.stringify({
  officialProfiles: profiles.length,
  reviewedPlayers: reviews.length,
  fixedRatings: ratingIds.length,
  lastReviewedId: reviewIds[reviewIds.length - 1] || null,
  validationErrors: errors.length,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
