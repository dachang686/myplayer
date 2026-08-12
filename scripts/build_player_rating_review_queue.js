const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(__dirname, 'data');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const ratingsPath = path.join(dataDir, 'nba2k26_player_ratings.json');
const mappingPath = path.join(dataDir, 'nba2k26_player_mapping.json');
const reviewPath = path.join(dataDir, 'player_rating_reviews.json');
const nbaStatsPath = path.join(dataDir, 'nba_2025_26_player_stats.json');
const queuePath = path.join(dataDir, 'player_rating_review_queue.json');

const NBA_SEASON = '2025-26';
const NBA_STATS_URL = 'https://stats.nba.com/stats/leagueLeaders'
  + '?LeagueID=00&PerMode=PerGame&Scope=S&Season=2025-26'
  + '&SeasonType=Regular%20Season&StatCategory=PTS';
const ESPN_STATS_URL = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete'
  + '?region=us&lang=en&contentorigin=espn&isqualified=false&page=1&limit=1000'
  + '&sort=offensive.avgPoints%3Adesc&season=2026&seasontype=2';

const TEAM_NAMES = {
  ATL: 'Atlanta Hawks', BKN: 'Brooklyn Nets', BOS: 'Boston Celtics', CHA: 'Charlotte Hornets',
  CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets',
  DET: 'Detroit Pistons', GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers',
  LAC: 'Los Angeles Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat',
  MIL: 'Milwaukee Bucks', MIN: 'Minnesota Timberwolves', NOP: 'New Orleans Pelicans', NYK: 'New York Knicks',
  OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic', PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns',
  POR: 'Portland Trail Blazers', SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs', TOR: 'Toronto Raptors',
  UTA: 'Utah Jazz', WAS: 'Washington Wizards',
};

const ATTRIBUTE_MAP = {
  threePT: 'Three-Point',
  MID: 'Mid-Range',
  FIN: 'Close Shot',
  DNK: 'Driving Dunk',
  HAN: 'Hands',
  PAS: 'Pass Accuracy',
  PDEF: 'Perimeter D',
  IDEF: 'Interior D',
  BLK: 'Block',
  REB: 'Def. Rebound',
  ATH: 'Agility',
  STR: 'Strength',
};
const REVIEW_FIELDS = ['ovr', ...Object.keys(ATTRIBUTE_MAP), 'CLU'];
const NBA_STATS_FIELDS = [
  'PLAYER_ID', 'PLAYER', 'TEAM', 'GP', 'MIN', 'FG_PCT', 'FG3_PCT', 'FT_PCT',
  'REB', 'AST', 'STL', 'BLK', 'TOV', 'PTS', 'EFF',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseLeague() {
  const source = fs.readFileSync(leaguePath, 'utf8');
  return new Function(`${source}\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };`)();
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function fetchNbaStats() {
  const [nbaPayload, espnPayload] = await Promise.all([
    fetchJson(NBA_STATS_URL, {
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://www.nba.com',
      Referer: 'https://www.nba.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36',
    }),
    fetchJson(ESPN_STATS_URL, {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'myplayer-rating-review/1.0',
    }),
  ]);

  const resultSet = nbaPayload.resultSet || nbaPayload.resultSets?.[0];
  if (!resultSet?.headers || !resultSet?.rowSet) throw new Error('NBA stats response has no result set');
  const indexes = new Map(resultSet.headers.map((header, index) => [header, index]));
  for (const field of NBA_STATS_FIELDS) {
    if (!indexes.has(field)) throw new Error(`NBA stats response is missing ${field}`);
  }
  const nbaPlayers = resultSet.rowSet.map(row => ({
    ...Object.fromEntries(NBA_STATS_FIELDS.map(field => [field, row[indexes.get(field)]])),
    SOURCE: 'NBA',
    SOURCE_URL: `https://www.nba.com/stats/player/${row[indexes.get('PLAYER_ID')]}`,
  }));
  const espnPlayers = parseEspnStats(espnPayload);
  const officialByName = new Map(nbaPlayers.map(player => [normalizeName(player.PLAYER), player]));
  const mergedByName = new Map(espnPlayers.map(player => [normalizeName(player.PLAYER), player]));
  for (const player of nbaPlayers) {
    const key = normalizeName(player.PLAYER);
    mergedByName.set(key, { ...(mergedByName.get(key) || {}), ...player });
  }
  const players = [...mergedByName.values()];
  const cache = {
    sources: [NBA_STATS_URL, ESPN_STATS_URL],
    season: NBA_SEASON,
    seasonType: 'Regular Season',
    retrievedAt: new Date().toISOString(),
    officialNbaPlayers: officialByName.size,
    allPlayers: players.length,
    players,
  };
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(nbaStatsPath, `${JSON.stringify(cache, null, 2)}\n`);
  return cache;
}

async function fetchJson(url, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`stats request failed: ${response.status} ${response.statusText} ${url}`);
  return response.json();
}

function parseEspnStats(payload) {
  const definitions = new Map((payload.categories || []).map(category => [category.name, category.names]));
  const readValue = (entry, categoryName, statName) => {
    const names = definitions.get(categoryName) || [];
    const category = (entry.categories || []).find(item => item.name === categoryName);
    const index = names.indexOf(statName);
    return index >= 0 && category ? category.values[index] : null;
  };
  const percentage = value => Number.isFinite(value) ? value / 100 : null;
  return (payload.athletes || []).map(entry => {
    const athlete = entry.athlete || {};
    const statsLink = (athlete.links || []).find(link => (link.rel || []).includes('stats') && link.href?.startsWith('http'));
    return {
      PLAYER_ID: null,
      PLAYER: athlete.displayName,
      TEAM: athlete.teamShortName,
      GP: readValue(entry, 'general', 'gamesPlayed'),
      MIN: readValue(entry, 'general', 'avgMinutes'),
      FG_PCT: percentage(readValue(entry, 'offensive', 'fieldGoalPct')),
      FG3_PCT: percentage(readValue(entry, 'offensive', 'threePointFieldGoalPct')),
      FT_PCT: percentage(readValue(entry, 'offensive', 'freeThrowPct')),
      REB: readValue(entry, 'general', 'avgRebounds'),
      AST: readValue(entry, 'offensive', 'avgAssists'),
      STL: readValue(entry, 'defensive', 'avgSteals'),
      BLK: readValue(entry, 'defensive', 'avgBlocks'),
      TOV: readValue(entry, 'offensive', 'avgTurnovers'),
      PTS: readValue(entry, 'offensive', 'avgPoints'),
      EFF: null,
      SOURCE: 'ESPN',
      SOURCE_URL: statsLink?.href || `https://www.espn.com/nba/player/stats/_/id/${athlete.id}`,
    };
  }).filter(player => player.PLAYER);
}

function buildProposal(local, external) {
  const targets = { ovr: external?.ovr };
  for (const [localKey, externalKey] of Object.entries(ATTRIBUTE_MAP)) {
    targets[localKey] = external?.attributes?.[externalKey];
  }
  // OVRBase has no direct clutch rating. Keep the player's existing CLU value.
  targets.CLU = local.CLU;

  const changes = {};
  const unchanged = {};
  for (const field of REVIEW_FIELDS) {
    const target = Number.isFinite(targets[field]) ? targets[field] : local[field];
    if (target !== local[field]) changes[field] = [local[field], target];
    else unchanged[field] = local[field];
  }
  return { changes, unchanged };
}

function performanceSummary(stats) {
  if (!stats) return null;
  const number = value => Number.isFinite(value) ? Number(value.toFixed(1)) : '-';
  const pct = value => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '-';
  return `${number(stats.GP)}场 ${number(stats.MIN)}分钟，${number(stats.PTS)}分、${number(stats.REB)}篮板、`
    + `${number(stats.AST)}助攻、${number(stats.STL)}抢断、${number(stats.BLK)}盖帽，`
    + `投篮${pct(stats.FG_PCT)}、三分${pct(stats.FG3_PCT)}`;
}

function buildQueue(nbaStats) {
  const league = parseLeague();
  const ratings = readJson(ratingsPath);
  const mapping = readJson(mappingPath);
  const reviews = readJson(reviewPath).players || [];
  const reviewedById = new Map(reviews.map(review => [review.localId, review]));
  const ratingByUrl = new Map(ratings.players.map(player => [player.url, player]));
  const mappingById = new Map(mapping.players.map(player => [player.localId, player]));
  const statsById = new Map(nbaStats.players.map(player => [String(player.PLAYER_ID), player]));
  const statsByName = new Map(nbaStats.players.map(player => [normalizeName(player.PLAYER), player]));

  const players = [];
  for (const team of league.LEAGUE_TEAM_IDS) {
    for (const local of league.LEAGUE_PLAYER_DATA[team] || []) {
      const map = mappingById.get(local.id);
      const external = map?.url ? ratingByUrl.get(map.url) : null;
      const stats = (external?.nbaId ? statsById.get(String(external.nbaId)) : null)
        || statsByName.get(normalizeName(external?.name || local.name));
      const proposal = buildProposal(local, external);
      const flags = [];
      if (!map?.accepted) flags.push('identity_or_2k_mapping_required');
      if (external && Object.keys(external.attributes || {}).length === 0) flags.push('2k_rating_only');
      if (!stats) flags.push('nba_stats_missing');
      if (external?.team && TEAM_NAMES[team] && external.team !== TEAM_NAMES[team]) {
        flags.push('team_transition_note');
      }
      if (Math.abs((external?.ovr ?? local.ovr) - local.ovr) >= 3) flags.push('large_ovr_delta');
      if (Object.values(proposal.changes).some(([from, to]) => Math.abs(to - from) >= 15)) {
        flags.push('large_attribute_delta');
      }

      let status = 'manual';
      if (reviewedById.has(local.id)) status = 'reviewed';
      else if (map?.accepted && external && Object.keys(external.attributes || {}).length > 0) status = 'ready';
      else if (map?.accepted && external) status = 'rating_only';

      players.push({
        localId: local.id,
        team,
        name: local.name,
        cname: local.cname,
        status,
        flags,
        local: Object.fromEntries(REVIEW_FIELDS.map(field => [field, local[field]])),
        latest2k: external ? {
          nbaId: external.nbaId,
          name: external.name,
          team: external.team,
          position: external.position,
          ovr: external.ovr,
          url: external.url,
          attributes: external.attributes,
        } : null,
        nba: stats ? {
          ...stats,
          summary: performanceSummary(stats),
        } : null,
        proposal,
        existingReview: reviewedById.get(local.id) || null,
      });
    }
  }

  const counts = players.reduce((result, player) => {
    result[player.status] = (result[player.status] || 0) + 1;
    return result;
  }, {});
  const queue = {
    generatedAt: new Date().toISOString(),
    nbaStatsRetrievedAt: nbaStats.retrievedAt,
    nbaStatsSources: nbaStats.sources,
    ratingsRetrievedAt: ratings.retrievedAt,
    reviewedPlayers: reviews.length,
    nextUnreviewedId: players.find(player => player.status !== 'reviewed')?.localId || null,
    counts,
    players,
  };
  fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
  return queue;
}

function printCards(queue, options) {
  const pending = queue.players.filter(player => player.status !== 'reviewed');
  let selected;
  if (options.id) selected = pending.filter(player => player.localId === options.id);
  else selected = pending.slice(0, options.next);
  for (const player of selected) {
    const changeText = Object.entries(player.proposal.changes)
      .map(([field, [from, to]]) => `${field} ${from}→${to}`)
      .join('，') || '2K明细无差异';
    process.stdout.write(`\n${player.localId} ${player.cname} / ${player.name} [${player.team}] ${player.status}\n`);
    process.stdout.write(`2K：${player.latest2k?.ovr ?? '-'}；建议：${changeText}\n`);
    process.stdout.write(`NBA：${player.nba?.summary || '无全联盟统计，需单独核实'}\n`);
    if (player.nba?.SOURCE_URL) process.stdout.write(`表现来源：${player.nba.SOURCE} ${player.nba.SOURCE_URL}\n`);
    if (player.flags.length) process.stdout.write(`标记：${player.flags.join(', ')}\n`);
  }
}

function parseOptions() {
  const args = process.argv.slice(2);
  const options = { fetchNba: false, next: 10, id: null };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--fetch-nba') options.fetchNba = true;
    else if (args[index] === '--next') options.next = Number(args[++index]);
    else if (args[index] === '--id') options.id = args[++index];
    else throw new Error(`unknown option: ${args[index]}`);
  }
  if (!Number.isInteger(options.next) || options.next < 1 || options.next > 100) {
    throw new Error('--next must be an integer from 1 to 100');
  }
  return options;
}

async function main() {
  const options = parseOptions();
  const nbaStats = options.fetchNba ? await fetchNbaStats() : readJson(nbaStatsPath);
  const queue = buildQueue(nbaStats);
  process.stdout.write(`${JSON.stringify({
    queuePath,
    nbaPlayers: nbaStats.players.length,
    officialNbaPlayers: nbaStats.officialNbaPlayers,
    reviewedPlayers: queue.reviewedPlayers,
    nextUnreviewedId: queue.nextUnreviewedId,
    counts: queue.counts,
  }, null, 2)}\n`);
  printCards(queue, options);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
