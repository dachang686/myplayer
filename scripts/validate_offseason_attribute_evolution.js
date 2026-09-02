const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const start = offseasonSource.indexOf('function getLeagueAttributeKeys');
const end = offseasonSource.indexOf('// ==================== 联盟演变', start);
const ageFactorStart = offseasonSource.indexOf('function getGeneratedPlayerAgeFactor');
const ageFactorEnd = offseasonSource.indexOf('function getGeneratedPlayerPotentialCap', ageFactorStart);
if (start < 0 || end < 0 || ageFactorStart < 0 || ageFactorEnd < 0) throw new Error('无法提取休赛期属性演变逻辑');

const SIM_CONFIG = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const LEAGUE_PLAYER_DATA = new Function(`${leagueSource}\nreturn LEAGUE_PLAYER_DATA;`)();
const ATTR_KEYS = SIM_CONFIG.ATTR_LIST;
const context = vm.createContext({
  SIM_CONFIG,
  ATTR_KEYS,
  STATE: { career: { seasonCount: 5 } },
  clearLineupCache() {},
  getPlayerGene(player) {
    if (!player._testGene) player._testGene = { potential: Number(player._testPotential) || 90, v: 2 };
    return player._testGene;
  },
  getLeaguePlayerAge(player) {
    return Number(player && player._age) || 24;
  },
  inferGeneratedPlayerDraftOvr(player) {
    return Number(player && player._draftOvr) || 70;
  },
  getCurrentLeagueSeasonNumber() {
    return 6;
  },
});
let contextRef = null;
contextRef = context;
context.getCurrentLeagueSeasonNumber = function() {
  return (contextRef.STATE.career.seasonCount || 0) + 1;
};
vm.runInContext(offseasonSource.slice(start, end), context, { filename: 'offseason-attribute-evolution.js' });
context.rngNext = () => 0.5;
vm.runInContext(offseasonSource.slice(ageFactorStart, ageFactorEnd), context, { filename: 'offseason-age-factor.js' });

const players = Object.values(LEAGUE_PLAYER_DATA).flat();
const failures = [];
let growthCases = 0;
let declineCases = 0;
let maximumGrowth = 0;
let maximumDecline = 0;
let minimumTopThreeOverlap = 3;

const ageCurve = vm.runInContext(`({
  age31: getGeneratedPlayerAgeFactor({_draftOvr: 82}, 31, 95),
  age33: getGeneratedPlayerAgeFactor({_draftOvr: 82}, 33, 95),
  age35: getGeneratedPlayerAgeFactor({_draftOvr: 82}, 35, 95),
  normalAge33: getGeneratedPlayerAgeFactor({_draftOvr: 70}, 33, 75)
})`, context);
if (!(ageCurve.age31 < 0 && ageCurve.age33 < ageCurve.age31 && ageCurve.age35 < ageCurve.age33)) {
  failures.push(`NPC 年龄衰退曲线没有随年龄加强：${JSON.stringify(ageCurve)}`);
}
if (ageCurve.age33 !== ageCurve.normalAge33) {
  failures.push(`精英/高 OVR 球员仍绕过统一年龄衰退：${JSON.stringify(ageCurve)}`);
}

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
  if (growth.ovr !== vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context)) {
    if (/^R\d+$/.test(String(source.id)) || source._prospectId) {
      failures.push(`${source.id} 成长后 OVR 不一致`);
    }
  }
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
    const declineLimit = ['ATH','STR','PDEF','STL','DNK'].includes(key) ? 3 : 2;
    if (delta > 0 || delta < -declineLimit) failures.push(`${source.id} 衰退 ${key} 反向或越界：${delta}`);
  }
  if (decline.ovr !== vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context)) {
    if (/^R\d+$/.test(String(source.id)) || source._prospectId) {
      failures.push(`${source.id} 衰退后 OVR 不一致`);
    }
  }
  const declineOverlap = topThree(decline).filter(key => declineTop.includes(key)).length;
  minimumTopThreeOverlap = Math.min(minimumTopThreeOverlap, declineOverlap);
  if (topThree(decline).filter(key => declineBand.includes(key)).length < 2) failures.push(`${source.id} 普通衰退异常翻转前三强项`);
}

const realPlayers = players.filter(source => !/^R\d+$/.test(String(source.id)) && !source._prospectId);
let requestPlusOneMax = 0;
let requestPlusTwoMax = 0;
let requestPlusTwoTotal = 0;
let requestPlusThreeCount = 0;

for (const source of realPlayers) {
  for (const requestedDelta of [1, 2]) {
    const probe = JSON.parse(JSON.stringify(source));
    probe._age = 22;
    probe._ovrAnchorVersion = vm.runInContext('LEAGUE_OVR_ANCHOR_VERSION', context);
    probe._sourceOvr = Math.round(Number(probe.ovr) || 70);
    context.playerProbe = probe;
    probe._sourceFormulaOvr = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
    probe.ovr = probe._sourceFormulaOvr;
    const beforeOvr = probe.ovr;
    vm.runInContext(`applyLeaguePlayerOvrChange(playerProbe, ${beforeOvr}, ${beforeOvr + requestedDelta})`, context);
    const actualDelta = Number(probe.ovr) - beforeOvr;
    if (requestedDelta === 1) {
      requestPlusOneMax = Math.max(requestPlusOneMax, actualDelta);
      if (actualDelta < 0 || actualDelta > 1) failures.push(`${source.id} 请求 +1 实际 ${actualDelta}`);
    } else {
      requestPlusTwoMax = Math.max(requestPlusTwoMax, actualDelta);
      requestPlusTwoTotal += actualDelta;
      if (actualDelta === 3) requestPlusThreeCount++;
      if (actualDelta < 0 || actualDelta > 2) failures.push(`${source.id} 请求 +2 实际 ${actualDelta}`);
    }
  }
}

const saturationSources = realPlayers.map(player => {
  const probe = JSON.parse(JSON.stringify(player));
  context.playerProbe = probe;
  return { player, formulaOvr: vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context) };
}).sort((left, right) => right.formulaOvr - left.formulaOvr);
let saturationProbe = null;
let saturationBefore = 0;
let saturationAfterFirst = 0;
for (const source of saturationSources) {
  const probe = JSON.parse(JSON.stringify(source.player));
  probe._age = 36;
  context.playerProbe = probe;
  probe.ovr = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
  const before = probe.ovr;
  vm.runInContext('applyLeaguePlayerOvrChange(playerProbe, playerProbe.ovr, playerProbe.ovr - 1)', context);
  if (Number(probe._ovrDeclineRoundingCarry) >= 0.5) {
    saturationProbe = probe;
    saturationBefore = before;
    saturationAfterFirst = probe.ovr;
    break;
  }
}
if (!saturationProbe) {
  failures.push('未找到可验证取整欠账的球员样本');
  saturationProbe = JSON.parse(JSON.stringify(saturationSources[0].player));
  context.playerProbe = saturationProbe;
  saturationProbe.ovr = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
  saturationBefore = saturationProbe.ovr;
  saturationAfterFirst = saturationProbe.ovr;
}
context.playerProbe = saturationProbe;
vm.runInContext('applyLeaguePlayerOvrChange(playerProbe, playerProbe.ovr, playerProbe.ovr - 1)', context);
const saturationAfterSecond = saturationProbe.ovr;
if (saturationAfterSecond > saturationBefore - 1) {
  failures.push(`公式取整连续吞掉衰退：${saturationBefore}→${saturationAfterFirst}→${saturationAfterSecond}`);
}
if (saturationAfterSecond !== vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context)) {
  failures.push('顶端公式饱和修复后 OVR 与属性公式不一致');
}

const migrationProbe = {
  id: 'R900010',
  _prospectId: 'D90010',
  pos: 'SF',
  ovr: 72,
  _age: 24,
  _draftOvr: 70,
  _testPotential: 88,
  _talentBalanceVersion: 0,
};
ATTR_KEYS.forEach((key, index) => { migrationProbe[key] = 58 + index; });
context.playerProbe = migrationProbe;
migrationProbe.ovr = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
const migrationBeforeOvr = migrationProbe.ovr;
vm.runInContext('migrateLeagueTalentBalance(playerProbe)', context);
const migrationDelta = migrationProbe.ovr - migrationBeforeOvr;
if (migrationDelta < 0 || migrationDelta > 3) failures.push(`迁移补偿 OVR 变化 ${migrationDelta}，预期 0–3`);
context.playerProbe = migrationProbe;
const migrationSeason = vm.runInContext('getCurrentLeagueSeasonNumber()', context);
if (Number(migrationProbe._talentBalanceMigrationSeason) !== migrationSeason) {
  failures.push('迁移后未标记当季跳过正常成长');
}
let simulatedGrowth = 1;
if (Number(migrationProbe._talentBalanceMigrationSeason) === migrationSeason && simulatedGrowth > 0) {
  simulatedGrowth = 0;
}
if (simulatedGrowth !== 0) failures.push('迁移当季仍允许正常正成长');

// 旧存档年龄断层迁移必须从 21–23、24–26、27–29 三个年龄段均匀挑选，
// 且只安排渐进追赶，不能一次性把年轻球员直接抬成球星。
const oldTopPlayers = Array.from({ length: 35 }, (_, index) => {
  const player = { id: `P-OLD-${index}`, pos: 'SF', ovr: 90, _age: 32 };
  ATTR_KEYS.forEach(key => { player[key] = 90; });
  return player;
});
const cohortCandidates = [];
for (const age of [22, 25, 28]) {
  for (let index = 0; index < 4; index++) {
    const player = {
      id: `R-CATCHUP-${age}-${index}`,
      _prospectId: `CATCHUP-${age}-${index}`,
      pos: 'SF',
      ovr: 75,
      _age: age,
      _draftOvr: 77,
      _testPotential: 92,
      _talentBalanceVersion: 1,
      _rookieProfile: 'two_way_wing',
      _rookieGenerationVersion: 3,
    };
    ATTR_KEYS.forEach(key => { player[key] = 75; });
    context.playerProbe = player;
    player.ovr = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
    player._cohortBeforeOvr = player.ovr;
    cohortCandidates.push(player);
  }
}
context.LEAGUE_TEAM_IDS = ['A'];
context.LEAGUE_PLAYER_DATA = { A: oldTopPlayers.concat(cohortCandidates) };
context.STATE._freeAgentPool = [];
context.STATE.career.seasonCount = 12;
vm.runInContext('migrateLeagueTalentBalanceAll()', context);
const selectedCatchups = cohortCandidates.filter(player => player._talentCatchupSeasons === 3);
const selectedAgeCounts = selectedCatchups.reduce((counts, player) => {
  counts[player._age] = (counts[player._age] || 0) + 1;
  return counts;
}, {});
if (selectedCatchups.length !== 12
  || selectedAgeCounts[22] !== 4
  || selectedAgeCounts[25] !== 4
  || selectedAgeCounts[28] !== 4) {
  failures.push(`年龄断层迁移没有跨三个年龄段均匀选择：${JSON.stringify(selectedAgeCounts)}`);
}
if (cohortCandidates.some(player => Number(player.ovr) - Number(player._cohortBeforeOvr) > 2)) {
  failures.push('年龄断层迁移单次补偿超过 2 OVR');
}
if (cohortCandidates.some(player => Number(player._talentBalanceVersion) !== 2)) {
  failures.push('年龄断层迁移没有写入 V2 版本');
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
  realPlayers: realPlayers.length,
  growthCases,
  declineCases,
  maximumGrowth,
  maximumDecline,
  minimumTopThreeOverlap,
  ageCurve,
  requestPlusOneMax,
  requestPlusTwoMax,
  requestPlusTwoAverage: realPlayers.length ? Number((requestPlusTwoTotal / realPlayers.length).toFixed(2)) : 0,
  requestPlusThreeCount,
  saturationDecline: { before: saturationBefore, afterFirst: saturationAfterFirst, afterSecond: saturationAfterSecond },
  migrationDelta,
  selectedCatchups: selectedCatchups.length,
  selectedCatchupAgeCounts: selectedAgeCounts,
  legacyCompletePreserved: !ATTR_KEYS.some(key => completeLegacy[key] !== completeBefore[key]),
  legacyMissingFilled: Number.isFinite(missingLegacy.STL),
  failures: failures.slice(0, 50),
  failureCount: failures.length,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
