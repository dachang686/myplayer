const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v2Source = fs.readFileSync(path.join(root, 'js', 'simulation_v2.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js', 'offseason.js'), 'utf8');
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
  indexSource.slice(engineStart, engineEnd) + '\n' + v2Source + '\nreturn { v2: globalThis.simulateGameAggregateV2, dispatcher: simulateGameNew, getNpcSeasonProfile, refreshNpcShortTermForm, buildLeagueGameRotation };',
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

const engineChoiceStart = indexSource.indexOf('function applyNewCareerSimulationEngineChoice');
const engineChoiceEnd = indexSource.indexOf('function renderModeSelect', engineChoiceStart);
if (engineChoiceStart < 0 || engineChoiceEnd < 0) throw new Error('无法定位新生涯引擎选择逻辑');
const buildApplyEngineChoice = new Function(
  'STATE',
  'document',
  indexSource.slice(engineChoiceStart, engineChoiceEnd) + '\nreturn applyNewCareerSimulationEngineChoice;',
);
const engineChoiceState = {};
const selectV2 = buildApplyEngineChoice(engineChoiceState, { querySelector: () => ({ value: 'v2' }) })();
const selectV1 = buildApplyEngineChoice(engineChoiceState, { querySelector: () => ({ value: 'v1' }) })();
const engineChoiceUiPath = selectV2 === 'v2'
  && selectV1 === null
  && engineChoiceState.simulationEngine === null
  && /name="new-career-engine" value="v1" checked/.test(indexSource)
  && /name="new-career-engine" value="v2"/.test(indexSource);

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
  const rotationA = result.teamA?.power?.rotationMinutes;
  const rotationB = result.teamB?.power?.rotationMinutes;
  const maxPlayerMinutes = 48 + (Number(result.ot) || 0) * 5;
  const rotationMatchesBoxScore = [
    [rotationA, rowsA],
    [rotationB, rowsB],
  ].every(([rotation, rows]) => Array.isArray(rotation)
    && rotation.length === rows.length
    && rotation.every((minutes, index) => Number(minutes) === Number(rows[index].mins)));
  if (!rotationMatchesBoxScore) errors.push('rotation-minutes-contract');
  if (rowsA.concat(rowsB).some(row => Number(row.mins) < 0 || Number(row.mins) > maxPlayerMinutes)) {
    errors.push('minute-cap');
  }
  if (result.marginComponents.rosterEdge !== 0 || result.marginComponents.starEdge !== 0) errors.push('ovr-margin');
  if (Object.prototype.hasOwnProperty.call(result, 'reconciliation')) errors.push('reconciliation');
  rowsA.concat(rowsB).forEach(row => {
    if (row.fgm > row.fga || row.threeM > row.threeA || row.threeA > row.fga || row.ftm > row.fta) errors.push('shot-invariant');
  });
  if (sum(rowsA, 'ast') > sum(rowsA, 'fgm') || sum(rowsB, 'ast') > sum(rowsB, 'fgm')) errors.push('assist-invariant');
  const periods = result.engineDiagnostics && result.engineDiagnostics.periods;
  if (!Number.isInteger(result.ot) || result.ot < 0) errors.push('ot-field');
  if (!Array.isArray(periods)) {
    errors.push('period-diagnostics-missing');
  } else if (Number.isInteger(result.ot) && periods.length !== 4 + result.ot) {
    errors.push('period-count');
  }
  ['expectedMargin', 'actualMargin', 'estimatedWinProb'].forEach(field => {
    if (!Number.isFinite(result[field])) errors.push('diagnostic-field');
  });
  (Array.isArray(periods) ? periods : []).forEach(period => {
    const requiredFields = [
      'possessionsA', 'possessionsB', 'fgaA', 'fgaB', 'ftaA', 'ftaB',
      'freeThrowTripsA', 'freeThrowTripsB', 'tovA', 'tovB',
      'offensiveReboundsA', 'offensiveReboundsB', 'missedFieldA', 'missedFieldB',
      'missedFtA', 'missedFtB',
    ];
    if (requiredFields.some(field => !Number.isFinite(period[field]))) {
      errors.push('period-field');
      return;
    }
    if (period.freeThrowTripsA < 0 || period.ftaA < period.freeThrowTripsA
      || period.ftaA > period.freeThrowTripsA * 3
      || period.freeThrowTripsB < 0 || period.ftaB < period.freeThrowTripsB
      || period.ftaB > period.freeThrowTripsB * 3) {
      errors.push('free-throw-trip-invariant');
    }
    if (Math.abs(period.possessionsA - period.possessionsB) > 1) errors.push('period-possession-balance');
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
let diagnosticsFailClosed = false;
let totalA = 0;
let totalB = 0;
const leagueTotals = {
  fga: 0, fgm: 0, fta: 0, ftm: 0, reb: 0, ast: 0, tov: 0, stl: 0, blk: 0,
};
const teamGameTurnovers = [];
const teamGameSteals = [];
const teamGameFta = [];
const teamGameOffensiveRebounds = [];
const teamPeriodOffensiveRebounds = [];
const seasonLeaders = [];
const scoringTails = { max: 0, fifty: 0, sixty: 0, seventy: 0, eighty: 0 };
let seasonPlayerTotals = {};
function recordPlayerRows(team, rows) {
  rows.forEach(row => {
    const key = team + ':' + row.playerId;
    const total = seasonPlayerTotals[key] || (seasonPlayerTotals[key] = {
      games: 0, pts: 0, ast: 0, stl: 0, reb: 0, blk: 0,
    });
    total.games++;
    ['pts', 'ast', 'stl', 'reb', 'blk'].forEach(field => { total[field] += Number(row[field]) || 0; });
    const points = Number(row.pts) || 0;
    scoringTails.max = Math.max(scoringTails.max, points);
    if (points >= 50) scoringTails.fifty++;
    if (points >= 60) scoringTails.sixty++;
    if (points >= 70) scoringTails.seventy++;
    if (points >= 80) scoringTails.eighty++;
  });
}
function finishEcologySeason() {
  const qualified = Object.values(seasonPlayerTotals).filter(row => row.games >= 58);
  const leader = field => qualified.reduce((best, row) => Math.max(best, row[field] / row.games), 0);
  seasonLeaders.push({
    ppg: leader('pts'), apg: leader('ast'), spg: leader('stl'), rpg: leader('reb'), bpg: leader('blk'),
  });
  seasonPlayerTotals = {};
}
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
  if (game === 0) {
    const tampered = JSON.parse(JSON.stringify(result));
    tampered.engineDiagnostics.periods[0].fgaA = undefined;
    diagnosticsFailClosed = checkResult(tampered, teamA, teamB).includes('period-field');
  }
  invariantErrors += errors.length;
  errors.forEach(error => { invariantKinds[error] = (invariantKinds[error] || 0) + 1; });
  totalA += result.scoreA;
  totalB += result.scoreB;
  const rowsA = result.boxScore[teamA] || [];
  const rowsB = result.boxScore[teamB] || [];
  recordPlayerRows(teamA, rowsA);
  recordPlayerRows(teamB, rowsB);
  [rowsA, rowsB].forEach(rows => {
    ['fga', 'fgm', 'fta', 'ftm', 'reb', 'ast', 'tov', 'stl', 'blk'].forEach(field => {
      leagueTotals[field] += sum(rows, field);
    });
    teamGameTurnovers.push(sum(rows, 'tov'));
    teamGameSteals.push(sum(rows, 'stl'));
    teamGameFta.push(sum(rows, 'fta'));
  });
  let gameOffensiveReboundsA = 0;
  let gameOffensiveReboundsB = 0;
  (result.engineDiagnostics && result.engineDiagnostics.periods || []).forEach(period => {
    teamPeriodOffensiveRebounds.push(period.offensiveReboundsA, period.offensiveReboundsB);
    gameOffensiveReboundsA += Number(period.offensiveReboundsA) || 0;
    gameOffensiveReboundsB += Number(period.offensiveReboundsB) || 0;
    if (period.offensiveReboundsA > period.missedFieldA + Math.floor(period.missedFtA * 0.45)
      || period.offensiveReboundsB > period.missedFieldB + Math.floor(period.missedFtB * 0.45)) {
      invariantErrors++;
      invariantKinds.orebCausality = (invariantKinds.orebCausality || 0) + 1;
    }
  });
  teamGameOffensiveRebounds.push(gameOffensiveReboundsA, gameOffensiveReboundsB);
  if (seasonGame === gamesPerSeason - 1) finishEcologySeason();
}

function standardDeviation(values) {
  const average = values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
  return Math.sqrt(values.reduce((total, value) => total + Math.pow(value - average, 2), 0) / Math.max(1, values.length));
}

function average(values) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
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
const archetypeGames = 5000;
const full99Tail = { max: 0, fifty: 0, sixty: 0, seventy: 0, eighty: 0 };
for (let game = 0; game < archetypeGames; game++) {
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
  const fullPlayerRow = (fullResult.boxScore[full99] || []).find(row => row.playerId === 'V2_FULL99-0');
  const fullGamePoints = fullPlayerRow?.pts || 0;
  fullPlayerPoints += fullGamePoints;
  fullPlayerFga += fullPlayerRow?.fga || 0;
  partialPlayerFga += (partialResult.boxScore[partial99] || []).find(row => row.playerId === 'V2_PARTIAL99-0')?.fga || 0;
  partialPlayerPoints += (partialResult.boxScore[partial99] || []).find(row => row.playerId === 'V2_PARTIAL99-0')?.pts || 0;
  full99Tail.max = Math.max(full99Tail.max, fullGamePoints);
  if (fullGamePoints >= 50) full99Tail.fifty++;
  if (fullGamePoints >= 60) full99Tail.sixty++;
  if (fullGamePoints >= 70) full99Tail.seventy++;
  if (fullGamePoints >= 80) full99Tail.eighty++;
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

const attributeLevels = [25, 40, 55, 70, 85, 99];
const allSimulationAttributes = ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'ATH', 'PAS', 'STR', 'REB', 'PDEF', 'IDEF', 'STL', 'BLK', 'CLU'];
const attributeGradient = attributeLevels.map(level => {
  const team = makeSyntheticTeam('V2_ATTRIBUTE_' + level, {});
  Object.assign(leagueData.LEAGUE_PLAYER_DATA[team][0], Object.fromEntries(allSimulationAttributes.map(key => [key, level])));
  const totals = { pts: 0, ast: 0, reb: 0, stl: 0, blk: 0, fga: 0 };
  const games = 600;
  for (let game = 0; game < games; game++) {
    const gameResult = seeded(210000 + game, () => runtime(team, teams[1], 0, null, {
      isHomeA: null,
      ignoreNpcAvailability: true,
      _preparedRotations: { [team]: fixedRotation(team) },
    }));
    const playerRow = (gameResult.boxScore[team] || []).find(row => row.playerId === team + '-0');
    Object.keys(totals).forEach(field => { totals[field] += Number(playerRow && playerRow[field]) || 0; });
  }
  return Object.assign({ level, games }, Object.fromEntries(Object.entries(totals).map(([field, value]) => [field, value / games])));
});

const teamAttributeGradient = [25, 50, 80, 99].map(level => {
  const team = makeSyntheticTeam('V2_TEAM_ATTRIBUTE_' + level, {});
  leagueData.LEAGUE_PLAYER_DATA[team].forEach(player => {
    Object.assign(player, Object.fromEntries(allSimulationAttributes.map(key => [key, level])));
  });
  const totals = { pts: 0, ast: 0, stl: 0, blk: 0 };
  const games = 400;
  for (let game = 0; game < games; game++) {
    const gameResult = seeded(215000 + game, () => runtime(team, teams[1], 0, null, {
      isHomeA: null,
      ignoreNpcAvailability: true,
      _preparedRotations: { [team]: fixedRotation(team) },
    }));
    const rows = gameResult.boxScore[team] || [];
    totals.pts += gameResult.scoreA;
    ['ast', 'stl', 'blk'].forEach(field => { totals[field] += sum(rows, field); });
  }
  return Object.assign({ level, games }, Object.fromEntries(Object.entries(totals).map(([field, value]) => [field, value / games])));
});

function runFocusedAttributeGradient(name, attributes, fields) {
  return attributeLevels.map(level => {
    const team = makeSyntheticTeam('V2_' + name + '_' + level, {});
    Object.assign(leagueData.LEAGUE_PLAYER_DATA[team][0], Object.fromEntries(attributes.map(key => [key, level])));
    const totals = Object.fromEntries(fields.map(field => [field, 0]));
    const games = 400;
    for (let game = 0; game < games; game++) {
      const gameResult = seeded(218000 + game, () => runtime(team, teams[1], 0, null, {
        isHomeA: null,
        ignoreNpcAvailability: true,
        _preparedRotations: { [team]: fixedRotation(team) },
      }));
      const playerRow = (gameResult.boxScore[team] || []).find(row => row.playerId === team + '-0');
      fields.forEach(field => { totals[field] += Number(playerRow && playerRow[field]) || 0; });
    }
    return Object.assign({ level, games }, Object.fromEntries(Object.entries(totals).map(([field, value]) => [field, value / games])));
  });
}

const focusedAttributeGradients = {
  scoring: runFocusedAttributeGradient('SCORING', ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'ATH'], ['pts', 'fga']),
  rebounding: runFocusedAttributeGradient('REBOUNDING', ['REB'], ['reb']),
  stealing: runFocusedAttributeGradient('STEALING', ['STL'], ['stl']),
  blocking: runFocusedAttributeGradient('BLOCKING', ['BLK'], ['blk']),
};

const roleIsolationTeam = makeSyntheticTeam('V2_ROLE_ISOLATION', {});
const roleIsolationBase = fixedRotation(roleIsolationTeam);
const roleIsolationPermuted = Object.assign({}, roleIsolationBase, { roleRanks: [4, 3, 2, 1, 0, 9, 8, 7, 6, 5] });
let roleIsolation = true;
for (let game = 0; game < 300; game++) {
  const options = rotation => ({
    isHomeA: null,
    ignoreNpcAvailability: true,
    _preparedRotations: { [roleIsolationTeam]: rotation },
  });
  state.season._npcSeasonProfiles = {};
  const baseline = seeded(220000 + game, () => runtime(roleIsolationTeam, teams[1], 0, null, options(roleIsolationBase)));
  state.season._npcSeasonProfiles = {};
  const permuted = seeded(220000 + game, () => runtime(roleIsolationTeam, teams[1], 0, null, options(roleIsolationPermuted)));
  if (fingerprint(baseline) !== fingerprint(permuted)) {
    roleIsolation = false;
    break;
  }
}

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

function fixedRotation(team, userIndex, customMinutes) {
  const players = leagueData.LEAGUE_PLAYER_DATA[team].map(player => Object.assign({}, player, { _isUser: true }));
  return {
    players: players.map((player, index) => Object.assign({}, player, { _isUser: userIndex != null && index === userIndex })),
    roleRanks: players.map((_, index) => index),
    minutes: customMinutes || [36, 34, 32, 30, 28, 24, 20, 16, 12, 8],
  };
}

function validateEmergencyReplacement() {
  const team = 'V2_EMERGENCY_TEAM';
  const originalCareerTeam = state.careerTeam;
  const originalFinalOVR = state.finalOVR;
  const originalPosition = state.position;
  const originalAttrs = state.attrs;
  const originalCache = state._lineupCache;
  const originalProfiles = state.season._npcSeasonProfiles;
  leagueData.LEAGUE_PLAYER_DATA[team] = JSON.parse(JSON.stringify(leagueData.LEAGUE_PLAYER_DATA[teams[0]].slice(0, 10)))
    .map((player, index) => Object.assign(player, { id: team + '-' + index, _isUser: false }));
  try {
    state.careerTeam = team;
    state.finalOVR = 90;
    state.position = 'PG';
    state.attrs = {};
    state._lineupCache = {};
    state.season._npcSeasonProfiles = {};
    leagueData.LEAGUE_PLAYER_DATA[team].forEach((player, index) => {
      state.season._npcSeasonProfiles[team + ':' + player.id] = {
        scoring: 1, rebounding: 1, playmaking: 1, defense: 1, formGamesLeft: 1,
        injuryGamesLeft: index < 6 ? 1 : 0,
        gamesMissed: 0, restChance: 0, injuryRisk: 0,
      };
    });
    const injuredIds = new Set(leagueData.LEAGUE_PLAYER_DATA[team].slice(0, 6).map(player => player.id));
    const rotation = runtimeBundle.buildLeagueGameRotation(team, {
      isPlayoffs: true,
      isPlayIn: true,
      userAvailable: false,
      ignoreNpcAvailability: false,
    });
    const injuredProfiles = leagueData.LEAGUE_PLAYER_DATA[team].slice(0, 6)
      .map(player => state.season._npcSeasonProfiles[team + ':' + player.id]);
    const replacements = rotation.players.filter(player => player && player._emergencyReplacement === true);
    const hardshipReplacementValid = rotation.players.length >= 5
      && replacements.length === 1
      && replacements[0].id === team + '-HARDSHIP-1'
      && rotation.players.every(player => !injuredIds.has(player && player.id))
      && injuredProfiles.every(profile => profile.injuryGamesLeft === 0 && profile.gamesMissed === 1);
    leagueData.LEAGUE_PLAYER_DATA[team].forEach((player, index) => {
      state.season._npcSeasonProfiles[team + ':' + player.id] = {
        scoring: 1, rebounding: 1, playmaking: 1, defense: 1, formGamesLeft: 1,
        injuryGamesLeft: 0, gamesMissed: 0, restChance: index < 6 ? 2 : 0, injuryRisk: 0,
      };
    });
    const restRotation = runtimeBundle.buildLeagueGameRotation(team, {
      isPlayoffs: false,
      userAvailable: false,
      ignoreNpcAvailability: false,
    });
    const restedPlayers = leagueData.LEAGUE_PLAYER_DATA[team].slice(0, 6);
    const restedIds = new Set(restedPlayers.map(player => player.id));
    const promotedRestPlayers = restRotation.players.filter(player => restedIds.has(player && player.id));
    const restProfiles = restedPlayers.map(player => state.season._npcSeasonProfiles[team + ':' + player.id]);
    const restCancellationValid = restRotation.players.length >= 5
      && promotedRestPlayers.length === 1
      && restRotation.players.every(player => !player._emergencyReplacement)
      && restProfiles.filter(profile => profile.gamesMissed === 0).length === 1
      && restProfiles.filter(profile => profile.gamesMissed === 1).length === 5;
    return hardshipReplacementValid && restCancellationValid;
  } finally {
    state.careerTeam = originalCareerTeam;
    state.finalOVR = originalFinalOVR;
    state.position = originalPosition;
    state.attrs = originalAttrs;
    state._lineupCache = originalCache;
    state.season._npcSeasonProfiles = originalProfiles;
    delete leagueData.LEAGUE_PLAYER_DATA[team];
  }
}

const emergencyReplacementPath = validateEmergencyReplacement();
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
Object.assign(leagueData.LEAGUE_PLAYER_DATA[ovrOpponent][0], {
  threePT: 25, MID: 40, FIN: 50, DNK: 60, HAN: 80, ATH: 99,
  PAS: 25, STR: 40, REB: 50, PDEF: 60, IDEF: 80, STL: 99, BLK: 25, CLU: 50,
});
const ovrIsolation = fingerprint(ovrHighResult) === fingerprint(ovrLowResult);

function npcFormFingerprint(ovr) {
  const profile = {
    scoring: 1, rebounding: 1, playmaking: 1, defense: 1, formGamesLeft: 0,
  };
  const player = {
    ovr, HAN: 82, PAS: 86, CLU: 84, _age: 28,
  };
  seeded(23500, () => runtimeBundle.refreshNpcShortTermForm(profile, player));
  return JSON.stringify(profile);
}
const npcFormOvrIsolation = npcFormFingerprint(99) === npcFormFingerprint(70);

function mutableSimulationStateFingerprint() {
  return JSON.stringify({
    lineupCache: state._lineupCache,
    npcSeasonProfiles: state.season._npcSeasonProfiles,
    usageBiasExists: Object.prototype.hasOwnProperty.call(state.season, '_usageBias'),
    usageBias: state.season._usageBias,
    careerTeamAvailabilityGame: state.season._careerTeamAvailabilityGame,
    historicCelebrationSequence: state.season._historicCelebrationSequence,
    events: state.season.events,
  });
}
state.careerTeam = ovrHigh;
state.season.events = { activeEffects: [] };
delete state.season._usageBias;
const seededStateBefore = mutableSimulationStateFingerprint();
dispatcher(ovrHigh, ovrOpponent, 0, null, {
  engineVersion: 'v2',
  randomSeed: 'state-restore',
  ignoreNpcAvailability: true,
  _preparedRotations: {
    [ovrHigh]: fixedRotation(ovrHigh, 0),
    [ovrOpponent]: fixedRotation(ovrOpponent),
  },
});
const seededStateRestored = seededStateBefore === mutableSimulationStateFingerprint();


state.season._npcSeasonProfiles = {};
state.careerTeam = teams[1];
state.season.schedule = [
  { day: 20, home: false, simulated: true },
  { day: 21, home: false, simulated: false },
];
state.season._dayMap = {
  20: [{ home: teams[1], away: 'V2_OTHER' }],
  21: [{ home: teams[0], away: teams[1] }],
};
const dispatcherResult = seeded(24000, () => dispatcher(teams[0], teams[1], 0, null, {
  engineVersion: 'v2',
  ignoreNpcAvailability: true,
}));
const dispatcherIntegration = dispatcherResult
  && dispatcherResult.engineVersion === 'v2'
  && dispatcherResult.isHomeA === true
  && dispatcherResult.isB2BA === false
  && dispatcherResult.isB2BB === true
  && dispatcherResult.scoreA === sum(dispatcherResult.boxScore[teams[0]] || [], 'pts')
  && dispatcherResult.scoreB === sum(dispatcherResult.boxScore[teams[1]] || [], 'pts');
state.careerTeam = ovrOpponent;
const healthyTeamBResult = seeded(25000, () => runtime(ovrHigh, ovrOpponent, 0, null, {
  isHomeA: null,
  ignoreNpcAvailability: true,
  _collectContext: true,
  _preparedRotations: { [ovrHigh]: fixedRotation(ovrHigh), [ovrOpponent]: fixedRotation(ovrOpponent, 0, [6, 34, 32, 30, 28, 28, 24, 20, 20, 18]) },
}));
const teamBAvailabilityResult = seeded(25000, () => runtime(ovrHigh, ovrOpponent, 0, 0.86, {
  isHomeA: null,
  ignoreNpcAvailability: true,
  _collectContext: true,
  _preparedRotations: { [ovrHigh]: fixedRotation(ovrHigh), [ovrOpponent]: fixedRotation(ovrOpponent, 0, [6, 34, 32, 30, 28, 28, 24, 20, 20, 18]) },
}));
const healthyUserRow = (healthyTeamBResult.boxScore[ovrOpponent] || []).find(row => row.playerId === 'OVR-ISO-0');
const injuredUserRow = (teamBAvailabilityResult.boxScore[ovrOpponent] || []).find(row => row.playerId === 'OVR-ISO-0');
const healthySnapshot = healthyTeamBResult.engineDiagnostics.userAttributeSnapshotB['OVR-ISO-0'] || {};
const injuredSnapshot = teamBAvailabilityResult.engineDiagnostics.userAttributeSnapshotB['OVR-ISO-0'] || {};
const injuryAttributesMonotonic = Object.keys(healthySnapshot)
  .filter(key => !key.endsWith('_after'))
  .every(key => Number(injuredSnapshot[key + '_after']) <= Number(healthySnapshot[key]));
const teamBAvailabilityIntegration = teamBAvailabilityResult
  && teamBAvailabilityResult.marginComponents.userAttributeFactorA === 1
  && teamBAvailabilityResult.marginComponents.userAttributeFactorB < 1
  && (injuredUserRow && healthyUserRow && injuredUserRow.mins <= healthyUserRow.mins)
  && (injuredUserRow && healthyUserRow && (sum(teamBAvailabilityResult.boxScore[ovrOpponent], 'mins') === 240 + (teamBAvailabilityResult.ot || 0) * 25))
  && injuryAttributesMonotonic;
state.careerTeam = null;
state.season.schedule = [];
delete state.season._dayMap;

const resetStart = offseasonSource.indexOf('function resetForNewSeason');
const resetEnd = offseasonSource.indexOf('function renderSeasonScreenDOM', resetStart);
if (resetStart < 0 || resetEnd < 0) throw new Error('无法定位 resetForNewSeason');
const resetForNewSeason = new Function(
  'STATE',
  'saveCurrentSeasonToCareer',
  'consumeNextSeasonMods',
  'createSeasonModifierState',
  'createSeasonEventState',
  'syncUserStarterStatus',
  'initStandings',
  'buildRealSchedule',
  'renderSeasonScreenDOM',
  offseasonSource.slice(resetStart, resetEnd) + '\nreturn resetForNewSeason;',
)(
  state,
  () => {},
  () => ({}),
  source => Object.assign({ injuryRiskBonus: 0, formVariance: 0, teamChemistry: 0, moraleBonus: 0, mediaPressure: 0 }, source || {}),
  () => ({ activeEffects: [] }),
  () => {},
  () => {},
  () => {},
  () => {},
);
state.career = { flags: {}, nextSeasonMods: {} };
state.careerTeam = ovrHigh;
state.simulationEngine = null;
state.season = { simulationEngine: 'v2' };
resetForNewSeason();
const persistenceResult = seeded(26000, () => dispatcher(ovrHigh, ovrOpponent, 0, null, {
  ignoreNpcAvailability: true,
  _preparedRotations: {
    [ovrHigh]: fixedRotation(ovrHigh, 0),
    [ovrOpponent]: fixedRotation(ovrOpponent),
  },
}));
const enginePersistencePath = state.season.simulationEngine === 'v2'
  && persistenceResult && persistenceResult.engineVersion === 'v2';

let emptyRotationThrows = false;
try {
  runtime('V2_EMPTY_ROTATION', ovrOpponent, 0, null, {
    isHomeA: null,
    ignoreNpcAvailability: true,
    _preparedRotations: {
      V2_EMPTY_ROTATION: { players: [], roleRanks: [], minutes: [] },
      [ovrOpponent]: fixedRotation(ovrOpponent),
    },
  });
} catch (error) {
  emptyRotationThrows = /\[V2\] 无法生成有效轮换/.test(String(error && error.message));
}
let shortRotationThrows = false;
try {
  const shortRotation = fixedRotation(ovrOpponent);
  runtime('V2_SHORT_ROTATION', ovrOpponent, 0, null, {
    isHomeA: null,
    ignoreNpcAvailability: true,
    _preparedRotations: {
      V2_SHORT_ROTATION: {
        players: shortRotation.players.slice(0, 4),
        roleRanks: [0, 1, 2, 3],
        minutes: [60, 60, 60, 60],
      },
      [ovrOpponent]: fixedRotation(ovrOpponent),
    },
  });
} catch (error) {
  shortRotationThrows = /\[V2\] 无法生成有效轮换/.test(String(error && error.message));
}
let overCapRotationThrows = false;
try {
  const overCapRotation = fixedRotation(ovrOpponent);
  runtime('V2_OVER_CAP_ROTATION', ovrOpponent, 0, null, {
    isHomeA: null,
    ignoreNpcAvailability: true,
    _preparedRotations: {
      V2_OVER_CAP_ROTATION: {
        players: overCapRotation.players.slice(0, 5),
        roleRanks: [0, 1, 2, 3, 4],
        minutes: [49, 49, 48, 48, 46],
      },
      [ovrOpponent]: fixedRotation(ovrOpponent),
    },
  });
} catch (error) {
  overCapRotationThrows = /\[V2\] 无法生成有效轮换/.test(String(error && error.message));
}
let fivePlayerInjuryMinutesSafe = false;
try {
  const fivePlayerRotation = fixedRotation(ovrOpponent, 0, [48, 48, 48, 48, 48]);
  const fivePlayerResult = runtime('V2_FIVE_PLAYER_INJURY', ovrOpponent, 0, null, {
    isHomeA: null,
    ignoreNpcAvailability: true,
    userAttributeFactor: 0.86,
    userMinutesFactor: 0.86,
    _preparedRotations: {
      V2_FIVE_PLAYER_INJURY: {
        players: fivePlayerRotation.players.slice(0, 5),
        roleRanks: [0, 1, 2, 3, 4],
        minutes: [48, 48, 48, 48, 48],
      },
      [ovrOpponent]: fixedRotation(ovrOpponent),
    },
  });
  const fivePlayerRows = fivePlayerResult.boxScore.V2_FIVE_PLAYER_INJURY || [];
  const fivePlayerUser = fivePlayerRows.find(row => row.playerId === 'OVR-ISO-0');
  fivePlayerInjuryMinutesSafe = fivePlayerResult.engineVersion === 'v2'
    && fivePlayerRows.length === 5
    && sum(fivePlayerRows, 'mins') === 240
    && fivePlayerRows.every(row => Number(row.mins) >= 0 && Number(row.mins) <= 48)
    && fivePlayerUser
    && Number(fivePlayerUser.mins) === 48
    && fivePlayerResult.marginComponents.requestedUserMinutesFactor === 0.86
    && fivePlayerResult.marginComponents.appliedUserMinutesFactor === 1
    && fivePlayerResult.marginComponents.userMinutesFactor === 1;
} catch (error) {
  fivePlayerInjuryMinutesSafe = false;
}
const diagnosticComponents = dispatcherResult && dispatcherResult.marginComponents;
const diagnosticReconstructedMargin = diagnosticComponents
  ? ['rosterEdge', 'matchupEdge', 'starEdge', 'seasonFormEdge', 'homeCourtEdge', 'seedBonusEdge', 'fatigueEdge', 'eventTeamEdge', 'seasonModifierTeamEdge']
    .reduce((total, key) => total + (Number(diagnosticComponents[key]) || 0), 0)
  : NaN;
const diagnosticFieldSemantics = !!(dispatcherResult
  && dispatcherResult.actualMargin === dispatcherResult.scoreA - dispatcherResult.scoreB
  && dispatcherResult.engineDiagnostics
  && dispatcherResult.engineDiagnostics.pregameExpectedMargin === dispatcherResult.expectedMargin
  && Number.isFinite(dispatcherResult.estimatedWinProb)
  && dispatcherResult.estimatedWinProb > 0
  && dispatcherResult.estimatedWinProb < 1
  && Math.abs(dispatcherResult.expectedMargin - Math.max(-18, Math.min(18, diagnosticReconstructedMargin))) < 1e-9
  && Math.abs(dispatcherResult.estimatedWinProb - (1 / (1 + Math.exp(-dispatcherResult.expectedMargin / 6.5)))) < 1e-12);

const v2ModifierPath = v2Source.includes('formVariance') && v2Source.includes('mediaPressure');
function modifierProbe(mods, seed) {
  state.season.mods = Object.assign({ formVariance: 0, mediaPressure: 0, teamChemistry: 0, moraleBonus: 0 }, mods);
  state.season._usageBias = 1;
  state.season._npcSeasonProfiles = {};
  const scoringCoreRotation = fixedRotation(ovrHigh, 0);
  Object.assign(scoringCoreRotation.players[0], { threePT: 92, MID: 92, FIN: 92, DNK: 92, HAN: 92, ATH: 92 });
  const result = seeded(seed, () => runtime(ovrHigh, ovrOpponent, 0, null, {
    isHomeA: null,
    ignoreNpcAvailability: true,
    _preparedRotations: {
      [ovrHigh]: scoringCoreRotation,
      [ovrOpponent]: fixedRotation(ovrOpponent),
    },
  }));
  const userRow = (result.boxScore[ovrHigh] || []).find(row => row.playerId === 'OVR-ISO-0');
  return userRow ? { pts: userRow.pts, fga: userRow.fga } : null;
}
const modifierProbeGames = 1600;
const modifierProbeResults = Array.from({ length: modifierProbeGames }, (_, index) => {
  const seed = 28000 + index;
  return {
    baseline: modifierProbe({ formVariance: 0, mediaPressure: 0 }, seed),
    lowForm: modifierProbe({ formVariance: -3, mediaPressure: 0 }, seed),
    highForm: modifierProbe({ formVariance: 3, mediaPressure: 0 }, seed),
    media: modifierProbe({ formVariance: 0, mediaPressure: 3 }, seed),
  };
});
function modifierDistribution(key) {
  const rows = modifierProbeResults.map(row => row[key]).filter(Boolean);
  const pts = rows.map(row => row.pts);
  const fga = rows.map(row => row.fga);
  return { games: rows.length, ptsMean: average(pts), ptsSd: standardDeviation(pts), fgaMean: average(fga), fgaSd: standardDeviation(fga) };
}
const modifierDistributions = {
  lowForm: modifierDistribution('lowForm'),
  baseline: modifierDistribution('baseline'),
  highForm: modifierDistribution('highForm'),
  media: modifierDistribution('media'),
};
const modifierMeanDrift = ['lowForm', 'highForm', 'media'].every(key =>
  Math.abs(modifierDistributions[key].ptsMean - modifierDistributions.baseline.ptsMean) < 1
  && Math.abs(modifierDistributions[key].fgaMean - modifierDistributions.baseline.fgaMean) < 0.75,
);
const v2ModifierFunctionalPath = modifierDistributions.lowForm.games === modifierProbeGames
  && modifierDistributions.lowForm.fgaSd < modifierDistributions.baseline.fgaSd
  && modifierDistributions.highForm.fgaSd > modifierDistributions.baseline.fgaSd
  && modifierDistributions.media.fgaSd > modifierDistributions.baseline.fgaSd
  && modifierDistributions.highForm.ptsSd > modifierDistributions.lowForm.ptsSd
  && modifierDistributions.media.ptsSd > modifierDistributions.lowForm.ptsSd
  && modifierMeanDrift;

function runNpcAvailabilityStress() {
  const originalCareerTeam = state.careerTeam;
  const originalSeason = state.season;
  const originalCache = state._lineupCache;
  let games = 0;
  let simulationErrors = 0;
  let invariantErrors = 0;
  let availabilityContradictions = 0;
  try {
    state.careerTeam = null;
    for (let season = 0; season < 10; season++) {
      state._lineupCache = {};
      state.season = {
        schedule: [],
        isPlayoffs: false,
        _npcSeasonProfiles: {},
        events: { activeEffects: [] },
        mods: { formVariance: 0, mediaPressure: 0, teamChemistry: 0, moraleBonus: 0 },
      };
      for (let game = 0; game < gamesPerSeason; game++) {
        const round = Math.floor(game / (allTeams.length / 2));
        const slot = game % (allTeams.length / 2);
        const teamA = allTeams[(slot + round + season) % allTeams.length];
        const teamB = allTeams[(allTeams.length - 1 - slot + round + season) % allTeams.length];
        try {
          const missedBefore = {};
          [teamA, teamB].forEach(team => {
            (leagueData.LEAGUE_PLAYER_DATA[team] || []).forEach(player => {
              const profile = state.season._npcSeasonProfiles[team + ':' + player.id];
              missedBefore[team + ':' + player.id] = Number(profile && profile.gamesMissed) || 0;
            });
          });
          const result = seeded(310000 + season * gamesPerSeason + game, () => runtime(teamA, teamB, 0, null, {
            isHomeA: game % 2 === 0,
            isB2BA: game % 9 === 0,
            isB2BB: game % 13 === 0,
            isPlayoffs: false,
            isPlayIn: false,
            ignoreNpcAvailability: false,
          }));
          const rowsA = result.boxScore[teamA] || [];
          const rowsB = result.boxScore[teamB] || [];
          const expectedMinutes = 240 + (Number(result.ot) || 0) * 25;
          if (result.engineVersion !== 'v2'
            || sum(rowsA, 'pts') !== result.scoreA
            || sum(rowsB, 'pts') !== result.scoreB
            || sum(rowsA, 'mins') !== expectedMinutes
            || sum(rowsB, 'mins') !== expectedMinutes
            || rowsA.concat(rowsB).some(row => Number(row.mins) > 48 + (Number(result.ot) || 0) * 5)) {
            invariantErrors++;
          }
          [[teamA, rowsA], [teamB, rowsB]].forEach(([team, rows]) => {
            rows.forEach(row => {
              const key = team + ':' + row.playerId;
              const profile = state.season._npcSeasonProfiles[key];
              if (profile && Number(profile.gamesMissed) > (missedBefore[key] || 0)) availabilityContradictions++;
            });
          });
        } catch (error) {
          simulationErrors++;
        }
        games++;
      }
    }
  } finally {
    state.careerTeam = originalCareerTeam;
    state.season = originalSeason;
    state._lineupCache = originalCache;
  }
  return { seasons: 10, games, simulationErrors, invariantErrors, availabilityContradictions };
}

const npcAvailabilityStress = runNpcAvailabilityStress();

const specialistStats = {
  pas99: pas99Stats,
  pas50: pas50Stats,
  han99: han99Stats,
  han50: han50Stats,
  anchorOne: anchorOneStats,
  anchorTwo: anchorTwoStats,
  attributeGradient,
  teamAttributeGradient,
  focusedAttributeGradients,
  roleIsolation,
  deterministicV2,
  dispatcherSummary: dispatcherResult && { engineVersion: dispatcherResult.engineVersion, isHomeA: dispatcherResult.isHomeA, isB2BA: dispatcherResult.isB2BA, isB2BB: dispatcherResult.isB2BB },
  v2HasDirectOvrEventPath,
  dispatcherIntegration,
  teamBAvailabilityIntegration,
  v2ModifierPath,
  v2ModifierFunctionalPath,
  modifierDistributions,
  npcAvailabilityStress,
  ovrIsolation,
  npcFormOvrIsolation,
  emergencyReplacementPath,
  seededStateRestored,
  engineChoiceUiPath,
  enginePersistencePath,
  diagnosticsFailClosed,
  emptyRotationThrows,
  shortRotationThrows,
  overCapRotationThrows,
  fivePlayerInjuryMinutesSafe,
  diagnosticFieldSemantics,
};

const result = {
  nba2025_26LeaderTargets: { ppg: 33.5, rpg: 12.9, apg: 10.7, bpg: 3.1 },
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
  archetypeGames,
  full99Ppg: fullPoints / archetypeGames,
  partial99Ppg: partialPoints / archetypeGames,
  full99Fga: fullFga / archetypeGames,
  partial99Fga: partialFga / archetypeGames,
  full99PlayerPpg: fullPlayerPoints / archetypeGames,
  partial99PlayerPpg: partialPlayerPoints / archetypeGames,
  full99PlayerFga: fullPlayerFga / archetypeGames,
  partial99PlayerFga: partialPlayerFga / archetypeGames,
  full99Tail,
  teamsCovered: coveredTeams.size,
  ecology: {
    leaderAverages: {
      ppg: average(seasonLeaders.map(row => row.ppg)),
      apg: average(seasonLeaders.map(row => row.apg)),
      spg: average(seasonLeaders.map(row => row.spg)),
      rpg: average(seasonLeaders.map(row => row.rpg)),
      bpg: average(seasonLeaders.map(row => row.bpg)),
    },
    seasonLeaders,
    teamTurnoverSd: standardDeviation(teamGameTurnovers),
    teamStealSd: standardDeviation(teamGameSteals),
    teamFtaSd: standardDeviation(teamGameFta),
    teamFtaAverage: average(teamGameFta),
    teamOffensiveReboundSd: standardDeviation(teamGameOffensiveRebounds),
    teamOffensiveReboundAverage: average(teamGameOffensiveRebounds),
    teamOffensiveReboundPeriodAverage: average(teamPeriodOffensiveRebounds),
    scoringTails,
  },
  specialistStats,
  invariantKinds,
};
const gradientFields = ['pts', 'ast', 'reb', 'stl', 'blk', 'fga'];
const playerAttributeMonotonic = gradientFields.every(field => attributeGradient.every((row, index) =>
  index === 0 || row[field] >= attributeGradient[index - 1][field],
));
const teamAttributeMonotonic = ['pts', 'ast', 'stl'].every(field => teamAttributeGradient.every((row, index) =>
  index === 0 || row[field] >= teamAttributeGradient[index - 1][field],
)) && teamAttributeGradient.slice(0, 3).every((row, index, rows) => index === 0 || row.blk >= rows[index - 1].blk);
const focusedAttributeMonotonic = Object.values(focusedAttributeGradients).every(rows => {
  const fields = Object.keys(rows[0]).filter(key => !['level', 'games'].includes(key));
  return fields.every(field => rows.every((row, index) => index === 0 || row[field] >= rows[index - 1][field]));
});
const scoringGradient = focusedAttributeGradients.scoring;
const scoringGradientSmooth = scoringGradient.every((row, index) => {
  if (index === 0) return true;
  const previous = scoringGradient[index - 1];
  return row.pts - previous.pts <= 16 && row.fga - previous.fga <= 11;
});
const floorPlayer = attributeGradient.find(row => row.level === 25);
const lowPlayer = attributeGradient.find(row => row.level === 40);
const elitePlayer = attributeGradient.find(row => row.level === 99);
const lowTeam = teamAttributeGradient.find(row => row.level === 25);
const midTeam = teamAttributeGradient.find(row => row.level === 50);
const lowScorer = scoringGradient.find(row => row.level === 25);
const lowRebounder = focusedAttributeGradients.rebounding.find(row => row.level === 25);
const eliteRebounder = focusedAttributeGradients.rebounding.find(row => row.level === 99);
const lowStealer = focusedAttributeGradients.stealing.find(row => row.level === 25);
const eliteStealer = focusedAttributeGradients.stealing.find(row => row.level === 99);
const lowBlocker = focusedAttributeGradients.blocking.find(row => row.level === 25);
const eliteBlocker = focusedAttributeGradients.blocking.find(row => row.level === 99);
if (invariantErrors > 0) throw new Error('V2 守恒错误：' + JSON.stringify(result));
if (result.teamsCovered !== allTeams.length
  || result.averageTotal < 210 || result.averageTotal > 240
  || result.distribution.fta < 10 || result.distribution.fta > 24
  || result.distribution.tov < 8 || result.distribution.tov > 18
  || result.distribution.fga < 80 || result.distribution.fga > 105
  || result.distribution.reb < 40 || result.distribution.reb > 56
  || result.distribution.ast < 20 || result.distribution.ast > 34
  || result.distribution.stl < 2.5 || result.distribution.stl > 7
  || result.distribution.blk < 4 || result.distribution.blk > 5.8
  || result.distribution.fgPct < 0.43 || result.distribution.fgPct > 0.55
  || result.distribution.ftPct < 0.68 || result.distribution.ftPct > 0.92) {
  throw new Error('V2 联盟覆盖或基础分布越界：' + JSON.stringify(result));
}
if (result.full99PlayerPpg <= result.partial99PlayerPpg || result.full99PlayerFga <= result.partial99PlayerFga) {
  throw new Error('V2 没有体现完整技能包的机会/得分增益：' + JSON.stringify(result));
}
const leaderAverages = result.ecology.leaderAverages;
// 10 个 82 场周期的尾部只允许保留稀有高分，同时防止 burst 参数回归到泛滥。
if (leaderAverages.ppg < 31 || leaderAverages.ppg > 36
  || leaderAverages.apg < 9.8 || leaderAverages.apg > 11.8
  || leaderAverages.spg < 1.5 || leaderAverages.spg > 3
  || leaderAverages.rpg < 11.8 || leaderAverages.rpg > 14
  || leaderAverages.bpg < 2.5 || leaderAverages.bpg > 3.6
  || result.ecology.teamTurnoverSd < 1.5 || result.ecology.teamTurnoverSd > 5
  || result.ecology.teamStealSd < 0.8 || result.ecology.teamStealSd > 4
  || result.ecology.teamFtaSd < 2 || result.ecology.teamFtaSd > 8
  || result.ecology.teamOffensiveReboundAverage < 5 || result.ecology.teamOffensiveReboundAverage > 9
  || result.ecology.scoringTails.fifty < 1
  || result.ecology.scoringTails.fifty > 500
  || result.ecology.scoringTails.sixty < 1
  || result.ecology.scoringTails.sixty > 100
  || result.ecology.scoringTails.seventy < 1
  || result.ecology.scoringTails.seventy > 20
  || result.ecology.scoringTails.eighty > 5
  || result.ecology.scoringTails.max > 90
  || result.full99Tail.fifty < 1
  || result.full99Tail.fifty > 200
  || result.full99Tail.sixty > 80
  || result.full99Tail.seventy > 20
  || result.full99Tail.eighty > 10
  || result.full99Tail.max > 90
  || result.full99Tail.max < 70) {
  throw new Error('V2 球员生态或单场尾部越界：' + JSON.stringify(result));
}
if (result.full99PlayerPpg - result.partial99PlayerPpg < 1.5
  || result.full99PlayerFga - result.partial99PlayerFga < 0.8
  || specialistStats.pas99.ast <= specialistStats.pas50.ast + 2
  || specialistStats.pas99.tov > specialistStats.pas50.tov
  || !specialistStats.enginePersistencePath
  || specialistStats.han99.fga <= specialistStats.han50.fga + 0.5
  || specialistStats.han99.tov >= specialistStats.han50.tov
  || specialistStats.anchorTwo.rim >= specialistStats.anchorOne.rim
  || !specialistStats.roleIsolation
  || !playerAttributeMonotonic
  || !teamAttributeMonotonic
  || !focusedAttributeMonotonic
  || !scoringGradientSmooth
  || !floorPlayer || floorPlayer.pts < 0.4 || floorPlayer.pts > 2 || floorPlayer.fga < 0.5 || floorPlayer.fga > 2
  || !lowPlayer || lowPlayer.pts < 2.5 || lowPlayer.pts > 5 || lowPlayer.fga < 3 || lowPlayer.fga > 6 || lowPlayer.ast > 1
  || lowPlayer.reb > 4 || lowPlayer.stl > 0.5 || lowPlayer.blk > 0.35
  || !elitePlayer || elitePlayer.pts < 30 || elitePlayer.pts > 45 || elitePlayer.blk < 1.5
  || !lowScorer || lowScorer.fga < 0.75 || lowScorer.fga > 2.5 || lowScorer.pts < 0.5 || lowScorer.pts > 3
  || !lowRebounder || !eliteRebounder || lowRebounder.reb > 2 || eliteRebounder.reb < 8
  || !lowStealer || !eliteStealer || lowStealer.stl > 0.15 || eliteStealer.stl < 1.2
  || !lowBlocker || !eliteBlocker || lowBlocker.blk > 0.15 || eliteBlocker.blk < 1.4
  || !lowTeam || lowTeam.ast > 10 || lowTeam.stl > 3 || lowTeam.blk > 1.5
  || !midTeam || midTeam.blk >= 4
  || !specialistStats.deterministicV2
  || !specialistStats.ovrIsolation
  || !specialistStats.npcFormOvrIsolation
  || !specialistStats.emergencyReplacementPath
  || !specialistStats.seededStateRestored
  || !specialistStats.engineChoiceUiPath
  || !specialistStats.diagnosticsFailClosed
  || !specialistStats.dispatcherIntegration
  || !specialistStats.v2ModifierPath
  || !specialistStats.v2ModifierFunctionalPath
  || specialistStats.npcAvailabilityStress.simulationErrors > 0
  || specialistStats.npcAvailabilityStress.invariantErrors > 0
  || specialistStats.npcAvailabilityStress.availabilityContradictions > 0
  || !specialistStats.teamBAvailabilityIntegration
  || !specialistStats.emptyRotationThrows
  || !specialistStats.shortRotationThrows
  || !specialistStats.overCapRotationThrows
  || !specialistStats.fivePlayerInjuryMinutesSafe
  || !specialistStats.diagnosticFieldSemantics
  || specialistStats.v2HasDirectOvrEventPath) {
  throw new Error('V2 专项因果隔离失败：' + JSON.stringify(result));
}
console.log(JSON.stringify(result));
