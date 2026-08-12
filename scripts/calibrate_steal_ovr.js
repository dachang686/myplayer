const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = new Function(`${fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8')}\nreturn SIM_CONFIG;`)();
const league = new Function(`${fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8')}\nreturn LEAGUE_PLAYER_DATA;`)();
const players = Object.values(league).flat();
const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
const current = config.OVR_MODEL;
const oldOffsets = {};
positions.forEach((pos) => {
  oldOffsets[pos] = current.positionOffsets[pos]
    + current.positionWeights[pos].STL * (config.POS_AVG[pos].STL - 25);
});

function clampAttribute(player, key) {
  const value = Number(player[key]);
  return Math.max(25, Math.min(99, Number.isFinite(value) ? value : 50));
}

function calculate(player, share, baseDelta, bonusIncludesSteal) {
  const playerPositions = String(player.pos || 'SG').split('/').map((value) => value.trim()).filter((value) => positions.includes(value)).slice(0, 2);
  const scorePosition = (pos) => {
    const oldPdefWeight = current.positionWeights[pos].PDEF;
    const stlWeight = oldPdefWeight * share;
    const weights = { ...current.positionWeights[pos], PDEF: oldPdefWeight - stlWeight, STL: stlWeight };
    const offset = oldOffsets[pos] + stlWeight * (config.POS_AVG[pos].PDEF - config.POS_AVG[pos].STL);
    return Object.entries(weights).reduce((sum, [key, weight]) => sum + (clampAttribute(player, key) - 25) * weight, offset);
  };
  let positionScore = scorePosition(playerPositions[0] || 'SG');
  if (playerPositions[1]) positionScore = positionScore * 0.8 + scorePosition(playerPositions[1]) * 0.2;
  const bonusKeys = config.ATTR_LIST.filter((key) => bonusIncludesSteal || key !== 'STL');
  const values = bonusKeys.map((key) => clampAttribute(player, key)).sort((a, b) => b - a);
  const bonuses = current.bonuses;
  const scoringBreadth = Math.min(Math.max(clampAttribute(player, 'threePT'), clampAttribute(player, 'MID')), clampAttribute(player, 'FIN'));
  const topFourAverage = values.slice(0, 4).reduce((sum, value) => sum + value, 0) / 4;
  const eliteExcess = values.reduce((sum, value) => sum + Math.max(0, value - bonuses.eliteThreshold), 0);
  const raw = current.base + baseDelta + positionScore
    + scoringBreadth * bonuses.scoringBreadth
    + topFourAverage * bonuses.topFourAverage
    + eliteExcess * bonuses.eliteExcess;
  return Math.max(40, Math.min(99, Math.round(raw)));
}

const candidates = [];
for (const bonusIncludesSteal of [false, true]) {
  for (let share = 0.1; share <= 0.5; share += 0.025) {
    for (let baseDelta = -0.8; baseDelta <= 0.8; baseDelta += 0.05) {
      const errors = players.map((player) => calculate(player, share, baseDelta, bonusIncludesSteal) - player.ovr);
      const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length;
      const withinThree = errors.filter((error) => Math.abs(error) <= 3).length;
      const large = errors.filter((error) => Math.abs(error) >= 5).length;
      const drift = errors.reduce((sum, error) => sum + error, 0) / errors.length;
      candidates.push({ bonusIncludesSteal, share: Number(share.toFixed(3)), baseDelta: Number(baseDelta.toFixed(2)), mae, withinThree, large, drift });
    }
  }
}

candidates.sort((a, b) => a.large - b.large
  || b.withinThree - a.withinThree
  || a.mae - b.mae
  || Math.abs(a.drift) - Math.abs(b.drift));
console.log(JSON.stringify(candidates.slice(0, 20), null, 2));
