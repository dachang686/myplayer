const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const failures = [];
let randomValue = 0.99;

const testMath = {};
Object.getOwnPropertyNames(Math).forEach((name) => {
  Object.defineProperty(testMath, name, Object.getOwnPropertyDescriptor(Math, name));
});
testMath.random = () => randomValue;

function rosterPlayer(id, pos, salary) {
  return {
    id,
    cname: id,
    pos: pos || 'SF',
    ovr: 70,
    _age: 27,
    contract: 2,
    salary,
    _salaryVersion: 2,
  };
}

const context = {
  console: { log() {}, error() {} },
  Math: testMath,
  Set,
  Map,
  Object,
  JSON,
  String,
  Number,
  Array,
  window: {},
  document: { getElementById() { return null; } },
  LEAGUE_TEAM_IDS: ['A', 'B', 'C'],
  LEAGUE_PLAYER_DATA: { A: [], B: [], C: [] },
  STATE: {
    careerTeam: 'A',
    finalOVR: 70,
    finalPosition: 'PG',
    position: 'PG',
    attrs: {},
    career: {
      seasonCount: 5,
      currentAge: 30,
      contract: 0,
      salary: 10,
      _salaryVersion: 2,
      teamTenure: 2,
      flags: {},
      mobility: { nonRenewals: 4 },
      honors: [],
      draft: { type: 'drafted' },
    },
    season: { isUserStarter: true, playerStats: { games: 1, mins: 30 } },
    _prevStandings: {
      A: { wins: 40, losses: 42 },
      B: { wins: 41, losses: 41 },
      C: { wins: 42, losses: 40 },
    },
    _leagueChanges: { trades: [] },
  },
  rngNext: () => 0.5,
  canPlayPosition: (playerPos, targetPos) => String(playerPos || '').split('/').includes(targetPos),
  calcTeamLineup: (teamId) => ({
    starters: { PG: { id: teamId + '-PG', pos: 'PG', ovr: 70 } },
    bench: [],
  }),
  setBranchNode() {},
  getMyPlayerDisplayName: () => '测试球员',
};

vm.createContext(context);
vm.runInContext(source, context, { filename: 'js/offseason.js' });

// 同一球员先进入自由市场、随后被原球队签回时，汇总应只显示回签，不能同时显示离队。
context.STATE._leagueChanges = {
  freeAgents: [
    { playerId: 'BARNES', name: '巴恩斯', team: 'A', reason: 'contract_expired' },
    { playerId: 'OTHER-BARNES', name: '巴恩斯', team: 'A', reason: 'contract_expired' },
  ],
  freeSignings: [
    { playerId: 'BARNES', name: '巴恩斯', from: 'A', to: 'A', returned: true, years: 1 },
  ],
  stayed: [],
  retired: [],
  rookies: [],
  trades: [],
};
const careerTeamChanges = context.getCareerTeamOffseasonChanges('A');
if (careerTeamChanges.departures.some((row) => row.playerId === 'BARNES')) {
  failures.push('母队回签的巴恩斯仍被重复显示为离队');
}
if (!careerTeamChanges.departures.some((row) => row.playerId === 'OTHER-BARNES')) {
  failures.push('同名但不同 ID 的巴恩斯被错误合并');
}
if (!careerTeamChanges.signings.some((row) => row.playerId === 'BARNES')) {
  failures.push('母队回签的巴恩斯没有显示为签约');
}

// 历史不续约次数不能让以后的球队自动愿意续约，且同队同季的决定必须稳定。
if (context.getTeamRenewalWillingness()) failures.push('历史不续约次数错误导致当前球队自动续约');
randomValue = 0;
if (context.getTeamRenewalWillingness()) failures.push('同球队同赛季的续约决定在重新打开时发生了变化');
context.STATE.careerTeam = 'B';
if (!context.getTeamRenewalWillingness()) failures.push('换队后没有按新球队状态重新计算续约意愿');

context.STATE.careerTeam = 'A';
context.STATE.career.mobility.lastNonRenewalTeam = null;
context.STATE.career.mobility.lastNonRenewalSeason = 0;
const nonRenewalsBefore = context.STATE.career.mobility.nonRenewals;
if (!context.recordTeamNonRenewal()) failures.push('首次不续约事件没有被记录');
if (context.recordTeamNonRenewal()) failures.push('同球队同赛季的不续约事件被重复记录');
if (context.STATE.career.mobility.nonRenewals !== nonRenewalsBefore + 1) failures.push('不续约计数没有保持同队同季幂等');
context.STATE.careerTeam = 'B';
if (!context.recordTeamNonRenewal() || context.STATE.career.mobility.nonRenewals !== nonRenewalsBefore + 2) failures.push('新球队的不续约事件没有独立记录');
const nonRenewalsAfter = context.STATE.career.mobility.nonRenewals;

// 生涯早期荣誉不应终身保护；当前顶级能力或近两季荣誉才能触发保护。
context.STATE.career.honors = [{ seasonNum: 1, label: '全明星' }];
context.STATE.career.currentAge = 35;
context.STATE.finalOVR = 80;
if (context.isUserStarProtected()) failures.push('早期全明星荣誉仍在生涯后期提供终身保护');
context.STATE.career.honors = [{ seasonNum: 5, label: '最佳阵容二阵' }];
context.STATE.career.currentAge = 30;
context.STATE.finalOVR = 83;
if (!context.isUserStarProtected()) failures.push('近两季明星荣誉与当前能力没有提供合理保护');
context.STATE.career.currentAge = 35;
if (context.isUserStarProtected()) failures.push('超出明星保护年龄后仍因历史荣誉受保护');
context.STATE.finalOVR = 88;
if (!context.isUserStarProtected()) failures.push('当前 88 OVR 球星没有获得保护');

// 球队没有 R 开头的旧新秀时，当届新秀也必须真正进入名单。
context.STATE._prevStandings = {
  A: { wins: 10, losses: 72 },
  B: { wins: 30, losses: 52 },
  C: { wins: 50, losses: 32 },
};
context.LEAGUE_TEAM_IDS.forEach((teamId) => {
  context.LEAGUE_PLAYER_DATA[teamId] = [rosterPlayer(teamId + '-BASE', 'SF', 1)];
});
let rookieIndex = 0;
let capacityCalls = 0;
context.generateRookie = () => ({ id: 'NEW-' + (++rookieIndex), cname: 'NEW-' + rookieIndex, pos: 'PG', ovr: 65, _age: 19 });
context.applyRookieAttributeProfile = () => {};
context.getRookieContractLoyalty = () => 50;
context.enforceLeagueRosterCapacity = () => { capacityCalls += 1; };
context.processDraft();
for (const teamId of context.LEAGUE_TEAM_IDS) {
  if (context.LEAGUE_PLAYER_DATA[teamId].length !== 2) failures.push(teamId + ' 的当届新秀在没有旧 R 球员时被丢弃');
}
if (rookieIndex !== 3 || capacityCalls !== 1) failures.push('选秀没有为每队加入一名新秀并统一执行阵容容量校验');
const draftCapacityCalls = capacityCalls;

// 高薪球队无法提供常规报价时，可以提供仍在一土豪线内的一年底薪合同。
context.STATE.careerTeam = 'A';
context.STATE.finalOVR = 90;
context.STATE.position = 'PG';
context.STATE.career.currentAge = 26;
context.STATE.career.contract = 0;
context.STATE.career.flags = {};
context.STATE.career.teamTenure = 2;
context.LEAGUE_PLAYER_DATA.A = [];
for (const teamId of ['B', 'C']) {
  context.LEAGUE_PLAYER_DATA[teamId] = Array.from({ length: 12 }, (_, index) => rosterPlayer(teamId + '-CAP-' + index, index === 0 ? 'PG' : 'SF', 125 / 12));
}
context.calcTeamLineup = (teamId) => ({
  starters: { PG: context.LEAGUE_PLAYER_DATA[teamId][0] || { ovr: 70 } },
  bench: [],
});
const emergencyOffers = context.generateContractOffers();
if (emergencyOffers.length === 0) failures.push('常规报价全部非法时没有生成合法底薪兜底');
for (const offer of emergencyOffers) {
  if (offer.round !== 4 || offer.salary !== 1 || offer.years !== 1 || !offer.contractOffer.emergencyMinimum) failures.push('底薪兜底报价的年限/薪资/轮次标记不正确');
  if (offer.payrollAfterSigning > context.FREE_AGENT_MARKET.firstApron + 0.001) failures.push('底薪兜底报价越过一土豪线');
  const rebuilt = context.buildCareerContractOffer(offer.team, offer.years, offer.round);
  if (!rebuilt || rebuilt.salary !== 1 || rebuilt.years !== 1 || rebuilt.round !== 4) failures.push('用户选择底薪报价时无法重建同一份合法合同');
}

// Bird 只能突破软帽，签约后不能突破本游戏的二土豪线硬上限。
const birdPlayer = rosterPlayer('BIRD-PLAYER', 'PG', 0);
birdPlayer.contract = 0;
context.LEAGUE_PLAYER_DATA.B = [rosterPlayer('B-PAYROLL', 'SF', 130)];
const birdOverApron = context.buildContractOffer(birdPlayer, 'B', {
  source: 'retention',
  birdRights: true,
  salary: 5,
  years: 2,
});
context.LEAGUE_PLAYER_DATA.B[0].salary = 129;
const birdAtApron = context.buildContractOffer(birdPlayer, 'B', {
  source: 'retention',
  birdRights: true,
  salary: 5,
  years: 2,
});
if (birdOverApron) failures.push('Bird 签约后 135 超过二土豪线仍被判定为合法');
if (!birdAtApron || Math.abs(birdAtApron.payrollAfterSigning - 134) > 0.001) failures.push('Bird 签约后正好 134 被错误拒绝');

// 统一交易展示规约：playerB 从 from 前往 to，playerA 反向前往 from。
context.getTeamName = (teamId) => teamId;
context.addProfileDelta = () => {};
context.addSeasonMod = () => {};
context.syncNarrativeAfterPlayerTeamChange = () => {};
context.showOffseasonResultModal = (title, message, done) => { if (done) done(); };
context.showMobilityChoiceModal = (title, message, choices, done) => { if (done) done(); };
context.STATE.careerTeam = 'A';
context.STATE.career.contract = 2;
context.STATE.career.salary = 10;
context.STATE.career.mobility = {};
context.STATE._leagueChanges.trades = [];
context.LEAGUE_PLAYER_DATA.C = [rosterPlayer('C-LOW-PAYROLL', 'SF', 1)];
context.doTradeUser('C', () => {});
const teamTradeLog = context.STATE._leagueChanges.trades[0];
if (!teamTradeLog || teamTradeLog.playerB !== '测试球员' || teamTradeLog.playerA !== '选秀权' || teamTradeLog.from !== 'A' || teamTradeLog.to !== 'C') {
  failures.push('球队主动交易记录的球员/资产流向错误');
}

context.STATE.careerTeam = 'A';
context.STATE.career.teamTenure = 2;
context.STATE._leagueChanges.trades = [];
context.LEAGUE_PLAYER_DATA.B = [rosterPlayer('B-LOW-PAYROLL', 'SF', 1)];
const request = { preferredTeam: 'B', status: 'approved' };
context.completePlayerRequestedTrade('B', request, () => {});
const requestedTradeLog = context.STATE._leagueChanges.trades[0];
if (!requestedTradeLog || requestedTradeLog.playerB !== '测试球员' || requestedTradeLog.playerA !== '未来资产' || requestedTradeLog.from !== 'A' || requestedTradeLog.to !== 'B') {
  failures.push('玩家申请交易记录的球员/资产流向错误');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  renewal: {
    historicalNonRenewals: nonRenewalsBefore,
    finalNonRenewals: nonRenewalsAfter,
  },
  draft: { rookiesAdded: rookieIndex, capacityCalls: draftCapacityCalls },
  bird: {
    overApronRejected: !birdOverApron,
    atApronAccepted: !!birdAtApron,
  },
  trades: {
    teamInitiated: teamTradeLog,
    playerRequested: requestedTradeLog,
  },
  emergencyOffers: emergencyOffers.map((offer) => ({
    team: offer.team,
    salary: offer.salary,
    years: offer.years,
    round: offer.round,
    payrollAfterSigning: offer.payrollAfterSigning,
  })),
}, null, 2));
