const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v2Source = fs.readFileSync(path.join(root, 'js', 'simulation_v2.js'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js', 'data', 'league_players.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'js', 'data', 'simulation_config.js'), 'utf8');
const leagueData = new Function(`${leagueSource}\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };`)();
const SIM_CONFIG = new Function(`${configSource}\nreturn SIM_CONFIG;`)();

const STATE = {
  careerTeam: null,
  finalOVR: 0,
  position: null,
  attrs: {},
  season: { schedule: [], isPlayoffs: false, _npcSeasonProfiles: {}, events: { activeEffects: [] } },
};
const attrFactor = value => Math.pow((Math.max(25, Math.min(99, value || 50)) - 25) / 74, 0.85);
const af = value => Math.pow(attrFactor(value), 1.5);
const ensureSeasonEventState = () => STATE.season.events || (STATE.season.events = { activeEffects: [] });

const engineStart = indexSource.indexOf('function getPlayerPositions');
const engineEnd = indexSource.indexOf('/** 属性→效率系数：递减曲线', engineStart);
if (engineStart < 0 || engineEnd < 0) throw new Error('无法定位比赛引擎源码');
const simulate = new Function(
  'LEAGUE_PLAYER_DATA', 'SIM_CONFIG', 'STATE', 'getMyPlayerDisplayName', 'getTeamName',
  'getLeaguePlayerAge', 'af', 'ensureSeasonEventState',
  `${indexSource.slice(engineStart, engineEnd)}\n${v2Source}\nreturn globalThis.simulateGameAggregateV2;`,
)(
  leagueData.LEAGUE_PLAYER_DATA,
  SIM_CONFIG,
  STATE,
  () => 'V10 双核心使用率测试球员',
  team => team,
  () => 27,
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
  try { return callback(); } finally { Math.random = originalRandom; }
}

const keys = ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','STL','IDEF','BLK','REB','ATH','STR','CLU'];
const positions = ['C','PG','SF','PF','SG','PG/SG','SF/PF','C/PF','SG/SF','PF/C'];
const minutes = [34,34,32,30,28,24,20,16,12,10];
const sourceTeam = leagueData.LEAGUE_TEAM_IDS[0];
const sourcePlayers = Object.values(leagueData.LEAGUE_PLAYER_DATA).flat();
const sourceById = Object.fromEntries(sourcePlayers.map(player => [player.id, player]));

const pureInterior = {
  pos: 'C', threePT: 25, MID: 25, FIN: 99, DNK: 99, HAN: 65, PAS: 80,
  ATH: 99, STR: 99, REB: 90, PDEF: 75, IDEF: 75, STL: 75, BLK: 75, CLU: 99,
};
const purePerimeter = {
  pos: 'PG', threePT: 99, MID: 99, FIN: 25, DNK: 25, HAN: 99, PAS: 80,
  ATH: 99, STR: 70, REB: 70, PDEF: 75, IDEF: 75, STL: 75, BLK: 75, CLU: 99,
};

function makeTeam(id, firstCore, secondCore) {
  const players = JSON.parse(JSON.stringify(leagueData.LEAGUE_PLAYER_DATA[sourceTeam].slice(0, 10)));
  players.forEach((player, index) => {
    player.id = `${id}-${index}`;
    player.cname = `${id}-${index}`;
    player.pos = positions[index];
    player.ovr = 80;
    keys.forEach(key => { player[key] = 80; });
  });
  Object.assign(players[0], firstCore);
  Object.assign(players[1], secondCore);
  leagueData.LEAGUE_PLAYER_DATA[id] = players;
  return id;
}

function fixedRotation(team) {
  const players = leagueData.LEAGUE_PLAYER_DATA[team].map(player => ({ ...player }));
  return { players, roleRanks: players.map((_, index) => index), minutes: minutes.slice() };
}

const control = makeTeam('V10_DUAL_CONTROL', {}, {});

function makeRealPairTeam(id, firstId, secondId) {
  const team = makeTeam(id, {}, {});
  const players = leagueData.LEAGUE_PLAYER_DATA[team];
  [firstId, secondId].forEach((playerId, index) => {
    const source = sourceById[playerId];
    if (!source) throw new Error(`缺少现实双核心球员：${playerId}`);
    Object.assign(players[index], JSON.parse(JSON.stringify(source)), { id: `${id}-${index}` });
  });
  return team;
}

function runNamedPair(team, games, seedBase) {
  const totals = [
    { pts: 0, fgm: 0, fga: 0, fta: 0, threeA: 0 },
    { pts: 0, fgm: 0, fga: 0, fta: 0, threeA: 0 },
  ];
  const prepared = { [team]: fixedRotation(team), [control]: fixedRotation(control) };
  for (let game = 0; game < games; game++) {
    STATE.season._npcSeasonProfiles = {};
    const result = seeded(seedBase + game, () => simulate(team, control, 0, null, {
      isHomeA: null, isB2BA: false, isB2BB: false, ignoreNpcAvailability: true, _preparedRotations: prepared,
    }));
    [0, 1].forEach(index => {
      const row = (result.boxScore[team] || []).find(player => player.playerId === `${team}-${index}`);
      if (!row) throw new Error(`缺少现实双核心箱分：${team}-${index}`);
      Object.keys(totals[index]).forEach(field => { totals[index][field] += Number(row[field]) || 0; });
    });
  }
  return totals.map(total => ({
    pts: total.pts / games,
    fga: total.fga / games,
    fta: total.fta / games,
    threeA: total.threeA / games,
    fgPct: total.fgm / Math.max(1, total.fga),
  }));
}
const interiorFirst = makeTeam('V10_DUAL_I_FIRST', pureInterior, purePerimeter);
const perimeterFirst = makeTeam('V10_DUAL_P_FIRST', purePerimeter, pureInterior);

function runPair(team, interiorIndex, perimeterIndex, games, seedBase) {
  const totals = [
    { pts: 0, fgm: 0, fga: 0, fta: 0, threeA: 0 },
    { pts: 0, fgm: 0, fga: 0, fta: 0, threeA: 0 },
  ];
  const prepared = { [team]: fixedRotation(team), [control]: fixedRotation(control) };
  for (let game = 0; game < games; game++) {
    STATE.season._npcSeasonProfiles = {};
    const result = seeded(seedBase + game, () => simulate(team, control, 0, null, {
      isHomeA: null,
      isB2BA: false,
      isB2BB: false,
      ignoreNpcAvailability: true,
      _preparedRotations: prepared,
    }));
    const rows = result.boxScore[team] || [];
    [interiorIndex, perimeterIndex].forEach((playerIndex, resultIndex) => {
      const row = rows.find(player => player.playerId === `${team}-${playerIndex}`);
      if (!row) throw new Error(`缺少双核心箱分：${team}-${playerIndex}`);
      Object.keys(totals[resultIndex]).forEach(field => { totals[resultIndex][field] += Number(row[field]) || 0; });
    });
  }
  const avg = total => ({
    pts: total.pts / games,
    fga: total.fga / games,
    fta: total.fta / games,
    threeA: total.threeA / games,
    fgPct: total.fgm / Math.max(1, total.fga),
  });
  return { interior: avg(totals[0]), perimeter: avg(totals[1]) };
}

const gamesPerOrder = 5000;
const first = runPair(interiorFirst, 0, 1, gamesPerOrder, 920000);
const swapped = runPair(perimeterFirst, 1, 0, gamesPerOrder, 940000);
function combine(a, b) {
  return Object.fromEntries(Object.keys(a).map(key => [key, (a[key] + b[key]) / 2]));
}
const combined = { interior: combine(first.interior, swapped.interior), perimeter: combine(first.perimeter, swapped.perimeter) };
const realPairTeam = makeRealPairTeam('V10_REAL_JOKIC_IRVING', 'P0120', 'P0105');
const realPairGames = 5000;
const realPairStats = runNamedPair(realPairTeam, realPairGames, 960000);
const realPairProfiles = ['P0120', 'P0105'].map(id => {
  const player = sourceById[id];
  const rating = SIM_CONFIG.getUnifiedPlayerRating(player, player.pos);
  return { id, name: player.cname, pos: player.pos, offense: rating.offense };
});
const realPairFgaRatio = realPairStats[0].fga / realPairStats[1].fga;
const realPairPtsRatio = realPairStats[0].pts / realPairStats[1].pts;
const fgaRatio = combined.interior.fga / combined.perimeter.fga;
const ptsRatio = combined.interior.pts / combined.perimeter.pts;
const orderInteriorFgaGap = Math.abs(first.interior.fga - swapped.interior.fga);
const orderPerimeterFgaGap = Math.abs(first.perimeter.fga - swapped.perimeter.fga);
const interiorRating = SIM_CONFIG.getUnifiedPlayerRating(pureInterior, 'C');
const perimeterRating = SIM_CONFIG.getUnifiedPlayerRating(purePerimeter, 'PG');

const report = {
  games: gamesPerOrder * 2,
  profileRatings: {
    interior: { offense: interiorRating.offense, scoringLoad: interiorRating.capacity.interiorUsageLoad, creation: interiorRating.skills.shotCreation },
    perimeter: { offense: perimeterRating.offense, scoringLoad: perimeterRating.capacity.perimeterUsageLoad, creation: perimeterRating.skills.shotCreation },
  },
  firstOrder: first,
  swappedOrder: swapped,
  combined,
  fgaRatio,
  ptsRatio,
  orderInteriorFgaGap,
  orderPerimeterFgaGap,
  realPair: {
    games: realPairGames,
    profiles: realPairProfiles,
    first: realPairStats[0],
    second: realPairStats[1],
    fgaRatio: realPairFgaRatio,
    ptsRatio: realPairPtsRatio,
  },
};

if (Math.abs(interiorRating.offense - perimeterRating.offense) > 1.5) {
  throw new Error(`双核心测试画像进攻档不够接近：${JSON.stringify(report.profileRatings)}`);
}
if (fgaRatio < 0.95 || fgaRatio > 1.05) {
  throw new Error(`同档内外双核心 FGA 仍不对称：${JSON.stringify(report)}`);
}
if (ptsRatio < 0.93 || ptsRatio > 1.07) {
  throw new Error(`同档内外双核心得分仍不对称：${JSON.stringify(report)}`);
}
if (orderInteriorFgaGap > 0.45 || orderPerimeterFgaGap > 0.45) {
  throw new Error(`双核心数组顺序仍影响使用率：${JSON.stringify(report)}`);
}
if (combined.interior.threeA > 1.0 || combined.perimeter.threeA < 8.0) {
  throw new Error(`修复破坏了内外线投篮风格：${JSON.stringify(report)}`);
}
if (Math.abs(realPairProfiles[0].offense - realPairProfiles[1].offense) > 1.0
  || realPairFgaRatio < 0.95 || realPairFgaRatio > 1.05
  || realPairPtsRatio < 0.93 || realPairPtsRatio > 1.07) {
  throw new Error(`现实同档内外双核心仍不对称：${JSON.stringify(report.realPair)}`);
}

console.log(JSON.stringify(report, null, 2));
