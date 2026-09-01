const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const failures = [];
const context = {
  console: { log() {}, error() {} },
  document: { getElementById() { return null; } },
  window: {},
  LEAGUE_TEAM_IDS: ['A', 'B', 'C'],
  LEAGUE_PLAYER_DATA: { A: [], B: [], C: [] },
  STATE: {
    careerTeam: null,
    finalOVR: 0,
    position: null,
    season: null,
    _prevStandings: {
      A: { wins: 55, losses: 27 },
      B: { wins: 42, losses: 40 },
      C: { wins: 30, losses: 52 },
    },
    _leagueChanges: {},
  },
};

let seed = 123456789;
context.rngNext = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
context.canPlayPosition = (playerPos, targetPos) => String(playerPos || '').split('/').map(value => value.trim()).includes(targetPos);
context.calcTeamLineup = (teamId) => {
  const roster = context.LEAGUE_PLAYER_DATA[teamId] || [];
  const starters = {};
  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(position => {
    const candidate = roster
      .filter(player => context.canPlayPosition(player.pos, position))
      .sort((a, b) => (Number(b.ovr) || 0) - (Number(a.ovr) || 0))[0];
    if (candidate) starters[position] = candidate;
  });
  return { starters, bench: [] };
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8'), context, { filename: 'js/offseason.js' });

function player(id, ovr, pos, age, extra) {
  return Object.assign({ id, cname: id, ovr, pos, _age: age, contract: 3 }, extra || {});
}

// B 队已有高水平 SG，但 C 位很弱；这覆盖“不同位置球星不应成为全队禁签”的场景。
context.LEAGUE_PLAYER_DATA.A = [
  player('A-SG-STAR', 84, 'SG', 27, { _lastTeam: 'A', _teamTenure: 4, _birdTeam: 'A' }),
  player('A-PG', 72, 'PG', 27), player('A-SF', 72, 'SF', 27), player('A-PF', 72, 'PF', 27), player('A-C', 72, 'C', 27),
];
context.LEAGUE_PLAYER_DATA.B = [
  player('B-SG-STAR', 84, 'SG', 27),
  player('B-PG', 66, 'PG', 27), player('B-SF', 66, 'SF', 27), player('B-PF', 66, 'PF', 27), player('B-C', 66, 'C', 27),
];
context.LEAGUE_PLAYER_DATA.C = Array.from({ length: 18 }, (_, index) => player('C-' + index, 65, index % 5 === 0 ? 'C' : 'SF', 27));
for (const teamId of ['A', 'B']) {
  while (context.LEAGUE_PLAYER_DATA[teamId].length < 18) {
    const index = context.LEAGUE_PLAYER_DATA[teamId].length;
    context.LEAGUE_PLAYER_DATA[teamId].push(player(teamId + '-depth-' + index, 65, 'SF', 27));
  }
}

context._playerAges = {};
context._playerGenes = {};
for (const roster of Object.values(context.LEAGUE_PLAYER_DATA)) {
  for (const current of roster) context._playerGenes[current.id] = { v: 1, potential: current.ovr, loyalty: 50, loyaltyVersion: 3, loyaltyRenewals: 0, loyaltyLastEvent: '', loyaltyTeam: '', roleUnderuseSeasons: 0 };
}

const superstar = player('FA-SUPERSTAR', 98, 'C', 31, {
  _origTeam: 'A',
  _lastTeam: 'A',
  _teamTenure: 5,
  _birdTeam: 'A',
  contract: 0,
});
const fringe = player('FA-FRINGE', 72, 'PG', 33, {
  _origTeam: 'B', contract: 0,
  threePT: 90, MID: 88, FIN: 76, DNK: 70, HAN: 82, PAS: 80,
  ATH: 90, STR: 84, REB: 70, PDEF: 86, IDEF: 60, STL: 78, BLK: 50, CLU: 82,
});
const protectedFreeAgent = player('FA-PROTECTED', 70, 'SF', 37, {
  _origTeam: 'C', contract: 0, _protectedRetirementAge: 65,
});
context.STATE._freeAgentPool = [superstar, fringe];
vm.runInContext('assignFreeAgents()', context);

const freeAgentIds = () => (context.STATE._freeAgentPool || []).map(current => current.id);
const signed = context.STATE._leagueChanges.freeSignings || [];
const superstarSigning = signed.find(entry => entry.playerId === 'FA-SUPERSTAR');
const initialUnsignedIds = freeAgentIds();

if (!superstarSigning) failures.push('98 OVR 超级球星没有生成任何签约');
if (freeAgentIds().includes('FA-SUPERSTAR')) failures.push('98 OVR 超级球星签约后仍错误留在自由市场');
if (!Object.values(context.LEAGUE_PLAYER_DATA).some(roster => roster.some(current => current.id === 'FA-SUPERSTAR'))) {
  failures.push('98 OVR 超级球星签约后没有出现在球队名单');
}
if (freeAgentIds().includes('FA-FRINGE')) failures.push('可替代低评分球员的自由球员仍因工资帽滞留');
if (!Object.values(context.LEAGUE_PLAYER_DATA).some(roster => roster.some(current => current.id === 'FA-FRINGE'))) {
  failures.push('低评分自由球员没有在存在阵容位置的球队完成签约');
}
if (superstarSigning && superstarSigning.salary < 20) failures.push('超级球星市场薪资没有保持在顶薪档');
if (superstarSigning && superstarSigning.years > 5) failures.push('合同年限超过 Bird 权利上限');
if (context.STATE._freeAgentPool.some(current => current.id === 'FA-SUPERSTAR')) failures.push('自由市场池仍存在已签球员副本');

const carriedFringe = Object.assign({}, fringe, { id: 'FA-CARRIED', cname: 'FA-CARRIED', contract: 0 });
context.STATE._freeAgentPool = [carriedFringe, protectedFreeAgent];
context.SIM_CONFIG = { ATTR_LIST: ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'ATH', 'STR', 'REB', 'PDEF', 'IDEF', 'STL', 'BLK', 'CLU'] };
context.calcOVR = current => Number(current.ovr) || 60;
context.rngNext = () => 0.1;
const fringeAgeBeforeCarry = carriedFringe._age;
const fringeAttrsBeforeCarry = { threePT: carriedFringe.threePT, ATH: carriedFringe.ATH, PDEF: carriedFringe.PDEF };
vm.runInContext('evolveUnsignedFreeAgents()', context);
if (!context.STATE._freeAgentPool.some(current => current.id === 'FA-CARRIED')) failures.push('未签约球员跨赛季没有继续保留');
if (carriedFringe._age !== fringeAgeBeforeCarry + 1) failures.push('未签约球员跨赛季没有年龄推进');
if (!context.STATE._freeAgentPool.some(current => current.id === 'FA-PROTECTED')) failures.push('受保护退役球员进入 FA 后被错误退休');
if (context.STATE._leagueChanges.retired.some(current => current.playerId === 'FA-PROTECTED')) failures.push('受保护退役球员的 FA 退休保护失效');
if (carriedFringe.threePT === fringeAttrsBeforeCarry.threePT && carriedFringe.ATH === fringeAttrsBeforeCarry.ATH && carriedFringe.PDEF === fringeAttrsBeforeCarry.PDEF) {
  failures.push('未签 FA 的 OVR 衰退没有同步到球员属性');
}

const market = vm.runInContext(`({
  superstar: getPlayerMarketValue({ ovr: 98, _age: 31 }),
  fringe: getPlayerMarketValue({ ovr: 72, _age: 35 }),
  birdYears: randomContractByAge(31, { ovr: 98 }, { birdRights: true }),
  externalYears: randomContractByAge(31, { ovr: 98 }, { birdRights: false })
})`, context);
if (!(market.superstar >= 30 && market.superstar <= 32)) failures.push(`98 OVR 市场价值不在 30 左右：${market.superstar}`);
if (!(market.fringe >= 1 && market.fringe <= 5)) failures.push(`72 OVR 老将市场价值异常：${market.fringe}`);
if (market.birdYears > 5 || market.externalYears > 4) failures.push('Bird/外队合同年限上限异常');

// 现有合同不能再默认等于今天的市场价；薪资仍应计入球队成本，
// 但不再作为自由市场/续约报价的硬性否决条件。
const initialContractPlayer = context.LEAGUE_PLAYER_DATA.A[0];
const initialMarketValue = vm.runInContext('getPlayerMarketValue(LEAGUE_PLAYER_DATA.A[0])', context);
const initialContractSalary = vm.runInContext('getPlayerSalary(LEAGUE_PLAYER_DATA.A[0])', context);
if (!(initialContractSalary > 0 && initialContractSalary < initialMarketValue)) failures.push('初始合同工资仍直接使用市场价');

context.LEAGUE_PLAYER_DATA.A = [
  player('CAP-A-1', 86, 'PG', 27, { salary: 25, _salaryVersion: 2, contract: 0, _teamTenure: 1, _lastTeam: 'A' }),
  player('CAP-A-2', 86, 'SG', 27, { salary: 25, _salaryVersion: 2, contract: 2 }),
  player('CAP-A-3', 86, 'SF', 27, { salary: 25, _salaryVersion: 2, contract: 2 }),
  player('CAP-A-4', 86, 'PF', 27, { salary: 25, _salaryVersion: 2, contract: 2 }),
  player('CAP-A-5', 86, 'C', 27, { salary: 25, _salaryVersion: 2, contract: 2 }),
];
const nonBirdRenewal = player('CAP-NON-BIRD', 86, 'PG', 27, {
  salary: 25, _salaryVersion: 2, contract: 0, _teamTenure: 1, _lastTeam: 'A',
});
const birdRenewal = player('CAP-BIRD', 86, 'PG', 27, {
  salary: 25, _salaryVersion: 2, contract: 0, _teamTenure: 4, _lastTeam: 'A', _birdTeam: 'A',
});
const birdOverApronOffer = vm.runInContext('buildContractOffer', context)(birdRenewal, 'A', { source: 'retention', birdRights: true, salary: 16, years: 2 });
context.LEAGUE_PLAYER_DATA.A.forEach(current => { current.salary = 23; });
const nonBirdOffer = vm.runInContext('buildContractOffer', context)(nonBirdRenewal, 'A', { source: 'retention', birdRights: false, salary: 16, years: 2 });
const birdOffer = vm.runInContext('buildContractOffer', context)(birdRenewal, 'A', { source: 'retention', birdRights: true, salary: 16, years: 2 });
if (!birdOverApronOffer) failures.push('工资帽不应阻止 Bird 续约');
if (!nonBirdOffer) failures.push('工资帽不应阻止 non-Bird 续约');
if (!birdOffer) failures.push('正常 Bird 续约被错误拒绝');

// 外部自由球员不能让球队拥有第 4 名 90+；原队回签和低于 90 的球员不受影响。
context.STATE.careerTeam = null;
context.STATE.finalOVR = 0;
context.LEAGUE_PLAYER_DATA.A = [
  player('NINETY-A-1', 92, 'PG', 27),
  player('NINETY-A-2', 91, 'SG', 27),
  player('NINETY-A-3', 90, 'SF', 27),
  player('NINETY-A-DEPTH', 70, 'PF', 27),
];
const externalNinetyPlus = player('FA-EXTERNAL-90', 90, 'C', 27, { _origTeam: 'B', contract: 0 });
const originalTeamReturn = player('FA-RETURN-90', 90, 'C', 27, { _origTeam: 'A', contract: 0 });
const externalBelowThreshold = player('FA-EXTERNAL-89', 89, 'C', 27, { _origTeam: 'B', contract: 0 });
const blockedExternalOffer = vm.runInContext('buildFreeAgentOffer', context)(externalNinetyPlus, 'A', 0, context.STATE._prevStandings);
const returnOffer = vm.runInContext('buildFreeAgentOffer', context)(originalTeamReturn, 'A', 0, context.STATE._prevStandings);
const belowThresholdOffer = vm.runInContext('buildFreeAgentOffer', context)(externalBelowThreshold, 'A', 0, context.STATE._prevStandings);
if (blockedExternalOffer) failures.push('已有 3 名 90+ 的球队仍向外部 90+ 自由球员报价');
if (!returnOffer) failures.push('已有 3 名 90+ 时原队回签被错误阻止');
if (!belowThresholdOffer) failures.push('已有 3 名 90+ 时外部 89 OVR 签约被错误阻止');
context.STATE.careerTeam = 'A';
context.STATE.finalOVR = 90;
context.STATE.career = { currentAge: 24, contract: 2, flags: {} };
if (vm.runInContext('getTeamNinetyPlusCount("A")', context) !== 4) failures.push('玩家球员没有计入球队 90+ 人数上限');
context.STATE.careerTeam = null;
context.STATE.finalOVR = 0;

// 21 岁 87 OVR 球员即使四轮市场没有其它合适报价，母队也必须拥有回签兜底。
context.LEAGUE_PLAYER_DATA.A = Array.from({ length: 18 }, (_, index) => player('YOUNG-A-' + index, 70 + (index % 3), 'SF', 27, {
  salary: 20, _salaryVersion: 2, contract: 2,
}));
context.LEAGUE_PLAYER_DATA.B = Array.from({ length: 18 }, (_, index) => player('YOUNG-B-' + index, 88 + (index % 2), 'SF', 27, {
  salary: 20, _salaryVersion: 2, contract: 2,
}));
context.LEAGUE_PLAYER_DATA.C = Array.from({ length: 18 }, (_, index) => player('YOUNG-C-' + index, 88 + (index % 2), 'SF', 27, {
  salary: 20, _salaryVersion: 2, contract: 2,
}));
const youngCore = player('FA-YOUNG-CORE', 87, 'PG', 21, { _origTeam: 'A', _lastTeam: 'A', _teamTenure: 2, contract: 0 });
context.STATE._leagueChanges = {};
context.STATE._freeAgentPool = [youngCore];
vm.runInContext('assignFreeAgents()', context);
if ((context.STATE._freeAgentPool || []).some(current => current.id === 'FA-YOUNG-CORE')) failures.push('年轻 87 OVR 球员仍在自由市场无人签约');
if (!context.LEAGUE_PLAYER_DATA.A.some(current => current.id === 'FA-YOUNG-CORE')) failures.push('年轻核心没有被母队回签');

// 玩家合同也要成为目标球队的真实工资和阵容名额。
context.STATE.careerTeam = 'A';
context.STATE.finalOVR = 90;
context.STATE.position = 'PG';
context.STATE.attrs = {};
context.STATE.career = { currentAge: 24, contract: 2, salary: 10, _salaryVersion: 2, teamTenure: 2, flags: {} };
const payrollWithoutUser = vm.runInContext('getTeamPayrollExcludingPlayer("A", getCareerPlayerContractSnapshot())', context);
const payrollWithUser = vm.runInContext('getTeamPayroll("A")', context);
if (Math.abs(payrollWithUser - payrollWithoutUser - 10) > 0.001) failures.push('玩家工资没有计入球队 payroll');
if (vm.runInContext('getTeamRosterCount("A")', context) !== context.LEAGUE_PLAYER_DATA.A.length + 1) failures.push('玩家没有占用球队阵容名额');

context.LEAGUE_PLAYER_DATA.CAREER_TARGET = Array.from({ length: 18 }, (_, index) => player('CAREER-TARGET-' + index, 65, 'SF', 27, { salary: 1, _salaryVersion: 2 }));
const careerOffer = vm.runInContext('buildCareerContractOffer', context)('CAREER_TARGET', 2);
if (!careerOffer || !careerOffer.rosterCut) failures.push('玩家外部签约没有按阵容名额生成裁员方案');
if (careerOffer && !vm.runInContext('applyCareerContractOffer', context)('CAREER_TARGET', careerOffer, 'A')) failures.push('玩家合法合同没有成功应用');
if (context.LEAGUE_PLAYER_DATA.CAREER_TARGET.length !== 17) failures.push('玩家签约后目标球队仍超过 18 人名额');

// 交易后工资不能越过二土豪线。
context.LEAGUE_PLAYER_DATA.TRADE_A = [player('TRADE-A-1', 80, 'PG', 27, { salary: 1, _salaryVersion: 2 }), player('TRADE-A-2', 80, 'SG', 27, { salary: 129, _salaryVersion: 2 })];
context.LEAGUE_PLAYER_DATA.TRADE_B = [player('TRADE-B-1', 80, 'PG', 27, { salary: 129, _salaryVersion: 2 })];
context.STATE.careerTeam = null;
context.STATE._leagueChanges.trades = [];
const tradeAPlayer = context.LEAGUE_PLAYER_DATA.TRADE_A[0];
const tradeBPlayer = context.LEAGUE_PLAYER_DATA.TRADE_B[0];
const tradeBefore = JSON.stringify(context.LEAGUE_PLAYER_DATA.TRADE_A.map(current => current.id));
if (vm.runInContext('swapRosterPlayers', context)('TRADE_A', 'TRADE_B', tradeBPlayer, tradeAPlayer)) failures.push('交易工资越过二土豪线仍被执行');
if (JSON.stringify(context.LEAGUE_PLAYER_DATA.TRADE_A.map(current => current.id)) !== tradeBefore) failures.push('非法工资交易修改了球队名单');

// 完整生命周期回归：上一季未签 FA 不能被本季新到期球员覆盖。
const oldFreeAgent = player('FA-OLD', 72, 'PG', 27, { _origTeam: 'B', contract: 0 });
const newlyExpired = player('FA-NEW', 70, 'PG', 27, { contract: 1, _lastTeam: 'A', _teamTenure: 1 });
context.LEAGUE_PLAYER_DATA.A = [newlyExpired];
context.LEAGUE_PLAYER_DATA.B = [];
context.LEAGUE_PLAYER_DATA.C = [];
context.STATE._freeAgentPool = [oldFreeAgent];
context.STATE._contractsInited = true;
context.STATE._teamHistory = {};
context.STATE.season = { leaguePlayerSeasonStats: {} };
context.SIM_CONFIG = { ATTR_LIST: [] };
context._playerGenes = {
  'FA-NEW': { v: 1, potential: 70, loyalty: 50, loyaltyVersion: 3, loyaltyRenewals: 0, loyaltyLastEvent: '', loyaltyTeam: '', roleUnderuseSeasons: 0 },
  'FA-OLD': { v: 1, potential: 72, loyalty: 50, loyaltyVersion: 3, loyaltyRenewals: 0, loyaltyLastEvent: '', loyaltyTeam: '', roleUnderuseSeasons: 0 },
};
try {
  vm.runInContext(`
    syncLeaguePlayerOvrs = function() { return 0; };
    updatePlayerRoleSatisfactionHistory = function() { return 0; };
    calculateContractStayRate = function() { return 0; };
    isMvpStar = function() { return false; };
    calcOVR = function(current) { return Number(current.ovr) || 60; };
    evolveLeague();
  `, context);
} catch (error) {
  failures.push('完整 evolveLeague 生命周期测试抛出异常：' + error.message);
}

const afterEvolvePool = context.STATE._freeAgentPool || [];
const afterEvolveIds = afterEvolvePool.map(current => current.id);
if (!afterEvolveIds.includes('FA-OLD')) failures.push('完整 evolveLeague 后旧 FA 被覆盖');
if (!afterEvolveIds.includes('FA-NEW')) failures.push('完整 evolveLeague 后新到期 FA 缺失');
if (new Set(afterEvolveIds).size !== afterEvolveIds.length) failures.push('完整 evolveLeague 后 FA 池出现重复 ID');
if (context.STATE._leagueChanges.freeAgentCount !== 2) failures.push(`完整 evolveLeague 的 freeAgentCount 异常：${context.STATE._leagueChanges.freeAgentCount}`);

try {
  vm.runInContext('assignFreeAgents()', context);
} catch (error) {
  failures.push('合并后的 FA 池进入 assignFreeAgents 时抛出异常：' + error.message);
}
for (const id of ['FA-OLD', 'FA-NEW']) {
  const rosterCount = Object.values(context.LEAGUE_PLAYER_DATA).reduce((count, roster) => count + roster.filter(current => current.id === id).length, 0);
  const poolCount = (context.STATE._freeAgentPool || []).filter(current => current.id === id).length;
  const retiredCount = (context.STATE._leagueChanges.retired || []).filter(current => current.playerId === id).length;
  if (rosterCount + poolCount + retiredCount !== 1) failures.push(`${id} 生命周期归属不是恰好一种：${rosterCount}/${poolCount}/${retiredCount}`);
}

const lifecycleFinalPoolIds = (context.STATE._freeAgentPool || []).map(current => current.id);

async function validateBatchedFreeAgentAssignment() {
  const teamIds = ['A', 'B', 'C'];
  for (const teamId of teamIds) {
    context.LEAGUE_PLAYER_DATA[teamId] = Array.from({ length: 18 }, (_, index) => (
      player(`ASYNC-${teamId}-${index}`, 64 + (index % 4), ['PG', 'SG', 'SF', 'PF', 'C'][index % 5], 27, {
        salary: 1,
        _salaryVersion: 2,
      })
    ));
  }
  const asyncPool = Array.from({ length: 12 }, (_, index) => (
    player(`ASYNC-FA-${index}`, 79 - (index % 8), ['PG', 'SG', 'SF', 'PF', 'C'][index % 5], 25 + (index % 7), {
      _origTeam: teamIds[index % teamIds.length],
      contract: 0,
    })
  ));
  context.STATE.careerTeam = null;
  context.STATE._leagueChanges = {};
  context.STATE._freeAgentPool = asyncPool;
  context._playerGenes = {};

  let scheduledBatches = 0;
  context.setTimeout = callback => {
    scheduledBatches += 1;
    return setImmediate(callback);
  };

  const result = vm.runInContext(
    'assignFreeAgents({ yieldToBrowser: true, batchSize: 1, timeBudgetMs: 4 })',
    context,
  );
  if (!result || typeof result.then !== 'function') {
    failures.push('自由球员分批模式没有返回可等待的 Promise');
    return scheduledBatches;
  }
  await result;

  if (scheduledBatches <= 1) failures.push('自由球员分批模式没有主动让出主线程');
  for (const current of asyncPool) {
    const rosterCount = teamIds.reduce((count, teamId) => (
      count + context.LEAGUE_PLAYER_DATA[teamId].filter(item => item.id === current.id).length
    ), 0);
    const poolCount = (context.STATE._freeAgentPool || []).filter(item => item.id === current.id).length;
    if (rosterCount + poolCount !== 1) failures.push(`${current.id} 分批签约后的归属异常：${rosterCount}/${poolCount}`);
  }
  return scheduledBatches;
}

validateBatchedFreeAgentAssignment().then(scheduledBatches => {
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log(JSON.stringify({
    signedSuperstar: superstarSigning,
    initialUnsignedIds,
    market,
    lifecycle: {
      afterEvolveIds,
      finalPoolIds: lifecycleFinalPoolIds,
    },
    asyncAssignment: { scheduledBatches },
  }, null, 2));
}).catch(error => {
  console.error('分批自由球员测试抛出异常：' + (error && error.stack ? error.stack : error));
  process.exit(1);
});
