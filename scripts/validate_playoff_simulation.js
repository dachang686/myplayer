const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const playoffsSource = fs.readFileSync(path.join(root, 'js/playoffs.js'), 'utf8');

function extractSimulation(source, label) {
  const start = source.indexOf('function getTeamCompetitiveRating');
  const end = source.indexOf('function leagueStatClamp', start);
  if (start < 0 || end < 0) throw new Error(`无法定位 ${label} 的比赛模拟函数`);
  return source.slice(start, end).trim();
}

const indexSimulation = extractSimulation(indexSource, 'index.html');
if (/predeterminedWinner|最终结果由预定胜者决定/.test(indexSimulation)) {
  throw new Error('比赛模拟仍然存在预定胜者逻辑');
}
if (!/const won = scoreA > scoreB/.test(indexSimulation)) {
  throw new Error('比赛胜负没有直接读取最终比分');
}

function validateCompetitiveRatingMonotonicity() {
  const start = indexSource.indexOf('function getTeamCompetitiveRating');
  const end = indexSource.indexOf('function getTeamBattlePower', start);
  if (start < 0 || end < 0) throw new Error('无法定位球队竞争力公式');
  const getRating = new Function(`${indexSource.slice(start, end)}\nreturn getTeamCompetitiveRating;`)();
  const base = { overall: 88, offense: 84, defense: 74, starConcentration: 0 };
  const stronger = { overall: 92, offense: 86, defense: 78, starConcentration: 0 };
  function margin(powerA, powerB) {
    const ratingA = getRating(powerA);
    const ratingB = getRating(powerB);
    return (ratingA.roster - ratingB.roster)
      + (ratingA.structure - ratingB.structure)
      + (ratingA.star - ratingB.star);
  }
  return {
    dominatedMargin: margin(stronger, base),
    overallOnly: margin(Object.assign({}, base, { overall: base.overall + 1 }), base),
    offenseOnly: margin(Object.assign({}, base, { offense: base.offense + 1 }), base),
    defenseOnly: margin(Object.assign({}, base, { defense: base.defense + 1 }), base),
  };
}

const competitiveRatingMonotonicity = validateCompetitiveRatingMonotonicity();

if (!/\[true, true, false, false, true, false, true\]/.test(playoffsSource)) {
  throw new Error('季后赛主场顺序不是 2-2-1-1-1');
}
const seedBonusStart = playoffsSource.indexOf('function getPlayoffSeriesSeedBonus');
const seedBonusEnd = playoffsSource.indexOf('function isPlayInResolved', seedBonusStart);
if (seedBonusStart < 0 || seedBonusEnd < 0) throw new Error('无法定位统一的季后赛 seedBonus 规则');
const getPlayoffSeriesSeedBonus = new Function(
  'getConference',
  'getConferenceSeed',
  playoffsSource.slice(seedBonusStart, seedBonusEnd) + '\nreturn getPlayoffSeriesSeedBonus;',
)(
  team => /^N/.test(team) ? 'NORTH' : 'SOUTH',
  team => ({ N1: 1, N8: 8, N10: 10, S1: 1 })[team] || 99,
);
const seedBracket = { teams: [{ team: 'N1' }, null, null, null, null, null, null, { team: 'N8' }] };
const playInSeedBracket = { teams: [{ team: 'N1' }, { team: 'N2' }, { team: 'N3' }, { team: 'N4' }, { team: 'N5' }, { team: 'N6' }, { team: 'N7' }, { team: 'N10' }] };
if (Math.abs(getPlayoffSeriesSeedBonus('N1', 'N8', 0) - 2.8) > 1e-9
  || Math.abs(getPlayoffSeriesSeedBonus('N1', 'N8', 0, seedBracket) - 2.8) > 1e-9
  || Math.abs(getPlayoffSeriesSeedBonus('N1', 'N10', 0) - 3.2) > 1e-9
  || Math.abs(getPlayoffSeriesSeedBonus('N1', 'N10', 0, playInSeedBracket) - 2.8) > 1e-9
  || getPlayoffSeriesSeedBonus('N1', 'N8', 1) !== 0
  || getPlayoffSeriesSeedBonus('N1', 'S1', 0) !== 0) {
  throw new Error('玩家与 NPC 系列赛的 seedBonus 规则不一致或未限制在首轮');
}
if (!/getPlayoffSeriesSeedBonus\(teamA, teamB, round, STATE\.season && STATE\.season\.playoffBracket\)/.test(playoffsSource)
  || /let sb = 0;[\s\S]*gapSeed/.test(playoffsSource)) {
  throw new Error('玩家季后赛路径没有使用实际 bracket 的统一 seedBonus');
}
const playInRotationFlags = {
  simulationUsesPostseason: /function simulatePlayInMatch[\s\S]*?isPlayoffs:\s*true,[\s\S]*?isPlayIn:\s*true/.test(playoffsSource),
  npcReadsGameOptions: /function shouldNpcPlayLeagueGame\([^)]*gameOptions[\s\S]*?typeof options\.isPlayoffs === 'boolean'[\s\S]*?isPostseasonRotation/.test(indexSource),
  prepareReadsGameOptions: /function prepareLeagueGameRotation\([^)]*[\s\S]*?typeof options\.isPlayoffs === 'boolean'/.test(indexSource),
};
if (Object.values(playInRotationFlags).some(flag => !flag)) {
  throw new Error('附加赛没有完整透传季后赛轮换模式：' + JSON.stringify(playInRotationFlags));
}

function validatePlayInFunctionalRules() {
  const matchStart = playoffsSource.indexOf('function simulatePlayInMatch');
  const matchEnd = playoffsSource.indexOf('function simPlayInGame', matchStart);
  if (matchStart < 0 || matchEnd < 0) throw new Error('无法定位附加赛比赛模拟函数');

  const state = {
    careerTeam: 'N1',
    career: { seasonCount: 3 },
    season: { events: { injuryGamesLeft: 1, suspensionGamesLeft: 0 } },
  };
  const calls = { modal: null, simulations: [], after: [], worsened: 0 };
  const simulate = new Function(
    'STATE',
    'ensureSeasonEventState',
    'simulateGameNew',
    'afterCareerTeamGame',
    'shouldOfferPlayThroughInjury',
    'showPlayThroughInjuryModal',
    'getInjuryPlayWinMultiplier',
    'maybeWorsenInjuryAfterPlaying',
    `${playoffsSource.slice(matchStart, matchEnd)}\nreturn simulatePlayInMatch;`,
  )(
    state,
    () => state.season.events,
    (...args) => {
      calls.simulations.push(args);
      return { won: true, scoreA: 100, scoreB: 90 };
    },
    options => calls.after.push(options),
    () => true,
    (ctx, onRest, onPlay) => { calls.modal = { ctx, onRest, onPlay }; },
    () => 0.86,
    () => { calls.worsened++; },
  );

  const pending = simulate('N1', 'N2', 'A', result => { calls.restResult = result; });
  const modalOpened = pending === null && !!calls.modal && calls.simulations.length === 0;
  if (calls.modal) calls.modal.onRest();
  const restPath = !!calls.restResult
    && calls.restResult.absenceType === 'injury'
    && !calls.restResult.playedThroughInjury
    && calls.simulations[0]?.[3] === null
    && calls.simulations[0]?.[4]?.isPlayoffs === true
    && calls.simulations[0]?.[4]?.isPlayIn === true
    && calls.simulations[0]?.[4]?.userAvailable === false
    && calls.after[0]?.unavailable === true;

  state.season.events.injuryGamesLeft = 1;
  calls.modal = null;
  calls.restResult = null;
  calls.simulations.length = 0;
  calls.after.length = 0;
  const playPending = simulate('N1', 'N2', 'B', result => { calls.playResult = result; });
  const playModalOpened = playPending === null && !!calls.modal && calls.simulations.length === 0;
  if (calls.modal) calls.modal.onPlay('major');
  const playPath = !!calls.playResult
    && calls.playResult.absenceType === null
    && calls.playResult.playedThroughInjury === true
    && calls.simulations[0]?.[3] === 0.86
    && calls.simulations[0]?.[4]?.userAvailable === true
    && calls.after[0]?.unavailable === false
    && calls.after[0]?.playedThroughInjury === true
    && calls.worsened === 1;

  const npcStart = indexSource.indexOf('function shouldNpcPlayLeagueGame');
  const npcEnd = indexSource.indexOf('/** 把球队总量', npcStart);
  if (npcStart < 0 || npcEnd < 0) throw new Error('无法定位 NPC 出场判断函数');
  const profile = {
    scoring: 1, rebounding: 1, playmaking: 1, defense: 1, formGamesLeft: 1,
    injuryGamesLeft: 0, gamesMissed: 0, restChance: 1, injuryRisk: 0,
  };
  const npcState = { season: { isPlayoffs: false } };
  const npcPlay = new Function(
    'STATE',
    'getNpcSeasonProfile',
    'refreshNpcShortTermForm',
    `${indexSource.slice(npcStart, npcEnd)}\nreturn shouldNpcPlayLeagueGame;`,
  )(npcState, () => profile, () => {});
  const regularRest = npcPlay('N1', { id: 'NPC-1' }, 0, 1, { isPlayoffs: false });
  const playInHealthy = npcPlay('N1', { id: 'NPC-1' }, 0, 1, { isPlayoffs: true, isPlayIn: true });
  profile.injuryGamesLeft = 1;
  const playInInjured = npcPlay('N1', { id: 'NPC-1' }, 0, 1, { isPlayoffs: true, isPlayIn: true });

  const allocationStart = indexSource.indexOf('function allocateLeagueRotationMinutes');
  const allocationEnd = indexSource.indexOf('/** 动态选择', allocationStart);
  if (allocationStart < 0 || allocationEnd < 0) throw new Error('无法定位联盟轮换分钟分配函数');
  const allocateMinutes = new Function(
    'STATE',
    'getPlayerGameImpact',
    `${indexSource.slice(allocationStart, allocationEnd)}\nreturn allocateLeagueRotationMinutes;`,
  )(npcState, () => ({ overall: 90 }));
  const rotationPlayers = Array.from({ length: 10 }, (_, index) => ({ id: 'ROT-' + index }));
  const roleRanks = rotationPlayers.map((_, index) => index);
  const regularMinutes = allocateMinutes(rotationPlayers, roleRanks, { isPlayoffs: false, randomize: false });
  const playInMinutes = allocateMinutes(rotationPlayers, roleRanks, { isPlayoffs: true, isPlayIn: true, randomize: false });

  return {
    injuryChoice: modalOpened && playModalOpened && restPath && playPath,
    npcAvailability: regularRest === false && playInHealthy === true && playInInjured === false,
    postseasonMinutes: playInMinutes.slice(0, 5).reduce((sum, value) => sum + value, 0)
      > regularMinutes.slice(0, 5).reduce((sum, value) => sum + value, 0),
  };
}

const playInFunctionalRules = validatePlayInFunctionalRules();

function validateBracketSeedOrdering() {
  const seedStart = playoffsSource.indexOf('function isTeamAHigherPlayoffSeed');
  const seedEnd = playoffsSource.indexOf('function isPlayoffTeamAHome', seedStart);
  if (seedStart < 0 || seedEnd < 0) throw new Error('无法定位正式季后赛高种子判定函数');
  const state = {
    season: {
      standings: {
        N7: { wins: 50, losses: 32 },
        N8: { wins: 48, losses: 34 },
      },
    },
  };
  const higherSeed = new Function(
    'STATE',
    'getConference',
    'getConferenceSeed',
    `${playoffsSource.slice(seedStart, seedEnd)}\nreturn isTeamAHigherPlayoffSeed;`,
  )(
    state,
    team => team.startsWith('N') ? 'NORTH' : 'SOUTH',
    team => ({ N7: 7, N8: 8 }[team] || 99),
  );
  const swappedBracket = {
    teams: [
      { team: 'N1' }, { team: 'N2' }, { team: 'N3' }, { team: 'N4' },
      { team: 'N5' }, { team: 'N6' }, { team: 'N8' }, { team: 'N7' },
    ],
  };
  return {
    playInSeedOverridesRegularRecord:
      higherSeed('N8', 'N7', 0, swappedBracket) === true
      && higherSeed('N7', 'N8', 0, swappedBracket) === false,
    finalsFallBackToStandings: higherSeed('N7', 'N8', 3, swappedBracket) === true,
  };
}

const bracketSeedOrdering = validateBracketSeedOrdering();
const renderPlayoffsStart = playoffsSource.indexOf('function renderPlayoffs');
const resumePlayoffsStart = playoffsSource.indexOf('function resumePlayoffs', renderPlayoffsStart);
const renderPlayoffsSource = playoffsSource.slice(renderPlayoffsStart, resumePlayoffsStart);
if (/autoSimConferenceBracket\(otherBracket\)/.test(renderPlayoffsSource)) {
  throw new Error('进入季后赛时仍会提前模拟完整另一分区');
}
if (!/autoSimConferenceBracketRound\(STATE\.season\.otherBracket, round\)/.test(playoffsSource)) {
  throw new Error('玩家完成轮次后没有同步推进另一分区');
}
if (!/repairPlayoffBracketState\(\)/.test(playoffsSource)) {
  throw new Error('季后赛页面没有修复旧存档分区状态');
}

function validatePlayInRouting() {
  const helperStart = playoffsSource.indexOf('function createPlayInState');
  const helperEnd = playoffsSource.indexOf('function buildPlayoffBracket', helperStart);
  const renderStart = playoffsSource.indexOf('function renderPlayoffs', helperEnd);
  const flowEnd = playoffsSource.indexOf('function getPlayoffTreeSeriesResult', renderStart);
  if (helperStart < 0 || helperEnd < 0 || renderStart < 0 || flowEnd < 0) throw new Error('无法定位附加赛入口流程');

  const calls = { playIn: 0, save: 0, brackets: [], playInGames: [], bracketUI: 0 };
  const staleBracket = { conf: 'NORTH', teams: Array.from({ length: 8 }, (_, index) => ({ team: `N${index + 1}` })) };
  const routeState = {
    careerTeam: 'N9',
    season: {
      standings: {},
      isPlayoffs: true,
      playoffBracket: staleBracket,
      otherBracket: { conf: 'SOUTH' },
      playoffSeed: 9,
      _viewConf: 'NORTH',
    },
  };
  const playoffFlow = new Function(
    'STATE',
    'trackEvent',
    'showScreen',
    'getConferenceSeed',
    'getConference',
    'getConferenceSorted',
    'simulatePlayInMatch',
    'renderPlayInUI',
    'queueSeasonAutoSave',
    'buildPlayoffBracket',
    'getOtherPlayoffConference',
    'renderPlayoffBracketUI',
    `${playoffsSource.slice(helperStart, helperEnd)}\n${playoffsSource.slice(renderStart, flowEnd)}\nreturn { renderPlayoffs, resumePlayoffs };`,
  )(
    routeState,
    () => {},
    () => {},
    team => Number(team.slice(1)),
    team => team.startsWith('N') ? 'NORTH' : 'SOUTH',
    conf => Array.from({ length: 15 }, (_, index) => ({
      team: `${conf === 'NORTH' ? 'N' : 'S'}${index + 1}`,
      wins: 60 - index,
      losses: 22 + index,
    })),
    (teamA, teamB, gameId) => {
      calls.playInGames.push({ teamA, teamB, gameId });
      return { aWins: true, scoreA: 100, scoreB: 90, absenceType: null };
    },
    () => { calls.playIn++; },
    () => { calls.save++; },
    (conf, pi) => {
      calls.brackets.push({ conf, pi });
      return { conf, teams: Array.from({ length: 8 }, (_, index) => ({ team: `${conf === 'NORTH' ? 'N' : 'S'}${index + 1}` })) };
    },
    () => 'SOUTH',
    () => { calls.bracketUI++; },
  );

  playoffFlow.renderPlayoffs();
  const freshEntry = {
    playInRendered: calls.playIn === 1,
    bracketNotBuilt: calls.brackets.length === 0,
    playInInitialized: routeState.season.playInState?.seed9?.team === 'N9',
    staleBracketCleared: routeState.season.playoffBracket === null && routeState.season.otherBracket === null,
    playoffFlagCleared: routeState.season.isPlayoffs === false,
    otherConferencePlayInComplete: routeState.season.otherPlayInState?.gameAResult?.winner === 'S7'
      && routeState.season.otherPlayInState?.gameCResult?.winner === 'S8',
  };

  routeState.season.isPlayoffs = true;
  routeState.season.playoffBracket = staleBracket;
  routeState.season.otherBracket = { conf: 'SOUTH' };
  routeState.season.playoffSeed = 9;
  calls.playIn = 0;
  calls.brackets = [];
  playoffFlow.resumePlayoffs();
  const legacyResume = {
    playInRendered: calls.playIn === 1,
    staleBracketCleared: routeState.season.playoffBracket === null && routeState.season.otherBracket === null,
    bracketNotBuilt: calls.brackets.length === 0,
  };

  routeState.season.playInState.gameAResult = { winner: 'N7', loser: 'N8' };
  routeState.season.playInState.gameBResult = { winner: 'N9', loser: 'N10' };
  routeState.season.playInState.gameCResult = { winner: 'N9', loser: 'N8' };
  routeState.season.playInState.playoffSeed = 8;
  calls.playIn = 0;
  calls.brackets = [];
  playoffFlow.renderPlayoffs();
  const qualifiedEntry = {
    playInNotRendered: calls.playIn === 0,
    bothConferenceBracketsBuilt: calls.brackets.length === 2,
    bothBracketsUsePlayInWinners: calls.brackets[0]?.pi?.gameCResult?.winner === 'N9'
      && calls.brackets[1]?.pi?.gameCResult?.winner === 'S8',
    playoffFlagSet: routeState.season.isPlayoffs === true,
  };

  routeState.careerTeam = 'N1';
  routeState.season = { standings: {} };
  calls.brackets = [];
  calls.playInGames = [];
  playoffFlow.renderPlayoffs();
  const automaticBothConferences = {
    bothBracketsBuilt: calls.brackets.length === 2,
    allPlayInGamesSimulated: calls.playInGames.length === 6,
    ownConferenceUsesPlayInWinner: routeState.season.playoffBracket?.teams?.[7]?.team === 'N8',
    otherConferenceUsesPlayInWinner: routeState.season.otherBracket?.teams?.[7]?.team === 'S8',
  };

  const preservedBracket = { conf: 'NORTH', marker: 'keep', rounds: [[{ winner: 'N1' }]] };
  const preservedOtherBracket = { conf: 'SOUTH', marker: 'keep-other', rounds: [[{ winner: 'S1' }]] };
  routeState.season.playoffBracket = preservedBracket;
  routeState.season.otherBracket = preservedOtherBracket;
  calls.brackets = [];
  calls.playInGames = [];
  calls.bracketUI = 0;
  playoffFlow.renderPlayoffs();
  const reentryPreservesBracket = {
    noBracketRebuilt: calls.brackets.length === 0,
    noPlayInResimulated: calls.playInGames.length === 0,
    samePlayerBracket: routeState.season.playoffBracket === preservedBracket,
    sameOtherBracket: routeState.season.otherBracket === preservedOtherBracket,
    bracketRendered: calls.bracketUI === 1,
  };

  return { freshEntry, legacyResume, qualifiedEntry, automaticBothConferences, reentryPreservesBracket };
}

const playInRouting = validatePlayInRouting();

function validatePlayInCompletion() {
  const autoStart = playoffsSource.indexOf('function autoSimNonUserPlayInGames');
  const autoEnd = playoffsSource.indexOf('function simPlayInGame', autoStart);
  const checkStart = playoffsSource.indexOf('function checkPlayInComplete');
  const checkEnd = playoffsSource.indexOf('// ==================== 赛季结束', checkStart);
  if (autoStart < 0 || autoEnd < 0 || checkStart < 0 || checkEnd < 0) {
    throw new Error('无法定位附加赛完成条件');
  }

  const completionState = {
    careerTeam: 'T7',
    season: {
      playInState: {
        seed7: { team: 'T7' }, seed8: { team: 'T8' },
        seed9: { team: 'T9' }, seed10: { team: 'T10' },
        gameAResult: { winner: 'T7', loser: 'T8' },
        gameBResult: { winner: 'T9', loser: 'T10' },
        gameCResult: null,
        isEliminated: false,
        playoffSeed: 7,
      },
    },
  };
  const simulatedGames = [];
  const completionFns = new Function(
    'STATE',
    'simPlayInGame',
    `${playoffsSource.slice(autoStart, autoEnd)}\n${playoffsSource.slice(checkStart, checkEnd)}\nreturn { autoSimNonUserPlayInGames, checkPlayInComplete };`,
  )(completionState, gameId => simulatedGames.push(gameId));

  const incompleteBeforeGameC = !completionFns.checkPlayInComplete();
  completionFns.autoSimNonUserPlayInGames();
  completionState.season.playInState.gameCResult = { winner: 'T8', loser: 'T9' };
  const completeAfterGameC = completionFns.checkPlayInComplete();
  return {
    incompleteBeforeGameC,
    autoSimulatedGameC: simulatedGames.length === 1 && simulatedGames[0] === 'C',
    completeAfterGameC,
  };
}

const playInCompletion = validatePlayInCompletion();

function validateStandingsTiebreakers() {
  const sourceStart = indexSource.indexOf('function getCompletedRegularSeasonGames');
  const sourceEnd = indexSource.indexOf('// ==================== 6.', sourceStart);
  if (sourceStart < 0 || sourceEnd < 0) throw new Error('无法定位常规赛 tie-break 排名代码');

  const tiebreakState = { careerTeam: null, season: { standings: {}, games: [], _leagueGameLog: [] } };
  const conference = { NORTH: [], SOUTH: [] };
  const functions = new Function(
    'STATE',
    'SIM_CONFIG',
    'getConference',
    `${indexSource.slice(sourceStart, sourceEnd)}\nreturn { sortConferenceStandingsRows, getConferenceSorted, getConferenceSeed };`,
  )(
    tiebreakState,
    { CONFERENCE: conference },
    team => conference.NORTH.includes(team) ? 'NORTH' : 'SOUTH',
  );

  function runScenario(rows, leagueGames, userGames, careerTeam) {
    conference.NORTH = rows.map(row => row.team);
    tiebreakState.careerTeam = careerTeam || null;
    tiebreakState.season.standings = Object.fromEntries(rows.map(row => [row.team, { wins: row.wins, losses: row.losses }]));
    tiebreakState.season._leagueGameLog = leagueGames || [];
    tiebreakState.season.games = userGames || [];
    return functions.getConferenceSorted('NORTH').map(row => row.team);
  }

  const tiedRows = [
    { team: 'A', wins: 47, losses: 35 },
    { team: 'B', wins: 47, losses: 35 },
  ];
  const headToHead = runScenario(tiedRows, [], [{
    game: { opponent: 'B', home: true },
    result: { scoreA: 90, scoreB: 100, won: false },
  }], 'A');
  const headToHeadSeeds = {
    B: functions.getConferenceSeed('B'),
    A: functions.getConferenceSeed('A'),
  };

  const multiTeam = runScenario([
    { team: 'A', wins: 47, losses: 35 },
    { team: 'B', wins: 47, losses: 35 },
    { team: 'C', wins: 47, losses: 35 },
  ], [
    { home: 'A', away: 'B', won: false, scoreHome: 90, scoreAway: 100 },
    { home: 'A', away: 'C', won: false, scoreHome: 90, scoreAway: 100 },
    { home: 'B', away: 'C', won: true, scoreHome: 100, scoreAway: 90 },
  ]);

  const conferenceRecord = runScenario([
    { team: 'A', wins: 47, losses: 35 },
    { team: 'Z', wins: 47, losses: 35 },
    { team: 'C', wins: 30, losses: 52 },
  ], [
    { home: 'A', away: 'Z', won: true, scoreHome: 100, scoreAway: 90 },
    { home: 'Z', away: 'A', won: true, scoreHome: 100, scoreAway: 90 },
    { home: 'A', away: 'C', won: false, scoreHome: 90, scoreAway: 100 },
    { home: 'Z', away: 'C', won: true, scoreHome: 100, scoreAway: 90 },
  ]).slice(0, 2);

  const pointDifferential = runScenario([
    { team: 'A', wins: 47, losses: 35 },
    { team: 'Z', wins: 47, losses: 35 },
  ], [
    { home: 'A', away: 'Z', won: true, scoreHome: 100, scoreAway: 95 },
    { home: 'Z', away: 'A', won: true, scoreHome: 120, scoreAway: 90 },
  ]);

  return { headToHead, headToHeadSeeds, multiTeam, conferenceRecord, pointDifferential };
}

const standingsTiebreakers = validateStandingsTiebreakers();

for (const [source, label] of [[indexSimulation, 'index.html 比赛模拟'], [playoffsSource, 'js/playoffs.js']]) {
  try {
    parser.parse(source, { sourceType: 'script', plugins: ['optionalChaining', 'objectRestSpread'] });
  } catch (error) {
    throw new Error(`${label} 语法错误：${error.message}`);
  }
}

const powers = {
  EQUAL_A: { offense: 78, defense: 68, athletic: 76, clutch: 75, overall: 84, depth: 84, starConcentration: 0 },
  EQUAL_B: { offense: 78, defense: 68, athletic: 76, clutch: 75, overall: 84, depth: 84, starConcentration: 0 },
  STRONG: { offense: 84, defense: 74, athletic: 84, clutch: 86, overall: 90, depth: 90, starConcentration: 0 },
  WEAK: { offense: 76, defense: 64, athletic: 72, clutch: 66, overall: 80, depth: 80, starConcentration: 0 },
  PLAYOFF_FAVORITE: { offense: 87.95, defense: 87.95, athletic: 87.95, clutch: 87.95, overall: 87.95, depth: 87.95, starConcentration: 0 },
  PLAYOFF_UNDERDOG: { offense: 82.4, defense: 82.4, athletic: 82.4, clutch: 82.4, overall: 82.4, depth: 82.4, starConcentration: 0 },
};

const state = { season: { schedule: [] } };
const simulateGame = new Function(
  'calcTeamPowerWithPlayer',
  'SIM_CONFIG',
  'STATE',
  'getTeamName',
  'generateBoxScore',
  'getActiveEventTeamEdge',
  `${indexSimulation}\nreturn simulateGameNew;`,
)(
  team => powers[team],
  { PACE: { base: 100, teamRange: 8 } },
  state,
  team => team,
  (teamA, teamB, scoreA, scoreB) => ({
    [teamA]: [{ pts: scoreA, mins: 240 }],
    [teamB]: [{ pts: scoreB, mins: 240 }],
  }),
  () => 0,
);

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function withSeed(seed, run) {
  const originalRandom = Math.random;
  Math.random = seededRandom(seed);
  try {
    return run();
  } finally {
    Math.random = originalRandom;
  }
}

function runGames(options) {
  const count = options.count || 20000;
  return withSeed(options.seed || 1, () => {
    let winsA = 0;
    let totalScore = 0;
    let totalMargin = 0;
    let overtimeGames = 0;
    let invariantErrors = 0;
    for (let i = 0; i < count; i++) {
      const result = simulateGame(
        options.teamA,
        options.teamB,
        options.seedBonus || 0,
        options.probMultiplier == null ? null : options.probMultiplier,
        { isHomeA: options.isHomeA, isB2B: false },
      );
      if (result.won) winsA++;
      totalScore += result.scoreA + result.scoreB;
      totalMargin += result.scoreA - result.scoreB;
      if (result.ot > 0) overtimeGames++;
      if (result.won !== (result.scoreA > result.scoreB) || result.scoreA === result.scoreB) invariantErrors++;
      if (result.qScoresA.length !== 4 || result.qScoresB.length !== 4) invariantErrors++;
      if (result.ot === 0) {
        const sumA = result.qScoresA.reduce((sum, value) => sum + value, 0);
        const sumB = result.qScoresB.reduce((sum, value) => sum + value, 0);
        if (sumA !== result.scoreA || sumB !== result.scoreB) invariantErrors++;
      }
    }
    return {
      winRateA: winsA / count,
      averageTotal: totalScore / count,
      averageMargin: totalMargin / count,
      overtimeRate: overtimeGames / count,
      invariantErrors,
    };
  });
}

function runSeries(seed, teamA, teamB, seriesCount, seedBonus = 0) {
  const homePattern = [true, true, false, false, true, false, true];
  return withSeed(seed, () => {
    let seriesWinsA = 0;
    for (let s = 0; s < seriesCount; s++) {
      let winsA = 0;
      let winsB = 0;
      for (let game = 0; game < 7 && winsA < 4 && winsB < 4; game++) {
        const result = simulateGame(teamA, teamB, seedBonus, null, { isHomeA: homePattern[game], isB2B: false });
        if (result.won) winsA++;
        else winsB++;
      }
      if (winsA === 4) seriesWinsA++;
    }
    return seriesWinsA / seriesCount;
  });
}

function runSeriesWithRecords(seed, favoriteRecord, underdogRecord, seedBonus = 0) {
  const previousIsPlayoffs = state.season.isPlayoffs;
  const previousStandings = state.season.standings;
  state.season.isPlayoffs = true;
  state.season.standings = {
    PLAYOFF_FAVORITE: favoriteRecord,
    PLAYOFF_UNDERDOG: underdogRecord,
  };
  try {
    return runSeries(seed, 'PLAYOFF_FAVORITE', 'PLAYOFF_UNDERDOG', 10000, seedBonus);
  } finally {
    state.season.isPlayoffs = previousIsPlayoffs;
    state.season.standings = previousStandings;
  }
}

const equalNeutral = runGames({ seed: 1101, teamA: 'EQUAL_A', teamB: 'EQUAL_B', isHomeA: null });
const equalHome = runGames({ seed: 2202, teamA: 'EQUAL_A', teamB: 'EQUAL_B', isHomeA: true });
const equalAway = runGames({ seed: 3303, teamA: 'EQUAL_A', teamB: 'EQUAL_B', isHomeA: false });
const strongNeutral = runGames({ seed: 4404, teamA: 'STRONG', teamB: 'WEAK', isHomeA: null });
const injuredEqual = runGames({ seed: 5505, teamA: 'EQUAL_A', teamB: 'EQUAL_B', isHomeA: null, probMultiplier: 0.86 });
const equalSeries = runSeries(6606, 'EQUAL_A', 'EQUAL_B', 6000);
const strongSeries = runSeries(7707, 'STRONG', 'WEAK', 6000);
const wideRecordSeries = runSeriesWithRecords(7717, { wins: 52, losses: 30 }, { wins: 38, losses: 44 });
const closeRecordSeries = runSeriesWithRecords(7727, { wins: 53, losses: 29 }, { wins: 51, losses: 31 });
const closeRecordWithOneEightSeedEdge = runSeriesWithRecords(7737, { wins: 53, losses: 29 }, { wins: 51, losses: 31 }, 2.8);

const deterministicA = withSeed(8808, () => simulateGame('STRONG', 'WEAK', 0, null, { isHomeA: true, isB2B: false }));
const deterministicB = withSeed(8808, () => simulateGame('STRONG', 'WEAK', 0, null, { isHomeA: true, isB2B: false }));
function deterministicGameFingerprint(result) {
  return {
    won: result.won,
    scoreA: result.scoreA,
    scoreB: result.scoreB,
    qScoresA: result.qScoresA,
    qScoresB: result.qScoresB,
    ot: result.ot,
    expectedMargin: result.expectedMargin,
  };
}

const fatigueIsolation = withSeed(8813, () => {
  const none = simulateGame('EQUAL_A', 'EQUAL_B', 0, null, { isHomeA: null, isB2BA: false, isB2BB: false });
  const onlyA = simulateGame('EQUAL_A', 'EQUAL_B', 0, null, { isHomeA: null, isB2BA: true, isB2BB: false });
  const onlyB = simulateGame('EQUAL_A', 'EQUAL_B', 0, null, { isHomeA: null, isB2BA: false, isB2BB: true });
  const both = simulateGame('EQUAL_A', 'EQUAL_B', 0, null, { isHomeA: null, isB2BA: true, isB2BB: true });
  return {
    onlyADelta: onlyA.expectedMargin - none.expectedMargin,
    onlyBDelta: onlyB.expectedMargin - none.expectedMargin,
    bothDelta: both.expectedMargin - none.expectedMargin,
    flags: {
      none: [none.isB2BA, none.isB2BB],
      onlyA: [onlyA.isB2BA, onlyA.isB2BB],
      onlyB: [onlyB.isB2BA, onlyB.isB2BB],
      both: [both.isB2BA, both.isB2BB],
    },
  };
});

const inferredRegularSeasonContext = withSeed(8818, () => {
  state.season.schedule = [
    { day: 20, home: true, simulated: true },
    { day: 21, home: false, simulated: false },
  ];
  try {
    const inferred = simulateGame('EQUAL_A', 'EQUAL_B', 0, null);
    const noFatigue = simulateGame('EQUAL_A', 'EQUAL_B', 0, null, { isHomeA: false, isB2B: false });
    return {
      isHomeA: inferred.isHomeA,
      fatigueMarginDelta: inferred.expectedMargin - noFatigue.expectedMargin,
    };
  } finally {
    state.season.schedule = [];
  }
});

function validateConferenceBracketMapping() {
  const helperStart = playoffsSource.indexOf('const PLAYOFF_HIGH_SEED_HOME_PATTERN');
  const helperEnd = playoffsSource.indexOf('/** 为指定分区构建季后赛对阵数据结构 */', helperStart);
  const autoStart = playoffsSource.indexOf('function autoSimConferenceBracket');
  const autoEnd = playoffsSource.indexOf('function renderPlayoffs', autoStart);
  if (helperStart < 0 || helperEnd < 0 || autoStart < 0 || autoEnd < 0) {
    throw new Error('无法定位季后赛对阵模拟代码');
  }
  const standings = {};
  for (let seed = 1; seed <= 8; seed++) standings[`T${seed}`] = { wins: 70 - seed, losses: 12 + seed };
  const playoffBracketFns = new Function(
    'STATE',
    'getConference',
    'getConferenceSeed',
    'simulateGameNew',
    `${playoffsSource.slice(helperStart, helperEnd)}\n${playoffsSource.slice(autoStart, autoEnd)}\nreturn { autoSimConferenceBracket, autoSimConferenceBracketRound };`,
  )(
    { season: { standings } },
    () => 'NORTH',
    team => Number(team.slice(1)),
    (teamA, teamB, seedBonus, probMultiplier, options) => ({
      won: true,
      scoreA: 110,
      scoreB: 100,
      qScoresA: [28, 27, 28, 27],
      qScoresB: [25, 25, 25, 25],
      boxScore: {},
      options,
    }),
  );
  function createBracket() {
    const teams = Array.from({ length: 8 }, (_, index) => ({ team: `T${index + 1}` }));
    return {
      teams,
      rounds: [
        [
          { high: teams[0], low: teams[7], winner: null },
          { high: teams[1], low: teams[6], winner: null },
          { high: teams[2], low: teams[5], winner: null },
          { high: teams[3], low: teams[4], winner: null },
        ],
        [null, null],
        [null],
        [null],
      ],
      results: [],
      currentRound: 0,
      confChampion: null,
    };
  }
  const bracket = createBracket();
  playoffBracketFns.autoSimConferenceBracket(bracket);
  const roundBracket = createBracket();
  playoffBracketFns.autoSimConferenceBracketRound(roundBracket, 0);
  const afterFirstRound = {
    currentRound: roundBracket.currentRound,
    results: roundBracket.results.length,
    semifinalistsReady: roundBracket.rounds[1].every(series => series?.high?.team && series?.low?.team),
    champion: roundBracket.confChampion,
  };
  playoffBracketFns.autoSimConferenceBracketRound(roundBracket, 1);
  const afterSecondRound = {
    currentRound: roundBracket.currentRound,
    results: roundBracket.results.length,
    finalistsReady: !!(roundBracket.rounds[2][0]?.high?.team && roundBracket.rounds[2][0]?.low?.team),
    champion: roundBracket.confChampion,
  };
  playoffBracketFns.autoSimConferenceBracketRound(roundBracket, 2);
  const afterConferenceFinal = {
    currentRound: roundBracket.currentRound,
    results: roundBracket.results.length,
    champion: roundBracket.confChampion,
  };
  const semiA = bracket.rounds[1][0];
  const semiB = bracket.rounds[1][1];
  const firstSeries = bracket.results.find(result => result.round === 0 && result.seriesIdx === 0);
  const homePattern = firstSeries.seriesGames.map(game => game.home);
  return {
    correctSemifinals: semiA.high.team === 'T1' && semiA.low.team === 'T4'
      && semiB.high.team === 'T2' && semiB.low.team === 'T3',
    champion: bracket.confChampion,
    homePattern,
    roundProgression: { afterFirstRound, afterSecondRound, afterConferenceFinal },
  };
}

const bracketMapping = validateConferenceBracketMapping();

function validateLegacyBracketRepair() {
  const sourceStart = playoffsSource.indexOf('const PLAYOFF_HIGH_SEED_HOME_PATTERN');
  const sourceEnd = playoffsSource.indexOf('function renderPlayoffs', sourceStart);
  if (sourceStart < 0 || sourceEnd < 0) throw new Error('无法定位季后赛存档修复代码');
  const conference = {
    SOUTH: Array.from({ length: 8 }, (_, index) => `S${index + 1}`),
    NORTH: Array.from({ length: 8 }, (_, index) => `N${index + 1}`),
  };
  const standings = {};
  [...conference.SOUTH, ...conference.NORTH].forEach((team, index) => {
    standings[team] = { wins: 70 - (index % 8), losses: 12 + (index % 8) };
  });
  const repairState = { season: { standings, playoffBracket: null, otherBracket: null } };
  const playoffFns = new Function(
    'STATE',
    'SIM_CONFIG',
    'getConference',
    'getConferenceSeed',
    'getConferenceSorted',
    'calcTeamPowerWithPlayer',
    'simulateGameNew',
    `${playoffsSource.slice(sourceStart, sourceEnd)}\nreturn { buildPlayoffBracket, autoSimConferenceBracket, autoSimConferenceBracketRound, repairPlayoffBracketState };`,
  )(
    repairState,
    { CONFERENCE: conference },
    team => team.startsWith('N') ? 'NORTH' : 'SOUTH',
    team => Number(team.slice(1)),
    conf => conference[conf].map(team => ({ team, wins: standings[team].wins, losses: standings[team].losses })),
    () => ({ offense: 80, defense: 80, depth: 80 }),
    (teamA, teamB, seedBonus, probMultiplier, options) => ({
      won: true,
      scoreA: 110,
      scoreB: 100,
      qScoresA: [28, 27, 28, 27],
      qScoresB: [25, 25, 25, 25],
      boxScore: {},
      options,
    }),
  );

  repairState.season.playoffBracket = playoffFns.buildPlayoffBracket('NORTH');
  const wrongLegacyBracket = playoffFns.buildPlayoffBracket('NORTH');
  playoffFns.autoSimConferenceBracket(wrongLegacyBracket);
  wrongLegacyBracket.conf = 'EAST';
  repairState.season.otherBracket = wrongLegacyBracket;
  const repairedWrongConference = playoffFns.repairPlayoffBracketState();
  const wrongConferenceResult = {
    repaired: repairedWrongConference,
    conf: repairState.season.otherBracket.conf,
    teamsCorrect: repairState.season.otherBracket.teams.every(entry => conference.SOUTH.includes(entry.team)),
    completedRounds: repairState.season.otherBracket.currentRound,
  };

  playoffFns.autoSimConferenceBracketRound(repairState.season.playoffBracket, 0);
  const aheadBracket = playoffFns.buildPlayoffBracket('SOUTH');
  playoffFns.autoSimConferenceBracket(aheadBracket);
  repairState.season.otherBracket = aheadBracket;
  const repairedAheadProgress = playoffFns.repairPlayoffBracketState();
  const aheadProgressResult = {
    repaired: repairedAheadProgress,
    completedRounds: repairState.season.otherBracket.currentRound,
    results: repairState.season.otherBracket.results.length,
  };
  return { wrongConferenceResult, aheadProgressResult };
}

const legacyBracketRepair = validateLegacyBracketRepair();

function runRealRosterSmoke() {
  const dataSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
  const configSource = fs.readFileSync(
    path.join(root, 'js/data/simulation_config.js'),
    'utf8',
  );
  const leagueData = new Function(`${dataSource}\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };`)();
  const simConfig = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
  const attributeKeys = ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'STL', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'];
  function syntheticPlayer(id, pos, ovr) {
    const player = { id, cname: id, pos, posCn: pos, ovr };
    attributeKeys.forEach(key => { player[key] = ovr; });
    return player;
  }
  function syntheticTeam(prefix, starterOvrs, benchOvrs) {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const starters = starterOvrs.map((ovr, index) => syntheticPlayer(`${prefix}-S${index}`, positions[index], ovr));
    const benchPositions = ['PG/SG', 'SF/PF', 'C/PF', 'SG/SF', 'PF/C'];
    const bench = benchOvrs.map((ovr, index) => syntheticPlayer(`${prefix}-B${index}`, benchPositions[index], ovr));
    return starters.concat(bench);
  }
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_STRONG = syntheticTeam('STRONG', [95, 92, 99, 99, 88], [85, 83, 80, 78, 76]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_WEAK = syntheticTeam('WEAK', [94, 88, 86, 84, 82], [82, 80, 78, 76, 74]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_BASE_STAR = syntheticTeam('BASE', [85, 85, 85, 85, 85], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_UPGRADED_STAR = syntheticTeam('UPGRADED', [99, 85, 85, 85, 85], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_STRUCTURE_STRONG = syntheticTeam('STRUCTURE-STRONG', [85, 85, 85, 85, 85], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_STRUCTURE_WEAK = syntheticTeam('STRUCTURE-WEAK', [85, 85, 85, 85, 85], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_CLUTCH_HIGH = syntheticTeam('CLUTCH-HIGH', [85, 85, 85, 85, 85], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_CLUTCH_LOW = syntheticTeam('CLUTCH-LOW', [85, 85, 85, 85, 85], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_PLAYMAKER_HIGH = syntheticTeam('PLAYMAKER-HIGH', [85, 85, 85, 85, 85], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_PLAYMAKER_LOW = syntheticTeam('PLAYMAKER-LOW', [85, 85, 85, 85, 85], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_DEFENSIVE_ANCHOR = syntheticTeam('DEFENSIVE-ANCHOR', [85, 85, 85, 85, 95], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_DEFENSIVE_BASE = syntheticTeam('DEFENSIVE-BASE', [85, 85, 85, 85, 95], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_DEFENSE_CONTROL = syntheticTeam('DEFENSE-CONTROL', [85, 85, 85, 85, 85], [80, 78, 76, 74, 72]);
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_STRUCTURE_STRONG.forEach(player => {
    attributeKeys.forEach(key => { player[key] = 95; });
  });
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_STRUCTURE_WEAK.forEach(player => {
    attributeKeys.forEach(key => { player[key] = 70; });
  });
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_CLUTCH_HIGH.forEach(player => {
    attributeKeys.forEach(key => { player[key] = key === 'CLU' ? 95 : 72; });
  });
  leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_CLUTCH_LOW.forEach(player => {
    attributeKeys.forEach(key => { player[key] = key === 'CLU' ? 50 : 72; });
  });
  ['SYNTHETIC_PLAYMAKER_HIGH', 'SYNTHETIC_PLAYMAKER_LOW'].forEach(team => {
    leagueData.LEAGUE_PLAYER_DATA[team].forEach(player => {
      attributeKeys.forEach(key => { player[key] = 72; });
    });
  });
  Object.assign(leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_PLAYMAKER_HIGH[0], { PAS: 99, HAN: 95 });
  Object.assign(leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_PLAYMAKER_LOW[0], { PAS: 55, HAN: 55 });
  ['SYNTHETIC_DEFENSIVE_ANCHOR', 'SYNTHETIC_DEFENSIVE_BASE', 'SYNTHETIC_DEFENSE_CONTROL'].forEach(team => {
    leagueData.LEAGUE_PLAYER_DATA[team].forEach(player => {
      attributeKeys.forEach(key => { player[key] = 72; });
    });
  });
  Object.assign(leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_DEFENSIVE_ANCHOR[4], {
    threePT: 50, MID: 50, FIN: 56, DNK: 50, HAN: 50, PAS: 50,
    PDEF: 60, STL: 55, IDEF: 97, BLK: 97, REB: 97, ATH: 74, STR: 95, CLU: 70,
  });
  Object.assign(leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_DEFENSIVE_BASE[4], {
    threePT: 50, MID: 50, FIN: 56, DNK: 50, HAN: 50, PAS: 50,
    PDEF: 60, STL: 55, IDEF: 78, BLK: 78, REB: 78, ATH: 74, STR: 95, CLU: 70,
  });
  const engineStart = indexSource.indexOf('function getPlayerPositions');
  const engineEnd = indexSource.indexOf('/** 属性→效率系数：递减曲线', engineStart);
  if (engineStart < 0 || engineEnd < 0) throw new Error('无法定位真实名单比赛引擎代码');
  const realState = {
    careerTeam: null,
    finalOVR: 0,
    position: null,
    attrs: {},
    season: { schedule: [], isPlayoffs: true, _npcSeasonProfiles: {} },
  };
  const attrFactor = value => {
    const bounded = Math.max(25, Math.min(99, value || 50));
    return Math.pow((bounded - 25) / 74, 0.85);
  };
  const af = value => Math.pow(attrFactor(value), 1.5);
  const realEngine = new Function(
    'LEAGUE_PLAYER_DATA',
    'SIM_CONFIG',
    'STATE',
    'getMyPlayerDisplayName',
    'getTeamName',
    'getLeaguePlayerAge',
    'af',
    'ensureSeasonEventState',
    `${indexSource.slice(engineStart, engineEnd)}\nreturn { simulateGameNew, calcTeamPowerWithPlayer, getPlayerGameImpact, getTeamCompetitiveRating };`,
  )(
    leagueData.LEAGUE_PLAYER_DATA,
    simConfig,
    realState,
    () => '验证球员',
    team => (simConfig.TEAM_NAMES && simConfig.TEAM_NAMES[team]) || team,
    player => Number(player && player._age) || 27,
    af,
    () => realState.season.events || (realState.season.events = { activeEffects: [] }),
  );

  return withSeed(9909, () => {
    const realSimulate = realEngine.simulateGameNew;
    const previousCareerTeam = realState.careerTeam;
    realState.careerTeam = 'SYNTHETIC_STRONG';
    const stateBeforeSeededReplay = JSON.stringify(realState);
    const seededOptions = {
      randomSeed: 'complete-engine-replay',
      commitSimulationState: false,
      isHomeA: true,
      isB2B: false,
    };
    const seededReplayA = realSimulate('SYNTHETIC_STRONG', 'SYNTHETIC_WEAK', 0, null, seededOptions);
    const stateAfterSeededReplayA = JSON.stringify(realState);
    const seededReplayB = realSimulate('SYNTHETIC_STRONG', 'SYNTHETIC_WEAK', 0, null, seededOptions);
    const stateAfterSeededReplayB = JSON.stringify(realState);
    realSimulate('SYNTHETIC_STRONG', 'SYNTHETIC_WEAK', 0, null, {
      ...seededOptions,
      commitSimulationState: true,
    });
    const committedStateAdvanced = JSON.stringify(realState) !== stateBeforeSeededReplay;
    const restoredSeededState = JSON.parse(stateBeforeSeededReplay);
    Object.keys(realState).forEach(key => { delete realState[key]; });
    Object.assign(realState, restoredSeededState);
    function realGameFingerprint(result) {
      return {
        scoreA: result.scoreA,
        scoreB: result.scoreB,
        qScoresA: result.qScoresA,
        qScoresB: result.qScoresB,
        expectedMargin: result.expectedMargin,
        teamARotation: result.teamA.power.rotationMinutes,
        teamBRotation: result.teamB.power.rotationMinutes,
        boxScore: result.boxScore,
      };
    }
    const realSeededDeterminism = {
      same: JSON.stringify(realGameFingerprint(seededReplayA)) === JSON.stringify(realGameFingerprint(seededReplayB)),
      statePreserved: stateBeforeSeededReplay === stateAfterSeededReplayA
        && stateBeforeSeededReplay === stateAfterSeededReplayB,
      committedStateAdvanced,
      score: `${seededReplayA.scoreA}-${seededReplayA.scoreB}`,
    };
    realState.careerTeam = previousCareerTeam;
    const structureReplay = realSimulate('SYNTHETIC_STRUCTURE_STRONG', 'SYNTHETIC_STRUCTURE_WEAK', 0, null, {
      randomSeed: 'structure-edge-regression',
      commitSimulationState: false,
      isHomeA: null,
      isB2B: false,
      ignoreNpcAvailability: true,
    });
    let wins = 0;
    let total = 0;
    let invariantErrors = 0;
    const games = 1200;
    for (let game = 0; game < games; game++) {
      const result = realSimulate('PHI', 'CHA', 0, null, { isHomeA: null, isB2B: false });
      if (result.won) wins++;
      total += result.scoreA + result.scoreB;
      const rowsA = result.boxScore.PHI || [];
      const rowsB = result.boxScore.CHA || [];
      const sum = (rows, field) => rows.reduce((value, row) => value + (Number(row[field]) || 0), 0);
      if (result.won !== (result.scoreA > result.scoreB)) invariantErrors++;
      if (sum(rowsA, 'pts') !== result.scoreA || sum(rowsB, 'pts') !== result.scoreB) invariantErrors++;
      if (sum(rowsA, 'mins') !== 240 || sum(rowsB, 'mins') !== 240) invariantErrors++;
      if (Array.isArray(result.teamA.power.rotationMinutes)
        && JSON.stringify(result.teamA.power.rotationMinutes) !== JSON.stringify(rowsA.map(row => row.mins))) invariantErrors++;
      if (Array.isArray(result.teamB.power.rotationMinutes)
        && JSON.stringify(result.teamB.power.rotationMinutes) !== JSON.stringify(rowsB.map(row => row.mins))) invariantErrors++;
    }

    const fullChainDeltas = [];
    let fullChainBudgetRebalances = 0;
    let fullChainInvariantErrors = 0;
    let minimumTeamScore = Infinity;
    let maximumTeamScore = -Infinity;
    let fullChainGames = 0;
    const fullChainScoringLeaders = [];
    const fullChainSeasons = 3;
    const teams = leagueData.LEAGUE_TEAM_IDS;
    for (let season = 0; season < fullChainSeasons; season++) {
      realState.season = { schedule: [], isPlayoffs: false, _npcSeasonProfiles: {}, events: { activeEffects: [] } };
      const seasonPlayerTotals = {};
      for (let round = 0; round < 82; round++) {
        for (let pair = 0; pair < teams.length; pair += 2) {
          const teamA = teams[(pair + round + season) % teams.length];
          const teamB = teams[(pair + round + season + 1) % teams.length];
          const result = realSimulate(teamA, teamB, 0, null, { isHomeA: pair % 4 === 0, isB2B: round % 9 === 0 });
          const rowsA = result.boxScore[teamA] || [];
          const rowsB = result.boxScore[teamB] || [];
          const sum = (rows, field) => rows.reduce((value, row) => value + (Number(row[field]) || 0), 0);
          [[teamA, rowsA, result.scoreA], [teamB, rowsB, result.scoreB]].forEach(([team, rows, score]) => {
            if (sum(rows, 'pts') !== score || sum(rows, 'mins') !== 240 || sum(rows, 'ast') > sum(rows, 'fgm')) fullChainInvariantErrors++;
            rows.forEach(row => {
              if (row.pts !== 2 * (row.fgm - row.threeM) + 3 * row.threeM + row.ftm
                || row.fgm > row.fga || row.threeM > row.threeA || row.threeA > row.fga
                || row.threeM > row.fgm || row.ftm > row.fta) fullChainInvariantErrors++;
              if (!row.playerId || row._isUser) return;
              const key = `${team}:${row.playerId}`;
              const total = seasonPlayerTotals[key] || (seasonPlayerTotals[key] = {
                playerId: row.playerId, name: row.name, team, gp: 0, pts: 0, fga: 0, fta: 0,
              });
              total.gp++;
              total.pts += Number(row.pts) || 0;
              total.fga += Number(row.fga) || 0;
              total.fta += Number(row.fta) || 0;
            });
          });
          if (sum(rowsA, 'stl') > sum(rowsB, 'tov') || sum(rowsB, 'stl') > sum(rowsA, 'tov')) fullChainInvariantErrors++;
          [teamA, teamB].forEach(team => {
            const diagnostics = result.boxScore._diagnostics && result.boxScore._diagnostics[team];
            if (!diagnostics) { fullChainInvariantErrors++; return; }
            fullChainDeltas.push(Math.abs(diagnostics.reconcileDelta));
            if (diagnostics.budgetRebalanced) fullChainBudgetRebalances++;
          });
          minimumTeamScore = Math.min(minimumTeamScore, result.scoreA, result.scoreB);
          maximumTeamScore = Math.max(maximumTeamScore, result.scoreA, result.scoreB);
          fullChainGames++;
        }
      }
      const scoringLeaders = Object.values(seasonPlayerTotals)
        .filter(player => player.gp >= 58)
        .map(player => ({
          ...player,
          ppg: player.pts / player.gp,
          fgaPerGame: player.fga / player.gp,
          ftaPerGame: player.fta / player.gp,
        }))
        .sort((a, b) => b.ppg - a.ppg)
        .slice(0, 10);
      fullChainScoringLeaders.push({
        season: season + 1,
        first: Number(scoringLeaders[0].ppg.toFixed(1)),
        third: Number(scoringLeaders[2].ppg.toFixed(1)),
        tenth: Number(scoringLeaders[9].ppg.toFixed(1)),
        spread: Number((scoringLeaders[0].ppg - scoringLeaders[9].ppg).toFixed(1)),
        firstFga: Number(scoringLeaders[0].fgaPerGame.toFixed(1)),
        firstFta: Number(scoringLeaders[0].ftaPerGame.toFixed(1)),
      });
    }
    fullChainDeltas.sort((a, b) => a - b);
    const fullChainPercentile = ratio => fullChainDeltas[Math.min(fullChainDeltas.length - 1, Math.floor((fullChainDeltas.length - 1) * ratio))] || 0;
    const fullChainReconciliation = {
      samples: fullChainDeltas.length,
      meanAbs: fullChainDeltas.reduce((sum, value) => sum + value, 0) / Math.max(1, fullChainDeltas.length),
      p90: fullChainPercentile(0.90), p95: fullChainPercentile(0.95), p99: fullChainPercentile(0.99),
      max: fullChainDeltas[fullChainDeltas.length - 1] || 0,
      overTenRate: fullChainDeltas.filter(value => value > 10).length / Math.max(1, fullChainDeltas.length),
      budgetRebalances: fullChainBudgetRebalances,
    };
    let clutchWins = 0;
    const clutchGames = 5000;
    realState.season = { schedule: [], isPlayoffs: false, _npcSeasonProfiles: {}, events: { activeEffects: [] } };
    for (let game = 0; game < clutchGames; game++) {
      const result = realSimulate('SYNTHETIC_CLUTCH_HIGH', 'SYNTHETIC_CLUTCH_LOW', 0, null, {
        isHomeA: null,
        isB2B: false,
        ignoreNpcAvailability: true,
      });
      if (result.won) clutchWins++;
    }
    const clutchIsolation = { games: clutchGames, highClutchWinRate: clutchWins / clutchGames };
    realState.season = { schedule: [], isPlayoffs: false, _npcSeasonProfiles: {}, events: { activeEffects: [] } };
    const highPlaymakerPower = realEngine.calcTeamPowerWithPlayer('SYNTHETIC_PLAYMAKER_HIGH');
    const lowPlaymakerPower = realEngine.calcTeamPowerWithPlayer('SYNTHETIC_PLAYMAKER_LOW');
    const highPlaymakerRating = realEngine.getTeamCompetitiveRating(highPlaymakerPower);
    const lowPlaymakerRating = realEngine.getTeamCompetitiveRating(lowPlaymakerPower);
    let playmakerWins = 0;
    let highPlaymakerPoints = 0;
    let lowPlaymakerPoints = 0;
    const playmakerGames = 6000;
    for (let game = 0; game < playmakerGames; game++) {
      const result = realSimulate('SYNTHETIC_PLAYMAKER_HIGH', 'SYNTHETIC_PLAYMAKER_LOW', 0, null, {
        isHomeA: null,
        isB2B: false,
        ignoreNpcAvailability: true,
      });
      if (result.won) playmakerWins++;
      highPlaymakerPoints += result.scoreA;
      lowPlaymakerPoints += result.scoreB;
    }
    const playmakerTeamIsolation = {
      games: playmakerGames,
      highWinRate: playmakerWins / playmakerGames,
      highPoints: highPlaymakerPoints / playmakerGames,
      lowPoints: lowPlaymakerPoints / playmakerGames,
      offensePowerGap: highPlaymakerPower.offense - lowPlaymakerPower.offense,
      appliedStructureGap: highPlaymakerRating.structure - lowPlaymakerRating.structure,
      overallPowerGap: highPlaymakerPower.overall - lowPlaymakerPower.overall,
    };
    const anchorCenter = leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_DEFENSIVE_ANCHOR[4];
    const baseCenter = leagueData.LEAGUE_PLAYER_DATA.SYNTHETIC_DEFENSIVE_BASE[4];
    const perimeterStopper = syntheticPlayer('perimeter-stopper', 'SF', 95);
    Object.assign(perimeterStopper, {
      threePT: 72, MID: 72, FIN: 72, DNK: 72, HAN: 72, PAS: 72,
      PDEF: 97, STL: 97, IDEF: 60, BLK: 55, REB: 65, ATH: 95, STR: 72, CLU: 72,
    });
    const anchorImpact = realEngine.getPlayerGameImpact(anchorCenter);
    const baseCenterImpact = realEngine.getPlayerGameImpact(baseCenter);
    const perimeterStopperImpact = realEngine.getPlayerGameImpact(perimeterStopper);
    const offenseProfilePlayer = syntheticPlayer('offense-profile', 'C', 96);
    Object.assign(offenseProfilePlayer, {
      threePT: 69, MID: 79, FIN: 90, DNK: 80, HAN: 86, PAS: 75,
      PDEF: 72, STL: 72, IDEF: 86, BLK: 91, REB: 90, ATH: 85, STR: 90, CLU: 85,
    });
    const lowClutchPlayer = Object.assign({}, offenseProfilePlayer, { CLU: 25 });
    const highClutchPlayer = Object.assign({}, offenseProfilePlayer, { CLU: 99 });
    const lowerOverallPlayer = Object.assign({}, offenseProfilePlayer, { ovr: 76 });
    const eliteScorer = syntheticPlayer('elite-scorer', 'SG', 88);
    Object.assign(eliteScorer, {
      threePT: 95, MID: 95, FIN: 95, DNK: 90, HAN: 95, PAS: 95, ATH: 95, STR: 85,
    });
    const offenseProfileImpact = realEngine.getPlayerGameImpact(offenseProfilePlayer);
    const lowClutchImpact = realEngine.getPlayerGameImpact(lowClutchPlayer);
    const highClutchImpact = realEngine.getPlayerGameImpact(highClutchPlayer);
    const lowerOverallImpact = realEngine.getPlayerGameImpact(lowerOverallPlayer);
    const eliteScorerImpact = realEngine.getPlayerGameImpact(eliteScorer);
    const offensiveRatingIsolation = {
      profileOffense: offenseProfileImpact.offense,
      clutchGap: highClutchImpact.offense - lowClutchImpact.offense,
      overallGap: offenseProfileImpact.offense - lowerOverallImpact.offense,
      eliteScorerOffense: eliteScorerImpact.offense,
    };
    const jokicDefensePlayer = syntheticPlayer('jokic-defense-profile', 'C', 97);
    Object.assign(jokicDefensePlayer, {
      PDEF: 60, STL: 69, IDEF: 82, BLK: 55, REB: 94, ATH: 61, STR: 95,
    });
    const lowerOverallDefensePlayer = Object.assign({}, jokicDefensePlayer, { ovr: 77 });
    const jokicDefenseImpact = realEngine.getPlayerGameImpact(jokicDefensePlayer);
    const lowerOverallDefenseImpact = realEngine.getPlayerGameImpact(lowerOverallDefensePlayer);
    const defensiveRatingIsolation = {
      profileDefense: jokicDefenseImpact.defense,
      overallGap: jokicDefenseImpact.defense - lowerOverallDefenseImpact.defense,
      anchorBonus: jokicDefenseImpact.defensiveAnchorBonus,
    };
    const anchorPower = realEngine.calcTeamPowerWithPlayer('SYNTHETIC_DEFENSIVE_ANCHOR');
    const baseDefensePower = realEngine.calcTeamPowerWithPlayer('SYNTHETIC_DEFENSIVE_BASE');
    function simulatePairedDefenseSeries(games) {
      realState.season = { schedule: [], isPlayoffs: false, _npcSeasonProfiles: {}, events: { activeEffects: [] } };
      let opponentPpgDelta = 0;
      let anchorCenterFga = 0;
      let baseCenterFga = 0;
      for (let game = 0; game < games; game++) {
        const options = {
          randomSeed: `defensive-anchor-pair:${game}`,
          commitSimulationState: false,
          isHomeA: null,
          isB2B: false,
          ignoreNpcAvailability: true,
        };
        const anchorResult = realSimulate('SYNTHETIC_DEFENSIVE_ANCHOR', 'SYNTHETIC_DEFENSE_CONTROL', 0, null, options);
        const baseResult = realSimulate('SYNTHETIC_DEFENSIVE_BASE', 'SYNTHETIC_DEFENSE_CONTROL', 0, null, options);
        opponentPpgDelta += baseResult.scoreB - anchorResult.scoreB;
        const anchorCenter = (anchorResult.boxScore.SYNTHETIC_DEFENSIVE_ANCHOR || []).find(row => row.playerId === 'DEFENSIVE-ANCHOR-S4');
        const baseCenter = (baseResult.boxScore.SYNTHETIC_DEFENSIVE_BASE || []).find(row => row.playerId === 'DEFENSIVE-BASE-S4');
        anchorCenterFga += Number(anchorCenter && anchorCenter.fga) || 0;
        baseCenterFga += Number(baseCenter && baseCenter.fga) || 0;
      }
      return {
        opponentPpgDelta: opponentPpgDelta / games,
        anchorCenterFga: anchorCenterFga / games,
        baseCenterFga: baseCenterFga / games,
      };
    }
    const defensiveAnchorGames = 1600;
    const defensiveAnchorSeries = simulatePairedDefenseSeries(defensiveAnchorGames);
    const defensiveAnchorIsolation = {
      games: defensiveAnchorGames,
      anchorBonus: anchorImpact.defensiveAnchorBonus,
      perimeterBonus: perimeterStopperImpact.defensiveAnchorBonus,
      anchorDefense: anchorImpact.defense,
      baseDefense: baseCenterImpact.defense,
      anchorOffense: anchorImpact.offense,
      baseOffense: baseCenterImpact.offense,
      teamDefenseGap: anchorPower.defense - baseDefensePower.defense,
      opponentPpgDelta: defensiveAnchorSeries.opponentPpgDelta,
      anchorCenterFga: defensiveAnchorSeries.anchorCenterFga,
      baseCenterFga: defensiveAnchorSeries.baseCenterFga,
    };
    const previousPlayoffState = realState.season.isPlayoffs;
    const previousStandings = realState.season.standings;
    realState.season.isPlayoffs = false;
    const strongPower = realEngine.calcTeamPowerWithPlayer('SYNTHETIC_STRONG');
    const weakPower = realEngine.calcTeamPowerWithPlayer('SYNTHETIC_WEAK');
    const baseStarPower = realEngine.calcTeamPowerWithPlayer('SYNTHETIC_BASE_STAR');
    const upgradedStarPower = realEngine.calcTeamPowerWithPlayer('SYNTHETIC_UPGRADED_STAR');
    let benchmarkWins = 0;
    const benchmarkGames = 3000;
    for (let game = 0; game < benchmarkGames; game++) {
      const result = realSimulate('SYNTHETIC_STRONG', 'SYNTHETIC_WEAK', 0, null, {
        isHomeA: null,
        isB2B: false,
        ignoreNpcAvailability: true,
      });
      if (result.won) benchmarkWins++;
    }

    realState.season.isPlayoffs = true;
    const strongPlayoffPower = realEngine.calcTeamPowerWithPlayer('SYNTHETIC_STRONG');
    realState.season.standings = {
      SYNTHETIC_STRONG: { wins: 55, losses: 27 },
      SYNTHETIC_WEAK: { wins: 55, losses: 27 },
    };
    const homePattern = [true, true, false, false, true, false, true];
    let seriesWins = 0;
    let sweepLosses = 0;
    const benchmarkSeries = 3000;
    for (let series = 0; series < benchmarkSeries; series++) {
      let winsA = 0;
      let winsB = 0;
      for (let game = 0; game < 7 && winsA < 4 && winsB < 4; game++) {
        const result = realSimulate('SYNTHETIC_STRONG', 'SYNTHETIC_WEAK', 0, null, {
          isHomeA: homePattern[game],
          isB2B: false,
          ignoreNpcAvailability: true,
        });
        if (result.won) winsA++;
        else winsB++;
      }
      if (winsA === 4) seriesWins++;
      if (winsB === 4 && winsA === 0) sweepLosses++;
    }
    realState.season.isPlayoffs = previousPlayoffState;
    realState.season.standings = previousStandings;
    return {
      winRatePHI: wins / games,
      averageTotal: total / games,
      invariantErrors,
      fullChain: {
        seasons: fullChainSeasons,
        games: fullChainGames,
        minimumTeamScore,
        maximumTeamScore,
        scoringLeaders: fullChainScoringLeaders,
        invariantErrors: fullChainInvariantErrors,
        reconciliation: fullChainReconciliation,
      },
      clutchIsolation,
      playmakerTeamIsolation,
      offensiveRatingIsolation,
      defensiveRatingIsolation,
      defensiveAnchorIsolation,
      realSeededDeterminism,
      syntheticLineup: {
        strongPower: strongPower.overall,
        weakPower: weakPower.overall,
        powerGap: strongPower.overall - weakPower.overall,
        neutralWinRate: benchmarkWins / benchmarkGames,
        seriesWinRate: seriesWins / benchmarkSeries,
        sweepLossRate: sweepLosses / benchmarkSeries,
        regularSeasonStarMinutes: (strongPower.rotationMinutes[2] + strongPower.rotationMinutes[3]) / 2,
        playoffStarMinutes: (strongPlayoffPower.rotationMinutes[2] + strongPlayoffPower.rotationMinutes[3]) / 2,
        marginComponents: seededReplayA.marginComponents,
      },
      structureMarginComponents: structureReplay.marginComponents,
      superstarMarginal: upgradedStarPower.overall - baseStarPower.overall,
    };
  });
}

const realRosterSmoke = runRealRosterSmoke();

const report = {
  playInRotationFlags,
  playInFunctionalRules,
  bracketSeedOrdering,
  playInRouting,
  playInCompletion,
  standingsTiebreakers,
  equalNeutral,
  equalHome,
  equalAway,
  strongNeutral,
  injuredEqual,
  equalSeries,
  strongSeries,
  playoffRecordCalibration: {
    wideRecordSeries,
    closeRecordSeries,
    closeRecordWithOneEightSeedEdge,
  },
  deterministic: {
    same: JSON.stringify(deterministicGameFingerprint(deterministicA)) === JSON.stringify(deterministicGameFingerprint(deterministicB)),
    score: `${deterministicA.scoreA}-${deterministicA.scoreB}`,
  },
  fatigueIsolation,
  inferredRegularSeasonContext,
  competitiveRatingMonotonicity,
  bracketMapping,
  legacyBracketRepair,
  realRosterSmoke,
};
console.log(JSON.stringify(report, null, 2));

const failures = [];
function outside(value, min, max) {
  return value < min || value > max;
}

for (const [label, result] of Object.entries({ equalNeutral, equalHome, equalAway, strongNeutral, injuredEqual })) {
  if (result.invariantErrors) failures.push(`${label} 存在 ${result.invariantErrors} 个比分不变量错误`);
  if (outside(result.averageTotal, 205, 235)) failures.push(`${label} 场均总分异常：${result.averageTotal}`);
  if (outside(result.overtimeRate, 0.02, 0.12)) failures.push(`${label} 加时率异常：${result.overtimeRate}`);
}
if (outside(equalNeutral.winRateA, 0.485, 0.515)) failures.push(`中立同实力胜率异常：${equalNeutral.winRateA}`);
if (outside(equalHome.winRateA, 0.555, 0.62)) failures.push(`同实力主场胜率异常：${equalHome.winRateA}`);
if (outside(equalAway.winRateA, 0.38, 0.445)) failures.push(`同实力客场胜率异常：${equalAway.winRateA}`);
if (outside(strongNeutral.winRateA, 0.74, 0.86)) failures.push(`强队中立场胜率异常：${strongNeutral.winRateA}`);
if (outside(injuredEqual.winRateA, 0.32, 0.44)) failures.push(`重伤修正后的胜率异常：${injuredEqual.winRateA}`);
if (outside(equalSeries, 0.515, 0.58)) failures.push(`同实力高种子系列赛胜率异常：${equalSeries}`);
if (outside(strongSeries, 0.90, 0.995)) failures.push(`强队系列赛胜率异常：${strongSeries}`);
if (outside(wideRecordSeries, 0.90, 0.94)) failures.push(`明显战绩优势系列赛胜率异常：${wideRecordSeries}`);
if (outside(closeRecordSeries, 0.86, 0.91)) failures.push(`接近战绩系列赛胜率异常：${closeRecordSeries}`);
if (wideRecordSeries - closeRecordSeries < 0.02) {
  failures.push(`常规赛战绩差没有形成足够区分：${JSON.stringify({ wideRecordSeries, closeRecordSeries })}`);
}
if (closeRecordWithOneEightSeedEdge - closeRecordSeries < 0.025) {
  failures.push(`首轮种子差没有与常规赛战绩叠加：${JSON.stringify({ closeRecordSeries, closeRecordWithOneEightSeedEdge })}`);
}
if (!report.deterministic.same) failures.push('相同随机种子没有产生相同结果');
if (competitiveRatingMonotonicity.dominatedMargin <= 0
  || Math.abs(competitiveRatingMonotonicity.overallOnly - 0.50) > 0.001
  || Math.abs(competitiveRatingMonotonicity.offenseOnly - 0.20) > 0.001
  || Math.abs(competitiveRatingMonotonicity.defenseOnly - 0.20) > 0.001) {
  failures.push(`球队 OVR/进攻/防守不满足单调性：${JSON.stringify(competitiveRatingMonotonicity)}`);
}
if (!realRosterSmoke.realSeededDeterminism.same || !realRosterSmoke.realSeededDeterminism.statePreserved
  || !realRosterSmoke.realSeededDeterminism.committedStateAdvanced) {
  failures.push(`真实完整比赛链路无法按 seed 无副作用复现：${JSON.stringify(realRosterSmoke.realSeededDeterminism)}`);
}
if (outside(realRosterSmoke.syntheticLineup.neutralWinRate, 0.70, 0.80)) {
  failures.push(`截图级强弱阵容中立场胜率异常：${JSON.stringify(realRosterSmoke.syntheticLineup)}`);
}
if (outside(realRosterSmoke.syntheticLineup.seriesWinRate, 0.90, 0.98)
  || realRosterSmoke.syntheticLineup.sweepLossRate > 0.01) {
  failures.push(`截图级强弱阵容系列赛结果异常：${JSON.stringify(realRosterSmoke.syntheticLineup)}`);
}
if (realRosterSmoke.syntheticLineup.powerGap < 5 || realRosterSmoke.superstarMarginal < 1.5) {
  failures.push(`阵容实力或巨星边际价值仍被压缩：${JSON.stringify(realRosterSmoke)}`);
}
if (realRosterSmoke.syntheticLineup.playoffStarMinutes - realRosterSmoke.syntheticLineup.regularSeasonStarMinutes < 3) {
  failures.push(`季后赛核心预计分钟没有显著提升：${JSON.stringify(realRosterSmoke.syntheticLineup)}`);
}
if (!realRosterSmoke.syntheticLineup.marginComponents
  || realRosterSmoke.syntheticLineup.marginComponents.starEdge <= 0.5
  || !Number.isFinite(realRosterSmoke.syntheticLineup.marginComponents.rawStarEdge)) {
  failures.push(`核心集中度没有进入预期分差：${JSON.stringify(realRosterSmoke.syntheticLineup)}`);
}
if (realRosterSmoke.defensiveAnchorIsolation.anchorBonus < 1.5
  || realRosterSmoke.defensiveAnchorIsolation.perimeterBonus > 0.01
  || realRosterSmoke.defensiveAnchorIsolation.anchorDefense <= realRosterSmoke.defensiveAnchorIsolation.baseDefense + 2
  || Math.abs(realRosterSmoke.defensiveAnchorIsolation.anchorOffense - realRosterSmoke.defensiveAnchorIsolation.baseOffense) > 0.01
  || realRosterSmoke.defensiveAnchorIsolation.teamDefenseGap < 0.8
  || realRosterSmoke.defensiveAnchorIsolation.opponentPpgDelta < 0.25
  || Math.abs(realRosterSmoke.defensiveAnchorIsolation.anchorCenterFga - realRosterSmoke.defensiveAnchorIsolation.baseCenterFga) > 0.8) {
  failures.push(`防守支柱没有形成纯防守体系价值：${JSON.stringify(realRosterSmoke.defensiveAnchorIsolation)}`);
}
if (!realRosterSmoke.structureMarginComponents
  || realRosterSmoke.structureMarginComponents.matchupEdge <= 0.5
  || !Number.isFinite(realRosterSmoke.structureMarginComponents.rawMatchupEdge)
  || Math.abs(realRosterSmoke.structureMarginComponents.rosterEdge) > 0.15) {
  failures.push(`攻防结构残差没有独立进入预期分差：${JSON.stringify(realRosterSmoke.structureMarginComponents)}`);
}
if (inferredRegularSeasonContext.isHomeA !== false || inferredRegularSeasonContext.fatigueMarginDelta !== -1) {
  failures.push(`常规赛主客场/背靠背推断错误：${JSON.stringify(inferredRegularSeasonContext)}`);
if (fatigueIsolation.onlyADelta !== -1 || fatigueIsolation.onlyBDelta !== 1 || fatigueIsolation.bothDelta !== 0 ||
    JSON.stringify(fatigueIsolation.flags) !== JSON.stringify({
      none: [false, false], onlyA: [true, false], onlyB: [false, true], both: [true, true],
    })) {
  failures.push(`双方背靠背疲劳隔离错误：${JSON.stringify(fatigueIsolation)}`);
}
}
if (!bracketMapping.correctSemifinals || bracketMapping.champion !== 'T1') failures.push(`季后赛半区映射错误：${JSON.stringify(bracketMapping)}`);
if (JSON.stringify(bracketMapping.homePattern) !== JSON.stringify([true, true, false, false])) {
  failures.push(`季后赛主场顺序错误：${JSON.stringify(bracketMapping.homePattern)}`);
}
if (!Object.values(playInRouting.freshEntry).every(Boolean)) {
  failures.push(`附加赛新入口路由错误：${JSON.stringify(playInRouting.freshEntry)}`);
}
if (!Object.values(playInRotationFlags).every(Boolean)) {
  failures.push(`附加赛轮换模式错误：${JSON.stringify(playInRotationFlags)}`);
}
if (!Object.values(playInFunctionalRules).every(Boolean)) {
  failures.push(`附加赛功能规则错误：${JSON.stringify(playInFunctionalRules)}`);
}
if (!Object.values(bracketSeedOrdering).every(Boolean)) {
  failures.push(`正式季后赛 seed 主场身份错误：${JSON.stringify(bracketSeedOrdering)}`);
}
if (!Object.values(playInRouting.legacyResume).every(Boolean)) {
  failures.push(`附加赛旧存档恢复错误：${JSON.stringify(playInRouting.legacyResume)}`);
}
if (!Object.values(playInRouting.qualifiedEntry).every(Boolean)) {
  failures.push(`附加赛晋级后入口错误：${JSON.stringify(playInRouting.qualifiedEntry)}`);
}
if (!Object.values(playInCompletion).every(Boolean)) {
  failures.push(`附加赛完成条件错误：${JSON.stringify(playInCompletion)}`);
}
if (JSON.stringify(standingsTiebreakers.headToHead) !== JSON.stringify(['B', 'A'])
  || standingsTiebreakers.headToHeadSeeds.B !== 1 || standingsTiebreakers.headToHeadSeeds.A !== 2) {
  failures.push(`两队相互交手 tie-break 错误：${JSON.stringify(standingsTiebreakers)}`);
}
if (JSON.stringify(standingsTiebreakers.multiTeam) !== JSON.stringify(['B', 'C', 'A'])) {
  failures.push(`多队相互交手 tie-break 错误：${JSON.stringify(standingsTiebreakers.multiTeam)}`);
}
if (JSON.stringify(standingsTiebreakers.conferenceRecord) !== JSON.stringify(['Z', 'A'])) {
  failures.push(`联盟战绩 tie-break 错误：${JSON.stringify(standingsTiebreakers.conferenceRecord)}`);
}
if (JSON.stringify(standingsTiebreakers.pointDifferential) !== JSON.stringify(['Z', 'A'])) {
  failures.push(`净胜分 tie-break 错误：${JSON.stringify(standingsTiebreakers.pointDifferential)}`);
}
const progression = bracketMapping.roundProgression;
if (progression.afterFirstRound.currentRound !== 1 || progression.afterFirstRound.results !== 4 || !progression.afterFirstRound.semifinalistsReady || progression.afterFirstRound.champion) {
  failures.push(`季后赛首轮同步推进错误：${JSON.stringify(progression.afterFirstRound)}`);
}
if (progression.afterSecondRound.currentRound !== 2 || progression.afterSecondRound.results !== 6 || !progression.afterSecondRound.finalistsReady || progression.afterSecondRound.champion) {
  failures.push(`季后赛次轮同步推进错误：${JSON.stringify(progression.afterSecondRound)}`);
}
if (progression.afterConferenceFinal.currentRound !== 3 || progression.afterConferenceFinal.results !== 7 || progression.afterConferenceFinal.champion !== 'T1') {
  failures.push(`季后赛分区决赛同步推进错误：${JSON.stringify(progression.afterConferenceFinal)}`);
}
if (!legacyBracketRepair.wrongConferenceResult.repaired || legacyBracketRepair.wrongConferenceResult.conf !== 'SOUTH'
  || !legacyBracketRepair.wrongConferenceResult.teamsCorrect || legacyBracketRepair.wrongConferenceResult.completedRounds !== 0) {
  failures.push(`旧存档错误分区修复失败：${JSON.stringify(legacyBracketRepair.wrongConferenceResult)}`);
}
if (!legacyBracketRepair.aheadProgressResult.repaired || legacyBracketRepair.aheadProgressResult.completedRounds !== 1
  || legacyBracketRepair.aheadProgressResult.results !== 4) {
  failures.push(`旧存档超前进度修复失败：${JSON.stringify(legacyBracketRepair.aheadProgressResult)}`);
}
if (realRosterSmoke.invariantErrors) failures.push(`真实名单联调存在 ${realRosterSmoke.invariantErrors} 个不变量错误`);
if (!realRosterSmoke.fullChain || realRosterSmoke.fullChain.seasons < 3 || realRosterSmoke.fullChain.games < 3690
  || realRosterSmoke.fullChain.invariantErrors) {
  failures.push(`正式比赛引擎全链路赛季验证失败：${JSON.stringify(realRosterSmoke.fullChain)}`);
}
if (realRosterSmoke.fullChain.minimumTeamScore > 95 || realRosterSmoke.fullChain.maximumTeamScore < 125) {
  failures.push(`正式全链路未覆盖低分/高分/加时级输入：${JSON.stringify(realRosterSmoke.fullChain)}`);
}
if (realRosterSmoke.fullChain.reconciliation.meanAbs >= 4
  || realRosterSmoke.fullChain.reconciliation.p90 > 8
  || realRosterSmoke.fullChain.reconciliation.p95 > 10
  || realRosterSmoke.fullChain.reconciliation.overTenRate > 0.035
  || realRosterSmoke.fullChain.reconciliation.budgetRebalances !== 0) {
  failures.push(`正式全链路 reconciliation 修正过强：${JSON.stringify(realRosterSmoke.fullChain.reconciliation)}`);
}
if (!realRosterSmoke.clutchIsolation || realRosterSmoke.clutchIsolation.highClutchWinRate < 0.525
  || realRosterSmoke.clutchIsolation.highClutchWinRate > 0.575) {
  failures.push(`CLU 未主要在胶着第四节/加时产生可控优势：${JSON.stringify(realRosterSmoke.clutchIsolation)}`);
}
// 球员层保留明确的组织进攻差；比赛层只把绝对攻防差转换为小额结构优势。
if (!realRosterSmoke.playmakerTeamIsolation
  || outside(realRosterSmoke.playmakerTeamIsolation.highWinRate, 0.505, 0.525)
  || outside(realRosterSmoke.playmakerTeamIsolation.offensePowerGap, 1.45, 1.95)
  || outside(realRosterSmoke.playmakerTeamIsolation.appliedStructureGap, 0.30, 0.40)
  || outside(realRosterSmoke.playmakerTeamIsolation.highPoints - realRosterSmoke.playmakerTeamIsolation.lowPoints, 0.15, 0.60)
  || Math.abs(realRosterSmoke.playmakerTeamIsolation.overallPowerGap) > 0.01) {
  failures.push(`顶级组织能力的球队级攻防收益过弱或过强：${JSON.stringify(realRosterSmoke.playmakerTeamIsolation)}`);
}
if (!realRosterSmoke.offensiveRatingIsolation
  || outside(realRosterSmoke.offensiveRatingIsolation.profileOffense, 82, 85)
  || Math.abs(realRosterSmoke.offensiveRatingIsolation.clutchGap) > 0.001
  || outside(realRosterSmoke.offensiveRatingIsolation.overallGap, 2.9, 3.1)
  || realRosterSmoke.offensiveRatingIsolation.eliteScorerOffense < 92) {
  failures.push(`基础进攻评级仍被 OVR/CLU 主导或压低真实进攻核心：${JSON.stringify(realRosterSmoke.offensiveRatingIsolation)}`);
}
if (!realRosterSmoke.defensiveRatingIsolation
  || outside(realRosterSmoke.defensiveRatingIsolation.profileDefense, 84.5, 86)
  || outside(realRosterSmoke.defensiveRatingIsolation.overallGap, 2.9, 3.1)
  || Math.abs(realRosterSmoke.defensiveRatingIsolation.anchorBonus) > 0.001) {
  failures.push(`基础防守评级仍被 OVR 主导或错误触发防守支柱奖励：${JSON.stringify(realRosterSmoke.defensiveRatingIsolation)}`);
}
if (outside(realRosterSmoke.winRatePHI, 0.68, 0.88)) failures.push(`真实强弱队胜率异常：${realRosterSmoke.winRatePHI}`);
if (outside(realRosterSmoke.averageTotal, 205, 235)) failures.push(`真实名单场均总分异常：${realRosterSmoke.averageTotal}`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
