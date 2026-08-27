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
const positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SF', 'C', 'SG', 'PF'];
const rotations = {};
const powers = {};

function makeTeam(id, patch, minutes) {
  const players = positions.map((pos, index) => {
    const player = { id: `${id}-${index}`, cname: `${id}-${index}`, pos };
    attributeKeys.forEach(key => { player[key] = 80; });
    return player;
  });
  Object.assign(players[0], patch);
  rotations[id] = { players, minutes: minutes.slice(), roleRanks: players.map((_, index) => index) };
  powers[id] = { overall: 80, structure: 0 };
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

const fields = ['pts', 'ast', 'reb', 'stl', 'blk', 'tov'];
function runPlayer(team, opponent, games, seedBase) {
  const totals = Object.fromEntries(fields.map(field => [field, 0]));
  const maxima = Object.fromEntries(fields.map(field => [field, 0]));
  for (let game = 0; game < games; game++) {
    const result = seeded(seedBase + game, () => runtime(team, opponent, 0, null, {
      isHomeA: null,
      isB2B: false,
      ignoreNpcAvailability: true,
    }));
    assert(result.engineVersion === 'v2', `${team} 没有直接调用 V2`);
    const row = (result.boxScore[team] || []).find(player => player.playerId === `${team}-0`);
    assert(row, `${team} 缺少目标球员箱分`);
    fields.forEach(field => {
      const value = Number(row[field]) || 0;
      totals[field] += value;
      maxima[field] = Math.max(maxima[field], value);
    });
  }
  return {
    games,
    averages: Object.fromEntries(fields.map(field => [field, totals[field] / games])),
    maxima,
  };
}

const minutes34 = [34, 34, 32, 30, 28, 24, 20, 16, 12, 10];
const minutes48 = [48, 30, 28, 26, 24, 22, 20, 16, 14, 12];
const profiles = {
  baseline: { pos: 'SF' },
  assistSingle: { pos: 'PG', PAS: 99 },
  assistPackage: { pos: 'PG', PAS: 99, HAN: 99 },
  reboundSingle: { pos: 'C', REB: 99 },
  reboundPackage: { pos: 'C', REB: 99, STR: 99, ATH: 99 },
  stealSingle: { pos: 'SG', STL: 99 },
  stealPackage: { pos: 'SG', STL: 99, PDEF: 99, ATH: 99 },
  blockSingle: { pos: 'C', BLK: 99 },
  blockPackage: { pos: 'C', BLK: 99, IDEF: 99, ATH: 99, STR: 99 },
};
const opponent34 = makeTeam('V2_EXTREME_OPPONENT_34', {}, minutes34);
const opponent48 = makeTeam('V2_EXTREME_OPPONENT_48', {}, minutes48);
const games = 2500;
const report = { minutes34: {}, minutes48: {} };

Object.entries(profiles).forEach(([name, patch]) => {
  const team34 = makeTeam(`V2_EXTREME_34_${name}`, patch, minutes34);
  report.minutes34[name] = runPlayer(team34, opponent34, games, 980000);
  if (name === 'baseline' || name.endsWith('Package')) {
    const team48 = makeTeam(`V2_EXTREME_48_${name}`, patch, minutes48);
    report.minutes48[name] = runPlayer(team48, opponent48, games, 1080000);
  }
});

const normal = report.minutes34;
const maximum = report.minutes48;
assert(normal.assistSingle.averages.ast >= normal.baseline.averages.ast + 2.2
  && normal.assistPackage.averages.ast >= normal.assistSingle.averages.ast + 1.5,
`极限传球属性没有形成连续助攻增益：${JSON.stringify(report)}`);
assert(normal.reboundSingle.averages.reb >= normal.baseline.averages.reb + 1.5
  && normal.reboundPackage.averages.reb >= normal.reboundSingle.averages.reb,
`极限篮板属性没有形成稳定篮板增益：${JSON.stringify(report)}`);
assert(normal.stealSingle.averages.stl >= normal.baseline.averages.stl + 0.4
  && normal.stealPackage.averages.stl >= normal.stealSingle.averages.stl + 0.1,
`极限抢断属性没有形成连续抢断增益：${JSON.stringify(report)}`);
assert(normal.blockSingle.averages.blk >= normal.baseline.averages.blk + 0.4
  && normal.blockPackage.averages.blk >= normal.blockSingle.averages.blk + 0.1,
`极限盖帽属性没有形成连续盖帽增益：${JSON.stringify(report)}`);

const bounds = {
  assistPackage: { field: 'ast', normal: [8, 12], maximum: [9, 14], singleGameMax: 25 },
  reboundPackage: { field: 'reb', normal: [8.5, 12], maximum: [11, 16], singleGameMax: 30 },
  stealPackage: { field: 'stl', normal: [1.4, 2.5], maximum: [1.9, 3.5], singleGameMax: 10 },
  blockPackage: { field: 'blk', normal: [1.2, 2.5], maximum: [1.6, 3.2], singleGameMax: 10 },
};
Object.entries(bounds).forEach(([name, bound]) => {
  const normalValue = normal[name].averages[bound.field];
  const maximumValue = maximum[name].averages[bound.field];
  const minutesRatio = maximumValue / Math.max(0.01, normalValue);
  assert(normalValue >= bound.normal[0] && normalValue <= bound.normal[1]
    && maximumValue >= bound.maximum[0] && maximumValue <= bound.maximum[1]
    && minutesRatio >= 1.05 && minutesRatio <= 1.60
    && maximum[name].maxima[bound.field] <= bound.singleGameMax,
  `${name} 的极限 ${bound.field} 生态越界：${JSON.stringify({ normalValue, maximumValue, minutesRatio, report })}`);
});

console.log(JSON.stringify(report, null, 2));
