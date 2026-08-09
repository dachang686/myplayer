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

const indexText = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const field of ['loyaltyVersion', 'loyaltyRenewals', 'loyaltyLastEvent', 'loyaltyTeam']) {
  if (!indexText.includes(`snap.genes[playerId].${field}`)) failures.push(`存档恢复缺少 ${field}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

const neutralCount = Object.values(scores).filter((value) => value === 50).length;
console.log(`Player loyalty validation passed: ${players.length} current players + 60 rookies, ${neutralCount} neutral values.`);
