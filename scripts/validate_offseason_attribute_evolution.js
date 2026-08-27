const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const start = offseasonSource.indexOf('function getLeagueAttributeKeys');
const end = offseasonSource.indexOf('// ==================== 联盟演变', start);
if (start < 0 || end < 0) throw new Error('无法提取休赛期属性演变逻辑');

const SIM_CONFIG = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const LEAGUE_PLAYER_DATA = new Function(`${leagueSource}\nreturn LEAGUE_PLAYER_DATA;`)();
const ATTR_KEYS = SIM_CONFIG.ATTR_LIST;
const context = vm.createContext({
  SIM_CONFIG,
  ATTR_KEYS,
  STATE: { career: { seasonCount: 5 } },
  clearLineupCache() {},
});
vm.runInContext(offseasonSource.slice(start, end), context, { filename: 'offseason-attribute-evolution.js' });

const players = Object.values(LEAGUE_PLAYER_DATA).flat();
const failures = [];
let growthCases = 0;
let declineCases = 0;
let maximumGrowth = 0;
let maximumDecline = 0;
let minimumTopThreeOverlap = 3;

function topThree(player) {
  return ATTR_KEYS.slice().sort((a, b) => Number(player[b]) - Number(player[a]) || a.localeCompare(b)).slice(0, 3);
}

function topBand(player) {
  const ordered = ATTR_KEYS.slice().sort((a, b) => Number(player[b]) - Number(player[a]));
  const cutoff = Number(player[ordered[2]]) - 2;
  return ordered.filter(key => Number(player[key]) >= cutoff);
}

for (const source of players) {
  const base = JSON.parse(JSON.stringify(source));
  context.playerProbe = base;
  base.ovr = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);

  const growth = JSON.parse(JSON.stringify(base));
  growth._age = 24;
  const growthBefore = Object.fromEntries(ATTR_KEYS.map(key => [key, growth[key]]));
  const growthTop = topThree(growth);
  const growthBand = topBand(growth);
  context.playerProbe = growth;
  vm.runInContext('applyLeaguePlayerOvrChange(playerProbe, playerProbe.ovr, playerProbe.ovr + 1)', context);
  growthCases++;
  for (const key of ATTR_KEYS) {
    const delta = Number(growth[key]) - Number(growthBefore[key]);
    maximumGrowth = Math.max(maximumGrowth, delta);
    if (delta < 0 || delta > 2) failures.push(`${source.id} 成长 ${key} 反向或越界：${delta}`);
  }
  if (growth.ovr !== vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context)) failures.push(`${source.id} 成长后 OVR 不一致`);
  const growthOverlap = topThree(growth).filter(key => growthTop.includes(key)).length;
  minimumTopThreeOverlap = Math.min(minimumTopThreeOverlap, growthOverlap);
  if (topThree(growth).filter(key => growthBand.includes(key)).length < 2) failures.push(`${source.id} 普通成长异常翻转前三强项`);

  const decline = JSON.parse(JSON.stringify(base));
  decline._age = 32;
  const declineBefore = Object.fromEntries(ATTR_KEYS.map(key => [key, decline[key]]));
  const declineTop = topThree(decline);
  const declineBand = topBand(decline);
  context.playerProbe = decline;
  vm.runInContext('applyLeaguePlayerOvrChange(playerProbe, playerProbe.ovr, playerProbe.ovr - 1)', context);
  declineCases++;
  for (const key of ATTR_KEYS) {
    const delta = Number(decline[key]) - Number(declineBefore[key]);
    maximumDecline = Math.max(maximumDecline, Math.abs(delta));
    if (delta > 0 || delta < -2) failures.push(`${source.id} 衰退 ${key} 反向或越界：${delta}`);
  }
  if (decline.ovr !== vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context)) failures.push(`${source.id} 衰退后 OVR 不一致`);
  const declineOverlap = topThree(decline).filter(key => declineTop.includes(key)).length;
  minimumTopThreeOverlap = Math.min(minimumTopThreeOverlap, declineOverlap);
  if (topThree(decline).filter(key => declineBand.includes(key)).length < 2) failures.push(`${source.id} 普通衰退异常翻转前三强项`);
}

const completeLegacy = { id: 'R900001', _prospectId: 'D900', pos: 'PG', ovr: 72, _age: 24 };
ATTR_KEYS.forEach((key, index) => { completeLegacy[key] = 58 + index; });
const completeBefore = Object.fromEntries(ATTR_KEYS.map(key => [key, completeLegacy[key]]));
context.playerProbe = completeLegacy;
vm.runInContext('migrateLegacyGeneratedPlayerAttributes(playerProbe)', context);
if (ATTR_KEYS.some(key => completeLegacy[key] !== completeBefore[key])) failures.push('旧存档完整属性在迁移时被改写');
if (completeLegacy.ovr !== vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context)) failures.push('旧存档迁移后 OVR 未重算');

const missingLegacy = { id: 'R900002', _prospectId: 'D901', pos: 'C', ovr: 70, _age: 22 };
ATTR_KEYS.forEach((key, index) => { if (key !== 'STL') missingLegacy[key] = 55 + index; });
const missingBefore = Object.fromEntries(ATTR_KEYS.filter(key => key !== 'STL').map(key => [key, missingLegacy[key]]));
context.playerProbe = missingLegacy;
vm.runInContext('migrateLegacyGeneratedPlayerAttributes(playerProbe)', context);
if (!Number.isFinite(missingLegacy.STL)) failures.push('旧存档缺失属性未补齐');
if (Object.keys(missingBefore).some(key => missingLegacy[key] !== missingBefore[key])) failures.push('补缺失属性时改写了已有字段');

if (/function normalizeLeaguePlayerAttributesToOvr|function normalizeRookieAttributesToOvr/.test(offseasonSource)) {
  failures.push('仍残留目标 OVR 反推属性函数');
}

const result = {
  players: players.length,
  growthCases,
  declineCases,
  maximumGrowth,
  maximumDecline,
  minimumTopThreeOverlap,
  legacyCompletePreserved: !ATTR_KEYS.some(key => completeLegacy[key] !== completeBefore[key]),
  legacyMissingFilled: Number.isFinite(missingLegacy.STL),
  failures: failures.slice(0, 50),
  failureCount: failures.length,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
