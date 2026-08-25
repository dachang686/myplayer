const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexText = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const offseasonText = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const failures = [];

function cloneMath(randomValue) {
  const result = {};
  Object.getOwnPropertyNames(Math).forEach((name) => {
    Object.defineProperty(result, name, Object.getOwnPropertyDescriptor(Math, name));
  });
  result.random = () => randomValue;
  return result;
}

function buildContext(randomValue) {
  const profile = { controversy: 0 };
  const context = {
    console: { log() {}, error() {} },
    Math: cloneMath(randomValue),
    Set,
    Map,
    Object,
    JSON,
    String,
    Number,
    Array,
    LEAGUE_TEAM_IDS: ['AAA', 'BBB', 'CCC'],
    LEAGUE_PLAYER_DATA: { AAA: [], BBB: [], CCC: [] },
    STATE: {
      careerTeam: 'AAA',
      position: 'PG',
      finalOVR: 84,
      career: {
        seasonCount: 0,
        contract: 3,
        currentAge: 25,
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
        schedule: Array.from({ length: 10 }, () => ({ simulated: true })),
        standings: {
          AAA: { wins: 4, losses: 6 },
          BBB: { wins: 6, losses: 4 },
          CCC: { wins: 5, losses: 5 },
        },
      },
      _leagueChanges: { trades: [] },
    },
    getCareerProfile: () => profile,
    getTeamName: (team) => team,
    getTeamLogo: () => '',
    getMyPlayerDisplayName: () => '测试球员',
    hasCareerHonor: () => false,
    canPlayPosition: (a, b) => a === b,
    calcTeamLineup: (team) => ({
      starters: { PG: { pos: 'PG', ovr: team === 'BBB' ? 72 : 82 } },
      bench: [],
    }),
    addProfileDelta: (key, amount) => { profile[key] = (profile[key] || 0) + amount; },
    addSeasonMod: () => {},
    addActiveEventEffect: () => {},
    setBranchNode: () => {},
    queueSeasonAutoSave: () => {},
    showOffseasonResultModal: (title, message, done) => { if (done) done(); },
    sanitizePlayerFacingText: (text) => text,
  };
  vm.createContext(context);

  const mobilityEnd = offseasonText.indexOf('// ==================== 合同到期选队');
  const requestStart = offseasonText.indexOf('function getActiveTradeRequestSeason');
  const requestEnd = offseasonText.indexOf('function getTeamHistoricalWinPct', requestStart);
  if (mobilityEnd < 0 || requestStart < 0 || requestEnd < 0) throw new Error('无法提取申请交易函数');
  vm.runInContext(offseasonText.slice(0, mobilityEnd), context, { filename: 'offseason-mobility.js' });
  vm.runInContext(offseasonText.slice(requestStart, requestEnd), context, { filename: 'offseason-trade-request.js' });
  // 该回归只提取交易剧情片段，不加载完整薪资模块；完整工资合法性由专门测试覆盖。
  context.isCareerTradePayrollLegal = () => true;
  return context;
}

const approved = buildContext(0);
if (!approved.getTradeRequestAvailability().allowed) failures.push('完成 10 场且合同有效时仍不能申请交易');
const approvedResult = approved.createPlayerTradeRequest('BBB', 'manual');
if (!approvedResult || approvedResult.request.status !== 'approved') failures.push('批准分支没有生成已批准申请');
if (approved.createPlayerTradeRequest('CCC', 'manual') !== null) failures.push('同一赛季可以重复提交交易申请');
approved.STATE.career.seasonCount = 1;
let approvedDone = false;
approved.maybeMoveUserInOffseason(() => { approvedDone = true; });
if (!approvedDone || approved.STATE.careerTeam !== 'BBB') failures.push('已批准申请没有在休赛期完成交易');
if (approvedResult.request.status !== 'completed') failures.push('完成交易后申请状态没有更新');
if (approved.getTeamInitiatedTradeCount() !== 0) failures.push('玩家申请交易错误占用了球队主动交易次数');
if (approved.getMobility().playerRequestedTrades !== 1) failures.push('玩家申请交易次数没有累计');
if (!approved.STATE._leagueChanges.trades.some((trade) => trade.requested && trade.to === 'BBB')) failures.push('联盟变动记录缺少玩家申请交易');
const approvedTradeLog = approved.STATE._leagueChanges.trades.find((trade) => trade.requested && trade.to === 'BBB');
if (!approvedTradeLog || approvedTradeLog.playerB !== '测试球员' || approvedTradeLog.playerA !== '未来资产') failures.push('玩家申请交易记录的球员流向字段错误');

const denied = buildContext(0.99);
const deniedResult = denied.createPlayerTradeRequest('BBB', 'manual');
if (!deniedResult || deniedResult.request.status !== 'denied') failures.push('拒绝分支没有生成已拒绝申请');
denied.STATE.career.seasonCount = 1;
denied.maybeMoveUserInOffseason(() => {});
if (denied.STATE.careerTeam !== 'AAA') failures.push('已拒绝申请仍然导致玩家转队');

if (!/renderPlayerTradeRequestCard\(\)/.test(indexText)) failures.push('我的球员页面没有渲染申请交易入口');
if (!/createPlayerTradeRequest\('', 'deadline_event'/.test(indexText)) failures.push('交易截止日剧情没有接入真实申请流程');
if (!/showTradeRequestTeamRoster/.test(offseasonText) || !/previewTeamRosterModal\(team, function\(\)/.test(offseasonText)) failures.push('申请交易球队卡片没有接入球队名单预览');

const reinforcement = buildContext(0);
if (!reinforcement.getReinforcementRequestAvailability().allowed) failures.push('完成 10 场且合同有效时仍不能提交补强要求');
const reinforcementResult = reinforcement.createPlayerReinforcementRequest('PG', 'manual');
if (!reinforcementResult || reinforcementResult.request.status !== 'approved') failures.push('批准分支没有生成已批准补强要求');
if (reinforcement.createPlayerReinforcementRequest('PF', 'manual') !== null) failures.push('同一赛季可以重复提交补强要求');

const contractIndependentReinforcement = buildContext(0);
contractIndependentReinforcement.STATE.career.contract = 1;
if (!contractIndependentReinforcement.getReinforcementRequestAvailability().allowed) failures.push('常规赛合同剩 1 年时仍被合同条件错误拦截');
const contractOneChance = contractIndependentReinforcement.getReinforcementApprovalChance('PG');
contractIndependentReinforcement.STATE.career.contract = 4;
if (contractIndependentReinforcement.getReinforcementApprovalChance('PG') !== contractOneChance) failures.push('补强要求批准概率错误依赖合同年限');

const reinforcementDenied = buildContext(0.99);
const reinforcementDeniedResult = reinforcementDenied.createPlayerReinforcementRequest('PG', 'manual');
if (!reinforcementDeniedResult || reinforcementDeniedResult.request.status !== 'denied') failures.push('拒绝分支没有生成已拒绝补强要求');
if (!/renderPlayerReinforcementRequestCard\(\)/.test(indexText)) failures.push('我的球员页面没有渲染补强要求入口');

const offseasonReinforcement = buildContext(0);
offseasonReinforcement.STATE.season._resultsViewed = true;
offseasonReinforcement.STATE.season.isPlayoffs = true;
offseasonReinforcement.STATE.career.contract = 1;
if (!offseasonReinforcement.getReinforcementRequestAvailability().allowed) failures.push('休赛期仍不能提交补强要求');
const offseasonResult = offseasonReinforcement.createPlayerReinforcementRequest('PG', 'manual');
if (!offseasonResult || offseasonResult.request.season !== 1) failures.push('休赛期补强要求没有绑定到当前休赛期');
offseasonReinforcement.STATE.career.seasonCount = 1;
offseasonReinforcement.STATE._careerSaved = true;
if (offseasonReinforcement.getReinforcementRequestAvailability().allowed) failures.push('保存赛季后仍可在同一休赛期重复提交补强要求');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Trade request validation passed: availability, one-request limit, approval, rejection, and offseason completion are correct.');
