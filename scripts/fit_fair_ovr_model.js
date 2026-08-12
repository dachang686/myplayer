const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = new Function(`${fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8')}\nreturn SIM_CONFIG;`)();
const league = new Function(`${fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8')}\nreturn LEAGUE_PLAYER_DATA;`)();
const players = Object.values(league).flat();
const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
const attributes = config.ATTR_LIST;
const model = config.OVR_MODEL;
const TOTAL_WEIGHT = 1.1;
const TOP_FOUR_WEIGHT = 0.65;
const REST_WEIGHT = TOTAL_WEIGHT - TOP_FOUR_WEIGHT;
const iterations = Number(process.argv[2]) || 12000;

function attr(player, key) {
  const value = Number(player[key]);
  return Math.max(25, Math.min(99, Number.isFinite(value) ? value : 50));
}

function boundedSimplex(values, target, lower, upper) {
  let low = Math.min(...values.map((value) => value - upper));
  let high = Math.max(...values.map((value) => value - lower));
  for (let step = 0; step < 80; step++) {
    const lambda = (low + high) / 2;
    const sum = values.reduce((total, value) => total + Math.max(lower, Math.min(upper, value - lambda)), 0);
    if (sum > target) low = lambda;
    else high = lambda;
  }
  const lambda = (low + high) / 2;
  return values.map((value) => Math.max(lower, Math.min(upper, value - lambda)));
}

const coreKeys = {};
const initial = {};
const weights = {};
const firstMoment = {};
const secondMoment = {};
positions.forEach((pos) => {
  const entries = Object.entries(model.positionWeights[pos]).sort((a, b) => b[1] - a[1]);
  coreKeys[pos] = entries.slice(0, 4).map(([key]) => key);
  const coreSet = new Set(coreKeys[pos]);
  const oldCore = entries.filter(([key]) => coreSet.has(key)).reduce((sum, [, value]) => sum + value, 0);
  const oldRest = entries.filter(([key]) => !coreSet.has(key)).reduce((sum, [, value]) => sum + value, 0);
  weights[pos] = {};
  initial[pos] = {};
  firstMoment[pos] = {};
  secondMoment[pos] = {};
  entries.forEach(([key, value]) => {
    const scaled = value * (coreSet.has(key) ? TOP_FOUR_WEIGHT / oldCore : REST_WEIGHT / oldRest);
    weights[pos][key] = scaled;
    initial[pos][key] = scaled;
    firstMoment[pos][key] = 0;
    secondMoment[pos][key] = 0;
  });
});

const baseBonusAt50 = 50 * model.bonuses.scoringBreadth + 50 * model.bonuses.topFourAverage;
const commonOffset = 50 - model.base - baseBonusAt50 - 25 * TOTAL_WEIGHT;

function bonusValue(player) {
  const values = attributes.map((key) => attr(player, key)).sort((a, b) => b - a);
  const bonus = model.bonuses;
  const scoringBreadth = Math.min(Math.max(attr(player, 'threePT'), attr(player, 'MID')), attr(player, 'FIN'));
  const topFourAverage = values.slice(0, 4).reduce((sum, value) => sum + value, 0) / 4;
  const eliteExcess = values.reduce((sum, value) => sum + Math.max(0, value - bonus.eliteThreshold), 0);
  return scoringBreadth * bonus.scoringBreadth
    + topFourAverage * bonus.topFourAverage
    + eliteExcess * bonus.eliteExcess;
}

const rows = players.map((player) => {
  const playerPositions = String(player.pos || 'SG').split('/').map((value) => value.trim()).filter((value) => positions.includes(value)).slice(0, 2);
  const multipliers = { [playerPositions[0] || 'SG']: playerPositions[1] ? 0.8 : 1 };
  if (playerPositions[1]) multipliers[playerPositions[1]] = 0.2;
  return {
    player,
    multipliers,
    target: player.ovr - model.base - commonOffset - bonusValue(player),
  };
});

function rawPositionScore(row) {
  let score = 0;
  Object.entries(row.multipliers).forEach(([pos, multiplier]) => {
    attributes.forEach((key) => { score += multiplier * (attr(row.player, key) - 25) * weights[pos][key]; });
  });
  return score;
}

function projectPosition(pos) {
  const coreSet = new Set(coreKeys[pos]);
  const core = coreKeys[pos];
  const rest = attributes.filter((key) => !coreSet.has(key));
  const projectedCore = boundedSimplex(core.map((key) => weights[pos][key]), TOP_FOUR_WEIGHT, 0.08, 0.3);
  const projectedRest = boundedSimplex(rest.map((key) => weights[pos][key]), REST_WEIGHT, 0.001, 0.08);
  core.forEach((key, index) => { weights[pos][key] = projectedCore[index]; });
  rest.forEach((key, index) => { weights[pos][key] = projectedRest[index]; });
}

for (let iteration = 1; iteration <= iterations; iteration++) {
  const gradients = Object.fromEntries(positions.map((pos) => [pos, Object.fromEntries(attributes.map((key) => [key, 0]))]));
  rows.forEach((row) => {
    const error = rawPositionScore(row) - row.target;
    Object.entries(row.multipliers).forEach(([pos, multiplier]) => {
      attributes.forEach((key) => { gradients[pos][key] += 2 * error * multiplier * (attr(row.player, key) - 25) / rows.length; });
    });
  });
  positions.forEach((pos) => {
    attributes.forEach((key) => {
      gradients[pos][key] += 2 * (weights[pos][key] - initial[pos][key]) * 2;
      firstMoment[pos][key] = firstMoment[pos][key] * 0.9 + gradients[pos][key] * 0.1;
      secondMoment[pos][key] = secondMoment[pos][key] * 0.999 + gradients[pos][key] ** 2 * 0.001;
      const correctedFirst = firstMoment[pos][key] / (1 - 0.9 ** iteration);
      const correctedSecond = secondMoment[pos][key] / (1 - 0.999 ** iteration);
      weights[pos][key] -= 0.002 * correctedFirst / (Math.sqrt(correctedSecond) + 1e-8);
    });
    projectPosition(pos);
  });
}

function calculate(player, pos) {
  const playerPositions = String(pos || 'SG').split('/').map((value) => value.trim()).filter((value) => positions.includes(value)).slice(0, 2);
  const scorePosition = (position) => attributes.reduce((sum, key) => sum + (attr(player, key) - 25) * weights[position][key], commonOffset);
  let score = scorePosition(playerPositions[0] || 'SG');
  if (playerPositions[1]) score = score * 0.8 + scorePosition(playerPositions[1]) * 0.2;
  return Math.max(40, Math.min(99, Math.round(model.base + score + bonusValue(player))));
}

const residuals = players.map((player) => ({
  id: player.id,
  name: player.cname,
  pos: player.pos,
  sourceOvr: player.ovr,
  formulaOvr: calculate(player, player.pos),
})).map((row) => ({ ...row, error: row.formulaOvr - row.sourceOvr }));
const sampleOvrs = {};
positions.forEach((pos) => {
  const sample = Object.fromEntries(attributes.map((key) => [key, 50]));
  coreKeys[pos].forEach((key, index) => { sample[key] = index === 3 ? 92 : 99; });
  sampleOvrs[pos] = calculate(sample, pos);
});
const result = {
  iterations,
  totalWeight: TOTAL_WEIGHT,
  topFourWeight: TOP_FOUR_WEIGHT,
  commonOffset,
  coreKeys,
  weights,
  metrics: {
    meanAbsoluteError: residuals.reduce((sum, row) => sum + Math.abs(row.error), 0) / residuals.length,
    withinThree: residuals.filter((row) => Math.abs(row.error) <= 3).length,
    largeResiduals: residuals.filter((row) => Math.abs(row.error) >= 5).length,
    sampleOvrs,
    fairnessGap: Math.max(...Object.values(sampleOvrs)) - Math.min(...Object.values(sampleOvrs)),
  },
  largestResiduals: residuals.sort((a, b) => Math.abs(b.error) - Math.abs(a.error)).slice(0, 30),
};
console.log(JSON.stringify(result, null, 2));
