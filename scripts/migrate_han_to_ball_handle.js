const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const queuePath = path.join(__dirname, 'data', 'player_rating_review_queue.json');
const adjustmentPath = path.join(__dirname, 'data', 'player_ovr_adjustments.json');
const auditPath = path.join(__dirname, 'data', 'han_ball_handle_migration.json');
const schema = require(path.join(root, 'js', 'data', 'player_attribute_schema.js'));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readLeague(source) {
  return new Function(`${source}\nreturn LEAGUE_PLAYER_DATA;`)();
}

function finite(value) {
  return Number.isFinite(Number(value));
}

function replaceHan(source, playerId, from, to) {
  const start = source.indexOf(`    "id": "${playerId}",`);
  if (start < 0) throw new Error(`missing league player block: ${playerId}`);
  const nextPlayer = source.indexOf('\n  },{', start);
  const teamEnd = source.indexOf('\n  }]', start);
  const end = Math.min(...[nextPlayer, teamEnd].filter(index => index >= 0));
  if (!Number.isFinite(end)) throw new Error(`unterminated league player block: ${playerId}`);
  const block = source.slice(start, end);
  const pattern = /(^\s*"HAN":\s*)(\d+)(,?\s*$)/m;
  const match = block.match(pattern);
  if (!match || Number(match[2]) !== Number(from)) {
    throw new Error(`${playerId} expected HAN=${from}, found ${match && match[2]}`);
  }
  const updated = block.replace(pattern, `$1${to}$3`);
  return source.slice(0, start) + updated + source.slice(end);
}

function buildMigration() {
  if (schema.fields.HAN.nba2kAttribute !== 'Ball Handle') {
    throw new Error(`HAN schema must map to Ball Handle: ${schema.fields.HAN.nba2kAttribute}`);
  }
  const source = fs.readFileSync(leaguePath, 'utf8');
  const league = readLeague(source);
  const players = Object.values(league).flat();
  const queueById = new Map(readJson(queuePath).players.map(player => [player.localId, player]));
  const adjustmentById = new Map(readJson(adjustmentPath).players.map(player => [player.localId, player]));
  const changed = [];
  const retainedWithoutSource = [];
  let updatedSource = source;
  let sourcedFrom2k = 0;
  let sourcedFromReview = 0;

  for (const player of players) {
    const reviewed = adjustmentById.get(player.id)?.changes?.HAN?.[1];
    const ballHandle = queueById.get(player.id)?.latest2k?.attributes?.[schema.fields.HAN.nba2kAttribute];
    let next = null;
    let origin = null;
    if (finite(reviewed)) {
      next = Number(reviewed);
      origin = 'reviewed_override';
      sourcedFromReview++;
    } else if (finite(ballHandle)) {
      next = Number(ballHandle);
      origin = 'nba2k_ball_handle';
      sourcedFrom2k++;
    }

    if (next == null) {
      retainedWithoutSource.push({
        localId: player.id,
        cname: player.cname,
        HAN: Number(player.HAN),
        reason: 'cached 2K detail has no Ball Handle; retained current reviewed value',
      });
      continue;
    }
    if (next < 25 || next > 99) throw new Error(`${player.id} invalid Ball Handle: ${next}`);
    if (Number(player.HAN) === next) continue;
    updatedSource = replaceHan(updatedSource, player.id, player.HAN, next);
    changed.push({ localId: player.id, cname: player.cname, from: Number(player.HAN), to: next, origin });
  }

  return {
    updatedSource,
    audit: {
      schemaVersion: schema.version,
      definition: {
        HAN: schema.fields.HAN.meaning,
        nba2kAttribute: schema.fields.HAN.nba2kAttribute,
        excludedNba2kAttribute: schema.fields.HAN.excludedNba2kAttribute,
      },
      precedence: ['reviewed_override', 'nba2k_ball_handle', 'retain_current_when_source_missing'],
      counts: {
        leaguePlayers: players.length,
        sourcedFromReview,
        sourcedFrom2k,
        retainedWithoutSource: retainedWithoutSource.length,
        changed: changed.length,
      },
      retainedWithoutSource,
    },
    changed,
  };
}

function main() {
  const apply = process.argv.includes('--apply');
  const result = buildMigration();
  if (apply) {
    fs.writeFileSync(leaguePath, result.updatedSource);
    fs.writeFileSync(auditPath, `${JSON.stringify(result.audit, null, 2)}\n`);
  }
  console.log(JSON.stringify({
    apply,
    ...result.audit.counts,
    maximumChange: result.changed.reduce((max, row) => Math.max(max, Math.abs(row.to - row.from)), 0),
  }, null, 2));
}

main();
