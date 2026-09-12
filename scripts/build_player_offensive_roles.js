const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const config = require('../js/data/simulation_config.js');
const leaguePath = path.join(root, 'js/data/league_players.js');
const cachePath = path.join(__dirname, 'data/player_offensive_roles.json');
const marker = '// BEGIN GENERATED OFFENSIVE ROLES';
const source = fs.readFileSync(leaguePath, 'utf8').split(marker)[0].trimEnd();
const league = new Function(source + ';return LEAGUE_PLAYER_DATA;')();
const normalize = name => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const round = number => Math.round(number * 10000) / 10000;
let cache;
if (process.argv[2]) {
  const payload = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8'));
  if (payload.requestedSeason?.year !== 2026 || payload.requestedSeason?.type?.type !== 2
    || payload.pagination?.pages !== 1) throw new Error('Expected complete 2025-26 regular-season source');
  const names = new Map(payload.categories.map(c => [c.name, c.names]));
  function value(entry, group, name) {
    return Number(entry.categories.find(c => c.name === group)?.values[names.get(group).indexOf(name)]);
  }
  const byName = new Map();
  for (const entry of payload.athletes) {
    const name = normalize(entry.athlete.displayName);
    if (byName.has(name)) throw new Error('Ambiguous player identity: ' + name);
    byName.set(name, entry);
  }
  const identities = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/player_semantic_calibration_v9.json'), 'utf8')).players;
  const rows = [], missing = [];
  for (const player of Object.values(league).flat()) {
    const identity = identities.find(p => p.id === player.id);
    const entry = byName.get(normalize(identity?.identityName)) || byName.get(normalize(identity?.stats?.PLAYER));
    if (!entry) { missing.push(player.id); continue; }
    const gp = value(entry, 'general', 'gamesPlayed');
    const minutes = value(entry, 'general', 'avgMinutes');
    if (gp < 10 || minutes < 8) continue;
    const raw = { gp, minutes, fgm: value(entry, 'offensive', 'avgFieldGoalsMade'), fga: value(entry, 'offensive', 'avgFieldGoalsAttempted'),
      fta: value(entry, 'offensive', 'avgFreeThrowsAttempted'), ast: value(entry, 'offensive', 'avgAssists'), tov: value(entry, 'offensive', 'avgTurnovers') };
    if (!Object.values(raw).every(Number.isFinite) || raw.fga <= 0) throw new Error('Invalid source: ' + player.id);
    const rating = config.getUnifiedPlayerRating(player, player.pos);
    rows.push({ id: player.id, name: entry.athlete.displayName, sourceUrl: entry.athlete.links.find(l => l.rel.includes('stats') && l.rel.includes('desktop')).href,
      ...raw, fgm36: round(raw.fgm * 36 / minutes), fga36: round(raw.fga * 36 / minutes), fta36: round(raw.fta * 36 / minutes), ast36: round(raw.ast * 36 / minutes), tov36: round(raw.tov * 36 / minutes),
      confidence: round(Math.min(1, gp * minutes / 600)),
      baseLoad: round(Math.max(rating.capacity.shotLoad, rating.capacity.interiorUsageLoad, rating.capacity.perimeterUsageLoad)),
      basePassing: player.PAS });
  }
  cache = { version: 4, season: '2025-26', retrievedAt: new Date().toISOString(),
    method: 'Observed shooting/foul-drawing/assisting involvement per 36 minutes; opportunity priors, not scoring efficiency or final box scores.',
    source: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=2026&seasontype=2&limit=1000&isqualified=false', missing, rows };
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n');
} else {
  cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
}
const lines = cache.rows.map(row => '  ' + JSON.stringify(row.id) + ': ' + JSON.stringify({ version: cache.version, playerId: row.id,
  fgm36: row.fgm36, fga36: row.fga36, fta36: row.fta36, ast36: row.ast36, confidence: row.confidence, baseLoad: row.baseLoad, basePassing: row.basePassing }) + ',');
const generated = `\n\n${marker}\n// Rebuild: node scripts/build_player_offensive_roles.js\n// Provenance: scripts/data/player_offensive_roles.json; only opportunity rates.\nconst LEAGUE_OFFENSIVE_ROLES = {\n${lines.join('\n')}\n};\nLEAGUE_TEAM_IDS.forEach(function(team) {\n  LEAGUE_PLAYER_DATA[team].forEach(function(player) {\n    if (LEAGUE_OFFENSIVE_ROLES[player.id]) player._offensiveRole = Object.freeze(LEAGUE_OFFENSIVE_ROLES[player.id]);\n  });\n});\n`;
fs.writeFileSync(leaguePath, source + generated);
console.log(JSON.stringify({ profiles: cache.rows.length, missing: cache.missing }));
