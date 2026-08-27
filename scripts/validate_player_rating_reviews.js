const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const reviewPath = path.join(__dirname, 'data', 'player_rating_reviews.json');
const identityPath = path.join(__dirname, 'data', 'nba2k_player_identity.json');
const transferPath = path.join(__dirname, 'data', 'real_world_team_transfers_2026.json');
const queuePath = path.join(__dirname, 'data', 'player_rating_review_queue.json');
const latestOverridePath = path.join(__dirname, 'data', 'nba2k27_latest_player_overrides.json');
const { buildExpectedValues } = require('./restore_reviewed_league_attributes.js');
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
const reviewData = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const identities = JSON.parse(fs.readFileSync(identityPath, 'utf8')).players || [];
const transfers = JSON.parse(fs.readFileSync(transferPath, 'utf8')).transfers || [];
const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')).players || [];
const latestOverrides = JSON.parse(fs.readFileSync(latestOverridePath, 'utf8')).players || [];
const identityById = new Map(identities.map(identity => [identity.localId, identity]));
const transferById = new Map(transfers.map(transfer => [transfer.localId, transfer]));
const queueById = new Map(queue.map(row => [row.localId, row]));
const latestOverrideById = new Map(latestOverrides.map(row => [row.localId, row]));
const reviews = reviewData.players || [];
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
let sourceCheckedFields = 0;
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
  const transfer = transferById.get(review.localId);
  const expectedTeam = transfer && review.team === transfer.from ? transfer.to : review.team;
  if (leagueEntry.team !== expectedTeam) {
    fail(`${review.localId} team mismatch: ${leagueEntry.team} != ${expectedTeam}`);
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
    if (!Number.isFinite(Number(reviewedValue))) fail(`${review.localId} invalid reviewed value: ${attribute}`);
  }

  const queueRow = queueById.get(review.localId);
  if (!queueRow) {
    fail(`${review.localId} missing current review queue entry`);
  } else {
    const expectedValues = buildExpectedValues(queueRow, latestOverrideById.get(review.localId));
    for (const [attribute, expected] of Object.entries(expectedValues)) {
      sourceCheckedFields++;
      if (Number(leagueEntry.player[attribute]) !== Number(expected)) {
        fail(`${review.localId} ${attribute}: league=${leagueEntry.player[attribute]}, source=${expected}`);
      }
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

// 旧 OVR/fair/bulk 调整文件仅保留历史追踪，不再作为当前名单的期望值来源。
// 当前值只接受逐人确认记录、STL 来源和 NBA 2K27 显式覆盖。

const result = {
  leaguePlayers: playersById.size,
  reviewedPlayers: reviews.length,
  sourceCheckedFields,
  latestOverrides: latestOverrides.length,
  lastReviewedId: reviews.at(-1)?.localId || null,
  validationErrors: errors.length,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
