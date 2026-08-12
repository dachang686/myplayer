const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const mapping = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'nba2k26_player_mapping.json'), 'utf8')).players;
const ratings = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'nba2k26_player_ratings.json'), 'utf8')).players;
const overrides = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'player_steal_overrides.json'), 'utf8')).players;
const ratingByUrl = new Map(ratings.map(player => [player.url, player]));
const mappingById = new Map(mapping.filter(player => player.accepted).map(player => [player.localId, player]));

let source = fs.readFileSync(leaguePath, 'utf8');
const ids = [...source.matchAll(/^\s*"id":\s*"(P\d{4})",/gm)].map(match => match[1]);
if (ids.length !== 525 || new Set(ids).size !== ids.length) throw new Error(`unexpected league player count: ${ids.length}`);

for (const id of ids) {
  const start = source.indexOf(`    "id": "${id}",`);
  const nextPlayer = source.indexOf('\n  },{', start);
  const teamEnd = source.indexOf('\n  }]', start);
  const end = Math.min(...[nextPlayer, teamEnd].filter(index => index >= 0));
  const block = source.slice(start, end);
  if (/^\s*"STL":/m.test(block)) throw new Error(`${id} already has STL`);
  const mapped = mappingById.get(id);
  const cached = mapped && ratingByUrl.get(mapped.url);
  const cachedSteal = cached && cached.attributes && cached.attributes.Steal;
  const override = overrides[id];
  const value = Number.isFinite(cachedSteal) ? cachedSteal : override && override.value;
  if (!Number.isInteger(value) || value < 25 || value > 99) throw new Error(`${id} missing valid STL source`);
  const pdefLine = /^(\s*"PDEF":\s*\d+,?\s*)$/m;
  if (!pdefLine.test(block)) throw new Error(`${id} missing PDEF insertion point`);
  const updatedBlock = block.replace(pdefLine, `$1\n    "STL": ${value},`);
  source = `${source.slice(0, start)}${updatedBlock}${source.slice(end)}`;
}

const unusedOverrides = Object.keys(overrides).filter(id => !ids.includes(id));
if (unusedOverrides.length) throw new Error(`unused STL overrides: ${unusedOverrides.join(', ')}`);
fs.writeFileSync(leaguePath, source);
process.stdout.write(`${JSON.stringify({ players: ids.length, cached: ids.length - Object.keys(overrides).length, overrides: Object.keys(overrides).length })}\n`);
