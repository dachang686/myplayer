const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/career_legacy_records.js'), 'utf8');
const context = vm.createContext({
  console, Date, JSON, Object, Array, Number, String, Boolean, RegExp, Error, Math, Set, Map,
});
context.globalThis = context;
context.getMyPlayerDisplayName = () => '验证传奇';
context.getCurrentSeasonLabel = () => '2031-32赛季';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function totals(values) {
  return Object.assign({ pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, games: 0 }, values || {});
}

function createState(totalStats) {
  return {
    gameId: 'legacy-validation-save',
    playerName: '验证传奇',
    careerTeam: 'HOME',
    _careerSaved: true,
    career: {
      seasonCount: 6,
      currentAge: 28,
      seasons: [],
      totalStats: totals(totalStats),
      playoffStats: totals(),
      honors: [],
      flags: {},
    },
    season: {
      playerStats: totals(),
      games: [],
      events: { storyTimeline: [] },
    },
  };
}

function findEvents(records, idPrefix) {
  return records.events.filter(event => event.id.indexOf(idPrefix) === 0);
}

vm.runInContext(source, context, { filename: 'js/career_legacy_records.js' });

context.STATE = createState({ pts: 21400 });
let result = context.CareerLegacy.recordRegularGame({ gameId: 'regular:1', silent: true });
let records = result.records;
assert(records.categories.points.length === 5, '得分榜未限制为前五');
assert(records.categories.points.filter(row => row.playerId === context.STATE.career.legacyPlayerId).length === 1, '得分榜出现重复玩家条目');
assert(findEvents(records, 'legacy:points:top5:').length === 1, '进入历史前五未触发一次事件');
assert(findEvents(records, 'legacy:points:top3:').length === 0, '仅进入第五时错误触发前三事件');

context.STATE.career.totalStats.pts = 24800;
context.STATE.career.totalStats.reb = 9500;
context.STATE.career.totalStats.ast = 8000;
context.STATE.career.totalStats.stl = 2000;
context.STATE.career.totalStats.blk = 2000;
context.CareerLegacy.recordRegularGame({ gameId: 'regular:2', silent: true });
records = context.STATE.career.legacyRecords;
assert(findEvents(records, 'legacy:points:top3:').length === 1, '第五升至第三未触发前三事件');
assert(records.categories.points[2].playerId === context.STATE.career.legacyPlayerId, '得分榜未按累计值正确排序');
Object.keys(records.categories).forEach(category => {
  const rows = records.categories[category];
  assert(rows.length <= 5, `${category} 榜单没有限制为前五`);
  assert(rows.every((row, index) => index === 0 || rows[index - 1].value >= row.value), `${category} 榜单未按数值降序`);
  assert(rows.filter(row => row.playerId === context.STATE.career.legacyPlayerId).length <= 1, `${category} 榜单存在重复玩家`);
});

context.STATE.career.totalStats.pts = 29000;
context.CareerLegacy.recordRegularGame({ gameId: 'regular:3', silent: true });
records = context.STATE.career.legacyRecords;
assert(findEvents(records, 'legacy:points:first:').length === 1, '成为历史第一未触发事件');
assert(records.categories.points[0].playerId === context.STATE.career.legacyPlayerId, '历史第一名次未更新');

const eventsBeforeReplay = records.events.length;
context.CareerLegacy.recordRegularGame({ gameId: 'regular:3', silent: true });
assert(records.events.length === eventsBeforeReplay, '重复结算同一比赛重复创建纪录事件');
assert(records.categories.points.filter(row => row.playerId === context.STATE.career.legacyPlayerId).length === 1, '重复结算导致玩家记录重复');

context.STATE.career.totalStats.pts = 40000;
context.STATE.career.totalStats.reb = 10000;
context.STATE.career.totalStats.ast = 9999;
context.CareerLegacy.recordRegularGame({ gameId: 'regular:4', silent: true });
records = context.STATE.career.legacyRecords;
assert(records.milestones.fourOneOne.components.points.achieved, '411 得分单项未完成');
assert(records.milestones.fourOneOne.components.rebounds.achieved, '411 篮板单项未完成');
assert(!records.milestones.fourOneOne.achieved, '411 未完成三项时错误授予总成就');

context.STATE.career.totalStats.ast = 10000;
context.CareerLegacy.recordRegularGame({ gameId: 'regular:5', silent: true });
records = context.STATE.career.legacyRecords;
assert(records.milestones.fourOneOne.achieved, '411 三项完成后未授予总成就');
assert(findEvents(records, 'legacy:411:complete:').length === 1, '411 总成就没有恰好触发一次');
const eventsBefore411Replay = records.events.length;
context.CareerLegacy.recordRegularGame({ gameId: 'regular:5', silent: true });
assert(records.events.length === eventsBefore411Replay, '411 重放比赛重复创建事件或勋章');
const playerPointsRank = records.categories.points.findIndex(row => row.playerId === context.STATE.career.legacyPlayerId) + 1;

const managerState = { mode: 'manager', marker: 'must-not-change' };
const managerSnapshot = JSON.stringify(managerState);
context.STATE = createState({ pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 });
context.STATE.career.seasons = [{
  seasonNum: 4,
  playerStats: totals({ pts: 25000, reb: 9500, ast: 7300, stl: 1600, blk: 1800 }),
}];
const migrated = context.CareerLegacy.ensure({ silent: true });
assert(migrated.version === 1, '旧个人存档未迁移到历史纪录版本');
assert(context.STATE.career.totalStats.pts === 25000, '旧存档未从已归档赛季补算生涯累计');
assert(migrated.categories.points.some(row => row.playerId === context.STATE.career.legacyPlayerId && row.value === 25000), '旧存档补算后未进入正确历史榜单');
assert(migrated.events.length === 0, '旧存档迁移错误补发历史事件');
assert(JSON.stringify(managerState) === managerSnapshot, '个人存档迁移污染经理模式状态');

console.log(JSON.stringify({
  legacyVersion: records.version,
  pointsRank: playerPointsRank,
  pointsEvents: findEvents(records, 'legacy:points:').length,
  fourOneOneEvents: findEvents(records, 'legacy:411:').length,
  migratedPoints: migrated.categories.points.find(row => row.playerId === context.STATE.career.legacyPlayerId).value,
  managerUntouched: JSON.stringify(managerState) === managerSnapshot,
}, null, 2));
