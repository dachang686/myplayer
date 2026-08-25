const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = source.indexOf('function getTrainingPointCost');
const end = source.indexOf('function resetTraining', start);
if (start < 0 || end < 0) throw new Error('无法定位统一训练成本函数');

const ATTR_KEYS = ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'STL', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'];
const functions = new Function(
  'ATTR_KEYS',
  `${source.slice(start, end)}\nreturn { getTrainingPointCost, calculateTrainingSpentPoints };`,
)(ATTR_KEYS);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const attrs = { MID: 90 };
assert(functions.getTrainingPointCost(95) === 1, '95→96 的单级成本必须为1');
assert(functions.getTrainingPointCost(96) === 2, '96→97 的单级成本必须为2');
assert(functions.calculateTrainingSpentPoints(attrs, { MID: 6 }) === 6, '90→96 成本应为6');
assert(functions.calculateTrainingSpentPoints({ MID: 96 }, { MID: 3 }) === 6, '96→99 成本应为6');
assert(functions.calculateTrainingSpentPoints({ MID: 95 }, { MID: 4 }) === 7, '95→99 成本应为7');
assert(functions.calculateTrainingSpentPoints({ MID: 90, FIN: 96 }, { MID: 6, FIN: 3 }) === 12, '多属性累计成本错误');
assert(functions.calculateTrainingSpentPoints({ MID: 90 }, { MID: -3 }) === 0, '非法负增量不能产生负训练点');
assert(!/function getPointCost\b/.test(source), '旧训练成本函数仍存在');
assert(!/added\s*>=\s*8/.test(source.slice(start, source.indexOf('function continueCareerAfterTraining', start))), '训练仍有额外单项+8限制');
const confirmStart = source.indexOf('function confirmTraining');
const confirmEnd = source.indexOf('function continueCareerAfterTraining', confirmStart);
const confirmSource = source.slice(confirmStart, confirmEnd);
assert(confirmSource.includes('calculateTrainingSpentPoints'), '确认训练没有复用统一预算函数');
assert(confirmSource.includes('calcOVR(STATE.attrs)'), '训练后没有重新计算 OVR');
assert(confirmSource.includes('saveCurrentSeasonToCareer()'), '训练后没有写回生涯存档');
assert(confirmSource.includes('trainingCompletedSeason'), '重复进入训练页时缺少已结算保护');
assert(confirmSource.includes('beginOffseasonDraft'), '训练已结算后没有恢复后续休赛期流程');

const resumeStart = source.indexOf('function resumeLoadedCareer');
const resumeEnd = source.indexOf('// 旧调用点保留兼容', resumeStart);
const resumeSource = source.slice(resumeStart, resumeEnd);
assert(resumeSource.includes('trainingCompleted'), '存档恢复没有识别本赛季训练是否已结算');
assert(resumeSource.includes('offseasonEventSeason === seasonKey && !trainingCompleted'), '已结算训练仍会恢复到训练页面');

console.log(JSON.stringify({
  passed: true,
  checks: ['90-to-96', '96-to-99', '95-to-99-boundary', 'multi-attribute', 'non-negative', 'single-cost-source', 'training-resume-guard'],
}));
