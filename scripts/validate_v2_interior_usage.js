const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
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
const simulate = new Function(
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
  () => 'V2 内线使用率校准球员',
  team => team,
  player => Number(player && player._age) || 27,
  af,
  ensureSeasonEventState,
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

const attributeKeys = [
  'threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS',
  'PDEF', 'STL', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU',
];
const positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG/SG', 'SF/PF', 'C/PF', 'SG/SF', 'PF/C'];
const minutes = [34, 34, 32, 30, 28, 24, 20, 16, 12, 10];
const sourceTeam = leagueData.LEAGUE_TEAM_IDS[0];

function makeSyntheticTeam(id, corePatch) {
  const players = JSON.parse(JSON.stringify(leagueData.LEAGUE_PLAYER_DATA[sourceTeam].slice(0, 10)));
  players.forEach((player, index) => {
    player.id = `${id}-${index}`;
    player.cname = `${id}-${index}`;
    player.pos = positions[index];
    player.ovr = 90;
    attributeKeys.forEach(key => { player[key] = 80; });
  });
  Object.assign(players[0], corePatch);
  leagueData.LEAGUE_PLAYER_DATA[id] = players;
  return id;
}

function fixedRotation(team) {
  const players = leagueData.LEAGUE_PLAYER_DATA[team].map(player => Object.assign({}, player));
  return { players, roleRanks: players.map((_, index) => index), minutes: minutes.slice() };
}

const control = makeSyntheticTeam('V2_INTERIOR_CONTROL', {});
const interior = makeSyntheticTeam('V2_INTERIOR_CORE', {
  pos: 'C', threePT: 35, MID: 50, FIN: 99, DNK: 95, HAN: 65, PAS: 60,
  ATH: 90, STR: 95, REB: 95, PDEF: 65, IDEF: 95, STL: 55, BLK: 95,
});
const perimeter = makeSyntheticTeam('V2_PERIMETER_CORE', {
  pos: 'PG', threePT: 95, MID: 95, FIN: 85, DNK: 70, HAN: 95, PAS: 85,
  ATH: 90, STR: 70, REB: 65, PDEF: 80, IDEF: 55, STL: 80, BLK: 45,
});

function runCore(team, games, seedBase) {
  const totals = { pts: 0, fgm: 0, fga: 0, fta: 0, threeA: 0 };
  const prepared = { [team]: fixedRotation(team), [control]: fixedRotation(control) };
  for (let game = 0; game < games; game++) {
    state.season._npcSeasonProfiles = {};
    const result = seeded(seedBase + game, () => simulate(team, control, 0, null, {
      isHomeA: null,
      isB2BA: false,
      isB2BB: false,
      ignoreNpcAvailability: true,
      _preparedRotations: prepared,
    }));
    const row = (result.boxScore[team] || []).find(player => player.playerId === `${team}-0`);
    if (!row) throw new Error(`缺少核心球员箱分：${team}`);
    Object.keys(totals).forEach(field => { totals[field] += Number(row[field]) || 0; });
  }
  return {
    games,
    minutes: minutes[0],
    pts: totals.pts / games,
    fga: totals.fga / games,
    fta: totals.fta / games,
    threeA: totals.threeA / games,
    fgPct: totals.fgm / Math.max(1, totals.fga),
  };
}

const games = 2500;
const report = {
  interior: runCore(interior, games, 810000),
  perimeter: runCore(perimeter, games, 820000),
};

if (report.interior.pts < 18 || report.interior.pts > 25
  || report.interior.fga < 16 || report.interior.fga > 20
  || report.interior.fta < 2.7 || report.interior.fta > 5.5
  || report.interior.threeA > 1.5
  || report.interior.fgPct < 0.50 || report.interior.fgPct > 0.68
  || report.interior.fga < report.perimeter.fga * 0.72
  || report.interior.fta < report.perimeter.fta * 0.80) {
  throw new Error(`V2 强力内线进攻机会仍被压制：${JSON.stringify(report)}`);
}

console.log(JSON.stringify(report, null, 2));
