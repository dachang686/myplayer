const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'career_summary.js'), 'utf8');
const context = vm.createContext({ console, Object, Array, Number, String, Boolean, RegExp, Math, JSON, isFinite });
context.globalThis = context;
vm.runInContext(source, context, { filename: 'js/career_summary.js' });

const { CareerSummary } = context;
if (!CareerSummary || typeof CareerSummary.normalize !== 'function') {
  throw new Error('CareerSummary 未加载');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function totals(values) {
  return Object.assign({ games: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 }, values || {});
}

const completeCareer = {
  seasons: [
    {
      seasonNum: 1,
      team: 'BOS',
      ovr: 90,
      wins: 35,
      losses: 47,
      playoffResult: '未晋级',
      playerStats: totals({ games: 82, pts: 2870, reb: 400, ast: 300 }),
      awards: [],
    },
    {
      seasonNum: 2,
      team: 'LAL',
      ovr: 94,
      wins: 60,
      losses: 22,
      playoffResult: '总决赛·总冠军',
      playerStats: totals({ games: 82, pts: 1230, reb: 500, ast: 500 }),
      awards: [],
    },
  ],
  // 故意把冠军写到错误赛季；完整赛季档案必须覆盖这条旧荣誉。
  honors: [{ seasonNum: 1, label: '🏆 总冠军' }],
  totalStats: totals({ games: 164, pts: 4100 }),
  playoffStats: totals({ games: 6, pts: 120 }),
  flags: {},
};

const normalized = CareerSummary.normalize(completeCareer, { careerTeam: 'LAL', finalOVR: 82 });
assert(normalized.championships === 1, '完整赛季档案未以 playoffResult 作为冠军唯一口径');
assert(normalized.championshipSeasons[0].seasonNum === 2, '冠军赛季归属错误');
assert(normalized.playoffGames === 6 && normalized.playoffPoints === 120, '季后赛累计未与常规赛分离');
assert(normalized.teams.join(',') === 'BOS,LAL' && normalized.teamCount === 2, '球队经历归一化错误');

const repairedTotals = CareerSummary.normalize(Object.assign({}, completeCareer, {
  totalStats: totals({ games: 999, pts: 999 }),
}), { careerTeam: 'LAL' });
assert(repairedTotals.games === 164 && repairedTotals.points === 4100, '部分损坏的常规赛累计没有按赛季记录校正');
const mutableCareer = Object.assign({}, completeCareer, { totalStats: totals({ games: 999, pts: 999 }) });
assert(CareerSummary.reconcileRegularSeasonTotals(mutableCareer, { careerTeam: 'LAL' }), '累计数据修复函数未执行');
assert(mutableCareer.totalStats.games === 164 && mutableCareer.totalStats.pts === 4100, '累计数据修复函数未写回赛季事实');

const bestSeason = CareerSummary.normalize({
  seasons: completeCareer.seasons.map((season) => Object.assign({}, season, { playoffResult: '未晋级' })),
  honors: [],
  totalStats: completeCareer.totalStats,
  playoffStats: {},
  flags: {},
}, { finalOVR: 82 }).bestSeason;
assert(bestSeason && bestSeason.seasonNum === 1, '最佳赛季仍然主要按 OVR/球队胜场选择');

const awardCareer = {
  seasons: [{
    seasonNum: 1,
    team: 'BOS',
    ovr: 88,
    wins: 50,
    losses: 32,
    playoffResult: '首轮',
    playerStats: totals({ games: 82, pts: 1600, stl: 180, blk: 100 }),
    awards: [{ label: 'DPOY' }, { label: '最佳阵容' }, { label: '全明星' }],
  }],
  honors: [],
  totalStats: totals({ games: 82, pts: 1600, stl: 180, blk: 100 }),
  playoffStats: totals(),
  flags: { traded: true, majorInjuryInstance: 1 },
  mobility: { trades: 1 },
};
const awardSummary = CareerSummary.normalize(awardCareer, { careerTeam: 'BOS' });
assert(awardSummary.dpoy === 1 && awardSummary.allLeague === 1 && awardSummary.allStar === 1, '赛季荣誉未统一计入');
assert(awardSummary.hadMajorInjury && awardSummary.wasTraded, '伤病/交易事实未归一化');
const seasonCounts = CareerSummary.getAchievementCountsForSeasons(awardCareer, [1]);
assert(seasonCounts.dpoy === 1 && seasonCounts.allLeague === 1, '球队时代荣誉统计未使用统一口径');

const legacyCareer = {
  seasons: [{ seasonNum: 1, team: 'BOS', playerStats: totals() }],
  honors: [{ seasonNum: 1, label: '🏆 总冠军' }],
  totalStats: totals(),
  playoffStats: totals(),
};
assert(CareerSummary.normalize(legacyCareer, { careerTeam: 'BOS' }).championships === 1, '缺少完整赛季字段的旧存档未回退到 honors');

console.log(JSON.stringify({
  passed: true,
  checks: ['championship-authority', 'best-season', 'playoff-separation', 'award-counts', 'facts', 'legacy-fallback'],
}));
