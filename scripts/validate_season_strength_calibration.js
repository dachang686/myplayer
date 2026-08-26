const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v2Source = fs.readFileSync(path.join(root, 'js', 'simulation_v2.js'), 'utf8');
const dataSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const scheduleSource = fs.readFileSync(path.join(root, 'js/data/league_schedule.js'), 'utf8');

const leagueData = new Function(`${dataSource}\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };`)();
const simConfig = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const generateLeagueSchedule = new Function(`${scheduleSource}\nreturn generateLeagueSchedule;`)();

const engineStart = indexSource.indexOf('function getPlayerPositions');
const engineEnd = indexSource.indexOf('/** 属性→效率系数：递减曲线', engineStart);
if (engineStart < 0 || engineEnd < 0) throw new Error('无法定位正式比赛引擎');

const state = {
  careerTeam: null,
  finalOVR: 0,
  position: null,
  attrs: {},
  season: null,
};

const attrFactor = value => {
  const bounded = Math.max(25, Math.min(99, Number(value) || 50));
  return Math.pow((bounded - 25) / 74, 0.85);
};
const af = value => Math.pow(attrFactor(value), 1.5);

const engine = new Function(
  'LEAGUE_PLAYER_DATA',
  'SIM_CONFIG',
  'STATE',
  'getMyPlayerDisplayName',
  'getTeamName',
  'getLeaguePlayerAge',
  'af',
  'ensureSeasonEventState',
  `${indexSource.slice(engineStart, engineEnd)}\n${v2Source}\nreturn { simulateGameNew, simulateGameAggregateV2: globalThis.simulateGameAggregateV2, calcTeamPowerWithPlayer, getTeamCompetitiveRating };`,
)(
  leagueData.LEAGUE_PLAYER_DATA,
  simConfig,
  state,
  () => '校准球员',
  team => (simConfig.TEAM_NAMES && simConfig.TEAM_NAMES[team]) || team,
  player => Number(player && player._age) || 27,
  af,
  () => state.season.events || (state.season.events = { activeEffects: [] }),
);

function seededRandom(seed, callback) {
  const originalRandom = Math.random;
  let value = 2166136261;
  String(seed).split('').forEach(char => {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619) >>> 0;
  });
  if (!value) value = 1;
  Math.random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

function getConferenceMap() {
  return simConfig.CONFERENCE || {};
}

function getDivisionMap() {
  return simConfig.DIVISIONS || {};
}

function getTeamRatings(teams) {
  state._lineupCache = {};
  return teams.map(team => {
    const power = engine.calcTeamPowerWithPlayer(team, { ignoreNpcAvailability: true });
    const rating = engine.getTeamCompetitiveRating(power);
    return {
      team,
      power,
      rating: rating.total,
      rosterRating: rating.roster,
      structureRating: rating.structure,
    };
  }).sort((a, b) => b.rating - a.rating || a.team.localeCompare(b.team));
}

function createStandings(teams) {
  return Object.fromEntries(teams.map(team => [team, {
    wins: 0,
    losses: 0,
    pointDiff: 0,
  }]));
}

function finalStandings(teams, standings, preseason) {
  const preseasonRank = Object.fromEntries(preseason.map((entry, index) => [entry.team, index + 1]));
  return teams.map(team => ({
    team,
    wins: standings[team].wins,
    losses: standings[team].losses,
    pointDiff: standings[team].pointDiff,
    preseasonRank: preseasonRank[team],
  })).sort((a, b) => b.wins - a.wins
    || b.pointDiff - a.pointDiff
    || a.preseasonRank - b.preseasonRank
    || a.team.localeCompare(b.team));
}

function runSeason(seasonNumber, teams) {
  const schedule = generateLeagueSchedule({
    teams,
    conference: getConferenceMap(),
    divisions: getDivisionMap(),
    seed: `season-strength-calibration:${seasonNumber}`,
  }).map(game => Object.assign({}, game, { simulated: false }));
  const standings = createStandings(teams);
  state.season = {
    schedule,
    standings,
    isPlayoffs: false,
    simulationEngine: engineName,
    _npcSeasonProfiles: {},
    events: { activeEffects: [] },
  };
  state._lineupCache = {};
  const preseason = getTeamRatings(teams);

  const simulate = engineName === 'v2' ? engine.simulateGameAggregateV2 : engine.simulateGameNew;
  if (typeof simulate !== 'function') throw new Error(`${engineName} 比赛引擎未加载`);
  for (const game of schedule) {
    // 该门禁只校准阵容实力映射；伤病、轮休和背靠背由其他测试覆盖，避免把可用性噪声混入实力排名。
    const result = simulate(game.home, game.away, 0, null, {
      isHomeA: true,
      isB2BA: false,
      isB2BB: false,
      gameDay: game.day,
      ignoreNpcAvailability: true,
    });
    game.simulated = true;
    const homeScore = Number(result.scoreA) || 0;
    const awayScore = Number(result.scoreB) || 0;
    standings[game.home].pointDiff += homeScore - awayScore;
    standings[game.away].pointDiff += awayScore - homeScore;
    if (result.won) {
      standings[game.home].wins++;
      standings[game.away].losses++;
    } else {
      standings[game.away].wins++;
      standings[game.home].losses++;
    }
  }

  const final = finalStandings(teams, standings, preseason);
  const finalRank = Object.fromEntries(final.map((entry, index) => [entry.team, index + 1]));
  // 附加赛资格按分区决定；校准也按分区排名，不能把南北两区混成全联盟排名。
  const conferencePreseason = Object.fromEntries(Object.entries(getConferenceMap()).map(([conference, conferenceTeams]) => [
    conference,
    preseason.filter(entry => conferenceTeams.includes(entry.team)),
  ]));
  const conferenceRank = {};
  Object.entries(getConferenceMap()).forEach(([conference, conferenceTeams]) => {
    final.filter(entry => conferenceTeams.includes(entry.team)).forEach((entry, index) => {
      conferenceRank[entry.team] = index + 1;
      entry.conference = conference;
      entry.conferenceRank = index + 1;
    });
  });
  const conferenceTop1 = Object.entries(conferencePreseason).map(([conference, ranking]) => ({
    conference,
    team: ranking[0].team,
    rating: ranking[0].rating,
    rosterRating: ranking[0].rosterRating,
    structureRating: ranking[0].structureRating,
    wins: standings[ranking[0].team].wins,
    rank: conferenceRank[ranking[0].team],
  }));
  const conferenceTop3 = Object.entries(conferencePreseason).flatMap(([conference, ranking]) => ranking.slice(0, 3).map(entry => ({
    conference,
    team: entry.team,
    wins: standings[entry.team].wins,
    rank: conferenceRank[entry.team],
  })));
  const conferenceTop5 = Object.entries(conferencePreseason).flatMap(([conference, ranking]) => ranking.slice(0, 5).map(entry => ({
    conference,
    team: entry.team,
    wins: standings[entry.team].wins,
    rank: conferenceRank[entry.team],
  })));
  return {
    season: seasonNumber,
    preseason,
    conferencePreseason,
    final,
    finalRank,
    conferenceRank,
    top1: conferenceTop1,
    top3: conferenceTop3,
    top5: conferenceTop5,
  };
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function pearsonCorrelation(left, right) {
  if (left.length !== right.length || left.length < 2) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  left.forEach((value, index) => {
    const leftDelta = value - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  });
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator > 0 ? numerator / denominator : 0;
}

function percentile(values, quantile) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const position = (sorted.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function summarize(seasons, teams) {
  const top1 = seasons.flatMap(season => season.top1);
  const top3 = seasons.flatMap(season => season.top3);
  const top5 = seasons.flatMap(season => season.top5);
  const leagueTop = seasons.map(season => season.final[0]);
  const leagueBottom = seasons.map(season => season.final[season.final.length - 1]);
  const trackedEntries = Object.entries(seasons[0].conferencePreseason)
    .flatMap(([conference, ranking]) => ranking.slice(0, 5).map(entry => ({
      conference,
      team: entry.team,
      rating: entry.rating,
      rosterRating: entry.rosterRating,
      structureRating: entry.structureRating,
    })));
  const preseasonTeamStats = trackedEntries.map(tracked => {
    const team = tracked.team;
    const entries = seasons.map(season => {
      const found = season.final.find(entry => entry.team === team);
      return { wins: found.wins, rank: season.conferenceRank[team] };
    });
    return {
      conference: tracked.conference,
      team,
      rating: Number(tracked.rating.toFixed(2)),
      averageWins: mean(entries.map(entry => entry.wins)),
      averageRank: mean(entries.map(entry => entry.rank)),
      playInRate: entries.filter(entry => entry.rank >= 7 && entry.rank <= 10).length / seasons.length,
      outOfPlayoffsRate: entries.filter(entry => entry.rank > 10).length / seasons.length,
    };
  });
  const top1PlayIn = top1.filter(entry => entry.rank >= 7 && entry.rank <= 10).length;
  const top1OutOfPlayoffs = top1.filter(entry => entry.rank > 10).length;
  const top5TopSix = top5.filter(entry => entry.rank <= 6).length;
  const top3OutOfPlayoffs = top3.filter(entry => entry.rank > 10).length;
  const correlationBySeason = seasons.map(season => {
    const ratingByTeam = Object.fromEntries(season.preseason.map(entry => [entry.team, entry.rating]));
    const winsByTeam = season.final.reduce((map, entry) => {
      map[entry.team] = entry.wins;
      return map;
    }, {});
    return pearsonCorrelation(
      teams.map(team => ratingByTeam[team]),
      teams.map(team => winsByTeam[team]),
    );
  });
  return {
    seasons: seasons.length,
    teams: teams.length,
    conferenceTop1: {
      teamBySeason: top1.map(entry => entry.team),
      averageRating: mean(top1.map(entry => entry.rating)),
      averageWins: mean(top1.map(entry => entry.wins)),
      minWins: Math.min(...top1.map(entry => entry.wins)),
      maxWins: Math.max(...top1.map(entry => entry.wins)),
      averageRank: mean(top1.map(entry => entry.rank)),
      playInRate: top1PlayIn / Math.max(1, top1.length),
      outOfPlayoffsRate: top1OutOfPlayoffs / Math.max(1, top1.length),
    },
    conferenceTop3: {
      averageWins: mean(top3.map(entry => entry.wins)),
      averageRank: mean(top3.map(entry => entry.rank)),
      outOfPlayoffsRate: top3OutOfPlayoffs / Math.max(1, top3.length),
    },
    conferenceTop5: {
      averageWins: mean(top5.map(entry => entry.wins)),
      averageRank: mean(top5.map(entry => entry.rank)),
      topSixRate: top5TopSix / top5.length,
      rankDistribution: top5.reduce((distribution, entry) => {
        const key = String(entry.rank);
        distribution[key] = (distribution[key] || 0) + 1;
        return distribution;
      }, {}),
    },
    preseasonTeamStats,
    preseasonTopTen: trackedEntries.map(entry => ({
      conference: entry.conference,
      team: entry.team,
      rating: Number(entry.rating.toFixed(2)),
      rosterRating: Number(entry.rosterRating.toFixed(2)),
      structureRating: Number(entry.structureRating.toFixed(2)),
    })),
    league: {
      actualFirstAverageWins: mean(leagueTop.map(entry => entry.wins)),
      actualLastAverageWins: mean(leagueBottom.map(entry => entry.wins)),
      actualFirstMinWins: Math.min(...leagueTop.map(entry => entry.wins)),
      actualLastMaxWins: Math.max(...leagueBottom.map(entry => entry.wins)),
    },
    ratingWinCorrelation: {
      bySeason: correlationBySeason,
      average: mean(correlationBySeason),
      p10: percentile(correlationBySeason, 0.10),
    },
  };
}

function validate(summary, mode) {
  const failures = [];
  const isStatistical = mode === 'statistical';
  const top1MinWins = isStatistical ? 54 : 52;
  const top1MaxRank = isStatistical ? 2.5 : 3.5;
  const top1MaxPlayInRate = isStatistical ? 0.08 : 0.17;
  const top1MaxOutRate = isStatistical ? 0.04 : 0.17;
  const top5MinTopSixRate = isStatistical ? 0.68 : 0.62;
  const minAverageCorrelation = isStatistical ? 0.70 : 0.50;
  const minP10Correlation = isStatistical ? 0.55 : 0.20;
  const maxTop3OutOfPlayoffsRate = isStatistical ? 0.05 : 0.15;
  if (summary.conferenceTop1.averageWins < top1MinWins) failures.push(`季前第一平均胜场过低：${summary.conferenceTop1.averageWins.toFixed(2)}`);
  if (summary.conferenceTop1.averageRank > top1MaxRank) failures.push(`季前第一平均排名过低：${summary.conferenceTop1.averageRank.toFixed(2)}`);
  if (summary.conferenceTop1.playInRate > top1MaxPlayInRate) failures.push(`季前第一进入附加赛概率过高：${summary.conferenceTop1.playInRate.toFixed(3)}`);
  if (summary.conferenceTop1.outOfPlayoffsRate > top1MaxOutRate) failures.push(`季前第一掉出季后赛概率过高：${summary.conferenceTop1.outOfPlayoffsRate.toFixed(3)}`);
  if (summary.conferenceTop5.topSixRate < top5MinTopSixRate) failures.push(`季前前五进入前六比例过低：${summary.conferenceTop5.topSixRate.toFixed(3)}`);
  if (summary.ratingWinCorrelation.average < minAverageCorrelation) {
    failures.push(`战力与胜场平均 Pearson 相关性过低：${summary.ratingWinCorrelation.average.toFixed(3)}`);
  }
  if (summary.ratingWinCorrelation.p10 < minP10Correlation) {
    failures.push(`战力与胜场单季 Pearson P10 过低：${summary.ratingWinCorrelation.p10.toFixed(3)}`);
  }
  if (summary.conferenceTop3.outOfPlayoffsRate > maxTop3OutOfPlayoffsRate) {
    failures.push(`季前分区前3掉出季后赛概率过高：${summary.conferenceTop3.outOfPlayoffsRate.toFixed(3)}`);
  }
  if (isStatistical && (summary.league.actualFirstAverageWins < 56 || summary.league.actualFirstAverageWins > 63)) {
    failures.push(`联盟第一平均胜场不在 56～63：${summary.league.actualFirstAverageWins.toFixed(2)}`);
  }
  if (isStatistical && (summary.league.actualLastAverageWins < 18 || summary.league.actualLastAverageWins > 29)) {
    failures.push(`联盟垫底平均胜场不在 18～29：${summary.league.actualLastAverageWins.toFixed(2)}`);
  }
  return failures;
}

const modeArg = process.argv.find(arg => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.slice('--mode='.length) : 'smoke';
if (!['smoke', 'statistical'].includes(mode)) throw new Error(`不支持的校准模式：${mode}`);
const engineArg = process.argv.find(arg => arg.startsWith('--engine='));
const engineName = engineArg ? engineArg.slice('--engine='.length).toLowerCase() : 'v2';
if (!['v1', 'v2'].includes(engineName)) throw new Error(`不支持的比赛引擎：${engineName}，可选 v1/v2`);
const seasonsArg = process.argv.find(arg => arg.startsWith('--seasons='));
const seasons = seasonsArg
  ? Math.max(1, Number(seasonsArg.slice('--seasons='.length)) || 1)
  : (mode === 'statistical' ? 50 : 12);
const teams = leagueData.LEAGUE_TEAM_IDS.slice();
if (teams.length !== 30) throw new Error(`真实联盟球队数应为30，实际为${teams.length}`);

const results = seededRandom(`season-strength:${mode}:${seasons}`, () => {
  const seasonsRun = [];
  for (let season = 1; season <= seasons; season++) seasonsRun.push(runSeason(season, teams));
  return seasonsRun;
});
const summary = summarize(results, teams);
const failures = validate(summary, mode);

console.log(JSON.stringify({ mode, engine: engineName, summary, failures }, null, 2));
if (failures.length) process.exitCode = 1;
