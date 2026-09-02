const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = require(path.join(root, 'js', 'data', 'simulation_config.js'));
const league = new Function(
  `${fs.readFileSync(path.join(root, 'js', 'data', 'league_players.js'), 'utf8')}\nreturn LEAGUE_PLAYER_DATA;`,
)();

const ATTRIBUTES = config.ATTR_LIST.slice();
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const ITERATIONS = Math.max(1000, Number(process.argv[2]) || 30000);
const L2 = 0.0008;
const L1 = 0.003;
const HIGH_END_TARGET_WEIGHT = 0.35;

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function attr(player, key) {
  return clamp(Number(player[key]) || 50, 25, 99);
}

function baseFeatureVector(player) {
  const values = Object.fromEntries(ATTRIBUTES.map(key => [key, attr(player, key)]));
  const features = [];

  // Every raw attribute has a non-negative coefficient, so raising a visible
  // attribute cannot reduce OVR. The 50 baseline remains exactly 50.
  ATTRIBUTES.forEach(key => features.push((values[key] - 50) / 49));
  return features;
}

const featureNames = ATTRIBUTES.map(key => `linear:${key}`);

function positionMultipliers(player) {
  const listed = String(player.pos || 'SF').split('/').map(value => value.trim()).filter(value => POSITIONS.includes(value));
  const primary = listed[0] || 'SF';
  const secondary = listed[1];
  return POSITIONS.map(position => {
    if (position === primary) return secondary ? 0.8 : 1;
    return position === secondary ? 0.2 : 0;
  });
}

function featureVector(player) {
  const base = baseFeatureVector(player);
  return positionMultipliers(player).flatMap(multiplier => base.map(value => value * multiplier));
}

const expandedFeatureNames = POSITIONS.flatMap(position => featureNames.map(name => `${position}:${name}`));

function hashId(id) {
  return String(id).split('').reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7);
}

const rows = Object.values(league).flat().map(player => ({
  id: player.id,
  target: Number(player.ovr),
  features: featureVector(player),
}));
const trainRows = rows.filter(row => hashId(row.id) % 5 !== 0);
const testRows = rows.filter(row => hashId(row.id) % 5 === 0);

function predict(features, weights) {
  const raw = 50 + features.reduce((sum, feature, index) => sum + feature * weights[index], 0);
  return clamp(raw, 25, 99);
}

function fit(samples) {
  const weights = new Array(expandedFeatureNames.length).fill(0.5);
  const first = new Array(expandedFeatureNames.length).fill(0);
  const second = new Array(expandedFeatureNames.length).fill(0);

  for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
    const gradient = new Array(weights.length).fill(0);
    samples.forEach(row => {
      const error = predict(row.features, weights) - row.target;
      const targetWeight = 1 + Math.max(0, row.target - 90) * HIGH_END_TARGET_WEIGHT;
      row.features.forEach((feature, index) => {
        gradient[index] += error * feature * targetWeight * 2 / samples.length;
      });
    });
    weights.forEach((weight, index) => {
      gradient[index] += 2 * L2 * weight + (weight > 0 ? L1 : 0);
      first[index] = first[index] * 0.9 + gradient[index] * 0.1;
      second[index] = second[index] * 0.999 + gradient[index] * gradient[index] * 0.001;
      const correctedFirst = first[index] / (1 - Math.pow(0.9, iteration));
      const correctedSecond = second[index] / (1 - Math.pow(0.999, iteration));
      weights[index] = Math.max(0, weight - 0.015 * correctedFirst / (Math.sqrt(correctedSecond) + 1e-8));
    });
  }
  return weights;
}

function metrics(samples, weights) {
  const residuals = samples.map(row => ({
    id: row.id,
    target: row.target,
    predicted: Math.round(predict(row.features, weights)),
  })).map(row => ({ ...row, error: row.predicted - row.target }));
  return {
    count: residuals.length,
    meanAbsoluteError: Number((residuals.reduce((sum, row) => sum + Math.abs(row.error), 0) / residuals.length).toFixed(3)),
    withinThree: residuals.filter(row => Math.abs(row.error) <= 3).length,
    overFive: residuals.filter(row => Math.abs(row.error) > 5).length,
    largest: residuals.sort((left, right) => Math.abs(right.error) - Math.abs(left.error)).slice(0, 12),
  };
}

const holdoutWeights = fit(trainRows);
const fullWeights = fit(rows);
const fittedRoster = Object.values(league).flat().map(player => ({
  id: player.id,
  name: player.cname,
  sourceOvr: Number(player.ovr),
  formulaOvr: Math.round(predict(featureVector(player), fullWeights)),
}));
const output = {
  inputs: ATTRIBUTES,
  iterations: ITERATIONS,
  highEndTargetWeight: HIGH_END_TARGET_WEIGHT,
  train: metrics(trainRows, holdoutWeights),
  holdout: metrics(testRows, holdoutWeights),
  fullRoster: metrics(rows, fullWeights),
  distribution: {
    at99: fittedRoster.filter(row => row.formulaOvr === 99).length,
    atLeast97: fittedRoster.filter(row => row.formulaOvr >= 97).length,
  },
  focus: fittedRoster.filter(row => ['P0120', 'P0172', 'P0225', 'P0264', 'P0347', 'P0452', 'P0509'].includes(row.id)),
  nonZeroWeights: expandedFeatureNames.map((name, index) => ({ name, value: Number(fullWeights[index].toFixed(6)) }))
    .filter(row => row.value > 0.0001),
};
console.log(JSON.stringify(output, null, 2));
