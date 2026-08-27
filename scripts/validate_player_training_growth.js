const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js', 'offseason.js'), 'utf8');
const config = require(path.join(root, 'js', 'data', 'simulation_config.js'));
const ATTR_KEYS = config.ATTR_LIST.slice();

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`无法提取训练逻辑：${startMarker}`);
  return source.slice(start, end);
}

const counters = { save: 0, continue: 0, draft: 0, render: 0 };
const context = vm.createContext({
  SIM_CONFIG: config,
  ATTR_KEYS,
  STATE: {},
  Math: Object.create(Math),
  attrCN: key => key,
  clearLineupCache() {},
  renderTrainingCamp() { counters.render++; },
  saveCurrentSeasonToCareer() { counters.save++; },
  shouldOfferPlayerRetirement() { return false; },
  showPlayerRetirementChoice() {},
  continueCareerAfterTraining() { counters.continue++; },
  beginOffseasonDraft() { counters.draft++; },
});

const offseasonStart = offseasonSource.indexOf('function getLeagueAttributeKeys');
const offseasonEnd = offseasonSource.indexOf('// ==================== 联盟演变', offseasonStart);
if (offseasonStart < 0 || offseasonEnd < 0) throw new Error('无法提取正式 OVR 逻辑');
vm.runInContext(offseasonSource.slice(offseasonStart, offseasonEnd), context, { filename: 'training-ovr-runtime.js' });
vm.runInContext(sliceBetween(indexSource, 'function clampAttrVal', 'function beginOffseason'), context, { filename: 'annual-training-drift.js' });
vm.runInContext(sliceBetween(indexSource, 'function calcTrainingPoints', 'function renderTrainingCamp'), context, { filename: 'training-points.js' });
vm.runInContext(sliceBetween(indexSource, 'function getTrainingPointCost', 'function continueCareerAfterTraining'), context, { filename: 'training-confirmation.js' });

function makeAttrs(level) {
  return Object.fromEntries(ATTR_KEYS.map(key => [key, level]));
}

function resetCounters() {
  Object.keys(counters).forEach(key => { counters[key] = 0; });
}

function seededRandom(seed) {
  let value = seed >>> 0;
  context.Math.random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function maxTrainingSeason() {
  return {
    awards: ['全明星', '最佳阵容一阵', 'MVP', 'DPOY', '总决赛MVP', '最佳新秀'],
    playerStats: { games: 82, pts: 30 * 82, reb: 8 * 82, ast: 8 * 82 },
  };
}

function resetState({ level = 80, age = 22, seasonCount = 3, contract = 3, flags = {}, season = maxTrainingSeason() } = {}) {
  context.STATE = {
    attrs: makeAttrs(level),
    position: 'PG',
    finalOVR: 0,
    _tpPending: {},
    season,
    career: { currentAge: age, seasonCount, contract, flags },
  };
  context.STATE.finalOVR = context.calcOVR(context.STATE.attrs, context.STATE.position);
  resetCounters();
}

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

function expectThrow(callback, label) {
  let message = '';
  try {
    callback();
  } catch (error) {
    message = String(error && error.message);
  }
  check(!!message, `${label} 没有拒绝非法输入`);
  return message;
}

const trainingPointCases = {};
resetState({ season: null });
trainingPointCases.noSeason = context.calcTrainingPoints();
resetState({ season: { awards: [], playerStats: { games: 0 } } });
trainingPointCases.minimum = context.calcTrainingPoints();
resetState();
trainingPointCases.maximum = context.calcTrainingPoints();
check(trainingPointCases.noSeason === 0, '无赛季时训练点应为0');
check(trainingPointCases.minimum === 1, '无表现奖励时至少应有1训练点');
check(trainingPointCases.maximum === 9, `满表现训练点应为9，实际${trainingPointCases.maximum}`);

resetState({ level: 70, age: 24, contract: 3 });
context.STATE._tpPending = { MID: 6, FIN: 3 };
const lifecycleBeforeOvr = context.STATE.finalOVR;
context.confirmTraining();
const lifecycle = {
  mid: context.STATE.attrs.MID,
  fin: context.STATE.attrs.FIN,
  ovrBefore: lifecycleBeforeOvr,
  ovrAfter: context.STATE.finalOVR,
  age: context.STATE.career.currentAge,
  contract: context.STATE.career.contract,
  marker: context.STATE.career.trainingCompletedSeason,
  counters: Object.assign({}, counters),
};
check(lifecycle.mid === 76 && lifecycle.fin === 73, '合法训练没有准确写入属性');
check(lifecycle.ovrAfter === context.calcOVR(context.STATE.attrs, context.STATE.position), '训练后 OVR 没有按正式公式重算');
check(lifecycle.ovrAfter >= lifecycle.ovrBefore, '正向训练导致 OVR 下降');
check(lifecycle.age === 25 && lifecycle.contract === 2 && lifecycle.marker === 3, '训练结算没有正确推进年龄、合同或赛季标记');
check(counters.save === 1 && counters.continue === 1 && counters.draft === 0, '首次训练结算流程调用次数错误');
check(Object.keys(context.STATE._tpPending).length === 0, '训练结算后仍残留待分配点');

const duplicateSnapshot = JSON.stringify({ attrs: context.STATE.attrs, age: context.STATE.career.currentAge, contract: context.STATE.career.contract });
context.confirmTraining();
check(JSON.stringify({ attrs: context.STATE.attrs, age: context.STATE.career.currentAge, contract: context.STATE.career.contract }) === duplicateSnapshot,
  '同赛季重复确认再次改变了球员');
check(counters.save === 1 && counters.continue === 1 && counters.draft === 1, '重复确认没有只恢复后续流程');

resetState({ level: 90 });
context.STATE._tpPending = { MID: 10 };
const overBudgetBefore = JSON.stringify(context.STATE.attrs);
expectThrow(() => context.confirmTraining(), '超预算训练');
check(JSON.stringify(context.STATE.attrs) === overBudgetBefore, '超预算训练在失败前改写了属性');
check(counters.save === 0 && counters.continue === 0, '超预算失败后仍推进流程');

resetState({ level: 80 });
context.STATE._tpPending = { MID: 1, UNKNOWN_ATTRIBUTE: 1 };
const invalidBefore = JSON.stringify(context.STATE.attrs);
expectThrow(() => context.confirmTraining(), '混合非法属性训练');
check(JSON.stringify(context.STATE.attrs) === invalidBefore, '混合非法属性训练发生部分写入');
check(counters.save === 0 && counters.continue === 0, '非法属性失败后仍推进流程');

resetState({ level: 80 });
context.STATE.attrs.MID = 99;
context.STATE._tpPending = { MID: 1 };
const capBefore = JSON.stringify(context.STATE.attrs);
expectThrow(() => context.confirmTraining(), '超过99训练');
check(JSON.stringify(context.STATE.attrs) === capBefore, '超过99训练发生部分写入');

resetState({ level: 80 });
context.STATE._tpPending = { MID: 1.5 };
expectThrow(() => context.confirmTraining(), '小数训练增量');

resetState({ level: 80 });
context.STATE.attrs.MID = 95;
for (let i = 0; i < 10; i++) context.addTrainingPoint('MID');
const uiAllocation = {
  pending: context.STATE._tpPending.MID,
  spent: context.calculateTrainingSpentPoints(context.STATE.attrs, context.STATE._tpPending),
  preview: context.STATE.attrs.MID + context.STATE._tpPending.MID,
};
check(uiAllocation.pending === 4 && uiAllocation.spent === 7 && uiAllocation.preview === 99,
  `UI加点没有正确处理96成本边界或99封顶：${JSON.stringify(uiAllocation)}`);

function runAnnual(age, seed, level = 70, flags = {}) {
  resetState({ level, age, seasonCount: seed + 10, flags });
  seededRandom(seed * 7919 + age * 104729);
  const before = Object.assign({}, context.STATE.attrs);
  const beforeOvr = context.STATE.finalOVR;
  const changes = context.applyAnnualAttributeDrift();
  const deltas = Object.fromEntries(ATTR_KEYS.map(key => [key, context.STATE.attrs[key] - before[key]]));
  const repeat = context.applyAnnualAttributeDrift();
  check(JSON.stringify(changes) === JSON.stringify(repeat), `年龄${age}的年度漂移不具备同赛季幂等性`);
  check(context.STATE.finalOVR === context.calcOVR(context.STATE.attrs, context.STATE.position), `年龄${age}漂移后OVR不一致`);
  return {
    changes,
    deltas,
    total: Object.values(deltas).reduce((sum, value) => sum + value, 0),
    ovrDelta: context.STATE.finalOVR - beforeOvr,
  };
}

const ages = [22, 25, 26, 30, 31, 33, 34, 36, 37, 39, 40];
const ageCurves = {};
ages.forEach(age => {
  let total = 0;
  let totalOvr = 0;
  let minDelta = Infinity;
  let maxDelta = -Infinity;
  for (let sample = 1; sample <= 400; sample++) {
    const result = runAnnual(age, sample);
    total += result.total;
    totalOvr += result.ovrDelta;
    Object.values(result.deltas).forEach(delta => {
      minDelta = Math.min(minDelta, delta);
      maxDelta = Math.max(maxDelta, delta);
    });
  }
  ageCurves[age] = {
    averageTotalDelta: total / 400,
    averageOvrDelta: totalOvr / 400,
    minAttributeDelta: minDelta,
    maxAttributeDelta: maxDelta,
  };
});

[22, 25].forEach(age => check(ageCurves[age].averageTotalDelta >= 2.8 && ageCurves[age].averageTotalDelta <= 4.2
  && ageCurves[age].averageOvrDelta >= 0
  && ageCurves[age].minAttributeDelta === 0 && ageCurves[age].maxAttributeDelta === 1, `${age}岁成长曲线越界`));
[26, 30].forEach(age => check(ageCurves[age].averageTotalDelta === 0 && ageCurves[age].averageOvrDelta === 0,
  `${age}岁巅峰期不应自动增减属性`));
[[31, 33, -13, -8, -2], [34, 36, -24, -18, -4], [37, 39, -36, -27, -6], [40, 40, -48, -36, -8]].forEach(([from, to, minTotal, maxTotal, minAttr]) => {
  [from, to].forEach(age => check(ageCurves[age].averageTotalDelta >= minTotal && ageCurves[age].averageTotalDelta <= maxTotal
    && ageCurves[age].averageOvrDelta <= 0
    && ageCurves[age].minAttributeDelta >= minAttr && ageCurves[age].maxAttributeDelta === 0, `${age}岁衰退曲线越界`));
});

let bodyManagementImprovement = 0;
for (let sample = 1; sample <= 400; sample++) {
  const normal = runAnnual(35, sample, 70, {});
  const protectedPlayer = runAnnual(35, sample, 70, { bodyManagement: true });
  bodyManagementImprovement += protectedPlayer.total - normal.total;
  ATTR_KEYS.forEach(key => check(protectedPlayer.deltas[key] >= normal.deltas[key], `身体管理反而加速${key}衰退`));
}
bodyManagementImprovement /= 400;
check(bodyManagementImprovement >= 1.5 && bodyManagementImprovement <= 3.5,
  `身体管理的平均保护效果异常：${bodyManagementImprovement}`);

const youngCap = runAnnual(22, 9991, 99);
const veteranFloor = runAnnual(40, 9992, 25);
check(youngCap.total === 0 && youngCap.changes.length === 0, '99属性年轻球员报告了未实际发生的成长');
check(veteranFloor.total === 0 && veteranFloor.changes.length === 0, '25属性老将报告了未实际发生的衰退');

function maximumAffordableAdd(value, points) {
  let current = value;
  let remaining = points;
  let added = 0;
  while (current < 99) {
    const cost = context.getTrainingPointCost(current);
    if (remaining < cost) break;
    remaining -= cost;
    current++;
    added++;
  }
  return added;
}

const fullBudgetOvrImpact = {};
['PG', 'SG', 'SF', 'PF', 'C'].forEach(pos => {
  fullBudgetOvrImpact[pos] = {};
  [50, 70, 80, 90, 95, 99].forEach(level => {
    const base = makeAttrs(level);
    const baseOvr = context.calcOVR(base, pos);
    const add = maximumAffordableAdd(level, 9);
    const impacts = ATTR_KEYS.map(key => {
      const trained = Object.assign({}, base, { [key]: level + add });
      return { key, ovrGain: context.calcOVR(trained, pos) - baseOvr };
    }).sort((a, b) => b.ovrGain - a.ovrGain || a.key.localeCompare(b.key));
    fullBudgetOvrImpact[pos][level] = {
      baseOvr,
      affordableAdd: add,
      bestAttribute: impacts[0].key,
      maximumOvrGain: impacts[0].ovrGain,
      minimumOvrGain: impacts[impacts.length - 1].ovrGain,
    };
    check(impacts.every(item => Number.isFinite(item.ovrGain) && item.ovrGain >= 0), `${pos}/${level}训练导致OVR异常`);
    if (level === 70 || level === 80) {
      check(impacts[0].ovrGain >= 1, `${pos}/${level}投入完整训练预算仍无法提升显示OVR`);
    }
    if (level === 99) check(add === 0 && impacts[0].ovrGain === 0, `${pos}满属性仍可继续训练`);
  });
});

const report = {
  trainingPointCases,
  lifecycle,
  uiAllocation,
  ageCurves,
  bodyManagementImprovement,
  boundaryReports: { youngCap: youngCap.changes, veteranFloor: veteranFloor.changes },
  fullBudgetOvrImpact,
  failureCount: failures.length,
  failures: failures.slice(0, 50),
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
