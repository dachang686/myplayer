const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const v2Source = fs.readFileSync(path.join(root, 'js', 'simulation_v2.js'), 'utf8');
const config = require(path.join(root, 'js', 'data', 'simulation_config.js'));
const state = {
  careerTeam: null,
  season: { schedule: [], standings: {}, isPlayoffs: true, _npcSeasonProfiles: {}, events: { activeEffects: [] } },
};
const attributeKeys = ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'STL', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'];
function makeTeam(prefix) {
  const positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SF', 'C', 'SG', 'PF'];
  const minutes = [32, 32, 30, 30, 28, 24, 20, 18, 14, 12];
  const players = positions.map((pos, index) => {
    const row = { id: `${prefix}-${index}`, cname: `${prefix}-${index}`, pos };
    attributeKeys.forEach(key => { row[key] = 80; });
    return row;
  });
  return { players, minutes, roleRanks: players.map((_, index) => index) };
}
const rotations = { A: makeTeam('A'), B: makeTeam('B') };
const powers = { A: { overall: 80, structure: 0 }, B: { overall: 80, structure: 0 } };
const runtime = new Function(
  'SIM_CONFIG', 'STATE', 'prepareLeagueGameRotation', 'calcTeamPowerWithPlayer', 'getTeamCompetitiveRating',
  'getActiveEventTeamEdge', 'getSeasonModifierTeamEdge', 'getNpcSeasonProfile',
  `${v2Source}\nreturn globalThis.simulateGameAggregateV2;`,
)(
  config,
  state,
  team => rotations[team],
  team => powers[team],
  power => ({ roster: power.overall, structure: power.structure, star: 0, total: power.overall + power.structure }),
  () => 0,
  () => 0,
  () => ({ scoring: 1, rebounding: 1, playmaking: 1, defense: 1 }),
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function seeded(seed, callback) {
  const originalRandom = Math.random;
  let value = seed >>> 0;
  Math.random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
  try { return callback(); } finally { Math.random = originalRandom; }
}

function setScenario({ overallA = 80, overallB = 80, structureA = 0, structureB = 0, recordA = [41, 41], recordB = [41, 41] } = {}) {
  powers.A = { overall: overallA, structure: structureA };
  powers.B = { overall: overallB, structure: structureB };
  state.season.standings = {
    A: { wins: recordA[0], losses: recordA[1] },
    B: { wins: recordB[0], losses: recordB[1] },
  };
}

function runGames(label, games, scenario, options = {}, seedBonus = 0) {
  setScenario(scenario);
  let wins = 0;
  let actualMargin = 0;
  let expectedMargin = 0;
  let estimatedWinProb = 0;
  let allV2 = true;
  for (let game = 0; game < games; game++) {
    const result = seeded(17000 + game * 97, () => runtime('A', 'B', seedBonus, null, Object.assign({
      isB2B: false, ignoreNpcAvailability: true,
    }, options)));
    wins += result.won ? 1 : 0;
    actualMargin += result.actualMargin;
    expectedMargin += result.expectedMargin;
    estimatedWinProb += result.estimatedWinProb;
    allV2 = allV2 && result.engineVersion === 'v2';
  }
  return {
    label,
    games,
    winRate: wins / games,
    actualMargin: actualMargin / games,
    expectedMargin: expectedMargin / games,
    estimatedWinProb: estimatedWinProb / games,
    allV2,
  };
}

const pairedGames = 5000;
const neutral = runGames('neutral', pairedGames, {}, { isHomeA: null });
const home = runGames('home', pairedGames, {}, { isHomeA: true });
const roster = runGames('roster', pairedGames, { overallA: 84 }, { isHomeA: null });
const structure = runGames('structure', pairedGames, { structureA: 4 }, { isHomeA: null });
const record = runGames('record', pairedGames, { recordA: [56, 26], recordB: [48, 34] }, { isHomeA: null });
const fatigueA = runGames('fatigue-a', pairedGames, {}, { isHomeA: null, isB2BA: true, isB2BB: false });
const fatigueB = runGames('fatigue-b', pairedGames, {}, { isHomeA: null, isB2BA: false, isB2BB: true });
const fatigueBoth = runGames('fatigue-both', pairedGames, {}, { isHomeA: null, isB2BA: true, isB2BB: true });
const combinedScenario = { overallA: 84, structureA: 4, recordA: [56, 26], recordB: [48, 34] };
const combined = runGames('combined', pairedGames, combinedScenario, { isHomeA: true, isB2BA: false, isB2BB: false }, 2);
const combinedFatigueA = runGames('combined-fatigue-a', pairedGames, combinedScenario, { isHomeA: true, isB2BA: true, isB2BB: false }, 2);

function setSharedProfile(patch) {
  ['A', 'B'].forEach(team => rotations[team].players.forEach(player => {
    attributeKeys.forEach(key => { player[key] = 80; });
    Object.assign(player, patch);
  }));
}
function runFatigueProfile(label, patch) {
  setSharedProfile(patch);
  return {
    fatigueA: runGames(`${label}-fatigue-a`, 10000, {}, { isHomeA: null, isB2BA: true, isB2BB: false }),
    fatigueB: runGames(`${label}-fatigue-b`, 10000, {}, { isHomeA: null, isB2BA: false, isB2BB: true }),
  };
}
const fatigueProfiles = {
  shooting: runFatigueProfile('shooting', { threePT: 92, MID: 90, FIN: 84, DNK: 78, HAN: 90, PAS: 88, ATH: 86 }),
  rimPressure: runFatigueProfile('rim-pressure', { threePT: 68, MID: 78, FIN: 94, DNK: 92, HAN: 86, PAS: 80, ATH: 92, STR: 90 }),
};
setSharedProfile({});
const fatigueProfileSamples = Object.values(fatigueProfiles).flatMap(profile => [profile.fatigueA, profile.fatigueB]);

for (const sample of [neutral, home, roster, structure, record, fatigueA, fatigueB, fatigueBoth, combined, combinedFatigueA, ...fatigueProfileSamples]) {
  assert(sample.allV2, `${sample.label} 没有直接调用 V2 引擎`);
  assert(Math.abs(sample.actualMargin - sample.expectedMargin) < 0.65,
    `${sample.label} 的 expectedMargin 与实际平均分差分裂：${JSON.stringify(sample)}`);
  assert(Math.abs(sample.winRate - sample.estimatedWinProb) < 0.025,
    `${sample.label} 的 estimatedWinProb 与实际胜率偏差过大：${JSON.stringify(sample)}`);
}
assert(Math.abs(neutral.expectedMargin) < 1e-9 && Math.abs(neutral.actualMargin) < 0.35,
  `中立同阵容基线不居中：${JSON.stringify(neutral)}`);
assert(Math.abs(home.expectedMargin - 2.8) < 1e-9, `主场分差口径错误：${JSON.stringify(home)}`);
assert(Math.abs(roster.expectedMargin - 7.28) < 1e-9, `阵容画像残差口径错误：${JSON.stringify(roster)}`);
assert(Math.abs(structure.expectedMargin - 2.6) < 1e-9, `结构残差没有完整进入预期分差：${JSON.stringify(structure)}`);
const expectedRecordEdge = ((56 / 82) - (48 / 82)) * 7;
assert(Math.abs(record.expectedMargin - expectedRecordEdge) < 1e-9, `战绩分差口径错误：${JSON.stringify(record)}`);
assert(fatigueA.expectedMargin < -1.5 && fatigueB.expectedMargin > 1.5
  && Math.abs(fatigueA.expectedMargin + fatigueB.expectedMargin) < 1e-9,
`单方疲劳没有以对称的实测分差进入诊断：${JSON.stringify({ fatigueA, fatigueB })}`);
assert(Math.abs(fatigueBoth.expectedMargin) < 1e-9 && Math.abs(fatigueBoth.actualMargin) < 0.35,
  `双方疲劳不应制造净分差：${JSON.stringify(fatigueBoth)}`);
assert(Math.abs((combined.expectedMargin - combinedFatigueA.expectedMargin) + fatigueA.expectedMargin) < 1e-9,
  `疲劳在组合场景中的分差口径不一致：${JSON.stringify({ combined, combinedFatigueA, fatigueA })}`);

const homePattern = [true, true, false, false, true, false, true];
function runSeries(label, count, scenario, seedBonus) {
  setScenario(scenario);
  let seriesWins = 0;
  const gameWinProbabilities = homePattern.map((isHomeA, game) => seeded(810000 + game, () => (
    runtime('A', 'B', seedBonus, null, {
      isHomeA, isB2B: false, ignoreNpcAvailability: true,
    }).estimatedWinProb
  )));
  for (let series = 0; series < count; series++) {
    let winsA = 0;
    let winsB = 0;
    for (let game = 0; game < homePattern.length && winsA < 4 && winsB < 4; game++) {
      const result = seeded(910000 + series * 31 + game, () => runtime('A', 'B', seedBonus, null, {
        isHomeA: homePattern[game], isB2B: false, ignoreNpcAvailability: true,
      }));
      assert(result.engineVersion === 'v2', `${label} 系列赛绕过了 V2`);
      if (result.won) winsA++; else winsB++;
    }
    if (winsA === 4) seriesWins++;
  }
  let probabilityStates = { '0,0': 1 };
  gameWinProbabilities.forEach(winProbability => {
    const nextStates = {};
    Object.keys(probabilityStates).forEach(key => {
      const [winsA, winsB] = key.split(',').map(Number);
      const stateProbability = probabilityStates[key];
      if (winsA === 4 || winsB === 4) {
        nextStates[key] = (nextStates[key] || 0) + stateProbability;
        return;
      }
      const winKey = `${winsA + 1},${winsB}`;
      const lossKey = `${winsA},${winsB + 1}`;
      nextStates[winKey] = (nextStates[winKey] || 0) + stateProbability * winProbability;
      nextStates[lossKey] = (nextStates[lossKey] || 0) + stateProbability * (1 - winProbability);
    });
    probabilityStates = nextStates;
  });
  const expectedWinRate = Object.keys(probabilityStates).reduce((total, key) => (
    Number(key.split(',')[0]) === 4 ? total + probabilityStates[key] : total
  ), 0);
  return { label, series: count, winRate: seriesWins / count, expectedWinRate };
}
// 系列赛目标只有约 2～6 个百分点差异；10,000 组可将二项抽样标准误压到约 0.5 个百分点，
// 避免事件层随机调用数变化后，固定 2,500 组样本跨过门禁边界。
const playoffSeriesTrials = 10000;
const equalSeries = runSeries('equal', playoffSeriesTrials, {}, 0);
// 1v4 属于分区半决赛，生产规则不会再给首轮 seedBonus。
const oneVsFour = runSeries('1v4', playoffSeriesTrials, { recordA: [56, 26], recordB: [48, 34] }, 0);
const oneVsEight = runSeries('1v8', playoffSeriesTrials, { recordA: [56, 26], recordB: [35, 47] }, 2.8);
assert(equalSeries.expectedWinRate >= 0.52 && equalSeries.expectedWinRate <= 0.56,
  `同阵容 2-2-1-1-1 系列赛概率异常：${JSON.stringify(equalSeries)}`);
assert(oneVsFour.expectedWinRate >= 0.55 && oneVsFour.expectedWinRate <= 0.60
  && oneVsEight.expectedWinRate >= 0.64 && oneVsEight.expectedWinRate <= 0.71,
`生产规则下的 1v4/1v8 系列赛概率异常：${JSON.stringify({ equalSeries, oneVsFour, oneVsEight })}`);
for (const sample of [equalSeries, oneVsFour, oneVsEight]) {
  assert(Math.abs(sample.winRate - sample.expectedWinRate) < 0.015,
    `${sample.label} 系列赛实测胜率偏离理论概率：${JSON.stringify(sample)}`);
}

console.log(JSON.stringify({
  paired: { neutral, home, roster, structure, record, fatigueA, fatigueB, fatigueBoth, combined, combinedFatigueA },
  fatigueProfiles,
  series: { equalSeries, oneVsFour, oneVsEight },
}, null, 2));
