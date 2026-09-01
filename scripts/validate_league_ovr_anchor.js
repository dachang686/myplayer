const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const config = require(path.join(root, 'js', 'data', 'simulation_config.js'));
const leagueSource = fs.readFileSync(path.join(root, 'js', 'data', 'league_players.js'), 'utf8');
const migrationSource = fs.readFileSync(path.join(root, 'js', 'data', 'league_attribute_source_migration.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js', 'offseason.js'), 'utf8');
const canonicalLeague = new Function(`${leagueSource}\nreturn LEAGUE_PLAYER_DATA;`)();
const attributeSourceMigration = new Function(`${migrationSource}\nreturn LEAGUE_ATTRIBUTE_SOURCE_MIGRATION;`)();
const runtimeLeague = JSON.parse(JSON.stringify(canonicalLeague));
const canonicalSnapshot = JSON.parse(JSON.stringify(canonicalLeague));
const start = offseasonSource.indexOf('function getLeagueAttributeKeys');
const end = offseasonSource.indexOf('// ==================== 联盟演变', start);
if (start < 0 || end < 0) throw new Error('无法提取联盟 OVR 锚点逻辑');

const context = vm.createContext({
  SIM_CONFIG: config,
  ATTR_KEYS: config.ATTR_LIST,
  STATE: { career: { seasonCount: 0 } },
  LEAGUE_PLAYER_DATA: runtimeLeague,
  LEAGUE_TEAM_IDS: Object.keys(runtimeLeague),
  _baseLeagueRosterSnapshot: canonicalSnapshot,
  LEAGUE_ATTRIBUTE_SOURCE_MIGRATION: attributeSourceMigration,
  clearLineupCache() {},
});
vm.runInContext(offseasonSource.slice(start, end), context, { filename: 'league-ovr-anchor.js' });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function players(league) {
  return Object.values(league).flat().filter(player => player && player.id);
}

const sourceOvrs = Object.fromEntries(players(canonicalLeague).map(player => [player.id, player.ovr]));
const firstChanged = vm.runInContext('syncLeaguePlayerOvrs()', context);
const initialPlayers = players(runtimeLeague);
const initialMismatches = initialPlayers.filter(player => player.ovr !== config.getUnifiedPlayerOvr(player, player.pos));
assert(initialPlayers.length === 525 && initialMismatches.length === 0,
  `现实球员初始 OVR 必须使用比赛公式：${JSON.stringify(initialMismatches.slice(0, 10))}`);
assert(initialPlayers.every(player => player._ovrAnchorVersion === 1
  && player._sourceOvr === sourceOvrs[player.id] && player._attributeSchemaVersion === 3 && player._attributeSourceVersion === 2),
  '现实球员必须保留来源 OVR 审计锚点、属性语义和属性来源版本');
assert(vm.runInContext('syncLeaguePlayerOvrs()', context) === 0,
  '联盟 OVR/属性语义同步必须可重复执行且第二次零改动');

const sorted = initialPlayers.slice().sort((left, right) => right.ovr - left.ovr || left.id.localeCompare(right.id));
const topDistribution = {
  at99: sorted.filter(player => player.ovr === 99).length,
  at98: sorted.filter(player => player.ovr === 98).length,
  atLeast97: sorted.filter(player => player.ovr >= 97).length,
};
const tatum = initialPlayers.find(player => player.id === 'P0040');
const zubac = initialPlayers.find(player => player.id === 'P0191');
assert(tatum && tatum.ovr === config.getUnifiedPlayerOvr(tatum, tatum.pos) && tatum.HAN === 86,
  `塔图姆比赛 OVR 或 Ball Handle 异常：${JSON.stringify(tatum)}`);
assert(zubac && zubac.ovr === config.getUnifiedPlayerOvr(zubac, zubac.pos) && zubac.HAN === 35,
  `祖巴茨比赛 OVR 或 Ball Handle 异常：${JSON.stringify(zubac)}`);

const legacyLeague = JSON.parse(JSON.stringify(canonicalLeague));
const legacyPlayers = players(legacyLeague);
const legacyTatum = legacyPlayers.find(player => player.id === 'P0040');
const legacyZubac = legacyPlayers.find(player => player.id === 'P0191');
const legacyJohnson = legacyPlayers.find(player => player.id === 'P0001');
legacyTatum.HAN = 96;
legacyTatum.ovr = 99;
legacyZubac.HAN = 80;
legacyZubac.ovr = 90;
delete legacyTatum._sourceOvr;
delete legacyZubac._sourceOvr;
attributeSourceMigration.attributeKeys.forEach((key, index) => {
  legacyJohnson[key] = attributeSourceMigration.legacyById[legacyJohnson.id][index];
});
legacyJohnson.FIN += 1;
legacyLeague.LAC = legacyLeague.LAC.filter(player => player.id !== legacyZubac.id);
context.STATE._freeAgentPool = [legacyZubac];
context.LEAGUE_PLAYER_DATA = legacyLeague;
vm.runInContext('syncLeaguePlayerOvrs()', context);
assert(legacyTatum.HAN === 86 && legacyTatum.ovr === config.getUnifiedPlayerOvr(legacyTatum, legacyTatum.pos)
  && legacyZubac.HAN === 35 && legacyZubac.ovr === config.getUnifiedPlayerOvr(legacyZubac, legacyZubac.pos),
  `旧 Hands/错误 OVR 存档没有迁移到 Ball Handle 与比赛 OVR：${JSON.stringify({ legacyTatum, legacyZubac })}`);
const canonicalJohnson = players(canonicalLeague).find(player => player.id === legacyJohnson.id);
assert(attributeSourceMigration.attributeKeys.every(key => legacyJohnson[key] === canonicalJohnson[key] + (key === 'FIN' ? 1 : 0)),
  `旧批量属性存档没有迁移到来源基线并保留成长量：${JSON.stringify(legacyJohnson)}`);

const evolvedTatum = JSON.parse(JSON.stringify(tatum));
evolvedTatum._age = 24;
context.playerProbe = evolvedTatum;
const beforeFormula = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
const beforeOvr = evolvedTatum.ovr;
vm.runInContext('applyLeaguePlayerOvrChange(playerProbe, playerProbe.ovr, playerProbe.ovr + 2)', context);
const afterFormula = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
assert(afterFormula > beforeFormula
  && evolvedTatum.ovr === afterFormula,
  `现实球员成长后 OVR 必须等于属性公式：${JSON.stringify({ beforeOvr, beforeFormula, afterFormula, afterOvr: evolvedTatum.ovr })}`);

console.log(JSON.stringify({
  players: initialPlayers.length,
  firstSyncChanged: firstChanged,
  secondSyncChanged: 0,
  topDistribution,
  topFive: sorted.slice(0, 5).map(player => ({ id: player.id, name: player.cname, ovr: player.ovr })),
  focus: {
    tatum: { ovr: tatum.ovr, HAN: tatum.HAN },
    zubac: { ovr: zubac.ovr, HAN: zubac.HAN },
  },
  legacyMigration: {
    tatum: { ovr: legacyTatum.ovr, HAN: legacyTatum.HAN },
    zubac: { ovr: legacyZubac.ovr, HAN: legacyZubac.HAN },
    johnson: { ovr: legacyJohnson.ovr, FIN: legacyJohnson.FIN, sourceVersion: legacyJohnson._attributeSourceVersion },
  },
  anchoredGrowth: {
    beforeOvr,
    afterOvr: evolvedTatum.ovr,
    formulaDelta: afterFormula - beforeFormula,
  },
}, null, 2));
