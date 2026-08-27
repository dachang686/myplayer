const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const schemaPath = path.join(root, 'js', 'data', 'player_attribute_schema.js');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const queuePath = path.join(__dirname, 'data', 'player_rating_review_queue.json');
const adjustmentPath = path.join(__dirname, 'data', 'player_ovr_adjustments.json');
const auditPath = path.join(__dirname, 'data', 'han_ball_handle_migration.json');
const schema = require(schemaPath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

assert(schema.version === 2, `unexpected attribute schema version: ${schema.version}`);
assert(schema.fields.HAN.nba2kAttribute === 'Ball Handle', 'HAN must map to NBA 2K Ball Handle');
assert(schema.fields.HAN.excludedNba2kAttribute === 'Hands', 'HAN schema must explicitly exclude Hands');
assert(schema.NBA2K_ATTRIBUTE_MAP.HAN === 'Ball Handle', 'shared NBA 2K map is inconsistent');

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const schemaScriptIndex = indexSource.indexOf('js/data/player_attribute_schema.js');
const leagueScriptIndex = indexSource.indexOf('js/data/league_players.js');
assert(schemaScriptIndex >= 0 && schemaScriptIndex < leagueScriptIndex, 'attribute schema must load before league data');
assert(indexSource.includes('ATTR_CN.HAN = PLAYER_ATTRIBUTE_SCHEMA.fields.HAN.label;'), 'UI HAN label bypasses schema');

for (const fileName of [
  'sync_nba2k_player_ratings.js',
  'build_player_rating_review_queue.js',
  'calibrate_nba2k_ovr_attributes.js',
]) {
  const source = fs.readFileSync(path.join(__dirname, fileName), 'utf8');
  assert(source.includes('player_attribute_schema.js'), `${fileName} does not use shared attribute schema`);
  assert(!/HAN\s*:\s*['"]Hands['"]/.test(source), `${fileName} still maps HAN to Hands`);
}

const leagueSource = fs.readFileSync(leaguePath, 'utf8');
const league = new Function(`${leagueSource}\nreturn LEAGUE_PLAYER_DATA;`)();
const players = Object.values(league).flat();
const queueById = new Map(readJson(queuePath).players.map(player => [player.localId, player]));
const adjustmentById = new Map(readJson(adjustmentPath).players.map(player => [player.localId, player]));
const audit = readJson(auditPath);
const fallbackById = new Map(audit.retainedWithoutSource.map(player => [player.localId, player]));
let sourcedFromReview = 0;
let sourcedFrom2k = 0;
let retainedWithoutSource = 0;

for (const player of players) {
  assert(Number.isInteger(player.HAN) && player.HAN >= 25 && player.HAN <= 99,
    `${player.id} invalid HAN: ${player.HAN}`);
  const reviewed = adjustmentById.get(player.id)?.changes?.HAN?.[1];
  const ballHandle = queueById.get(player.id)?.latest2k?.attributes?.[schema.fields.HAN.nba2kAttribute];
  if (Number.isFinite(Number(reviewed))) {
    sourcedFromReview++;
    assert(player.HAN === Number(reviewed), `${player.id} HAN does not match reviewed Ball Handle`);
  } else if (Number.isFinite(Number(ballHandle))) {
    sourcedFrom2k++;
    assert(player.HAN === Number(ballHandle), `${player.id} HAN does not match NBA 2K Ball Handle`);
  } else {
    retainedWithoutSource++;
    const fallback = fallbackById.get(player.id);
    assert(fallback && fallback.HAN === player.HAN, `${player.id} missing explicit HAN fallback record`);
  }
}

assert(players.length === 525, `league player count changed: ${players.length}`);
assert(sourcedFromReview + sourcedFrom2k + retainedWithoutSource === players.length,
  'HAN provenance does not cover the complete league');
assert(fallbackById.size === retainedWithoutSource, 'HAN fallback audit contains stale players');
assert(audit.schemaVersion === schema.version, 'HAN migration audit schema version is stale');

console.log(JSON.stringify({
  schemaVersion: schema.version,
  HAN: schema.fields.HAN,
  leaguePlayers: players.length,
  sourcedFromReview,
  sourcedFrom2k,
  retainedWithoutSource,
}, null, 2));
