const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const draftSource = fs.readFileSync(path.join(root, 'js', 'draft.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js', 'offseason.js'), 'utf8');
const draftCss = fs.readFileSync(path.join(root, 'css', 'draft.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

new Function(draftSource);

assert(indexSource.includes('id="screen-draft-lottery"'), '缺少选秀抽签页面');
assert(indexSource.includes('id="screen-draft-trades"'), '缺少选秀签交易页面');
assert(indexSource.includes('id="screen-draft"'), '缺少选秀大会页面');
assert(/<script\s+src=["']js\/draft\.js(?:\?[^"']*)?["']\s*><\/script>/.test(indexSource), '缺少选秀脚本入口');
assert(indexSource.includes('showOffseasonDraftLottery();'), '休赛期未接入抽签页面');
assert(indexSource.includes('beginOffseasonDraft();'), '训练后未接入选秀大会');
assert(indexSource.includes('function resumeLoadedCareer(targetScreen)'), '缺少基于业务状态恢复生涯的入口');

function assertResumePhase(phase, expectedScreen) {
  const state = { season: { schedule: [] }, offseasonDraft: { phase } };
  let actualScreen = '';
  const resumeLoadedCareer = new Function(
    'STATE', 'showMyCard', 'showOffseasonDraftLottery', 'showDraftPickTradeScreen',
    'showOffseasonDraftScreen', 'hasActiveSeasonPlayoffs', 'resumePlayoffs',
    'showSeasonResults', 'showRosterReview', 'renderTrainingCamp',
    `${indexSource.slice(indexSource.indexOf('function resumeLoadedCareer'), indexSource.indexOf('// 旧调用点保留兼容', indexSource.indexOf('function resumeLoadedCareer')))}\nreturn resumeLoadedCareer;`,
  )(
    state,
    () => { actualScreen = 'screen-my-card'; },
    () => { actualScreen = 'screen-draft-lottery'; },
    () => { actualScreen = 'screen-draft-trades'; },
    () => { actualScreen = 'screen-draft'; },
    () => false,
    () => { actualScreen = 'screen-playoffs'; },
    () => { actualScreen = 'screen-results'; },
    () => { actualScreen = 'screen-roster-review'; },
    () => { actualScreen = 'screen-training'; },
  );
  resumeLoadedCareer('screen-legacy-page');
  assert(actualScreen === expectedScreen, `选秀 ${phase} 阶段恢复错误：${actualScreen}`);
}

assertResumePhase('lottery', 'screen-draft-lottery');
assertResumePhase('pick_trades', 'screen-draft-trades');
assertResumePhase('draft', 'screen-draft');
assertResumePhase('complete', 'screen-draft');

assert(draftSource.includes('var LOTTERY_WEIGHTS = [14, 14, 14, 12.5'), '乐透概率配置缺失');
assert(draftSource.includes('for (var pick = 1; pick <= 4; pick++)'), '乐透前四顺位抽取缺失');
assert(draftSource.includes('window.suggestDraftProspect'), '玩家建议入口缺失');
assert(draftSource.includes("draft.phase = 'pick_trades'"), '乐透结束未进入选秀签交易窗口');
assert(draftSource.includes('window.setDraftPickTradeStrategy'), '玩家选秀签策略建议入口缺失');
assert(draftSource.includes('window.submitDraftPickTradeAdvice'), '管理层选秀签建议决策入口缺失');
assert(draftSource.includes('window.completeDraftPickTradeWindow'), '选秀签交易窗口缺少关闭入口');
assert(draftSource.includes('updatePickOwner(entry, buyer, transactionId)'), '选秀签直接交易未改变实际持有球队');
assert(draftSource.includes('executePickSwap(draft'), '签位互换逻辑缺失');
assert(draftSource.includes("kind: 'pick_acquisition'"), '一队多签/无签交易类型缺失');
assert(draftSource.includes('pickTrades: draft.pickTrades.transactions.slice()'), '选秀签交易历史未写入生涯记录');
assert(draftSource.includes('accepted: decision.advice.accepted'), '建议采纳结果未保存');
assert(draftSource.includes("draft.picks.length"), '选秀进度未持久化');
assert(draftSource.includes('while (roster.length > DRAFT_ROSTER_LIMIT)'), '超额名单未收敛到上限');
assert(draftSource.includes('while (roster.length < DRAFT_ROSTER_LIMIT)'), '休赛期结束未补满名单');
assert(draftSource.includes('STATE.career.draftHistory'), '生涯选秀历史未保存');
assert(!draftSource.includes('draft.pipelineStarted = true'), '进入自由市场仍把瞬时点击锁写入存档');
assert(draftSource.includes('Promise.resolve(pipeline)'), '进入自由市场入口没有等待异步休赛期流程');
assert(indexSource.includes("runOffseasonPipelineStage('free_agents'"), '自由市场流程没有拆分为可渲染阶段');
const pipelineStageSource = indexSource.slice(
  indexSource.indexOf('function runOffseasonPipelineStage'),
  indexSource.indexOf('function continueCareerAfterLeagueDraft'),
);
assert(pipelineStageSource.includes('setTimeout(function()') && pipelineStageSource.includes('resolve(action())'), '休赛期阶段没有在计算前让出主线程');

const draftContext = {
  console: { error() {} },
  STATE: {
    career: { seasonCount: 1 },
    offseasonDraft: {
      version: 2,
      seasonNum: 1,
      phase: 'complete',
      pipelineStarted: true,
      historySaved: true,
      pickTrades: { transactions: [] },
      draftOrder: [],
      picks: []
    }
  },
  continueCalls: 0,
  continueCareerAfterLeagueDraft() { draftContext.continueCalls += 1; }
};
draftContext.window = draftContext;
vm.runInNewContext(draftSource, draftContext, { filename: 'js/draft.js' });
const advanceButton = { disabled: false, textContent: '进入自由市场' };
draftContext.advanceAfterOffseasonDraft(advanceButton);
assert(draftContext.continueCalls === 1, '旧存档中的 pipelineStarted 仍会锁死进入自由市场按钮');
assert(!Object.prototype.hasOwnProperty.call(draftContext.STATE.offseasonDraft, 'pipelineStarted'), '旧存档点击锁没有迁移清理');

assert(!/while \(newRoster\.length < 18\)/.test(offseasonSource), 'evolveLeague 仍在选秀前补满新秀');
assert(draftCss.includes('@media (prefers-reduced-motion: reduce)'), '选秀页面缺少减少动态效果支持');
assert(draftCss.includes(':focus-visible'), '选秀操作缺少键盘焦点样式');
assert(draftCss.includes('#screen-draft-trades.screen.active'), '选秀签交易页面缺少激活样式');

console.log('Draft flow validation passed: lottery, pick trades, advice, persistence, roster limits and UI wiring are present.');
