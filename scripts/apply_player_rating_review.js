const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const queuePath = path.join(__dirname, 'data', 'player_rating_review_queue.json');
const reviewPath = path.join(__dirname, 'data', 'player_rating_reviews.json');
const attributes = [
  'ovr', 'threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS',
  'PDEF', 'STL', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const options = { dryRun: false, note: null };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--id') options.id = argv[++index];
    else if (arg === '--note') options.note = argv[++index];
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.id) throw new Error('usage: node scripts/apply_player_rating_review.js --id P0001 [--note text] [--dry-run]');
  return options;
}

function parseLeague(source) {
  return new Function(`${source}\nreturn LEAGUE_PLAYER_DATA;`)();
}

function findLeaguePlayer(league, localId) {
  for (const [team, players] of Object.entries(league)) {
    const player = players.find(item => item.id === localId);
    if (player) return { team, player };
  }
  return null;
}

function assertProposalMatchesLeague(queuePlayer, leagueEntry) {
  if (leagueEntry.team !== queuePlayer.team) {
    throw new Error(`${queuePlayer.localId} team mismatch: ${leagueEntry.team} != ${queuePlayer.team}`);
  }
  for (const attribute of attributes) {
    if (leagueEntry.player[attribute] !== queuePlayer.local[attribute]) {
      throw new Error(
        `${queuePlayer.localId} stale queue for ${attribute}: league=${leagueEntry.player[attribute]}, queue=${queuePlayer.local[attribute]}`,
      );
    }
  }
  const recorded = new Set([
    ...Object.keys(queuePlayer.proposal.changes || {}),
    ...Object.keys(queuePlayer.proposal.unchanged || {}),
  ]);
  if (recorded.size !== attributes.length || attributes.some(attribute => !recorded.has(attribute))) {
    throw new Error(`${queuePlayer.localId} proposal does not cover all attributes exactly once`);
  }
}

function replacePlayerAttributes(source, localId, changes) {
  const idNeedle = `    "id": "${localId}",`;
  const start = source.indexOf(idNeedle);
  if (start < 0) throw new Error(`missing league source block: ${localId}`);
  const nextPlayer = source.indexOf('\n  },{', start);
  const teamEnd = source.indexOf('\n  }]', start);
  const candidates = [nextPlayer, teamEnd].filter(index => index >= 0);
  if (!candidates.length) throw new Error(`unterminated league source block: ${localId}`);
  const end = Math.min(...candidates);
  let block = source.slice(start, end);

  for (const [attribute, tuple] of Object.entries(changes)) {
    const [from, to] = tuple;
    const pattern = new RegExp(`(^\\s*"${attribute}":\\s*)${from}(,?\\s*$)`, 'm');
    const matches = block.match(new RegExp(pattern.source, 'gm')) || [];
    if (matches.length !== 1) {
      throw new Error(`${localId} expected one source value for ${attribute}=${from}, found ${matches.length}`);
    }
    block = block.replace(pattern, (match, prefix, suffix) => `${prefix}${to}${suffix}`);
  }
  return `${source.slice(0, start)}${block}${source.slice(end)}`;
}

function buildPerformance(queuePlayer, note) {
  const summary = queuePlayer.nba?.summary;
  const base = summary
    ? `2025-26：${summary}；结合最新 2K 明细逐项确认`
    : '本地 NBA/ESPN 赛季缓存没有可核验统计；仅按最新 2K 数据逐项确认，不推测表现结论';
  return note ? `${base}；${note}` : base;
}

function buildReview(queuePlayer, note) {
  const ratingOnly = queuePlayer.status === 'rating_only';
  return {
    localId: queuePlayer.localId,
    name: queuePlayer.name,
    cname: queuePlayer.cname,
    team: queuePlayer.team,
    status: ratingOnly ? 'confirmed_rating_only' : 'confirmed',
    ratingSource: queuePlayer.latest2k?.url || null,
    performanceSource: queuePlayer.nba?.SOURCE_URL || null,
    performance: buildPerformance(queuePlayer, note),
    changes: queuePlayer.proposal.changes || {},
    unchanged: queuePlayer.proposal.unchanged || {},
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const queue = readJson(queuePath);
  const reviews = readJson(reviewPath);
  const expectedId = `P${String((reviews.players || []).length + 1).padStart(4, '0')}`;
  if (options.id !== expectedId) {
    throw new Error(`only the next player may be reviewed: expected ${expectedId}`);
  }
  const queuePlayer = queue.players.find(player => player.localId === options.id);
  if (!queuePlayer) throw new Error(`missing queue player: ${options.id}`);
  if (queuePlayer.status === 'manual') {
    throw new Error(`${options.id} requires manual source verification`);
  }
  if (!['ready', 'rating_only'].includes(queuePlayer.status)) {
    throw new Error(`${options.id} cannot be applied from status ${queuePlayer.status}`);
  }

  const leagueSource = fs.readFileSync(leaguePath, 'utf8');
  const leagueEntry = findLeaguePlayer(parseLeague(leagueSource), options.id);
  if (!leagueEntry) throw new Error(`missing league player: ${options.id}`);
  assertProposalMatchesLeague(queuePlayer, leagueEntry);
  const updatedLeagueSource = replacePlayerAttributes(
    leagueSource,
    options.id,
    queuePlayer.proposal.changes || {},
  );
  const review = buildReview(queuePlayer, options.note);

  if (!options.dryRun) {
    reviews.players.push(review);
    fs.writeFileSync(leaguePath, updatedLeagueSource);
    fs.writeFileSync(reviewPath, `${JSON.stringify(reviews, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify({
    dryRun: options.dryRun,
    localId: options.id,
    name: queuePlayer.name,
    status: review.status,
    changes: review.changes,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
