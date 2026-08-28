const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v2Source = fs.readFileSync(path.join(root, 'js/simulation_v2.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');

const SIM_CONFIG = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const sourceLeague = new Function(`${leagueSource}\nreturn LEAGUE_PLAYER_DATA;`)();
const sourcePlayers = Object.values(sourceLeague).flat();
const byId = Object.fromEntries(sourcePlayers.map(player => [player.id, player]));

function clonePlayer(id, prefix) {
  const source = byId[id];
  if (!source) throw new Error(`缺少测试球员 ${id}`);
  const player = JSON.parse(JSON.stringify(source));
  player.id = `${prefix}-${id}`;
  player.cname = `${prefix}-${player.cname}`;
  player.ovr = Math.round(SIM_CONFIG.getUnifiedPlayerRating(player, player.pos).overall);
  player._age = 27;
  return player;
}

// A：真实属性轮廓的 99 + 99 + 93 三核心；B：六名 86-89 的均衡深度强队。
const eliteIds = ['P0347', 'P0471', 'P0264', 'P0323', 'P0285', 'P0522', 'P0255', 'P0231', 'P0180', 'P0018'];
const balancedIds = ['P0418', 'P0296', 'P0349', 'P0092', 'P0265', 'P0041', 'P0019', 'P0402', 'P0191', 'P0039'];
const LEAGUE_PLAYER_DATA = {
  ELITE: eliteIds.map(id => clonePlayer(id, 'ELITE')),
  BALANCED: balancedIds.map(id => clonePlayer(id, 'BALANCED')),
};

const STATE = {
  careerTeam: null,
  finalOVR: 0,
  position: null,
  attrs: {},
  season: {
    schedule: [],
    standings: {
      ELITE: { wins: 60, losses: 22 },
      BALANCED: { wins: 48, losses: 34 },
    },
    isPlayoffs: true,
    _npcSeasonProfiles: {},
    events: { activeEffects: [] },
  },
};
const attrFactor = value => {
  const bounded = Math.max(25, Math.min(99, value || 50));
  return Math.pow((bounded - 25) / 74, 0.85);
};
const af = value => Math.pow(attrFactor(value), 1.5);
const ensureSeasonEventState = () => STATE.season.events || (STATE.season.events = { activeEffects: [] });

const engineStart = indexSource.indexOf('function getPlayerPositions');
const engineEnd = indexSource.indexOf('/** 属性→效率系数：递减曲线', engineStart);
if (engineStart < 0 || engineEnd < 0) throw new Error('无法提取比赛引擎');
const runtime = new Function(
  'LEAGUE_PLAYER_DATA', 'SIM_CONFIG', 'STATE', 'getMyPlayerDisplayName', 'getTeamName',
  'getLeaguePlayerAge', 'af', 'ensureSeasonEventState',
  `${indexSource.slice(engineStart, engineEnd)}\n${v2Source}\nreturn {
    simulate: globalThis.simulateGameAggregateV2,
    expectedRotation: buildExpectedLeagueGameRotation,
    lineup: calcTeamLineup
  };`,
)(
  LEAGUE_PLAYER_DATA,
  SIM_CONFIG,
  STATE,
  () => '专项回归球员',
  team => team,
  player => Number(player && player._age) || 27,
  af,
  ensureSeasonEventState,
);

function withSeed(seed, callback) {
  const originalRandom = Math.random;
  let state = seed >>> 0;
  Math.random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

function seriesWinProbability(gameProbabilities) {
  let states = { '0,0': 1 };
  for (const probability of gameProbabilities) {
    const next = {};
    for (const [key, mass] of Object.entries(states)) {
      const [winsA, winsB] = key.split(',').map(Number);
      if (winsA === 4 || winsB === 4) {
        next[key] = (next[key] || 0) + mass;
        continue;
      }
      const winKey = `${winsA + 1},${winsB}`;
      const lossKey = `${winsA},${winsB + 1}`;
      next[winKey] = (next[winKey] || 0) + mass * probability;
      next[lossKey] = (next[lossKey] || 0) + mass * (1 - probability);
    }
    states = next;
  }
  return Object.entries(states).reduce((sum, [key, mass]) => sum + (Number(key.split(',')[0]) === 4 ? mass : 0), 0);
}

const failures = [];
const eliteRatings = LEAGUE_PLAYER_DATA.ELITE.map(player => ({
  id: player.id,
  name: player.cname,
  ovr: player.ovr,
  rotationValue: SIM_CONFIG.getUnifiedPlayerRating(player, player.pos).rotationValue,
})).sort((left, right) => right.ovr - left.ovr);
const coreOvrs = eliteRatings.slice(0, 3).map(row => row.ovr).sort((a, b) => b - a);
if (coreOvrs[0] !== 99 || coreOvrs[1] !== 99 || coreOvrs[2] !== 93) {
  failures.push(`真实三核心评级不是 99/99/93：${coreOvrs.join('/')}`);
}

const playoffRotation = runtime.expectedRotation('ELITE', { isPlayoffs: true, ignoreNpcAvailability: true });
const regularRotation = runtime.expectedRotation('ELITE', { isPlayoffs: false, ignoreNpcAvailability: true });
const coreOriginalIds = new Set(['P0347', 'P0471', 'P0264']);
function coreMinutes(rotation) {
  return rotation.players.reduce((sum, player, index) => {
    const originalId = String(player.id).split('-').slice(-1)[0];
    return sum + (coreOriginalIds.has(originalId) ? rotation.minutes[index] : 0);
  }, 0);
}
const playoffCoreMinutes = coreMinutes(playoffRotation);
const regularCoreMinutes = coreMinutes(regularRotation);
if (playoffRotation.players.length !== 9 || regularRotation.players.length !== 10) {
  failures.push(`预计轮换人数异常：季后赛 ${playoffRotation.players.length}，常规赛 ${regularRotation.players.length}`);
}
if (playoffRotation.minutes.reduce((sum, value) => sum + value, 0) !== 240
  || regularRotation.minutes.reduce((sum, value) => sum + value, 0) !== 240) {
  failures.push('预计轮换分钟未守恒为 240');
}
if (playoffCoreMinutes < 114 || playoffCoreMinutes < regularCoreMinutes + 8) {
  failures.push(`三核心季后赛负荷不足：${regularCoreMinutes} → ${playoffCoreMinutes}`);
}

const homePattern = [true, true, false, false, true, false, true];
const samplesPerGame = 32;
const gameProbabilities = [];
let expectedMarginTotal = 0;
let actualRotationSamples = 0;
let eightPlayerRotations = 0;
let minRotationSize = Infinity;
let maxRotationSize = 0;
let hiddenStarBonusViolations = 0;

for (let game = 0; game < homePattern.length; game++) {
  let probabilityTotal = 0;
  let marginTotal = 0;
  for (let sample = 0; sample < samplesPerGame; sample++) {
    STATE.season._npcSeasonProfiles = {};
    const result = withSeed(2026082800 + game * 1000 + sample, () => runtime.simulate(
      'ELITE', 'BALANCED', 0, null, {
        isHomeA: homePattern[game],
        isB2BA: false,
        isB2BB: false,
        ignoreNpcAvailability: true,
        isPlayoffs: true,
        commitSimulationState: false,
      },
    ));
    probabilityTotal += result.estimatedWinProb;
    marginTotal += result.expectedMargin;
    const rotationSize = result.teamA.power.rotationMinutes.length;
    actualRotationSamples++;
    if (rotationSize === 8) eightPlayerRotations++;
    minRotationSize = Math.min(minRotationSize, rotationSize);
    maxRotationSize = Math.max(maxRotationSize, rotationSize);
    if (Number(result.marginComponents.starEdge) !== 0
      || Number(result.marginComponents.eliteSkillMarginEdge) !== 0) {
      hiddenStarBonusViolations++;
    }
  }
  gameProbabilities.push(probabilityTotal / samplesPerGame);
  expectedMarginTotal += marginTotal / samplesPerGame;
}

const seriesProbability = seriesWinProbability(gameProbabilities);
const averageExpectedMargin = expectedMarginTotal / homePattern.length;
const eightPlayerShare = eightPlayerRotations / Math.max(1, actualRotationSamples);
if (seriesProbability < 0.65 || seriesProbability > 0.90) {
  failures.push(`三核心系列赛晋级率异常：${seriesProbability}`);
}
if (averageExpectedMargin < 2.5) failures.push(`三核心平均预期分差不足：${averageExpectedMargin}`);
if (minRotationSize !== 8 || maxRotationSize !== 9 || eightPlayerShare < 0.65 || eightPlayerShare > 0.90) {
  failures.push(`实际季后赛轮换分布异常：${minRotationSize}-${maxRotationSize}，8人占比 ${eightPlayerShare}`);
}
if (hiddenStarBonusViolations) failures.push(`发现 ${hiddenStarBonusViolations} 次隐藏球星加成`);

const report = {
  coreOvrs,
  expectedRotation: {
    regularPlayers: regularRotation.players.length,
    playoffPlayers: playoffRotation.players.length,
    regularCoreMinutes,
    playoffCoreMinutes,
    playoffMinutes: playoffRotation.players.map((player, index) => ({ name: player.cname, ovr: player.ovr, min: playoffRotation.minutes[index] })),
  },
  matchup: {
    samplesPerGame,
    gameProbabilities,
    averageExpectedMargin,
    seriesWinProbability: seriesProbability,
  },
  actualRotation: {
    samples: actualRotationSamples,
    minPlayers: minRotationSize,
    maxPlayers: maxRotationSize,
    eightPlayerShare,
  },
  hiddenStarBonusViolations,
  failures,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
