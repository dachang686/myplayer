const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const failures = [];

function buildContext(targetPayroll) {
  const profile = {};
  const context = {
    console: { log() {}, error() {} },
    window: {},
    document: { getElementById() { return null; } },
    STATE: {
      careerTeam: 'A',
      finalOVR: 90,
      position: 'PG',
      attrs: {},
      career: {
        seasonCount: 0,
        contract: 3,
        currentAge: 25,
        salary: 20,
        _salaryVersion: 2,
        teamTenure: 2,
        flags: {},
        mobility: null,
        branchHistory: [],
        profile,
      },
      season: {
        wins: 4,
        losses: 6,
        isPlayoffs: false,
        isUserStarter: true,
        playerStats: { games: 2, mins: 80 },
        standings: { A: { wins: 4, losses: 6 }, B: { wins: 5, losses: 5 } },
      },
      _leagueChanges: { trades: [] },
    },
    LEAGUE_TEAM_IDS: ['A', 'B'],
    LEAGUE_PLAYER_DATA: {
      A: [],
      B: Array.from({ length: 6 }, (_, index) => ({
        id: 'B-' + index,
        cname: 'B-' + index,
        ovr: 70,
        pos: 'SF',
        _age: 27,
        salary: targetPayroll / 6,
        _salaryVersion: 2,
        contract: 2,
      })),
    },
    getCareerProfile: () => profile,
    getTeamName: team => team,
    getMyPlayerDisplayName: () => '测试球员',
    calcTeamLineup: () => ({ starters: { PG: { ovr: 70 } }, bench: [] }),
    canPlayPosition: () => true,
    addProfileDelta: () => {},
    addSeasonMod: () => {},
    setBranchNode: () => {},
    syncNarrativeAfterPlayerTeamChange: () => {},
    showOffseasonResultModal: (title, body, done) => { if (done) done(); },
    showMobilityChoiceModal: (title, scene, choices, done) => { if (done) done(); },
    queueSeasonAutoSave: () => {},
    rngNext: () => 0.5,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'js/offseason.js' });
  // 源文件包含同名 UI 函数声明，加载后重新替换为无 DOM 的测试桩。
  context.showOffseasonResultModal = (title, body, done) => { if (done) done(); };
  context.showMobilityChoiceModal = (title, scene, choices, done) => { if (done) done(); };
  return context;
}

// UI 候选列表和最终执行都必须排除 120 + 20 > 134 的目标球队。
const blocked = buildContext(120);
if (blocked.getCareerPlayerContractSnapshot()._lastRoleMpg !== 40) failures.push('玩家合同快照把赛季累计分钟错误当成场均分钟');
if (blocked.isCareerTradePayrollLegal('B')) failures.push('超二土豪线的玩家交易目标仍被判定为合法');
if (blocked.getTradeRequestCandidates().some(candidate => candidate.team === 'B')) failures.push('非法工资交易目标仍出现在申请交易候选列表');
if (blocked.pickTradeDestination() === 'B') failures.push('自动交易目标选择绕过工资帽');
let blockedDone = false;
blocked.doTradeUser('B', () => { blockedDone = true; });
if (!blockedDone || blocked.STATE.careerTeam !== 'A') failures.push('球队主动交易在工资非法时仍改变玩家球队');

const blockedRequest = { season: 0, preferredTeam: 'B', status: 'approved' };
blocked.completePlayerRequestedTrade('B', blockedRequest, () => {});
if (blockedRequest.status !== 'failed' || blockedRequest.failureReason !== 'destination_payroll_cap') failures.push('玩家申请交易的最终执行没有拒绝超帽目标');
if (blocked.STATE.careerTeam !== 'A') failures.push('玩家申请交易被拒后仍改变了球队');

// 合法目标仍可完成两条交易链，并把玩家工资计入新队 payroll。
const allowed = buildContext(110);
for (let index = 0; index < 12; index++) {
  allowed.LEAGUE_PLAYER_DATA.B.push({ id: 'B-depth-' + index, cname: 'B-depth-' + index, ovr: 60, pos: 'SF', _age: 27, salary: 0, _salaryVersion: 2, contract: 1 });
}
let allowedDone = false;
allowed.doTradeUser('B', () => { allowedDone = true; });
if (!allowedDone || allowed.STATE.careerTeam !== 'B') failures.push('合法球队主动交易没有完成');
if (allowed.LEAGUE_PLAYER_DATA.B.length !== 17 || allowed.getTeamRosterCount('B') !== 18) failures.push('玩家交易后的阵容容量没有正确保留用户名额');
if (allowed.getTeamPayroll('B') > 134.001) failures.push('合法玩家交易完成后 payroll 超过二土豪线');
const teamTradeLog = allowed.STATE._leagueChanges.trades[0];
if (!teamTradeLog || teamTradeLog.playerB !== '测试球员' || teamTradeLog.playerA !== '选秀权') failures.push('球队主动交易记录的球员流向字段错误');

const requested = buildContext(110);
const request = { season: 0, preferredTeam: 'B', status: 'approved' };
requested.completePlayerRequestedTrade('B', request, () => {});
if (request.status !== 'completed' || requested.STATE.careerTeam !== 'B') failures.push('合法玩家申请交易没有完成');
if (requested.getTeamPayroll('B') > 134.001) failures.push('合法申请交易完成后 payroll 超过二土豪线');
const requestedTradeLog = requested.STATE._leagueChanges.trades[0];
if (!requestedTradeLog || requestedTradeLog.playerB !== '测试球员' || requestedTradeLog.playerA !== '未来资产') failures.push('玩家申请交易记录的球员流向字段错误');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  blockedTarget: { payroll: 120, playerSalary: 20, legal: blocked.isCareerTradePayrollLegal('B') },
  allowedTarget: { payroll: 110, playerSalary: 20, afterTrade: allowed.getTeamPayroll('B') },
}));
