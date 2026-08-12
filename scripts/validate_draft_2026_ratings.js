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
const weights = vm.runInContext('SIM_CONFIG.OVR_WEIGHTS', context);
const attrKeys = vm.runInContext('SIM_CONFIG.ATTR_LIST', context);

const errors = [];
const ratingIds = Object.keys(ratings).sort();
const reviewIds = reviews.map((review) => review.id);
const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

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
  if (!weights[rating.pos]) errors.push(`${id} 位置无效：${rating.pos}`);
  const attributes = rating.attributes || {};
  attrKeys.forEach((key) => {
    const value = attributes[key];
    if (!Number.isFinite(value) || value < 25 || value > 99) errors.push(`${id} ${key} 无效：${value}`);
  });
  if (weights[rating.pos]) {
    const calculated = Math.round(attrKeys.reduce((sum, key) => sum + attributes[key] * (weights[rating.pos][key] || 0), 0));
    if (calculated !== rating.ovr) errors.push(`${id} OVR 不一致：声明 ${rating.ovr}，重算 ${calculated}`);
  }
});

if (!/fixedRating\.attributes\[key\]/.test(offseasonSource)) errors.push('休赛期未读取固定新秀属性');
if (!/rookie\.ovr\s*=\s*calcOVR\(rookie, rookie\.pos\)/.test(offseasonSource)) errors.push('休赛期未按固定属性重算新秀 OVR');

console.log(JSON.stringify({
  officialProfiles: profiles.length,
  reviewedPlayers: reviews.length,
  fixedRatings: ratingIds.length,
  lastReviewedId: reviewIds[reviewIds.length - 1] || null,
  validationErrors: errors.length,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
