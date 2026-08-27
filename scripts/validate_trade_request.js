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
    _teamChangeSyncs: [],
    _capacityChecks: [],
    _resultModals: [],
    syncNarrativeAfterPlayerTeamChange(events, previousTeam) {
      context._teamChangeSyncs.push({ previousTeam, currentTeam: context.STATE.careerTeam });
      return true;
    },
    enforceCareerRosterCapacity(team) { context._capacityChecks.push(team); },
    showOffseasonResultModal(title, message, done) {
      context._resultModals.push({ title, message });
      if (done) done();
    },
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
const approvedContractBefore = approved.STATE.career.contract;
if (!approved.getTradeRequestAvailability().allowed) failures.push('完成 10 场且合同有效时仍不能申请交易');
const approvedResult = approved.createPlayerTradeRequest('BBB', 'manual');
if (!approvedResult || approvedResult.request.status !== 'approved') failures.push('批准分支没有生成已批准申请');
if (approved.createPlayerTradeRequest('CCC', 'manual') !== null) failures.push('同一赛季可以重复提交交易申请');
approved.STATE.career.seasonCount = 1;
let approvedDone = false;
approved.maybeMoveUserInOffseason(() => { approvedDone = true; });
if (!approvedDone || approved.STATE.careerTeam !== 'BBB') failures.push('已批准申请没有在休赛期完成交易');
if (approvedResult.request.status !== 'completed') failures.push('完成交易后申请状态没有更新');
if (approved.STATE.career.contract !== approvedContractBefore || approved.STATE.career.teamTenure !== 1) failures.push('玩家申请交易错误改变合同或没有重置新队年资');
if (approved._capacityChecks.join(',') !== 'BBB') failures.push('玩家换队后没有对目标球队执行名单容量校验');
if (approved._teamChangeSyncs.length !== 1 || approved._teamChangeSyncs[0].previousTeam !== 'AAA' || approved._teamChangeSyncs[0].currentTeam !== 'BBB') {
  failures.push('玩家换队后没有把叙事上下文从旧队迁移到新队');
}
if (approved.getTeamInitiatedTradeCount() !== 0) failures.push('玩家申请交易错误占用了球队主动交易次数');
if (approved.getMobility().playerRequestedTrades !== 1) failures.push('玩家申请交易次数没有累计');
if (!approved.STATE._leagueChanges.trades.some((trade) => trade.requested && trade.to === 'BBB')) failures.push('联盟变动记录缺少玩家申请交易');
const approvedTradeLog = approved.STATE._leagueChanges.trades.find((trade) => trade.requested && trade.to === 'BBB');
if (!approvedTradeLog || approvedTradeLog.playerB !== '测试球员' || approvedTradeLog.playerA !== '未来资产') failures.push('玩家申请交易记录的球员流向字段错误');
const approvedMoveText = approved._resultModals.find(modal => modal.title === '申请交易完成');
if (!approvedMoveText || !approvedMoveText.message.includes('AAA正式将测试球员交易到BBB') ||
    !approvedMoveText.message.includes('管理层兑现了处理交易申请的承诺') || /undefined|null|\[object Object\]/.test(approvedMoveText.message)) {
  failures.push('玩家申请交易完成后的官宣文字没有正确描述旧队、新队和玩家');
}

const denied = buildContext(0.99);
const deniedResult = denied.createPlayerTradeRequest('BBB', 'manual');
if (!deniedResult || deniedResult.request.status !== 'denied') failures.push('拒绝分支没有生成已拒绝申请');
denied.STATE.career.seasonCount = 1;
denied.maybeMoveUserInOffseason(() => {});
if (denied.STATE.careerTeam !== 'AAA') failures.push('已拒绝申请仍然导致玩家转队');
if (denied._teamChangeSyncs.length || denied._capacityChecks.length) failures.push('已拒绝申请仍执行了换队副作用');

// 球队主动交易玩家：合同保持、次数限制、目标名单和叙事迁移必须与申请交易一致。
const teamInitiated = buildContext(0);
teamInitiated._mobilityScenes = [];
teamInitiated.showMobilityChoiceModal = (title, scene, choices, done) => {
  const resultText = choices[0] && choices[0].apply ? choices[0].apply() : '';
  teamInitiated._mobilityScenes.push({ title, scene, labels: choices.map(choice => choice.label), resultText });
  if (done) done();
};
const teamInitiatedContractBefore = teamInitiated.STATE.career.contract;
let teamInitiatedDone = false;
teamInitiated.doTradeUser('BBB', () => { teamInitiatedDone = true; });
if (!teamInitiatedDone || teamInitiated.STATE.careerTeam !== 'BBB' || teamInitiated.STATE.career.contract !== teamInitiatedContractBefore ||
    teamInitiated.getMobility().teamInitiatedTrades !== 1 || teamInitiated._teamChangeSyncs.length !== 1 || teamInitiated._capacityChecks.join(',') !== 'BBB') {
  failures.push('球队主动交易玩家没有完整保持合同、次数限制、名单或叙事状态');
}
const teamTradeAnnouncement = teamInitiated._resultModals.find(modal => modal.title === '交易官宣');
const teamTradeScene = teamInitiated._mobilityScenes[0];
if (!teamTradeAnnouncement?.message.includes('AAA把测试球员送到BBB') ||
    !teamTradeScene?.scene.includes('你在新球队的新闻发布会上坐定') ||
    !teamTradeScene?.resultText.includes('感谢老东家') || teamTradeScene?.labels.length !== 3 ||
    /undefined|null|\[object Object\]/.test(JSON.stringify({ teamTradeAnnouncement, teamTradeScene }))) {
  failures.push('球队主动交易玩家后的官宣、发布会或选择结果文字不正确');
}
let duplicateTeamTradeDone = false;
teamInitiated.doTradeUser('CCC', () => { duplicateTeamTradeDone = true; });
if (!duplicateTeamTradeDone || teamInitiated.STATE.careerTeam !== 'BBB' || teamInitiated.getMobility().teamInitiatedTrades !== 1) {
  failures.push('同一休赛期球队可以重复主动交易玩家');
}

// 交易截止日事件的强硬选择必须进入真实申请流程，并在休赛期完成同一笔玩家换队。
const eventDriven = buildContext(0);
const eventChoiceStart = indexText.indexOf('function applyCareerEventVariantChoice');
const eventChoiceEnd = indexText.indexOf('/** 旧存档的布尔 pending 标记', eventChoiceStart);
if (eventChoiceStart < 0 || eventChoiceEnd < 0) {
  failures.push('无法提取交易截止日事件选择逻辑');
} else {
  vm.runInContext(indexText.slice(eventChoiceStart, eventChoiceEnd), eventDriven, { filename: 'career-trade-deadline-event.js' });
  const eventContractBefore = eventDriven.STATE.career.contract;
  const eventResult = eventDriven.applyCareerEventVariantChoice('career_trade_deadline_rumor', {
    phase: 3,
    title: '交易截止日方向',
    labels: ['留队承诺', '保持开放', '要求交易'],
  }, 2);
  const eventRequest = eventDriven.getMobility().tradeRequest;
  if (!eventRequest || eventRequest.source !== 'deadline_event' || eventRequest.status !== 'approved' || !/寻找交易方案/.test(eventResult)) {
    failures.push('交易截止日事件没有生成真实且已批准的玩家交易申请');
  } else {
    eventDriven.STATE.career.seasonCount = 1;
    let eventMoveDone = false;
    eventDriven.maybeMoveUserInOffseason(() => { eventMoveDone = true; });
    if (!eventMoveDone || eventDriven.STATE.careerTeam === 'AAA' || eventRequest.status !== 'completed') {
      failures.push('交易截止日事件生成的申请没有在休赛期完成换队');
    }
    if (eventDriven.STATE.career.contract !== eventContractBefore || eventDriven._teamChangeSyncs.length !== 1 || eventDriven._capacityChecks.length !== 1) {
      failures.push('事件驱动换队错误修改合同，或缺少名单/叙事同步');
    }
    const eventMoveText = eventDriven._resultModals.find(modal => modal.title === '申请交易完成');
    if (!eventMoveText || !eventMoveText.message.includes(`AAA正式将测试球员交易到${eventDriven.STATE.careerTeam}`) ||
        /undefined|null|\[object Object\]/.test(eventMoveText.message)) {
      failures.push('交易截止日事件驱动换队后的官宣文字没有对应真实目的地');
    }
  }
}

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

console.log('Trade request validation passed: manual, event-driven, and team-initiated player moves preserve contracts and synchronize team state.');
