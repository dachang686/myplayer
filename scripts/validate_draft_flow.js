const fs = require('fs');
const path = require('path');

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
assert(indexSource.includes('id="screen-draft"'), '缺少选秀大会页面');
assert(indexSource.includes('<script src="js/draft.js"></script>'), '缺少选秀脚本入口');
assert(indexSource.includes('showOffseasonDraftLottery();'), '休赛期未接入抽签页面');
assert(indexSource.includes('beginOffseasonDraft();'), '训练后未接入选秀大会');
assert(indexSource.includes("targetScreen === 'screen-draft-lottery'"), '存档恢复未覆盖抽签页面');
assert(indexSource.includes("targetScreen === 'screen-draft'"), '存档恢复未覆盖选秀页面');

assert(draftSource.includes('var LOTTERY_WEIGHTS = [14, 14, 14, 12.5'), '乐透概率配置缺失');
assert(draftSource.includes('for (var pick = 1; pick <= 4; pick++)'), '乐透前四顺位抽取缺失');
assert(draftSource.includes('window.suggestDraftProspect'), '玩家建议入口缺失');
assert(draftSource.includes('accepted: decision.advice.accepted'), '建议采纳结果未保存');
assert(draftSource.includes("draft.picks.length"), '选秀进度未持久化');
assert(draftSource.includes('while (roster.length > DRAFT_ROSTER_LIMIT)'), '超额名单未收敛到上限');
assert(draftSource.includes('while (roster.length < DRAFT_ROSTER_LIMIT)'), '休赛期结束未补满名单');
assert(draftSource.includes('STATE.career.draftHistory'), '生涯选秀历史未保存');

assert(!/while \(newRoster\.length < 18\)/.test(offseasonSource), 'evolveLeague 仍在选秀前补满新秀');
assert(draftCss.includes('@media (prefers-reduced-motion: reduce)'), '选秀页面缺少减少动态效果支持');
assert(draftCss.includes(':focus-visible'), '选秀操作缺少键盘焦点样式');

console.log('Draft flow validation passed: lottery, advice, draft persistence, roster limits and UI wiring are present.');
