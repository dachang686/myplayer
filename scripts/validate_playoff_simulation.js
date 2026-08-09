const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, 'js/core_game_logic.js'), 'utf8');
const playoffsSource = fs.readFileSync(path.join(root, 'js/playoffs.js'), 'utf8');

function extractSimulation(source, label) {
  const start = source.indexOf('function simulateGameNew');
  const end = source.indexOf('function leagueStatClamp', start);
  if (start < 0 || end < 0) throw new Error(`无法定位 ${label} 的比赛模拟函数`);
  return source.slice(start, end).trim();
}

const indexSimulation = extractSimulation(indexSource, 'index.html');
const coreSimulation = extractSimulation(coreSource, 'js/core_game_logic.js');
if (indexSimulation !== coreSimulation) {
  throw new Error('index.html 与 js/core_game_logic.js 的比赛模拟函数不同步');
}
if (/predeterminedWinner|最终结果由预定胜者决定/.test(indexSimulation)) {
  throw new Error('比赛模拟仍然存在预定胜者逻辑');
}
if (!/const won = scoreA > scoreB/.test(indexSimulation)) {
  throw new Error('比赛胜负没有直接读取最终比分');
}
if (!/\[true, true, false, false, true, false, true\]/.test(playoffsSource)) {
  throw new Error('季后赛主场顺序不是 2-2-1-1-1');
}

for (const [source, label] of [[coreSource, 'js/core_game_logic.js'], [playoffsSource, 'js/playoffs.js']]) {
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
};

const state = { season: { schedule: [] } };
const simulateGame = new Function(
  'calcTeamPowerWithPlayer',
  'SIM_CONFIG',
  'STATE',
  'getTeamName',
  'generateBoxScore',
  `${coreSimulation}\nreturn simulateGameNew;`,
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

const equalNeutral = runGames({ seed: 1101, teamA: 'EQUAL_A', teamB: 'EQUAL_B', isHomeA: null });
const equalHome = runGames({ seed: 2202, teamA: 'EQUAL_A', teamB: 'EQUAL_B', isHomeA: true });
const equalAway = runGames({ seed: 3303, teamA: 'EQUAL_A', teamB: 'EQUAL_B', isHomeA: false });
const strongNeutral = runGames({ seed: 4404, teamA: 'STRONG', teamB: 'WEAK', isHomeA: null });
const injuredEqual = runGames({ seed: 5505, teamA: 'EQUAL_A', teamB: 'EQUAL_B', isHomeA: null, probMultiplier: 0.86 });
const equalSeries = runSeries(6606, 'EQUAL_A', 'EQUAL_B', 6000);
const strongSeries = runSeries(7707, 'STRONG', 'WEAK', 6000);

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
  const runAutoBracket = new Function(
    'STATE',
    'getConferenceSeed',
    'simulateGameNew',
    `${playoffsSource.slice(helperStart, helperEnd)}\n${playoffsSource.slice(autoStart, autoEnd)}\nreturn autoSimConferenceBracket;`,
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
  const teams = Array.from({ length: 8 }, (_, index) => ({ team: `T${index + 1}` }));
  const bracket = {
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
  runAutoBracket(bracket);
  const semiA = bracket.rounds[1][0];
  const semiB = bracket.rounds[1][1];
  const firstSeries = bracket.results.find(result => result.round === 0 && result.seriesIdx === 0);
  const homePattern = firstSeries.seriesGames.map(game => game.home);
  return {
    correctSemifinals: semiA.high.team === 'T1' && semiA.low.team === 'T4'
      && semiB.high.team === 'T2' && semiB.low.team === 'T3',
    champion: bracket.confChampion,
    homePattern,
  };
}

const bracketMapping = validateConferenceBracketMapping();

function runRealRosterSmoke() {
  const dataSource = fs.readFileSync(path.join(root, 'js/data/nba2k_players.js'), 'utf8');
  const configSource = fs.readFileSync(
    path.join(root, 'assets/activity-static.hoopchina.com.cn/files/2678-qlg35lrc-upload-1783494754597-24.js'),
    'utf8',
  );
  const leagueData = new Function(`${dataSource}\nreturn { NBA2K_DATA, NBA2K_TEAMS };`)();
  const simConfig = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
  const engineStart = coreSource.indexOf('function getPlayerPositions');
  const engineEnd = coreSource.indexOf('/** 属性→效率系数：递减曲线', engineStart);
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
    'NBA2K_DATA',
    'SIM_CONFIG',
    'STATE',
    'getHupuDisplayName',
    'getTeamName',
    'getLeaguePlayerAge',
    'af',
    `${coreSource.slice(engineStart, engineEnd)}\nreturn simulateGameNew;`,
  )(
    leagueData.NBA2K_DATA,
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
  equalNeutral,
  equalHome,
  equalAway,
  strongNeutral,
  injuredEqual,
  equalSeries,
  strongSeries,
  deterministic: {
    same: JSON.stringify(deterministicA) === JSON.stringify(deterministicB),
    score: `${deterministicA.scoreA}-${deterministicA.scoreB}`,
  },
  inferredRegularSeasonContext,
  bracketMapping,
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
if (!report.deterministic.same) failures.push('相同随机种子没有产生相同结果');
if (inferredRegularSeasonContext.isHomeA !== false || inferredRegularSeasonContext.fatigueMarginDelta !== -1) {
  failures.push(`常规赛主客场/背靠背推断错误：${JSON.stringify(inferredRegularSeasonContext)}`);
}
if (!bracketMapping.correctSemifinals || bracketMapping.champion !== 'T1') failures.push(`季后赛半区映射错误：${JSON.stringify(bracketMapping)}`);
if (JSON.stringify(bracketMapping.homePattern) !== JSON.stringify([true, true, false, false])) {
  failures.push(`季后赛主场顺序错误：${JSON.stringify(bracketMapping.homePattern)}`);
}
if (realRosterSmoke.invariantErrors) failures.push(`真实名单联调存在 ${realRosterSmoke.invariantErrors} 个不变量错误`);
if (outside(realRosterSmoke.winRatePHI, 0.68, 0.88)) failures.push(`真实强弱队胜率异常：${realRosterSmoke.winRatePHI}`);
if (outside(realRosterSmoke.averageTotal, 205, 235)) failures.push(`真实名单场均总分异常：${realRosterSmoke.averageTotal}`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
