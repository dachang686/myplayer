const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const currentPath = path.join(root, 'js', 'data', 'league_players.js');
const outputPath = path.join(root, 'js', 'data', 'league_attribute_source_migration.js');
const ATTRIBUTE_KEYS = [
  'threePT', 'MID', 'FIN', 'DNK', 'PAS', 'PDEF', 'STL',
  'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU',
];

function parseLeague(source) {
  return new Function(`${source}\nreturn LEAGUE_PLAYER_DATA;`)();
}

function flattenById(league) {
  return new Map(Object.values(league).flat().map(player => [player.id, player]));
}

function buildMigration(legacySource) {
  const legacyById = flattenById(parseLeague(legacySource));
  const currentById = flattenById(parseLeague(fs.readFileSync(currentPath, 'utf8')));
  const changed = {};
  for (const [playerId, current] of currentById) {
    const legacy = legacyById.get(playerId);
    if (!legacy) throw new Error(`旧名单缺少球员 ${playerId}`);
    const legacyValues = ATTRIBUTE_KEYS.map(key => Number(legacy[key]));
    const differs = ATTRIBUTE_KEYS.some((key, index) => Number(current[key]) !== legacyValues[index]);
    if (differs) changed[playerId] = legacyValues;
  }
  return {
    version: 1,
    attributeKeys: ATTRIBUTE_KEYS,
    legacyById: changed,
  };
}

function main() {
  let legacySource = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { legacySource += chunk; });
  process.stdin.on('end', () => {
    if (!legacySource.trim()) throw new Error('请通过 stdin 提供旧版 league_players.js');
    const migration = buildMigration(legacySource);
    const source = [
      '/** 旧批量 OVR 属性版到来源属性版的一次性存档迁移基线。 */',
      `var LEAGUE_ATTRIBUTE_SOURCE_MIGRATION = Object.freeze(${JSON.stringify(migration)});`,
      '',
    ].join('\n');
    if (process.argv.includes('--apply')) fs.writeFileSync(outputPath, source);
    console.log(JSON.stringify({
      apply: process.argv.includes('--apply'),
      version: migration.version,
      attributeKeys: migration.attributeKeys.length,
      legacyPlayers: Object.keys(migration.legacyById).length,
    }, null, 2));
  });
}

main();
