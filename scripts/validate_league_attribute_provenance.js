const fs = require('fs');
const path = require('path');
const {
  REVIEWED_FIELDS,
  buildExpectedValues,
  readLeague,
} = require('./restore_reviewed_league_attributes.js');

const root = path.resolve(__dirname, '..');
const leagueSource = fs.readFileSync(path.join(root, 'js', 'data', 'league_players.js'), 'utf8');
const league = readLeague(leagueSource);
const players = Object.values(league).flat();
const playerById = new Map(players.map(player => [player.id, player]));
const queue = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'player_rating_review_queue.json'), 'utf8'));
const overrideData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'nba2k27_latest_player_overrides.json'), 'utf8'));
const overrideById = new Map(overrideData.players.map(row => [row.localId, row]));
const failures = [];
let checkedFields = 0;
let sourcedSteal = 0;
let retainedSteal = 0;

for (const row of queue.players) {
  const player = playerById.get(row.localId);
  if (!player) {
    failures.push(`${row.localId} 不在联盟名单`);
    continue;
  }
  const expected = buildExpectedValues(row, overrideById.get(row.localId));
  for (const [key, value] of Object.entries(expected)) {
    checkedFields++;
    if (Number(player[key]) !== Number(value)) {
      failures.push(`${player.id} ${key}=${player[key]}，来源值=${value}`);
    }
  }
  if (Number.isFinite(Number(row.latest2k?.attributes?.Steal))) sourcedSteal++;
  else retainedSteal++;
}

if (players.length !== 525 || queue.players.length !== 525) {
  failures.push(`联盟/审核人数异常：${players.length}/${queue.players.length}`);
}
if (overrideById.size !== 2) failures.push(`最新逐人覆盖数量异常：${overrideById.size}`);
if (sourcedSteal !== 478 || retainedSteal !== 47) {
  failures.push(`STL 来源覆盖异常：${sourcedSteal}/${retainedSteal}`);
}

console.log(JSON.stringify({
  leaguePlayers: players.length,
  reviewedFieldsPerPlayer: REVIEWED_FIELDS.length,
  checkedFields,
  sourcedSteal,
  retainedSteal,
  hanCheckedBy: 'validate_player_attribute_schema.js',
  latestOverrides: overrideData.players.map(row => ({ localId: row.localId, name: row.name, source: row.source })),
  failureCount: failures.length,
  failures: failures.slice(0, 30),
}, null, 2));

if (failures.length) process.exitCode = 1;
