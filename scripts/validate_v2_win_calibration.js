const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const modeArgument = process.argv.find(argument => argument.startsWith('--mode='));
const gamesArgument = process.argv.find(argument => argument.startsWith('--games='));
const mode = modeArgument ? modeArgument.slice('--mode='.length) : 'statistical';
const games = gamesArgument
  ? Math.max(1, Number(gamesArgument.slice('--games='.length)) || 1)
  : (mode === 'smoke' ? 500 : 5000);
if (!['smoke', 'statistical'].includes(mode)) {
  throw new Error(`未知校准模式：${mode}，可选 smoke/statistical`);
}
const isStatistical = mode === 'statistical';

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v2Source = fs.readFileSync(path.join(root, 'js', 'simulation_v2.js'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js', 'data', 'league_players.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'js', 'data', 'simulation_config.js'), 'utf8');
const leagueData = new Function(`${leagueSource}\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };`)();
const simConfig = new Function(`${configSource}\nreturn SIM_CONFIG;`)();

const engineStart = indexSource.indexOf('function getPlayerPositions');
const engineEnd = indexSource.indexOf('/** 属性→效率系数：递减曲线', engineStart);
if (engineStart < 0 || engineEnd < 0) throw new Error('无法定位比赛引擎源码');

const state = {
  careerTeam: null,
  finalOVR: 0,
  position: null,
  attrs: {},
  season: {
    schedule: [],
    isPlayoffs: false,
    _npcSeasonProfiles: {},
    events: { activeEffects: [] },
  },
};
const attrFactor = value => {
  const bounded = Math.max(25, Math.min(99, value || 50));
  return Math.pow((bounded - 25) / 74, 0.85);
};
const af = value => Math.pow(attrFactor(value), 1.5);
const ensureSeasonEventState = () => state.season.events || (state.season.events = { activeEffects: [] });
const runtime = new Function(
  'LEAGUE_PLAYER_DATA',
  'SIM_CONFIG',
  'STATE',
  'getMyPlayerDisplayName',
  'getTeamName',
  'getLeaguePlayerAge',
  'af',
  'ensureSeasonEventState',
  `${indexSource.slice(engineStart, engineEnd)}\n${v2Source}\nreturn globalThis.simulateGameAggregateV2;`,
)(
  leagueData.LEAGUE_PLAYER_DATA,
  simConfig,
  state,
  () => 'V2 攻防校准球员',
  team => team,
  player => Number(player && player._age) || 27,
  af,
  ensureSeasonEventState,
);
if (typeof runtime !== 'function') throw new Error('V2 引擎没有暴露 simulateGameAggregateV2');

function seeded(seed, callback) {
  const originalRandom = Math.random;
  let value = seed >>> 0;
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

const attributeKeys = [
  'threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS',
  'PDEF', 'STL', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU',
];
const positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG/SG', 'SF/PF', 'C/PF', 'SG/SF', 'PF/C'];
const minutes = [36, 34, 32, 30, 28, 24, 20, 16, 12, 8];
const sourceTeam = leagueData.LEAGUE_TEAM_IDS[0];

function makeSyntheticTeam(id, offenseLevel, defenseLevel, attributePatch) {
  const players = JSON.parse(JSON.stringify(leagueData.LEAGUE_PLAYER_DATA[sourceTeam].slice(0, 10)));
  players.forEach((player, index) => {
    player.id = `${id}-${index}`;
    player.cname = `${id}-${index}`;
    player.pos = positions[index];
    player.ovr = 90;
    attributeKeys.forEach(key => { player[key] = 80; });
    if (offenseLevel != null) {
      ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS'].forEach(key => { player[key] = offenseLevel; });
    }
    if (defenseLevel != null) {
      ['PDEF', 'STL', 'IDEF', 'BLK', 'REB'].forEach(key => { player[key] = defenseLevel; });
    }
    Object.assign(player, attributePatch || {});
  });
  leagueData.LEAGUE_PLAYER_DATA[id] = players;
  return id;
}

function fixedRotation(team) {
  const players = leagueData.LEAGUE_PLAYER_DATA[team].map(player => Object.assign({}, player));
  return { players, roleRanks: players.map((_, index) => index), minutes: minutes.slice() };
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

function runGame(teamA, teamB, prepared, seed) {
  state.season._npcSeasonProfiles = {};
  return seeded(seed, () => runtime(teamA, teamB, 0, null, {
    isHomeA: null,
    isB2B: false,
    isB2BA: false,
    isB2BB: false,
    ignoreNpcAvailability: true,
    _preparedRotations: prepared,
  }));
}

const control = makeSyntheticTeam('V2_CALIBRATION_CONTROL', null, null);
const scenarios = [
  { label: '基准', offense: null, defense: null, min: 0.48, max: 0.52 },
  { label: '进攻 +5', offense: 85, defense: null, min: 0.51, max: 0.56 },
  { label: '进攻 +10', offense: 90, defense: null, min: 0.55, max: 0.60 },
  { label: '进攻 +15', offense: 95, defense: null, min: 0.58, max: 0.65 },
  { label: '防守 +5', offense: null, defense: 85, min: 0.50, max: 0.56 },
  { label: '防守 +10', offense: null, defense: 90, min: 0.53, max: 0.60 },
  { label: '防守 +15', offense: null, defense: 95, min: 0.56, max: 0.63 },
  { label: '攻防同时 +10', offense: 90, defense: 90, min: 0.60, max: 0.67 },
];

const report = scenarios.map((scenario, index) => {
  const team = makeSyntheticTeam(`V2_CALIBRATION_CASE_${index}`, scenario.offense, scenario.defense);
  const prepared = { [team]: fixedRotation(team), [control]: fixedRotation(control) };
  const first = runGame(team, control, prepared, 400000 + index * 10000);
  const offensePower = first.teamA.power;
  const controlPower = first.teamB.power;
  let wins = 0;
  let totalMargin = 0;
  let estimatedWinRate = 0;
  let invariantErrors = 0;
  for (let game = 0; game < games; game++) {
    const resultA = runGame(team, control, prepared, 400000 + index * 10000 + game);
    const resultB = runGame(control, team, prepared, 500000 + index * 10000 + game);
    if (resultA.won) wins++;
    if (!resultB.won) wins++;
    totalMargin += (resultA.scoreA - resultA.scoreB) + (resultB.scoreB - resultB.scoreA);
    estimatedWinRate += resultA.estimatedWinProb + (1 - resultB.estimatedWinProb);
    [[team, control, resultA], [control, team, resultB]].forEach(([teamA, teamB, result]) => {
      const rowsA = result.boxScore[teamA] || [];
      const rowsB = result.boxScore[teamB] || [];
      if (result.scoreA !== sum(rowsA, 'pts') || result.scoreB !== sum(rowsB, 'pts')
        || result.won !== (result.scoreA > result.scoreB)
        || sum(rowsA, 'mins') !== 240 + (Number(result.ot) || 0) * 25
        || sum(rowsB, 'mins') !== 240 + (Number(result.ot) || 0) * 25) {
        invariantErrors++;
      }
    });
  }
  const sampleCount = games * 2;
  return {
    label: scenario.label,
    games: sampleCount,
    offenseGap: Number((offensePower.offense - controlPower.offense).toFixed(4)),
    defenseGap: Number((offensePower.defense - controlPower.defense).toFixed(4)),
    expectedMargin: Number(first.expectedMargin.toFixed(3)),
    estimatedWinRate: Number((estimatedWinRate / sampleCount * 100).toFixed(2)),
    empiricalWinRate: Number((wins / sampleCount * 100).toFixed(2)),
    averageMargin: Number((totalMargin / sampleCount).toFixed(2)),
    invariantErrors,
  };
});

const archetypeScenarios = [
  { label: '纯三分 +19', patch: { threePT: 99 } },
  { label: '纯中投 +19', patch: { MID: 99 } },
  { label: '纯终结 +19', patch: { FIN: 99 } },
  { label: '纯护球 +19', patch: { HAN: 99 } },
  { label: '纯传球 +19', patch: { PAS: 99 } },
  { label: '纯外防 +19', patch: { PDEF: 99 } },
  { label: '纯内防 +19', patch: { IDEF: 99 } },
];
const archetypeReport = isStatistical ? archetypeScenarios.map((scenario, index) => {
  const team = makeSyntheticTeam(`V2_CALIBRATION_ARCHETYPE_${index}`, null, null, scenario.patch);
  const prepared = { [team]: fixedRotation(team), [control]: fixedRotation(control) };
  const first = runGame(team, control, prepared, 600000 + index * 10000);
  let wins = 0;
  let estimatedWinRate = 0;
  let invariantErrors = 0;
  for (let game = 0; game < games; game++) {
    const resultA = runGame(team, control, prepared, 600000 + index * 10000 + game);
    const resultB = runGame(control, team, prepared, 700000 + index * 10000 + game);
    if (resultA.won) wins++;
    if (!resultB.won) wins++;
    estimatedWinRate += resultA.estimatedWinProb + (1 - resultB.estimatedWinProb);
    [[team, control, resultA], [control, team, resultB]].forEach(([teamA, teamB, result]) => {
      const rowsA = result.boxScore[teamA] || [];
      const rowsB = result.boxScore[teamB] || [];
      if (result.scoreA !== sum(rowsA, 'pts') || result.scoreB !== sum(rowsB, 'pts')
        || result.won !== (result.scoreA > result.scoreB)
        || sum(rowsA, 'mins') !== 240 + (Number(result.ot) || 0) * 25
        || sum(rowsB, 'mins') !== 240 + (Number(result.ot) || 0) * 25) {
        invariantErrors++;
      }
    });
  }
  const sampleCount = games * 2;
  return {
    label: scenario.label,
    games: sampleCount,
    rawAttackGap: Number((first.teamA.power.offense - first.teamB.power.offense).toFixed(4)),
    pregameAttackGap: Number((first.teamA.power.pregameOffense - first.teamB.power.pregameOffense).toFixed(4)),
    estimatedWinRate: Number((estimatedWinRate / sampleCount * 100).toFixed(2)),
    empiricalWinRate: Number((wins / sampleCount * 100).toFixed(2)),
    invariantErrors,
  };
}) : [];

const failures = [];
report.forEach(row => {
  const scenario = scenarios.find(item => item.label === row.label);
  const empirical = row.empiricalWinRate / 100;
  const estimated = row.estimatedWinRate / 100;
  if (row.invariantErrors > 0) failures.push(`${row.label} 存在比分/分钟守恒错误：${row.invariantErrors}`);
  const lowerBound = isStatistical ? scenario.min : Math.max(0, scenario.min - 0.08);
  const upperBound = isStatistical ? scenario.max : Math.min(1, scenario.max + 0.08);
  if (empirical < lowerBound || empirical > upperBound) {
    failures.push(`${row.label} 实测胜率越界：${row.empiricalWinRate}%（目标 ${scenario.min * 100}%~${scenario.max * 100}%）`);
  }
  if (Math.abs(empirical - estimated) > (isStatistical ? 0.02 : 0.08)) {
    failures.push(`${row.label} 预计/实测胜率偏差过大：${row.estimatedWinRate}% vs ${row.empiricalWinRate}%`);
  }
});
archetypeReport.forEach(row => {
  if (row.invariantErrors > 0) failures.push(`${row.label} 存在比分/分钟守恒错误：${row.invariantErrors}`);
  if (Math.abs(row.empiricalWinRate - row.estimatedWinRate) > 2.0) {
    failures.push(`${row.label} 类型校准偏差过大：${row.estimatedWinRate}% vs ${row.empiricalWinRate}%`);
  }
});
const monotonicGroups = [
  report.filter(row => row.label.startsWith('进攻 ')),
  report.filter(row => row.label.startsWith('防守 ')),
];
if (isStatistical) {
  monotonicGroups.forEach(group => {
    for (let index = 1; index < group.length; index++) {
      if (group[index].empiricalWinRate <= group[index - 1].empiricalWinRate) {
        failures.push(`攻防曲线不单调：${group[index - 1].label} -> ${group[index].label}`);
      }
    }
  });
}

console.log(JSON.stringify({ mode, gamesPerOrientation: games, report, archetypeReport }, null, 2));
if (failures.length) {
  throw new Error(`V2 攻防胜率校准失败：${failures.join('；')}`);
}
