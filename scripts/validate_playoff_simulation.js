const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const playoffsSource = fs.readFileSync(path.join(root, 'js/playoffs.js'), 'utf8');

function extractSimulation(source, label) {
  const start = source.indexOf('function simulateGameNew');
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
if (!/\[true, true, false, false, true, false, true\]/.test(playoffsSource)) {
  throw new Error('季后赛主场顺序不是 2-2-1-1-1');
}
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
  const flowStart = playoffsSource.indexOf('function renderPlayoffs');
  const flowEnd = playoffsSource.indexOf('function getPlayoffTreeSeriesResult', flowStart);
  if (flowStart < 0 || flowEnd < 0) throw new Error('无法定位附加赛入口流程');

  const calls = { playIn: 0, save: 0, bracket: 0 };
  const staleBracket = { conf: 'NORTH', teams: Array.from({ length: 8 }, (_, index) => ({ team: `T${index + 1}` })) };
  const routeState = {
    careerTeam: 'T9',
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
    'renderPlayInUI',
    'queueSeasonAutoSave',
    'buildPlayoffBracket',
    'getOtherPlayoffConference',
    'renderPlayoffBracketUI',
    `${playoffsSource.slice(flowStart, flowEnd)}\nreturn { renderPlayoffs, resumePlayoffs };`,
  )(
    routeState,
    () => {},
    () => {},
    team => Number(team.slice(1)),
    () => 'NORTH',
    () => Array.from({ length: 15 }, (_, index) => ({ team: `T${index + 1}`, wins: 60 - index, losses: 22 + index })),
    () => { calls.playIn++; },
    () => { calls.save++; },
    () => { calls.bracket++; return staleBracket; },
    () => 'SOUTH',
    () => {},
  );

  playoffFlow.renderPlayoffs();
  const freshEntry = {
    playInRendered: calls.playIn === 1,
    bracketNotBuilt: calls.bracket === 0,
    playInInitialized: routeState.season.playInState?.seed9?.team === 'T9',
    staleBracketCleared: routeState.season.playoffBracket === null && routeState.season.otherBracket === null,
    playoffFlagCleared: routeState.season.isPlayoffs === false,
  };

  routeState.season.isPlayoffs = true;
  routeState.season.playoffBracket = staleBracket;
  routeState.season.otherBracket = { conf: 'SOUTH' };
  routeState.season.playoffSeed = 9;
  calls.playIn = 0;
  playoffFlow.resumePlayoffs();
  const legacyResume = {
    playInRendered: calls.playIn === 1,
    staleBracketCleared: routeState.season.playoffBracket === null && routeState.season.otherBracket === null,
    bracketNotBuilt: calls.bracket === 0,
  };

  routeState.season.playInState.gameAResult = { winner: 'T7', loser: 'T8' };
  routeState.season.playInState.gameBResult = { winner: 'T9', loser: 'T10' };
  routeState.season.playInState.gameCResult = { winner: 'T9', loser: 'T8' };
  routeState.season.playInState.playoffSeed = 8;
  calls.playIn = 0;
  playoffFlow.renderPlayoffs();
  const qualifiedEntry = {
    playInNotRendered: calls.playIn === 0,
    bothConferenceBracketsBuilt: calls.bracket === 2,
    playoffFlagSet: routeState.season.isPlayoffs === true,
  };

  return { freshEntry, legacyResume, qualifiedEntry };
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
  EQUAL_A: { offense: 78, defense: 68, athletic: 76, clutch: 75, depth: 84 },
  EQUAL_B: { offense: 78, defense: 68, athletic: 76, clutch: 75, depth: 84 },
  STRONG: { offense: 84, defense: 74, athletic: 84, clutch: 86, depth: 90 },
  WEAK: { offense: 76, defense: 64, athletic: 72, clutch: 66, depth: 80 },
  PLAYOFF_FAVORITE: { offense: 87.95, defense: 87.95, athletic: 87.95, clutch: 87.95, depth: 87.95 },
  PLAYOFF_UNDERDOG: { offense: 82.4, defense: 82.4, athletic: 82.4, clutch: 82.4, depth: 82.4 },
};

const state = { season: { schedule: [] } };
const simulateGame = new Function(
  'calcTeamPowerWithPlayer',
  'SIM_CONFIG',
  'STATE',
  'getTeamName',
  'generateBoxScore',
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

function runSeries(seed, teamA, teamB, seriesCount) {
  const homePattern = [true, true, false, false, true, false, true];
  return withSeed(seed, () => {
    let seriesWinsA = 0;
    for (let s = 0; s < seriesCount; s++) {
      let winsA = 0;
      let winsB = 0;
      for (let game = 0; game < 7 && winsA < 4 && winsB < 4; game++) {
        const result = simulateGame(teamA, teamB, 0, null, { isHomeA: homePattern[game], isB2B: false });
        if (result.won) winsA++;
        else winsB++;
      }
      if (winsA === 4) seriesWinsA++;
    }
    return seriesWinsA / seriesCount;
  });
}

function runSeriesWithRecords(seed, favoriteRecord, underdogRecord) {
  const previousIsPlayoffs = state.season.isPlayoffs;
  const previousStandings = state.season.standings;
  state.season.isPlayoffs = true;
  state.season.standings = {
    PLAYOFF_FAVORITE: favoriteRecord,
    PLAYOFF_UNDERDOG: underdogRecord,
  };
  try {
    return runSeries(seed, 'PLAYOFF_FAVORITE', 'PLAYOFF_UNDERDOG', 10000);
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

const deterministicA = withSeed(8808, () => simulateGame('STRONG', 'WEAK', 0, null, { isHomeA: true, isB2B: false }));
const deterministicB = withSeed(8808, () => simulateGame('STRONG', 'WEAK', 0, null, { isHomeA: true, isB2B: false }));

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
    'getConferenceSeed',
    'simulateGameNew',
    `${playoffsSource.slice(helperStart, helperEnd)}\n${playoffsSource.slice(autoStart, autoEnd)}\nreturn { autoSimConferenceBracket, autoSimConferenceBracketRound };`,
  )(
    { season: { standings } },
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
    'getConferenceSeed',
    'getConferenceSorted',
    'calcTeamPowerWithPlayer',
    'simulateGameNew',
    `${playoffsSource.slice(sourceStart, sourceEnd)}\nreturn { buildPlayoffBracket, autoSimConferenceBracket, autoSimConferenceBracketRound, repairPlayoffBracketState };`,
  )(
    repairState,
    { CONFERENCE: conference },
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
  const realSimulate = new Function(
    'LEAGUE_PLAYER_DATA',
    'SIM_CONFIG',
    'STATE',
    'getMyPlayerDisplayName',
    'getTeamName',
    'getLeaguePlayerAge',
    'af',
    `${indexSource.slice(engineStart, engineEnd)}\nreturn simulateGameNew;`,
  )(
    leagueData.LEAGUE_PLAYER_DATA,
    simConfig,
    realState,
    () => '验证球员',
    team => (simConfig.TEAM_NAMES && simConfig.TEAM_NAMES[team]) || team,
    player => Number(player && player._age) || 27,
    af,
  );

  return withSeed(9909, () => {
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
    }
    return { winRatePHI: wins / games, averageTotal: total / games, invariantErrors };
  });
}

const realRosterSmoke = runRealRosterSmoke();

const report = {
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
  },
  deterministic: {
    same: JSON.stringify(deterministicA) === JSON.stringify(deterministicB),
    score: `${deterministicA.scoreA}-${deterministicA.scoreB}`,
  },
  inferredRegularSeasonContext,
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
if (outside(wideRecordSeries, 0.93, 0.96)) failures.push(`明显战绩优势系列赛胜率异常：${wideRecordSeries}`);
if (outside(closeRecordSeries, 0.86, 0.91)) failures.push(`接近战绩系列赛胜率异常：${closeRecordSeries}`);
if (wideRecordSeries - closeRecordSeries < 0.04) {
  failures.push(`常规赛战绩差没有形成足够区分：${JSON.stringify({ wideRecordSeries, closeRecordSeries })}`);
}
if (!report.deterministic.same) failures.push('相同随机种子没有产生相同结果');
if (inferredRegularSeasonContext.isHomeA !== false || inferredRegularSeasonContext.fatigueMarginDelta !== -1) {
  failures.push(`常规赛主客场/背靠背推断错误：${JSON.stringify(inferredRegularSeasonContext)}`);
}
if (!bracketMapping.correctSemifinals || bracketMapping.champion !== 'T1') failures.push(`季后赛半区映射错误：${JSON.stringify(bracketMapping)}`);
if (JSON.stringify(bracketMapping.homePattern) !== JSON.stringify([true, true, false, false])) {
  failures.push(`季后赛主场顺序错误：${JSON.stringify(bracketMapping.homePattern)}`);
}
if (!Object.values(playInRouting.freshEntry).every(Boolean)) {
  failures.push(`附加赛新入口路由错误：${JSON.stringify(playInRouting.freshEntry)}`);
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
if (outside(realRosterSmoke.winRatePHI, 0.68, 0.88)) failures.push(`真实强弱队胜率异常：${realRosterSmoke.winRatePHI}`);
if (outside(realRosterSmoke.averageTotal, 205, 235)) failures.push(`真实名单场均总分异常：${realRosterSmoke.averageTotal}`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
