const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v2Source = fs.readFileSync(path.join(root, 'js', 'simulation_v2.js'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js', 'data', 'league_players.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'js', 'data', 'simulation_config.js'), 'utf8');
const leagueData = new Function(leagueSource + '\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };')();
const simConfig = new Function(configSource + '\nreturn SIM_CONFIG;')();

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
const runtimeBundle = new Function(
  'LEAGUE_PLAYER_DATA',
  'SIM_CONFIG',
  'STATE',
  'getMyPlayerDisplayName',
  'getTeamName',
  'getLeaguePlayerAge',
  'af',
  'ensureSeasonEventState',
  indexSource.slice(engineStart, engineEnd) + '\n' + v2Source + '\nreturn { v2: globalThis.simulateGameAggregateV2, dispatcher: simulateGameNew };',
)(
  leagueData.LEAGUE_PLAYER_DATA,
  simConfig,
  state,
  () => 'V2 验证球员',
  team => team,
  player => Number(player && player._age) || 27,
  af,
  ensureSeasonEventState,
);
const runtime = runtimeBundle.v2;
const dispatcher = runtimeBundle.dispatcher;

if (typeof runtime !== 'function') throw new Error('V2 引擎没有暴露 simulateGameAggregateV2');
if (typeof dispatcher !== 'function') throw new Error('V2 dispatcher 没有暴露 simulateGameNew');

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

function sum(rows, field) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

function checkResult(result, teamA, teamB) {
  const rowsA = result.boxScore[teamA] || [];
  const rowsB = result.boxScore[teamB] || [];
  const errors = [];
  if (result.engineVersion !== 'v2') errors.push('engineVersion');
  if (result.scoreA !== sum(rowsA, 'pts') || result.scoreB !== sum(rowsB, 'pts')) errors.push('score-boxscore');
  const expectedMinutes = 240 + (Number(result.ot) || 0) * 25;
  if (sum(rowsA, 'mins') !== expectedMinutes || sum(rowsB, 'mins') !== expectedMinutes) errors.push('minutes');
  if (result.marginComponents.rosterEdge !== 0 || result.marginComponents.starEdge !== 0) errors.push('ovr-margin');
  if (Object.prototype.hasOwnProperty.call(result, 'reconciliation')) errors.push('reconciliation');
  rowsA.concat(rowsB).forEach(row => {
    if (row.fgm > row.fga || row.threeM > row.threeA || row.threeA > row.fga || row.ftm > row.fta) errors.push('shot-invariant');
  });
  if (sum(rowsA, 'ast') > sum(rowsA, 'fgm') || sum(rowsB, 'ast') > sum(rowsB, 'fgm')) errors.push('assist-invariant');
  (result.engineDiagnostics && result.engineDiagnostics.periods || []).forEach(period => {
    if (!period.isOvertime) return;
    const identityA = period.fgaA - period.offensiveReboundsA + period.tovA + period.ftaA * 0.44;
    const identityB = period.fgaB - period.offensiveReboundsB + period.tovB + period.ftaB * 0.44;
    if (Math.abs(identityA - period.possessionsA) > 2 || Math.abs(identityB - period.possessionsB) > 2) {
      errors.push('ot-possession-invariant');
    }
  });
  if (sum(rowsA, 'stl') > sum(rowsB, 'tov') || sum(rowsB, 'stl') > sum(rowsA, 'tov')) errors.push('steal-invariant');
  return errors;
}

const teams = leagueData.LEAGUE_TEAM_IDS.slice(0, 2);
const allTeams = leagueData.LEAGUE_TEAM_IDS.slice();
const validationSeasons = 10;
const gamesPerSeason = (allTeams.length / 2) * 82;
const validationGames = validationSeasons * gamesPerSeason;
const invariantKinds = {};
const coveredTeams = new Set();
let invariantErrors = 0;
let totalA = 0;
let totalB = 0;
const leagueTotals = {
  fga: 0, fgm: 0, fta: 0, ftm: 0, reb: 0, ast: 0, tov: 0, stl: 0, blk: 0,
};
for (let game = 0; game < validationGames; game++) {
  const seasonGame = game % gamesPerSeason;
  if (seasonGame === 0) state.season._npcSeasonProfiles = {};
  const round = Math.floor(seasonGame / (allTeams.length / 2));
  const slot = seasonGame % (allTeams.length / 2);
  const teamA = allTeams[(slot + round) % allTeams.length];
  const teamB = allTeams[(allTeams.length - 1 - slot + round) % allTeams.length];
  coveredTeams.add(teamA); coveredTeams.add(teamB);
  const result = seeded(8000 + game, () => runtime(teamA, teamB, 0, null, {
    isHomeA: game % 2 === 0,
    isB2BA: game % 7 === 0,
    isB2BB: game % 11 === 0,
    ignoreNpcAvailability: true,
  }));
  const errors = checkResult(result, teamA, teamB);
  invariantErrors += errors.length;
  errors.forEach(error => { invariantKinds[error] = (invariantKinds[error] || 0) + 1; });
  totalA += result.scoreA;
  totalB += result.scoreB;
  [result.boxScore[teamA] || [], result.boxScore[teamB] || []].forEach(rows => {
    ['fga', 'fgm', 'fta', 'ftm', 'reb', 'ast', 'tov', 'stl', 'blk'].forEach(field => {
      leagueTotals[field] += sum(rows, field);
    });
  });
}
function makeSyntheticTeam(id, firstPlayer) {
  const base = JSON.parse(JSON.stringify(leagueData.LEAGUE_PLAYER_DATA[teams[0]].slice(0, 10)));
  base.forEach((player, index) => {
    player.id = id + '-' + index;
    player.cname = id + '-' + index;
    player.ovr = 90;
    ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'ATH', 'PAS', 'STR', 'REB', 'PDEF', 'IDEF', 'STL', 'BLK', 'CLU'].forEach(key => {
      player[key] = 80;
    });
  });
  Object.assign(base[0], firstPlayer);
  leagueData.LEAGUE_PLAYER_DATA[id] = base;
  return id;
}

const full99 = makeSyntheticTeam('V2_FULL99', {
  threePT: 99, MID: 99, FIN: 99, DNK: 99, HAN: 99, ATH: 99,
});
const partial99 = makeSyntheticTeam('V2_PARTIAL99', {
  threePT: 99, MID: 99, HAN: 99,
});
let fullPoints = 0;
let partialPoints = 0;
let fullFga = 0;
let partialFga = 0;
let fullPlayerPoints = 0;
let partialPlayerPoints = 0;
let fullPlayerFga = 0;
let partialPlayerFga = 0;
for (let game = 0; game < 800; game++) {
  const fullResult = seeded(12000 + game, () => runtime(full99, teams[1], 0, null, {
    isHomeA: null, ignoreNpcAvailability: true,
  }));
  const partialResult = seeded(12000 + game, () => runtime(partial99, teams[1], 0, null, {
    isHomeA: null, ignoreNpcAvailability: true,
  }));
  fullPoints += fullResult.scoreA;
  partialPoints += partialResult.scoreA;
  fullFga += sum(fullResult.boxScore[full99], 'fga');
  partialFga += sum(partialResult.boxScore[partial99], 'fga');
  fullPlayerPoints += (fullResult.boxScore[full99] || []).find(row => row.playerId === 'V2_FULL99-0')?.pts || 0;
  fullPlayerFga += (fullResult.boxScore[full99] || []).find(row => row.playerId === 'V2_FULL99-0')?.fga || 0;
  partialPlayerFga += (partialResult.boxScore[partial99] || []).find(row => row.playerId === 'V2_PARTIAL99-0')?.fga || 0;
  partialPlayerPoints += (partialResult.boxScore[partial99] || []).find(row => row.playerId === 'V2_PARTIAL99-0')?.pts || 0;
}

function patchPlayers(team, count, patch) {
  (leagueData.LEAGUE_PLAYER_DATA[team] || []).slice(0, count).forEach(player => Object.assign(player, patch));
}

function runPairStats(teamA, teamB, games, seedBase) {
  const totals = { pts: 0, ast: 0, tov: 0, fga: 0, rim: 0 };
  for (let game = 0; game < games; game++) {
    const gameResult = seeded(seedBase + game, () => runtime(teamA, teamB, 0, null, {
      isHomeA: null, ignoreNpcAvailability: true,
    }));
    const rowsA = gameResult.boxScore[teamA] || [];
    totals.pts += gameResult.scoreA;
    totals.ast += sum(rowsA, 'ast');
    totals.tov += sum(rowsA, 'tov');
    totals.fga += sum(rowsA, 'fga');
    totals.rim += Number(gameResult.engineDiagnostics && gameResult.engineDiagnostics.rimAttemptsA) || 0;
  }
  return {
    ppg: totals.pts / games,
    ast: totals.ast / games,
    tov: totals.tov / games,
    fga: totals.fga / games,
    rim: totals.rim / games,
  };
}

const pas99 = makeSyntheticTeam('V2_PAS99', {});
const pas50 = makeSyntheticTeam('V2_PAS50', {});
patchPlayers(pas99, 5, { PAS: 99 });
patchPlayers(pas50, 5, { PAS: 50 });
const pas99Stats = runPairStats(pas99, teams[1], 400, 18000);
const pas50Stats = runPairStats(pas50, teams[1], 400, 18000);

const han99 = makeSyntheticTeam('V2_HAN99', {});
const han50 = makeSyntheticTeam('V2_HAN50', {});
patchPlayers(han99, 5, { HAN: 99 });
patchPlayers(han50, 5, { HAN: 50 });
const han99Stats = runPairStats(han99, teams[1], 400, 19000);
const han50Stats = runPairStats(han50, teams[1], 400, 19000);

const attackTeam = makeSyntheticTeam('V2_ATTACK', { FIN: 95, DNK: 95, ATH: 90, threePT: 90, MID: 88 });
const anchorOne = makeSyntheticTeam('V2_ANCHOR_ONE', {});
const anchorTwo = makeSyntheticTeam('V2_ANCHOR_TWO', {});
const anchorAttrs = { IDEF: 99, BLK: 99, STR: 99, REB: 99 };
patchPlayers(anchorOne, 1, anchorAttrs);
patchPlayers(anchorTwo, 2, anchorAttrs);
const anchorOneStats = runPairStats(attackTeam, anchorOne, 500, 20000);
const anchorTwoStats = runPairStats(attackTeam, anchorTwo, 500, 20000);

function fingerprint(gameResult) {
  return JSON.stringify({
    scoreA: gameResult.scoreA,
    scoreB: gameResult.scoreB,
    qScoresA: gameResult.qScoresA,
    qScoresB: gameResult.qScoresB,
    boxScore: Object.keys(gameResult.boxScore).sort().map(key => gameResult.boxScore[key]),
    engineDiagnostics: gameResult.engineDiagnostics,
  });
}
state.season._npcSeasonProfiles = {};
const deterministicA = seeded(22000, () => runtime(pas99, teams[1], 0, null, { isHomeA: null, ignoreNpcAvailability: true }));
state.season._npcSeasonProfiles = {};
const deterministicB = seeded(22000, () => runtime(pas99, teams[1], 0, null, { isHomeA: null, ignoreNpcAvailability: true }));
const deterministicV2 = fingerprint(deterministicA) === fingerprint(deterministicB);
const v2HasDirectOvrEventPath = /\bovr\b/i.test(
  v2Source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''),
);
function makeFixedOvrTeam(id, firstOvr) {
  const base = JSON.parse(JSON.stringify(leagueData.LEAGUE_PLAYER_DATA[teams[0]].slice(0, 10)));
  base.forEach((player, index) => {
    player.id = 'OVR-ISO-' + index;
    player.cname = 'OVR-ISO-' + index;
    player.ovr = 90;
    player._isUser = true;
    ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'ATH', 'PAS', 'STR', 'REB', 'PDEF', 'IDEF', 'STL', 'BLK', 'CLU'].forEach(key => {
      player[key] = 80;
    });
  });
  base[0].ovr = firstOvr;
  leagueData.LEAGUE_PLAYER_DATA[id] = base;
  return id;
}

function fixedRotation(team) {
  const players = leagueData.LEAGUE_PLAYER_DATA[team].map(player => Object.assign({}, player, { _isUser: true }));
  return {
    players,
    roleRanks: players.map((_, index) => index),
    minutes: [36, 34, 32, 30, 28, 24, 20, 16, 12, 8],
  };
}
const ovrHigh = makeFixedOvrTeam('V2_OVR_HIGH', 99);
const ovrLow = makeFixedOvrTeam('V2_OVR_LOW', 70);
const ovrOpponent = makeFixedOvrTeam('V2_OVR_OPP', 90);
state.season._npcSeasonProfiles = {};
const ovrHighResult = seeded(23000, () => runtime(ovrHigh, ovrOpponent, 0, null, {
  isHomeA: null,
  ignoreNpcAvailability: true,
  _preparedRotations: { [ovrHigh]: fixedRotation(ovrHigh), [ovrOpponent]: fixedRotation(ovrOpponent) },
}));
state.season._npcSeasonProfiles = {};
const ovrLowResult = seeded(23000, () => runtime(ovrLow, ovrOpponent, 0, null, {
  isHomeA: null,
  ignoreNpcAvailability: true,
  _preparedRotations: { [ovrLow]: fixedRotation(ovrLow), [ovrOpponent]: fixedRotation(ovrOpponent) },
}));
const ovrIsolation = fingerprint(ovrHighResult) === fingerprint(ovrLowResult);


state.season._npcSeasonProfiles = {};
const dispatcherResult = seeded(24000, () => dispatcher(teams[0], teams[1], 0, null, {
  engineVersion: 'v2',
  isHomeA: true,
  isB2BA: true,
  isB2BB: false,
  ignoreNpcAvailability: true,
}));
const dispatcherIntegration = dispatcherResult
  && dispatcherResult.engineVersion === 'v2'
  && dispatcherResult.isHomeA === true
  && dispatcherResult.isB2BA === true
  && dispatcherResult.isB2BB === false
  && dispatcherResult.scoreA === sum(dispatcherResult.boxScore[teams[0]] || [], 'pts')
  && dispatcherResult.scoreB === sum(dispatcherResult.boxScore[teams[1]] || [], 'pts');
const v2ModifierPath = v2Source.includes('formVariance') && v2Source.includes('mediaPressure');

const specialistStats = {
  pas99: pas99Stats,
  pas50: pas50Stats,
  han99: han99Stats,
  han50: han50Stats,
  anchorOne: anchorOneStats,
  anchorTwo: anchorTwoStats,
  deterministicV2,
  v2HasDirectOvrEventPath,
  dispatcherIntegration,
  v2ModifierPath,
  ovrIsolation,
};

const result = {
  games: validationGames,
  invariantErrors,
  averageTotal: (totalA + totalB) / validationGames,
  distribution: {
    fga: leagueTotals.fga / validationGames / 2,
    fta: leagueTotals.fta / validationGames / 2,
    tov: leagueTotals.tov / validationGames / 2,
    reb: leagueTotals.reb / validationGames / 2,
    ast: leagueTotals.ast / validationGames / 2,
    stl: leagueTotals.stl / validationGames / 2,
    blk: leagueTotals.blk / validationGames / 2,
    fgPct: leagueTotals.fgm / Math.max(1, leagueTotals.fga),
    ftPct: leagueTotals.ftm / Math.max(1, leagueTotals.fta),
  },
  archetypeGames: 800,
  full99Ppg: fullPoints / 800,
  partial99Ppg: partialPoints / 800,
  full99Fga: fullFga / 800,
  partial99Fga: partialFga / 800,
  full99PlayerPpg: fullPlayerPoints / 800,
  partial99PlayerPpg: partialPlayerPoints / 800,
  full99PlayerFga: fullPlayerFga / 800,
  partial99PlayerFga: partialPlayerFga / 800,
  teamsCovered: coveredTeams.size,
  specialistStats,
  invariantKinds,
};
if (invariantErrors > 0) throw new Error('V2 守恒错误：' + JSON.stringify(result));
if (result.teamsCovered !== allTeams.length
  || result.averageTotal < 210 || result.averageTotal > 240
  || result.distribution.fta < 10 || result.distribution.fta > 24
  || result.distribution.tov < 8 || result.distribution.tov > 18
  || result.distribution.fga < 80 || result.distribution.fga > 105
  || result.distribution.reb < 40 || result.distribution.reb > 56
  || result.distribution.ast < 20 || result.distribution.ast > 34
  || result.distribution.stl < 2.5 || result.distribution.stl > 7
  || result.distribution.blk < 1.5 || result.distribution.blk > 5
  || result.distribution.fgPct < 0.43 || result.distribution.fgPct > 0.55
  || result.distribution.ftPct < 0.68 || result.distribution.ftPct > 0.92) {
  throw new Error('V2 联盟覆盖或基础分布越界：' + JSON.stringify(result));
}
if (result.full99PlayerPpg <= result.partial99PlayerPpg || result.full99PlayerFga <= result.partial99PlayerFga) {
  throw new Error('V2 没有体现完整技能包的机会/得分增益：' + JSON.stringify(result));
}
if (result.full99PlayerPpg - result.partial99PlayerPpg < 1.5
  || result.full99PlayerFga - result.partial99PlayerFga < 0.8
  || specialistStats.pas99.ast <= specialistStats.pas50.ast + 2
  || specialistStats.pas99.tov > specialistStats.pas50.tov
  || specialistStats.han99.fga <= specialistStats.han50.fga + 0.5
  || specialistStats.han99.tov >= specialistStats.han50.tov
  || specialistStats.anchorTwo.rim >= specialistStats.anchorOne.rim
  || !specialistStats.deterministicV2
  || !specialistStats.ovrIsolation
  || !specialistStats.dispatcherIntegration
  || !specialistStats.v2ModifierPath
  || specialistStats.v2HasDirectOvrEventPath) {
  throw new Error('V2 专项因果隔离失败：' + JSON.stringify(result));
}
console.log(JSON.stringify(result));
