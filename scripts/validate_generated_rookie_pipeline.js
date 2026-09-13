const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const draftDataSource = fs.readFileSync(path.join(root, 'js/data/draft_data.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const draftFlowSource = fs.readFileSync(path.join(root, 'js/draft.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const attributeStart = offseasonSource.indexOf('function getLeagueAttributeKeys');
const evolutionStart = offseasonSource.indexOf('// ==================== 联盟演变', attributeStart);
const potentialStart = offseasonSource.indexOf('function generatedPlayerStableHash', evolutionStart);
const potentialEnd = offseasonSource.indexOf('function getPublishedPlayerLoyalty', potentialStart);
if (attributeStart < 0 || evolutionStart < 0 || potentialStart < 0 || potentialEnd < 0) {
  throw new Error('无法提取新秀生成/潜力逻辑');
}

const MVP_STAR_PROSPECT_IDS = [
  'D26-01', 'D26-02', 'D26-03',
  'S001', 'S002', 'S003',
  'S004', 'S005', 'S006',
];
const context = vm.createContext({
  STATE: { career: { seasonCount: 0 } },
  MVP_STAR_PROSPECT_IDS,
  clearLineupCache() {},
});
vm.runInContext(`${configSource}\n${draftDataSource}`, context);
context.ATTR_KEYS = vm.runInContext('SIM_CONFIG.ATTR_LIST', context);
vm.runInContext(offseasonSource.slice(attributeStart, evolutionStart), context, { filename: 'rookie-pipeline-attributes.js' });
vm.runInContext(offseasonSource.slice(potentialStart, potentialEnd), context, { filename: 'rookie-pipeline-potential.js' });

let randomState = 20260828;
function seededRandom() {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 0x100000000;
}
context.seededRandom = seededRandom;

const failures = [];
const targets = vm.runInContext('buildGeneratedDraftOvrTargets(30, seededRandom)', context);
const tierCounts = {
  elite: targets.filter(value => value >= 80 && value <= 84).length,
  high: targets.filter(value => value >= 75 && value <= 79).length,
  rotation: targets.filter(value => value >= 68 && value <= 74).length,
  development: targets.filter(value => value >= 60 && value <= 67).length,
  longshot: targets.filter(value => value >= 50 && value <= 59).length,
};
const expectedCounts = { elite: 4, high: 3, rotation: 13, development: 8, longshot: 2 };
for (const [tier, expected] of Object.entries(expectedCounts)) {
  if (tierCounts[tier] !== expected) failures.push(`${tier} 档数量 ${tierCounts[tier]}，预期 ${expected}`);
}
if (targets.length !== 30 || Math.max(...targets) > 84 || Math.min(...targets) < 50) {
  failures.push(`选秀目标范围异常：${JSON.stringify(targets)}`);
}

const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
// 当届 OVR 档位不再因为位置多样性重排；相同当前能力的候选人必须得到相同的来源种子。
const stackedCenterProspects = Array.from({ length: 30 }, (_, index) => ({
  id: `R-BALANCE-${index}`,
  pos: index < 12 ? 'C' : positions[(index - 12) % positions.length],
  _draftTalentSeed: 95 - index,
}));
context.prospectProbe = stackedCenterProspects;
context.targetProbe = targets;
const balancedAssignments = vm.runInContext('assignDraftTargetsByCurrentOvr(prospectProbe, targetProbe)', context);
const eliteAssignments = balancedAssignments.filter(row => row.tier === 'elite');
const highAssignments = balancedAssignments.filter(row => row.tier === 'high');
if (eliteAssignments.map(row => row.player._draftTalentSeed).join(',') !== '95,94,93,92'
  || eliteAssignments.some(row => row.sourceTalentGap !== 0)) {
  failures.push('当前 OVR 档位分配仍受位置规则影响');
}

const equalGuard = { id: 'R-GUARD', pos: 'PG', ovr: 78, _fixedProspectRating: true };
const equalCenter = { id: 'R-CENTER', pos: 'C', ovr: 78, _fixedProspectRating: true };
context.equalGuard = equalGuard;
context.equalCenter = equalCenter;
const guardSeed = vm.runInContext('getDraftTalentSeed(equalGuard)', context);
const centerSeed = vm.runInContext('getDraftTalentSeed(equalCenter)', context);
if (guardSeed !== 78 || centerSeed !== 78 || guardSeed !== centerSeed) {
  failures.push(`后卫固定人才分仍有位置补偿：${guardSeed}/${centerSeed}`);
}

// 用完整真实固定候选池验证：位置不再改变同一来源 OVR 的排序种子。
const fixedProspectPool = Object.entries(vm.runInContext('FUTURE_PROSPECT_RATINGS', context)).map(([id, rating]) => {
  const player = { id, pos: rating.pos, _fixedProspectRating: true, ...rating.attributes };
  context.playerProbe = player;
  player._sourceFormulaOvr = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
  player.ovr = player._sourceFormulaOvr;
  player._draftTalentSeed = vm.runInContext('getDraftTalentSeed(playerProbe)', context);
  return player;
});
const assignmentFn = vm.runInContext('assignDraftTargetsByCurrentOvr', context);
const eliteTargets = targets.filter(value => value >= 80);
const highTargets = targets.filter(value => value >= 75 && value <= 79);
const sourceAssignments = assignmentFn(fixedProspectPool.slice().sort((left, right) =>
  right._draftTalentSeed - left._draftTalentSeed || left.id.localeCompare(right.id)), eliteTargets.concat(highTargets));
if (sourceAssignments.some(row => row.sourceTalentGap !== 0)) {
  failures.push('真实固定候选池仍出现位置导致的档位提档');
}
const generated = [];
let maximumEntryOvr = 0;
let maximumTargetResidual = 0;
let maximumNormalPotential = 0;
let maximumGrowthDelta = 0;
let slowAttributeGrowthViolations = 0;

for (let index = 0; index < targets.length; index++) {
  const target = targets[index];
  const player = {
    id: `R${String(index + 1).padStart(6, '0')}`,
    _prospectId: `G${String(index + 1).padStart(3, '0')}`,
    pos: positions[index % positions.length],
    ovr: target,
    _age: 20,
  };
  context.playerProbe = player;
  context.targetProbe = target;
  vm.runInContext('prepareDraftProspectForTarget(playerProbe, targetProbe, seededRandom)', context);
  const recalculated = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
  if (player.ovr !== recalculated || player._draftOvr !== player.ovr) {
    failures.push(`${player.id} 入联盟 OVR/属性不一致：${player.ovr}/${player._draftOvr}/${recalculated}`);
  }
  maximumEntryOvr = Math.max(maximumEntryOvr, player.ovr);
  maximumTargetResidual = Math.max(maximumTargetResidual, Math.abs(player.ovr - target));
  if (player.ovr > 84 || Math.abs(player.ovr - target) > 1) {
    failures.push(`${player.id} 目标 ${target} 实际 ${player.ovr}`);
  }

  const potential = vm.runInContext('inferGeneratedPlayerPotential(playerProbe, 20)', context);
  maximumNormalPotential = Math.max(maximumNormalPotential, potential);
  if (potential > 99 || potential < player.ovr) failures.push(`${player.id} 普通潜力异常：${potential}`);

  const growthPlayer = JSON.parse(JSON.stringify(player));
  context.playerProbe = growthPlayer;
  const beforeOvr = growthPlayer.ovr;
  const profile = vm.runInContext('getRookieProfile(playerProbe)', context);
  const slowBefore = Object.fromEntries(profile.weaknesses.map(key => [key, growthPlayer[key]]));
  vm.runInContext('applyLeaguePlayerOvrChange(playerProbe, playerProbe.ovr, playerProbe.ovr + 2)', context);
  const growthDelta = growthPlayer.ovr - beforeOvr;
  maximumGrowthDelta = Math.max(maximumGrowthDelta, growthDelta);
  if (growthDelta < 0 || growthDelta > 2) failures.push(`${player.id} 单季 +2 请求被放大为 ${growthDelta}`);
  for (const key of profile.weaknesses) {
    if (growthPlayer[key] !== slowBefore[key]) {
      slowAttributeGrowthViolations++;
      failures.push(`${player.id} 慢成长属性 ${key} 被自动提高`);
      break;
    }
  }
  generated.push({ id: player.id, target, entryOvr: player.ovr, potential });
}

const capChecks = [
  [55, 99], [63, 99], [70, 99], [77, 99], [82, 99],
];
for (const [draftOvr, expectedCap] of capChecks) {
  context.playerProbe = { id: `R-CAP-${draftOvr}`, _prospectId: `CAP-${draftOvr}`, pos: 'SF', ovr: draftOvr, _draftOvr: draftOvr };
  context.draftOvrProbe = draftOvr;
  const cap = vm.runInContext('getGeneratedPlayerPotentialCap(playerProbe, draftOvrProbe)', context);
  if (cap !== expectedCap) failures.push(`普通新秀 ${draftOvr} 档潜力上限 ${cap}，预期 ${expectedCap}`);
}

const expectedStarCaps = [98, 96, 95, 99, 97, 96, 99, 97, 96];
const starCaps = MVP_STAR_PROSPECT_IDS.map((id, index) => {
  const player = { id: `R-STAR-${index}`, _prospectId: id, pos: 'SF', ovr: 82, _draftOvr: 82, _age: 20 };
  context.playerProbe = player;
  const cap = vm.runInContext('inferGeneratedPlayerPotential(playerProbe, 20)', context);
  if (cap !== expectedStarCaps[index]) failures.push(`${id} 剧情明星潜力 ${cap}，预期 ${expectedStarCaps[index]}`);
  return { id, cap };
});

// 旧存档中的既有 99 不强制回退；新版只阻止继续越过合理上限。
context.playerProbe = { id: 'R-LEGACY-99', _prospectId: 'LEGACY-99', pos: 'PG', ovr: 99, _draftOvr: 84, _age: 24 };
const legacyPotential = vm.runInContext('inferGeneratedPlayerPotential(playerProbe, 24)', context);
if (legacyPotential !== 99) failures.push(`旧存档 99 被错误回退到 ${legacyPotential}`);

// 同一属性包只改变 _draftOvr 时，POT 必须保持不变；还要真正走完整的
// “固定候选人→目标档位拟合属性”流程，防止只测字段而漏掉间接绑定。
const potentialIndependence = vm.runInContext(`(() => {
  const attributes = {
    threePT: 84, MID: 82, FIN: 80, DNK: 70, HAN: 88, PAS: 86,
    PDEF: 62, STL: 58, IDEF: 54, BLK: 42, REB: 48, ATH: 78, STR: 52, CLU: 70,
  };
  const lowPick = Object.assign({ id: 'R-POT-INDEPENDENT', _prospectId: 'POT-INDEPENDENT', pos: 'PG', ovr: 77, _draftOvr: 55, _age: 20 }, attributes);
  const highPick = Object.assign({ id: 'R-POT-INDEPENDENT', _prospectId: 'POT-INDEPENDENT', pos: 'PG', ovr: 77, _draftOvr: 84, _age: 20 }, attributes);
  const source = FUTURE_PROSPECT_RATINGS.D001;
  const lowTarget = Object.assign({ id: 'R-POT-TARGET', _prospectId: 'D001', pos: source.pos, ovr: source.ovr, _age: 20, _fixedProspectRating: true }, source.attributes);
  const highTarget = Object.assign({}, lowTarget);
  prepareDraftProspectForTarget(lowTarget, 60, Math.random);
  prepareDraftProspectForTarget(highTarget, 84, Math.random);
  const lowRandomTarget = { id: 'R-POT-RANDOM', _prospectId: 'POT-RANDOM', pos: 'PG', ovr: 60, _age: 20 };
  const highRandomTarget = { id: 'R-POT-RANDOM', _prospectId: 'POT-RANDOM', pos: 'PG', ovr: 84, _age: 20 };
  let lowSeed = 20260913;
  let highSeed = 20260913;
  const lowRandom = () => ((lowSeed = (Math.imul(lowSeed, 1664525) + 1013904223) >>> 0) / 0x100000000);
  const highRandom = () => ((highSeed = (Math.imul(highSeed, 1664525) + 1013904223) >>> 0) / 0x100000000);
  prepareDraftProspectForTarget(lowRandomTarget, 60, lowRandom);
  prepareDraftProspectForTarget(highRandomTarget, 84, highRandom);
  return {
    lowPick: inferGeneratedPlayerPotential(lowPick, 20),
    highPick: inferGeneratedPlayerPotential(highPick, 20),
    lowTarget: { ovr: lowTarget.ovr, potential: lowTarget._draftPotential },
    highTarget: { ovr: highTarget.ovr, potential: highTarget._draftPotential },
    lowRandomTarget: { ovr: lowRandomTarget.ovr, potential: lowRandomTarget._draftPotential },
    highRandomTarget: { ovr: highRandomTarget.ovr, potential: highRandomTarget._draftPotential },
    score: getDraftTalentScore({ ovr: 77, _draftPotential: 95 }, 50),
  };
})()`, context);
if (potentialIndependence.lowPick !== potentialIndependence.highPick
  || potentialIndependence.lowTarget.potential !== potentialIndependence.highTarget.potential
  || potentialIndependence.lowRandomTarget.potential !== potentialIndependence.highRandomTarget.potential) {
  failures.push(`POT 仍受选秀档位影响：${JSON.stringify(potentialIndependence)}`);
}
const expectedTalentScore = 77 * 0.60 + 95 * 0.35 + 50 * 0.05;
if (Math.abs(potentialIndependence.score - expectedTalentScore) > 1e-9) {
  failures.push(`选秀人才分权重异常：${potentialIndependence.score}`);
}

// 年轻、跨技能组且有稀有天赋的后卫可以压过完成度高但技能集窄的中锋。
const broadGuardPotential = vm.runInContext(`inferGeneratedPlayerPotential({
  id: 'R-POT-BROAD-GUARD', _prospectId: 'POT-BROAD-GUARD', pos: 'PG', ovr: 77, _age: 20,
  threePT: 88, MID: 84, FIN: 82, DNK: 68, HAN: 92, PAS: 90,
  PDEF: 58, STL: 52, IDEF: 38, BLK: 30, REB: 42, ATH: 82, STR: 48, CLU: 78,
}, 20)`, context);
const matureCenterPotential = vm.runInContext(`inferGeneratedPlayerPotential({
  id: 'R-POT-MATURE-CENTER', _prospectId: 'POT-MATURE-CENTER', pos: 'C', ovr: 82, _age: 20,
  threePT: 35, MID: 45, FIN: 82, DNK: 80, HAN: 35, PAS: 45,
  PDEF: 55, STL: 45, IDEF: 95, BLK: 92, REB: 90, ATH: 60, STR: 92, CLU: 65,
}, 20)`, context);
if (broadGuardPotential <= matureCenterPotential) {
  failures.push(`宽技能后卫未获得更高 POT：${broadGuardPotential}/${matureCenterPotential}`);
}

// 固定候选人可被压入当届稀有度，但不能翻转原始强弱项顺序。
const futureRatings = vm.runInContext('FUTURE_PROSPECT_RATINGS', context);
const [authoredId, authoredRating] = Object.entries(futureRatings)[0];
const authoredPlayer = {
  id: 'R-AUTHORED',
  _prospectId: authoredId,
  pos: authoredRating.pos,
  ovr: authoredRating.ovr,
  _age: 20,
  _fixedProspectRating: true,
  ...authoredRating.attributes,
};
const authoredBefore = Object.fromEntries(context.ATTR_KEYS.map(key => [key, authoredPlayer[key]]));
context.playerProbe = authoredPlayer;
vm.runInContext('prepareDraftProspectForTarget(playerProbe, 70, seededRandom)', context);
for (const left of context.ATTR_KEYS) {
  for (const right of context.ATTR_KEYS) {
    if (authoredBefore[left] > authoredBefore[right] && authoredPlayer[left] < authoredPlayer[right]) {
      failures.push(`固定候选人 ${authoredId} 强弱顺序翻转：${left}/${right}`);
    }
  }
}
if (authoredPlayer.ovr < 69 || authoredPlayer.ovr > 71) {
  failures.push(`固定候选人未压入目标档：${authoredPlayer.ovr}`);
}

if (!draftFlowSource.includes('buildGeneratedDraftOvrTargets(prospects.length, rngNext)')
  || !draftFlowSource.includes('assignDraftTargetsByCurrentOvr(prospects, targetOvrs)')
  || !draftFlowSource.includes('getDraftTalentScore(a, 50)')
  || !offseasonSource.includes('var assignments = assignDraftTargetsByCurrentOvr(prospects, targetOvrs)')
  || !offseasonSource.includes('getDraftTalentScore(right.player, 50)')) {
  failures.push('正式选秀流程未接入 OVR/POT 联合人才分');
}
if (offseasonSource.includes('FIXED_PROSPECT_DRAFT_TALENT_OFFSETS')) {
  failures.push('仍残留 PG/SG 固定人才分补偿');
}
if (offseasonSource.includes('getEliteDraftGrowthBonus') || offseasonSource.includes('getHighDraftGrowthBonus')) {
  failures.push('成长仍直接绑定精英/高档选秀标签');
}
if (!indexSource.includes('function prepareScheduledStarRookiesForDraft()')
  || !indexSource.includes('for (var start = 0; start < STAR_ROOKIES.length; start += 3)')) {
  failures.push('剧情明星仍可能六人同届投放');
}

const report = {
  targetCount: targets.length,
  tierCounts,
  targetRange: [Math.min(...targets), Math.max(...targets)],
  maximumEntryOvr,
  maximumTargetResidual,
  maximumNormalPotential,
  maximumGrowthDelta,
  stackedEliteTalent: eliteAssignments.map(row => row.player._draftTalentSeed),
  stackedHighTalent: highAssignments.map(row => row.player._draftTalentSeed),
  equalPositionSeeds: { PG: guardSeed, C: centerSeed },
  sourceAssignmentCount: sourceAssignments.length,
  potentialIndependence,
  broadGuardPotential,
  matureCenterPotential,
  slowAttributeGrowthViolations,
  starCaps,
  legacy99Preserved: legacyPotential === 99,
  authoredTargetOvr: authoredPlayer.ovr,
  failures: failures.slice(0, 50),
  failureCount: failures.length,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
