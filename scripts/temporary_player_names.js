const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const identityPath = path.join(__dirname, 'data', 'nba2k_player_identity.json');
const mode = process.argv[2];

if (!['--add', '--remove'].includes(mode)) {
  throw new Error('Usage: node scripts/temporary_player_names.js --add|--remove');
}

const identities = JSON.parse(fs.readFileSync(identityPath, 'utf8')).players || [];
const namesById = new Map(identities.map(player => [player.localId, player.name]));
if (namesById.size !== identities.length) throw new Error('Duplicate identity localId');

let source = fs.readFileSync(leaguePath, 'utf8');
const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
let changed = 0;

if (mode === '--add') {
  if (/"id": "P\d{4}",\r?\n\s*"name":/.test(source)) {
    throw new Error('Temporary player names already exist');
  }
  source = source.replace(/^([ \t]*)"id": "(P\d{4})",\r?\n/gm, (match, indent, localId) => {
    const name = namesById.get(localId);
    if (!name) throw new Error(`Missing identity for ${localId}`);
    changed++;
    return `${indent}"id": "${localId}",${lineEnding}${indent}"name": ${JSON.stringify(name)},${lineEnding}`;
  });
} else {
  source = source.replace(
    /^([ \t]*)"id": "(P\d{4})",\r?\n(?:[ \t]*\r?\n)?\1"name": "[^"]+",\r?\n/gm,
    (match, indent, localId) => {
      if (!namesById.has(localId)) throw new Error(`Unknown temporary identity ${localId}`);
      changed++;
      return `${indent}"id": "${localId}",${lineEnding}`;
    },
  );
}

if (changed !== namesById.size) {
  throw new Error(`Expected ${namesById.size} names, changed ${changed}`);
}

fs.writeFileSync(leaguePath, source, 'utf8');
console.log(JSON.stringify({ mode, changed }, null, 2));
