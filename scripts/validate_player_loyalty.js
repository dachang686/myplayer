const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {};
vm.createContext(context);

function run(relative) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });
}

run('js/data/league_players.js');
run('js/data/player_loyalty.js');

const players = vm.runInContext('Object.values(LEAGUE_PLAYER_DATA).filter(Array.isArray).flat()', context);
const scores = vm.runInContext('PLAYER_LOYALTY_DATA', context);
const basis = vm.runInContext('PLAYER_LOYALTY_BASIS', context);
const sourceDate = vm.runInContext('PLAYER_LOYALTY_SOURCE_DATE', context);
const failures = [];
const expectedIds = new Set(players.map((player) => player.id));
for (let pick = 1; pick <= 60; pick++) expectedIds.add(`D26-${String(pick).padStart(2, '0')}`);

if (players.length !== 525) failures.push(`现役名单应为 525 人，实际为 ${players.length}`);
if (Object.keys(scores).length !== expectedIds.size) failures.push(`忠诚度应覆盖 ${expectedIds.size} 人，实际为 ${Object.keys(scores).length}`);

for (const id of expectedIds) {
  if (!Object.prototype.hasOwnProperty.call(scores, id)) failures.push(`${id} 缺少忠诚度`);
}
for (const [id, value] of Object.entries(scores)) {
  if (!expectedIds.has(id)) failures.push(`${id} 不属于现役或 2026 新秀名单`);
  if (!Number.isInteger(value) || value < 0 || value > 100) failures.push(`${id} 忠诚度无效：${value}`);
}
for (const id of Object.keys(basis)) {
  if (!expectedIds.has(id)) failures.push(`${id} 的依据标签没有对应球员`);
}

if (sourceDate !== '2026-08-06') failures.push(`研究快照日期异常：${sourceDate}`);
if (scores['D26-01'] !== 66 || scores['D26-30'] !== 63 || scores['D26-60'] !== 60) {
  failures.push('2026 新秀顺位分层不符合预期');
}
if (scores.P0156 !== 96 || scores.P0007 !== 28 || scores.P0452 !== 94) {
  failures.push('长期核心、已离队和长期续约样本不符合预期');
}

const offseason = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const inferMatch = offseason.match(/function inferPlayerLoyalty\([\s\S]*?\n\}/);
if (!inferMatch || !/getPublishedPlayerLoyalty/.test(inferMatch[0])) failures.push('忠诚度读取未使用发布数据');
if (inferMatch && /Math\.random|hash|Math\.imul/.test(inferMatch[0])) failures.push('忠诚度仍包含随机或哈希生成逻辑');
if (!/getRookieContractLoyalty/.test(offseason)) failures.push('程序生成新秀未使用合同忠诚度规则');

Object.assign(context, {
  console,
  SIM_CONFIG: { ATTR_LIST: [] },
  STATE: {},
  rngNext: () => 0.5,
  document: { getElementById: () => null }
});
run('js/offseason.js');
vm.runInContext('_playerAges={};_playerGenes={P0156:{v:1,potential:99,loyalty:20}};', context);
const functional = vm.runInContext(`({
  savedOverride: getPlayerLoyalty(LEAGUE_PLAYER_DATA.GSW[0]),
  rookieFourYears: inferPlayerLoyalty({ id: 'R999999', type: '新秀', contract: 4 }),
  rookieOneYear: inferPlayerLoyalty({ id: 'R999998', type: '新秀', contract: 1 }),
  unknown: inferPlayerLoyalty('UNKNOWN'),
  basis: getPlayerLoyaltyBasis(LEAGUE_PLAYER_DATA.GSW[0]),
  highStayRate: calculateContractStayRate({ id: 'P0156', ovr: 80 }, [0.5]),
  lowStayRate: calculateContractStayRate({ id: 'P0007', ovr: 80 }, [0.5])
})`, context);
if (functional.savedOverride !== scores.P0156) failures.push('旧存档中的随机忠诚度没有被发布数据覆盖');
if (functional.rookieFourYears !== 66 || functional.rookieOneYear !== 60) failures.push('程序生成新秀没有按合同年限评分');
if (functional.unknown !== 50) failures.push('无公开信息球员没有回落到中性值');
if (!/长期效力/.test(functional.basis)) failures.push('忠诚度依据标签未正确读取');
if (functional.highStayRate <= functional.lowStayRate) failures.push('忠诚度没有正确影响到期留队概率');

const dynamic = vm.runInContext(`(() => {
  const player = LEAGUE_PLAYER_DATA.ATL[0];
  const before = getPlayerLoyalty(player);
  const firstGain = recordPlayerLoyaltyDecision(player, 'renew', 4, false, 'ATL');
  const afterFirst = getPlayerLoyalty(player);
  const secondGain = recordPlayerLoyaltyDecision(player, 'renew', 4, false, 'ATL');
  const afterSecond = getPlayerLoyalty(player);
  const leaveChange = recordPlayerLoyaltyDecision(player, 'leave', 0, false, 'ATL');
  const afterLeave = getPlayerLoyalty(player);
  const gene = getPlayerGene(player);
  const afterRead = getPlayerLoyalty(player);
  return { before, firstGain, afterFirst, secondGain, afterSecond, leaveChange, afterLeave, afterRead, gene };
})()`, context);
if (!(dynamic.firstGain > 0 && dynamic.afterFirst > dynamic.before)) failures.push('首次长期续约没有提升忠诚度');
if (!(dynamic.secondGain >= dynamic.firstGain && dynamic.afterSecond > dynamic.afterFirst)) failures.push('连续长期续约没有产生递增奖励');
if (!(dynamic.leaveChange < 0 && dynamic.afterLeave < dynamic.afterSecond)) failures.push('主动离队没有降低忠诚度');
if (dynamic.gene.loyaltyRenewals !== 0 || dynamic.gene.loyaltyLastEvent !== '主动离队') failures.push('忠诚度动态状态记录异常');
if (dynamic.afterRead !== dynamic.afterLeave || dynamic.afterRead !== dynamic.gene.loyalty) failures.push('动态忠诚度被初始新闻值重新覆盖');

const tradedRenewal = vm.runInContext(`(() => {
  const player = LEAGUE_PLAYER_DATA.ATL[1];
  recordPlayerLoyaltyDecision(player, 'renew', 4, false, 'ATL');
  recordPlayerLoyaltyDecision(player, 'renew', 4, false, 'ATL');
  const changeAfterTrade = recordPlayerLoyaltyDecision(player, 'renew', 4, false, 'BOS');
  const gene = getPlayerGene(player);
  return { changeAfterTrade, renewals: gene.loyaltyRenewals, team: gene.loyaltyTeam };
})()`, context);
if (tradedRenewal.renewals !== 1 || tradedRenewal.team !== 'BOS') failures.push('被交易后没有重置原队连续续约次数');

const roleImpact = vm.runInContext(`(() => {
  function seed(id, streak) {
    _playerGenes[id] = {
      v: 1, potential: 90, loyalty: 90,
      loyaltyVersion: PLAYER_LOYALTY_GENE_VERSION,
      loyaltyRenewals: 0, loyaltyLastEvent: '', loyaltyTeam: '',
      roleUnderuseSeasons: streak || 0
    };
  }
  seed('ROLE_STARTER', 0);
  seed('ROLE_BENCH_22', 0);
  seed('ROLE_BENCH_18', 0);
  seed('ROLE_REPEAT', 2);
  const history = [0.5];
  return {
    starter: calculateContractStayRate({ id: 'ROLE_STARTER', ovr: 88 }, history, { hasSample: true, isStarter: true, mpg: 31 }),
    bench22: calculateContractStayRate({ id: 'ROLE_BENCH_22', ovr: 88 }, history, { hasSample: true, isStarter: false, mpg: 22 }),
    bench18: calculateContractStayRate({ id: 'ROLE_BENCH_18', ovr: 88 }, history, { hasSample: true, isStarter: false, mpg: 18 }),
    repeated: calculateContractStayRate({ id: 'ROLE_REPEAT', ovr: 88 }, history, { hasSample: true, isStarter: false, mpg: 18 })
  };
})()`, context);
if (!(roleImpact.starter > roleImpact.bench22 && roleImpact.bench22 > roleImpact.bench18)) failures.push('首发身份和场均时间没有分层影响续约率');
if (!(roleImpact.repeated < roleImpact.bench18)) failures.push('连续两个低角色赛季没有追加续约惩罚');
if (Math.abs(roleImpact.starter - 0.882) > 0.001 || Math.abs(roleImpact.bench22 - 0.682) > 0.001) failures.push('88总评、90忠诚度的目标续约率偏离设计值');

const roleHistory = vm.runInContext(`(() => {
  const player = { id: 'ROLE_HISTORY', ovr: 88 };
  _playerGenes.ROLE_HISTORY = {
    v: 1, potential: 90, loyalty: 70,
    loyaltyVersion: PLAYER_LOYALTY_GENE_VERSION,
    loyaltyRenewals: 0, loyaltyLastEvent: '', loyaltyTeam: '', roleUnderuseSeasons: 0
  };
  updatePlayerRoleSatisfactionHistory(player, { hasSample: true, isStarter: false, mpg: 18 });
  updatePlayerRoleSatisfactionHistory(player, { hasSample: true, isStarter: false, mpg: 18 });
  const afterTwo = getPlayerGene(player).roleUnderuseSeasons;
  updatePlayerRoleSatisfactionHistory(player, { hasSample: true, isStarter: true, mpg: 31 });
  return { afterTwo, afterStarter: getPlayerGene(player).roleUnderuseSeasons };
})()`, context);
if (roleHistory.afterTwo !== 2 || roleHistory.afterStarter !== 0) failures.push('低角色赛季累计或恢复首发后的重置异常');

const freeAgentRole = vm.runInContext(`(() => {
  this.canPlayPosition = function(playerPos, targetPos) { return String(playerPos).indexOf(targetPos) >= 0; };
  this.calcTeamLineup = function(teamId) {
    return { starters: { PG: { ovr: teamId === 'OPEN' ? 80 : 94 } }, bench: [] };
  };
  const player = { id: 'FA_ROLE', pos: 'PG', ovr: 88, _origTeam: 'OTHER' };
  return {
    open: getFreeAgentTeamPreferenceScore(player, 'OPEN', { OPEN: { wins: 41, losses: 41 } }, 0),
    blocked: getFreeAgentTeamPreferenceScore(player, 'BLOCKED', { BLOCKED: { wins: 41, losses: 41 } }, 0)
  };
})()`, context);
if (!(freeAgentRole.open > freeAgentRole.blocked + 0.3)) failures.push('自由市场择队没有显著偏向可获得首发机会的球队');

const indexText = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const field of ['loyaltyVersion', 'loyaltyRenewals', 'loyaltyLastEvent', 'loyaltyTeam', 'roleUnderuseSeasons', 'lastRoleMpg', 'lastRoleStarter', 'lastRoleSample']) {
  if (!indexText.includes(`snap.genes[playerId].${field}`)) failures.push(`存档恢复缺少 ${field}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

const neutralCount = Object.values(scores).filter((value) => value === 50).length;
console.log(`Player loyalty validation passed: ${players.length} current players + 60 rookies, ${neutralCount} neutral values.`);
