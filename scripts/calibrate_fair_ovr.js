const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = new Function(`${fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8')}\nreturn SIM_CONFIG;`)();
const league = new Function(`${fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8')}\nreturn LEAGUE_PLAYER_DATA;`)();
const players = Object.values(league).flat();
const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
const model = config.OVR_MODEL;

function attr(player, key) {
  const value = Number(player[key]);
  return Math.max(25, Math.min(99, Number.isFinite(value) ? value : 50));
}

function buildWeights(totalWeight, topFourWeight) {
  const result = {};
  positions.forEach((pos) => {
    const entries = Object.entries(model.positionWeights[pos]).sort((a, b) => b[1] - a[1]);
    const topKeys = new Set(entries.slice(0, 4).map(([key]) => key));
    const oldTop = entries.filter(([key]) => topKeys.has(key)).reduce((sum, [, value]) => sum + value, 0);
    const oldRest = entries.filter(([key]) => !topKeys.has(key)).reduce((sum, [, value]) => sum + value, 0);
    result[pos] = Object.fromEntries(entries.map(([key, value]) => [
      key,
      value * (topKeys.has(key) ? topFourWeight / oldTop : (totalWeight - topFourWeight) / oldRest),
    ]));
  });
  return result;
}

function calculate(player, pos, weights, offset) {
  const validPositions = String(pos || 'SG').split('/').map((value) => value.trim()).filter((value) => weights[value]).slice(0, 2);
  const positionScore = (position) => Object.entries(weights[position]).reduce(
    (sum, [key, weight]) => sum + (attr(player, key) - 25) * weight,
    offset,
  );
  let score = positionScore(validPositions[0] || 'SG');
  if (validPositions[1]) score = score * 0.8 + positionScore(validPositions[1]) * 0.2;
  const values = config.ATTR_LIST.map((key) => attr(player, key)).sort((a, b) => b - a);
  const bonus = model.bonuses;
  const scoringBreadth = Math.min(Math.max(attr(player, 'threePT'), attr(player, 'MID')), attr(player, 'FIN'));
  const topFourAverage = values.slice(0, 4).reduce((sum, value) => sum + value, 0) / 4;
  const eliteExcess = values.reduce((sum, value) => sum + Math.max(0, value - bonus.eliteThreshold), 0);
  return Math.max(40, Math.min(99, Math.round(model.base + score
    + scoringBreadth * bonus.scoringBreadth
    + topFourAverage * bonus.topFourAverage
    + eliteExcess * bonus.eliteExcess)));
}

const baseBonusAt50 = 50 * model.bonuses.scoringBreadth + 50 * model.bonuses.topFourAverage;
const candidates = [];
for (let total = 0.75; total <= 1.25; total += 0.025) {
  for (let topFour = 0.5; topFour <= Math.min(0.75, total - 0.1); topFour += 0.025) {
    const weights = buildWeights(total, topFour);
    const offset = 50 - model.base - baseBonusAt50 - 25 * total;
    const errors = players.map((player) => calculate(player, player.pos, weights, offset) - player.ovr);
    const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length;
    const withinThree = errors.filter((error) => Math.abs(error) <= 3).length;
    const large = errors.filter((error) => Math.abs(error) >= 5).length;
    const sampleOvrs = {};
    positions.forEach((pos) => {
      const core = Object.entries(weights[pos]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key]) => key);
      const sample = Object.fromEntries(config.ATTR_LIST.map((key) => [key, 50]));
      core.forEach((key, index) => { sample[key] = index === 3 ? 92 : 99; });
      sampleOvrs[pos] = calculate(sample, pos, weights, offset);
    });
    const fairnessGap = Math.max(...Object.values(sampleOvrs)) - Math.min(...Object.values(sampleOvrs));
    candidates.push({
      total: Number(total.toFixed(3)),
      topFour: Number(topFour.toFixed(3)),
      offset: Number(offset.toFixed(6)),
      mae: Number(mae.toFixed(3)),
      withinThree,
      large,
      fairnessGap,
      sampleOvrs,
    });
  }
}
candidates.sort((a, b) => Number(a.fairnessGap > 2) - Number(b.fairnessGap > 2)
  || Math.abs(a.sampleOvrs.SG - 90) - Math.abs(b.sampleOvrs.SG - 90)
  || a.mae - b.mae
  || a.fairnessGap - b.fairnessGap
  || b.withinThree - a.withinThree);
console.log(JSON.stringify(candidates.slice(0, 30), null, 2));
