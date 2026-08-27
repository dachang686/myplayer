const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const queuePath = path.join(__dirname, 'data', 'player_rating_review_queue.json');
const overridePath = path.join(__dirname, 'data', 'nba2k27_latest_player_overrides.json');

const REVIEWED_FIELDS = [
  'ovr', 'threePT', 'MID', 'FIN', 'DNK', 'PAS', 'PDEF',
  'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readLeague(source) {
  return new Function(`${source}\nreturn LEAGUE_PLAYER_DATA;`)();
}

function reviewedValue(row, key) {
  const review = row && row.existingReview;
  if (review?.changes && Object.prototype.hasOwnProperty.call(review.changes, key)) {
    return Number(review.changes[key][1]);
  }
  if (review?.unchanged && Object.prototype.hasOwnProperty.call(review.unchanged, key)) {
    return Number(review.unchanged[key]);
  }
  return NaN;
}

function buildExpectedValues(row, latestOverride) {
  const expected = {};
  for (const key of REVIEWED_FIELDS) {
    const value = reviewedValue(row, key);
    if (!Number.isFinite(value)) throw new Error(`${row.localId} 缺少已确认字段 ${key}`);
    expected[key] = value;
  }
  const sourcedSteal = Number(row.latest2k?.attributes?.Steal);
  const retainedSteal = Number(row.local?.STL);
  expected.STL = Number.isFinite(sourcedSteal) ? sourcedSteal : retainedSteal;
  if (!Number.isFinite(expected.STL)) throw new Error(`${row.localId} 缺少 STL 来源和保留值`);

  // HAN 不从旧审核记录恢复；它由独立 schema 门禁固定为 NBA 2K Ball Handle。
  if (latestOverride) Object.assign(expected, latestOverride.values);
  return expected;
}

function replacePlayerValues(source, playerId, values) {
  const start = source.indexOf(`    "id": "${playerId}",`);
  if (start < 0) throw new Error(`找不到联盟球员 ${playerId}`);
  const nextPlayer = source.indexOf('\n  },{', start);
  const teamEnd = source.indexOf('\n  }]', start);
  const end = Math.min(...[nextPlayer, teamEnd].filter(index => index >= 0));
  if (!Number.isFinite(end)) throw new Error(`${playerId} 球员数据块未闭合`);
  let block = source.slice(start, end);
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`(^\\s*"${key}":\\s*)(\\d+)(,?\\s*$)`, 'm');
    if (!pattern.test(block)) throw new Error(`${playerId} 缺少字段 ${key}`);
    block = block.replace(pattern, `$1${value}$3`);
  }
  return source.slice(0, start) + block + source.slice(end);
}

function buildRestoration() {
  const queue = readJson(queuePath);
  const overrides = readJson(overridePath);
  const overrideById = new Map(overrides.players.map(row => [row.localId, row]));
  const originalSource = fs.readFileSync(leaguePath, 'utf8');
  const league = readLeague(originalSource);
  const playerById = new Map(Object.values(league).flat().map(player => [player.id, player]));
  let updatedSource = originalSource;
  let changedFields = 0;
  let changedPlayers = 0;
  let sourcedSteal = 0;
  let retainedSteal = 0;

  for (const row of queue.players) {
    const player = playerById.get(row.localId);
    if (!player) throw new Error(`审核记录中的球员不在联盟名单：${row.localId}`);
    const expected = buildExpectedValues(row, overrideById.get(row.localId));
    const changedValues = {};
    for (const [key, value] of Object.entries(expected)) {
      if (Number(player[key]) === Number(value)) continue;
      changedValues[key] = value;
      changedFields++;
    }
    if (Number.isFinite(Number(row.latest2k?.attributes?.Steal))) sourcedSteal++;
    else retainedSteal++;
    if (!Object.keys(changedValues).length) continue;
    updatedSource = replacePlayerValues(updatedSource, player.id, changedValues);
    changedPlayers++;
  }

  if (queue.players.length !== 525 || playerById.size !== 525) {
    throw new Error(`联盟/审核人数异常：${playerById.size}/${queue.players.length}`);
  }
  return {
    updatedSource,
    summary: {
      leaguePlayers: playerById.size,
      reviewedFields: queue.players.length * REVIEWED_FIELDS.length,
      sourcedSteal,
      retainedSteal,
      hanPolicy: 'preserve Ball Handle schema value',
      latestOverrides: overrideById.size,
      changedPlayers,
      changedFields,
    },
  };
}

function main() {
  const apply = process.argv.includes('--apply');
  const result = buildRestoration();
  if (apply) fs.writeFileSync(leaguePath, result.updatedSource);
  console.log(JSON.stringify({ apply, ...result.summary }, null, 2));
}

if (require.main === module) main();

module.exports = { REVIEWED_FIELDS, buildExpectedValues, buildRestoration, readLeague };
