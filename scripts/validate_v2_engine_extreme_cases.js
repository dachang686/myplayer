const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const v2Source = fs.readFileSync(path.join(root, 'js', 'simulation_v2.js'), 'utf8');
const config = require(path.join(root, 'js', 'data', 'simulation_config.js'));
const state = {
  careerTeam: null,
  season: {
    schedule: [], standings: {}, isPlayoffs: false,
    _npcSeasonProfiles: {}, events: { activeEffects: [] },
  },
};
const attributeKeys = [
  'threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS',
  'PDEF', 'STL', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU',
];
const positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C'];
const defaultMinutes = [36, 34, 32, 30, 28, 24, 20, 16, 12, 8];
const rotations = {};
const powers = {};

function makeTeam(id, level, patch = {}, minutes = defaultMinutes) {
  const players = positions.map((pos, index) => {
    const player = { id: `${id}-${index}`, cname: `${id}-${index}`, pos };
    attributeKeys.forEach(key => { player[key] = level; });
    return player;
  });
  Object.assign(players[0], patch);
  rotations[id] = { players, minutes: minutes.slice(), roleRanks: players.map((_, index) => index) };
  powers[id] = { overall: level, structure: 0 };
  return id;
}

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const lineFields = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fgm', 'fga', 'ftm', 'fta', 'threeM', 'threeA', 'mins'];

function inspectResult(result, teamA, teamB) {
  assert(result.engineVersion === 'v2', '极限测试没有直接调用 V2');
  assert(Number.isInteger(result.scoreA) && Number.isInteger(result.scoreB), '比分不是整数');
  assert(result.scoreA >= 0 && result.scoreB >= 0 && result.scoreA !== result.scoreB, '比分非法或加时后仍平局');
  assert(Number.isInteger(result.ot) && result.ot >= 0, '加时次数非法');
  assert(result.engineDiagnostics.periods.length === 4 + result.ot, '比赛节数与加时次数不一致');

  const linesA = result.boxScore[teamA];
  const linesB = result.boxScore[teamB];
  assert(Array.isArray(linesA) && Array.isArray(linesB), '缺少球队箱分');
  [[linesA, result.scoreA, teamA], [linesB, result.scoreB, teamB]].forEach(([lines, score, team]) => {
    lines.forEach(line => {
      lineFields.forEach(field => assert(Number.isFinite(Number(line[field])), `${team} 的 ${field} 不是有限数`));
      assert(lineFields.every(field => Number(line[field]) >= 0), `${team} 出现负数箱分`);
      assert(line.fgm <= line.fga && line.ftm <= line.fta && line.threeM <= line.threeA
        && line.threeA <= line.fga && line.threeM <= line.fgm, `${team} 投篮不变量失效`);
      assert(line.pts === (line.fgm - line.threeM) * 2 + line.threeM * 3 + line.ftm, `${team} 球员得分账不平`);
      assert(line.mins <= 48 + result.ot * 5, `${team} 球员分钟超过比赛长度`);
    });
    assert(lines.reduce((sum, line) => sum + line.pts, 0) === score, `${team} 球员得分与球队比分不一致`);
    assert(lines.reduce((sum, line) => sum + line.mins, 0) === 240 + result.ot * 25, `${team} 总分钟不守恒`);
    assert(lines.reduce((sum, line) => sum + line.ast, 0) <= lines.reduce((sum, line) => sum + line.fgm, 0), `${team} 助攻超过命中数`);
  });
  assert(linesA.reduce((sum, line) => sum + line.stl, 0) <= linesB.reduce((sum, line) => sum + line.tov, 0), 'A 队抢断超过 B 队失误');
  assert(linesB.reduce((sum, line) => sum + line.stl, 0) <= linesA.reduce((sum, line) => sum + line.tov, 0), 'B 队抢断超过 A 队失误');
}

function runSeries(teamA, teamB, settings) {
  const games = settings.games;
  const summary = {
    games, winsA: 0, marginTotal: 0, scoreATotal: 0, scoreBTotal: 0,
    overtimeGames: 0, maxOvertime: 0, maxScore: 0, expectedMarginTotal: 0,
  };
  for (let game = 0; game < games; game++) {
    const result = seeded(settings.seedBase + game, () => runtime(
      teamA,
      teamB,
      settings.seedBonus || 0,
      null,
      Object.assign({ isHomeA: null, isB2BA: false, isB2BB: false, ignoreNpcAvailability: true }, settings.options || {}),
    ));
    inspectResult(result, teamA, teamB);
    if (settings.inspect) settings.inspect(result);
    summary.winsA += result.scoreA > result.scoreB ? 1 : 0;
    summary.marginTotal += result.scoreA - result.scoreB;
    summary.scoreATotal += result.scoreA;
    summary.scoreBTotal += result.scoreB;
    summary.overtimeGames += result.ot > 0 ? 1 : 0;
    summary.maxOvertime = Math.max(summary.maxOvertime, result.ot);
    summary.maxScore = Math.max(summary.maxScore, result.scoreA, result.scoreB);
    summary.expectedMarginTotal += result.expectedMargin;
  }
  return {
    games,
    winRateA: summary.winsA / games,
    averageMargin: summary.marginTotal / games,
    averageScoreA: summary.scoreATotal / games,
    averageScoreB: summary.scoreBTotal / games,
    averageExpectedMargin: summary.expectedMarginTotal / games,
    overtimeGames: summary.overtimeGames,
    maxOvertime: summary.maxOvertime,
    maxScore: summary.maxScore,
  };
}

const all99A = makeTeam('V2_LIMIT_ALL99_A', 99);
const all99B = makeTeam('V2_LIMIT_ALL99_B', 99);
const all25A = makeTeam('V2_LIMIT_ALL25_A', 25);
const all25B = makeTeam('V2_LIMIT_ALL25_B', 25);
const equal80A = makeTeam('V2_LIMIT_EQUAL80_A', 80);
const equal80B = makeTeam('V2_LIMIT_EQUAL80_B', 80);

const report = {};
report.all99VsAll25 = runSeries(all99A, all25A, { games: 1000, seedBase: 1230000 });
report.all25Equal = runSeries(all25A, all25B, { games: 750, seedBase: 1330000 });
report.all99Equal = runSeries(all99A, all99B, { games: 750, seedBase: 1430000 });
report.overtimeStress = runSeries(equal80A, equal80B, { games: 5000, seedBase: 1530000 });

assert(report.all99VsAll25.winRateA >= 0.99 && report.all99VsAll25.averageMargin >= 45
  && report.all99VsAll25.averageMargin <= 80, `99 对 25 的强弱分层异常：${JSON.stringify(report.all99VsAll25)}`);
['all25Equal', 'all99Equal'].forEach(name => {
  const value = report[name];
  assert(Math.abs(value.averageMargin) <= 1.5 && value.winRateA >= 0.43 && value.winRateA <= 0.57,
    `${name} 的镜像公平性异常：${JSON.stringify(value)}`);
});
assert(report.overtimeStress.overtimeGames >= 50 && report.overtimeStress.maxOvertime >= 2,
  `加时压力测试没有覆盖足够的加时/双加时：${JSON.stringify(report.overtimeStress)}`);

const contextA = makeTeam('V2_LIMIT_CONTEXT_A', 80);
const contextB = makeTeam('V2_LIMIT_CONTEXT_B', 80);
report.boundedContext = runSeries(contextA, contextB, {
  games: 750,
  seedBase: 1630000,
  seedBonus: 100,
  options: { isHomeA: true, isB2BB: true },
  inspect(result) {
    assert(result.marginComponents.contextualMarginEdge === 18, '上下文分差没有在事件偏置前封顶');
    assert(Math.abs(result.marginComponents.contextualBias) <= 18 * 0.00230 + 1e-12, '上下文事件偏置越过硬上限');
  },
});
assert(report.boundedContext.averageMargin >= 10 && report.boundedContext.averageMargin <= 30
  && report.boundedContext.averageExpectedMargin === 18, `上下文极值没有保持有界：${JSON.stringify(report.boundedContext)}`);

const dirtyPatch = {
  threePT: NaN, MID: Infinity, FIN: -9999, DNK: 9999,
  HAN: null, PAS: undefined, PDEF: 'bad', STL: '',
  IDEF: '99x', BLK: -Infinity, REB: {}, ATH: [], STR: true, CLU: false,
};
const dirtyA = makeTeam('V2_LIMIT_DIRTY_A', 80, dirtyPatch);
const dirtyB = makeTeam('V2_LIMIT_DIRTY_B', 80);
report.dirtyAttributes = runSeries(dirtyA, dirtyB, { games: 500, seedBase: 1730000 });
assert(report.dirtyAttributes.maxScore <= 220, `脏属性导致比分越界：${JSON.stringify(report.dirtyAttributes)}`);

const zeroMinutes = [0, 36, 34, 32, 30, 28, 24, 22, 18, 16];
const zeroA = makeTeam('V2_LIMIT_ZERO_MINUTES_A', 80, Object.fromEntries(attributeKeys.map(key => [key, 99])), zeroMinutes);
const zeroB = makeTeam('V2_LIMIT_ZERO_MINUTES_B', 80);
report.zeroMinuteStar = runSeries(zeroA, zeroB, {
  games: 500,
  seedBase: 1830000,
  inspect(result) {
    const row = result.boxScore[zeroA].find(player => player.playerId === `${zeroA}-0`);
    assert(row && lineFields.every(field => Number(row[field]) === 0), `0 分钟球员参与了比赛事件：${JSON.stringify(row)}`);
  },
});

const invalidCases = [
  ['negative', [-1, 37, 34, 32, 30, 28, 24, 20, 18, 18]],
  ['notFinite', [NaN, 36, 34, 32, 30, 28, 24, 22, 18, 16]],
  ['over48', [49, 35, 32, 30, 28, 24, 20, 14, 8, 0]],
  ['wrongTotal', [35, 34, 32, 30, 28, 24, 20, 16, 12, 8]],
];
report.invalidRotations = {};
invalidCases.forEach(([name, minutes], index) => {
  const team = makeTeam(`V2_LIMIT_INVALID_${name}`, 80, {}, minutes);
  let message = '';
  try {
    seeded(1930000 + index, () => runtime(team, equal80B, 0, null, { ignoreNpcAvailability: true }));
  } catch (error) {
    message = String(error && error.message);
  }
  assert(message.includes('[V2] 无法生成有效轮换'), `${name} 非法轮换没有快速失败：${message}`);
  report.invalidRotations[name] = 'rejected';
});

Object.entries(report).forEach(([name, value]) => {
  if (!value || typeof value !== 'object') return;
  const serialized = JSON.stringify(value);
  assert(!serialized.includes('NaN') && !serialized.includes('Infinity'), `${name} 报告出现非有限数`);
});

console.log(JSON.stringify(report, null, 2));
