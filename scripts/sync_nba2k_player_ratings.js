const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const snapshotPath = path.join(__dirname, 'data', 'nba2k26_player_ratings.json');
const mappingPath = path.join(__dirname, 'data', 'nba2k26_player_mapping.json');
const identityPath = path.join(__dirname, 'data', 'nba2k_player_identity.json');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const legacySourcePath = 'C:\\kevin\\myplayer_bak\\assets\\activity-static.hoopchina.com.cn\\files\\2678-5hu3djrc-upload-1783494754597-12.js';

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

const { NBA2K_ATTRIBUTE_MAP: ATTRIBUTE_MAP } = require(
  path.join(root, 'js', 'data', 'player_attribute_schema.js'),
);

// Confirmed aliases in the cached OVRBase snapshot. Keep these keyed by local
// player ID so short names and suffix differences never create fuzzy matches.
const EXTERNAL_NAME_OVERRIDES = {
  P0004: 'C.J. McCollum',
  P0071: 'Xavier Tillman Sr.',
  P0072: 'P.J. Hall',
  P0078: 'Nicolas Claxton',
  P0086: 'Robert Dillingham',
  P0147: 'Ron Holland',
  P0169: 'L.J. Cryer',
  P0239: 'Bronny James Jr.',
  P0246: 'G.G. Jackson',
  P0260: 'A.J. Johnson',
  P0267: 'Bobby Portis Jr.',
  P0287: 'A.J. Green',
  P0303: "Nah'Shon Hyland",
  P0312: 'Mouhamed Gueye',
  P0383: 'V.J. Edgecombe',
  P0431: 'Hansen Yang',
  P0474: 'R.J. Barrett',
  P0499: 'Sviatoslav Mykhailiuk',
  P0511: 'Alexandre Sarr',
  P0518: 'Carlton Carrington',
};

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchText(url, retries = 4) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'myplayer-rating-calibration/1.0' },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

function parseStructuredPerson(html) {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const data = JSON.parse(match[1]);
      const entries = Array.isArray(data) ? data : [data];
      const person = entries.find(item => item && item['@type'] === 'Person');
      if (person) return person;
    } catch (error) {}
  }
  return null;
}

function parsePlayerPage(url, html) {
  const person = parseStructuredPerson(html);
  if (!person) throw new Error(`missing Person JSON-LD: ${url}`);
  const attributes = {};
  const pattern = /<span class="text-foreground\/80">([^<]+)<\/span><span[^>]*>(\d+)<\/span>/g;
  for (const match of html.matchAll(pattern)) attributes[decodeHtml(match[1]).trim()] = Number(match[2]);
  const nbaId = (url.match(/-(\d+)$/) || [])[1] || null;
  return {
    nbaId,
    url,
    name: decodeHtml(person.name),
    team: decodeHtml(person.affiliation && person.affiliation.name),
    position: decodeHtml(person.jobTitle),
    ovr: Number((person.additionalProperty || []).find(item => item.name === 'Overall Rating')?.value),
    attributes,
  };
}

async function mapLimit(items, limit, worker) {
  const result = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return result;
}

async function fetchSnapshot() {
  const urls = new Set();
  for (let page = 1; page <= 11; page++) {
    const html = await fetchText(`https://ovrbase.com/nba/players?page=${page}`);
    for (const match of html.matchAll(/href="(\/nba\/[a-z0-9-]+-\d+)"/g)) {
      if (match[1] !== '/nba/top-100') urls.add(`https://ovrbase.com${match[1]}`);
    }
  }
  const list = [...urls];
  const players = await mapLimit(list, 10, async (url, index) => {
    if ((index + 1) % 50 === 0) process.stdout.write(`fetched ${index + 1}/${list.length}\n`);
    return parsePlayerPage(url, await fetchText(url));
  });
  const snapshot = {
    source: 'https://ovrbase.com/nba/players',
    game: 'NBA 2K26',
    retrievedAt: new Date().toISOString(),
    players,
  };
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

function readLeagueData() {
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

function playerSignature(player) {
  return [
    player.pos, player.height, player.type, player.ovr,
    ...Object.keys(ATTRIBUTE_MAP).map(key => player[key]),
    player.CLU,
  ].join('|');
}

function normalizeChineseName(value) {
  return String(value || '').replace(/[\s·・•\-—_]/g, '');
}

function numericSignature(player) {
  return [
    player.ovr,
    ...Object.keys(ATTRIBUTE_MAP).map(key => player[key]),
    player.CLU,
  ].join('|');
}

function normalizedHeight(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function createIdentityFromLegacy(league) {
  if (!fs.existsSync(legacySourcePath)) {
    throw new Error(`missing player identity file and legacy source: ${legacySourcePath}`);
  }
  const source = fs.readFileSync(legacySourcePath, 'utf8');
  const legacy = new Function(`${source}\nreturn NBA2K_DATA;`)();
  const players = [];
  let changedFromLegacy = 0;
  for (const teamId of league.LEAGUE_TEAM_IDS) {
    const currentRoster = league.LEAGUE_PLAYER_DATA[teamId] || [];
    const legacyRoster = legacy[teamId] || [];
    if (currentRoster.length !== legacyRoster.length) {
      throw new Error(`legacy roster mismatch for ${teamId}: ${currentRoster.length} != ${legacyRoster.length}`);
    }
    for (let index = 0; index < currentRoster.length; index++) {
      const current = currentRoster[index];
      const original = legacyRoster[index];
      const currentCname = normalizeChineseName(current.cname);
      const originalCname = normalizeChineseName(original.cname);
      const identityAnchorsMatch = current.pos === original.pos
        && normalizedHeight(current.height) === normalizedHeight(original.height)
        && (
          (currentCname && originalCname.includes(currentCname))
          || current.type === original.type
          || numericSignature(current) === numericSignature(original)
        );
      if (!identityAnchorsMatch) {
        throw new Error(`legacy identity mismatch for ${teamId}[${index}] ${current.id}`);
      }
      if (playerSignature(current) !== playerSignature(original)) changedFromLegacy++;
      players.push({
        localId: current.id,
        originalTeam: teamId,
        name: original.name,
        cname: original.cname,
      });
    }
  }
  const identity = {
    source: legacySourcePath,
    createdAt: new Date().toISOString(),
    changedFromLegacy,
    players,
  };
  fs.mkdirSync(path.dirname(identityPath), { recursive: true });
  fs.writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`);
  return identity;
}

function readPlayerIdentity(league) {
  const identity = fs.existsSync(identityPath)
    ? JSON.parse(fs.readFileSync(identityPath, 'utf8'))
    : createIdentityFromLegacy(league);
  const localIds = new Set(league.LEAGUE_TEAM_IDS.flatMap(teamId =>
    (league.LEAGUE_PLAYER_DATA[teamId] || []).map(player => player.id)
  ));
  const identityIds = new Set(identity.players.map(player => player.localId));
  if (localIds.size !== identityIds.size || [...localIds].some(id => !identityIds.has(id))) {
    throw new Error(`player identity coverage mismatch: league=${localIds.size}, identity=${identityIds.size}`);
  }
  return identity;
}

function positionsOverlap(local, external) {
  const a = new Set(String(local || '').split('/').map(value => value.trim()).filter(Boolean));
  const b = String(external || '').split('/').map(value => value.trim()).filter(Boolean);
  return b.some(value => a.has(value));
}

function matchCost(local, external, localTeamId) {
  const differences = [];
  for (const [localKey, externalKey] of Object.entries(ATTRIBUTE_MAP)) {
    if (Number.isFinite(local[localKey]) && Number.isFinite(external.attributes[externalKey])) {
      differences.push(Math.abs(local[localKey] - external.attributes[externalKey]));
    }
  }
  const attributeCost = differences.length
    ? differences.reduce((sum, value) => sum + value, 0) / differences.length
    : 25;
  const ovrCost = Math.abs((Number(local.ovr) || 70) - (Number(external.ovr) || 70)) * 1.8;
  const positionCost = positionsOverlap(local.pos, external.position) ? 0 : 7;
  // The local league intentionally contains projected trades, so team is only a light hint.
  const teamCost = external.team === TEAM_NAMES[localTeamId] ? 0 : 1.5;
  return attributeCost + ovrCost + positionCost + teamCost;
}

// Rectangular Hungarian assignment. Rows may not outnumber columns.
function assignMinimum(costs) {
  const rows = costs.length;
  const cols = costs[0]?.length || 0;
  if (!rows || rows > cols) throw new Error(`invalid assignment matrix ${rows}x${cols}`);
  const u = Array(rows + 1).fill(0);
  const v = Array(cols + 1).fill(0);
  const p = Array(cols + 1).fill(0);
  const way = Array(cols + 1).fill(0);
  for (let i = 1; i <= rows; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(cols + 1).fill(Infinity);
    const used = Array(cols + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= cols; j++) {
        if (used[j]) continue;
        const current = costs[i0 - 1][j - 1] - u[i0] - v[j];
        if (current < minv[j]) { minv[j] = current; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= cols; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const assignment = Array(rows).fill(-1);
  for (let j = 1; j <= cols; j++) if (p[j]) assignment[p[j] - 1] = j - 1;
  return assignment;
}

function buildMappings(snapshot, league) {
  const identity = readPlayerIdentity(league);
  const identityById = new Map(identity.players.map(player => [player.localId, player]));
  const externalByName = new Map();
  for (const external of snapshot.players) {
    const key = normalizeName(external.name);
    if (!externalByName.has(key)) externalByName.set(key, []);
    externalByName.get(key).push(external);
  }
  return league.LEAGUE_TEAM_IDS.flatMap(teamId =>
    (league.LEAGUE_PLAYER_DATA[teamId] || []).map(local => {
      const playerIdentity = identityById.get(local.id);
      const overrideName = EXTERNAL_NAME_OVERRIDES[local.id];
      const lookupName = overrideName || playerIdentity.name;
      const candidates = externalByName.get(normalizeName(lookupName)) || [];
      const external = candidates.length === 1
        ? candidates[0]
        : candidates.slice().sort((a, b) => matchCost(local, a, teamId) - matchCost(local, b, teamId))[0] || null;
      return {
        teamId,
        local,
        identity: playerIdentity,
        external,
        candidates: candidates.length,
        cost: external ? matchCost(local, external, teamId) : null,
        matchMethod: overrideName ? 'confirmed_alias' : 'exact_name',
      };
    })
  );
}

function applySnapshot(snapshot, dryRun) {
  const league = readLeagueData();
  const mappings = buildMappings(snapshot, league);
  const accepted = mappings.filter(item => item.external && item.candidates === 1);
  const rejected = mappings.filter(item => !item.external);
  const uncertain = mappings.filter(item => item.candidates > 1);
  const report = mappings.map(item => ({
    team: item.teamId,
    localId: item.local.id,
    localName: item.local.cname,
    identityName: item.identity.name,
    identityCname: item.identity.cname,
    localOvr: item.local.ovr,
    externalName: item.external?.name || null,
    externalOvr: item.external?.ovr || null,
    url: item.external?.url || null,
    cost: item.cost == null ? null : Number(item.cost.toFixed(2)),
    candidates: item.candidates,
    matchMethod: item.matchMethod,
    accepted: !!item.external && item.candidates === 1,
  }));
  fs.mkdirSync(path.dirname(mappingPath), { recursive: true });
  fs.writeFileSync(mappingPath, `${JSON.stringify({
    sourceRetrievedAt: snapshot.retrievedAt,
    matched: accepted.length,
    rejected: rejected.length,
    uncertain: uncertain.length,
    players: report,
  }, null, 2)}\n`);

  if (!dryRun) {
    for (const item of accepted) {
      const local = item.local;
      const external = item.external;
      const oldOvr = Number(local.ovr) || external.ovr;
      local.name = item.identity.name;
      local.ovr = external.ovr;
      for (const [localKey, externalKey] of Object.entries(ATTRIBUTE_MAP)) {
        const value = external.attributes[externalKey];
        if (Number.isFinite(value)) local[localKey] = value;
      }
      // OVRBase does not expose a direct clutch attribute; retain the individual value,
      // only carrying across the direction of an overall rating update.
      local.CLU = Math.max(25, Math.min(99, Math.round((Number(local.CLU) || 70) + (external.ovr - oldOvr) * 0.5)));
    }
    const output = `const LEAGUE_PLAYER_DATA = ${JSON.stringify(league.LEAGUE_PLAYER_DATA, null, 2)};\nconst LEAGUE_TEAM_IDS = Object.keys(LEAGUE_PLAYER_DATA);\n`;
    fs.writeFileSync(leaguePath, output);
  }
  return { matched: accepted.length, rejected: rejected.length, uncertain: uncertain.length };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--apply')) {
    throw new Error('bulk rating updates are disabled; review and edit one player at a time');
  }
  let snapshot;
  if (args.has('--fetch')) snapshot = await fetchSnapshot();
  else snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const result = applySnapshot(snapshot, true);
  process.stdout.write(`${JSON.stringify({ snapshotPlayers: snapshot.players.length, ...result }, null, 2)}\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
