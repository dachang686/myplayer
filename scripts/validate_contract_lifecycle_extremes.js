const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const offseasonSource = fs.readFileSync(path.join(root, 'js', 'offseason.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function makePlayer(id, contract, extra = {}) {
  return Object.assign({
    id,
    cname: id,
    ovr: 80,
    pos: 'SF',
    _age: 27,
    contract,
    salary: 8,
    _salaryVersion: 2,
    _lastTeam: 'A',
    _teamTenure: 2,
  }, extra);
}

const geneById = {};
const context = {
  console: { log() {}, error() {} },
  window: {},
  document: { getElementById() { return null; } },
  LEAGUE_TEAM_IDS: ['A', 'B'],
  LEAGUE_PLAYER_DATA: { A: [], B: [] },
  STATE: {
    careerTeam: null,
    finalOVR: 0,
    position: null,
    attrs: {},
    career: null,
    season: { leaguePlayerSeasonStats: {} },
    _prevStandings: { A: { wins: 50, losses: 32 }, B: { wins: 32, losses: 50 } },
    _teamHistory: { A: [0.61, 0.58, 0.55], B: [0.39, 0.42, 0.45] },
    _leagueChanges: {},
    _freeAgentPool: [],
    _contractsInited: true,
  },
  rngNext: () => 0.5,
  canPlayPosition: () => true,
  calcTeamLineup(teamId) {
    const roster = context.LEAGUE_PLAYER_DATA[teamId] || [];
    return { starters: { PG: roster[0], SG: roster[1], SF: roster[2], PF: roster[3], C: roster[4] }, bench: roster.slice(5) };
  },
  clearLineupCache() {},
  getMyPlayerDisplayName: () => '合同测试球员',
};
vm.createContext(context);
vm.runInContext(offseasonSource, context, { filename: 'js/offseason.js' });

context.syncLeaguePlayerOvrs = () => 0;
context.updatePlayerRoleSatisfactionHistory = () => 0;
context.getLeaguePlayerSeasonRoleContext = () => ({ role: 'rotation', minutes: 20 });
context.getPotentialGrowthBias = () => 0;
context.isMvpStar = () => false;
context.getLeaguePlayerRetirementChance = () => 0;
context.refreshGeneratedPlayerType = () => {};
context.getPlayerGene = player => {
  if (!geneById[player.id]) {
    geneById[player.id] = {
      v: 0, potential: 99, loyalty: 50, loyaltyVersion: 3,
      loyaltyRenewals: 0, loyaltyLastEvent: '', loyaltyTeam: '', roleUnderuseSeasons: 0,
    };
  }
  return geneById[player.id];
};
context.calculateContractStayRate = player => player.id === 'RENEW-1' ? 1 : 0;

const contractPlayers = [
  makePlayer('ONGOING-3', 3),
  makePlayer('RENEW-1', 1, { _teamTenure: 4, _birdTeam: 'A' }),
  makePlayer('LEAVE-1', 1),
  makePlayer('EXPIRED-0', 0),
  makePlayer('INVALID-NAN', NaN),
  makePlayer('INVALID-INF', Infinity),
  makePlayer('STRING-2', '2'),
];
context.LEAGUE_PLAYER_DATA.A = contractPlayers.slice();
context.LEAGUE_PLAYER_DATA.B = [];
context.evolveLeague();

const rosterIdsAfterEvolution = context.LEAGUE_PLAYER_DATA.A.map(player => player.id);
const poolIdsAfterEvolution = context.STATE._freeAgentPool.map(player => player.id);
const freeAgentCountAfterEvolution = context.STATE._leagueChanges.freeAgentCount;
const ongoing = context.LEAGUE_PLAYER_DATA.A.find(player => player.id === 'ONGOING-3');
const renewed = context.LEAGUE_PLAYER_DATA.A.find(player => player.id === 'RENEW-1');
const stringContract = context.LEAGUE_PLAYER_DATA.A.find(player => player.id === 'STRING-2');
check(ongoing && ongoing.contract === 2, `3年合同没有准确递减为2：${ongoing && ongoing.contract}`);
check(stringContract && stringContract.contract === 1, `字符串合同年限没有规范为1：${stringContract && stringContract.contract}`);
check(renewed && Number.isInteger(renewed.contract) && renewed.contract >= 1 && renewed.contract <= 5,
  `到期 Bird 续约年限非法：${renewed && renewed.contract}`);
check(renewed && Number.isFinite(renewed.salary) && renewed.salary >= 1, '续约工资没有合法落盘');
check((context.STATE._leagueChanges.stayed || []).filter(entry => entry.playerId === 'RENEW-1').length === 1,
  '同一球员续约日志不是恰好一条');
['LEAVE-1', 'EXPIRED-0', 'INVALID-NAN', 'INVALID-INF'].forEach(id => {
  check(poolIdsAfterEvolution.includes(id), `${id} 没有在合同到期/损坏后进入自由市场`);
  check(!rosterIdsAfterEvolution.includes(id), `${id} 同时留在球队名单和自由市场`);
  const player = context.STATE._freeAgentPool.find(item => item.id === id);
  check(player && player.contract === 0 && player.salary === undefined, `${id} 的自由球员合同状态没有清零`);
});
check(new Set(poolIdsAfterEvolution).size === poolIdsAfterEvolution.length, '到期自由球员池出现重复ID');
check(context.STATE._leagueChanges.freeAgentCount === 4,
  `到期自由球员数量错误：${context.STATE._leagueChanges.freeAgentCount}`);

function resetCareerApplyState(rosterSize = 18) {
  context.STATE.careerTeam = 'A';
  context.STATE.finalOVR = 90;
  context.STATE.position = 'PG';
  context.STATE.attrs = {};
  context.STATE.career = {
    currentAge: 27,
    contract: 0,
    salary: 20,
    _salaryVersion: 2,
    teamTenure: 3,
    seasons: [{ seasonNum: 1, team: 'A' }, { seasonNum: 2, team: 'A' }, { seasonNum: 3, team: 'A' }],
    flags: {},
  };
  context.STATE.season = { isUserStarter: true, playerStats: { games: 82, mins: 2600 }, leaguePlayerSeasonStats: {} };
  context.STATE._freeAgentPool = [];
  context.STATE._leagueChanges = { freeAgents: [] };
  context.LEAGUE_PLAYER_DATA.A = Array.from({ length: 17 }, (_, index) => makePlayer(`APPLY-A-${index}`, 2));
  context.LEAGUE_PLAYER_DATA.B = Array.from({ length: rosterSize }, (_, index) => makePlayer(`APPLY-B-${index}`, 2, {
    ovr: 65 + (index % 5),
    _lastTeam: 'B',
  }));
}

function careerApplySnapshot() {
  return JSON.stringify({
    career: context.STATE.career,
    rosterA: context.LEAGUE_PLAYER_DATA.A.map(player => player.id),
    rosterB: context.LEAGUE_PLAYER_DATA.B.map(player => player.id),
    pool: context.STATE._freeAgentPool.map(player => player.id),
  });
}

resetCareerApplyState();
let before = careerApplySnapshot();
let applied = context.applyCareerContractOffer('B', {
  teamId: 'B', salary: NaN, years: 2, birdRights: false, rosterCuts: [],
}, 'A');
check(!applied, 'NaN工资的玩家合同仍被应用');
check(careerApplySnapshot() === before, 'NaN工资合同失败后改变了合同或名单');

resetCareerApplyState();
before = careerApplySnapshot();
applied = context.applyCareerContractOffer('B', {
  teamId: 'B', salary: 10, years: 0, birdRights: false, rosterCuts: [],
}, 'A');
check(!applied, '0年玩家合同仍被应用');
check(careerApplySnapshot() === before, '0年合同失败后改变了合同或名单');

resetCareerApplyState();
before = careerApplySnapshot();
applied = context.applyCareerContractOffer('B', {
  teamId: 'A', salary: 10, years: 2, birdRights: false, rosterCuts: [],
}, 'A');
check(!applied, '报价所属球队与目标球队不一致时仍被应用');
check(careerApplySnapshot() === before, '球队不匹配合同失败后改变了合同或名单');

resetCareerApplyState();
const duplicateCut = context.LEAGUE_PLAYER_DATA.B[0];
before = careerApplySnapshot();
applied = context.applyCareerContractOffer('B', {
  teamId: 'B', salary: 10, years: 2, birdRights: false, rosterCuts: [duplicateCut, duplicateCut],
}, 'A');
check(!applied, '重复裁员对象的合同仍被应用');
check(careerApplySnapshot() === before, '重复裁员合同失败后破坏了名单');

resetCareerApplyState();
const legalOffer = context.buildCareerContractOffer('B', 2, 0);
before = careerApplySnapshot();
check(!!legalOffer, '满员目标球队没有生成合法玩家合同及裁员方案');
applied = legalOffer && context.applyCareerContractOffer('B', legalOffer, 'A');
check(applied, '合法玩家外部合同没有成功应用');
check(context.STATE.career.contract === 2 && Number.isFinite(context.STATE.career.salary) && context.STATE.career.salary >= 1,
  '合法合同工资或年限没有落盘');
check(context.LEAGUE_PLAYER_DATA.B.length === 17, `玩家签约后的NPC名单不是17人：${context.LEAGUE_PLAYER_DATA.B.length}`);
check(context.STATE._freeAgentPool.length === 1, '为玩家腾名额的球员没有恰好一次进入自由市场');

const trainingStart = indexSource.indexOf('function getTrainingPointCost');
const trainingEnd = indexSource.indexOf('function continueCareerAfterTraining', trainingStart);
if (trainingStart < 0 || trainingEnd < 0) throw new Error('无法提取玩家合同年度递减逻辑');
const trainingContext = vm.createContext({
  ATTR_KEYS: [],
  STATE: {},
  calcTrainingPoints: () => 0,
  calcOVR: () => 80,
  saveCurrentSeasonToCareer() {},
  shouldOfferPlayerRetirement: () => false,
  showPlayerRetirementChoice() {},
  continueCareerAfterTraining() {},
  beginOffseasonDraft() {},
  renderTrainingCamp() {},
});
vm.runInContext(indexSource.slice(trainingStart, trainingEnd), trainingContext, { filename: 'career-contract-decrement.js' });

const careerContractCases = [
  { label: 'three', input: 3, expected: 2 },
  { label: 'one', input: 1, expected: 0 },
  { label: 'zero', input: 0, expected: 0 },
  { label: 'negative', input: -2, expected: 0 },
  { label: 'nan', input: NaN, expected: 0 },
  { label: 'infinity', input: Infinity, expected: 0 },
  { label: 'string', input: '2', expected: 1 },
];
const careerContractResults = {};
careerContractCases.forEach((testCase, index) => {
  trainingContext.STATE = {
    attrs: {}, finalOVR: 80, _tpPending: {}, season: {},
    career: { seasonCount: index + 1, currentAge: 25, contract: testCase.input, flags: {} },
  };
  trainingContext.confirmTraining();
  const actual = trainingContext.STATE.career.contract;
  careerContractResults[testCase.label] = Number.isFinite(actual) ? actual : String(actual);
  check(actual === testCase.expected, `玩家${testCase.label}合同年度递减错误：${String(actual)}`);
});

const contractTermBounds = [];
[21, 27, 34, 40].forEach(age => {
  [70, 86, 94, 99].forEach(ovr => {
    [0, 0.999999].forEach(randomValue => {
      context.rngNext = () => randomValue;
      [false, true].forEach(birdRights => {
        const years = context.randomContractByAge(age, { ovr }, { birdRights });
        const maxYears = age >= 34 ? 3 : (birdRights ? 5 : 4);
        check(Number.isInteger(years) && years >= 1 && years <= maxYears,
          `合同年限越界：${JSON.stringify({ age, ovr, randomValue, birdRights, years })}`);
        contractTermBounds.push({ age, ovr, randomValue, birdRights, years });
      });
    });
  });
});

const report = {
  npcEvolution: {
    rosterIds: rosterIdsAfterEvolution,
    freeAgentIds: poolIdsAfterEvolution,
    renewed: renewed ? { years: renewed.contract, salary: renewed.salary } : null,
    freeAgentCount: freeAgentCountAfterEvolution,
  },
  legalCareerOffer: legalOffer ? {
    years: legalOffer.years,
    salary: legalOffer.salary,
    rosterCuts: legalOffer.rosterCuts.length,
  } : null,
  careerContractResults,
  contractTermCases: contractTermBounds.length,
  failureCount: failures.length,
  failures: failures.slice(0, 50),
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
