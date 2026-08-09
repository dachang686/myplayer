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

const dataSource = fs.readFileSync(path.join(root, 'js/data/nba2k_players.js'), 'utf8');
const leagueData = new Function(`${dataSource}\nreturn { NBA2K_DATA, NBA2K_TEAMS };`)();
const coreSource = fs.readFileSync(path.join(root, 'js/core_game_logic.js'), 'utf8');
const blockStart = coreSource.indexOf('function leagueStatClamp');
const blockEnd = coreSource.indexOf('/** 属性→效率系数：递减曲线', blockStart);

if (blockStart < 0 || blockEnd < 0) throw new Error('无法定位联盟球员统计模拟代码');
const indexBlockStart = indexSource.indexOf('function leagueStatClamp');
const indexBlockEnd = indexSource.indexOf('/** 属性→效率系数：递减曲线', indexBlockStart);
if (indexBlockStart < 0 || indexBlockEnd < 0) throw new Error('无法定位 index.html 中的联盟球员统计模拟代码');
if (coreSource.slice(blockStart, blockEnd).trim() !== indexSource.slice(indexBlockStart, indexBlockEnd).trim()) {
  throw new Error('index.html 与 js/core_game_logic.js 的联盟统计模拟代码不同步');
}

function loadUserStatsReader(source) {
  const start = source.indexOf('function generatePlayerStatsNew');
  const end = source.indexOf('function calcShotPct', start);
  if (start < 0 || end < 0) throw new Error('无法定位用户球员统计读取代码');
  return new Function(`${source.slice(start, end)}\nreturn generatePlayerStatsNew;`)();
}

const userStatsReaders = [loadUserStatsReader(coreSource), loadUserStatsReader(indexSource)];
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
  const allPlayers = (leagueData.NBA2K_DATA[team] || []).slice();
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

const simulationSource = coreSource.slice(blockStart, blockEnd);
const simulation = new Function(
  'STATE',
  'af',
  'calcTeamLineup',
  'getLeaguePlayerAge',
  `${simulationSource}\nreturn { generateBoxScore, syncUserStatsToBoxScore };`,
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
  let invariantErrors = 0;

  try {
    const teams = leagueData.NBA2K_TEAMS;
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
            if (row._isUser) return;
            const key = `${team}:${row.name}`;
            const record = totals[key] || (totals[key] = {
              name: row.name, team, gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0,
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
  };
}

function topTenOverlap(first, second) {
  const names = new Set(first.map(row => row.name));
  return second.filter(row => names.has(row.name)).length;
}

function runUserSeason(seed) {
  const originalRandom = Math.random;
  const originalRoster = leagueData.NBA2K_DATA.WAS;
  Math.random = seededRandom(seed);
  state.season = { isPlayoffs: false };
  const user = {
    name: '__validation_user__', cname: '验证球员', pos: 'PG', ovr: 91, _isUser: true,
    threePT: 95, MID: 90, FIN: 88, DNK: 82, HAN: 94, PAS: 90,
    PDEF: 85, IDEF: 55, BLK: 45, REB: 55, ATH: 90, STR: 65, CLU: 90,
  };
  leagueData.NBA2K_DATA.WAS = originalRoster.concat(user);
  const totals = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, mins: 0, bestPts: 0 };
  let invariantErrors = 0;
  let injuryRedistributionErrors = 0;

  try {
    for (let game = 0; game < 82; game++) {
      const opponent = leagueData.NBA2K_TEAMS[(game + 1) % leagueData.NBA2K_TEAMS.length] === 'WAS'
        ? 'ATL'
        : leagueData.NBA2K_TEAMS[(game + 1) % leagueData.NBA2K_TEAMS.length];
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
    leagueData.NBA2K_DATA.WAS = originalRoster;
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
const report = {
  seasons: seasons.map((season, index) => ({
    season: index + 1,
    full82: season.full82,
    qualified: season.qualified.length,
    averageTeamAssists: Number(season.averageTeamAssists.toFixed(1)),
    invariantErrors: season.invariantErrors,
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
    .map(row => ({ name: row.name, gp: row.gp, ppg: row.pts, rpg: row.reb, apg: row.ast })),
  userSeason,
};

console.log(JSON.stringify(report, null, 2));

const limits = {
  pts: { first: 34, tenth: 28 },
  reb: { first: 16, tenth: 13 },
  ast: { first: 12, tenth: 10 },
  stl: { first: 2.8, tenth: 2.2 },
  blk: { first: 3.2, tenth: 2.3 },
};
const failures = [];
seasons.forEach((season, index) => {
  if (season.invariantErrors > 0) failures.push(`赛季 ${index + 1} 存在 ${season.invariantErrors} 个总量守恒错误`);
  if (season.full82 < 5 || season.full82 > 50) failures.push(`赛季 ${index + 1} 打满 82 场人数异常：${season.full82}`);
  if (season.averageTeamAssists < 23 || season.averageTeamAssists > 29) failures.push(`赛季 ${index + 1} 球队场均助攻异常：${season.averageTeamAssists}`);
  fields.forEach(field => {
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
if (userSeason.pts < 16 || userSeason.pts > 31 || userSeason.ast > 11 || userSeason.bestPts > 46) {
  console.error(`用户赛季分布超出合理范围：${JSON.stringify(userSeason)}`);
  process.exitCode = 1;
}
