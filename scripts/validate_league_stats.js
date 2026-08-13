const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inlineScripts = [...indexSource.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
inlineScripts.forEach((match, index) => {
  const attributes = match[1] || '';
  const source = match[2] || '';
  if (/\bsrc\s*=/.test(attributes) || /application\/json/.test(attributes) || !source.trim()) return;
  try {
    parser.parse(source, { sourceType: 'script', plugins: ['optionalChaining', 'objectRestSpread'] });
  } catch (error) {
    throw new Error(`index.html 第 ${index + 1} 个内联脚本语法错误：${error.message}`);
  }
});

const dataSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const leagueData = new Function(`${dataSource}\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };`)();
const blockStart = indexSource.indexOf('function leagueStatClamp');
const blockEnd = indexSource.indexOf('/** 属性→效率系数：递减曲线', blockStart);

if (blockStart < 0 || blockEnd < 0) throw new Error('无法定位联盟球员统计模拟代码');

function loadUserStatsReader(source) {
  const start = source.indexOf('function generatePlayerStatsNew');
  const end = source.indexOf('function calcShotPct', start);
  if (start < 0 || end < 0) throw new Error('无法定位用户球员统计读取代码');
  return new Function(`${source.slice(start, end)}\nreturn generatePlayerStatsNew;`)();
}

const userStatsReaders = [loadUserStatsReader(indexSource)];
const sharedBoxScoreSample = {
  boxScore: {
    WAS: [{ _isUser: true, pts: 27, reb: 4, ast: 9, stl: 2, blk: 1, tov: 3, fgm: 10, fga: 19, ftm: 3, fta: 4, threeM: 4, threeA: 9, mins: 36 }],
  },
};
userStatsReaders.forEach(reader => {
  const stats = reader({}, sharedBoxScoreSample, false);
  if (stats.pts !== 27 || stats.ast !== 9 || stats.mins !== 36 || stats.threeM !== 4) {
    throw new Error('用户赛季统计没有直接读取整队 Box Score');
  }
});

const state = { season: { isPlayoffs: false } };
const attrFactor = value => {
  const bounded = Math.max(25, Math.min(99, value || 50));
  return Math.pow((bounded - 25) / 74, 0.85);
};
const af = value => Math.pow(attrFactor(value), 1.5);
const canPlay = (rawPosition, position) => String(rawPosition || '')
  .split('/')
  .map(value => value.trim())
  .includes(position);

function calcTeamLineup(team) {
  const allPlayers = (leagueData.LEAGUE_PLAYER_DATA[team] || []).slice();
  const starters = {};
  const assigned = new Set();

  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(position => {
    let bestIndex = -1;
    let bestOvr = -1;
    allPlayers.forEach((player, index) => {
      const ovr = parseInt(player.ovr, 10) || 0;
      if (!assigned.has(index) && canPlay(player.pos, position) && ovr > bestOvr) {
        bestIndex = index;
        bestOvr = ovr;
      }
    });
    if (bestIndex < 0) {
      allPlayers.forEach((player, index) => {
        const ovr = parseInt(player.ovr, 10) || 0;
        if (!assigned.has(index) && ovr > bestOvr) {
          bestIndex = index;
          bestOvr = ovr;
        }
      });
    }
    if (bestIndex >= 0) {
      starters[position] = allPlayers[bestIndex];
      assigned.add(bestIndex);
    }
  });

  const bench = allPlayers
    .filter((player, index) => !assigned.has(index))
    .sort((a, b) => (parseInt(b.ovr, 10) || 0) - (parseInt(a.ovr, 10) || 0));
  return { starters, bench, allPlayers };
}

const simulationSource = indexSource.slice(blockStart, blockEnd);
const simulation = new Function(
  'STATE',
  'af',
  'calcTeamLineup',
  'getLeaguePlayerAge',
  `${simulationSource}\nreturn { generateBoxScore, syncUserStatsToBoxScore, getLeagueScoringBurst, LEAGUE_SCORING_BURST_RATES };`,
)(state, af, calcTeamLineup, player => Number(player._age) || 27);

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function runSeason(seed) {
  const originalRandom = Math.random;
  Math.random = seededRandom(seed);
  state.season = { isPlayoffs: false };
  const totals = {};
  const teamAssistTotals = [];
  const scoringBursts = { fiftyPlus: 0, sixtyPlus: 0, seventyPlus: 0, eightyPlus: 0, max: 0 };
  let invariantErrors = 0;

  try {
    const teams = leagueData.LEAGUE_TEAM_IDS;
    for (let round = 0; round < 82; round++) {
      for (let pair = 0; pair < teams.length; pair += 2) {
        const teamA = teams[(pair + round) % teams.length];
        const teamB = teams[(pair + round + 1) % teams.length];
        const scoreA = 102 + Math.floor(Math.random() * 21);
        const scoreB = 102 + Math.floor(Math.random() * 21);
        const boxScore = simulation.generateBoxScore(teamA, teamB, scoreA, scoreB);

        [[teamA, scoreA], [teamB, scoreB]].forEach(([team, score]) => {
          const rows = boxScore[team] || [];
          const sum = field => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
          if (sum('pts') !== score || sum('mins') !== 240) invariantErrors++;
          teamAssistTotals.push(sum('ast'));
          rows.forEach(row => {
            const points = Number(row.pts) || 0;
            scoringBursts.max = Math.max(scoringBursts.max, points);
            if (points >= 50) scoringBursts.fiftyPlus++;
            if (points >= 60) scoringBursts.sixtyPlus++;
            if (points >= 70) scoringBursts.seventyPlus++;
            if (points >= 80) scoringBursts.eightyPlus++;
            if (row._isUser) return;
            const key = `${team}:${row.playerId}`;
            const record = totals[key] || (totals[key] = {
              id: row.playerId, name: row.name, team, gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0,
            });
            record.gp++;
            ['pts', 'reb', 'ast', 'stl', 'blk'].forEach(field => { record[field] += row[field] || 0; });
          });
        });
      }
    }
  } finally {
    Math.random = originalRandom;
  }

  const rows = Object.values(totals).map(record => {
    const result = { ...record };
    ['pts', 'reb', 'ast', 'stl', 'blk'].forEach(field => {
      result[field] = Math.round(record[field] / record.gp * 10) / 10;
    });
    return result;
  });
  const qualified = rows.filter(row => row.gp >= 58);
  const leaders = {};
  ['pts', 'reb', 'ast', 'stl', 'blk'].forEach(field => {
    leaders[field] = qualified.slice().sort((a, b) => b[field] - a[field]).slice(0, 10);
  });

  return {
    rows,
    qualified,
    leaders,
    invariantErrors,
    full82: rows.filter(row => row.gp === 82).length,
    averageTeamAssists: teamAssistTotals.reduce((sum, value) => sum + value, 0) / teamAssistTotals.length,
    scoringBursts,
  };
}

function topTenOverlap(first, second) {
  const ids = new Set(first.map(row => row.id));
  return second.filter(row => ids.has(row.id)).length;
}

function runUserSeason(seed) {
  const originalRandom = Math.random;
  const originalRoster = leagueData.LEAGUE_PLAYER_DATA.WAS;
  Math.random = seededRandom(seed);
  state.season = { isPlayoffs: false };
  const user = {
    id: '__validation_user__', cname: '验证球员', pos: 'PG', ovr: 91, _isUser: true,
    threePT: 95, MID: 90, FIN: 88, DNK: 82, HAN: 94, PAS: 90,
    PDEF: 85, STL: 88, IDEF: 55, BLK: 45, REB: 55, ATH: 90, STR: 65, CLU: 90,
  };
  leagueData.LEAGUE_PLAYER_DATA.WAS = originalRoster.concat(user);
  const totals = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, mins: 0, bestPts: 0 };
  let invariantErrors = 0;
  let injuryRedistributionErrors = 0;

  try {
    for (let game = 0; game < 82; game++) {
      const opponent = leagueData.LEAGUE_TEAM_IDS[(game + 1) % leagueData.LEAGUE_TEAM_IDS.length] === 'WAS'
        ? 'ATL'
        : leagueData.LEAGUE_TEAM_IDS[(game + 1) % leagueData.LEAGUE_TEAM_IDS.length];
      const teamScore = 102 + Math.floor(Math.random() * 21);
      const opponentScore = 102 + Math.floor(Math.random() * 21);
      const boxScore = simulation.generateBoxScore('WAS', opponent, teamScore, opponentScore);
      const rows = boxScore.WAS || [];
      const userRow = rows.find(row => row._isUser);
      const sum = field => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
      if (!userRow || sum('pts') !== teamScore || sum('mins') !== 240) invariantErrors++;
      if (!userRow) continue;
      totals.gp++;
      ['pts', 'reb', 'ast', 'stl', 'blk', 'mins'].forEach(field => { totals[field] += userRow[field] || 0; });
      totals.bestPts = Math.max(totals.bestPts, userRow.pts || 0);

      if (game === 0) {
        const before = Object.fromEntries(['pts','reb','ast','stl','blk','tov','mins'].map(field => [field, sum(field)]));
        const reduced = { ...userRow };
        ['pts','reb','ast','stl','blk','tov'].forEach(field => { reduced[field] = Math.round((reduced[field] || 0) * 0.65); });
        reduced.mins = Math.max(8, Math.round((reduced.mins || 0) * 0.7));
        simulation.syncUserStatsToBoxScore({ boxScore }, reduced);
        ['pts','reb','ast','stl','blk','tov','mins'].forEach(field => {
          if (sum(field) !== before[field]) injuryRedistributionErrors++;
        });
      }
    }
  } finally {
    leagueData.LEAGUE_PLAYER_DATA.WAS = originalRoster;
    Math.random = originalRandom;
  }

  const averages = { gp: totals.gp, bestPts: totals.bestPts };
  ['pts', 'reb', 'ast', 'stl', 'blk', 'mins'].forEach(field => {
    averages[field] = Number((totals[field] / Math.max(1, totals.gp)).toFixed(1));
  });
  averages.invariantErrors = invariantErrors;
  averages.injuryRedistributionErrors = injuryRedistributionErrors;
  return averages;
}

const seasons = [1701, 2702, 3703, 4704, 5705, 6706].map(runSeason);
const userSeason = runUserSeason(7707);
const fields = ['pts', 'reb', 'ast', 'stl', 'blk'];
const averageScoringBursts = key => seasons.reduce((sum, season) => sum + season.scoringBursts[key], 0) / seasons.length;
const report = {
  seasons: seasons.map((season, index) => ({
    season: index + 1,
    full82: season.full82,
    qualified: season.qualified.length,
    averageTeamAssists: Number(season.averageTeamAssists.toFixed(1)),
    invariantErrors: season.invariantErrors,
    scoringBursts: season.scoringBursts,
    leaderRanges: Object.fromEntries(fields.map(field => [
      field,
      [season.leaders[field][0][field], season.leaders[field][9][field]],
    ])),
    leaderFull82Count: Object.fromEntries(fields.map(field => [
      field,
      season.leaders[field].filter(row => row.gp === 82).length,
    ])),
  })),
  adjacentTopTenOverlap: Object.fromEntries(fields.map(field => [
    field,
    seasons.slice(1).map((season, index) => topTenOverlap(seasons[index].leaders[field], season.leaders[field])),
  ])),
  sampleTeam: seasons[0].rows
    .filter(row => row.team === 'WAS')
    .sort((a, b) => b.gp - a.gp)
    .slice(0, 12)
    .map(row => ({ id: row.id, name: row.name, gp: row.gp, ppg: row.pts, rpg: row.reb, apg: row.ast })),
  userSeason,
};

console.log(JSON.stringify(report, null, 2));

const limits = {
  pts: { first: 34, tenth: 28 },
  reb: { first: 16, tenth: 13 },
  ast: { first: 12.5, tenth: 10 },
  stl: { first: 2.8, tenth: 2.2 },
  blk: { first: 4, tenth: 2.3 },
};
// 允许伤病和出场资格造成的赛季波动；2.5+ 仍代表联盟级护框榜首，不为过测试抬高球员属性。
const minimums = { ast: 10, blk: 2.5 };
const failures = [];
seasons.forEach((season, index) => {
  if (season.invariantErrors > 0) failures.push(`赛季 ${index + 1} 存在 ${season.invariantErrors} 个总量守恒错误`);
  if (season.full82 < 5 || season.full82 > 50) failures.push(`赛季 ${index + 1} 打满 82 场人数异常：${season.full82}`);
  if (season.averageTeamAssists < 23 || season.averageTeamAssists > 29) failures.push(`赛季 ${index + 1} 球队场均助攻异常：${season.averageTeamAssists}`);
  fields.forEach(field => {
    if (minimums[field] && season.leaders[field][0][field] < minimums[field]) failures.push(`赛季 ${index + 1} ${field} 榜首过低`);
    if (season.leaders[field][0][field] > limits[field].first) failures.push(`赛季 ${index + 1} ${field} 榜首过高`);
    if (season.leaders[field][9][field] > limits[field].tenth) failures.push(`赛季 ${index + 1} ${field} 第十名过高`);
    if (season.leaders[field].filter(row => row.gp === 82).length > 4) failures.push(`赛季 ${index + 1} ${field} 前十中打满 82 场的人数过多`);
  });
  const sampleTeamHighAssistCount = season.rows.filter(row => row.team === 'WAS' && row.gp >= 20 && row.ast >= 5).length;
  if (sampleTeamHighAssistCount > 2) failures.push(`赛季 ${index + 1} 样本球队有 ${sampleTeamHighAssistCount} 人场均至少 5 助攻`);
});

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}

if (userSeason.invariantErrors || userSeason.injuryRedistributionErrors) {
  console.error(`用户数据整队模拟守恒失败：${JSON.stringify(userSeason)}`);
  process.exitCode = 1;
}
if (userSeason.pts < 16 || userSeason.pts > 31 || userSeason.ast > 11 || userSeason.bestPts > 94) {
  console.error(`用户赛季分布超出合理范围：${JSON.stringify(userSeason)}`);
  process.exitCode = 1;
}

const averageFiftyPlus = averageScoringBursts('fiftyPlus');
const averageSixtyPlus = averageScoringBursts('sixtyPlus');
const totalSeventyPlus = seasons.reduce((sum, season) => sum + season.scoringBursts.seventyPlus, 0);
if (averageFiftyPlus < 10 || averageFiftyPlus > 35) {
  console.error(`联盟 50+ 单场频率偏离现代 NBA：每季 ${averageFiftyPlus.toFixed(1)} 场`);
  process.exitCode = 1;
}
if (averageSixtyPlus < 0.5 || averageSixtyPlus > 8) {
  console.error(`联盟 60+ 单场频率异常：每季 ${averageSixtyPlus.toFixed(1)} 场`);
  process.exitCode = 1;
}
if (totalSeventyPlus < 1 || totalSeventyPlus > seasons.length) {
  console.error(`联盟 70+ 单场频率异常：${seasons.length} 季共 ${totalSeventyPlus} 场`);
  process.exitCode = 1;
}

const originalRandomForBurst = Math.random;
try {
  let eightyCalls = 0;
  const eightyRolls = [0, 0.5];
  Math.random = () => eightyCalls < eightyRolls.length ? eightyRolls[eightyCalls++] : 0.5;
  const eightyBurst = simulation.getLeagueScoringBurst(1, 1);
  let calls = 0;
  const seventyRolls = [0.0003, 0.5];
  Math.random = () => calls < seventyRolls.length ? seventyRolls[calls++] : 0.5;
  const seventyBurst = simulation.getLeagueScoringBurst(1, 1);
  if (eightyBurst.tier !== 'eightyPlus' || eightyBurst.hardCap < 80 || eightyBurst.shareCap < 0.8) {
    console.error(`80+ 历史级爆发通道无效：${JSON.stringify(eightyBurst)}`);
    process.exitCode = 1;
  }
  if (seventyBurst.tier !== 'seventyPlus' || seventyBurst.hardCap < 70 || seventyBurst.hardCap >= 80) {
    console.error(`70+ 爆发通道无效：${JSON.stringify(seventyBurst)}`);
    process.exitCode = 1;
  }
} finally {
  Math.random = originalRandomForBurst;
}
