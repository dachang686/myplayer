const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const mappingPath = path.join(__dirname, 'data', 'nba2k26_player_mapping.json');
const transferPath = path.join(__dirname, 'data', 'real_world_team_transfers_2026.json');

function readLeague() {
  const source = fs.readFileSync(leaguePath, 'utf8');
  return new Function(`${source}\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };`)();
}

function readLeagueSource() {
  return fs.readFileSync(leaguePath, 'utf8');
}

function findMatchingBrace(source, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return index;
    }
  }
  throw new Error(`unclosed object at ${start}`);
}

function splitPlayerObjects(source, start, end) {
  const objects = [];
  let cursor = start;
  while (cursor <= end) {
    const objectStart = source.indexOf('{', cursor);
    if (objectStart < 0 || objectStart > end) break;
    const objectEnd = findMatchingBrace(source, objectStart);
    if (objectEnd > end) throw new Error('player object exceeds team array');
    objects.push(source.slice(objectStart, objectEnd + 1));
    cursor = objectEnd + 1;
  }
  return objects;
}

function rewriteLeagueSource(source, transfers) {
  const teamArrays = new Map();
  const teamPattern = /  "([A-Z]{3})": \[\{/g;
  for (const match of source.matchAll(teamPattern)) {
    const team = match[1];
    const bodyStart = match.index + match[0].length - 1;
    const arrayEnd = source.indexOf(']', bodyStart);
    if (arrayEnd < 0) throw new Error(`missing closing array for ${team}`);
    const objects = splitPlayerObjects(source, bodyStart, arrayEnd - 1);
    const lastObjectStart = source.lastIndexOf('{', arrayEnd);
    const bodyEnd = findMatchingBrace(source, lastObjectStart);
    teamArrays.set(team, { start: bodyStart, end: bodyEnd, objects });
  }
  if (teamArrays.size !== 30) throw new Error(`expected 30 team arrays, found ${teamArrays.size}`);

  const byId = new Map();
  for (const [team, section] of teamArrays) {
    for (const object of section.objects) {
      const id = (object.match(/"id": "([^"]+)"/) || [])[1];
      if (!id || byId.has(id)) throw new Error(`invalid or duplicate player id in source: ${id || 'missing'}`);
      byId.set(id, { team, object });
    }
  }
  for (const transfer of transfers) {
    const entry = byId.get(transfer.localId);
    if (!entry || (entry.team !== transfer.from && entry.team !== transfer.to)) {
      throw new Error(`${transfer.localId} source mismatch while preserving format`);
    }
    if (entry.team === transfer.to) continue;
    const sourceSection = teamArrays.get(transfer.from);
    const destinationSection = teamArrays.get(transfer.to);
    sourceSection.objects = sourceSection.objects.filter(object => object !== entry.object);
    destinationSection.objects.push(entry.object);
    byId.set(transfer.localId, { team: transfer.to, object: entry.object });
  }

  const replacements = [...teamArrays.values()]
    .sort((a, b) => b.start - a.start)
    .map(section => ({
      start: section.start,
      end: section.end,
      value: section.objects.join(','),
    }));
  let output = source;
  for (const replacement of replacements) {
    output = output.slice(0, replacement.start)
      + replacement.value
      + output.slice(replacement.end + 1);
  }
  return output;
}

function formatLeagueData(data) {
  const teams = Object.entries(data).map(([team, players]) => {
    const objects = players.map((player, index) => {
      const lines = JSON.stringify(player, null, 2).split('\n');
      const fields = lines.slice(1, -1).map(line => `  ${line}`);
      if (index < players.length - 1 && fields.length) {
        fields[fields.length - 1] += ',';
      }
      return `{\n${fields.join('\n')}\n  }`;
    });
    return `  ${JSON.stringify(team)}: [${objects.join(',')}]`;
  });
  return `const LEAGUE_PLAYER_DATA = {\n${teams.join(',\n')}\n};\nconst LEAGUE_TEAM_IDS = Object.keys(LEAGUE_PLAYER_DATA);\n`;
}

function buildPlayerIndex(league) {
  const byId = new Map();
  for (const [team, players] of Object.entries(league.LEAGUE_PLAYER_DATA)) {
    for (const player of players) {
      if (byId.has(player.id)) throw new Error(`duplicate local player id: ${player.id}`);
      byId.set(player.id, { team, player });
    }
  }
  return byId;
}

function applyTransfers(league, transfers) {
  const byId = buildPlayerIndex(league);
  for (const transfer of transfers) {
    const entry = byId.get(transfer.localId);
    if (!entry) throw new Error(`missing local player: ${transfer.localId}`);
    if (entry.team === transfer.to) continue;
    if (entry.team !== transfer.from) {
      throw new Error(`${transfer.localId} is in ${entry.team}, expected ${transfer.from}`);
    }
    if (!league.LEAGUE_PLAYER_DATA[transfer.to]) {
      throw new Error(`missing destination team: ${transfer.to}`);
    }
    const sourceRoster = league.LEAGUE_PLAYER_DATA[transfer.from];
    const sourceIndex = sourceRoster.findIndex(player => player.id === transfer.localId);
    sourceRoster.splice(sourceIndex, 1);
    league.LEAGUE_PLAYER_DATA[transfer.to].push(entry.player);
    byId.set(transfer.localId, { team: transfer.to, player: entry.player });
  }
  return league;
}

function updateMapping(transfers) {
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  const byId = new Map(transfers.map(transfer => [transfer.localId, transfer]));
  let updated = 0;
  for (const player of mapping.players) {
    const transfer = byId.get(player.localId);
    if (!transfer) continue;
    if (player.team === transfer.to) {
      updated++;
      continue;
    }
    if (player.team !== transfer.from) {
      throw new Error(`mapping ${player.localId} is in ${player.team}, expected ${transfer.from}`);
    }
    player.team = transfer.to;
    updated++;
  }
  if (updated !== transfers.length) {
    throw new Error(`mapping coverage mismatch: updated=${updated}, transfers=${transfers.length}`);
  }
  return mapping;
}

function main() {
  const transferData = JSON.parse(fs.readFileSync(transferPath, 'utf8'));
  if (process.argv.includes('--format-only')) {
    const league = readLeague();
    fs.writeFileSync(leaguePath, formatLeagueData(league.LEAGUE_PLAYER_DATA));
    return;
  }
  const leagueSource = readLeagueSource();
  const league = readLeague();
  const before = buildPlayerIndex(league);
  const requested = new Set(transferData.transfers.map(transfer => transfer.localId));
  if (requested.size !== transferData.transfers.length) throw new Error('duplicate transfer localId');
  const alreadyApplied = transferData.transfers.filter((transfer) => before.get(transfer.localId)?.team === transfer.to).length;
  const nextLeague = applyTransfers(league, transferData.transfers);
  const after = buildPlayerIndex(nextLeague);
  for (const transfer of transferData.transfers) {
    const beforeTeam = before.get(transfer.localId)?.team;
    if ((beforeTeam !== transfer.from && beforeTeam !== transfer.to) || after.get(transfer.localId).team !== transfer.to) {
      throw new Error(`transfer verification failed: ${transfer.localId}`);
    }
  }
  process.stdout.write(`${JSON.stringify({
    asOf: transferData.asOf,
    transfers: transferData.transfers.length,
    alreadyApplied,
    byStatus: transferData.transfers.reduce((counts, transfer) => {
      counts[transfer.status] = (counts[transfer.status] || 0) + 1;
      return counts;
    }, {}),
    apply: process.argv.includes('--apply'),
  }, null, 2)}\n`);
  if (!process.argv.includes('--apply')) return;

  fs.writeFileSync(leaguePath, rewriteLeagueSource(leagueSource, transferData.transfers));
  fs.writeFileSync(mappingPath, `${JSON.stringify(updateMapping(transferData.transfers), null, 2)}\n`);
}

main();
