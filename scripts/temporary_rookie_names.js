const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targetPath = path.join(root, 'js', 'data', 'draft_data.js');
const offseasonPath = path.join(root, 'js', 'offseason.js');
const draft2026IdentityPath = path.join(__dirname, 'data', 'draft_class_2026_identity.json');
const backupPath = process.argv[3] || 'C:\\kevin\\myplayer_bak\\js\\core_game_logic.js';
const mode = process.argv[2];

if (mode !== 'add' && mode !== 'remove') {
  throw new Error('Usage: node scripts/temporary_rookie_names.js <add|remove> [backupCorePath]');
}

function extractArray(source, variableName) {
  const marker = `var ${variableName} = [`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Backup is missing ${variableName}`);
  const contentStart = start + marker.length - 1;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = contentStart; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '[') depth++;
    else if (char === ']') {
      depth--;
      if (depth === 0) {
        return Function(`"use strict"; return (${source.slice(contentStart, index + 1)});`)();
      }
    }
  }
  throw new Error(`Backup array ${variableName} is not closed`);
}

function escapeString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

let target = fs.readFileSync(targetPath, 'utf8');

if (mode === 'remove') {
  const matches = target.match(/, name: "(?:[^"\\]|\\.)*"/g) || [];
  target = target.replace(/, name: "(?:[^"\\]|\\.)*"/g, '');
  fs.writeFileSync(targetPath, target);
  let offseason = fs.readFileSync(offseasonPath, 'utf8');
  const draft2026Matches = offseason.match(/, name: '(?:[^'\\]|\\.)*'/g) || [];
  offseason = offseason.replace(/, name: '(?:[^'\\]|\\.)*'/g, '');
  fs.writeFileSync(offseasonPath, offseason);
  console.log(JSON.stringify({
    mode,
    removedNames: matches.length + draft2026Matches.length,
    targetPath,
    offseasonPath,
  }, null, 2));
  process.exit(0);
}

const backup = fs.readFileSync(backupPath, 'utf8');
const sources = [
  { variableName: 'ROOKIE_NAMES', idPrefix: 'N', idWidth: 3 },
  { variableName: 'DRAFT_CLASS_2027', idPrefix: 'D', idWidth: 3 },
  { variableName: 'STAR_ROOKIES', idPrefix: 'S', idWidth: 3 },
];

let addedNames = 0;
for (const source of sources) {
  const players = extractArray(backup, source.variableName);
  players.forEach((player, index) => {
    const id = `${source.idPrefix}${String(index + 1).padStart(source.idWidth, '0')}`;
    const rowPattern = new RegExp(`(id: "${id}")(?!, name:)`);
    if (!rowPattern.test(target)) return;
    target = target.replace(rowPattern, `$1, name: "${escapeString(player.en)}"`);
    addedNames++;
  });
}

fs.writeFileSync(targetPath, target);

let offseason = fs.readFileSync(offseasonPath, 'utf8');
const draft2026Identity = JSON.parse(fs.readFileSync(draft2026IdentityPath, 'utf8'));
let addedDraft2026Names = 0;
draft2026Identity.players.forEach((player) => {
  const rowPattern = new RegExp(`(\\{ pick: ${player.pick}, team: '[^']+')(?!, name:)`);
  if (!rowPattern.test(offseason)) return;
  const name = String(player.name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  offseason = offseason.replace(rowPattern, `$1, name: '${name}'`);
  addedDraft2026Names++;
});
fs.writeFileSync(offseasonPath, offseason);

console.log(JSON.stringify({
  mode,
  addedNames: addedNames + addedDraft2026Names,
  draftDataNames: addedNames,
  draft2026Names: addedDraft2026Names,
  targetPath,
  offseasonPath,
  backupPath,
}, null, 2));
