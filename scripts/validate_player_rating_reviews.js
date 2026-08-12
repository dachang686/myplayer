const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const reviewPath = path.join(__dirname, 'data', 'player_rating_reviews.json');
const ovrAdjustmentPath = path.join(__dirname, 'data', 'player_ovr_adjustments.json');
const identityPath = path.join(__dirname, 'data', 'nba2k_player_identity.json');
const attributes = [
  'ovr', 'threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS',
  'PDEF', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU',
];

function parseLeague(source) {
  return new Function(`${source}\nreturn LEAGUE_PLAYER_DATA;`)();
}

function loadLeague() {
  return parseLeague(fs.readFileSync(leaguePath, 'utf8'));
}

const errors = [];

function fail(message) {
  errors.push(message);
}

const league = loadLeague();
const baselineLeague = parseLeague(execFileSync(
  'git', ['show', 'HEAD:js/data/league_players.js'], { cwd: root, encoding: 'utf8' },
));
const baselinePlayersById = new Map(
  Object.values(baselineLeague).flat().map(player => [player.id, player]),
);
const reviewData = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const ovrAdjustmentData = JSON.parse(fs.readFileSync(ovrAdjustmentPath, 'utf8'));
const identities = JSON.parse(fs.readFileSync(identityPath, 'utf8')).players || [];
const identityById = new Map(identities.map(identity => [identity.localId, identity]));
const reviews = reviewData.players || [];
const ovrAdjustments = ovrAdjustmentData.players || [];
const ovrAdjustmentById = new Map();
for (const adjustment of ovrAdjustments) {
  if (ovrAdjustmentById.has(adjustment.localId)) fail(`duplicate OVR adjustment: ${adjustment.localId}`);
  if (!adjustment.reason) fail(`missing OVR adjustment reason: ${adjustment.localId}`);
  ovrAdjustmentById.set(adjustment.localId, adjustment);
}
const playersById = new Map();

for (const [team, players] of Object.entries(league)) {
  for (const player of players) {
    if (playersById.has(player.id)) fail(`duplicate league id: ${player.id}`);
    const identity = identityById.get(player.id);
    if (!identity) fail(`missing backup identity: ${player.id}`);
    if (Object.hasOwn(player, 'name') || Object.hasOwn(player, 'nameEN')) {
      fail(`${player.id} still contains temporary English name`);
    }
    playersById.set(player.id, { team, player });
  }
}

const reviewedIds = new Set();
for (let index = 0; index < reviews.length; index++) {
  const review = reviews[index];
  const expectedId = `P${String(index + 1).padStart(4, '0')}`;
  if (review.localId !== expectedId) {
    fail(`review sequence mismatch at ${index}: expected ${expectedId}, got ${review.localId}`);
  }
  if (reviewedIds.has(review.localId)) fail(`duplicate review: ${review.localId}`);
  reviewedIds.add(review.localId);

  const leagueEntry = playersById.get(review.localId);
  if (!leagueEntry) {
    fail(`missing league player: ${review.localId}`);
    continue;
  }
  if (leagueEntry.team !== review.team) {
    fail(`${review.localId} team mismatch: ${leagueEntry.team} != ${review.team}`);
  }

  const changed = review.changes || {};
  const unchanged = review.unchanged || {};
  for (const attribute of attributes) {
    const hasChange = Object.hasOwn(changed, attribute);
    const hasUnchanged = Object.hasOwn(unchanged, attribute);
    if (hasChange === hasUnchanged) {
      fail(`${review.localId} must record ${attribute} exactly once`);
    }
    const reviewedValue = hasChange ? changed[attribute][1] : unchanged[attribute];
    const adjustment = ovrAdjustmentById.get(review.localId);
    const adjustmentTuple = adjustment && adjustment.changes && adjustment.changes[attribute];
    if (adjustmentTuple && (!Array.isArray(adjustmentTuple) || adjustmentTuple.length !== 2 || adjustmentTuple[0] !== reviewedValue)) {
      fail(`${review.localId} invalid OVR adjustment tuple: ${attribute}`);
    }
    const expected = adjustmentTuple ? adjustmentTuple[1] : reviewedValue;
    if (leagueEntry.player[attribute] !== expected) {
      fail(`${review.localId} ${attribute}: league=${leagueEntry.player[attribute]}, review=${expected}`);
    }
  }

  for (const attribute of Object.keys(changed)) {
    if (!attributes.includes(attribute)) fail(`${review.localId} unknown changed field: ${attribute}`);
    if (!Array.isArray(changed[attribute]) || changed[attribute].length !== 2) {
      fail(`${review.localId} invalid change tuple: ${attribute}`);
    }
  }
  for (const attribute of Object.keys(unchanged)) {
    if (!attributes.includes(attribute)) fail(`${review.localId} unknown unchanged field: ${attribute}`);
  }
}

for (const adjustment of ovrAdjustments) {
  if (!reviewedIds.has(adjustment.localId)) fail(`OVR adjustment has no player review: ${adjustment.localId}`);
  for (const attribute of Object.keys(adjustment.changes || {})) {
    if ((!attributes.includes(attribute) && attribute !== 'pos') || attribute === 'ovr') {
      fail(`${adjustment.localId} invalid OVR-adjusted field: ${attribute}`);
    }
  }
  const positionTuple = adjustment.changes && adjustment.changes.pos;
  if (positionTuple) {
    const baselinePlayer = baselinePlayersById.get(adjustment.localId);
    const leaguePlayer = playersById.get(adjustment.localId)?.player;
    if (!Array.isArray(positionTuple) || positionTuple.length !== 2
      || baselinePlayer?.pos !== positionTuple[0] || leaguePlayer?.pos !== positionTuple[1]) {
      fail(`${adjustment.localId} invalid OVR adjustment tuple: pos`);
    }
  }
}

for (const [team, players] of Object.entries(league)) {
  const baselineById = new Map((baselineLeague[team] || []).map(player => [player.id, player]));
  for (const player of players) {
    if (reviewedIds.has(player.id)) continue;
    const baseline = baselineById.get(player.id);
    if (!baseline) {
      fail(`unreviewed player missing from baseline: ${player.id}`);
      continue;
    }
    const { name: baselineTemporaryName, ...baselineWithoutName } = baseline;
    if (JSON.stringify(player) !== JSON.stringify(baselineWithoutName)) {
      fail(`unreviewed player changed: ${player.id}`);
    }
  }
}

const result = {
  leaguePlayers: playersById.size,
  reviewedPlayers: reviews.length,
  ovrAdjustedPlayers: ovrAdjustments.length,
  lastReviewedId: reviews.at(-1)?.localId || null,
  validationErrors: errors.length,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
