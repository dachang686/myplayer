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

const defaultRecords = context.createDefaultCareerLegacyRecords();
const expectedBaselines = {
  points: ['nba-points-1', 43440, 'nba-points-10', 28289],
  rebounds: ['nba-rebounds-1', 23924, 'nba-rebounds-10', 14627],
  assists: ['nba-assists-1', 15806, 'nba-assists-10', 9061],
  steals: ['nba-steals-1', 3265, 'nba-steals-10', 2112],
  blocks: ['nba-blocks-1', 3830, 'nba-blocks-10', 2361],
};
Object.entries(expectedBaselines).forEach(([category, [firstId, firstValue, tenthId, tenthValue]]) => {
  const rows = defaultRecords.categories[category];
  assert(rows.length === 10, `${category} 默认 NBA 榜单不是前十`);
  assert(rows[0].playerId === firstId && rows[0].value === firstValue, `${category} 第一名真实 NBA 纪录错误`);
  assert(rows[9].playerId === tenthId && rows[9].value === tenthValue, `${category} 第十名真实 NBA 纪录错误`);
});

context.STATE = createState({ pts: 28290 });
let result = context.CareerLegacy.recordRegularGame({ gameId: 'regular:1', silent: true });
let records = result.records;
assert(records.categories.points.length === 10, '得分榜未限制为前十');
assert(records.categories.points.filter(row => row.playerId === context.STATE.career.legacyPlayerId).length === 1, '得分榜出现重复玩家条目');
assert(records.categories.points[9].playerId === context.STATE.career.legacyPlayerId, '玩家未处于历史第十');
assert(findEvents(records, 'legacy:points:top10:').length === 1, '进入历史前十未触发一次事件');
assert(findEvents(records, 'legacy:points:top3:').length === 0, '仅进入第十时错误触发前三事件');
assert(context.CareerLegacy.renderHall().includes('联盟历史 总得分 前十') && context.CareerLegacy.renderHall().includes('勒布朗·詹姆斯'), '历史殿堂未渲染 NBA 前十榜单');

context.STATE.career.totalStats.pts = 36930;
context.STATE.career.totalStats.reb = 9500;
context.STATE.career.totalStats.ast = 8000;
context.STATE.career.totalStats.stl = 2000;
context.STATE.career.totalStats.blk = 2000;
context.CareerLegacy.recordRegularGame({ gameId: 'regular:2', silent: true });
records = context.STATE.career.legacyRecords;
assert(findEvents(records, 'legacy:points:top3:').length === 1, '第十升至第三未触发前三事件');
assert(records.categories.points[2].playerId === context.STATE.career.legacyPlayerId, '得分榜未按累计值正确排序');
Object.keys(records.categories).forEach(category => {
  const rows = records.categories[category];
  assert(rows.length <= 10, `${category} 榜单没有限制为前十`);
  assert(rows.every((row, index) => index === 0 || rows[index - 1].value >= row.value), `${category} 榜单未按数值降序`);
  assert(rows.filter(row => row.playerId === context.STATE.career.legacyPlayerId).length <= 1, `${category} 榜单存在重复玩家`);
});

context.STATE.career.totalStats.pts = 43441;
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
  events: { storyTimeline: [{ legacyEventId: 'legacy:points:top5:old-player' }, { legacyEventId: 'legacy:411:complete:old-player' }] },
}];
context.STATE.career.legacyRecords = {
  version: 2,
  categories: {
    points: [{ playerId: 'legacy-points-1', playerName: '原创得分王', value: 28640 }],
    rebounds: [], assists: [], steals: [], blocks: [],
  },
  events: [
    { id: 'legacy:points:top5:old-player', kind: 'category' },
    { id: 'legacy:411:complete:old-player', kind: 'fourOneOne' },
  ],
  badges: [{ id: 'legacy:points:top5:old-player' }, { id: 'legacy:411:complete:old-player' }],
  triggeredEventIds: {
    'legacy:points:top5:old-player': { season: '旧赛季' },
    'legacy:411:complete:old-player': { season: '旧赛季' },
  },
  processedGameIds: {},
  milestones: { fourOneOne: { components: {} } },
};
context.STATE.career.honors = [
  { legacyEventId: 'legacy:points:top5:old-player' },
  { legacyEventId: 'legacy:411:complete:old-player' },
];
context.STATE.season.events.storyTimeline = [
  { legacyEventId: 'legacy:points:top5:old-player' },
  { legacyEventId: 'legacy:411:complete:old-player' },
];
const migrated = context.CareerLegacy.ensure({ silent: true });
assert(migrated.version === 3, '旧个人存档未迁移到历史纪录版本');
assert(context.STATE.career.totalStats.pts === 25000, '旧存档未从已归档赛季补算生涯累计');
assert(migrated.categories.points.length === 10, '旧存档迁移后得分榜未扩展为前十');
assert(migrated.categories.points[0].playerId === 'nba-points-1' && migrated.categories.points[0].value === 43440, '旧存档迁移后未使用真实 NBA 得分纪录');
assert(!migrated.categories.points.some(row => row.playerId.indexOf('legacy-') === 0), '旧存档迁移后仍保留原创基准');
assert(migrated.events.length === 1 && migrated.events[0].id === 'legacy:411:complete:old-player', '旧存档迁移错误处理非排名纪录');
assert(migrated.badges.length === 1 && migrated.badges[0].id === 'legacy:411:complete:old-player', '旧存档迁移后仍保留排名勋章');
assert(!migrated.triggeredEventIds['legacy:points:top5:old-player'], '旧存档迁移后仍保留排名触发标记');
assert(context.STATE.career.honors.length === 1 && context.STATE.career.honors[0].legacyEventId === 'legacy:411:complete:old-player', '旧存档迁移后仍保留排名荣誉');
assert(context.STATE.season.events.storyTimeline.length === 1 && context.STATE.season.events.storyTimeline[0].legacyEventId === 'legacy:411:complete:old-player', '当前赛季时间线未清理旧排名事件');
assert(context.STATE.career.seasons[0].events.storyTimeline.length === 1 && context.STATE.career.seasons[0].events.storyTimeline[0].legacyEventId === 'legacy:411:complete:old-player', '归档赛季时间线未清理旧排名事件');
assert(JSON.stringify(managerState) === managerSnapshot, '个人存档迁移污染经理模式状态');

console.log(JSON.stringify({
  legacyVersion: records.version,
  pointsRank: playerPointsRank,
  pointsEvents: findEvents(records, 'legacy:points:').length,
  fourOneOneEvents: findEvents(records, 'legacy:411:').length,
  migratedPointsRank: migrated.categories.points.findIndex(row => row.playerId === context.STATE.career.legacyPlayerId) + 1,
  managerUntouched: JSON.stringify(managerState) === managerSnapshot,
}, null, 2));
