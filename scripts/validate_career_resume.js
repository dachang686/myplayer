const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const start = source.indexOf('function resumeLoadedCareer(');
const end = source.indexOf('// 旧调用点保留兼容', start);
if (start < 0 || end < 0) throw new Error('无法定位读档恢复状态机');

function resumeFor(state, targetScreen) {
  const calls = [];
  const resume = new Function(
    'STATE', 'hasActiveSeasonPlayoffs', 'showOffseasonDraftLottery', 'showDraftPickTradeScreen',
    'showOffseasonDraftScreen', 'resumePlayoffs', 'showMyCard', 'showSeasonResults',
    'showRosterReview', 'renderTrainingCamp',
    `${source.slice(start, end)}\nreturn resumeLoadedCareer;`,
  )(
    state,
    () => !!state.activePlayoffs,
    () => calls.push('lottery'), () => calls.push('pick_trades'), () => calls.push('draft'),
    () => calls.push('playoffs'), () => calls.push('mycard'), () => calls.push('results'),
    () => calls.push('roster'), () => calls.push('training'),
  );
  resume(targetScreen);
  return calls[0];
}

const base = { career: { seasonCount: 2 }, season: {} };
const cases = [
  ['regular-season', { ...base, season: { schedule: [{ simulated: false }] } }, 'screen-training', 'mycard'],
  ['pick-trades', { ...base, offseasonDraft: { phase: 'pick_trades' }, season: { schedule: [{ simulated: true }] } }, 'screen-draft-lottery', 'pick_trades'],
  ['active-playoffs', { ...base, activePlayoffs: true, season: { schedule: [{ simulated: true }], isPlayoffs: true } }, 'screen-mycard', 'playoffs'],
  ['unviewed-results', { ...base, season: { schedule: [{ simulated: true }], playoffsDone: true } }, 'screen-training', 'results'],
  ['roster-review', { ...base, season: {}, career: { seasonCount: 2 } }, 'screen-roster-review', 'roster'],
  ['training', { ...base, season: {}, career: { seasonCount: 2, offseasonEventSeason: 2 } }, 'screen-mycard', 'training'],
];
const failures = cases.filter(([name, state, target, expected]) => resumeFor(state, target) !== expected);
if (failures.length) throw new Error('读档恢复状态机失败：' + failures.map(item => item[0]).join('、'));
console.log(JSON.stringify({ cases: cases.map(([name]) => name), passed: true }));
