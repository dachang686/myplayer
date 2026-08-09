
// ===================================================================
//  VA H5 SDK — 激励视频自选球队任务
// ===================================================================
var AD_ACTIVITY_ID = 318;
var _adTeamLoading = false;      // 防连点
var _adChanceCount = -1;         // -1 = 未加载
var _adTaskTitle = '';

function adSdkAvailable() {
  return typeof VaFuSDK !== 'undefined' && window._sdkReady;
}

function showAdToast(msg) {
  var existing = document.querySelector('.cq-toast');
  if (existing) { existing.remove(); clearTimeout(existing._t); }
  var el = document.createElement('div');
  el.className = 'cq-toast';
  el.style.cssText = 'position:fixed;top:clamp(50px,8vh,70px);left:50%;transform:translateX(-50%);z-index:600;background:linear-gradient(145deg,#3a2a1a,#2a2015);border:2px solid #d4af37;border-radius:16px;padding:14px 28px;font-family:var(--font-display);font-size:14px;font-weight:600;color:#f5e6c8;box-shadow:0 8px 40px rgba(212,175,55,0.15);white-space:nowrap;max-width:88vw;text-align:center;letter-spacing:.5px;';
  el.textContent = msg;
  document.body.appendChild(el);
  el._t = setTimeout(function() {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 2800);
}

function renderAdTeamStatus() {
  var btn = document.getElementById('adTeamPickBtn');
  if (!btn) return;
  if (_adTeamLoading) {
    btn.disabled = true;
    btn.textContent = '📺 视频加载中...';
  } else {
    btn.disabled = false;
    btn.textContent = '📺 看视频自选球队';
  }
}

/** 页面进入/刷新时读取任务状态（纯读取，不触发登录） */
async function fetchAdTeamTask() {
  if (!adSdkAvailable()) return;
  try {
    var result = await VaFuSDK.getActivityTaskState({ activityId: AD_ACTIVITY_ID });
    if (result && result.ok) {
      _adChanceCount = (result.state && typeof result.state.availableChanceCount === 'number') ? result.state.availableChanceCount : 0;
      _adTaskTitle = '';
      var tasks = (result.state && result.state.tasks) || [];
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].action && tasks[i].action.kind === 'reward_video') {
          _adTaskTitle = tasks[i].title || '';
          break;
        }
      }
    }
  } catch(e) {
    // 静默失败，不影响游戏
  }
  renderAdTeamStatus();
}

/** 点击看视频自选球队：请求期间禁用按钮，页面自己防连点 */
async function watchAdToPickTeam() {
  if (_adTeamLoading) return;
  if (!adSdkAvailable()) {
    showAdToast('功能暂不可用，请稍后再试');
    return;
  }

  _adTeamLoading = true;
  renderAdTeamStatus();

  var result = null;
  try {
    result = await VaFuSDK.completeRewardVideoTask({ activityId: AD_ACTIVITY_ID });
  } catch (e) {
    _adTeamLoading = false;
    renderAdTeamStatus();
    return;
  }
  _adTeamLoading = false;

  if (result && result.ok) {
    // 完整观看并获得奖励 → 主动刷新任务状态
    await fetchAdTeamTask();
    showAdToast('✅ 观看完成，可以自选球队了');
    openAdTeamPicker();
  } else if (result && (result.code === 'LOGIN_REQUIRED' || result.code === 'APP_REQUIRED')) {
    return;
  } else if (result && result.code === 'NOT_REWARDED') {
    renderAdTeamStatus();
    showAdToast('需完成观看才能获得活动次数');
  } else {
    renderAdTeamStatus();
    showAdToast('获取广告失败，请稍后再试');
  }
}

/** 看视频奖励后打开全 30 队选择器 */
function openAdTeamPicker() {
  showCareerTeamPicker([...NBA2K_TEAMS]);
}

var _adRerollLoading = false;      // 换人广告防连点

/** 更换球员用完时：看广告获得 1 次更换机会 */
async function watchAdToReroll() {
  if (_adRerollLoading) return;
  if (!adSdkAvailable()) {
    showAdToast('功能暂不可用，请稍后再试');
    return;
  }

  _adRerollLoading = true;
  updateSlotButtons();

  var result = null;
  try {
    result = await VaFuSDK.completeRewardVideoTask({ activityId: AD_ACTIVITY_ID });
  } catch (e) {
    _adRerollLoading = false;
    updateSlotButtons();
    return;
  }
  _adRerollLoading = false;

  if (result && result.ok) {
    STATE._rerollsLeft = (STATE._rerollsLeft || 0) + 1;
    await fetchAdTeamTask();
    updateSlotButtons();
    showAdToast('✅ 观看完成，获得一次更换球员机会！');
  } else if (result && (result.code === 'LOGIN_REQUIRED' || result.code === 'APP_REQUIRED')) {
    updateSlotButtons();
    return;
  } else if (result && result.code === 'NOT_REWARDED') {
    updateSlotButtons();
    showAdToast('需完成观看才能获得更换机会');
  } else {
    updateSlotButtons();
    showAdToast('获取广告失败，请稍后再试');
  }
}

// 从其他页面（如登录 / 唤起 App）返回时刷新任务状态
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState !== 'visible') return;
  setTimeout(function() {
    fetchAdTeamTask();
  }, 500);
});

// SDK 后加载完成时，若选队页已展示则补拉任务状态
document.addEventListener('va-sdk-ready', function() {
  if (document.getElementById('career-area')) fetchAdTeamTask();
});
if (window._sdkReady && document.getElementById('career-area')) {
  setTimeout(function() { fetchAdTeamTask(); }, 0);
}
