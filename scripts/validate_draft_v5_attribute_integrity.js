const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const draftDataSource = fs.readFileSync(path.join(root, 'js/data/draft_data.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const draftFlowSource = fs.readFileSync(path.join(root, 'js/draft.js'), 'utf8');
const start = offseasonSource.indexOf('function getLeagueAttributeKeys');
const end = offseasonSource.indexOf('// ==================== 联盟演变', start);
if (start < 0 || end < 0) throw new Error('无法提取新秀属性与 OVR 逻辑');

const context = vm.createContext({
  STATE: { career: { seasonCount: 0 } },
  clearLineupCache() {},
});
vm.runInContext(`${configSource}\n${draftDataSource}`, context);
context.ATTR_KEYS = vm.runInContext('SIM_CONFIG.ATTR_LIST', context);
vm.runInContext(offseasonSource.slice(start, end), context, { filename: 'draft-v5-integrity.js' });

const attrKeys = context.ATTR_KEYS;
const cohorts = [
  ['2026', vm.runInContext('DRAFT_CLASS_2026_RATINGS', context)],
  ['future', vm.runInContext('FUTURE_PROSPECT_RATINGS', context)],
];
const failures = [];
let fixedPlayers = 0;
let maximumTargetResidual = 0;

for (const [cohort, ratings] of cohorts) {
  for (const [id, rating] of Object.entries(ratings)) {
    fixedPlayers++;
    const player = { id, pos: rating.pos, ovr: rating.ovr, ...rating.attributes };
    const authored = Object.fromEntries(attrKeys.map(key => [key, player[key]]));
    context.playerProbe = player;
    const calculated = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
    maximumTargetResidual = Math.max(maximumTargetResidual, Math.abs(calculated - rating.ovr));
    if (Math.abs(calculated - rating.ovr) > 2) {
      failures.push(`${cohort}:${id} authored 属性与登记 OVR 偏差 ${calculated - rating.ovr}`);
    }
    vm.runInContext('syncAuthoredRookieOvr(playerProbe)', context);
    for (const key of attrKeys) {
      if (player[key] !== authored[key]) failures.push(`${cohort}:${id} 运行时改写 ${key}`);
    }
    if (player.ovr !== calculated) failures.push(`${cohort}:${id} 运行时 OVR 未由 authored 属性计算`);
  }
}

let calibrationCases = 0;
let maximumCalibrationChange = 0;
for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
  for (const target of [62, 70, 78, 86]) {
    const player = { id: `R-${pos}-${target}`, pos, ovr: target };
    attrKeys.forEach((key, index) => { player[key] = Math.max(25, Math.min(99, target - 8 + (index * 7) % 17)); });
    const before = Object.fromEntries(attrKeys.map(key => [key, player[key]]));
    context.playerProbe = player;
    const beforeDistance = Math.abs(vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context) - target);
    vm.runInContext(`calibrateGeneratedRookieAttributes(playerProbe, ${target}, 3)`, context);
    const afterDistance = Math.abs(player.ovr - target);
    calibrationCases++;
    if (afterDistance > beforeDistance) failures.push(`${pos}:${target} 有限校准反而远离目标`);
    for (const key of attrKeys) {
      const change = Math.abs(player[key] - before[key]);
      maximumCalibrationChange = Math.max(maximumCalibrationChange, change);
      if (change > 3) failures.push(`${pos}:${target} ${key} 校准变化 ${change} 超过 3`);
    }
    for (const left of attrKeys) {
      for (const right of attrKeys) {
        if (before[left] > before[right] && player[left] < player[right]) {
          failures.push(`${pos}:${target} 校准翻转 ${left}/${right} 强弱顺序`);
        }
      }
    }
    const recalculated = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
    if (player.ovr !== recalculated) failures.push(`${pos}:${target} 校准后 OVR 不一致`);
  }
}

let seed = 20260827;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}
context.profileRandom = random;
let generatedCases = 0;
let maximumGeneratedResidual = 0;
for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
  for (let sample = 0; sample < 40; sample++) {
    const target = 60 + Math.floor(random() * 27);
    const player = { id: `R-${pos}-${sample}`, pos, ovr: target, _age: 20 };
    context.playerProbe = player;
    vm.runInContext(`applyRookieAttributeProfile(playerProbe, ${target}, profileRandom)`, context);
    generatedCases++;
    maximumGeneratedResidual = Math.max(maximumGeneratedResidual, Math.abs(player.ovr - target));
    if (player.ovr !== vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context)) failures.push(`${player.id} OVR 不一致`);
    if (attrKeys.some(key => !Number.isInteger(player[key]) || player[key] < 25 || player[key] > 99)) failures.push(`${player.id} 属性越界`);
    const profile = vm.runInContext('getRookieProfile(playerProbe)', context);
    const strengthAverage = profile.strengths.reduce((sum, key) => sum + player[key], 0) / profile.strengths.length;
    const weaknessAverage = profile.weaknesses.reduce((sum, key) => sum + player[key], 0) / profile.weaknesses.length;
    if (strengthAverage <= weaknessAverage + 10) failures.push(`${player.id} 强弱项结构失真`);
  }
}

const productionSource = `${offseasonSource}\n${draftFlowSource}`;
if (/function normalizeRookieAttributesToOvr|function normalizeLeaguePlayerAttributesToOvr/.test(productionSource)) {
  failures.push('生产代码仍保留目标 OVR 反推属性函数');
}
if ((productionSource.match(/syncAuthoredRookieOvr\((?:rookie|player)\)/g) || []).length < 4) {
  failures.push('固定新秀正式流程未全部切换为 authored 属性直算 OVR');
}

const result = {
  fixedPlayers,
  maximumTargetResidual,
  calibrationCases,
  maximumCalibrationChange,
  generatedCases,
  maximumGeneratedResidual,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
