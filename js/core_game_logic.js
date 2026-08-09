/* ============================================================
   BuildPlayer - 核心游戏逻辑
   ============================================================ */

// ==================== 游戏状态 ====================
const STATE = {
  mode: null,           // 'current' | 'legend'
  position: null,       // 'PG' | 'SG' | 'SF' | 'PF' | 'C'
  
  // 建球员
  attrs: {},            // { threePT: 75, ... } 锁定后的值
  attrSlots: {},        // { threePT: { player, team, value }, ... }
  lockedCount: 0,
  usedPlayers: [],      // 已选球员名列表
  _mustLockAfterSpin: false, // 已展示球员未锁定属性时禁用随机球队
  
  // Build phase state
  buildStep: 'select',  // 'select' | 'spin' | 'pick'
  selectedAttr: null,   // currently selected attribute key
  
  // 当前 spin
  currentTeam: null,    // 'LAL'
  currentRoster: [],    // 该队球员列表
  _shownThisTeam: [],   // 当前球队已展示过的球员名
  _rerollsLeft: 3,    // 全局还可换球员次数（整个建球员阶段共3次，不重置）
  _teamsVisited: [],  // 抽到过的球队列表
  
  // 选中球员状态
  selectedPlayer: null, // 当前选中球员
  _locking: false,      // 防止连点
  
  // 揭幕后
  finalOVR: 0,
  finalPosition: null,
  finalArchetype: null,
  careerTeam: null,     // 分配到的球队
  
  // 赛季
  season: {
    games: [],          // 所有比赛结果
    wins: 0,
    losses: 0,
    playerStats: {},    // { pts, reb, ast, stl, blk }
    leaguePlayerSeasonStats: {}, // 联盟球员赛季累计统计
    leaguePlayerGameStats: [], // 联盟球员逐场统计
    _recordedLeagueGameIds: {},
    playoffStats: {},   // { pts, reb, ast, stl, blk, games: 0 } 季后赛单独统计
    awards: [],
    playoffResult: null,
    standings: {},      // { team: { wins, losses } }
    isPlayoffs: false,
    playoffBracket: null,
    events: { suspensionGamesLeft: 0, suspensionReason: '', injuryGamesLeft: 0, injuryReason: '', triggeredIds: [], storyTimeline: [], lastTriggerGameNum: null, playoffEventCount: 0, injuryRiskBonus: 0, majorInjuryThisSeason: false, playThroughPrompted: {}, regularPlayThroughPromptCount: 0 },
  },

  // 生涯
  career: {
    seasonCount: 0,
    currentAge: 22,
    contract: 4,
    seasons: [],
    totalStats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, threeM: 0, threeA: 0, games: 0, mins: 0 },
    playoffStats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, threeM: 0, threeA: 0, games: 0, mins: 0 },
    honors: [],
    offseasonHistory: [],
    branchHistory: [],
    branches: {},
    profile: { fame: 0, businessValue: 0, mediaTrust: 0, controversy: 0, chinaPopularity: 0, loyalty: 0, leadership: 0, coachTrust: 0, lockerRoomTrust: 0, fanSupport: 0, legacyBonus: 0 },
    relationships: {},
    flags: {},
    draft: null,
    mobility: null,
    nextSeasonMods: { injuryRiskBonus: 0, formVariance: 0, teamChemistry: 0, moraleBonus: 0, mediaPressure: 0, staminaLoad: 0 },
    annualChangeSeason: 0,
    offseasonEventSeason: 0,
  },
};

// ==================== UI 工具 ====================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function getSeasonLabel(seasonNum) {
  var n = Math.max(1, parseInt(seasonNum) || 1);
  var start = 2025 + n;
  return start + '-' + String((start + 1) % 100) + '赛季';
}

function getCurrentSeasonLabel() {
  var count = STATE.career && STATE.career.seasonCount ? STATE.career.seasonCount : 0;
  return getSeasonLabel(count + 1);
}

function getNextSeasonMods() {
  if (!STATE.career) return { injuryRiskBonus: 0, formVariance: 0, teamChemistry: 0 };
  if (!STATE.career.nextSeasonMods) {
    STATE.career.nextSeasonMods = { injuryRiskBonus: 0, formVariance: 0, teamChemistry: 0 };
  }
  return STATE.career.nextSeasonMods;
}

function updateSeasonBadge(activeId) {
  var el = document.getElementById('seasonBadge');
  if (!el) return;
  if (!activeId) {
    var cur = document.querySelector('.screen.active');
    activeId = cur ? cur.id : '';
  }
  if (activeId === 'screen-season' || activeId === 'screen-menu') { el.style.display = 'none'; return; }
  el.style.display = '';
  var label = '2025-26赛季';
  try { label = getCurrentSeasonLabel(); } catch(e) {}
  el.innerHTML = '<span style="display:inline-block;background:var(--bg-card);border:1px solid var(--border);border-radius:999px;padding:4px 12px;box-shadow:var(--shadow);">🏀 ' + label + '</span>';
}

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  var playerCreated = id !== 'screen-menu' && id !== 'screen-position' && id !== 'screen-build';
  document.body.classList.toggle('game-session-active', playerCreated);
  updateSeasonBadge(id);
}

function html(id, content) {
  const el = document.getElementById(id);
  if (el && content !== undefined) el.innerHTML = content;
  return el;
}

var _trackedExposureKeys = {};
function trackEvent(params) {
  try {
    if (window.ColorboxAI && typeof window.ColorboxAI.track === 'function') {
      window.ColorboxAI.track(params);
    }
  } catch(e) {}
}

function trackExposureOnce(el, params) {
  if (!el || !params) return;
  var key = [params.act, params.blk, params.pos, params.label || ''].join('|');
  if (_trackedExposureKeys[key]) return;
  function report() {
    if (_trackedExposureKeys[key]) return;
    _trackedExposureKeys[key] = true;
    trackEvent(params);
  }
  if (!('IntersectionObserver' in window)) { report(); return; }
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        report();
        observer.disconnect();
      }
    });
  }, { threshold: [0.5] });
  observer.observe(el);
}

// ==================== 属性工具 ====================
const ATTR_KEYS = SIM_CONFIG.ATTR_LIST;
const ATTR_CN = SIM_CONFIG.ATTR_CN;
ATTR_CN.HAN = '护球';
const ATTR_DESC = SIM_CONFIG.ATTR_DESC;
const GRADE = SIM_CONFIG.GRADE;

function attrCN(key) { return ATTR_CN[key] || key; }
function attrDesc(key) { return ATTR_DESC[key] || ''; }
function getGrade(val) { return GRADE.getGrade(val); }
function getOvrGrade(ovr) { return GRADE.getOvrGrade(ovr); }

// ==================== 跨位置衰减 ====================
/** 计算跨位置衰减系数：你建的位置 vs 来源球员位置 */
function getPosPenalty(userPos, srcPos, attrKey) {
  const srcAvg = SIM_CONFIG.POS_AVG[srcPos] && SIM_CONFIG.POS_AVG[srcPos][attrKey];
  const userAvg = SIM_CONFIG.POS_AVG[userPos] && SIM_CONFIG.POS_AVG[userPos][attrKey];
  if (!srcAvg || srcAvg <= 0) return 1.0;
  return Math.min(1.0, userAvg / srcAvg);
}

/** 从球员的 pos 字段提取主位置（'PG / SG' → 'PG'） */
function getPlayerMainPos(player) {
  const pos = (player.pos || 'SG').split('/')[0].trim();
  return (SIM_CONFIG.POS_AVG[pos] ? pos : 'SF');
}
// ==================== 初始化 ====================

/** 安全返回赛季页面：重新渲染后再显示，防止状态异常 */
function backToSeason() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC20",label:"返回赛季"});
  const schedule = STATE.season?.schedule;
  const hasGames = schedule && schedule.length > 0;
  if (!hasGames) { showScreen('screen-menu'); return; }
  // 重新渲染赛季UI确保状态同步
  if (typeof renderSeasonUI === 'function') renderSeasonUI();
  if (typeof renderCalendar === 'function') renderCalendar();
  showScreen('screen-season');
}

/** 从 storage 读取上次保存的球员数据并输出到控制台 */
function logSavedPlayerData() {
  Storage.waitForReady().then(function() {
    Storage.getValue('players').then(function(raw) {
      if (raw == null) { console.log('📦 暂无保存的球员数据'); return; }
      var arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : null);
      if (Array.isArray(arr) && arr.length > 0) {
        console.log('📦 已保存的球员列表 (共' + arr.length + '个):');
        arr.forEach(function(data, i) {
          console.log('  #' + (i+1), '位置:', data.position, '| 球队:', data.team, '| OVR:', data.finalOVR, '| 属性:', data.attrs);
        });
      } else { console.log('📦 暂无保存的球员数据'); }
    });
  });
}
setTimeout(logSavedPlayerData, 500);

/** 验证 ColorboxAI.storage 读写回路 */
function verifyStorage() {
  Storage.waitForReady().then(function(){
    Storage.setValue({ _ping: 'pong' }).then(function(){
      Storage.getValue('_ping').then(function(v){
        console.log('[StorageTest] setValue/getValue 回路:', v === 'pong' ? '✅ 通过' : '❌ 失败', v);
      });
    });
  });
}
setTimeout(verifyStorage, 1000);

/** 生成全局唯一游戏局ID */
function generateGameId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '-' + Math.random().toString(36).slice(2, 6);
}

var _baseLeagueRosterSnapshot = null;

function cloneLeagueData(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

function captureBaseLeagueRoster() {
  if (_baseLeagueRosterSnapshot || typeof NBA2K_DATA === 'undefined' || typeof NBA2K_TEAMS === 'undefined') return;
  _baseLeagueRosterSnapshot = {};
  NBA2K_TEAMS.forEach(function(t) {
    _baseLeagueRosterSnapshot[t] = cloneLeagueData(NBA2K_DATA[t] || []);
  });
}

function restoreBaseLeagueRoster() {
  captureBaseLeagueRoster();
  if (!_baseLeagueRosterSnapshot || typeof NBA2K_DATA === 'undefined' || typeof NBA2K_TEAMS === 'undefined') return;
  NBA2K_TEAMS.forEach(function(t) {
    NBA2K_DATA[t] = cloneLeagueData(_baseLeagueRosterSnapshot[t] || []);
  });
  delete NBA2K_DATA._draftClass2026Applied;
}

function createFreshCareer() {
  return {
    seasonCount: 0,
    currentAge: 22,
    contract: 4,
    seasons: [],
    totalStats: { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, games:0, mins:0 },
    playoffStats: { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, games:0, mins:0 },
    honors: [],
    offseasonHistory: [],
    branchHistory: [],
    branches: {},
    profile: { fame:0, businessValue:0, mediaTrust:0, controversy:0, chinaPopularity:0, loyalty:0, leadership:0, coachTrust:0, lockerRoomTrust:0, fanSupport:0, legacyBonus:0 },
    relationships: {},
    flags: {},
    draft: null,
    mobility: null,
    nextSeasonMods: { injuryRiskBonus:0, formVariance:0, teamChemistry:0, moraleBonus:0, mediaPressure:0, staminaLoad:0 },
    annualChangeSeason: 0,
    offseasonEventSeason: 0
  };
}

function initGame() {
  restoreBaseLeagueRoster();
  _rngState = null;
  _rookieNameSeq = 0;
  // 重置状态（保留 gameId 持久不变，直到下一次显式重置）
  Object.assign(STATE, {
    mode: null, position: null,
    attrs: {}, attrSlots: {}, lockedCount: 0,
    usedPlayers: [], _mustLockAfterSpin: false,
    buildStep: 'select', noPlayerSelected: true,
    currentTeam: null, currentRoster: [],
    _shownThisTeam: [], _rerollsLeft: 3, _teamsVisited: [],
    selectedPlayer: null, _locking: false,
    finalOVR: 0, finalPosition: null, finalArchetype: null,
    careerTeam: null,
    gameId: generateGameId(),
    career: createFreshCareer(),
    season: { games: [], wins: 0, losses: 0, playerStats: {}, leaguePlayerSeasonStats: {}, leaguePlayerGameStats: [], _recordedLeagueGameIds: {}, playoffStats: { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, mins:0, games:0 }, awards: [], playoffResult: null, playoffEliminated: false, standings: {}, isPlayoffs: false, playoffBracket: null, otherBracket: null, _viewConf: null },
  });
  delete STATE._tpPending;
  delete STATE._careerSaved;
  delete STATE._offseasonQueue;
  delete STATE._offseasonEventIdx;
  delete STATE._seasonBranchEvent;
  delete STATE._postCareerEvent;
  delete STATE._postCareerScenePage;
  delete STATE._countdownLegacyEvent;
  delete STATE._countdownLegacyScenePage;
  delete STATE._userAwardStreak;
  delete STATE._userAwardRankStreak;
  delete STATE._contractsInited;
  delete STATE._leagueChanges;
  delete STATE._freeAgentPool;
  delete STATE._draftPending;
  delete STATE._draftSelfPick;
  delete STATE._draftModalStep;
  delete STATE._draftSceneStep;
  delete STATE._draftResultDone;
  delete STATE._mobilityChoice;
  clearLineupCache();
  
  try { applyDraftClass2026(); } catch(e) {}

  // 属性槽初始化为空
  ATTR_KEYS.forEach(k => { STATE.attrs[k] = null; STATE.attrSlots[k] = null; });
  
  showScreen('screen-menu');
  renderModeSelect();
}

// ==================== 玩法说明弹窗 ====================
var _helpPage = 0;
var _helpPages = [
  { title: '建球员', content: '选择我的位置后进入抽签选队，随机抽取球队后从该队球员列表中选一人，点击左侧属性槽锁定一项属性。锁定后自动进入下一轮，可继续抽新球队选人锁属性。每局限换三次球员，用完只能重新随机球队。跨位置选人会触发属性衰减，集满十三项属性后自动揭晓总评、模板风格和相似球员。' },
  { title: '赛季', content: '抽签决定我的生涯球队后进入赛季。系统根据我与队内同位置球员的总评比较判定首发或替补。每场比赛可点单场推进，也可点击日历日期批量模拟到当天。比赛数据根据属性和位置动态生成，方差较大，有爆发也有低迷。赛季中可随时点我的数据查看场均表现。' },
  { title: '季后赛', content: '常规赛结束后根据排名决定季后赛或附加赛资格。附加赛在七到十名之间进行，逐场淘汰。季后赛每轮七场四胜，我的系列赛会一场一场模拟，每场生成简报。点击简报可展开查看详细比分、我的数据和全队数据。一路赢下去直到总冠军。' },
  { title: '海报分享', content: '赛季结果页或我的数据页中点生成海报可生成球员纪念海报，包含总评、赛季数据、模板风格和最终属性。海报支持一键分享，也可查看其他用户创建的建模作品。每次分享都会带上我的专属标签。' },
  { title: '征服联盟', content: '荣誉墙支持我挑战带领全部30支NBA球队夺冠的终极目标。每次我赢得总冠军，系统会自动记录该球队、赛季数据、季后赛数据以及我的最终属性和模板。已夺冠的球队会在荣誉墙上以金色边框和队标展示，点击可查看历次夺冠详情。' },
];

function showHelpModal() {
  _helpPage = 0;
  var modal = document.getElementById('helpModal');
  modal.style.display = 'flex';
  modal.onclick = function(e) { if (e.target === modal) closeHelpModal(); };
  renderHelpPage();
}

function closeHelpModal() {
  document.getElementById('helpModal').style.display = 'none';
}

/** 应用环境检测 */
function getIsInApp() {
  if (window.__HUPU_GAME_OFFLINE__) return true;
  return /kanqiu|huputiyu/i.test(window.navigator.userAgent || "");
}

/** 显示下载引导弹窗 */
function showDownloadModal() {
  document.getElementById('downloadModal').style.display = 'flex';
}

function renderHelpPage() {
  var page = _helpPages[_helpPage];
  document.getElementById('helpPageIndicator').textContent = (_helpPage + 1) + '/' + _helpPages.length;
  document.getElementById('helpPrevBtn').disabled = _helpPage === 0;
  document.getElementById('helpNextBtn').disabled = _helpPage >= _helpPages.length - 1;
  document.getElementById('helpBody').innerHTML = '<div style="font-family:var(--font-body);font-size:14px;line-height:1.7;color:var(--text);padding:4px 2px;">' + page.content + '</div>';
  var tabsHtml = '';
  _helpPages.forEach(function(p, i) {
    tabsHtml += '<button class="' + (i === _helpPage ? 'active' : '') + '" onclick="helpGoTo(' + i + ')">' + p.title + '</button>';
  });
  document.getElementById('helpTabs').innerHTML = tabsHtml;
}

function helpPrevPage() {
  if (_helpPage > 0) { _helpPage--; renderHelpPage(); }
}

function helpNextPage() {
  if (_helpPage < _helpPages.length - 1) { _helpPage++; renderHelpPage(); }
}

function helpGoTo(idx) {
  _helpPage = idx;
  renderHelpPage();
}

// ==================== 1. 模式选择 ====================
function renderModeSelect() {
  const container = html('feature-grid');
  container.innerHTML = '';
  
  // Two feature cards like build-a-player.com
  const cards = [
    {
      tag: 'Current',
      tagClass: 'gold',
      title: '生涯模式',
      sub: '从现役球员中夺取属性，组建我的球员',
      btnLabel: '🎮 进入活动',
      mode: 'current',
    },
    {
      tag: 'NEW',
      tagClass: 'new',
      title: '传奇模式',
      sub: '从历史名宿中组建我的球员',
      btnLabel: '即将上线，敬请期待',
      mode: 'legend',
      disabled: true,
    },
  ];
  
  cards.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'feature-card';
    if (c.disabled) card.classList.add('disabled-card');
    if (c.mode === 'current') card.classList.add('selected');
    card.innerHTML = `
      <span class="fc-tag ${c.tagClass}">${c.tag}</span>
      <div class="fc-title">${c.title}</div>
      <div class="fc-sub">${c.sub}</div>
      <button class="fc-btn" ${c.disabled ? 'disabled' : ''}>
        ${c.btnLabel}
      </button>
      
    `;
    const btn = card.querySelector('.fc-btn');
    if (!c.disabled) {
      btn.onclick = (e) => {
        trackEvent({act:"click",blk:"BMC098",pos:"TC1",label:"开始游戏"});
        e.stopPropagation();
        if (!getIsInApp()) {
          showDownloadModal();
          return;
        }
        STATE.mode = c.mode;
        startGame();
      };
    }
    container.appendChild(card);
    if (c.mode === 'current') {
      var mainBtn = card.querySelector('.fc-btn');
      if (mainBtn) {
        mainBtn.insertAdjacentHTML('afterend', '<button class="fc-btn" id="continue-activity-btn" style="margin-top:10px;background:#2f6fed;box-shadow:0 4px 0 #1d4fb8;" onclick="event.stopPropagation();manualLoadGame(1)">▶ 继续活动</button>');
      }
    }
  });

  STATE.mode = 'current';
  refreshContinueActivityButton();
}

function startGame() {
  ensureHupuUser(true);
  if (STATE.mode === 'current' || STATE.mode === 'legend') {
    // 输出灰熊(MEM)和凯尔特人(BOS)全阵容
    console.log('========== 🏀 灰熊(MEM) 全阵容 ==========');
    (NBA2K_DATA['MEM'] || []).forEach(function(p) {
      console.log(p.cname + ' (' + p.name + ')', '| OVR:', p.ovr, '| 位置:', p.pos, '| 类型:', p.type);
    });
    console.log('==========================================');
    console.log('========== 🏀 凯尔特人(BOS) 全阵容 ==========');
    (NBA2K_DATA['BOS'] || []).forEach(function(p) {
      console.log(p.cname + ' (' + p.name + ')', '| OVR:', p.ovr, '| 位置:', p.pos, '| 类型:', p.type);
    });
    console.log('==========================================');
    showScreen('screen-position');
  } else {
    alert('该模式开发中');
  }
}

// ==================== 2. 位置选择 ====================
function renderPositionSelect() {
  const grid = html('pos-grid');
  grid.innerHTML = '';
  
  const icons = { PG: '🎯', SG: '🔥', SF: '🏃', PF: '💪', C: '🧱' };
  SIM_CONFIG.POS_LIST.forEach(pos => {
    const card = document.createElement('div');
    card.className = 'pos-card';
    card.innerHTML = `
      <div class="pos-label">${SIM_CONFIG.POSITIONS[pos]}</div>
      <div class="pos-en">${icons[pos] || ''} ${pos}</div>
    `;
    card.onclick = () => {
      $$('.pos-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      STATE.position = pos;
    };
    grid.appendChild(card);
  });
}

function confirmPosition() {
  if (!STATE.position) {
    return;
  }
  STATE.selectedPlayer = null;
  STATE.currentTeam = null;
  showScreen('screen-build');
  renderBuildUI();
  renderTeamPicker();
}

// ==================== 3. 建球员 - LEFT-RIGHT SPLIT ====================

function renderBuildUI() {
  var pi = document.getElementById('build-pos-indicator');
  if (pi) pi.textContent = '我选择的位置：' + (SIM_CONFIG.POSITIONS[STATE.position] || STATE.position) + '（' + STATE.position + '）';
  renderLeftAttrs();
  renderProgress();
}

function renderProgress() {
  const p = document.getElementById('build-progress-area');
  if (!p) return;
  const pct = Math.round((STATE.lockedCount / 13) * 100);
  p.innerHTML = `
    <div class="build-progress">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-text">${STATE.lockedCount}/13</div>
    </div>
  `;
}

/** Render left attribute sidebar */
function renderLeftAttrs() {
  // OVR
  const ovrEl = document.getElementById('bl-ovr');
  if (ovrEl) {
    let ovr = STATE.finalOVR || 0;
    if (!ovr && STATE.position) {
      const w = SIM_CONFIG.OVR_WEIGHTS[STATE.position];
      if (w) {
        // 先算已锁定属性的加权平均值
        let lockedSum = 0, lockedWeight = 0;
        ATTR_KEYS.forEach(k => {
          const val = STATE.attrs[k];
          const weight = w[k] || 0.07;
          if (val !== null) { lockedSum += val * weight; lockedWeight += weight; }
        });
        // 未锁定任何属性时显示 --
        if (lockedWeight === 0) { ovr = 0; }
        else {
          const fillAvg = lockedSum / lockedWeight;
          // 用填充值计算完整OVR
          let c = 0;
          ATTR_KEYS.forEach(k => {
            const val = STATE.attrs[k] !== null ? STATE.attrs[k] : Math.round(fillAvg);
            c += val * (w[k] || 0.07);
          });
          ovr = Math.round(c);
        }
      }
    }
    ovrEl.textContent = ovr > 0 ? ovr : '--';
  }

  // Attributes
  const container = document.getElementById('bl-attrs');
  if (!container) return;
  container.innerHTML = '';
  
  ATTR_KEYS.forEach(key => {
    const val = STATE.attrs[key];
    const isLocked = val !== null;
    const div = document.createElement('div');
    
    let cls = 'ba-slot';
    if (isLocked) cls += ' locked';
    else if (STATE.selectedPlayer) {
      cls += ' clickable';
      div.onclick = () => lockAttr(key);
    }
    div.className = cls;
    
    if (isLocked) {
      const g = getGrade(val);
      const slot = STATE.attrSlots[key];
      const hadPenalty = slot && slot.penalty < 1.0;
      div.innerHTML = `
        <span class="ba-label">${attrCN(key)}</span>
        <span class="ba-grade" style="color:${g.color}">${g.letter}</span>
        <span class="ba-owner" title="${hadPenalty ? `原始${slot.raw} × ${slot.penalty.toFixed(2)}` : ''}" 
             style="${hadPenalty ? 'color:var(--accent);' : ''}">${slot?.player ? getPlayerDisplayName(slot.player) : ''}</span>
      `;
    } else if (STATE.selectedPlayer) {
      const pv = parseInt(STATE.selectedPlayer[key]) || 50;
      // 计算跨位置衰减后的值
      const playerPos = getPlayerMainPos(STATE.selectedPlayer);
      const penalty = getPosPenalty(STATE.position, playerPos, key);
      const adjustedVal = Math.round(pv * penalty);
      const hasPenalty = penalty < 1.0;
      const pg = getGrade(adjustedVal);
      div.innerHTML = `
        <span class="ba-label">${attrCN(key)}</span>
        <span class="ba-grade" style="color:${pg.color}">${pg.letter}</span>
        <span class="ba-owner"${hasPenalty ? ` style="color:var(--accent);font-size:9px;"` : ''}>${hasPenalty ? `${adjustedVal}▼` : adjustedVal}</span>
      `;
    } else {
      div.innerHTML = `
        <span class="ba-label">${attrCN(key)}</span>
        <span class="ba-empty">+</span>
      `;
    }
    container.appendChild(div);
  });

  // Footer — 已隐藏
  const footer = document.getElementById('bl-footer');
  if (footer) footer.innerHTML = '';
}

/** Render slot machine — 3 buttons (no reroll limit, forced choice) */
function renderTeamPicker() {
  const slotArea = document.getElementById('br-slot-area');
  if (!slotArea) return;
  
  const sorted = [...NBA2K_TEAMS].sort();
  const copies = 5;
  const allItems = [];
  for (let c = 0; c < copies; c++) {
    sorted.forEach(t => allItems.push(t));
  }
  
  let itemsHtml = '';
  allItems.forEach(t => {
    const cn = SIM_CONFIG.TEAM_NAMES[t] || t;
    itemsHtml += `<div class="br-slot-item" data-team="${t}">${cn}</div>`;
  });
  
  slotArea.innerHTML = buildSlotHTML(itemsHtml);
  
  const reel = document.getElementById('slot-reel');
  if (reel) {
    const offset = sorted.length * 38;
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${offset}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
  }
  
  const rosterArea = document.getElementById('br-roster-area');
  if (rosterArea) rosterArea.innerHTML = '';
}

/** 只更新按钮状态，不重建老虎机HTML（防止跳动）*/
/** 更换球员按钮 */
function getRerollButtonHtml() {
  var hasTeam = !!STATE.currentTeam;
  if (STATE._rerollsLeft > 0) {
    // 计数器有次数 → 展示正常文案（未选队时禁用）
    return '<button class="btn btn-sm slot-btn" onclick="rerollTeamPlayers()"' +
      (hasTeam ? '' : ' disabled style="opacity:0.3;"') +
      '>👥 更换球员 (' + STATE._rerollsLeft + ')</button>';
  }
  return '<button class="btn btn-sm slot-btn" disabled style="opacity:0.3;cursor:not-allowed;">' +
    '👥 更换球员 (0)' +
    '</button>';
}

function updateSlotButtons() {
  const slotArea = document.getElementById('br-slot-area');
  if (!slotArea) return;
  
  const hasTeam = !!STATE.currentTeam;
  const canSpin = !STATE._mustLockAfterSpin && !_slotSpinning;
  
  // Rebuild only the actions area, keep reel intact
  const actionsEl = slotArea.querySelector('.br-slot-actions');
  const warnEl = slotArea.querySelector('.br-slot-warn');
  if (actionsEl) {
    actionsEl.innerHTML = `
      <button class="btn btn-sm slot-btn" onclick="pullHandle()"
        ${canSpin ? '' : 'disabled'}
        style="background:var(--orange);color:#fff;${canSpin ? '' : 'opacity:0.3;'}">
        🎲 随机球队
      </button>
      ${getRerollButtonHtml()}
    `;
  }
  if (warnEl) {
    warnEl.textContent = STATE._mustLockAfterSpin ? '⚠️ 先选择一名球员并锁定属性才能再次随机' : '';
  }
}

function buildSlotHTML(itemsHtml) {
  const hasTeam = !!STATE.currentTeam;
  const canSpin = !STATE._mustLockAfterSpin && !_slotSpinning;
  return `
    <div class="br-slot-area">
      <div class="br-slot-label">🎰 随机选队</div>
      <div class="br-slot-wrapper">
        <div class="br-slot-machine">
          <div class="br-slot-reel" id="slot-reel">
            ${itemsHtml}
          </div>
        </div>
      </div>
      <div class="br-slot-actions">
        <button class="btn btn-sm slot-btn" onclick="pullHandle()"
          ${canSpin ? '' : 'disabled'}
          style="background:var(--orange);color:#fff;${canSpin ? '' : 'opacity:0.3;'}">
          🎲 随机球队
        </button>
        ${getRerollButtonHtml()}
      </div>
      <div class="br-slot-warn" style="font-size:10px;color:var(--orange);margin-top:6px;min-height:16px;">${STATE._mustLockAfterSpin ? '⚠️ 先选择一名球员并锁定属性才能再次随机' : ''}</div>
    </div>
  `;
}

let _slotSpinning = false;

function pullHandle() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC3",label:"随机球队-建球员"});
  if (_slotSpinning || STATE._mustLockAfterSpin) return;
  
  // Visual: flash the reel to show it's spinning
  const reel = document.getElementById('slot-reel');
  if (reel) reel.classList.add('spinning');
  
  setTimeout(spinSlotMachine, 200);
}

function spinSlotMachine() {
  if (_slotSpinning) return;
  _slotSpinning = true;
  
  const reel = document.getElementById('slot-reel');
  if (!reel) { _slotSpinning = false; return; }
  
  const sorted = [...NBA2K_TEAMS].sort();
  const teamCount = sorted.length;
  const itemH = 38;
  const copyLen = teamCount * itemH; // 一个完整复制的高度
  
  // 随机目标球队
  const targetIdx = Math.floor(Math.random() * teamCount);
  const targetTeam = sorted[targetIdx];
  
  // 目标位置：让 target 出现在窗口中间（第2个可见位）
  // 窗口显示3项，中间项索引=1，所以偏移到 targetIdx-1
  const snapIdx = (targetIdx - 1 + teamCount) % teamCount;
  
  // 落到第3个复制块（索引2），留出上下缓冲
  const targetY = copyLen * 2 + snapIdx * itemH;
  
  // 获取当前位置
  const curMatch = reel.style.transform.match(/([\d.]+)/);
  const curY = curMatch ? parseFloat(curMatch[0]) : copyLen;
  
  // 保证至少转半圈
  let finalY = targetY;
  const minSpin = copyLen * 0.5;
  while (finalY <= curY + minSpin) finalY += copyLen;
  
  // 防止超出边界（5个复制块上限）
  const maxY = copyLen * 4 - itemH * 2;
  if (finalY > maxY) {
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${copyLen}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
    finalY = targetY + copyLen;
  }
  
  // 执行旋转动画
  reel.classList.add('spinning');
  reel.style.transform = `translateY(-${finalY}px)`;
  
  // 动画结束后，精确回正到目标位置（去掉过渡，直接对齐）
  setTimeout(() => {
    reel.classList.remove('spinning');
    
    // ★ 关键修复：无过渡跳转到精确位置，确保显示正确
    const exactY = copyLen * 3 + snapIdx * itemH; // 落到第4复制块中间区
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${exactY}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
    
    // ★ 高亮中间项（窗口3项，snapIdx为顶部，中间=snapIdx+1）
    var middleIdx = teamCount * 3 + snapIdx + 1;
    highlightSlotItem('slot-reel', middleIdx);
    
    // 同步状态
    STATE.currentTeam = targetTeam;
    if (STATE._teamsVisited.indexOf(targetTeam) === -1) {
      STATE._teamsVisited.push(targetTeam);
      console.log('[Build] 已访问球队:', STATE._teamsVisited.join(', '));
    }
    STATE.selectedPlayer = null;
    STATE._shownThisTeam = [];
    STATE._mustLockAfterSpin = true;
    _slotSpinning = false;
    
    renderLeftAttrs();
    updateSlotButtons();
    showTeamRoster(targetTeam);
  }, 2800);
}

/** Show team roster — 5 random players (below the slot machine) */
function showTeamRoster(team) {
  const rosterArea = document.getElementById('br-roster-area');
  if (!rosterArea) return;
  
  const players = NBA2K_DATA[team];
  const available = players.filter(p => !STATE.usedPlayers.includes(p.name));
  
  if (available.length === 0) {
    rosterArea.innerHTML = `<div class="br-hint">❌ 都已选过</div>`;
    return;
  }
  
  // 从剩余未展示过的球员中随机抽5人
  const notShown = available.filter(p => !STATE._shownThisTeam.includes(p.name));
  const pool = notShown.length > 0 ? notShown : available; // 如果都展示过了，从全部重新抽
  const shuffled = shuffleArr([...pool]);
  const shown = shuffled.slice(0, Math.min(5, shuffled.length));
  
  // 记录本次展示的球员
  shown.forEach(p => {
    if (!STATE._shownThisTeam.includes(p.name)) STATE._shownThisTeam.push(p.name);
  });
  
  renderRosterPlayers(team, shown, available);
}

/** 渲染球员列表 */
function renderRosterPlayers(team, shown, allAvailable) {
  const rosterArea = document.getElementById('br-roster-area');
  if (!rosterArea) return;
  
  let listHtml = `<div style="display:flex;align-items:center;gap:6px;padding-bottom:4px;flex-wrap:wrap;">
    <span style="font-size:13px;font-weight:700;font-family:var(--font-display);letter-spacing:1px;">${getTeamName(team)}</span>
    <span style="font-size:11px;color:var(--text-dim);">展示 ${shown.length}人 · 剩余 ${allAvailable.length}人</span>
  </div><div class="br-roster-list" style="max-height:none;">`;
  
  shown.forEach(p => {
    const sel = STATE.selectedPlayer?.name === p.name;
    const playerPos = getPlayerMainPos(p);
    const hsStyle = getPlayerHeadshotStyle(p.name, 32);
    const ovrGrade = getOvrGrade(parseInt(p.ovr) || 50);
    listHtml += `<div class="br-player${sel ? ' selected' : ''}" onclick="pickPlayer('${p.name.replace(/'/g, "\\'")}')">
      <div class="bp-left">
        <div class="bp-headshot" style="${hsStyle}"></div>
        <div>
          <div class="bp-name">${p.cname || p.name}</div>
          <div class="bp-detail">${playerPos}</div>
        </div>
      </div>
      <div class="bp-meta">
        <span class="bp-ovr">${p.ovr}</span>
      </div>
    </div>`;
  });
  
  listHtml += '</div>';
  
  // 跨位置衰减提示 + 强制选择提示
  const hasAnyPenalty = shown.some(p => getPlayerMainPos(p) !== STATE.position);
  listHtml += `<div style="display:flex;gap:6px;padding:4px 0;flex-wrap:wrap;align-items:center;">
    <span style="font-size:9px;color:var(--text-dim);">
      ${hasAnyPenalty ? '⚠️ 跨位置衰减生效' : '✅ 同位置属性无衰减'}
    </span>
    <span style="font-size:10px;color:var(--accent);margin-left:auto;font-weight:600;">
      👆 选球员 → 点击左侧属性锁定
    </span>
  </div>`;
  
  rosterArea.innerHTML = listHtml;
}

/** 当前球队内换一批球员 */
function rerollTeamPlayers() {
  if (STATE._rerollsLeft <= 0 || !STATE.currentTeam) return;
  
  const players = NBA2K_DATA[STATE.currentTeam];
  const available = players.filter(p => !STATE.usedPlayers.includes(p.name));
  
  const notShown = available.filter(p => !STATE._shownThisTeam.includes(p.name));
  if (notShown.length === 0) {
    return;
  }
  
  STATE._rerollsLeft--;
  const shuffled = shuffleArr([...notShown]);
  const shown = shuffled.slice(0, Math.min(5, shuffled.length));
  
  shown.forEach(p => {
    if (!STATE._shownThisTeam.includes(p.name)) STATE._shownThisTeam.push(p.name);
  });
  
  STATE.selectedPlayer = null;
  renderLeftAttrs();
  updateSlotButtons();
  renderRosterPlayers(STATE.currentTeam, shown, available);
}

function pickPlayer(name) {
  
  if (STATE._locking || !STATE.currentTeam) return;
  const players = NBA2K_DATA[STATE.currentTeam];
  const player = players.find(p => p.name === name);
  if (!player) return;
  
  STATE.selectedPlayer = player;
  
  document.querySelectorAll('.br-player').forEach(r => {
    r.classList.toggle('selected', r.textContent.includes(player.cname || player.name));
  });
  
  renderLeftAttrs();
}

function lockAttr(key) {
  if (STATE._locking || !STATE.selectedPlayer || STATE.attrs[key] !== null) return;
  STATE._locking = true;
  
  const player = STATE.selectedPlayer;
  const rawVal = parseInt(player[key]) || 50;
  
  // 跨位置衰减计算
  const playerPos = getPlayerMainPos(player);
  const penalty = getPosPenalty(STATE.position, playerPos, key);
  const adjustedVal = Math.round(rawVal * penalty);
  
  STATE.attrs[key] = adjustedVal;
  STATE.attrSlots[key] = { player: player.name, team: STATE.currentTeam, value: adjustedVal, raw: rawVal, penalty: penalty };
  STATE.lockedCount++;
  STATE.usedPlayers.push(player.name);
  STATE.selectedPlayer = null;
  STATE._mustLockAfterSpin = false; // 已锁定属性，可以再次随机
  
  if (STATE.lockedCount >= 13) {
    renderLeftAttrs();
    renderProgress();
    setTimeout(() => { STATE._locking = false; revealPlayer(); }, 500);
    return;
  }
  
  const g = getGrade(adjustedVal);
  const penaltyMsg = penalty < 1.0 ? ` (原始${rawVal}×${penalty.toFixed(2)})` : '';
  
  setTimeout(() => {
    STATE._locking = false;
    // ★ 清空当前球队和阵容，强制用户重新随机
    STATE.currentTeam = null;
    STATE.selectedPlayer = null;
    STATE._shownThisTeam = [];
    const rosterArea = document.getElementById('br-roster-area');
    if (rosterArea) rosterArea.innerHTML = '';
    renderLeftAttrs();
    updateSlotButtons();
    renderProgress();
  }, 700);
}

function showToast(msg) {
  // Toast 已关闭
}

function unselectPlayer() {
  STATE.selectedPlayer = null;
  document.querySelectorAll('.roster-row').forEach(r => r.classList.remove('selected'));
  html('player-info-area').innerHTML = '';
  renderAttrSlots();
}

function confirmLock(playerName, attrKey, value) {
  // 防止连点
  if (STATE._locking) return;
  STATE._locking = true;
  
  // 记录锁定
  STATE.attrs[attrKey] = value;
  STATE.attrSlots[attrKey] = { player: playerName, team: STATE.currentTeam, value };
  STATE.lockedCount++;
  STATE.usedPlayers.push(playerName);
  STATE.selectedPlayer = null;
  
  // 清除球员信息
  html('player-info-area').innerHTML = '';
  
  // 更新 UI
  renderAttrSlots();
  
  if (STATE.lockedCount >= 13) {
    revealPlayer();
    return;
  }
  
  // 显示成功提示并自动下一轮
  html('roster-area').innerHTML = `<div class="locked-msg">
    <div class="locked-icon">✅</div>
    <div class="locked-title">${attrCN(attrKey)}（${value}）来自 ${playerName}</div>
    <div class="locked-sub">${13 - STATE.lockedCount > 0 ? `剩余 ${13 - STATE.lockedCount} 项属性` : '全部属性已锁定！'} · 自动进入下一轮...</div>
  </div>`;
  
  setTimeout(() => {
    STATE._locking = false;
    if (STATE.lockedCount < 13) {
      html('roster-area').innerHTML = '';
      spinTeam();
    }
  }, 1000);
}

// ==================== 4. 相似球员匹配 ====================
function findSimilarPlayers(attrs, pos, topN = 3) {
  const posAvg = SIM_CONFIG.POS_AVG[pos];
  if (!posAvg) return [];
  
  // 用户属性相对位置平均值的偏差向量
  const userVec = ATTR_KEYS.map(k => (attrs[k] || 50) - (posAvg[k] || 50));
  const userNorm = Math.sqrt(userVec.reduce((s, v) => s + v * v, 1));
  
  // 遍历所有 NBA 球员
  const scores = [];
  NBA2K_TEAMS.forEach(team => {
    (NBA2K_DATA[team] || []).forEach(player => {
      // 该球员属性相对同一位置平均值的偏差向量
      const hisVec = ATTR_KEYS.map(k => (parseInt(player[k]) || 50) - (posAvg[k] || 50));
      const hisNorm = Math.sqrt(hisVec.reduce((s, v) => s + v * v, 1));
      
      // 点积
      let dot = 0;
      for (let i = 0; i < ATTR_KEYS.length; i++) {
        dot += userVec[i] * hisVec[i];
      }
      
      // 余弦相似度（偏差向量）
      const similarity = Math.round((dot / (userNorm * hisNorm)) * 100);
      scores.push({ player, team, similarity });
    });
  });
  
  // 按相似度降序排列，取 Top N
  scores.sort((a, b) => b.similarity - a.similarity);
  return scores.slice(0, topN);
}

/**
 * 按 OVR 分三档（85-100、75-85、<75），每档取最相似球员
 */
function findTieredPlayers(attrs, pos) {
  const posAvg = SIM_CONFIG.POS_AVG[pos];
  if (!posAvg) return [];
  
  // 同位置组过滤：只匹配相同或相近位置的球员
  const POS_GROUP = {
    'PG': ['PG', 'SG'],
    'SG': ['SG', 'PG', 'SF'],
    'SF': ['SF', 'SG', 'PF'],
    'PF': ['PF', 'SF', 'C'],
    'C':  ['C', 'PF'],
  };
  const allowedPositions = POS_GROUP[pos] || ['PG', 'SG', 'SF', 'PF', 'C'];
  
  const userVec = ATTR_KEYS.map(k => (attrs[k] || 50) - (posAvg[k] || 50));
  const userNorm = Math.sqrt(userVec.reduce((s, v) => s + v * v, 1));
  
  const tiers = [
    { min: 85, max: 100, label: '精英', result: null, bestSim: -1 },
    { min: 75, max: 85, label: '主力', result: null, bestSim: -1 },
    { min: 0,  max: 75, label: '轮换', result: null, bestSim: -1 },
  ];
  
  NBA2K_TEAMS.forEach(team => {
    (NBA2K_DATA[team] || []).forEach(player => {
      const playerMainPos = getPlayerMainPos(player);
      if (!allowedPositions.includes(playerMainPos)) return;
      
      const ovr = parseInt(player.ovr) || 0;
      const tier = tiers.find(t => ovr >= t.min && ovr < t.max);
      if (!tier) return;
      
      const hisVec = ATTR_KEYS.map(k => (parseInt(player[k]) || 50) - (posAvg[k] || 50));
      const hisNorm = Math.sqrt(hisVec.reduce((s, v) => s + v * v, 1));
      let dot = 0;
      for (let i = 0; i < ATTR_KEYS.length; i++) {
        dot += userVec[i] * hisVec[i];
      }
      const similarity = Math.round((dot / (userNorm * hisNorm)) * 100);
      
      if (similarity > tier.bestSim) {
        tier.bestSim = similarity;
        tier.result = { player, team, similarity, ovr };
      }
    });
  });
  
  return tiers.map(t => t.result).filter(Boolean);
}

// ==================== 4.5 Archetype 推导匹配 ====================
/** 同类位置分组：匹配时只找同组球员 */
const POS_GROUP = {
  'PG': ['PG', 'SG'],
  'SG': ['SG', 'PG', 'SF'],
  'SF': ['SF', 'SG', 'PF'],
  'PF': ['PF', 'SF', 'C'],
  'C':  ['C', 'PF'],
};

/**
 * 按位置筛选 → 余弦匹配最相似球员 → 输出其 archetype
 */
function matchPlayerArchetype(attrs, topN = 3) {
  const ATTRS = ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'];
  const userPos = STATE.position || 'SF';
  const allowedPositions = POS_GROUP[userPos] || ['PG', 'SG', 'SF', 'PF', 'C'];
  
  // 用户属性向量
  const userVec = ATTRS.map(k => attrs[k] || 50);
  const userNorm = Math.sqrt(userVec.reduce((s, v) => s + v * v, 1));
  
  // 遍历所有 NBA 球员，只算同位置组的余弦相似度
  const playerScores = [];
  NBA2K_TEAMS.forEach(team => {
    (NBA2K_DATA[team] || []).forEach(player => {
      const playerMainPos = getPlayerMainPos(player);
      // 不在同位置组内 → 跳过
      if (!allowedPositions.includes(playerMainPos)) return;
      
      const playerVec = ATTRS.map(k => parseInt(player[k]) || 50);
      const playerNorm = Math.sqrt(playerVec.reduce((s, v) => s + v * v, 1));
      
      let dot = 0;
      for (let i = 0; i < ATTRS.length; i++) {
        dot += userVec[i] * playerVec[i];
      }
      
      const similarity = Math.round((dot / (userNorm * playerNorm)) * 1000) / 10;
      
      playerScores.push({
        similarity,
        player,
        team,
        archetype: player.type || 'Unknown',
        playerPos: playerMainPos,
      });
    });
  });
  
  // 按相似度降序，取 Top N
  playerScores.sort((a, b) => b.similarity - a.similarity);
  const topPlayers = playerScores.slice(0, topN);
  
  // 直接输出匹配球员的 archetype 信息
  return topPlayers.map(item => {
    const p = item.player;
    const meta = NBA2K_ARCHETYPES ? NBA2K_ARCHETYPES[item.archetype] : null;
    return {
      archetype: item.archetype,
      cn: meta?.cn || item.archetype,
      icon: meta?.icon || '⭐',
      category: meta?.category || 'all_around',
      similarity: item.similarity,
      avgOVR: meta?.avgOVR || 0,
      archCount: meta?.count || 0,
      player: p,
      playerName: p.cname || p.name,
      playerPos: item.playerPos,
      playerTeam: item.team,
      playerOVR: parseInt(p.ovr) || 0,
    };
  });
}

/** 获取 archetype 的中文分类名称 */
function getArchCategoryCN(category) {
  const map = {
    'shooter': '射手型',
    'slasher': '突破型',
    'two_way': '攻防一体',
    'playmaker': '组织型',
    'iso_scorer': '单打型',
    'big': '内线型',
    'athlete': '运动型',
    'stretch_big': '空间内线',
    'skill_creator': '技术流',
    'all_around': '全能型',
  };
  return map[category] || '全能型';
}

// ==================== 4. 揭幕 ====================
function revealPlayer() {
  STATE.finalOVR = calcOVR(STATE.attrs, STATE.position);
  STATE.finalPosition = STATE.position;
  
  showScreen('screen-reveal');

  // ★ Archetype 匹配 → 仅展示最终模板
  const archMatches = matchPlayerArchetype(STATE.attrs, 1);
  let archHtml = '';
  if (archMatches.length > 0) {
    const best = archMatches[0];
    STATE.finalArchetype = best.archetype;  // ← 记录模板，供成就系统使用
    
    archHtml = `<div class="rv-item" style="animation-delay:1.0s;margin:8px 10px 0;padding:10px 10px;background:var(--bg-card);border:2px solid var(--orange);border-radius:var(--radius);">
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--orange-bg);border-radius:10px;">
        <span style="font-size:22px;">${best.icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--text);">${best.cn}</div>
        </div>
      </div>
    </div>`;
  }
  
  // 按 OVR 分三档展示最相似球员
  const tiered = findTieredPlayers(STATE.attrs, STATE.position);
  let top3Html = '';
  if (tiered.length > 0) {
    
    top3Html = `<div class="rv-item" style="animation-delay:1.3s;margin:8px 10px 0;padding:8px 10px;background:var(--bg-card);border:2px solid var(--border);border-radius:var(--radius);">
      <div style="font-family:var(--font-display);font-size:12px;color:var(--orange);margin-bottom:6px;letter-spacing:1px;">🔍 球员模板</div>`;
    tiered.forEach((item, i) => {
      const p = item.player;
      const hsStyle = getPlayerHeadshotStyle(p.name, 28);
      top3Html += `<div class="rv-item" style="animation-delay:${1.4 + i * 0.12}s;display:flex;align-items:center;gap:6px;padding:4px 0;${i < tiered.length-1 ? 'border-bottom:1px solid var(--border-light);' : ''}">
        <div class="bp-headshot" style="${hsStyle};border-radius:50%;border:2px solid var(--border);"></div>
        <div style="flex:1;text-align:center;font-family:var(--font-display);font-size:12px;font-weight:600;">${p.cname || p.name}</div>
      </div>`;
    });
    top3Html += '</div>';
  }
  
  // 给每个 reveal-stat 加渐入延迟
  let statsHtmlWithDelay = '';
  ATTR_KEYS.forEach((k, i) => {
    const val = STATE.attrs[k] || 50;
    const g = getGrade(val);
    statsHtmlWithDelay += `<div class="reveal-stat" style="animation-delay:${0.5 + i * 0.06}s">
      <div class="label">${attrCN(k)}</div>
      <div class="value" style="color:${g.color}">${g.letter}</div>
    </div>`;
  });
  
  html('reveal-content').innerHTML = `
    <div class="rv-card-wrap">
      <div class="reveal-card">
        <div class="rv-item" style="animation-delay:0.1s"><div class="reveal-label">我的球员</div></div>
         <div class="rv-item" style="animation-delay:0.2s"><div class="big-cname">${getHupuDisplayName()}</div></div>
        <div class="rv-ovr" style="animation-delay:0.3s"><div class="big-ovr">${STATE.finalOVR}</div></div>
        <div class="rv-item" style="animation-delay:0.4s"><div class="big-pos">${SIM_CONFIG.POSITIONS[STATE.position]}</div></div>
      </div>
    </div>
    <div class="reveal-stats">${statsHtmlWithDelay}</div>
    ${archHtml}
    ${top3Html}
  `;
}

function goToCareer() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC4",label:"开始生涯"});
  showScreen('screen-career');
  if (shouldRunDraftStory()) {
    showDraftStory();
  } else {
    renderCareerSpin();
  }
}

// ==================== 选秀夜 DAG（draft_night） ====================
function shouldRunDraftStory() {
  var c = STATE.career;
  if (!c) return false;
  if (c.flags && c.flags.draftDone) return false;
  if ((c.seasonCount || 0) > 0) return false;
  if (c.draft && c.draft.pick) return false;
  return true;
}

function getDraftPickLabel(d) {
  if (!d) return '未知';
  if (d.type === 'undrafted') return '落选';
  if (d.round === 2) return '次轮第' + d.pick + '顺位';
  return '首轮第' + d.pick + '顺位';
}

function recordDraftChoice(stepId, stepTitle, label, result) {
  var c = STATE.career;
  if (!c) return;
  c.branchHistory = c.branchHistory || [];
  c.branchHistory.push({
    seasonNum: 0,
    phase: 'career_start',
    branch: 'draft_night',
    eventId: stepId,
    event: stepTitle,
    choice: label,
    result: result || ''
  });
}

function showDraftChoiceModal(stepId, title, scene, choices, onDone) {
  var old = document.getElementById('draft-modal');
  if (old) old.remove();
  var html = '<div class="team-picker-overlay" id="draft-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + sanitizePlayerFacingText(scene) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  choices.forEach(function(ch, ci) {
    html += '<button class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;" onclick="chooseDraftChoice(' + ci + ')">' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(ch.hint || '') + '</span></button>';
  });
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  STATE._draftModalStep = { stepId: stepId, title: title, choices: choices, onDone: onDone };
}

function chooseDraftChoice(idx) {
  var modal = STATE._draftModalStep;
  if (!modal) return;
  var ch = modal.choices[idx];
  if (!ch) return;
  var msg = '';
  try { msg = ch.apply ? ch.apply() : ''; } catch(e) { msg = ''; }
  msg = sanitizePlayerFacingText(msg || '');
  recordDraftChoice(modal.stepId, modal.title, ch.label, msg);
  var done = modal.onDone;
  var overlay = document.getElementById('draft-modal');
  if (overlay) overlay.remove();
  STATE._draftModalStep = null;
  if (msg) showDraftResultModal(modal.title, msg, done);
  else if (done) done();
}

function showDraftSceneModal(title, scene, btnText, onNext) {
  var old = document.getElementById('draft-modal');
  if (old) old.remove();
  var html = '<div class="team-picker-overlay" id="draft-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + sanitizePlayerFacingText(scene) + '</div>';
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="closeDraftScene()">' + (btnText || '继续') + '</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  STATE._draftSceneStep = { onNext: onNext };
}

function closeDraftScene() {
  var s = STATE._draftSceneStep;
  var overlay = document.getElementById('draft-modal');
  if (overlay) overlay.remove();
  STATE._draftSceneStep = null;
  if (s && s.onNext) s.onNext();
}

function showDraftResultModal(title, msg, onNext) {
  var old = document.getElementById('draft-result-modal');
  if (old) old.remove();
  STATE._draftResultDone = typeof onNext === 'function' ? onNext : null;
  var html = '<div class="team-picker-overlay" id="draft-result-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += formatBranchResultText(msg);
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continueDraftResult()">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueDraftResult() {
  var modal = document.getElementById('draft-result-modal');
  if (modal) modal.remove();
  var done = STATE._draftResultDone;
  STATE._draftResultDone = null;
  if (typeof done === 'function') done();
}

function showDraftStory() {
  STATE._draftPending = {
    agent: null, prep: null, type: null, round: 1, pick: 1,
    twoWay: false, contractYears: 4, selfPicked: false
  };
  STATE.career.branches = STATE.career.branches || {};
  setBranchNode('draft_night', 'draft_entry');
  showDraftChoiceModal('draft_entry', '选秀前夜',
    '选秀大会前一晚，你躺在酒店的床上看球探报告。报告里的形容词很分裂：有天赋、有空白、上限高、下限低。经纪人打电话来，只问了一句：明天你想让联盟先记住你什么？',
    [
      { label: '仔细看球探报告', hint: '更清楚自己的定位', apply: function() {
        addProfileDelta('mediaTrust', 1);
        return '你把每条优缺点都背了下来。第二天走上台时，你至少知道自己不是来碰运气的。<br><br>效果：媒体好感+1。';
      }},
      { label: '关掉手机睡觉', hint: '让身体先休息', apply: function() {
        addSeasonMod('formVariance', -1, -10, 10);
        return '你关掉手机，把明天的自己交给睡眠。窗外城市还在亮，你已经先一步安静下来。<br><br>效果：状态波动-1。';
      }}
    ],
    function() {
      setBranchNode('draft_night', 'draft_agent');
      showDraftAgentStep();
    });
}

function showDraftAgentStep() {
  showDraftChoiceModal('draft_agent', '经纪团队',
    '经纪人把三种选择摊在桌上：大牌公司、中型团队、还是让家里人帮忙。他说这不是签一份合同，是选一种未来十年的说话方式。',
    [
      { label: '大牌经纪公司', hint: '曝光更高，压力也更大', apply: function() {
        STATE._draftPending.agent = 'big';
        addProfileDelta('fame', 2);
        addProfileDelta('businessValue', 1);
        addSeasonMod('mediaPressure', 1, -10, 10);
        return '公司第一周就给你排满了采访和商业拍摄。曝光来得很快，快到你开始重新学习怎么在镜头前呼吸。<br><br>效果：人气+2；商业价值+1；媒体压力+1。';
      }},
      { label: '中型团队', hint: '更关注你这个人', apply: function() {
        STATE._draftPending.agent = 'mid';
        addProfileDelta('coachTrust', 1);
        return '团队不大，但每个人都叫得出你高中教练的名字。他们更关心你的下一步，而不是下一条热搜。<br><br>效果：教练信任+1。';
      }},
      { label: '家人朋友团队', hint: '最信任的人陪你走', apply: function() {
        STATE._draftPending.agent = 'family';
        addProfileDelta('loyalty', 2);
        addProfileDelta('businessValue', -1);
        return '合同谈判桌上坐着的是你表哥和从小看你打球的朋友。他们不够专业，但每一个条款都会先问你一句：你开心吗。<br><br>效果：忠诚+2；商业价值-1。';
      }}
    ],
    function() {
      showDraftPrepStep();
    });
}

function showDraftPrepStep() {
  showDraftChoiceModal('draft_prep', '试训策略',
    '经纪团队把一份试训安排放在你面前：联合试训、几支球队的单独邀请，或者什么都不去。他说：联合试训是最大的舞台，也是最大的放大镜。',
    [
      { label: '参加联合试训', hint: '曝光最高，也有状态风险', apply: function() {
        STATE._draftPending.prep = 'combine';
        setBranchNode('draft_night', 'draft_combine');
        if (Math.random() < 0.1) {
          STATE._draftPending.combineHurt = true;
          addSeasonMod('formVariance', 1, -10, 10);
          addSeasonMod('mediaPressure', 1, -10, 10);
        }
        return '你走进联合试训的球馆。所有球队的球探坐在同一排，你每投进一球，就有人低头记笔记。';
      }},
      { label: '只参加单独试训', hint: '更稳，教练好感小幅上升', apply: function() {
        STATE._draftPending.prep = 'workouts';
        setBranchNode('draft_night', 'draft_workouts');
        addProfileDelta('coachTrust', 1);
        return '你只接受了几支球队的单独试训，把每一分钟都用在真正感兴趣的球队面前。<br><br>效果：教练信任+1。';
      }},
      { label: '不试训', hint: '保留神秘感，顺位可能下滑', apply: function() {
        STATE._draftPending.prep = 'skip';
        setBranchNode('draft_night', 'draft_skip');
        addProfileDelta('controversy', 1);
        addProfileDelta('mediaTrust', -1);
        return '你把试训邀请全部推掉。新闻里开始有人问：他到底在躲什么？你只是照常训练。<br><br>效果：争议+1；媒体好感-1。';
      }}
    ],
    function() {
      if (STATE._draftPending.combineHurt) {
        showDraftResultModal('试训策略',
          '联合试训的最后一场，你在一次变向时感觉大腿发紧。队医让你提前结束，顺位预测被媒体往下调了一点。<br><br>效果：状态波动+1；媒体压力+1。',
          nextDraftReady);
      } else {
        nextDraftReady();
      }
    });
}

function computeDraftBand() {
  var p = STATE._draftPending;
  var ovr = STATE.finalOVR || 50;
  var shift = 0;
  if (p.prep === 'combine') {
    shift = p.combineHurt ? -2 : Math.floor(Math.random() * 4);
  } else if (p.prep === 'workouts') {
    shift = Math.random() < 0.45 ? 1 : 0;
  } else if (p.prep === 'skip') {
    shift = -(2 + Math.floor(Math.random() * 4));
  }
  var v = ovr + shift;
  if (v >= 88) { p.type = 'lottery'; p.round = 1; p.pick = 1 + Math.floor(Math.random() * 5); }
  else if (v >= 84) { p.type = 'lottery'; p.round = 1; p.pick = 6 + Math.floor(Math.random() * 9); }
  else if (v >= 78) { p.type = 'first'; p.round = 1; p.pick = 15 + Math.floor(Math.random() * 16); }
  else if (v >= 70) { p.type = 'second'; p.round = 2; p.pick = 31 + Math.floor(Math.random() * 15); }
  else { p.type = 'undrafted'; p.round = 0; p.pick = 0; }
  if (p.type === 'lottery') p.contractYears = 4;
  else if (p.type === 'first') p.contractYears = 3 + Math.floor(Math.random() * 2);
  else if (p.type === 'second') p.contractYears = 2;
  else p.contractYears = 1;
  return p;
}

function nextDraftReady() {
  setBranchNode('draft_night', 'draft_ready');
  computeDraftBand();
  var p = STATE._draftPending;
  var scenes = {
    lottery: '选秀大会开始。前几个名字被念出时，你听见自己的心跳。镜头切到你的方向，现场突然安静了一瞬。',
    first: '选秀大会进行到一半，你的名字出现在预测板的中间位置。电视镜头偶尔扫到你，你努力让自己看起来镇定。',
    second: '次轮的等待比首轮长得多。每念出一个名字，你都先看手机，再假装没事。',
    undrafted: '名字一路念到次轮最后一位。手机没有响。你关掉直播，站起来，把窗推开。'
  };
  showDraftSceneModal('选秀大会', scenes[p.type] || scenes.first, '继续', showDraftResultStep);
}

function showDraftResultStep() {
  var p = STATE._draftPending;
  var pickLabel = getDraftPickLabel(p);
  if (p.type === 'lottery') {
    setBranchNode('draft_night', 'draft_green_room');
    showDraftChoiceModal('draft_green_room', '选秀结果 · ' + pickLabel,
      '你在绿屋里坐着，面前摆着水和手机。念到你的名字时，全场鼓掌。聚光灯亮得看不清台下，但你记得家人的方向。',
      [
        { label: '高调庆祝', hint: '自信一点，让镜头记住你', apply: function() {
          addProfileDelta('fame', 1);
          addSeasonMod('mediaPressure', 1, -10, 10);
          return '你站起来和身边的人击掌，镜头跟着你直到落座。今晚的标题已经写好：自信，或者自大。<br><br>效果：人气+1；媒体压力+1。';
        }},
        { label: '冷静握手', hint: '话少一点，更稳一点', apply: function() {
          addProfileDelta('mediaTrust', 1);
          addProfileDelta('fanSupport', 1);
          return '你和总经理握手，对镜头点了点头。没有多余动作，反而让人记住了你的名字。<br><br>效果：媒体好感+1；球迷支持+1。';
        }},
        { label: '感谢家人', hint: '把第一句话留给最重要的人', apply: function() {
          addProfileDelta('loyalty', 1);
          addProfileDelta('fanSupport', 1);
          return '你在镜头前先看向家人。那句话很短，但全场都听见了。<br><br>效果：忠诚+1；球迷支持+1。';
        }}
      ],
      afterDraftResult);
  } else if (p.type === 'first') {
    setBranchNode('draft_night', 'draft_picked_first');
    showDraftChoiceModal('draft_picked_first', '选秀结果 · ' + pickLabel,
      '手机在桌上震了三次，你接起来，那头是球队总经理：欢迎来到 NBA。你还没回过神，电视已经打出你的名字。',
      [
        { label: '承诺努力训练', hint: '先证明态度', apply: function() {
          addProfileDelta('coachTrust', 1);
          addProfileDelta('fanSupport', 1);
          return '你接过球队球衣，只说了一句：我会第一个到训练馆。<br><br>效果：教练信任+1；球迷支持+1。';
        }},
        { label: '直接谈角色', hint: '把定位问清楚', apply: function() {
          addProfileDelta('coachTrust', -1);
          addProfileDelta('mediaTrust', 1);
          return '你直接问了球队准备怎么用你。问题很职业，但教练记住的是你第一天就谈条件。<br><br>效果：教练信任-1；媒体好感+1。';
        }},
        { label: '感谢球队', hint: '先表达尊重', apply: function() {
          addProfileDelta('loyalty', 1);
          addProfileDelta('mediaTrust', 1);
          return '你在电话里感谢了总经理和教练。话不多，但每个人都听得出来是真的。<br><br>效果：忠诚+1；媒体好感+1。';
        }}
      ],
      afterDraftResult);
  } else if (p.type === 'second') {
    setBranchNode('draft_night', 'draft_picked_second');
    showDraftChoiceModal('draft_picked_second', '选秀结果 · ' + pickLabel,
      '次轮的等待比首轮长得多。终于轮到你时，电话里没有恭喜，第一句话是：我们想先谈谈合同。',
      [
        { label: '接受双向合同', hint: '先进联盟，再谈位置', apply: function() {
          p.twoWay = true;
          p.contractYears = 2;
          return '你接受了双向合同。没有盛大的发布会，只有一份在联盟和发展联盟之间来回的日程表。<br><br>效果：双向合同。';
        }},
        { label: '争全额保障', hint: '把身价谈出来', apply: function() {
          if (Math.random() < 0.65) {
            p.contractYears = 2;
            return '你坚持要一份正式合同。谈判磨了三天，最后球队让步了。<br><br>效果：2年正式合同。';
          }
          p.twoWay = true;
          return '球队没有让步。你争到最后，拿到的还是一份双向合同，但所有人都知道你来过谈判桌。<br><br>效果：双向合同。';
        }},
        { label: '沉默等待', hint: '让球队先亮牌', apply: function() {
          p.contractYears = 2;
          addProfileDelta('mediaTrust', 1);
          return '你没有催，只是每天准时训练。两天后，球队打来电话：合同准备好了。<br><br>效果：2年正式合同；媒体好感+1。';
        }}
      ],
      afterDraftResult);
  } else {
    setBranchNode('draft_night', 'draft_undrafted');
    showDraftChoiceModal('draft_undrafted', '落选',
      '名字念完了。电视切走，经纪人发来一条消息：还有路。你关掉电视，没有立刻回，先站起来投了一组球。',
      [
        { label: '接受训练营合同', hint: '从最底层开始拼', apply: function() {
          p.contractYears = 2;
          return '你把行李搬进训练营，床位号写在最后一排。教练说：这里所有人都在抢同一个名额。<br><br>效果：2年非保障合同。';
        }},
        { label: '去海外历练', hint: '晚一年回来，但更硬', apply: function() {
          p.contractYears = 1;
          STATE.career.currentAge++;
          addAttrDelta('FIN', 1);
          addAttrDelta('PAS', 1);
          STATE.finalOVR = calcOVR(STATE.attrs);
          return '你登上飞往海外的航班。那里的对抗更脏、更挤，也让你更快学会保护球。<br><br>效果：一年后回归；终结+1，传球+1；年龄+1。';
        }},
        { label: '休整一年', hint: '把身体修好，晚点再来', apply: function() {
          p.contractYears = 1;
          STATE.career.currentAge++;
          addSeasonMod('formVariance', -1, -10, 10);
          return '你给自己放了一年假。没有球探，没有试训，只有恢复、力量和重新想明白为什么打球。<br><br>效果：年龄+1；状态波动-1。';
        }}
      ],
      afterDraftResult);
  }
}

function afterDraftResult() {
  setBranchNode('draft_night', 'draft_contract');
  renderCareerSpin();
}

function runPostDraftContractFlow(team, done) {
  var p = STATE._draftPending;
  if (!p) { done(); return; }
  if (p.selfPicked) {
    setBranchNode('draft_night', 'draft_forced_trade');
    p.contractYears = Math.max(1, (p.contractYears || 1) - 1);
    addProfileDelta('coachTrust', -2);
    addProfileDelta('fanSupport', -3);
    addSeasonMod('mediaPressure', 1, -10, 10);
    var tn = getTeamName ? getTeamName(team) : team;
    var msg = '你被选中的消息刚上新闻，交易流言就跟着到了。第二天，球队官宣：你最终加盟 ' + tn + '。评论区有人说你聪明，有人说你不够忠诚。<br><br>效果：教练信任-2；球迷支持-3；媒体压力+1；合同年限缩短。';
    recordDraftChoice('draft_forced_trade', '交易官宣', '接受交易', msg);
    showDraftResultModal('交易官宣', msg, function() { showDraftContractStep(team, done); });
  } else {
    showDraftContractStep(team, done);
  }
}

function showDraftContractStep(team, done) {
  showDraftSceneModal('签下第一份合同',
    '合同摆在桌上，第一页是数字，后面几十页都是话。经纪人逐条念给你听：保障金额、激励条款、球队选项。你签下名字时，突然意识到这就是你从小打球的终点和起点。',
    '签下名字',
    function() {
      var p = STATE._draftPending;
      var years = (p && p.contractYears) || 4;
      showDraftResultModal('签下第一份合同',
        '你签下一份' + years + '年合同。笔尖落下去的那一刻，第一页的数字忽然变得具体。<br><br>效果：初始合同' + years + '年。',
        function() { finalizeDraft(team, done); });
    });
}

function showDraftPressStep(team, done) {
  showDraftChoiceModal('draft_press', '新秀发布会',
    '发布会上，话筒从你面前一个个传过来。有人问你最想证明什么，有人问你对交易流言的看法，还有人问：你觉得自己是新秀里的第几名？',
    [
      { label: '谦逊回应', hint: '把期待放低一点', apply: function() {
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('mediaPressure', -1, -10, 10);
        return '你说：我想先证明自己能留在这个联盟。台下有人点头，也有人觉得你太保守。<br><br>效果：媒体好感+1；媒体压力-1。';
      }},
      { label: '自信回应', hint: '把目标说出来', apply: function() {
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你说：我不只是来打球的，我是来被记住的。第二天，这句话被剪进所有选秀集锦。<br><br>效果：人气+1；争议+1。';
      }},
      { label: '沉默寡言', hint: '让表现替你说话', apply: function() {
        addProfileDelta('fanSupport', 1);
        addProfileDelta('mediaTrust', -1);
        return '你回答了每一个问题，但每一句都很短。记者们开始讨论：他是内向，还是高傲？<br><br>效果：球迷支持+1；媒体好感-1。';
      }}
    ],
    function() { showDraftFirstPracticeStep(team, done); });
}

function showDraftFirstPracticeStep(team, done) {
  showDraftChoiceModal('draft_first_practice', '教练角色谈话',
    '教练把你叫进办公室，桌上没有战术板，只有一张轮换表。他说：你想成为谁我知道，但现在球队需要你先做好另一件事。',
    [
      { label: '接受定位', hint: '先赢得教练信任', apply: function() {
        addProfileDelta('coachTrust', 2);
        return '你说：教练安排什么，我就做好什么。他看了你两秒，在轮换表上写下了你的名字。<br><br>效果：教练信任+2。';
      }},
      { label: '争取更多球权', hint: '把野心说清楚', apply: function() {
        addProfileDelta('coachTrust', -1);
        addSeasonMod('formVariance', 1, -10, 10);
        return '你当面说出了自己的想法。教练没有拒绝，只是提醒你：机会要自己挣。<br><br>效果：教练信任-1；状态波动+1。';
      }},
      { label: '用表现说话', hint: '少说多做', apply: function() {
        addProfileDelta('coachTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有多说，只是提前半小时到训练馆。教练路过时，没有说话，但记住了你的号码。<br><br>效果：教练信任+1；状态波动-1。';
      }}
    ],
    function() { finalizeDraft(team, done); });
}

function finalizeDraft(team, done) {
  var p = STATE._draftPending;
  var c = STATE.career;
  c.draft = {
    year: 2026,
    round: p.round,
    pick: p.pick,
    team: team,
    type: p.type,
    twoWay: !!p.twoWay,
    guaranteed: !p.twoWay,
    prep: p.prep,
    agent: p.agent,
    contractYears: p.contractYears,
    selfPicked: !!p.selfPicked
  };
  c.flags = c.flags || {};
  c.flags.draftDone = true;
  if (p.selfPicked) c.flags.draftTrade = true;
  c.contract = p.contractYears;
  setBranchNode('draft_night', 'draft_done');
  STATE._draftPending = null;
  STATE._draftSelfPick = false;
  if (done) done();
}

function renderCareerTeamReveal(team, cnName, role, rosterHtml) {
  var isBench = !!(STATE.career && STATE.career.flags && STATE.career.flags.startBench);
  var finalRole = isBench ? '替补' : role;
  STATE.season.isUserStarter = !isBench && role === '首发';
  var draftLine = '';
  var d = STATE.career && STATE.career.draft;
  if (d && d.type !== 'undrafted') {
    draftLine = ' · ' + (d.round === 2 ? '次轮第' + d.pick + '顺位' : '首轮第' + d.pick + '顺位');
  }
  html('career-area').innerHTML = `
    <div style="padding:0 12px;" id="career-scroll">
      <div class="reveal-card" style="position:relative;">
        <div style="position:absolute;top:8px;left:8px;">${getTeamLogo(team, 32)}</div>
        <div style="font-size:13px;color:var(--text-dim);">${getCurrentSeasonLabel()} · 我的生涯球队${draftLine}</div>
        <div style="font-size:24px;font-weight:800;margin:6px 0;font-family:var(--font-display);letter-spacing:2px;">${cnName}</div>
        <div style="font-size:12px;color:var(--text-dim);">我担任的角色为${finalRole}${SIM_CONFIG.POSITIONS[STATE.position]}</div>
        <div style="margin-top:12px;">
          <button class="btn btn-primary" onclick="trackEvent({act:'click',blk:'BMC098',pos:'TC7',label:'开始赛季'});startSeason()">🏀 开始赛季</button>
        </div>
      </div>
      <div style="margin-top:8px;background:var(--bg-card);border:2px solid var(--border);border-radius:var(--radius-sm);padding:8px 4px;">
        ${rosterHtml}
      </div>
    </div>
  `;
}

// ==================== 5. 生涯球队分配 ====================
function renderCareerSpin() {
  var pool = STATE._teamsVisited.length > 0 ? STATE._teamsVisited : [...NBA2K_TEAMS].sort();
  const sorted = pool.slice().sort();
  const copies = 5;
  const allItems = [];
  for (let c = 0; c < copies; c++) {
    sorted.forEach(t => allItems.push(t));
  }
  
  let itemsHtml = '';
  allItems.forEach(t => {
    const cn = SIM_CONFIG.TEAM_NAMES[t] || t;
    itemsHtml += `<div class="br-slot-item" data-team="${t}">${cn}</div>`;
  });
  
  html('career-area').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - 100px);padding:12px 12px;">
      <div class="br-slot-area" style="max-width:320px;width:100%;">
        <div class="br-slot-label">🎰 选择我的生涯球队</div>
      <div class="br-slot-wrapper">
        <div class="br-slot-machine career-slot">
          <div class="br-slot-reel" id="career-slot-reel">
            ${itemsHtml}
          </div>
        </div>
      </div>
      <div class="br-slot-actions" style="margin-top:12px;">
        <button class="btn btn-sm slot-btn" onclick="pullCareerHandle()" style="background:var(--orange);color:#fff;">
          🎲 随机球队
        </button>
        <button class="btn btn-sm slot-btn" onclick="showCareerTeamPicker()" style="background:var(--bg-card);color:var(--text);">
          🎯 自选球队
        </button>
      </div>
    </div>
  `;
  
  if (typeof fetchAdTeamTask === 'function') fetchAdTeamTask();
  
  const reel = document.getElementById('career-slot-reel');
  if (reel) {
    const offset = sorted.length * 38 + 38; // 初始偏移到第2复制块，留出上方2项缓冲
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${offset}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
  }
}

function pullCareerHandle() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC5",label:"随机球队-生涯"});
  setTimeout(spinCareerSlot, 200);
}

function spinCareerSlot() {
  const reel = document.getElementById('career-slot-reel');
  if (!reel) return;
  
  var pool = STATE._teamsVisited.length > 0 ? STATE._teamsVisited : [...NBA2K_TEAMS].sort();
  var sorted = pool.slice().sort();
  var teamCount = sorted.length;
  const itemH = 38;
  const copyLen = teamCount * itemH;
  
  const targetIdx = Math.floor(Math.random() * teamCount);
  const targetTeam = sorted[targetIdx];
  
  // 窗口显示5项，中间项索引=2，所以偏移到 targetIdx-2
  const snapIdx = (targetIdx - 2 + teamCount) % teamCount;
  const targetY = copyLen * 2 + snapIdx * itemH;
  
  const curMatch = reel.style.transform.match(/([\d.]+)/);
  const curY = curMatch ? parseFloat(curMatch[0]) : copyLen + 38;
  
  let finalY = targetY;
  while (finalY <= curY + copyLen * 0.5) {
    finalY += copyLen;
  }
  
  const maxY = copyLen * 4 - itemH * 4;
  if (finalY > maxY) {
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${copyLen}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
    finalY = targetY + copyLen;
  }
  
  reel.classList.add('spinning');
  reel.style.transform = `translateY(-${finalY}px)`;
  
  setTimeout(() => {
    reel.classList.remove('spinning');
    
    // ★ 精确回正
    const exactY = copyLen * 3 + snapIdx * itemH;
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${exactY}px)`;
    void reel.offsetHeight;
    reel.style.transition = '';
    
    // ★ 高亮中间项（窗口5项，snapIdx为顶部，中间=snapIdx+2）
    var middleIdx = teamCount * 3 + snapIdx + 2;
    highlightSlotItem('career-slot-reel', middleIdx);
    
    STATE._draftSelfPick = false;
    selectCareerTeam(targetTeam);
  }, 3300);
}

function selectCareerTeam(team) {
  STATE.careerTeam = team;
  const teamPlayers = NBA2K_DATA[team];
  const cnName = getTeamName(team);

  var pos = STATE.position;
  var myOvr = STATE.finalOVR;
  var isLogin = isHupuLoggedIn();
  var displayName = getHupuDisplayName();

  STATE._lineupCache = {};
  var lineup = calcTeamLineup(team);
  var posOrder = ['PG', 'SG', 'SF', 'PF', 'C'];
  var starters = posOrder.map(function(p) { return lineup.starters[p]; }).filter(Boolean);
  var bench = lineup.bench || [];
  var startBench = !!(STATE.career && STATE.career.flags && STATE.career.flags.startBench);
  var role = (!startBench && lineup.isUserStarter) ? '首发' : '替补';
  STATE.season.isUserStarter = !startBench && !!lineup.isUserStarter;
  
  // 自建球员头像：用户头像 / 默认头像
  var defaultAvatar = DEFAULT_PLAYER_AVATAR;
  if (!HUPU_USER.loaded || !HUPU_USER.isLogin) { ensureHupuUser(true); }
  var avatarUrl = defaultAvatar;
  
  function renderRosterPlayer(p, isUser, idx) {
    var pOvr = parseInt(p.ovr) || 0;
    var pPos = p.posCn || p.pos || '—';
    var pName = p.cname || p.name;
    var imgHtml;
    if (isUser) {
      imgHtml = '<' + 'img class="bp-headshot" style="border-radius:50%;border:2px solid var(--border);width:28px;height:28px;object-fit:cover;" src="' + avatarUrl + '" onerror="this.onerror=null;this.src=\'' + defaultAvatar + '\'">';
    } else {
      var hs = getPlayerHeadshotStyle(p.name, 28);
      imgHtml = hs ? '<div class="bp-headshot" style="' + hs + ';border-radius:50%;border:2px solid var(--border);width:28px;height:28px;"></div>' : '<div style="width:28px;height:28px;border-radius:50%;background:var(--border);"></div>';
    }
    var starBadge = isUser ? '<span style="font-size:10px;margin-left:2px;">⭐</span>' : '';
    return '<div style="display:flex;align-items:center;gap:5px;padding:4px 6px;border-bottom:1px solid var(--border-light);font-size:12px;' + (isUser ? 'background:var(--orange-bg);border-radius:6px;margin:1px 0;border:1.5px solid var(--orange);' : '') + '">'
      + imgHtml
      + '<span style="width:40px;font-size:10px;color:var(--text-dim);">' + pPos + '</span>'
      + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:' + (isUser ? '700' : '400') + ';color:' + (isUser ? 'var(--orange)' : 'var(--text)') + ';">' + pName + starBadge + '</span>'
      + '<span style="font-family:var(--font-display);font-weight:700;font-size:13px;color:' + (isUser ? 'var(--orange)' : 'var(--text)') + ';">' + pOvr + '</span>'
      + '</div>';
  }
  
  var rosterHtml = '<div style="font-family:var(--font-display);font-size:11px;color:var(--orange);padding:2px 4px 4px;letter-spacing:0.5px;">🏀 首发阵容</div>';
  starters.forEach(function(p) { rosterHtml += renderRosterPlayer(p, p._isUser); });
  rosterHtml += '<div style="font-family:var(--font-display);font-size:11px;color:var(--text-dim);padding:6px 4px 4px;letter-spacing:0.5px;border-top:1px solid var(--border);margin-top:2px;">🔄 替补阵容</div>';
  bench.forEach(function(p, i) { rosterHtml += renderRosterPlayer(p, p._isUser, i); });
  
  // ★ 保存本次建球员数据到 storage
  saveBuildPlayerData(team);
  autoSaveGame();

  if (STATE._draftPending) {
    STATE._draftPending.selfPicked = !!STATE._draftSelfPick;
    STATE._draftSelfPick = false;
    runPostDraftContractFlow(team, function() {
      autoSaveGame();
      renderCareerTeamReveal(team, cnName, role, rosterHtml);
    });
  } else {
    STATE._draftSelfPick = false;
    autoSaveGame();
    renderCareerTeamReveal(team, cnName, role, rosterHtml);
  }
}

// ==================== 球队阵容预览与签约弹窗 ====================
function previewTeamRosterModal(team, onConfirmSign, offerYears) {
  var old = document.getElementById('team-roster-preview-overlay');
  if (old) old.remove();

  var cn = typeof getTeamName === 'function' ? getTeamName(team) : team;
  var city = (window.TEAM_CITY && window.TEAM_CITY[team]) || '';
  var logo = getTeamLogo(team, 32);
  var lineup = calcTeamLineup(team);
  var starters = Object.values(lineup.starters || {});
  var bench = lineup.bench || [];
  var power = calcTeamPowerWithPlayer(team);

  var rosterHtml = '<div style="max-height:48vh;overflow-y:auto;padding:6px 12px;">';
  rosterHtml += '<div style="font-family:var(--font-display);font-size:12px;color:var(--orange);padding:4px 0;font-weight:700;">🏀 首发五虎</div>';
  starters.forEach(function(p) {
    var pOvr = parseInt(p.ovr) || 0;
    var pPos = p.posCn || p.pos || '—';
    var pName = p.cname || p.name;
    var hs = typeof getPlayerHeadshotStyle === 'function' ? getPlayerHeadshotStyle(p.name, 26) : '';
    var imgHtml = hs ? '<div style="' + hs + ';border-radius:50%;border:1px solid var(--border);width:26px;height:26px;flex-shrink:0;"></div>' : '<div style="width:26px;height:26px;border-radius:50%;background:var(--border);flex-shrink:0;"></div>';
    rosterHtml += '<div style="display:flex;align-items:center;gap:6px;padding:5px 6px;border-bottom:1px solid var(--border-light);font-size:12px;">'
      + imgHtml
      + '<span style="width:36px;font-size:11px;color:var(--text-dim);">' + pPos + '</span>'
      + '<span style="flex:1;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + pName + '</span>'
      + '<span style="font-family:var(--font-display);font-weight:700;font-size:13px;color:var(--orange);">' + pOvr + '</span>'
      + '</div>';
  });

  if (bench.length > 0) {
    rosterHtml += '<div style="font-family:var(--font-display);font-size:12px;color:var(--text-dim);padding:8px 0 4px;font-weight:700;border-top:1px solid var(--border);margin-top:6px;">🔄 主要轮换阵容</div>';
    bench.slice(0, 5).forEach(function(p) {
      var pOvr = parseInt(p.ovr) || 0;
      var pPos = p.posCn || p.pos || '—';
      var pName = p.cname || p.name;
      var hs = typeof getPlayerHeadshotStyle === 'function' ? getPlayerHeadshotStyle(p.name, 24) : '';
      var imgHtml = hs ? '<div style="' + hs + ';border-radius:50%;border:1px solid var(--border);width:24px;height:24px;flex-shrink:0;"></div>' : '<div style="width:24px;height:24px;border-radius:50%;background:var(--border);flex-shrink:0;"></div>';
      rosterHtml += '<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-bottom:1px solid var(--border-light);font-size:11px;color:var(--text-dim);">'
        + imgHtml
        + '<span style="width:36px;font-size:10px;">' + pPos + '</span>'
        + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + pName + '</span>'
        + '<span style="font-family:var(--font-display);font-weight:600;">' + pOvr + '</span>'
        + '</div>';
    });
  }
  rosterHtml += '</div>';

  var signBtnText = (typeof offerYears === 'number' && offerYears > 0) ? ('🖊️ 签约加盟 (' + offerYears + '年合同)') : '📝 确认签约加盟';

  var overlay = document.createElement('div');
  overlay.className = 'team-picker-overlay';
  overlay.id = 'team-roster-preview-overlay';
  overlay.style.zIndex = '10001';
  overlay.innerHTML =
    '<div class="team-picker-modal" style="max-width:380px;">' +
      '<div class="team-picker-header">' +
        '<div style="display:flex;align-items:center;gap:8px;">' + logo + '<div><div style="font-size:15px;font-weight:700;">' + cn + '</div><div style="font-size:11px;color:var(--text-dim);font-weight:400;">' + city + ' · 战力评分 ' + Math.round(power.depth || 50) + '</div></div></div>' +
        '<button class="team-picker-close" onclick="document.getElementById(\'team-roster-preview-overlay\').remove()">✕</button>' +
      '</div>' +
      rosterHtml +
      '<div style="padding:10px 12px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;">' +
        '<button onclick="document.getElementById(\'team-roster-preview-overlay\').remove()" style="padding:8px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text-dim);font-size:12px;cursor:pointer;">返回</button>' +
        '<button id="confirmSignBtn" style="padding:8px 16px;border:none;border-radius:8px;background:linear-gradient(135deg,#ff6b35,#ff8a5c);color:#fff;font-family:var(--font-display);font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 0 #c94d1e;">' + signBtnText + '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  document.getElementById('confirmSignBtn').onclick = function() {
    overlay.remove();
    if (typeof onConfirmSign === 'function') onConfirmSign();
  };
}

// ==================== 5.5 自选球队弹窗 ====================
function showCareerTeamPicker(teamList) {
  var isFull = Array.isArray(teamList);
  
  // 计算可选球队数量：3(x+1)，x = 建球员阶段全局剩余的换人次数
  var x = STATE._rerollsLeft || 0;
  var pickCount = Math.min(30, 3 * (x + 1));
  
  if (!isFull && pickCount === 0) {
    return;
  }
  
  // 如果已有弹窗则移除
  var old = document.getElementById('team-picker-overlay');
  if (old) old.remove();
  
  var allTeams;
  var subLine;
  if (isFull) {
    // 看视频奖励：全 30 队任选
    allTeams = teamList.slice();
    subLine = '🎉 看视频获得 · 全 ' + allTeams.length + ' 队任选';
  } else {
    // 从已访问球队中随机选 pickCount 支
    allTeams = STATE._teamsVisited.length > 0 ? STATE._teamsVisited.slice() : [...NBA2K_TEAMS];
    for (var i = allTeams.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = allTeams[i]; allTeams[i] = allTeams[j]; allTeams[j] = tmp;
    }
    allTeams = allTeams.slice(0, pickCount);
    subLine = '剩余换人' + x + '次 · 可选' + pickCount + '队';
  }
  var picked = allTeams;
  
  var gridHtml = '';
  picked.forEach(function(t) {
    var cn = SIM_CONFIG.TEAM_NAMES[t] || t;
    var city = window.TEAM_CITY[t] || '';
    var logo = getTeamLogo(t, 36);
    gridHtml += '<div class="team-pick-card" data-team="' + t + '" onclick="previewTeamRosterModal(\'' + t + '\', function(){ selectCareerTeamFromPicker(\'' + t + '\'); })">' +
      logo +
      '<span class="tpc-abbr">' + cn + '</span>' +
      '<span class="tpc-name">' + city + '</span>' +
      '<span style="font-size:10px;color:var(--orange);margin-top:2px;">📋 查看阵容 / 签约</span>' +
    '</div>';
  });
  
  var overlay = document.createElement('div');
  overlay.className = 'team-picker-overlay';
  overlay.id = 'team-picker-overlay';
  overlay.innerHTML = 
    '<div class="team-picker-modal">' +
      '<div class="team-picker-header">' +
        '<span>' + (isFull ? '🎉 自选喜欢的球队' : '🎯 选择生涯球队') + '</span>' +
        '<button id="adTeamPickBtn" onclick="watchAdToPickTeam()" style="min-height:30px;padding:5px 10px;border:none;border-radius:8px;background:linear-gradient(135deg,#ff6b35,#ff8a5c);color:#fff;font-family:var(--font-display);font-size:11px;font-weight:600;cursor:pointer;box-shadow:0 2px 0 #c94d1e;">📺 看视频自选球队</button>' +
        '<button class="team-picker-close" onclick="closeCareerTeamPicker()">✕</button>' +
      '</div>' +
      '<div class="team-picker-header" style="border-bottom:none;padding:4px 14px 8px;justify-content:center;">' +
        '<span style="' + (isFull ? '' : 'display:none;') + 'font-size:11px;color:var(--text-dim);font-weight:400;">' + subLine + '</span>' +
      '</div>' +
      '<div class="team-picker-grid">' + gridHtml + '</div>' +
    '</div>';
  
  // 点击遮罩关闭
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeCareerTeamPicker();
  });
  
  document.body.appendChild(overlay);
  if (typeof renderAdTeamStatus === 'function') renderAdTeamStatus();
}

function closeCareerTeamPicker() {
  
  var el = document.getElementById('team-picker-overlay');
  if (el) el.remove();
}

function selectCareerTeamFromPicker(team) {
  trackEvent({act:"click",blk:"BMC098",pos:"TC6",label:"自选球队-生涯"});
  closeCareerTeamPicker();
  STATE._draftSelfPick = true;
  selectCareerTeam(team);
}

/** 保存本次建球员数据到 Storage（球队、位置、13项属性、总评） */
function saveBuildPlayerData(team) {
  var playerData = {
    team: team,
    position: STATE.position,
    finalOVR: STATE.finalOVR,
    attrs: {},
  };
  SIM_CONFIG.ATTR_LIST.forEach(function(k) { playerData.attrs[k] = STATE.attrs[k] || null; });
  Storage.savePlayer(playerData);
}

// ==================== 工具函数 ====================
function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 老虎机高亮中间可见项（替换静态 nth-child，随滚动位置正确对齐） */
function highlightSlotItem(reelId, middleIndex) {
  var reel = document.getElementById(reelId);
  if (!reel) return;
  reel.querySelectorAll('.br-slot-item.highlight').forEach(function(el) { el.classList.remove('highlight'); });
  var items = reel.querySelectorAll('.br-slot-item');
  if (items[middleIndex]) items[middleIndex].classList.add('highlight');
}

function getConference(team) {
  if (SIM_CONFIG.CONFERENCE.EAST.includes(team)) return 'EAST';
  if (SIM_CONFIG.CONFERENCE.WEST.includes(team)) return 'WEST';
  return 'EAST';
}

function getDivision(team) {
  for (const [div, teams] of Object.entries(SIM_CONFIG.DIVISIONS)) {
    if (teams.includes(team)) return div;
  }
  return null;
}

function getTeamName(team) { return SIM_CONFIG.TEAM_NAMES[team] || team; }

/** 查找球员所属球队缩写 */
function getPlayerTeam(player) {
  for (const team of NBA2K_TEAMS) {
    if (NBA2K_DATA[team] && NBA2K_DATA[team].includes(player)) return team;
  }
  return null;
}

/** 获取球员显示名：优先中文名（取-后部分），无中文名则取逗号后的名 */
function getPlayerDisplayName(playerName) {
  // 先找中文名
  for (const team of NBA2K_TEAMS) {
    const players = NBA2K_DATA[team];
    if (!players) continue;
    const p = players.find(p => p.name === playerName);
    if (p) {
      const cn = p.cname || '';
      const dashIdx = cn.indexOf('-');
      return dashIdx >= 0 ? cn.slice(dashIdx + 1) : (cn || playerName);
    }
  }
  // 无中文名 → 取逗号后（如 "Brunson, Jalen" → "Jalen"）
  const commaIdx = playerName.indexOf(', ');
  return commaIdx >= 0 ? playerName.slice(commaIdx + 2) : playerName;
}

if (!window.TEAM_LOGOS) window.TEAM_LOGOS = {
  'ATL':'assets/activity-static.hoopchina.com.cn/files/26612-t5b21erc-upload-1781237739326-44.png',
  'BKN':'assets/activity-static.hoopchina.com.cn/files/26612-xptpjtrc-upload-1781237796378-12.png',
  'BOS':'assets/activity-static.hoopchina.com.cn/files/26612-ccjancrc-upload-1781237796378-15.png',
  'CHA':'assets/activity-static.hoopchina.com.cn/files/26612-4los1nrc-upload-1781237796378-18.png',
  'CHI':'assets/activity-static.hoopchina.com.cn/files/26612-248zl7rc-upload-1781237796378-21.png',
  'CLE':'assets/activity-static.hoopchina.com.cn/files/26612-9373nkrc-upload-1781237796378-24.png',
  'DAL':'assets/activity-static.hoopchina.com.cn/files/26612-ye2ck7rc-upload-1781237796378-27.png',
  'DEN':'assets/activity-static.hoopchina.com.cn/files/26612-v4su4prc-upload-1781237796378-30.png',
  'DET':'assets/activity-static.hoopchina.com.cn/files/26612-ce809crc-upload-1781237796378-33.png',
  'GSW':'assets/activity-static.hoopchina.com.cn/files/26612-jytyisrc-upload-1781237796378-36.png',
  'HOU':'assets/activity-static.hoopchina.com.cn/files/26612-8x92ebrc-upload-1781237796378-39.png',
  'IND':'assets/activity-static.hoopchina.com.cn/files/26612-q4jolqrc-upload-1781237796378-42.png',
  'LAC':'assets/activity-static.hoopchina.com.cn/files/26612-y0fgwlrc-upload-1781237796378-45.png',
  'LAL':'assets/activity-static.hoopchina.com.cn/files/26614-lqhvdqrc-upload-1781423262777-12.png',
  'MEM':'assets/activity-static.hoopchina.com.cn/files/26612-hkjdthrc-upload-1781237796378-51.png',
  'MIA':'assets/activity-static.hoopchina.com.cn/files/26612-wrdmc9rc-upload-1781237796378-54.png',
  'MIL':'assets/activity-static.hoopchina.com.cn/files/26612-47m8grrc-upload-1781237796378-57.png',
  'MIN':'assets/activity-static.hoopchina.com.cn/files/26612-6y471frc-upload-1781237796378-60.png',
  'NOP':'assets/activity-static.hoopchina.com.cn/files/26612-q64i2mrc-upload-1781237796378-63.png',
  'NYK':'assets/activity-static.hoopchina.com.cn/files/26612-ltjvjerc-upload-1781237796378-66.png',
  'OKC':'assets/activity-static.hoopchina.com.cn/files/26612-103adgrc-upload-1781237796378-69.png',
  'ORL':'assets/activity-static.hoopchina.com.cn/files/26612-0i4175rc-upload-1781237796378-72.png',
  'PHI':'assets/activity-static.hoopchina.com.cn/files/26612-s2kbz8rc-upload-1781237796378-75.png',
  'PHX':'assets/activity-static.hoopchina.com.cn/files/26612-iffq4vrc-upload-1781237796378-78.png',
  'POR':'assets/activity-static.hoopchina.com.cn/files/26612-v2vg2xrc-upload-1781237796378-81.png',
  'SAC':'assets/activity-static.hoopchina.com.cn/files/26612-9g4x3qrc-upload-1781237796378-84.png',
  'SAS':'assets/activity-static.hoopchina.com.cn/files/26612-op4gosrc-upload-1781237796378-87.png',
  'TOR':'assets/activity-static.hoopchina.com.cn/files/26612-yowkavrc-upload-1781237796378-90.png',
  'UTA':'assets/activity-static.hoopchina.com.cn/files/26612-rb5rxsrc-upload-1781237796378-93.png',
  'WAS':'assets/activity-static.hoopchina.com.cn/files/26612-7t2yj4rc-upload-1781237796378-96.png',
};
if (!window.TEAM_CITY) window.TEAM_CITY = {
  'ATL':'亚特兰大','BKN':'布鲁克林','BOS':'波士顿','CHA':'夏洛特','CHI':'芝加哥',
  'CLE':'克里夫兰','DAL':'达拉斯','DEN':'丹佛','DET':'底特律','GSW':'金州',
  'HOU':'休斯顿','IND':'印第安纳','LAC':'洛杉矶','LAL':'洛杉矶','MEM':'孟菲斯',
  'MIA':'迈阿密','MIL':'密尔沃基','MIN':'明尼苏达','NOP':'新奥尔良','NYK':'纽约',
  'OKC':'俄克拉荷马城','ORL':'奥兰多','PHI':'费城','PHX':'菲尼克斯','POR':'波特兰',
  'SAC':'萨克拉门托','SAS':'圣安东尼奥','TOR':'多伦多','UTA':'犹他','WAS':'华盛顿',
};
window._HIDE_TEAM_LOGOS = true;
function getTeamLogo(team, size) {
  if (window._HIDE_TEAM_LOGOS) return '';
  if (!window.TEAM_LOGOS || !window.TEAM_LOGOS[team]) return '';
  const s = size || 20;
  return `<img class="team-logo" src="${window.TEAM_LOGOS[team]}" style="width:${s}px;height:${s}px;vertical-align:middle;border-radius:4px;" alt="${team}">`;
}

function toggleTeamLogos() {
  window._HIDE_TEAM_LOGOS = !window._HIDE_TEAM_LOGOS;
  var cur = document.querySelector('.screen.active');
  if (!cur) return;
  var id = cur.id;
  if (id === 'screen-season') { if (typeof quickSimAllGames === 'function') quickSimAllGames(); }
  else if (id === 'screen-playoffs' && typeof renderPlayoffs === 'function') renderPlayoffs();
  else if (id === 'screen-results' && typeof showSeasonResults === 'function') showSeasonResults();
  else if (id === 'screen-awards' && typeof showAwardsScreen === 'function') showAwardsScreen();
  else if (id === 'screen-achievements' && window.CONQUEST_API && typeof CONQUEST_API.show === 'function') CONQUEST_API.show();
}

/** 获取球队在联盟中的种子排名（1-15） */
function getConferenceSeed(team) {
  const conf = getConference(team);
  const teams = conf === 'EAST' ? SIM_CONFIG.CONFERENCE.EAST : SIM_CONFIG.CONFERENCE.WEST;
  const standings = STATE.season.standings;
  if (!standings) return 99;
  const sorted = teams
    .map(t => ({ team: t, ...standings[t] }))
    .sort((a, b) => {
      const apct = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
      const bpct = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
      return bpct - apct || b.wins - a.wins;
    });
  const idx = sorted.findIndex(s => s.team === team);
  return idx >= 0 ? idx + 1 : 99;
}

/** 获取同分区所有球队按种子排序的列表 */
function getConferenceSorted(conf) {
  const teams = conf === 'EAST' ? SIM_CONFIG.CONFERENCE.EAST : SIM_CONFIG.CONFERENCE.WEST;
  const standings = STATE.season.standings;
  if (!standings) return [];
  return teams
    .map(t => ({ team: t, wins: standings[t]?.wins || 0, losses: standings[t]?.losses || 0 }))
    .sort((a, b) => {
      const apct = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
      const bpct = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
      return bpct - apct || b.wins - a.wins;
    });
}

// ==================== 6. 赛季模拟（新引擎）====================
function startSeason() {
  showScreen('screen-season');
  clearLineupCache();
  var currentStarterStatus = STATE.careerTeam && STATE.finalOVR ? !!calcTeamLineup(STATE.careerTeam).isUserStarter : true;
  if (STATE.career && STATE.career.flags && STATE.career.flags.startBench) currentStarterStatus = false;
  STATE.season = {
    wins: 0, losses: 0,
    games: [],
    playerStats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, threeM: 0, threeA: 0, games: 0, mins: 0 },
    leaguePlayerSeasonStats: {},
    leaguePlayerGameStats: [],
    _recordedLeagueGameIds: {},
    playoffStats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, threeM: 0, threeA: 0, games: 0, mins: 0 },
    isUserStarter: currentStarterStatus,
    awards: [],
    playoffResult: null,
    playoffEliminated: false,
    standings: {},     // { team: { wins, losses, streak } }
    statLeaders: {},   // { pts: { name, val }, reb: {...}, ast: {...} }
    schedule: [],
    day: 0,
    isPlayoffs: false,
    playoffBracket: null,
    otherBracket: null,
    _viewConf: null,
    _gamesPlayed: {},
    _leagueGameLog: [],
    rankings: null,
    events: { suspensionGamesLeft: 0, suspensionReason: '', injuryGamesLeft: 0, injuryReason: '', triggeredIds: [], storyTimeline: [], lastTriggerGameNum: null, playoffEventCount: 0, injuryRiskBonus: getNextSeasonMods().injuryRiskBonus || 0, majorInjuryThisSeason: false, playThroughPrompted: {}, regularPlayThroughPromptCount: 0 },
  };
  
  initStandings();
  buildRealSchedule();
  // ★ 直接渲染赛季页，加载动画放在 dot-grid 内部
  html('season-controls').innerHTML = '';
  html('gamecast-area').innerHTML = '';
  html('game-list').innerHTML = '';

  var confName = getConference(STATE.careerTeam) === 'EAST' ? '东部' : '西部';
  html('season-header').innerHTML =
    '<div class="sh-top" style="margin-top:8px;">' +
      '<div class="sh-team"><div class="sh-team-name">' + getTeamLogo(STATE.careerTeam, 24) + ' ' + getTeamName(STATE.careerTeam) + '</div><div class="sh-team-full">' + ((window.TEAM_CITY && window.TEAM_CITY[STATE.careerTeam]) || '') + '</div></div>' +
      '<div class="sh-season">' + getCurrentSeasonLabel() + '</div>' +
      '<div class="sh-record" id="simRecord"><span class="sh-wins">0</span><span class="sh-dash">-</span><span class="sh-losses">0</span><div class="sh-pct">—</div></div>' +
    '</div>' +
    '<div class="sh-info" id="simInfo">' +
      '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
      '<span>场均 0分 0板 0助</span>' +
      '<span id="simStreak"></span>' +
    '</div>' +
    renderEventStatus() +
    '<div class="dot-grid" id="simDotGrid">' +
      '<div style="display:flex;align-items:center;justify-content:center;width:100%;min-height:120px;">' +
        '<div class="loading-balls"><span class="loading-ball"></span><span class="loading-ball"></span><span class="loading-ball"></span></div>' +
      '</div>' +
    '</div>' +
    '<div style="text-align:center;padding:4px 0 8px;font-size:12px;color:var(--text-dim);" id="simStatus"></div>';

  setTimeout(quickSimAllGames, 1200);
}

// ★ 逐场模拟全部 82 场常规赛，点逐个出现
function quickSimAllGames() {
  var schedule = STATE.season.schedule;
  if (!schedule || schedule.length === 0) { console.error('[Sim] 赛程为空'); renderDotGrid(); return; }
  var games = schedule.filter(function(g) { return !g.simulated; });
  if (games.length === 0) { renderDotGrid(); return; }

  // 替换加载动画为占位点阵
  var confName = getConference(STATE.careerTeam) === 'EAST' ? '东部' : '西部';
  var placeholderDots = '';
  for (var di = 0; di < games.length; di++) {
    placeholderDots += '<span class="dot dot-pending" id="gdot-' + di + '"></span>';
    if ((di + 1) % 14 === 0) placeholderDots += '<br>';
  }
  html('simDotGrid').innerHTML = placeholderDots;
  html('simStatus').innerHTML = '模拟中 0/' + games.length;

  var gi = 0;
  function simNextWithDelay() {
    if (gi >= games.length) {
      processAllRemainingDays();
      reconcileStandings();
      calcSeasonAwards();

      var w2 = STATE.season.wins || 0, l2 = STATE.season.losses || 0;
      var seed2 = getConferenceSeed(STATE.careerTeam);
      var pct2 = w2 + l2 > 0 ? (w2 / (w2 + l2) * 100).toFixed(1) + '%' : '—';
      var actionBtn = '';
      actionBtn = '<button class="btn btn-secondary btn-sm" onclick="showAwardsScreen()" style="margin-bottom:6px;">📊 常规赛奖项</button>';
      document.getElementById('simStatus').innerHTML = '';
      document.getElementById('simRecord').innerHTML = '<span class="sh-wins">' + w2 + '</span><span class="sh-dash">-</span><span class="sh-losses">' + l2 + '</span><div class="sh-pct">' + pct2 + '</div>';

      // 最后更新 sh-info
      var psFinal = STATE.season.playerStats;
      var gpFinal = psFinal.games || 1;
      var fPts = Math.round(psFinal.pts / gpFinal * 10) / 10;
      var fReb = Math.round(psFinal.reb / gpFinal * 10) / 10;
      var fAst = Math.round(psFinal.ast / gpFinal * 10) / 10;
      var finfo = document.getElementById('simInfo');
      if (finfo) {
        finfo.innerHTML = '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
          '<span>场均 ' + fPts + '分 ' + fReb + '板 ' + fAst + '助</span>' +
          '<span>' + (STATE.season.standings[STATE.careerTeam]?.streakLen > 0 ? (STATE.season.standings[STATE.careerTeam]?.streak === 'W' ? 'W' : 'L') + (STATE.season.standings[STATE.careerTeam]?.streakLen || '') : '') + '</span>';
      }

      // 分区排行榜
      var conf = getConference(STATE.careerTeam);
      var confName2 = conf === 'EAST' ? '东部' : '西部';
      var allTeams = (conf === 'EAST' ? SIM_CONFIG.CONFERENCE.EAST : SIM_CONFIG.CONFERENCE.WEST);
      var sorted = allTeams.map(function(t) { return { team: t, ...STATE.season.standings[t] }; }).sort(function(a, b) { return (b.wins - b.losses) - (a.wins - a.losses) || b.wins - a.wins; });
      var leaderW = sorted.length > 0 ? sorted[0].wins : 0, leaderL = sorted.length > 0 ? sorted[0].losses : 0;
      var tableHtml = '<div style="margin:8px 12px 12px;"><div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--text);padding:4px 0 6px;">🏆 ' + confName2 + ' 排行榜</div><div class="st-hdr"><span>#</span><span>球队</span><span>胜</span><span>负</span><span>胜差</span><span>近况</span></div>';
      var zoneLabels = ['🏀 季后赛区', '🔥 附加赛区', '📋 乐透区'];
      var zi = 0;
      for (var si = 0; si < sorted.length; si++) {
        if (si === 0) {
          tableHtml += '<div style="height:1px;background:var(--border);margin:4px 0 6px;"></div><div style="font-size:11px;color:var(--text-muted);padding:2px 6px 4px;letter-spacing:1px;font-weight:600;">' + zoneLabels[zi] + '</div>';
          zi++;
        }
        if (si === 6 || si === 10) {
          tableHtml += '<div style="height:1px;background:var(--border);margin:6px 0;"></div><div style="font-size:11px;color:var(--text-muted);padding:2px 6px 4px;letter-spacing:1px;font-weight:600;">' + zoneLabels[zi] + '</div>';
          zi++;
        }
        var s = sorted[si];
        var gb = si === 0 ? '-' : ((leaderW - s.wins + s.losses - leaderL) / 2).toFixed(1);
        var isMy = s.team === STATE.careerTeam;
        tableHtml += '<div class="st-row ' + (isMy ? 'st-my' : '') + '"><span>' + (si + 1) + '</span><span>' + getTeamLogo(s.team, 16) + ' ' + getTeamName(s.team) + (isMy ? ' ⭐' : '') + '</span><span class="st-w">' + (s.wins || 0) + '</span><span class="st-l">' + (s.losses || 0) + '</span><span>' + gb + '</span><span class="st-streak">' + (s.streakLen > 0 ? s.streak + s.streakLen : '-') + '</span></div>';
      }
      tableHtml += '</div>';

      // 球员赛季数据卡
      var ps = STATE.season.playerStats;
      var gp = ps.games || 1;
      var aPts = Math.round(ps.pts / gp * 10) / 10;
      var aReb = Math.round(ps.reb / gp * 10) / 10;
      var aAst = Math.round(ps.ast / gp * 10) / 10;
      var aStl = Math.round(ps.stl / gp * 10) / 10;
      var aBlk = Math.round(ps.blk / gp * 10) / 10;
      var aTov = Math.round(ps.tov / gp * 10) / 10;
      var playerCardHtml =
        '<div class="bv-po-stats">' +
          '<div class="bv-po-title">📊 常规赛场均</div>' +
          '<div class="bv-po-grid">' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aPts + '</span><span class="bv-po-lbl">得分</span></div>' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aReb + '</span><span class="bv-po-lbl">篮板</span></div>' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aAst + '</span><span class="bv-po-lbl">助攻</span></div>' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aStl + '</span><span class="bv-po-lbl">抢断</span></div>' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aBlk + '</span><span class="bv-po-lbl">盖帽</span></div>' +
            '<div class="bv-po-stat"><span class="bv-po-val">' + aTov + '</span><span class="bv-po-lbl">失误</span></div>' +
          '</div>' +
          '<div style="text-align:center;font-size:11px;color:var(--text-dim);margin-top:4px;">' +
            '出战 ' + gp + ' 场 · OVR ' + STATE.finalOVR + ' · ' + SIM_CONFIG.POSITIONS[STATE.position] +
          '</div>' +
        '</div>';

      var footer = document.getElementById('simDotGrid');
      // 最佳比赛：pts + reb + ast 最高的一场
      var bestGame = null, bestTotal = 0;
      var allGames = STATE.season.games || [];
      for (var bgi = 0; bgi < allGames.length; bgi++) {
        var bg = allGames[bgi];
        if (!bg.stats) continue;
        var total = (bg.stats.pts || 0) + (bg.stats.reb || 0) + (bg.stats.ast || 0);
        if (total > bestTotal) { bestTotal = total; bestGame = bg; }
      }
      var bestHtml = '';
      if (bestGame) {
        var bs = bestGame.stats;
        var bgName = getTeamName(bestGame.game.opponent);
        var bWon = bestGame.result.won ? '胜' : '负';
        var bScore = bestGame.result.scoreA + '-' + bestGame.result.scoreB;
        bestHtml = '<div style="margin:8px 0;background:var(--bg-card);border:2px solid var(--border);border-radius:var(--radius);padding:8px 16px;">' +
          '<div style="font-family:var(--font-display);font-size:12px;font-weight:700;color:var(--orange);margin-bottom:4px;">🔥 赛季最佳表现：对阵 ' + bgName + '</div>' +
          '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
            '<div style="text-align:center;padding:2px 8px;background:var(--orange-bg);border-radius:6px;min-width:40px;"><div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);">' + (bs.pts || 0) + '</div><div style="font-size:8px;color:var(--text-dim);">得分</div></div>' +
            '<div style="text-align:center;padding:2px 8px;background:var(--orange-bg);border-radius:6px;min-width:40px;"><div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);">' + (bs.reb || 0) + '</div><div style="font-size:8px;color:var(--text-dim);">篮板</div></div>' +
            '<div style="text-align:center;padding:2px 8px;background:var(--orange-bg);border-radius:6px;min-width:40px;"><div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);">' + (bs.ast || 0) + '</div><div style="font-size:8px;color:var(--text-dim);">助攻</div></div>' +
            '<div style="text-align:center;padding:2px 8px;background:var(--orange-bg);border-radius:6px;min-width:40px;"><div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);">' + Math.round(bs.stl || 0) + '</div><div style="font-size:8px;color:var(--text-dim);">抢断</div></div>' +
            '<div style="text-align:center;padding:2px 8px;background:var(--orange-bg);border-radius:6px;min-width:40px;"><div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);">' + Math.round(bs.blk || 0) + '</div><div style="font-size:8px;color:var(--text-dim);">盖帽</div></div>' +
          '</div>' +
        '</div>';
      }
      if (footer) footer.insertAdjacentHTML('afterend',
        '<div class="section-card">' + playerCardHtml + '</div>' +
        '<div class="section-card" style="animation-delay:0.8s">' + bestHtml + '</div>' +
        '<div class="section-card" style="animation-delay:1.6s">' + tableHtml + '</div>' +
        '<div style="text-align:center;padding:0 12px 16px;" id="simActions">' + actionBtn + '</div>');
      trackExposureOnce(document.getElementById('simActions'), {act:"exposure",blk:"BMC099",pos:"T1",label:"赛季结果"});
      setTimeout(function() { maybeShowFirstSixtyWinCelebration(); }, 260);
      return;
    }

    try {
      var g = games[gi];

      // ★ 跳过检查（禁赛优先于伤病）
      var ev = STATE.season.events;
      var skipReason = null; // null=不跳过, 'suspension'=禁赛, 'injury'=伤病
      if (ev && ev.suspensionGamesLeft > 0) skipReason = 'suspension';
      else if (ev && ev.injuryGamesLeft > 0) skipReason = 'injury';
      if (skipReason) {
        var runSkippedRegularGame = function() {
          if (skipReason === 'suspension') ev.suspensionGamesLeft--;
          else ev.injuryGamesLeft--;
           var skipResult = simulateGameNew(STATE.careerTeam, g.opponent);
           recordLeagueBoxScore(skipResult.boxScore, 'career:' + (g.gameNum || g.day || gi) + ':' + g.opponent);
          g.simulated = true;
          g.result = skipResult;
          if (skipResult.won) STATE.season.wins++; else STATE.season.losses++;
          var ourS2 = STATE.season.standings[STATE.careerTeam];
          if (ourS2) { if (skipResult.won) ourS2.wins++; else ourS2.losses++; }
          var oppS2 = STATE.season.standings[g.opponent];
          if (oppS2) { if (skipResult.won) oppS2.losses++; else oppS2.wins++; updateStreak(g.opponent, !skipResult.won); }
          updateStreak(STATE.careerTeam, skipResult.won);
          STATE.season.games.push({ result: skipResult, stats: null, game: g, suspended: true });
          simDayLeagueGames(g.day);
          var dotEl2 = document.getElementById('gdot-' + gi);
          if (dotEl2) {
            dotEl2.className = 'dot dot-x';
            dotEl2.textContent = '✕';
            dotEl2.style.animation = 'popIn .3s ease';
            var label = skipReason === 'suspension' ? '禁赛' : '伤病';
            dotEl2.title = 'G' + (gi + 1) + ': ' + label + ' - ' + (skipReason === 'suspension' ? (ev.suspensionReason || '联盟处罚') : (ev.injuryReason || '伤病休战'));
          }
          var skipIcon = skipReason === 'suspension' ? ' 🔇' : ' 🏥';
          document.getElementById('simRecord').innerHTML = '<span class="sh-wins">' + STATE.season.wins + '</span><span class="sh-dash">-</span><span class="sh-losses">' + STATE.season.losses + '</span><div class="sh-pct">' + (STATE.season.wins + STATE.season.losses > 0 ? (STATE.season.wins / (STATE.season.wins + STATE.season.losses) * 100).toFixed(1) + '%' : '—') + '</div>';
          document.getElementById('simStatus').textContent = '模拟中 ' + (gi + 1) + '/' + games.length + skipIcon;
          var info3 = document.getElementById('simInfo');
          if (info3) {
            var ps3 = STATE.season.playerStats;
            var gp3 = ps3.games || 1;
            info3.innerHTML = '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
              '<span>场均 ' + Math.round(ps3.pts / gp3 * 10) / 10 + '分 ' + Math.round(ps3.reb / gp3 * 10) / 10 + '板 ' + Math.round(ps3.ast / gp3 * 10) / 10 + '助</span>' +
              '<span>' + (STATE.season.standings[STATE.careerTeam]?.streakLen > 0 ? (STATE.season.standings[STATE.careerTeam]?.streak === 'W' ? 'W' : 'L') + (STATE.season.standings[STATE.careerTeam]?.streakLen || '') : '') + '</span>';
          }
          var esEl = document.getElementById('eventStatusBar');
          if (esEl) esEl.outerHTML = renderEventStatus();
          gi++;
          setTimeout(simNextWithDelay, 120);
        };
        var runPlayedThroughRegularGame = function(severity) {
          ev.injuryGamesLeft = Math.max(0, (ev.injuryGamesLeft || 0) - 1);
           var hurtResult = simulateGameNew(STATE.careerTeam, g.opponent, 0, getInjuryPlayWinMultiplier(severity));
           recordLeagueBoxScore(hurtResult.boxScore, 'career:' + (g.gameNum || g.day || gi) + ':' + g.opponent);
          g.simulated = true;
          g.result = hurtResult;
          if (hurtResult.won) STATE.season.wins++; else STATE.season.losses++;
          var ourH = STATE.season.standings[STATE.careerTeam];
          if (ourH) { if (hurtResult.won) ourH.wins++; else ourH.losses++; }
          var oppH = STATE.season.standings[g.opponent];
          if (oppH) { if (hurtResult.won) oppH.losses++; else oppH.wins++; updateStreak(g.opponent, !hurtResult.won); }
          updateStreak(STATE.careerTeam, hurtResult.won);
          var hurtStats = scaleHurtStats(generatePlayerStatsNew(buildHurtAttrs(STATE.attrs, severity), hurtResult, false), severity);
          syncUserStatsToBoxScore(hurtResult, hurtStats);
          var psH = STATE.season.playerStats;
          psH.pts += hurtStats.pts; psH.reb += hurtStats.reb; psH.ast += hurtStats.ast;
          psH.stl += hurtStats.stl; psH.blk += hurtStats.blk; psH.tov += hurtStats.tov;
          psH.fgm += hurtStats.fgm; psH.fga += hurtStats.fga;
          psH.ftm += hurtStats.ftm; psH.fta += hurtStats.fta;
          psH.threeM += hurtStats.threeM; psH.threeA += hurtStats.threeA;
          psH.mins = (psH.mins || 0) + hurtStats.mins;
          psH.games++;
          STATE.season.games.push({ result: hurtResult, stats: hurtStats, game: g, playedThroughInjury: true });
          var worsenText = maybeWorsenInjuryAfterPlaying(ev, severity);
          simDayLeagueGames(g.day);
          var dotH = document.getElementById('gdot-' + gi);
          if (dotH) {
            dotH.className = 'dot ' + (hurtResult.won ? 'dot-w' : 'dot-l');
            dotH.style.animation = 'popIn .3s ease';
            dotH.title = 'G' + (gi + 1) + ': 带伤出战 ' + (hurtResult.won ? '胜' : '负') + ' ' + getTeamName(g.opponent) + (worsenText ? ' · 伤情加重' : '');
          }
          document.getElementById('simRecord').innerHTML = '<span class="sh-wins">' + STATE.season.wins + '</span><span class="sh-dash">-</span><span class="sh-losses">' + STATE.season.losses + '</span><div class="sh-pct">' + (STATE.season.wins + STATE.season.losses > 0 ? (STATE.season.wins / (STATE.season.wins + STATE.season.losses) * 100).toFixed(1) + '%' : '—') + '</div>';
          document.getElementById('simStatus').textContent = '模拟中 ' + (gi + 1) + '/' + games.length + ' 🏥 带伤';
          var infoH = document.getElementById('simInfo');
          if (infoH) {
            var gpH = psH.games || 1;
            infoH.innerHTML = '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
              '<span>场均 ' + Math.round(psH.pts / gpH * 10) / 10 + '分 ' + Math.round(psH.reb / gpH * 10) / 10 + '板 ' + Math.round(psH.ast / gpH * 10) / 10 + '助</span>' +
              '<span>' + (STATE.season.standings[STATE.careerTeam]?.streakLen > 0 ? (STATE.season.standings[STATE.careerTeam]?.streak === 'W' ? 'W' : 'L') + (STATE.season.standings[STATE.careerTeam]?.streakLen || '') : '') + '</span>';
          }
          var esH = document.getElementById('eventStatusBar');
          if (esH) esH.outerHTML = renderEventStatus();
          gi++;
          setTimeout(simNextWithDelay, 120);
        };
        if (skipReason === 'injury' && isKeyInjuredRegularGame(g, gi, games.length) && shouldOfferPlayThroughInjury('reg-' + (STATE.season.games.length + 1), true)) {
          showPlayThroughInjuryModal({
            desc: '赛季已经进入最后阶段，' + getTeamName(STATE.careerTeam) + ' 正卡在排名边缘，下一场对阵 ' + getTeamName(g.opponent) + ' 的结果可能改变季后赛位置。'
          }, runSkippedRegularGame, runPlayedThroughRegularGame);
          return;
        }
        runSkippedRegularGame();
        return;
      }

      var result = simulateGameNew(STATE.careerTeam, g.opponent);
      recordLeagueBoxScore(result.boxScore, 'career:' + (g.gameNum || g.day || gi) + ':' + g.opponent);
      g.simulated = true;
      g.result = result;

      if (result.won) STATE.season.wins++;
      else STATE.season.losses++;

      var ourS = STATE.season.standings[STATE.careerTeam];
      if (ourS) { if (result.won) ourS.wins++; else ourS.losses++; }
      var oppS = STATE.season.standings[g.opponent];
      if (oppS) { if (result.won) oppS.losses++; else oppS.wins++; updateStreak(g.opponent, !result.won); }
      updateStreak(STATE.careerTeam, result.won);

      var stats = generatePlayerStatsNew(STATE.attrs, result, false);
      var ps = STATE.season.playerStats;
      ps.pts += stats.pts; ps.reb += stats.reb; ps.ast += stats.ast;
      ps.stl += stats.stl; ps.blk += stats.blk; ps.tov += stats.tov;
      ps.fgm += stats.fgm; ps.fga += stats.fga;
      ps.ftm += stats.ftm; ps.fta += stats.fta;
      ps.threeM += stats.threeM; ps.threeA += stats.threeA;
      ps.mins = (ps.mins || 0) + stats.mins;
      ps.games++;

      STATE.season.games.push({ result: result, stats: stats, game: g });
      simDayLeagueGames(g.day);

      // ★ 赛后检测随机事件
      var evData = null;
      try { evData = checkRandomEvents(g, result, stats); } catch(ex) {}
      var branchEv = null;
      if (evData) {
        if (evData._consequence === 'suspension') {
          STATE.season.events.suspensionReason = evData.desc;
        } else if (evData._consequence === 'injury') {
          STATE.season.events.injuryReason = evData.desc;
        }
      } else {
        try { branchEv = checkSeasonBranchEvent(g, result, stats); } catch(ex) {}
      }

      // 更新当前 dot
      var dotEl = document.getElementById('gdot-' + gi);
      if (dotEl) {
        dotEl.className = 'dot ' + (result.won ? 'dot-w' : 'dot-l');
        dotEl.style.animation = 'popIn .3s ease';
        dotEl.title = 'G' + (gi + 1) + ': ' + (result.won ? '胜' : '负') + ' ' + getTeamName(g.opponent) + ' ' + (result.scoreA || '') + '-' + (result.scoreB || '');
      }

      // 更新战绩
      document.getElementById('simRecord').innerHTML = '<span class="sh-wins">' + STATE.season.wins + '</span><span class="sh-dash">-</span><span class="sh-losses">' + STATE.season.losses + '</span><div class="sh-pct">' + (STATE.season.wins + STATE.season.losses > 0 ? (STATE.season.wins / (STATE.season.wins + STATE.season.losses) * 100).toFixed(1) + '%' : '—') + '</div>';
      document.getElementById('simStatus').textContent = '模拟中 ' + (gi + 1) + '/' + games.length;

      // 更新场均数据
      var ps2 = STATE.season.playerStats;
      var gp2 = ps2.games || 1;
      var avgPts2 = Math.round(ps2.pts / gp2 * 10) / 10;
      var avgReb2 = Math.round(ps2.reb / gp2 * 10) / 10;
      var avgAst2 = Math.round(ps2.ast / gp2 * 10) / 10;
      var info = document.getElementById('simInfo');
      if (info) {
        info.innerHTML = '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
          '<span>场均 ' + avgPts2 + '分 ' + avgReb2 + '板 ' + avgAst2 + '助</span>' +
          '<span>' + (STATE.season.standings[STATE.careerTeam]?.streakLen > 0 ? (STATE.season.standings[STATE.careerTeam]?.streak === 'W' ? 'W' : 'L') + (STATE.season.standings[STATE.careerTeam]?.streakLen || '') : '') + '</span>';
      }

      // ★ 更新事件状态栏
      var esEl2 = document.getElementById('eventStatusBar');
      if (esEl2) esEl2.outerHTML = renderEventStatus();

      gi++;

      // ★ 如果有事件弹窗，先弹窗再继续
      if (evData && typeof showEventModal === 'function') {
        showEventModal(evData, function() { setTimeout(simNextWithDelay, 120); });
      } else if (branchEv) {
        showSeasonBranchEvent(branchEv, function() { setTimeout(simNextWithDelay, 120); });
      } else {
        setTimeout(simNextWithDelay, 120);
      }
    } catch(e) { console.error('[Sim] 第' + (gi + 1) + '场异常:', e); gi++; setTimeout(simNextWithDelay, 120); }
  }

  simNextWithDelay();
}

/** 从所有比赛结果重新统计 standings */
function reconcileStandings() {
  var st = STATE.season.standings;
  if (!st) return;
  // 重置
  for (var team in st) {
    if (st.hasOwnProperty(team)) { st[team].wins = 0; st[team].losses = 0; }
  }
  // 统计用户已模拟的比赛
  var allGames = STATE.season.games || [];
  for (var i = 0; i < allGames.length; i++) {
    var g = allGames[i];
    if (!g.result) continue;
    var myTeam = STATE.careerTeam;
    var opp = g.game.opponent;
    if (g.result.won) { if (st[myTeam]) st[myTeam].wins++; if (st[opp]) st[opp].losses++; }
    else { if (st[myTeam]) st[myTeam].losses++; if (st[opp]) st[opp].wins++; }
  }
  // 统计联盟其他比赛
  var leagueGames = STATE.season._leagueGameLog || [];
  for (var j = 0; j < leagueGames.length; j++) {
    var lg = leagueGames[j];
    if (st[lg.home]) { if (lg.won) st[lg.home].wins++; else st[lg.home].losses++; }
    if (st[lg.away]) { if (!lg.won) st[lg.away].wins++; else st[lg.away].losses++; }
  }
}

// ★ 常规赛排名系统 ============================================

/** 估算球员场均数据（基于属性 + af 系数） */
function estimatePlayerStats(player) {
  var f = function(v) { return af(parseInt(v) || 50); };
  var pos = (player.pos || 'SF').split('/')[0].trim();
  var pts = (f(player.FIN) * 0.4 + f(player.MID) * 0.3 + f(player.threePT) * 0.3) * 22 + 2;
  var reb = f(player.REB) * (pos === 'C' ? 14 : pos === 'PF' ? 10 : 6) + 1;
  var ast = f(player.PAS) * (pos === 'PG' ? 10 : pos === 'SG' ? 6 : 4) + 1;
  var stl = f(player.PDEF) * 3 + 0.3;
  var blk = f(player.BLK) * (pos === 'C' ? 4 : pos === 'PF' ? 2.5 : 0.5) + 0.2;
  return { pts: Math.round(pts * 10) / 10, reb: Math.round(reb * 10) / 10, ast: Math.round(ast * 10) / 10, stl: Math.round(stl * 10) / 10, blk: Math.round(blk * 10) / 10, pos: pos, ovr: parseInt(player.ovr) || 50 };
}

/** 获取用户场均数据 */
function getUserAvg() {
  var ps = STATE.season.playerStats;
  var gp = ps.games || 1;
  return { pts: Math.round(ps.pts / gp * 10) / 10, reb: Math.round(ps.reb / gp * 10) / 10, ast: Math.round(ps.ast / gp * 10) / 10, stl: Math.round(ps.stl / gp * 10) / 10, blk: Math.round(ps.blk / gp * 10) / 10, pos: STATE.position, ovr: STATE.finalOVR };
}

// ★ 实验性：82 场赛果点阵图
function renderDotGrid() {
  try {
  showScreen('screen-season');
  var rec = STATE.season;
  var w = rec.wins || 0, l = rec.losses || 0;
  var pct = w + l > 0 ? (w / (w + l) * 100).toFixed(1) + '%' : '—';
  var seed = getConferenceSeed(STATE.careerTeam);
  var confName = getConference(STATE.careerTeam) === 'EAST' ? '东部' : '西部';

  var actionBtn = '';
  if (seed <= 6) actionBtn = '<button class="btn btn-gold btn-sm" onclick="renderPlayoffs()" style="margin-top:6px;">🏀 进入季后赛（' + seed + '号种子）</button>';
  else if (seed <= 10) actionBtn = '<button class="btn btn-gold btn-sm" onclick="renderPlayoffs()" style="margin-top:6px;">🔥 附加赛（' + seed + '号种子）</button>';
  else actionBtn = '<button class="btn btn-secondary btn-sm" onclick="showSeasonResults()" style="margin-top:6px;">📊 查看赛季总结</button>';

  var dotsHtml = '';
  if (rec.games && rec.games.length > 0) {
    rec.games.forEach(function(g, i) {
      if (g.suspended) {
        dotsHtml += '<span class="dot dot-x" title="G' + (i + 1) + ': 禁赛">✕</span>';
      } else {
        dotsHtml += '<span class="dot ' + (g.result.won ? 'dot-w' : 'dot-l') + '" title="G' + (i + 1) + ': ' + (g.result.won ? '胜' : '负') + ' ' + getTeamName(g.game.opponent) + ' ' + (g.result.scoreA || '') + '-' + (g.result.scoreB || '') + '"></span>';
      }
      if ((i + 1) % 14 === 0) dotsHtml += '<br>';
    });
  }

  // 清空旧内容
  html('season-controls').innerHTML = '';
  html('gamecast-area').innerHTML = '';
  html('game-list').innerHTML = '';

  html('season-header').innerHTML =
    '<div class="sh-top" style="margin-top:8px;">' +
      '<div class="sh-team"><div class="sh-team-name">' + getTeamLogo(STATE.careerTeam, 24) + ' ' + getTeamName(STATE.careerTeam) + '</div><div class="sh-team-full">' + ((window.TEAM_CITY && window.TEAM_CITY[STATE.careerTeam]) || '') + '</div></div>' +
      '<div class="sh-season">' + getCurrentSeasonLabel() + '</div>' +
      '<div class="sh-record"><span class="sh-wins">' + w + '</span><span class="sh-dash">-</span><span class="sh-losses">' + l + '</span><div class="sh-pct">' + pct + '</div></div>' +
    '</div>' +
    '<div class="sh-info" id="simInfo2">' +
      '<span>' + SIM_CONFIG.POSITIONS[STATE.position] + ' · OVR ' + STATE.finalOVR + '</span>' +
      '<span>' + (function(){ var ps=STATE.season.playerStats,g=ps.games||1; return '场均 ' + Math.round(ps.pts/g*10)/10 + '分 ' + Math.round(ps.reb/g*10)/10 + '板 ' + Math.round(ps.ast/g*10)/10 + '助'; })() + '</span>' +
    '</div>' +
    renderEventStatus() +
    '<div class="dot-grid">' + dotsHtml + '</div>' +
    '<div style="text-align:center;padding:0 12px 16px;">' + actionBtn + '</div>';
  } catch(e) { console.error('[Grid] renderDotGrid 异常:', e); }
}

// ==================== 联盟排名初始化 ====================
function initStandings() {
  NBA2K_TEAMS.forEach(t => {
    STATE.season.standings[t] = { wins: 0, losses: 0, streak: '', streakLen: 0 };
  });
}

// ==================== 赛程生成（真实NBA赛程）====================
function buildRealSchedule() {
  const myTeam = STATE.careerTeam;
  const rawSchedule = NBA2K_SCHEDULE[myTeam];
  if (!rawSchedule) {
    console.error('No schedule for', myTeam);
    return;
  }
  
  const schedule = rawSchedule.map(g => ({
    opponent: g.opponent,
    home: g.home,
    gameNum: g.gameNum,
    day: g.day,
    simulated: false,
    result: null,
  }));
  
  STATE.season.schedule = schedule;
  
  // ★ 构建每日比赛映射（去重）
  const dayMap = {};
  // 遍历所有球队的赛程，每场比赛只记一次（用home team的entry）
  const seen = new Set();
  Object.keys(NBA2K_SCHEDULE).forEach(team => {
    NBA2K_SCHEDULE[team].forEach(g => {
      if (!g.home) return; // 只记主队entry（避免重复）
      const gameKey = `${g.day}-${team}-${g.opponent}`;
      if (seen.has(gameKey)) return;
      seen.add(gameKey);
      if (!dayMap[g.day]) dayMap[g.day] = [];
      dayMap[g.day].push({ home: team, away: g.opponent });
    });
  });
  STATE.season._dayMap = dayMap;
  STATE.season._processedDays = new Set();
  STATE.season._leagueGameLog = [];
  
  // renderGameList();  // 日历模式已注释
}

/** 将一场联盟比赛的 Box Score 写入逐场明细和赛季累计统计。 */
function recordLeagueBoxScore(boxScore, gameId) {
  if (!STATE.season || !boxScore) return;
  var recorded = STATE.season._recordedLeagueGameIds || (STATE.season._recordedLeagueGameIds = {});
  if (gameId && recorded[gameId]) return;

  var seasonStats = STATE.season.leaguePlayerSeasonStats || (STATE.season.leaguePlayerSeasonStats = {});
  var gameStats = STATE.season.leaguePlayerGameStats || (STATE.season.leaguePlayerGameStats = []);
  var rows = [];

  Object.keys(boxScore).forEach(function(team) {
    var roster = NBA2K_DATA[team] || [];
    (boxScore[team] || []).forEach(function(row) {
      if (!row || row._isUser || row.isUser) return;
      var player = roster.find(function(p) {
        return p.name === row.name || p.cname === row.name;
      });
      if (!player) return;

      var playerId = player.name;
      var key = team + ':' + playerId;
      var stat = seasonStats[key] || {
        seasonId: STATE.career && STATE.career.seasonCount || 0,
        playerId: playerId,
        playerName: player.cname || player.name,
        teamId: team,
        gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
        fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0
      };
      var gameRow = {
        seasonId: stat.seasonId,
        gameId: gameId || ('league-' + Date.now() + '-' + gameStats.length),
        playerId: playerId,
        teamId: team,
        min: Number(row.mins) || Number(row.min) || 0,
        pts: Number(row.pts) || 0,
        reb: Number(row.reb) || 0,
        ast: Number(row.ast) || 0,
        stl: Number(row.stl) || 0,
        blk: Number(row.blk) || 0,
        tov: Number(row.tov) || 0,
        fgm: Number(row.fgm) || 0,
        fga: Number(row.fga) || 0,
        tpm: Number(row.tpm != null ? row.tpm : row.threeM) || 0,
        tpa: Number(row.tpa != null ? row.tpa : row.threeA) || 0,
        ftm: Number(row.ftm) || 0,
        fta: Number(row.fta) || 0
      };
      stat.gp += 1;
      Object.keys(gameRow).forEach(function(field) {
        if (field === 'seasonId' || field === 'gameId' || field === 'playerId' || field === 'teamId') return;
        stat[field] = (stat[field] || 0) + gameRow[field];
      });
      seasonStats[key] = stat;
      rows.push(gameRow);
    });
  });

  if (rows.length) gameStats.push.apply(gameStats, rows);
  if (gameId) recorded[gameId] = true;
}

/** 模拟到目前为止所有未处理的比赛日 */
function simDayLeagueGames(day) {
  const dayMap = STATE.season._dayMap;
  if (!dayMap) return;
  const processed = STATE.season._processedDays || new Set();
  
  // 找到所有 <= day 且未处理的比赛日，一次性处理
  const daysToProcess = Object.keys(dayMap)
    .map(Number)
    .filter(d => d <= day && !processed.has(d))
    .sort((a, b) => a - b);
  
  if (daysToProcess.length === 0) return;
  
  const standings = STATE.season.standings;
  
  daysToProcess.forEach(d => {
    processed.add(d);
    const games = dayMap[d];
    if (!games) return;
    
    games.forEach(g => {
      // 跳过包含我方球队的比赛（这些已经通过我们的比赛模拟过了）
      if (g.home === STATE.careerTeam || g.away === STATE.careerTeam) return;
      
      const result = simulateGameNew(g.home, g.away);
      recordLeagueBoxScore(result.boxScore, 'league:' + d + ':' + g.home + ':' + g.away);
      if (result.won) {
        standings[g.home].wins++; standings[g.away].losses++;
        updateStreak(g.home, true); updateStreak(g.away, false);
        if (STATE.season._leagueGameLog) STATE.season._leagueGameLog.push({ home: g.home, away: g.away, won: true, scoreHome: result.scoreA, scoreAway: result.scoreB });
      } else {
        standings[g.away].wins++; standings[g.home].losses++;
        updateStreak(g.away, true); updateStreak(g.home, false);
        if (STATE.season._leagueGameLog) STATE.season._leagueGameLog.push({ home: g.home, away: g.away, won: false, scoreHome: result.scoreA, scoreAway: result.scoreB });
      }
    });
  });
  
  STATE.season._processedDays = processed;
}

// ==================== 新比赛引擎 ====================
/** 解析位置：返回该球员能打的所有位置 */
function getPlayerPositions(posStr) {
  if (!posStr) return [];
  return String(posStr).split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
}

/** 判断球员是否能打某位置 */
function canPlayPosition(playerPos, targetPos) {
  return getPlayerPositions(playerPos).includes(targetPos);
}

/** 获取球员显示位置（给UI用） */
function getPositionDisplay(posStr) {
  if (!posStr) return '—';
  return posStr;
}

/** 按位置计算球队首发+轮换（用户参与规划；未首发则第六人） */
function calcTeamLineup(team) {
  const allPlayers = (NBA2K_DATA[team] || []).slice();
  let userPlayer = null;
  var rosterSig = allPlayers.map(function(p) {
    return [p.name, p.pos, p.ovr, p.contract || ''].join(':');
  }).join('|');
  var lineupCacheKey = [
    team,
    rosterSig,
    STATE.careerTeam || '',
    STATE.position || '',
    STATE.finalOVR || '',
    STATE.season?.isPlayoffs ? 'po' : 'rs'
  ].join('||');
  STATE._lineupCache = STATE._lineupCache || {};
  if (STATE._lineupCache[lineupCacheKey]) return STATE._lineupCache[lineupCacheKey];
  
  // 如果是你的球队，把你加入阵容
  if (team === STATE.careerTeam && STATE.finalOVR) {
    const playoffDebuff = 0;
    var _displayName = getHupuDisplayName();
    userPlayer = {
      name: _displayName,
      cname: _displayName,
      ovr: Math.max(60, parseInt(STATE.finalOVR) - playoffDebuff),
      pos: STATE.position,
      ...STATE.attrs,
      _isUser: true,
      _playoffDebuff: playoffDebuff,
    };
    allPlayers.push(userPlayer);
  }
  
  const POS_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];
  const starters = {};
  const assigned = new Set();

  function fillBestSmall(posList, posIdx, curStarters, curAssigned, curScore, best) {
    if (posIdx >= posList.length) {
      if (curScore > best.score) {
        best.score = curScore;
        best.starters = Object.assign({}, curStarters);
        best.assigned = new Set(Array.from(curAssigned));
      }
      return best;
    }
    const pos = posList[posIdx];
    const candidates = allPlayers
      .map((p, i) => ({ player: p, idx: i, ovr: parseInt(p.ovr) || 0 }))
      .filter(({ idx }) => !curAssigned.has(idx))
      .filter(({ player }) => canPlayPosition(player.pos || '', pos))
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 4);

    if (candidates.length === 0) {
      return fillBestSmall(posList, posIdx + 1, curStarters, curAssigned, curScore, best);
    }

    candidates.forEach(({ player, idx, ovr }) => {
      const nextStarters = Object.assign({}, curStarters);
      const nextAssigned = new Set(Array.from(curAssigned));
      nextStarters[pos] = player;
      nextAssigned.add(idx);
      fillBestSmall(posList, posIdx + 1, nextStarters, nextAssigned, curScore + ovr, best);
    });
    return best;
  }

  const best = fillBestSmall(POS_ORDER, 0, starters, assigned, 0, {
    score: -1,
    starters: Object.assign({}, starters),
    assigned: new Set(Array.from(assigned))
  });
  POS_ORDER.forEach(pos => {
    if (best.starters[pos]) {
      const idx = allPlayers.indexOf(best.starters[pos]);
      starters[pos] = best.starters[pos];
      if (idx >= 0) assigned.add(idx);
    }
  });
  
  // 替补：剩余球员按OVR排序
  let bench = allPlayers
    .map((p, i) => ({ player: p, idx: i }))
    .filter(({ idx }) => !assigned.has(idx))
    .sort((a, b) => b.player.ovr - a.player.ovr)
    .map(e => e.player);
  
  // 如果用户没进首发，固定放第六人
  if (userPlayer && Object.values(starters).indexOf(userPlayer) < 0 && !bench.includes(userPlayer)) {
    bench.unshift(userPlayer);
  } else if (userPlayer && Object.values(starters).indexOf(userPlayer) < 0) {
    bench = bench.filter(function(p) { return p !== userPlayer; });
    bench.unshift(userPlayer);
  } else {
    bench.sort((a, b) => b.ovr - a.ovr);
  }
  if (userPlayer && Object.values(starters).indexOf(userPlayer) < 0) {
    bench = bench.filter(function(p, idx) { return p === userPlayer ? idx === 0 : true; });
  } else {
    bench.sort((a, b) => b.ovr - a.ovr);
  }
  
  var result = { starters, bench, allPlayers, isUserStarter: !!(userPlayer && Object.values(starters).indexOf(userPlayer) >= 0) };
  STATE._lineupCache[lineupCacheKey] = result;
  return result;
}

function clearLineupCache() {
  STATE._lineupCache = {};
}

function syncUserStarterStatus() {
  if (!STATE.careerTeam || !STATE.finalOVR || !STATE.season) return false;
  clearLineupCache();
  var lineup = calcTeamLineup(STATE.careerTeam);
  var starter = !!lineup.isUserStarter;
  if (STATE.career && STATE.career.flags && STATE.career.flags.startBench) starter = false;
  STATE.season.isUserStarter = starter;
  return starter;
}

/** 按位置计算球队实力（首发5人 + 2重要轮换） */
function calcTeamPowerWithPlayer(team) {
  const lineup = calcTeamLineup(team);
  const cfg = SIM_CONFIG.TEAM_POWER;
  
  const starters = Object.values(lineup.starters);
  const bench = lineup.bench.slice(0, 2);  // 只取前2名轮换
  const roster = starters.concat(bench);
  
  if (roster.length === 0) return { offense: 50, defense: 50, athletic: 50, clutch: 50, depth: 50 };
  
  // 首发5人总权重85%，按OVR比例分配（球星影响力更大）
  const totalStarterOVR = starters.reduce((s, p) => s + (parseInt(p.ovr) || 50), 0);
  const benchWeight = 0.15 / bench.length;
  
  const weightedRoster = roster.map((p, i) => ({
    player: p,
    weight: i < starters.length
      ? 0.85 * ((parseInt(p.ovr) || 50) / totalStarterOVR)
      : benchWeight,
  }));
  
  function calcDim(weights) {
    let sum = 0, totalW = 0;
    Object.entries(weights).forEach(([attr, w]) => {
      const weightedAvg = weightedRoster.reduce((s, { player, weight }) => 
        s + (parseInt(player[attr]) || 50) * weight, 0);
      sum += weightedAvg * w;
      totalW += w;
    });
    return totalW > 0 ? sum / totalW : 50;
  }
  
  const overall = weightedRoster.reduce((s, { player, weight }) => 
    s + (parseInt(player.ovr) || 50) * weight, 0);
  
  return {
    offense: calcDim(cfg.offense),
    defense: calcDim(cfg.defense),
    athletic: calcDim(cfg.athletic),
    clutch: calcDim(cfg.clutch),
    depth: overall,
  };
}

/** 比赛模拟 — 使用统一胜率公式 + 详细比分生成 */
function simulateGameNew(teamA, teamB, seedBonus, probMultiplier) {
  const powerA = calcTeamPowerWithPlayer(teamA);
  const powerB = calcTeamPowerWithPlayer(teamB);
  const config = SIM_CONFIG;
  
  // ★ 第一步：用统一胜率公式决定胜负
  const netRatingA = (powerA.offense - powerB.offense) * 0.4 
                   + (powerA.defense - powerB.defense) * 0.4 
                   + (powerA.depth - powerB.depth) * 0.1
                   + (powerA.clutch - powerB.clutch) * 0.1
                   + (seedBonus || 0);  // 季后赛种子保护：高顺位概率加成
  const winProb = 0.5 + netRatingA / 25;
  const clampedProb = Math.max(0.15, Math.min(0.85, winProb));
  // ★ 概率乘数（用于季后赛用户 debuff）
  const finalProb = probMultiplier != null ? Math.max(0.10, clampedProb * probMultiplier) : clampedProb;
  const predeterminedWinner = Math.random() < finalProb ? teamA : teamB;
  
  // ★ 第二步：生成展示用比分（不影响胜负结果）
  // 计算节奏
  const paceA = config.PACE.base + (Math.random() - 0.5) * config.PACE.teamRange;
  const paceB = config.PACE.base + (Math.random() - 0.5) * config.PACE.teamRange;
  const gamePace = (paceA + paceB) / 2;
  const possPerQ = Math.round(gamePace / 4);
  
  let scoreA = 0, scoreB = 0;
  let highlight = false;
  let keyEvents = [];
  let momentum = 1.0;
  let qScoresA = [], qScoresB = [];
  
  // 查找赛程，确认主客场
  const schedule = STATE.season.schedule || [];
  const gameIdx = schedule.findIndex(g => !g.simulated);
  const isHome = gameIdx >= 0 ? schedule[gameIdx]?.home : true;
  const isB2B = gameIdx > 0 && schedule[gameIdx-1]?.isB2B;
  
  // ★ 根据预定胜者设置倾向
  const desiredWinner = predeterminedWinner;
  
  for (let q = 0; q < 4; q++) {
    const baseQ = possPerQ;
    
    // 实力差值影响比分展示（小幅度，不决定胜负）
    const offDefDiffA = (powerA.offense - powerB.defense) / 120;
    const offDefDiffB = (powerB.offense - powerA.defense) / 120;
    
    // 主场加成
    const homeBonusQ = isHome ? 1.0 : 0;
    
    // 每节得分 = 基准 + 实力展示 + 主场 + 大随机
    let ptsA = baseQ + offDefDiffA * 3 + homeBonusQ + (momentum - 1) * 1.5;
    let ptsB = baseQ + offDefDiffB * 3;
    
    // 确保预定胜者适度领先
    const currentDiff = (scoreA + ptsA) - (scoreB + ptsB);
    const targetLead = desiredWinner === teamA ? 1 : -1;
    if ((desiredWinner === teamA && currentDiff < targetLead) ||
        (desiredWinner === teamB && currentDiff > targetLead)) {
      if (desiredWinner === teamA) ptsA += 2;
      else ptsB += 2;
    }
    
    // 背靠背
    if (isB2B) { ptsA *= 0.96; ptsB *= 0.96; }
    
    // ★ 大随机波动 ±25%
    ptsA *= (0.75 + Math.random() * 0.50);
    ptsB *= (0.75 + Math.random() * 0.50);
    
    // 落后方反扑
    if (Math.abs(currentDiff) > 10) {
      const comeback = 1 + Math.abs(currentDiff) * 0.003;
      if (currentDiff > 0) ptsB *= comeback; else ptsA *= comeback;
    }
    
    const qA = Math.max(8, Math.round(ptsA));
    const qB = Math.max(8, Math.round(ptsB));
    
    scoreA += qA;
    scoreB += qB;
    qScoresA.push(qA);
    qScoresB.push(qB);
    
    // 随机事件
    if (Math.random() < 0.08) {
      const bonus = 3 + Math.round(Math.random() * 8);
      if (Math.random() > 0.5) { scoreA += bonus; keyEvents.push(`🔥 ${getTeamName(teamA)} 单节爆发 +${bonus}`); }
      else { scoreB += bonus; keyEvents.push(`🔥 ${getTeamName(teamB)} 单节爆发 +${bonus}`); }
      highlight = true;
    }
    
    momentum = momentum * 0.7 + 0.3;
  }
  
  // 关键球/绝杀
  if (Math.abs(scoreA - scoreB) < 6 && Math.random() < 0.35) {
    highlight = true;
    if (Math.random() > 0.5) { scoreA += 3; keyEvents.push('⚡ 关键三分！'); }
    else { scoreB += 3; keyEvents.push('⚡ 关键三分！'); }
  }
  if (Math.abs(scoreA - scoreB) <= 3 && Math.random() < 0.12) {
    highlight = true;
    if (Math.random() > 0.5) { scoreA += 3; keyEvents.push('🏆 压哨绝杀！'); }
    else { scoreB += 3; keyEvents.push('💔 被压哨绝杀...'); }
  }
  
  // 加时
  let ot = 0;
  while (Math.abs(scoreA - scoreB) < 3 && ot < 3) {
    ot++;
    scoreA += Math.round(4 + Math.random() * 8);
    scoreB += Math.round(4 + Math.random() * 8);
    keyEvents.push(`⏱ 加时赛 #${ot}`);
    highlight = true;
  }
  
  // ★ 最终结果由预定胜者决定
  const won = predeterminedWinner === teamA;
  // 确保比分方向正确：胜者必须领先（最多修正15分，避免离谱单节比分）
  if (won && scoreB >= scoreA) {
    const add = Math.min(15, scoreB - scoreA + 1);
    scoreA += add;
    if (qScoresA.length) qScoresA[qScoresA.length - 1] += add;
  } else if (!won && scoreA >= scoreB) {
    const add = Math.min(15, scoreA - scoreB + 1);
    scoreB += add;
    if (qScoresB.length) qScoresB[qScoresB.length - 1] += add;
  }
  
  // 冷门检测
  const avgA = (powerA.offense + powerA.defense) / 2;
  const avgB = (powerB.offense + powerB.defense) / 2;
  if (won !== (avgA > avgB) && Math.abs(avgA - avgB) > 3) {
    highlight = true;
    keyEvents.push('💥 爆冷！');
  }
  
  return {
    won, scoreA, scoreB,
    qScoresA, qScoresB,
    highlight, keyEvents, ot,
    teamA: { power: powerA },
    teamB: { power: powerB },
    pace: gamePace,
    possPerQ,
    boxScore: generateBoxScore(teamA, teamB, scoreA, scoreB),
  };
}

/** 限制单个 NPC 长期占用过高得分份额，并把溢出得分分配给其他轮换球员。 */
function capAndRedistributeScoring(allocated, weights, players, totalPts) {
  var caps = players.map(function(player) {
    var ovr = parseInt(player.ovr) || 50;
    var starRange = Math.max(0, Math.min(19, ovr - 80));
    var hotNight = Math.random() < 0.08;
    var shareCap = 0.22 + starRange * 0.004 + (hotNight ? 0.08 : 0);
    return Math.max(8, Math.min(hotNight ? 45 : 34, Math.round(totalPts * shareCap)));
  });

  var overflow = 0;
  for (var i = 0; i < allocated.length; i++) {
    if (allocated[i] > caps[i]) {
      overflow += allocated[i] - caps[i];
      allocated[i] = caps[i];
    }
  }

  while (overflow > 0) {
    var eligible = [];
    for (var j = 0; j < allocated.length; j++) {
      if (allocated[j] < caps[j]) eligible.push(j);
    }
    if (!eligible.length) break;
    eligible.sort(function(a, b) {
      return weights[b] - weights[a] || allocated[a] - allocated[b];
    });
    for (var k = 0; k < eligible.length && overflow > 0; k++) {
      allocated[eligible[k]]++;
      overflow--;
    }
  }

  if (overflow > 0) {
    var bestIdx = weights.indexOf(Math.max.apply(null, weights));
    allocated[bestIdx] += overflow;
  }
  return allocated;
}

/** 生成两队全队数据（确保总分=比分） */
function generateBoxScore(teamA, teamB, totalA, totalB) {
  function getLineupStats(team, totalPts) {
    const lineup = calcTeamLineup(team);
    // 展示所有轮换球员（首发5人 + 替补前5 = 10人）
    const players = Object.values(lineup.starters).concat(lineup.bench.slice(0, 5));
    if (players.length === 0) return [];
    
    // 按OVR从高到低排序（替补排最后）
    players.sort((a, b) => (parseInt(b.ovr)||0) - (parseInt(a.ovr)||0));
    
    // 计算得分权重：OVR为主（指数放大差距），进攻技能微调
    const minOvr = Math.min(...players.map(p => parseInt(p.ovr)||50));
    const maxOvr = Math.max(...players.map(p => parseInt(p.ovr)||50));
    const weights = players.map((p, idx) => {
      const ovr = parseInt(p.ovr) || 50;
      // 线性权重：OVR=40时权重=0.1，OVR=99时权重=1.0，无断崖
      const ovrFactor = Math.max(0.1, (ovr - 40) / 59);
      // 进攻技能微调（±20%）
      const offBonus = (af(parseInt(p.threePT)||50) + af(parseInt(p.FIN)||50) + af(parseInt(p.MID)||50)) / 3;
      // 得分手加成：第一核心承担接近真实 NBA 的高使用率，轮换末端相应收缩
      const starBonus = idx === 0 ? 2.1 : Math.max(0.3, 1.55 - idx * 0.2);
      return Math.max(0.05, ovrFactor * (0.7 + 0.3 * offBonus) * starBonus);
    });
    const totalW = weights.reduce((a, b) => a + b, 0);
    
    // 分配得分（确保总和=totalPts）
    let allocated = weights.map((w, i) => Math.round(totalPts * w / totalW));
    let diff = totalPts - allocated.reduce((a, b) => a + b, 0);
    if (diff !== 0) {
      const best = weights.indexOf(Math.max(...weights));
      allocated[best] = Math.max(0, allocated[best] + diff);
    }
    allocated = capAndRedistributeScoring(allocated, weights, players, totalPts);
    
    // 确保每人至少1分（只要他上场）
    allocated = allocated.map(v => Math.max(1, v));
    // 如有差额从得分王扣/补
    let sum = allocated.reduce((a, b) => a + b, 0);
    const bestIdx = weights.indexOf(Math.max(...weights));
    if (sum > totalPts) {
      allocated[bestIdx] -= (sum - totalPts);
      if (allocated[bestIdx] < 0) allocated[bestIdx] = 0;
    } else if (sum < totalPts) {
      allocated[bestIdx] += (totalPts - sum);
    }
    
    return players.map((p, i) => {
      const pos = (p.pos || 'SF').split('/')[0].trim();
      const ovr = parseInt(p.ovr) || 50;
      const ath = af(parseInt(p.ATH)||50);
      const reb = af(parseInt(p.REB)||50);
      const pas = af(parseInt(p.PAS)||50) * 0.5 + af(parseInt(p.HAN)||50) * 0.3 + af(parseInt(p.CLU)||50) * 0.2;
      const pdef = af(parseInt(p.PDEF)||50);
      const blk = af(parseInt(p.BLK)||50) * 0.5 + af(parseInt(p.IDEF)||50) * 0.5;
      const han = af(parseInt(p.HAN)||50) * 0.5 + af(parseInt(p.CLU)||50) * 0.5;
      
      const pts = allocated[i];
      // 上场时间：核心主力>角色球员
      const mins = i < 5
        ? 26 + Math.round((1 - i * 0.15) * 12 + Math.random() * 4)
        : 8 + Math.round(Math.random() * 8);
      const fga = Math.round(Math.max(2, pts * 0.7 + Math.random() * 4));
      const fgm = Math.min(fga, Math.max(0, Math.round(fga * (0.32 + Math.random() * 0.28))));
      const threeA = Math.min(fga, Math.max(0, Math.round(fga * (0.20 + af(parseInt(p.threePT)||50) * 0.18))));
      const threeM = Math.min(threeA, Math.max(0, Math.round(threeA * (0.28 + af(parseInt(p.threePT)||50) * 0.18))));
      const fta = Math.max(0, Math.round(pts * (0.12 + af(parseInt(p.FIN)||50) * 0.12)));
      const ftm = Math.min(fta, Math.max(0, Math.round(fta * (0.65 + af(parseInt(p.CLU)||50) * 0.15))));
      
      return {
        name: p.cname || p.name,
        pos, pts,
        // 二次曲线压低普通属性、保留顶尖球员的真实榜首产量
        reb: Math.round(reb * reb * 10.5 + Math.random() * 3 + 2),
        ast: Math.round(pas * pas * 10.5 + Math.random() * 2 + 1),
        stl: Math.round(pdef * pdef * 2.5 + Math.random() + 0.25),
        blk: Math.round(blk * blk * 3.3 + Math.random() + 0.2),
        tov: Math.round(1 + (1 - Math.min(1, han)) * 2.5 + Math.random() * 1),
        fgm, fga, threeM, threeA, ftm, fta,
        mins,
        _isUser: p._isUser || false,
        isUser: p._isUser || false,
      };
    });
  }
  
  return {
    [teamA]: getLineupStats(teamA, totalA),
    [teamB]: getLineupStats(teamB, totalB),
  };
}

/** 实时将当场生成的玩家真实数据同步回 gameResult.boxScore 中，消除 N-1 帧延迟 */
function syncUserStatsToBoxScore(gameResult, stats) {
  if (!gameResult || !gameResult.boxScore || !stats) return;
  Object.keys(gameResult.boxScore).forEach(function(teamKey) {
    var rows = gameResult.boxScore[teamKey];
    if (!Array.isArray(rows)) return;
    var userRow = rows.find(function(r) { return r && (r._isUser || r.isUser); });
    if (userRow) {
      Object.assign(userRow, {
        pts: stats.pts, reb: stats.reb, ast: stats.ast,
        stl: stats.stl, blk: stats.blk, tov: stats.tov,
        fgm: stats.fgm, fga: stats.fga, mins: stats.mins
      });
    }
  });
}

/** 属性→效率系数：递减曲线
 *  低属性几乎没用，高属性才有显著收益
 *  35→0.18  50→0.39  65→0.57  75→0.69  85→0.82  95→0.94  99→1.00
 */
function attrFactor(val) {
  const v = Math.max(25, Math.min(99, val || 50));
  return Math.pow((v - 25) / 74, 0.85);
}

/** 严格版：只有顶尖属性才能展现顶尖数据（attrFactor^1.5）
 *  35→0.08  50→0.24  65→0.43  78→0.65  90→0.83  99→1.00
 *  用在所有数据计算上，拉开一般和顶级的差距
 */
function af(val) { return Math.pow(attrFactor(val), 1.5); }

function getSeasonUsageBias() {
  if (!STATE.season) return 1;
  if (STATE.season._usageBias == null) {
    var age = STATE.career && STATE.career.currentAge ? STATE.career.currentAge : 22;
    var ageBase = 1;
    if (age <= 23) ageBase = 0.90;
    else if (age <= 25) ageBase = 0.98;
    else if (age <= 29) ageBase = 1.06;
    else if (age <= 32) ageBase = 1.02;
    else if (age <= 35) ageBase = 0.94;
    else if (age <= 39) ageBase = 0.78;
    else ageBase = 0.68;
    STATE.season._usageBias = ageBase * (0.92 + Math.random() * 0.16);
  }
  return STATE.season._usageBias;
}

/** 生成你的球员数据 — 由单项属性决定，不是总评 */
function generatePlayerStatsNew(attrs, gameResult, isPlayoff) {
  const cfg = SIM_CONFIG.PLAYER_STATS;
  const pos = STATE.position || 'PG';
  const posScale = cfg.POS_SCALE[pos] || cfg.POS_SCALE.PG;
  
  // 节奏和出场时间
  const totalScore = gameResult.scoreA + gameResult.scoreB;
  const paceFactor = Math.min(totalScore / 210, 1.4);
  const seasonUsageBias = getSeasonUsageBias();
  const baseMins = isPlayoff ? 38 : (30 + Math.round(Math.random() * 8));
  const mins = Math.max(8, Math.round(baseMins * Math.sqrt(seasonUsageBias)));
  const minsFactor = mins / 48;
  const statMinsFactor = Math.max(0.75, Math.min(1.15, mins / (isPlayoff ? 38 : 34)));
  
  // 球队总投篮数
  const teamFGA = Math.round((totalScore / 2) * 0.85);
  
  // ★ 球权/使用率由进攻属性决定 — 按位置选择核心进攻属性
  const posOffAttrs = {
    'PG': ['threePT','MID','HAN','PAS'],
    'SG': ['threePT','MID','FIN','HAN'],
    'SF': ['threePT','MID','FIN','DNK','ATH'],
    'PF': ['MID','FIN','DNK','STR','REB'],
    'C':  ['FIN','DNK','STR','MID'],
  };
  const offAttrList = posOffAttrs[pos] || posOffAttrs['SF'];
  const offAttrs = offAttrList.map(k => parseInt(attrs[k]) || 50);
  const offAvg = offAttrs.reduce((a, b) => a + b, 0) / offAttrs.length;
  const offFactor = af(offAvg);
  const baseUsage = cfg.USAGE[pos] || 0.20;
  // ★ 根据总评梯度调整使用率：≤75用原系数，>75每多点提升
  const myOVR = STATE.finalOVR || 75;
  const usageScale = myOVR > 75 ? 1 + (myOVR - 75) * 0.028 : 1.0;
  const scaledUsage = baseUsage * Math.min(1.8, usageScale);
  const starterBoost = (STATE.season && STATE.season.isUserStarter) ? 1.12 : 0.92;
  
  // ★ 出手数 = 球队投篮 × 使用率 × (保底+严格天赋) × 时间
  // ★ 方案A：出手数温和波动 ±55%（0.45~1.55），保留上限封顶
  let fga = Math.round(teamFGA * scaledUsage * seasonUsageBias * (0.1 + offFactor * 0.9) * minsFactor * starterBoost * (0.45 + Math.random() * 1.1));
  const maxFga = Math.round((2 + offFactor * 28) * Math.max(0.75, Math.min(1.65, usageScale)));
  fga = Math.max(2, Math.min(maxFga, fga));
  
  // 投篮分布 — 按属性动态调整 (Experimental)
  const baseDist = SIM_CONFIG.SHOT_DIST[pos] || SIM_CONFIG.SHOT_DIST.PG;
  const threePtAttr = parseInt(attrs.threePT) || 50;
  const finAttr = ((parseInt(attrs.FIN)||50) + (parseInt(attrs.DNK)||50)) / 2;
  const midAttr = parseInt(attrs.MID) || 50;
  let dynDist = { threePT: baseDist.threePT, MID: baseDist.MID, FIN: baseDist.FIN };
  // 三分属性每高/低于50 1点，三分占比调整0.3%
  dynDist.threePT = Math.max(0.05, Math.min(0.55, dynDist.threePT + (threePtAttr - 50) * 0.003));
  // 终结属性调整内线占比
  dynDist.FIN = Math.max(0.05, Math.min(0.55, dynDist.FIN + (finAttr - 50) * 0.002));
  // 中投属性调整中投占比  
  dynDist.MID = Math.max(0.05, Math.min(0.55, dynDist.MID + (midAttr - 50) * 0.002));
  const totalDist = dynDist.threePT + dynDist.MID + dynDist.FIN;
  const threeA = Math.round(fga * (dynDist.threePT / totalDist));
  const midA = Math.round(fga * (dynDist.MID / totalDist));
  const finA = fga - threeA - midA;
  
  // ★ 命中率由对应属性决定
  // 三分只看threePT，中投只看MID，终结看FIN+DNK平均
  const threePct = calcShotPct('threePT', attrs.threePT || 50, totalScore);
  const midPct = calcShotPct('MID', attrs.MID || 50, totalScore);
  const finAvg = ((attrs.FIN||50) + (attrs.DNK||50)) / 2;
  const finPct = calcShotPct('FIN', finAvg, totalScore);
  
  const threeM = Math.round(Math.max(0, threeA * threePct));
  const midM = Math.round(Math.max(0, midA * midPct));
  const finM = Math.round(Math.max(0, finA * finPct));
  const fgm = threeM + midM + finM;
  
  // ★ 罚球由FIN和CLU决定
  const ftRate = Math.min(0.30, 0.10 + (attrs.FIN || 50) / 500);
  const fta = Math.round(fga * ftRate * (0.6 + Math.random() * 0.8));
  const ftPct = calcShotPct('FT', attrs.CLU || 50, totalScore);
  const ftm = Math.round(fta * ftPct);
  
  const pts = threeM * 3 + midM * 2 + finM * 2 + ftm;
  
  // ★ 篮板 = REB属性 × 严格递减曲线
  const rebScale = posScale.reb || 0.35;
  // ★ 篮板 ±30% 波动 (原±60%)
  const rebVal = af(attrs.REB) * (totalScore / 200) * rebScale * 12 * statMinsFactor * (0.7 + Math.random() * 0.6);
  const reb = Math.round(Math.max(0, rebVal));
  
  // ★ 助攻 = 手感 + 传球 + 关键 共同决定
  const astScale = posScale.ast || 0.4;
  const pasAvg = ((attrs.PAS||50) + (attrs.HAN||50) + (attrs.CLU||50)) / 3;
  // ★ 助攻 ±30% 波动 (原±60%)
  const astVal = af(pasAvg) * (totalScore / 200) * astScale * 9 * statMinsFactor * (0.7 + Math.random() * 0.6);
  const ast = Math.round(Math.max(0, astVal));
  
  // ★ 抢断 = PDEF主导 + ATH/HAN辅助（按位置权重）
  const stlF = SIM_CONFIG.PLAYER_STATS.FACTORS[pos].stl;
  const stlSum = stlF.PDEF + (stlF.ATH || 0) + (stlF.HAN || 0);
  const stlAvg = (af(attrs.PDEF||50) * stlF.PDEF + af(attrs.ATH||50) * (stlF.ATH || 0) + af(attrs.HAN||50) * (stlF.HAN || 0)) / stlSum;
  // ★ 抢断 ±30% 波动 (原±60%)
  const stlVal = stlAvg * (totalScore / 200) * 2.0 * statMinsFactor * (0.7 + Math.random() * 0.6);
  const stl = Math.round(Math.max(0, stlVal));
  
  // ★ 盖帽 = BLK主导 + IDEF辅助 + ATH微调（按位置权重）
  const blkF = SIM_CONFIG.PLAYER_STATS.FACTORS[pos].blk;
  const blkSum = blkF.BLK + (blkF.IDEF || 0) + (blkF.ATH || 0);
  const blkAvg = (af(attrs.BLK||50) * blkF.BLK + af(attrs.IDEF||50) * (blkF.IDEF || 0) + af(attrs.ATH||50) * (blkF.ATH || 0)) / blkSum;
  // ★ 盖帽 ±30% 波动 (原±60%)
  const blkVal = blkAvg * (totalScore / 200) * 2.0 * statMinsFactor * (0.7 + Math.random() * 0.6);
  const blk = Math.round(Math.max(0, blkVal));
  
  // ★ 失误 = (HAN+CLU)/2 × 严格递减曲线（越高失误越少）(Experimental: 上调上限)
  const res = { pts, reb, ast, stl, blk, tov, fgm, fga, ftm, fta, threeM, threeA, mins };
  syncUserStatsToBoxScore(gameResult, res);
  return res;
}

function calcShotPct(type, attrVal, totalScore) {
  const cfg = SIM_CONFIG.SHOOTING[type];
  if (!cfg) return 0.40;
  
  let pct = cfg.base + (attrVal - 50) * cfg.attrFactor;
  
  // 节奏修正：高比分节奏快、防守松弛，命中率微升；低比分防守硬朗，命中率微降
  if (totalScore) {
    if (totalScore > 220) pct += 0.012;
    if (totalScore < 180) pct -= 0.012;
  }
  
  // 低属性额外惩罚：属性低于60时命中率明显下降
  if (attrVal < 60) {
    pct -= (60 - attrVal) * 0.005;
  }
  
  // 随机波动 (正态分布收敛：两次随机取均值使波动集中在中心，极端值概率降低)
  const jitter = ((Math.random() + Math.random()) / 2 - 0.5) * 0.16;
  pct *= (1.0 + jitter);
  
  return Math.max(cfg.min || 0.25, Math.min(cfg.max || 0.70, pct));
}

// ==================== 联盟其他比赛模拟 ====================
function simLeagueDay(daySchedule) {
  // 只模拟非你参与的比赛
  daySchedule.forEach(g => {
    if (g.opponent === undefined) return; // 是你的比赛，已经模拟过了
    
    const powerA = calcTeamPowerWithPlayer(g.opponent._team || g.opponent);
    const powerB = calcTeamPowerWithPlayer(g.opponent === STATE.careerTeam ? g.opponent : null);
    
    // 简化模拟：基于实力随机
    const avgA = (powerA.offense + powerA.defense + powerA.depth) / 3;
    const avgB = (powerB.offense + powerB.defense + powerB.depth) / 3;
    const winProb = avgA / (avgA + avgB);
    
    // 还需要补充...
  });
}

// ==================== 赛季进行 ====================
// ★ [实验性] 以下函数已被 quickSimAllGames 替代，保留作参考
/*
function simNextGame() {
  // ★ 批量进行中时禁止单场点击，防止重复计数
  if (STATE._batchInProgress) return;
  const schedule = STATE.season.schedule;
  const next = schedule.find(g => !g.simulated);
  if (!next) { showEndOfSeason(); return; }
  
  const result = simulateGameNew(STATE.careerTeam, next.opponent);
  next.simulated = true;
  next.result = result;
  
  if (result.won) STATE.season.wins++;
  else STATE.season.losses++;
  
  // 更新联盟排名（包括我们自己！）
  const ourStanding = STATE.season.standings[STATE.careerTeam];
  const oppStanding = STATE.season.standings[next.opponent];
  if (ourStanding) {
    if (result.won) ourStanding.wins++; else ourStanding.losses++;
  }
  if (oppStanding) {
    if (result.won) oppStanding.losses++; else oppStanding.wins++;
    updateStreak(next.opponent, !result.won);
  }
  updateStreak(STATE.careerTeam, result.won);
  
  // 你的数据
  const stats = generatePlayerStatsNew(STATE.attrs, result, false);
  const ps = STATE.season.playerStats;
  ps.pts += stats.pts; ps.reb += stats.reb; ps.ast += stats.ast;
  ps.stl += stats.stl; ps.blk += stats.blk; ps.tov += stats.tov;
  ps.fgm += stats.fgm; ps.fga += stats.fga;
  ps.ftm += stats.ftm; ps.fta += stats.fta;
  ps.threeM += stats.threeM; ps.threeA += stats.threeA;
  ps.mins = (ps.mins || 0) + stats.mins;
  ps.games++;
  
  STATE.season.games.push({ result, stats, game: next });
  
  // ★ 同步所有未处理比赛到当前日期
  simDayLeagueGames(next.day);
  
  // 自动翻到下一场所在月份
  const nextUnplayed = schedule.find(g => !g.simulated);
  if (nextUnplayed) {
    for (let m = 0; m < SEASON_MONTHS.length; m++) {
      if (nextUnplayed.day >= SEASON_MONTHS[m].start && nextUnplayed.day <= SEASON_MONTHS[m].end) {
        STATE._calendarMonth = m;
        break;
      }
    }
  }
  
  // renderSeasonUI();
  // renderGameList();
}
*/

function updateStreak(team, won) {
  const s = STATE.season.standings[team];
  if (!s) return;
  if (s.streakLen > 0 && won === (s.streak === 'W')) {
    s.streakLen++;
  } else {
    s.streak = won ? 'W' : 'L';
    s.streakLen = 1;
  }
}

// ★ [实验性] 以下函数已被 quickSimAllGames 替代，保留作参考
/*
function simBatch(count) {
  if (STATE._batchInProgress) return;
  STATE._batchInProgress = true;
  
  const schedule = STATE.season.schedule;
  const gamesToSim = schedule.filter(g => !g.simulated).slice(0, count);
  if (gamesToSim.length === 0) { STATE._batchInProgress = false; return; }
  
  // 显示进度指示
  const controls = document.getElementById('season-controls');
  if (controls) controls.innerHTML = '<div style="text-align:center;padding:8px;font-family:var(--font-display);font-size:13px;color:var(--orange);">⏳ 模拟中 <span id="sim-progress">0/' + gamesToSim.length + '</span></div>';
  
  let gameIdx = 0;
  
  function simNextGameInBatch() {
    if (gameIdx >= gamesToSim.length) {
      STATE._batchInProgress = false;
      if (!schedule.find(h => !h.simulated)) {
        showEndOfSeason();
      } else {
        renderSeasonUI();
      }
      return;
    }
    
    const g = gamesToSim[gameIdx++];
    
    const result = simulateGameNew(STATE.careerTeam, g.opponent);
    g.simulated = true;
    g.result = result;
    
    if (result.won) STATE.season.wins++;
    else STATE.season.losses++;
    
    const ourStanding = STATE.season.standings[STATE.careerTeam];
    const oppStanding = STATE.season.standings[g.opponent];
    if (ourStanding) {
      if (result.won) ourStanding.wins++; else ourStanding.losses++;
    }
    if (oppStanding) {
      if (result.won) oppStanding.losses++; else oppStanding.wins++;
      updateStreak(g.opponent, !result.won);
    }
    updateStreak(STATE.careerTeam, result.won);
    
    const stats = generatePlayerStatsNew(STATE.attrs, result, false);
    const ps = STATE.season.playerStats;
    ps.pts += stats.pts; ps.reb += stats.reb; ps.ast += stats.ast;
    ps.stl += stats.stl; ps.blk += stats.blk; ps.tov += stats.tov;
    ps.fgm += stats.fgm; ps.fga += stats.fga;
    ps.ftm += stats.ftm; ps.fta += stats.fta;
    ps.threeM += stats.threeM; ps.threeA += stats.threeA;
    ps.mins = (ps.mins || 0) + stats.mins;
    ps.games++;
    
    STATE.season.games.push({ result, stats, game: g });
    simDayLeagueGames(g.day);
    
    const curMonthIdx = SEASON_MONTHS.findIndex(m => g.day >= m.start && g.day <= m.end);
    if (curMonthIdx >= 0) STATE._calendarMonth = curMonthIdx;
    renderSeasonUI();
    
    const prog = document.getElementById('sim-progress');
    if (prog) prog.textContent = gameIdx + '/' + gamesToSim.length;
    
    setTimeout(simNextGameInBatch, 40);
  }
  
*/

/** 处理所有剩余比赛日（赛季结束时调用） */
function processAllRemainingDays() {
  const dayMap = STATE.season._dayMap;
  if (!dayMap) return;
  var keys = Object.keys(dayMap);
  if (keys.length === 0) return;
  const maxDay = Math.max(...keys.map(Number));
  simDayLeagueGames(maxDay);
}

/** 赛季结束 — 停留在赛季页面，让用户选择下一步 */
function showEndOfSeason() {
  processAllRemainingDays();
  // 隐藏 sh-top，只显示 eos-container
  html('season-header').innerHTML = '';
  const seed = getConferenceSeed(STATE.careerTeam);
  
  let actionBtn = '';
  let emoji = '';
  if (seed <= 6) {
    emoji = '🏀';
    actionBtn = `<button class="btn btn-gold btn-sm" onclick="renderPlayoffs()" style="flex:1;">🏀 进入季后赛（${seed}号种子）</button>`;
  } else if (seed <= 10) {
    emoji = '🔥';
    actionBtn = `<button class="btn btn-gold btn-sm" onclick="renderPlayoffs()" style="flex:1;">🔥 附加赛（${seed}号种子）</button>`;
  } else {
    emoji = '📊';
    actionBtn = `<button class="btn btn-gold btn-sm" onclick="showSeasonResults()" style="flex:1;">📊 查看赛季总结</button>`;
  }
  
  const conf = getConference(STATE.careerTeam);
  const confName = conf === 'EAST' ? '东部' : '西部';
  
  html('season-controls').innerHTML = `
    <div class="eos-container">
      <div class="eos-emoji">${emoji}</div>
      <div class="eos-title">常规赛结束</div>
      <div class="eos-record">${STATE.season.wins}-${STATE.season.losses}</div>
      <div class="eos-detail">${confName} 第 ${seed} 名</div>
      <div class="eos-actions">
        ${actionBtn}
      </div>
    </div>
  `;
  // 滚动到顶部
  document.querySelector('.sim-header')?.scrollIntoView({ behavior: 'smooth' });
  setTimeout(function() { maybeShowFirstSixtyWinCelebration(); }, 260);
}

// ==================== 新 GameCast ====================
function renderGameCastNew(game, result, stats) {
  const container = html('gamecast-area');
  let castHtml = `<div class="gamecast">`;
  
  const qLabels = ['第一节', '第二节', '第三节', '第四节'];
  const teamName = getTeamName(STATE.careerTeam);
  const oppName = getTeamName(game.opponent);
  
  for (let q = 0; q < 4; q++) {
    const qA = result.qScoresA?.[q] || Math.round(result.scoreA / 4);
    const qB = result.qScoresB?.[q] || Math.round(result.scoreB / 4);
    const cumA = result.qScoresA?.slice(0, q+1).reduce((a,b)=>a+b, 0) || Math.round(result.scoreA * (q+1) / 4);
    const cumB = result.qScoresB?.slice(0, q+1).reduce((a,b)=>a+b, 0) || Math.round(result.scoreB * (q+1) / 4);
    
    castHtml += `<div class="gc-row ${q === 3 ? 'gc-final' : ''}">
      <span class="gc-q">${qLabels[q]}</span>
      <span class="gc-score ${cumA > cumB ? 'gc-winning' : 'gc-losing'}">${qA}-${qB}</span>
      <span class="gc-total">(${cumA}-${cumB})</span>
      ${q === 3 && stats ? `<span class="gc-stats">📊 ${stats.pts}分 ${stats.reb}板 ${stats.ast}助</span>` : ''}
    </div>`;
  }
  
  if (result.ot) {
    castHtml += `<div class="gc-row gc-ot">
      <span class="gc-q">加时</span>
      <span class="gc-score">${result.scoreA - (result.qScoresA?.reduce((a,b)=>a+b,0) || 0)}-${result.scoreB - (result.qScoresB?.reduce((a,b)=>a+b,0) || 0)}</span>
    </div>`;
  }
  
  if (result.keyEvents && result.keyEvents.length > 0) {
    castHtml += `<div class="gc-events">`;
    result.keyEvents.forEach(e => {
      castHtml += `<div class="gc-event">⚡ ${e}</div>`;
    });
    castHtml += `</div>`;
  }
  
  // 你的球员表现
  if (stats) {
    const pct = stats.fga > 0 ? Math.round(stats.fgm / stats.fga * 100) : 0;
    const threePct = stats.threeA > 0 ? Math.round(stats.threeM / stats.threeA * 100) : 0;
    castHtml += `<div class="gc-player-line">
      <span class="gc-player-name">我的球员</span>
      <span>${stats.pts}分 / ${stats.reb}板 / ${stats.ast}助</span>
      <span style="color:var(--text-dim);font-size:11px;">${stats.fgm}-${stats.fga} (${pct}%) / ${stats.threeM}-${stats.threeA} (${threePct}%) / ${stats.ftm}-${stats.fta}</span>
    </div>`;
  }
  
  castHtml += `<div class="gc-result ${result.won ? 'result-win' : 'result-loss'}">
    ${result.won ? '✅ 胜利' : '❌ 失利'} · ${result.scoreA}-${result.scoreB}
    <span style="font-size:12px;color:var(--text-dim);">${teamName} vs ${oppName}</span>
  </div>`;
  
  castHtml += `</div>`;
  container.innerHTML = castHtml;
  container.scrollTop = container.scrollHeight;
}

// ==================== 赛季UI ====================
// ★ [实验性] 以下函数已被 quickSimAllGames + renderDotGrid 替代，保留作参考
/*
function renderSeasonUI() {
  const rec = STATE.season;
  if (!rec || !rec.playerStats) return;
  
  // 最近5场
  const recentGames = STATE.season.games.slice(-5);
  let last5Html = recentGames.map(g => 
    `<span class="wl-dot ${g.result.won ? 'wl-w' : 'wl-l'}">${g.result.won ? 'W' : 'L'}</span>`
  ).join('');
  
  // 场均数据
  const gp = rec.playerStats.games || 1;
  const avg = {
    pts: Math.round(rec.playerStats.pts / gp * 10) / 10,
    reb: Math.round(rec.playerStats.reb / gp * 10) / 10,
    ast: Math.round(rec.playerStats.ast / gp * 10) / 10,
  };
  
  // 连胜/连败
  const streak = STATE.season.standings[STATE.careerTeam]?.streak || '';
  const streakLen = STATE.season.standings[STATE.careerTeam]?.streakLen || 0;
  const streakStr = streakLen > 0 ? `${streak}${streakLen}` : '';
  
  html('season-header').innerHTML = `
    <div class="sh-top">
      <div class="sh-team">
        <div class="sh-team-name">${getTeamLogo(STATE.careerTeam, 24)} ${getTeamName(STATE.careerTeam)}</div>
        <div class="sh-team-full">${(window.TEAM_CITY && window.TEAM_CITY[STATE.careerTeam]) || ''}</div>
      </div>
      <div class="sh-season">${getCurrentSeasonLabel()}</div>
      <div class="sh-record">
        <span class="sh-wins">${rec.wins}</span><span class="sh-dash">-</span><span class="sh-losses">${rec.losses}</span>
        <div class="sh-pct">${rec.wins + rec.losses > 0 ? (rec.wins / (rec.wins + rec.losses) * 100).toFixed(1) + '%' : '—'}</div>
      </div>
    </div>
    <div class="sh-info">
      <span>${SIM_CONFIG.POSITIONS[STATE.position]} · OVR ${STATE.finalOVR}</span>
      <span>场均 ${avg.pts}分 ${avg.reb}板 ${avg.ast}助</span>
      <span>${last5Html ? '最近: ' + last5Html : ''} ${streakStr}</span>
    </div>
  `;
  
  // 判断所有比赛是否已打完
  const allDone = STATE.season.schedule && !STATE.season.schedule.find(g => !g.simulated);
  const seed = getConferenceSeed(STATE.careerTeam);
  let nextBtn = '';
  if (allDone) {
    if (seed <= 10) {
      nextBtn = `<button class="btn btn-gold btn-sm" onclick="renderPlayoffs()" style="flex:1;">🏀 进入季后赛</button>`;
    } else {
      nextBtn = `<button class="btn btn-secondary btn-sm" onclick="showSeasonResults()" style="flex:1;">📊 查看赛季总结</button>`;
    }
  } else {
    const nextGame = STATE.season.schedule?.find(g => !g.simulated);
    const oppName = nextGame ? getTeamName(nextGame.opponent) : '';
    const prefix = nextGame ? (nextGame.home ? 'vs' : '@') : '';
    nextBtn = `
      <button class="btn btn-gold btn-sm" onclick="simNextGame()" style="flex:1;">进行下一场</button>
      <button class="btn btn-gold btn-sm" onclick="simBatch(10)" style="flex:1;">⏩ 进行下十场</button>
    `;
  }
  html('season-controls').innerHTML = `
    ${nextBtn}
    <button class="btn btn-secondary btn-sm" onclick="showMyCard()">📊 我的数据</button>
  `;
  
  // renderCalendar();  // 日历模式已注释
}
*/
/*
function renderGameList() {
  // renderCalendar();  // 日历模式已注释
}
*/

// ==================== 日历赛程 ====================
/** 月份→day区间（day 0 = 2025年10月21日 赛季首日） */
const SEASON_MONTHS = [
  { name: '10月', start: 0, end: 10, firstDate: 21, days: 31, firstWday: 3 },
  { name: '11月', start: 11, end: 40, firstDate: 1, days: 30, firstWday: 6 },
  { name: '12月', start: 41, end: 71, firstDate: 1, days: 31, firstWday: 1 },
  { name: '1月', start: 72, end: 102, firstDate: 1, days: 31, firstWday: 4 },
  { name: '2月', start: 103, end: 130, firstDate: 1, days: 28, firstWday: 0 },
  { name: '3月', start: 131, end: 161, firstDate: 1, days: 31, firstWday: 0 },
  { name: '4月', start: 162, end: 191, firstDate: 1, days: 30, firstWday: 3 },
];

function renderCalendar() {
  if (!STATE._calendarMonth) STATE._calendarMonth = 0;
  const monthIdx = STATE._calendarMonth;
  const month = SEASON_MONTHS[monthIdx];
  if (!month) return;
  
  const schedule = STATE.season.schedule || [];
  const games = STATE.season.games || [];
  const nextGameIdx = schedule.findIndex(g => !g.simulated);
  const nextGame = nextGameIdx >= 0 ? schedule[nextGameIdx] : null;
  
  // 构建比赛查找表: seasonDay → info
  const dayMap = {};
  schedule.forEach(g => {
    if (g.day >= month.start && g.day <= month.end) {
      const result = g.simulated ? (games.find(gg => gg.game.gameNum === g.gameNum)?.result || null) : null;
      dayMap[g.day] = {
        opponent: g.opponent, home: g.home,
        simulated: g.simulated, result,
        isNext: nextGame && g.day === nextGame.day,
      };
    }
  });
  
  // 该月天数 & 第一天星期几
  const totalDays = month.days;
  const firstWday = month.firstWday; // 0=日 1=一 ... 6=六
  
  // 顶部：月份标题 + 排行榜按钮
  let htmlStr = `<div class="cal-wrap">
    <div class="cal-header">
      <button class="cal-nav" onclick="switchCalendar(${monthIdx - 1})" ${monthIdx === 0 ? 'disabled' : ''}>◀</button>
      <span class="cal-title">${month.name}</span>
      <button class="cal-nav" onclick="switchCalendar(${monthIdx + 1})" ${monthIdx >= SEASON_MONTHS.length - 1 ? 'disabled' : ''}>▶</button>
      <button class="cal-standings-btn" onclick="trackEvent({act:'click',blk:'BMC098',pos:'TC15',label:'排行榜'});showStandingsModal()">🏆 排行榜</button>
    </div>`;
  
  // 星期头
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  htmlStr += `<div class="cal-weekdays">${weekdays.map(d => `<span>${d}</span>`).join('')}</div>`;
  
  // 日历网格
  let cells = '';
  
  // 月首空白
  for (let i = 0; i < firstWday; i++) {
    cells += '<div class="cal-cell cal-empty"></div>';
  }
  
  // 该月每一天
  for (let date = 1; date <= totalDays; date++) {
    const seasonDay = month.start + (date - month.firstDate);
    const info = dayMap[seasonDay];
    const isGameDay = !!info;
    const isToday = info?.isNext;
    const isPast = info?.simulated;
    
    let cls = 'cal-cell';
    let content = '';
    let onclick = '';
    
    if (!isGameDay) {
      cls += ' cal-rest';
      content = `<span class="cal-date">${date}</span>`;
    } else if (isPast && info.result) {
      const won = info.result.won;
      cls += won ? ' cal-w' : ' cal-l';
      cls += ' cal-played';
      content = `<span class="cal-date">${date}</span>
        <span class="cal-opp">${info.home ? 'vs' : '@'}${getTeamLogo(info.opponent, 16)}</span>
        <span class="cal-score">${info.result.scoreA}-${info.result.scoreB}</span>`;
      onclick = `onclick="showGamePopup(${seasonDay})"`;
    } else if (isToday) {
      cls += ' cal-today';
      content = `<span class="cal-date">${date}</span>
        <span class="cal-opp">${info.home ? 'vs' : '@'}${getTeamLogo(info.opponent, 16)}</span>`;
      onclick = `onclick="simToDay(${seasonDay})"`;
    } else {
      cls += ' cal-future';
      content = `<span class="cal-date">${date}</span>
        <span class="cal-opp">${info.home ? 'vs' : '@'}${getTeamLogo(info.opponent, 16)}</span>`;
      onclick = `onclick="simToDay(${seasonDay})"`;
    }
    
    cells += `<div class="${cls}" ${onclick}>${content}</div>`;
  }
  
  htmlStr += `<div class="cal-grid">${cells}</div>`;
  
  // 底部 — 只保留进度文字
  htmlStr += `<div class="cal-footer">
    <span style="font-size:10px;color:var(--text-muted);flex:1;text-align:left;">💡 点击赛程表中任意一场比赛，可直接模拟至该场比赛</span>
    <span class="cal-progress">${schedule.filter(g => g.simulated).length} / ${schedule.length} 场</span>
  </div>`;
  
  htmlStr += '</div>';
  document.getElementById('game-list').innerHTML = htmlStr;
}

function switchCalendar(idx) {
  
  if (idx < 0 || idx >= SEASON_MONTHS.length) return;
  STATE._calendarMonth = idx;
  renderCalendar();
}

/** 点击已赛场次 → 弹窗显示比分 + 你的表现 */
function showGamePopup(seasonDay) {
  
  const gameData = STATE.season.games.find(gg => gg.game.day === seasonDay);
  if (!gameData) return;
  const { result, stats, game } = gameData;
  
  const teamName = getTeamName(STATE.careerTeam);
  const oppName = getTeamName(game.opponent);
  const qLabels = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  // 各节比分
  let quartersHtml = '';
  for (let q = 0; q < 4; q++) {
    const qA = result.qScoresA?.[q] || 0;
    const qB = result.qScoresB?.[q] || 0;
    quartersHtml += `<div style="display:flex;gap:4px;padding:2px 0;font-family:var(--font-display);font-size:12px;border-bottom:1px solid var(--border);">
      <span style="width:28px;color:var(--text-muted);">${qLabels[q]}</span>
      <span style="flex:1;text-align:center;font-weight:${qA > qB ? 700 : 400};color:${qA > qB ? 'var(--green)' : 'var(--text-dim)'};">${qA}</span>
      <span style="flex:1;text-align:center;font-weight:${qB > qA ? 700 : 400};color:${qB > qA ? 'var(--green)' : 'var(--text-dim)'};">${qB}</span>
    </div>`;
  }
  
  // 使用你的实际比赛数据（与场均统计同源）
  const myPts = stats?.pts ?? 0;
  const myReb = stats?.reb ?? 0;
  const myAst = stats?.ast ?? 0;
  const myStl = Math.round(stats?.stl ?? 0);
  const myBlk = Math.round(stats?.blk ?? 0);
  const myTov = Math.round(stats?.tov ?? 0);
  const myFgm = stats?.fgm ?? 0;
  const myFga = stats?.fga ?? 0;
  const myMin = stats?.mins ?? 0;
  const myThreeM = stats?.threeM ?? 0;
  const myThreeA = stats?.threeA ?? 0;
  const myFtm = stats?.ftm ?? 0;
  const myFta = stats?.fta ?? 0;
  const myTwoM = myFgm - myThreeM;
  const myTwoA = myFga - myThreeA;
  
  const myTeamTotal = result.scoreA;
  const oppTotal = result.scoreB;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:310px;">
      <div class="modal-header" style="padding:8px 12px;">
        <span style="font-family:var(--font-display);font-size:15px;">${result.won ? '✅' : '❌'} ${myTeamTotal}-${oppTotal}</span>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div style="text-align:center;padding:3px 10px 6px;font-family:var(--font-display);font-size:11px;color:var(--text-dim);border-bottom:1px solid var(--border);">
        ${teamName} vs ${oppName} · ${game.home ? '主场' : '客场'} ${result.ot ? '· ' + (result.ot > 1 ? result.ot + 'OT' : 'OT') : ''}
      </div>
      
      <!-- 各节 -->
      <div style="padding:4px 12px 3px;">
        ${quartersHtml}
      </div>
      
      <!-- 你的数据 -->
      <div style="padding:6px 12px 10px;">
        <div style="font-family:var(--font-display);font-size:12px;color:var(--orange);margin-bottom:4px;">📊 我的表现</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;font-family:var(--font-display);">
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;color:var(--orange);">${myPts}</div>
            <div style="font-size:8px;color:var(--text-muted);">得分</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;">${myReb}</div>
            <div style="font-size:8px;color:var(--text-muted);">篮板</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;">${myAst}</div>
            <div style="font-size:8px;color:var(--text-muted);">助攻</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 6px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${myStl}</div>
            <div style="font-size:8px;color:var(--text-muted);">断</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 6px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${myBlk}</div>
            <div style="font-size:8px;color:var(--text-muted);">帽</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 6px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${myTov}</div>
            <div style="font-size:8px;color:var(--text-muted);">误</div>
          </span>
        </div>
        <div style="margin-top:6px;font-family:var(--font-display);font-size:10px;color:var(--text-dim);text-align:center;">
          两分 ${myTwoM}-${myTwoA} · 三分 ${myThreeM}-${myThreeA} · 罚球 ${myFtm}-${myFta}<br>
          投篮 ${myFgm}-${myFga} (${myFga > 0 ? Math.round(myFgm/myFga*100) : 0}%)
        </div>

      </div>
      
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

// ==================== 排行榜弹窗 ====================
function showStandingsModal() {
  const standings = STATE.season.standings;
  if (!standings) return;
  
  if (!STATE._standingsTab) {
    STATE._standingsTab = getConference(STATE.careerTeam) === 'EAST' ? 'EAST' : 'WEST';
  }
  
  function renderConf(teams) {
    const sorted = teams
      .map(t => ({ team: t, ...standings[t] }))
      .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || b.wins - a.wins);
    
    let html = '<div class="st-hdr"><span>#</span><span>球队</span><span>胜</span><span>负</span><span>胜差</span><span>近况</span></div>';
    let leaderWins = 0, leaderLosses = 0;
    sorted.forEach((s, i) => {
      if (i === 0) { leaderWins = s.wins; leaderLosses = s.losses; }
      const gb = i === 0 ? '-' : ((leaderWins - s.wins + s.losses - leaderLosses) / 2).toFixed(1);
      const isMyTeam = s.team === STATE.careerTeam;
      html += `<div class="st-row ${isMyTeam ? 'st-my' : ''}">
        <span>${i + 1}</span>
        <span>${getTeamLogo(s.team, 16)} ${getTeamName(s.team)} ${isMyTeam ? '⭐' : ''}</span>
        <span class="st-w">${s.wins}</span>
        <span class="st-l">${s.losses}</span>
        <span>${gb}</span>
        <span class="st-streak">${s.streakLen > 0 ? s.streak + s.streakLen : '-'}</span>
      </div>`;
    });
    return html;
  }
  
  const active = STATE._standingsTab;
  const tabsHtml = `
    <div class="modal-tabs">
      <button onclick="switchStandingsTab('EAST')" class="${active === 'EAST' ? 'active' : ''}">东部</button>
      <button onclick="switchStandingsTab('WEST')" class="${active === 'WEST' ? 'active' : ''}">西部</button>
    </div>`;
  
  const teams = active === 'EAST' ? SIM_CONFIG.CONFERENCE.EAST : SIM_CONFIG.CONFERENCE.WEST;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'standings-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <span style="font-family:var(--font-display);font-size:20px;">🏆 排行榜</span>
        <button class="modal-close" onclick="closeStandingsModal()">✕</button>
      </div>
      ${tabsHtml}
      <div class="modal-body">${renderConf(teams)}</div>
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) closeStandingsModal(); };
  document.body.appendChild(modal);
}

function switchStandingsTab(conf) {
  STATE._standingsTab = conf;
  const modal = document.getElementById('standings-modal');
  if (modal) modal.remove();
  showStandingsModal();
}

function closeStandingsModal() {
  
  const modal = document.getElementById('standings-modal');
  if (modal) modal.remove();
}

// ★ [实验性] 以下函数已被 quickSimAllGames 替代，保留作参考
/*
function simToDay(targetDay) {
  const month = SEASON_MONTHS.find(m => targetDay >= m.start && targetDay <= m.end);
  const dateStr = month ? `${month.name}${targetDay - month.start + month.firstDate}日` : `第${targetDay + 1}天`;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:300px;text-align:center;">
      <div class="modal-header" style="justify-content:center;border:none;padding:20px 16px 8px;">
        <span style="font-family:var(--font-display);font-size:20px;">⏩ 模拟到 ${dateStr}？</span>
      </div>
      <div style="padding:4px 16px 20px;font-size:13px;color:var(--text-dim);">
        将模拟从今天到 ${dateStr} 的所有比赛
      </div>
      <div style="display:flex;gap:8px;padding:0 16px 16px;">
        <button class="btn btn-sm" style="flex:1;background:var(--bg-card);color:var(--text);border:2px solid var(--border);border-radius:10px;" onclick="this.closest('.modal-overlay').remove()">取消</button>
        <button class="btn btn-primary btn-sm" style="flex:1;border-radius:10px;" onclick="this.closest('.modal-overlay').remove();_simToDay(${targetDay})">确定</button>
      </div>
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function _simToDay(targetDay) {
  // ★ 批量进行中时禁止点击，防止重复计数
  if (STATE._batchInProgress) return;
  STATE._batchInProgress = true;
  
  const schedule = STATE.season.schedule;
  const gamesToSim = schedule.filter(g => !g.simulated && g.day <= targetDay);
  if (gamesToSim.length === 0) { STATE._batchInProgress = false; renderSeasonUI(); renderCalendar(); return; }
  
  // 显示进度指示
  const controls = document.getElementById('season-controls');
  if (controls) controls.innerHTML = '<div style="text-align:center;padding:8px;font-family:var(--font-display);font-size:13px;color:var(--orange);">⏳ 模拟中 <span id="sim-progress">0/' + gamesToSim.length + '</span></div>';
  
  let gameIdx = 0;
  
  function simNextGameInBatch() {
    if (gameIdx >= gamesToSim.length) {
      STATE._batchInProgress = false;
      autoSaveGame();
      // 全部完成
      if (!schedule.find(h => !h.simulated)) {
        showEndOfSeason();
      } else {
        renderSeasonUI(); // 内含 renderCalendar()
      }
      return;
    }
    
    const g = gamesToSim[gameIdx++];
    
    const result = simulateGameNew(STATE.careerTeam, g.opponent);
    g.simulated = true;
    g.result = result;
    
    if (result.won) STATE.season.wins++;
    else STATE.season.losses++;
    
    const ourStanding = STATE.season.standings[STATE.careerTeam];
    const oppStanding = STATE.season.standings[g.opponent];
    if (ourStanding) {
      if (result.won) ourStanding.wins++; else ourStanding.losses++;
    }
    if (oppStanding) {
      if (result.won) oppStanding.losses++; else oppStanding.wins++;
      updateStreak(g.opponent, !result.won);
    }
    updateStreak(STATE.careerTeam, result.won);
    
    const stats = generatePlayerStatsNew(STATE.attrs, result, false);
    const ps = STATE.season.playerStats;
    ps.pts += stats.pts; ps.reb += stats.reb; ps.ast += stats.ast;
    ps.stl += stats.stl; ps.blk += stats.blk; ps.tov += stats.tov;
    ps.fgm += stats.fgm; ps.fga += stats.fga;
    ps.ftm += stats.ftm; ps.fta += stats.fta;
    ps.threeM += stats.threeM; ps.threeA += stats.threeA;
    ps.mins = (ps.mins || 0) + stats.mins;
    ps.games++;
    
    STATE.season.games.push({ result, stats, game: g });
    simDayLeagueGames(g.day);
    
    // ★ 实时更新：赛程表 + 进度
    // 自动切换到当前比赛对应的月份
    const curMonthIdx = SEASON_MONTHS.findIndex(m => g.day >= m.start && g.day <= m.end);
    if (curMonthIdx >= 0) STATE._calendarMonth = curMonthIdx;
    renderSeasonUI(); // 更新header + calendar
    
    const prog = document.getElementById('sim-progress');
    if (prog) prog.textContent = gameIdx + '/' + gamesToSim.length;
    
    // 继续下一场（40ms延迟让UI能刷新）
    setTimeout(simNextGameInBatch, 40);
  }
  
  // simNextGameInBatch();
}
*/

// ==================== 赛季统一结果页 ====================
function showSeasonResults() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC13",label:"查看赛季总结"});
  // 安全检查：防止赛季未初始化时访问异常
  if (!STATE.season || !STATE.season.playerStats) {
    showScreen('screen-menu');
    return;
  }
  showScreen('screen-results');
  const ps = STATE.season.playerStats;
  const gp = Math.max((ps?.games) || 0, 1);
  const avg = {
    pts: Math.round(ps.pts / gp * 10) / 10,
    reb: Math.round(ps.reb / gp * 10) / 10,
    ast: Math.round(ps.ast / gp * 10) / 10,
    stl: Math.round(ps.stl / gp),
    blk: Math.round(ps.blk / gp),
    tov: Math.round(ps.tov / gp * 10) / 10,
    fgm: Math.round(ps.fgm / gp * 10) / 10,
    fga: Math.round(ps.fga / gp * 10) / 10,
    ftm: Math.round(ps.ftm / gp * 10) / 10,
    fta: Math.round(ps.fta / gp * 10) / 10,
    threeM: Math.round(ps.threeM / gp * 10) / 10,
    threeA: Math.round(ps.threeA / gp * 10) / 10,
    mins: Math.round(ps.mins / gp),
  };
  const pct = avg.fga > 0 ? (avg.fgm / avg.fga * 100).toFixed(1) : '—';
  const threePct = avg.threeA > 0 ? (avg.threeM / avg.threeA * 100).toFixed(1) : '—';
  const ftPct = avg.fta > 0 ? (avg.ftm / avg.fta * 100).toFixed(1) : '—';
  const ovrGrade = getOvrGrade(STATE.finalOVR);

  // 季后赛信息
  const bracket = STATE.season.playoffBracket;
  const seed = getConferenceSeed(STATE.careerTeam);
  let playoffResult = '';
  let playoffStatsHtml = '';
  
  if (STATE.season.isChampion) {
    playoffResult = '🏆 总冠军';
  } else if (bracket?.confChampion && bracket.confChampion === STATE.careerTeam) {
    const lastR3 = bracket.results?.find(r => r.round === 3);
    if (lastR3) {
      const userWonF = lastR3.teamA === STATE.careerTeam ? lastR3.aWon : !lastR3.aWon;
      playoffResult = userWonF ? '🏆 总冠军' : '🏀 总决赛 亚军';
    } else {
      playoffResult = '🏀 总决赛';
    }
  } else if (bracket?.confChampion) {
    // 已进季后赛但未夺冠
    const lastResult = bracket.results?.slice(-1)?.[0];
    const roundNames = ['首轮', '分区半决赛', '分区决赛'];
    if (lastResult) {
      const rn = roundNames[lastResult.round] || '季后赛';
      playoffResult = `🏀 ${rn} · ${STATE.season.playoffEliminated ? '淘汰' : lastResult.winner === STATE.careerTeam ? '晋级' : '淘汰'}`;
    } else {
      playoffResult = `🏀 第${seed}种子 · 季后赛`;
    }
  } else if (seed <= 10) {
    const pi = STATE.season.playInState;
    if (pi?.isEliminated) playoffResult = '🔥 附加赛 · 淘汰';
    else if (pi?.playoffSeed) playoffResult = `🔥 附加赛晋级（${pi.playoffSeed}号种子）`;
    else playoffResult = '🔥 附加赛';
  } else {
    playoffResult = '😢 未进季后赛';
  }
  
  // 季后赛数据（独立跟踪）
  const po = STATE.season.playoffStats;
  if (po.games > 0) {
    const poG = po.games;
    const poAvg = {
      pts: Math.round(po.pts / poG * 10) / 10,
      reb: Math.round(po.reb / poG * 10) / 10,
      ast: Math.round(po.ast / poG * 10) / 10,
      stl: Math.round(po.stl / poG),
      blk: Math.round(po.blk / poG),
      tov: Math.round(po.tov / poG * 10) / 10,
      fgm: Math.round(po.fgm / poG * 10) / 10,
      fga: Math.round(po.fga / poG * 10) / 10,
      threeM: Math.round(po.threeM / poG * 10) / 10,
      threeA: Math.round(po.threeA / poG * 10) / 10,
      ftm: Math.round(po.ftm / poG * 10) / 10,
      fta: Math.round(po.fta / poG * 10) / 10,
    };
    const poPct = poAvg.fga > 0 ? (poAvg.fgm / poAvg.fga * 100).toFixed(1) : '—';
    const poThreePct = poAvg.threeA > 0 ? (poAvg.threeM / poAvg.threeA * 100).toFixed(1) : '—';
    
    playoffStatsHtml = `<div class="sr-section">
      <div class="sr-section-title">🏀 季后赛数据 · ${poG}场</div>
      <div class="sr-stats-grid">
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.pts}</span><span class="sr-stat-lbl">得分</span></div>
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.reb}</span><span class="sr-stat-lbl">篮板</span></div>
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.ast}</span><span class="sr-stat-lbl">助攻</span></div>
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.stl}</span><span class="sr-stat-lbl">抢断</span></div>
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.blk}</span><span class="sr-stat-lbl">盖帽</span></div>
        <div class="sr-stat"><span class="sr-stat-val">${poAvg.tov}</span><span class="sr-stat-lbl">失误</span></div>
      </div>
      <div class="sr-pct-line">投篮 ${poAvg.fgm}-${poAvg.fga} (${poPct}%) · 三分 ${poAvg.threeM}-${poAvg.threeA} (${poThreePct}%)</div>
    </div>`;
  }
  
  // 属性HTML (字母评级)
  let attrsHtml = '';
  ATTR_KEYS.forEach(k => {
    const val = STATE.attrs[k] || 50;
    const g = getGrade(val);
    attrsHtml += `<div class="mc-attr">
      <span class="mc-alabel">${attrCN(k)}</span>
      <span class="mc-aval" style="color:${g.color}">${g.letter}</span>
    </div>`;
  });
  
  // 构建页面
  const hasPlayoffs = bracket && bracket.results?.length > 0;
  
  html('results-content').innerHTML = `
    <div class="sr-page">
      <!-- 头部 -->
      <div class="sr-header">
        <div class="sr-team">${getTeamName(STATE.careerTeam)}</div>
        <div class="sr-record">${STATE.season.wins}-${STATE.season.losses}</div>
        <div class="sr-result">${playoffResult === '🔥 附加赛' ? '' : playoffResult}</div>
      </div>

      <!-- 基础信息 -->
      <div class="sr-section">
        <div class="sr-section-title">👤 我的球员信息</div>
        <div class="sr-info-row">
          <span>位置</span><span>${SIM_CONFIG.POSITIONS[STATE.position]}</span>
        </div>
        <div class="sr-info-row">
          <span>总评</span><span class="sr-ovr">${STATE.finalOVR}</span>
        </div>
        <div class="sr-info-row">
          <span>球队</span><span>${getTeamLogo(STATE.careerTeam, 20)} ${getTeamName(STATE.careerTeam)}</span>
        </div>
      </div>

      <!-- 常规赛数据 -->
      <div class="sr-section">
        <div class="sr-section-title">📊 常规赛 · ${gp}场</div>
        <div class="sr-stats-grid">
          <div class="sr-stat"><span class="sr-stat-val">${avg.pts}</span><span class="sr-stat-lbl">得分</span></div>
          <div class="sr-stat"><span class="sr-stat-val">${avg.reb}</span><span class="sr-stat-lbl">篮板</span></div>
          <div class="sr-stat"><span class="sr-stat-val">${avg.ast}</span><span class="sr-stat-lbl">助攻</span></div>
          <div class="sr-stat"><span class="sr-stat-val">${avg.stl}</span><span class="sr-stat-lbl">抢断</span></div>
          <div class="sr-stat"><span class="sr-stat-val">${avg.blk}</span><span class="sr-stat-lbl">盖帽</span></div>
          <div class="sr-stat"><span class="sr-stat-val">${avg.tov}</span><span class="sr-stat-lbl">失误</span></div>
        </div>
        <div class="sr-pct-line">投篮 ${avg.fgm}-${avg.fga} (${pct}%) · 三分 ${avg.threeM}-${avg.threeA} (${threePct}%) · 罚球 ${avg.ftm}-${avg.fta} (${ftPct}%)</div>
      </div>

      ${playoffStatsHtml}

      <!-- 最终属性 -->
      <div class="sr-section">
        <div class="sr-section-title">🏷️ 最终属性</div>
        <div class="mc-attrs">${attrsHtml}</div>
      </div>

      <!-- 按钮 -->
      <div class="sr-actions">
        <button class="btn btn-primary" onclick="showMyCard()" style="display:flex;align-items:center;justify-content:center;gap:4px;">📊 生涯数据 · 进入休赛期</button>
      </div>
    </div>
  `;
}

// ==================== My Card（实时数据面板）====================
function showMyCard() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC8",label:"我的数据"});
  showScreen('screen-mycard');
  const isFinal = !STATE.season.schedule?.find(g => !g.simulated);
  renderMyCard(isFinal);
}

function renderMyCard(isFinal) {
  const ps = STATE.season.playerStats;
  const gp = ps.games || 1;
  const avg = {
    pts: Math.round(ps.pts / gp * 10) / 10,
    reb: Math.round(ps.reb / gp * 10) / 10,
    ast: Math.round(ps.ast / gp * 10) / 10,
    stl: Math.round(ps.stl / gp),
    blk: Math.round(ps.blk / gp),
    tov: Math.round(ps.tov / gp * 10) / 10,
    fgm: Math.round(ps.fgm / gp * 10) / 10,
    fga: Math.round(ps.fga / gp * 10) / 10,
    ftm: Math.round(ps.ftm / gp * 10) / 10,
    fta: Math.round(ps.fta / gp * 10) / 10,
    threeM: Math.round(ps.threeM / gp * 10) / 10,
    threeA: Math.round(ps.threeA / gp * 10) / 10,
    mins: Math.round(ps.mins / gp),
  };
  const awards = STATE.season.awards || [];
  const ovrGrade = getOvrGrade(STATE.finalOVR);
  
  const pct = avg.fga > 0 ? (avg.fgm / avg.fga * 100).toFixed(1) : '—';
  const threePct = avg.threeA > 0 ? (avg.threeM / avg.threeA * 100).toFixed(1) : '—';
  const ftPct = avg.fta > 0 ? (avg.ftm / avg.fta * 100).toFixed(1) : '—';
  const gamesPlayed = STATE.season.schedule?.filter(g => g.simulated).length || 0;
  
  // 属性紧凑网格
  let attrHtml = '';
  ATTR_KEYS.forEach(k => {
    const val = STATE.attrs[k] || 50;
    const g = getGrade(val);
    attrHtml += `<div class="mc-attr">
      <span class="mc-alabel">${attrCN(k)}</span>
      <span class="mc-aval" style="color:${g.color}">${g.letter}</span>
    </div>`;
  });
  
  let awardsHtml = '';
  awards.forEach(a => {
    if (typeof a === 'object' && !a.isUser) return;
    var l = a.label || (typeof a === 'string' ? a : '');
    if (!l) return;
    if (STATE.career && STATE.career.seasonCount > 0 && l.indexOf('最佳新秀') >= 0) return;
    var emoji = '🏅';
    if (l.indexOf('总冠军') >= 0) emoji = '🏆';
    else if (l.indexOf('MVP') >= 0 || l.indexOf('FMVP') >= 0) emoji = '👑';
    else if (l.indexOf('DPOY') >= 0) emoji = '🔒';
    else if (l.indexOf('全明星') >= 0) emoji = '⭐';
    else if (l.indexOf('最佳阵容') >= 0) emoji = '🌟';
    else if (l.indexOf('最佳新秀') >= 0) emoji = '🌱';
    var cls = 'ch-badge';
    if (l.indexOf('总冠军') >= 0 || l.indexOf('MVP') >= 0 || l.indexOf('FMVP') >= 0) cls += ' gold';
    awardsHtml += renderHonorBadge(l, emoji, cls);
  });
  
  let playoffInfo = '';
  if (isFinal) {
    const seed = getConferenceSeed(STATE.careerTeam);
    function hasSeasonAward(key) {
      return (STATE.season.awards || []).some(function(a) {
        var l = typeof a === 'string' ? a : (a && a.label) || '';
        return l.indexOf(key) >= 0;
      });
    }
    if (hasSeasonAward('总冠军')) {
      playoffInfo = '<div class="mc-chip mc-chip-gold">🏆 总冠军</div>';
    } else if (hasSeasonAward('总决赛MVP')) {
      playoffInfo = '<div class="mc-chip mc-chip-gold">👑 总决赛MVP</div>';
    } else {
      const pi = STATE.season.playInState;
      const bracket = STATE.season.playoffBracket;
      const lastResult = bracket?.results?.slice(-1)?.[0];
      const roundNames = ['首轮', '分区半决赛', '分区决赛', '总决赛'];
      const playoffSeed = STATE.season.playoffSeed || (seed <= 6 ? seed : null);
      
      if (seed <= 6) {
        // 直接晋级季后赛
        if (lastResult) {
          const rn = roundNames[lastResult.round] || '季后赛';
          const isFinals = lastResult.round === 3;
          if (isFinals) {
            playoffInfo = `<div class="mc-chip mc-chip-gold">🏆 总决赛</div>`;
          } else {
            const userWon = lastResult.teamA === STATE.careerTeam ? lastResult.aWon : !lastResult.aWon;
            playoffInfo = `<div class="mc-chip">🏀 ${rn} · ${userWon ? '晋级' : '淘汰'}</div>`;
          }
        } else {
          playoffInfo = `<div class="mc-chip">🏀 季后赛（${playoffSeed}号种子）</div>`;
        }
      } else if (seed <= 10) {
        // 附加赛
        if (pi?.isEliminated) {
          playoffInfo = '<div class="mc-chip" style="color:var(--text-dim);">🔥 附加赛 · 淘汰</div>';
        } else if (pi?.playoffSeed) {
          playoffInfo = `<div class="mc-chip" style="color:var(--gold);">🔥 附加赛晋级 · ${pi.playoffSeed}号种子</div>`;
        } else {
          playoffInfo = '<div class="mc-chip" style="color:var(--accent);">🔥 附加赛</div>';
        }
      } else {
        playoffInfo = '<div class="mc-chip" style="color:var(--text-dim);">😢 未进季后赛</div>';
      }
    }
  }
  
  const retired = !!(STATE.career && STATE.career.retired);
  const btnHtml = isFinal ? (retired ? `
    <div style="display:flex;flex-direction:column;gap:6px;padding-top:4px;">
      <button class="btn btn-primary" onclick="showCareerStats(1)" style="display:flex;align-items:center;justify-content:center;gap:4px;">🏆 查看退役总结</button>
      <div style="text-align:center;font-size:11px;color:var(--text-dim);">生涯已结束</div>
    </div>` : `
    <div style="display:flex;flex-direction:column;gap:6px;padding-top:4px;">
      <button class="btn btn-primary" onclick="showCareerStats()" style="display:flex;align-items:center;justify-content:center;gap:4px;">📊 生涯数据</button>
      <button class="btn btn-gold" onclick="beginOffseason()" style="display:flex;align-items:center;justify-content:center;gap:4px;">🏋️ 进入休赛期</button>
    </div>`) : `
    <div style="display:flex;gap:8px;">
      <button class="btn btn-primary" onclick="backToSeason()" style="flex:1;">◀ 关闭</button>
    </div>`;
  
  html('mycard-content').innerHTML = `
    <div class="mycard">
      <div class="mc-header">
        <div class="mc-pos">${SIM_CONFIG.POSITIONS[STATE.position]}</div>
        <div class="mc-name">${getHupuDisplayName()}</div>
        <div class="mc-ovr-row">
          <span class="mc-ovr">${STATE.finalOVR}</span>

        </div>
        <div class="mc-team-line">${getTeamName(STATE.careerTeam)} · ${STATE.season.wins}-${STATE.season.losses}</div>
        ${playoffInfo}
      </div>
      
      <div class="mc-section">
        <div class="mc-section-title">📊 场均数据 · 已赛 ${gamesPlayed}${isFinal ? '' : '/82'} 场</div>
        <div class="mc-stats-grid">
          <div class="mc-stat"><span class="mc-stat-val">${avg.pts}</span><span class="mc-stat-lbl">得分</span></div>
          <div class="mc-stat"><span class="mc-stat-val">${avg.reb}</span><span class="mc-stat-lbl">篮板</span></div>
          <div class="mc-stat"><span class="mc-stat-val">${avg.ast}</span><span class="mc-stat-lbl">助攻</span></div>
          <div class="mc-stat"><span class="mc-stat-val">${avg.stl}</span><span class="mc-stat-lbl">抢断</span></div>
          <div class="mc-stat"><span class="mc-stat-val">${avg.blk}</span><span class="mc-stat-lbl">盖帽</span></div>
          <div class="mc-stat"><span class="mc-stat-val">${avg.tov}</span><span class="mc-stat-lbl">失误</span></div>
        </div>
        <div class="mc-pct-line">投篮 ${avg.fgm}-${avg.fga} (${pct}%) · 三分 ${avg.threeM}-${avg.threeA} (${threePct}%) · 罚球 ${avg.ftm}-${avg.fta} (${ftPct}%)</div>
      </div>
      
      <div class="mc-section">
        <div class="mc-section-title">🏷️ 最终属性</div>
        <div class="mc-attrs">${attrHtml}</div>
      </div>
      
      ${awardsHtml ? `<div class="mc-section"><div class="mc-awards">${awardsHtml}</div></div>` : ''}
      
      <div style="padding:4px 16px 16px;">${btnHtml}</div>
    </div>
  `;
}

// ==================== 生涯数据页面 ====================
function showCareerStats(tab) {
  showScreen('screen-career-stats');
  saveCurrentSeasonToCareer();
  var c = STATE.career;
  tab = tab || 0;
  var subText = tab === 0 ? (getCurrentSeasonLabel() + ' · ' + STATE.finalPosition + ' · OVR ' + STATE.finalOVR) : (tab === 1 ? ('生涯共 ' + c.honors.length + ' 项荣誉') : ('休赛期纪事 ' + ((c.offseasonHistory || []).length) + ' 条'));
  document.getElementById('career-stats-sub').textContent = subText;

  var html = '';
  // Tabs
  html += '<div class="modal-tabs" style="margin:0 0 10px;">';
  html += '<button class="' + (tab === 0 ? 'active' : '') + '" onclick="showCareerStats(0)">📊 生涯数据</button>';
  html += '<button class="' + (tab === 1 ? 'active' : '') + '" onclick="showCareerStats(1)">🏆 荣誉墙</button>';
  html += '<button class="' + (tab === 2 ? 'active' : '') + '" onclick="showCareerStats(2)">📖 休赛期</button>';
  html += '</div>';

  if (tab === 0) {
    html += renderCareerStatsTab();
  } else if (tab === 1) {
    html += renderCareerHonorsTab();
  } else {
    html += renderOffseasonHistoryTab();
  }

  html += '<div style="display:flex;flex-direction:column;gap:6px;align-items:center;margin-top:6px;">';
  if (STATE.career && STATE.career.retired) {
    html += '<div style="text-align:center;font-size:12px;color:var(--text-dim);padding:4px 0;">🏁 生涯已结束，感谢你带来的每一个赛季</div>';
    html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
    if (!(STATE.career.flags && STATE.career.flags.postCareerDone)) {
      html += '<button class="btn btn-primary btn-sm" onclick="startPostCareerFlow()">🏁 继续退役后篇章</button>';
    }
    html += '<button class="btn btn-secondary btn-sm" onclick="exitToHomepage()">🚪 回到主页</button>';
    html += '</div>';
  } else {
    html += '<button class="btn btn-primary btn-sm" onclick="showScreen(\'screen-mycard\')">📋 返回休赛期面板</button>';
  }
  html += '</div>';

  document.getElementById('career-stats-content').innerHTML = html;
}

function exitToHomepage() {
  initGame();
}

function renderCareerStatsTab() {
  var c = STATE.career;
  var ps = c.totalStats;
  var gp = ps.games || 1;
  var avg = {
    pts: Math.round(ps.pts / gp * 10) / 10,
    reb: Math.round(ps.reb / gp * 10) / 10,
    ast: Math.round(ps.ast / gp * 10) / 10,
    stl: Math.round(ps.stl / gp),
    blk: Math.round(ps.blk / gp),
    tov: Math.round(ps.tov / gp * 10) / 10,
    fgm: Math.round(ps.fgm / gp * 10) / 10,
    fga: Math.round(ps.fga / gp * 10) / 10,
    ftm: Math.round(ps.ftm / gp * 10) / 10,
    fta: Math.round(ps.fta / gp * 10) / 10,
    threeM: Math.round(ps.threeM / gp * 10) / 10,
    threeA: Math.round(ps.threeA / gp * 10) / 10,
  };
  var pct = avg.fga > 0 ? (avg.fgm / avg.fga * 100).toFixed(1) : '—';
  var threePct = avg.threeA > 0 ? (avg.threeM / avg.threeA * 100).toFixed(1) : '—';
  var ftPct = avg.fta > 0 ? (avg.ftm / avg.fta * 100).toFixed(1) : '—';
  var h = '';
  h += '<div class="sr-section cs-section">';
  h += '<div class="sr-section-title">📊 生涯累计</div>';
  h += '<div class="cs-grid">';
  var cStats = [
    { val: ps.pts, lbl: '总得分' }, { val: ps.reb, lbl: '总篮板' }, { val: ps.ast, lbl: '总助攻' },
    { val: Math.round(ps.stl), lbl: '总抢断' }, { val: Math.round(ps.blk), lbl: '总盖帽' }, { val: ps.games, lbl: '出场数' },
  ];
  cStats.forEach(function(s) {
    h += '<div class="cs-stat"><div class="cs-stat-val">' + s.val + '</div><div class="cs-stat-lbl">' + s.lbl + '</div></div>';
  });
  h += '</div></div>';
  h += '<div class="sr-section cs-section">';
  h += '<div class="sr-section-title">📈 生涯场均</div>';
  h += '<div class="cs-grid">';
  var aStats = [
    { val: avg.pts, lbl: '得分' }, { val: avg.reb, lbl: '篮板' }, { val: avg.ast, lbl: '助攻' },
    { val: avg.stl, lbl: '抢断' }, { val: avg.blk, lbl: '盖帽' }, { val: avg.tov, lbl: '失误' },
  ];
  aStats.forEach(function(s) {
    h += '<div class="cs-stat"><div class="cs-stat-val">' + s.val + '</div><div class="cs-stat-lbl">' + s.lbl + '</div></div>';
  });
  h += '</div>';
  h += '<div class="sr-pct-line">命中率 ' + avg.fgm + '-' + avg.fga + ' (' + pct + '%) · 三分 ' + avg.threeM + '-' + avg.threeA + ' (' + threePct + '%) · 罚球 ' + avg.ftm + '-' + avg.fta + ' (' + ftPct + '%)</div>';
  h += '</div>';
  h += '<div class="sr-section cs-section">';
  h += '<div class="sr-section-title">📋 每赛季</div>';
  if (c.seasons.length === 0) {
    h += '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">暂无赛季数据</div>';
  } else {
    for (var i = c.seasons.length - 1; i >= 0; i--) {
      var s = c.seasons[i];
      var sp = s.playerStats || {};
      var sg = sp.games || 1;
      var sa = Math.round((sp.pts || 0) / sg * 10) / 10;
      var tn = getTeamName ? getTeamName(s.team) : s.team;
      var record = (s.wins || 0) + '-' + (s.losses || 0);
      h += '<div class="cs-season-row" onclick="showSeasonDetail(' + i + ')">';
      h += '<span class="cs-season-num">' + getSeasonLabel(s.seasonNum) + '</span>';
      h += '<span class="cs-season-team">' + tn + '</span>';
      h += '<span class="cs-season-record">' + record + '</span>';
      h += '<span class="cs-season-pts">' + sa + '分</span>';
      h += '<span class="cs-season-arrow">›</span>';
      h += '</div>';
    }
  }
  h += '</div>';
  return h;
}

function isRookieHonorForLaterSeason(h) {
  var label = (h && h.label) || '';
  return label.indexOf('最佳新秀') >= 0 && (parseInt(h.seasonNum, 10) || 0) !== 1;
}

function renderHonorBadge(label, emoji, cls) {
  label = label || '';
  emoji = emoji || '';
  var prefix = (emoji && label.indexOf(emoji) !== 0) ? emoji + ' ' : '';
  return '<span class="' + (cls || '') + '">' + prefix + label + '</span>';
}

function renderCareerHonorsTab() {
  var c = STATE.career;
  var h = '';
  if (c.seasons.length === 0) {
    h += '<div class="ch-empty">🏀 还没有荣誉，快去打比赛吧</div>';
  } else {
    for (var i = c.seasons.length - 1; i >= 0; i--) {
      var s = c.seasons[i];
      var tn = getTeamName ? getTeamName(s.team) : s.team;
      var seasHonors = c.honors.filter(function(hh) { return hh.seasonNum === s.seasonNum && !isRookieHonorForLaterSeason(hh); });
      h += '<div class="ch-season">';
      h += '<div class="ch-season-header">🏀 ' + getSeasonLabel(s.seasonNum) + ' <span class="ch-team">' + tn + '</span></div>';
      if (seasHonors.length === 0) {
        h += '<div style="font-size:12px;color:var(--text-muted);">暂无荣誉</div>';
      } else {
        seasHonors.forEach(function(hh) {
          var cls = 'ch-badge';
          if (hh.label.indexOf('总冠军') >= 0 || hh.label.indexOf('MVP') >= 0 || hh.label.indexOf('FMVP') >= 0) cls += ' gold';
          h += renderHonorBadge(hh.label, hh.emoji, cls);
        });
      }
      h += '</div>';
    }
  }
  var counts = {};
  c.honors.forEach(function(hh) {
    if (isRookieHonorForLaterSeason(hh)) return;
    counts[hh.label] = (counts[hh.label] || 0) + 1;
  });
  var sumParts = [];
  for (var k in counts) {
    sumParts.push(counts[k] + '×' + k);
  }
  if (sumParts.length > 0) {
    h += '<div class="ch-summary">📊 生涯总计：' + sumParts.join(' · ') + '</div>';
  }
  return h;
}

function renderOffseasonHistoryTab() {
  var c = STATE.career;
  var list = (c.offseasonHistory || []).slice().reverse();
  var h = '';
  if (list.length === 0) {
    h += '<div class="ch-empty">📖 还没有休赛期故事</div>';
    return h;
  }
  h += '<div class="sr-section cs-section">';
  h += '<div class="sr-section-title">📖 休赛期纪事</div>';
  list.forEach(function(item) {
    h += '<div class="ch-season">';
    h += '<div class="ch-season-header">' + getSeasonLabel((item.seasonNum || 1) + 1) + ' 夏天 <span class="ch-team">' + (item.event || '') + '</span></div>';
    h += '<div style="font-size:12px;color:var(--orange);font-weight:700;margin-bottom:5px;">选择：' + (item.choice || '') + '</div>';
    h += '<div style="font-size:12px;color:var(--text-dim);line-height:1.6;">' + (item.result || '').replace(/<br><br>/g, '<br>') + '</div>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

function saveCurrentSeasonToCareer() {
  var c = STATE.career;
  if (!STATE.season || !STATE.season.playerStats) return;
  if (STATE._careerSaved) return;
  if (STATE.season.schedule && STATE.season.schedule.some(function(g) { return !g.simulated; })) return;
  // 季后赛没打完不允许提前存赛季，否则总冠军荣誉会丢失或错位
  if (STATE.season.isPlayoffs && !STATE.season.playoffsDone) return;

  var sp = STATE.season.playerStats || {};
  var awards = STATE.season.awards || [];
  var honorList = [];
  awards.forEach(function(a) {
    if (typeof a === 'string') {
      // 字符串类奖项：属于玩家
      var l = a;
      if (!l) return;
      if (c.seasonCount > 0 && l.indexOf('最佳新秀') >= 0) return;
      var emoji = '🏅';
      if (l.indexOf('总冠军') >= 0) emoji = '🏆';
      else if (l.indexOf('MVP') >= 0 || l.indexOf('FMVP') >= 0) emoji = '👑';
      else if (l.indexOf('DPOY') >= 0) emoji = '🔒';
      else if (l.indexOf('全明星') >= 0) emoji = '⭐';
      else if (l.indexOf('得分王') >= 0 || l.indexOf('篮板王') >= 0 || l.indexOf('助攻王') >= 0 || l.indexOf('抢断王') >= 0 || l.indexOf('盖帽王') >= 0) emoji = '📊';
      else if (l.indexOf('最佳防守') >= 0) emoji = '🛡️';
      else if (l.indexOf('最佳阵容') >= 0) emoji = '🌟';
      else if (l.indexOf('最佳新秀') >= 0) emoji = '🌱';
      honorList.push({ seasonNum: c.seasonCount + 1, label: l, emoji: emoji });
    } else if (a.isUser) {
      // 结构化奖项：只取 isUser 为 true 的
      var l = a.label || '';
      if (!l) return;
      if (c.seasonCount > 0 && l.indexOf('最佳新秀') >= 0) return;
      var emoji = '🏅';
      if (l.indexOf('总冠军') >= 0) emoji = '🏆';
      else if (l.indexOf('MVP') >= 0 || l.indexOf('FMVP') >= 0) emoji = '👑';
      else if (l.indexOf('DPOY') >= 0) emoji = '🔒';
      else if (l.indexOf('全明星') >= 0) emoji = '⭐';
      else if (l.indexOf('得分王') >= 0 || l.indexOf('篮板王') >= 0 || l.indexOf('助攻王') >= 0 || l.indexOf('抢断王') >= 0 || l.indexOf('盖帽王') >= 0) emoji = '📊';
      else if (l.indexOf('最佳防守') >= 0) emoji = '🛡️';
      else if (l.indexOf('最佳阵容') >= 0) emoji = '🌟';
      else if (l.indexOf('最佳新秀') >= 0) emoji = '🌱';
      honorList.push({ seasonNum: c.seasonCount + 1, label: l, emoji: emoji });
    }
  });

  var playoffResult = '';
  if (STATE.season.playoffBracket && STATE.season.playoffBracket.results) {
    var myResults = STATE.season.playoffBracket.results.filter(function(r) { return r.isMySeries; });
    if (myResults.length > 0) {
      var last = myResults[myResults.length - 1];
      var rn = ['首轮','分区半决赛','分区决赛','总决赛'][last.round] || '';
      var userWon = last.teamA === STATE.careerTeam ? last.aWon : !last.aWon;
      playoffResult = rn + (last.round === 3 && userWon ? '·总冠军' : '');
    }
  }

  c.seasonCount++;
  if (typeof updateSeasonBadge === 'function') updateSeasonBadge();
  var seasonRecord = {
    seasonNum: c.seasonCount, team: STATE.careerTeam, ovr: STATE.finalOVR,
    wins: STATE.season.wins || 0, losses: STATE.season.losses || 0,
    playerStats: JSON.parse(JSON.stringify(sp)),
    playoffResult: playoffResult || (STATE.season.playoffBracket ? '季后赛' : '未晋级'),
    awards: honorList,
  };
  c.seasons.push(seasonRecord);
  c.lastCompletedSeasonSnapshot = JSON.parse(JSON.stringify(seasonRecord));

  var ts = c.totalStats;
  ['pts','reb','ast','stl','blk','tov','fgm','fga','ftm','fta','threeM','threeA','mins'].forEach(function(f) {
    ts[f] = (ts[f] || 0) + (sp[f] || 0);
  });
  ts.games = (ts.games || 0) + (sp.games || 0);

  var po = STATE.season.playoffStats || {};
  var cpo = c.playoffStats;
  ['pts','reb','ast','stl','blk','tov','fgm','fga','ftm','fta','threeM','threeA','mins'].forEach(function(f) {
    cpo[f] = (cpo[f] || 0) + (po[f] || 0);
  });
  cpo.games = (cpo.games || 0) + (po.games || 0);

  honorList.forEach(function(h) { c.honors.push(h); });
  STATE._careerSaved = true;
}

function showSeasonDetail(idx) {
  var s = STATE.career.seasons[idx];
  if (!s) return;
  var sp = s.playerStats || {};
  var sg = sp.games || 1;
  var avg = {
    pts: Math.round((sp.pts || 0) / sg * 10) / 10,
    reb: Math.round((sp.reb || 0) / sg * 10) / 10,
    ast: Math.round((sp.ast || 0) / sg * 10) / 10,
    stl: Math.round((sp.stl || 0) / sg),
    blk: Math.round((sp.blk || 0) / sg),
  };
  var tn = getTeamName ? getTeamName(s.team) : s.team;
  var record = (s.wins || 0) + '-' + (s.losses || 0);
  var awardsHtml = '';
  if (s.awards && s.awards.length) {
    s.awards.forEach(function(a) {
      var label = (a && a.label) || a || '';
      if ((parseInt(s.seasonNum, 10) || 0) !== 1 && label.indexOf('最佳新秀') >= 0) return;
      awardsHtml += '<span class="ch-badge">' + label + '</span>';
    });
  }
  var ovr = s.ovr || '—';

  var html = '<div class="cs-season-detail-overlay" onclick="closeSeasonDetail(event)">';
  html += '<div class="cs-season-detail-modal">';
  html += '<div class="cs-detail-header"><span style="font-family:var(--font-display);font-size:16px;font-weight:700;">' + getSeasonLabel(s.seasonNum) + ' · ' + tn + '</span><button class="cs-detail-close" onclick="closeSeasonDetail()">✕</button></div>';
  html += '<div class="cs-detail-body">';
  html += '<div class="sr-info-row"><span>战绩</span><span>' + record + ' · OVR ' + ovr + '</span></div>';
  html += '<div class="sr-info-row"><span>场均</span><span style="font-weight:600;">' + avg.pts + '分 ' + avg.reb + '板 ' + avg.ast + '助 ' + avg.stl + '断 ' + avg.blk + '帽</span></div>';
  html += '<div style="margin:8px 0 4px;font-size:12px;color:var(--text-dim);">季后赛：' + (s.playoffResult || '未晋级') + '</div>';
  if (awardsHtml) {
    html += '<div style="margin-top:6px;">' + awardsHtml + '</div>';
  }
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeSeasonDetail(e) {
  if (e && e.target !== e.currentTarget) return;
  var el = document.querySelector('.cs-season-detail-overlay');
  if (el) el.remove();
}

// ==================== 荣誉墙 ====================
function showCareerHonors() {
  showScreen('screen-career-honors');
  var c = STATE.career;
  document.getElementById('career-honors-sub').textContent = '生涯共 ' + c.honors.length + ' 项荣誉 · ' + c.seasonCount + ' 个赛季';

  var html = '';
  if (c.seasons.length === 0) {
    html += '<div class="ch-empty">🏀 还没有荣誉，快去打比赛吧</div>';
  } else {
    for (var i = c.seasons.length - 1; i >= 0; i--) {
      var s = c.seasons[i];
      var tn = getTeamName ? getTeamName(s.team) : s.team;
      var seasHonors = c.honors.filter(function(h) { return h.seasonNum === s.seasonNum && !isRookieHonorForLaterSeason(h); });
      html += '<div class="ch-season">';
      html += '<div class="ch-season-header">🏀 ' + getSeasonLabel(s.seasonNum) + ' <span class="ch-team">' + tn + '</span></div>';
      if (seasHonors.length === 0) {
        html += '<div style="font-size:12px;color:var(--text-muted);">暂无荣誉</div>';
      } else {
        seasHonors.forEach(function(h) {
          var cls = 'ch-badge';
          if (h.label.indexOf('总冠军') >= 0 || h.label.indexOf('MVP') >= 0 || h.label.indexOf('FMVP') >= 0) cls += ' gold';
          html += renderHonorBadge(h.label, h.emoji, cls);
        });
      }
      html += '</div>';
    }
  }

  var counts = {};
  c.honors.forEach(function(h) {
    if (isRookieHonorForLaterSeason(h)) return;
    counts[h.label] = (counts[h.label] || 0) + 1;
  });
  var sumParts = [];
  for (var k in counts) {
    sumParts.push(counts[k] + '×' + k);
  }
  if (sumParts.length > 0) {
    html += '<div class="ch-summary">📊 生涯总计：' + sumParts.join(' · ') + '</div>';
  }

  html += '<div style="display:flex;gap:8px;justify-content:center;margin-top:6px;">';
  html += '<button class="btn btn-primary btn-sm" onclick="showCareerStats()">📊 生涯数据</button>';
  html += '<button class="btn btn-secondary btn-sm" onclick="showScreen(\'screen-mycard\')">📋 My Card</button>';
  html += '</div>';

  document.getElementById('career-honors-content').innerHTML = html;
}

// ==================== 训练营 ====================
function clampAttrVal(v) {
  return Math.max(25, Math.min(99, Math.round(v)));
}

function addAttrDelta(key, delta) {
  if (!ATTR_KEYS.includes(key)) return;
  STATE.attrs[key] = clampAttrVal((STATE.attrs[key] || 50) + delta);
}

function applyAnnualAttributeDrift() {
  var c = STATE.career;
  if (!c) return [];
  var seasonKey = c.seasonCount || 0;
  if (c.annualChangeSeason === seasonKey) return c.lastAnnualChanges || [];
  var age = c.currentAge || 22;
  var changes = [];
  var fastDecline = ['ATH', 'DNK', 'PDEF', 'BLK', 'IDEF', 'REB'];
  var midDecline = ['FIN', 'STR'];
  var slowTech = ['threePT', 'MID', 'HAN', 'PAS', 'CLU'];

  function applyList(list, minDelta, maxDelta, label) {
    list.forEach(function(k) {
      var delta = minDelta + Math.floor(Math.random() * (maxDelta - minDelta + 1));
      if (delta !== 0) {
        addAttrDelta(k, delta);
        changes.push((delta > 0 ? '+' : '') + delta + ' ' + attrCN(k) + (label ? '（' + label + '）' : ''));
      }
    });
  }

  if (age <= 25) {
    applyList(slowTech.concat(['FIN', 'ATH']), 0, 1, '成长');
  } else if (age <= 30) {
    ATTR_KEYS.forEach(function(k) {
      if (Math.random() < 0.3) {
        var d = Math.random() < 0.45 ? 1 : -1;
        addAttrDelta(k, d);
        changes.push((d > 0 ? '+' : '') + d + ' ' + attrCN(k) + '（状态波动）');
      }
    });
  } else if (age <= 33) {
    applyList(fastDecline, -2, -1, '明显下滑');
    applyList(slowTech, 0, 0, '技术维持');
  } else if (age <= 36) {
    applyList(fastDecline, -4, -3, '年龄下滑');
    applyList(midDecline, -3, -2, '年龄影响');
    applyList(slowTech, -3, -2, '技术衰减');
  } else if (age <= 39) {
    applyList(fastDecline, -6, -4, '老将下滑');
    applyList(midDecline, -5, -3, '老将下滑');
    applyList(slowTech, -5, -3, '老将下滑');
  } else {
    applyList(fastDecline, -8, -6, '生涯末期');
    applyList(midDecline, -7, -5, '生涯末期');
    applyList(slowTech, -6, -4, '生涯末期');
  }

  STATE.finalOVR = calcOVR(STATE.attrs);
  c.annualChangeSeason = seasonKey;
  c.lastAnnualChanges = changes;
  return changes;
}

function beginOffseason() {
  if (STATE.career && STATE.career.retired) {
    showCareerStats(1);
    return;
  }
  saveCurrentSeasonToCareer();
  if (STATE.career && STATE.career.flags && (STATE.career.flags.countdownDone || STATE.career.flags.playOneMore)) {
    showPlayerRetirementChoice();
    return;
  }
  var cdNode = getBranchNode('retirement_countdown');
  if (cdNode === 'final_show' || cdNode === 'final_pass' || cdNode === 'final_enjoy' || cdNode === 'final_hurt') {
    startCountdownLegacyFlow();
    return;
  }
  applyAnnualAttributeDrift();
  var c = STATE.career;
  c.flags = c.flags || {};
  c.relationships = c.relationships || {};
  c.branchHistory = c.branchHistory || [];
  c.branches = c.branches || {};
  var seasonKey = c.seasonCount || 0;
  if (c.offseasonEventSeason === seasonKey) {
    renderTrainingCamp();
    return;
  }
  c.offseasonEventSeason = seasonKey;
  STATE._offseasonQueue = buildBranchEventQueue('offseason');
  STATE._offseasonEventIdx = 0;
  showNextOffseasonEvent();
}

function buildOffseasonEventQueue() {
  return buildBranchEventQueue('offseason');
}

function getBranchEventSource() {
  return (typeof STAGED_BRANCH_EVENTS !== 'undefined') ? STAGED_BRANCH_EVENTS : BRANCH_EVENTS;
}

function getEventPhases(ev) {
  return ev.phases || [ev.phase || 'offseason'];
}

var DAG_PENDING_WEIGHT_BOOST = 40;

function isDagEventPending(ev) {
  if (!ev || !ev.branch || typeof ev.requires !== 'function') return false;
  var node = getBranchNode(ev.branch);
  if (!node || node === 'start') return false;
  try {
    return !!ev.requires();
  } catch(e) {
    return false;
  }
}

function getBranchEventWeight(ev) {
  var base = ev.weight || 10;
  return isDagEventPending(ev) ? base + DAG_PENDING_WEIGHT_BOOST : base;
}

function buildBranchEventQueue(phase, maxCount) {
  var source = getBranchEventSource();
  var pool = source.filter(function(ev) {
    return getEventPhases(ev).indexOf(phase) >= 0 && (!ev.requires || ev.requires());
  });
  if (phase === 'offseason') {
    return buildOffseasonBranchQueue(pool);
  }
  var queue = [];
  while (pool.length && queue.length < (maxCount || 1)) {
    var total = pool.reduce(function(sum, ev) { return sum + getBranchEventWeight(ev); }, 0);
    var roll = Math.random() * total;
    var pickedIdx = 0;
    for (var i = 0; i < pool.length; i++) {
      roll -= getBranchEventWeight(pool[i]);
      if (roll <= 0) { pickedIdx = i; break; }
    }
    queue.push(pool.splice(pickedIdx, 1)[0]);
  }
  return queue;
}

var OFFSEASON_MAX_MAIN_EVENTS = 2;
var OFFSEASON_MAX_TRAINING_EVENTS = 2;

function pickBranchEvents(pool, preferOngoing, count) {
  var picked = [];
  var remaining = (pool || []).slice();
  var usedBranches = {};
  while (remaining.length && picked.length < (count || 1)) {
    var candidates = remaining.filter(function(ev) { return !usedBranches[ev.branch]; });
    if (!candidates.length) break;
    var ev = pickBranchEvent(candidates, preferOngoing);
    if (!ev) break;
    picked.push(ev);
    usedBranches[ev.branch] = true;
    remaining.splice(remaining.indexOf(ev), 1);
  }
  return picked;
}

function buildOffseasonBranchQueue(pool) {
  var mainPool = pool.filter(function(ev) { return (ev.slot || 'main') === 'main'; });
  var trainingPool = pool.filter(function(ev) { return (ev.slot || 'main') === 'training'; });
  var queue = [];
  var relationshipForced = false;
  var relationshipStepForced = false;
  var countdownPool = mainPool.filter(function(ev) { return ev.branch === 'retirement_countdown'; });
  if (countdownPool.length > 0) {
    var forced = pickBranchEvent(countdownPool, true);
    if (forced) queue.push(forced);
  }
  // 恋爱兜底：前两个夏天未触发，第三个夏天必触发
  if (getBranchNode('relationship') === 'start' && (STATE.career.seasonCount || 0) >= 3) {
    var firstDate = mainPool.filter(function(ev) { return ev.id === 'relationship_first_date'; })[0];
    if (firstDate && (!firstDate.requires || firstDate.requires())) {
      queue.push(firstDate);
      relationshipForced = true;
    }
  }
  // 恋爱线一旦开启，每年休赛期都强制推进一个下个节点
  if (getBranchNode('relationship') !== 'start') {
    var relPool = mainPool.filter(function(ev) {
      return ev.branch === 'relationship' && (!ev.requires || ev.requires());
    });
    if (relPool.length > 0) {
      var relStep = pickBranchEvent(relPool, true);
      if (relStep) {
        queue.push(relStep);
        relationshipStepForced = true;
      }
    }
  }
  // 揽佬《中国人能飞》支线：一旦开启，每年夏天强制推进下一节点
  var crossoverStepForced = false;
  if (getBranchNode('crossover') !== 'start') {
    var crPool = mainPool.filter(function(ev) {
      return ev.branch === 'crossover' && (!ev.requires || ev.requires());
    });
    if (crPool.length > 0) {
      var crStep = pickBranchEvent(crPool, true);
      if (crStep) {
        queue.push(crStep);
        crossoverStepForced = true;
      }
    }
  }
  var forcedMainCount = (relationshipForced ? 1 : 0) + (relationshipStepForced ? 1 : 0) + (crossoverStepForced ? 1 : 0);
  var restMain = mainPool.filter(function(ev) {
    if (ev.branch === 'retirement_countdown') return false;
    if (relationshipForced && ev.id === 'relationship_first_date') return false;
    if (relationshipStepForced && ev.branch === 'relationship') return false;
    if (crossoverStepForced && ev.branch === 'crossover') return false;
    return true;
  });
  return queue
    .concat(pickBranchEvents(restMain, false, Math.max(0, OFFSEASON_MAX_MAIN_EVENTS - forcedMainCount)))
    .concat(pickBranchEvents(trainingPool, false, OFFSEASON_MAX_TRAINING_EVENTS));
}

function pickBranchEvent(pool, preferOngoing) {
  if (!pool || pool.length === 0) return null;
  var candidates = pool;
  if (preferOngoing) {
    var ongoing = pool.filter(function(ev) { return isBranchOngoing(ev.branch); });
    if (ongoing.length > 0) candidates = ongoing;
  }
  var total = candidates.reduce(function(sum, ev) { return sum + getBranchEventWeight(ev); }, 0);
  var roll = Math.random() * total;
  for (var i = 0; i < candidates.length; i++) {
    roll -= getBranchEventWeight(candidates[i]);
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function getBranchState(branchId) {
  var c = STATE.career;
  c.branches = c.branches || {};
  if (!c.branches[branchId]) c.branches[branchId] = { stage: 0, points: 0 };
  var b = c.branches[branchId];
  if (branchId === 'relationship' && !b.node && (b.stage || 0) > 0) {
    if (b.stage === 1) b.node = b.status === 'declined' ? 'declined' : 'dating';
    else if (b.stage === 2) b.node = b.status === 'volatile' ? 'volatile' : 'stable';
    else if (b.stage === 3) b.node = b.status === 'crisis' ? 'crisis' : (b.status === 'public' ? 'public' : 'private');
  }
  if (branchId === 'family' && !b.node && (b.stage || 0) > 0) {
    b.node = b.status === 'delayed' ? 'career_priority' : 'family_plan';
  }
  if (branchId === 'china_market' && !b.node && (b.stage || 0) > 0) {
    b.node = b.status === 'grassroots' ? 'market_grassroots' : 'market_tour';
  }
  if (branchId === 'network' && !b.node && (b.stage || 0) > 0) {
    if (b.stage === 1) b.node = b.status === 'training' ? 'training_focus' : 'golf_meet';
    else if (b.stage === 2) b.node = b.status === 'private_circle' ? 'private_circle' : 'career_map_meeting';
    else if (b.stage === 3) b.node = b.identity === 'training_resource' ? 'training_resource' : 'business_circle';
  }
  if (branchId === 'rich_paul' && !b.node && (b.stage || 0) > 0) {
    b.node = b.status === 'stable_team' ? 'rich_paul_stable' : 'rich_paul_mapped';
  }
  if (branchId === 'team_practice' && !b.node && (b.stage || 0) > 0) {
    if (b.stage === 1) b.node = 'practice_start';
    else if (b.stage === 2) b.node = 'practice_response';
    else if (b.stage === 3) b.node = 'practice_identity';
  }
  if (branchId === 'teammate_bond' && !b.node && (b.stage || 0) > 0) {
    b.node = b.status === 'protected' ? 'bond_protected' : 'bond_extra';
  }
  if (branchId === 'mentor' && !b.node && (b.stage || 0) > 0) {
    var tb = getBranchState('training');
    if (!tb.node || tb.node === 'start') tb.node = b.stage === 1 ? 'mentor_first' : (b.stage === 2 ? 'mentor_deep' : 'training_identity');
  }
  if (branchId === 'skill_training' && !b.node && (b.stage || 0) > 0) {
    var tb2 = getBranchState('training');
    if (!tb2.node || tb2.node === 'start') tb2.node = b.stage === 1 ? 'skill_first' : (b.stage === 2 ? 'skill_deep' : 'training_identity');
  }
  return b;
}

function getCareerProfile() {
  var c = STATE.career;
  c.profile = c.profile || {};
  var defaults = { fame: 0, businessValue: 0, mediaTrust: 0, controversy: 0, chinaPopularity: 0, loyalty: 0, leadership: 0, coachTrust: 0, lockerRoomTrust: 0, fanSupport: 0, legacyBonus: 0 };
  Object.keys(defaults).forEach(function(k) {
    if (c.profile[k] == null) c.profile[k] = defaults[k];
  });
  return c.profile;
}

function addProfileDelta(key, delta) {
  var p = getCareerProfile();
  p[key] = Math.max(-20, Math.min(99, (p[key] || 0) + (delta || 0)));
  return p[key];
}

function addSeasonMod(key, delta, minVal, maxVal) {
  var mods = getNextSeasonMods();
  if (mods[key] == null) mods[key] = 0;
  var min = minVal == null ? -10 : minVal;
  var max = maxVal == null ? 10 : maxVal;
  mods[key] = Math.max(min, Math.min(max, mods[key] + (delta || 0)));
  return mods[key];
}

function getBranchStage(branchId) {
  return getBranchState(branchId).stage || 0;
}

function getBranchNode(branchId) {
  var b = getBranchState(branchId);
  return b.node || 'start';
}

function isBranchOngoing(branchId) {
  if (!branchId || !STATE.career || !STATE.career.branches) return false;
  var b = STATE.career.branches[branchId];
  return !!(b && (b.stage > 0 || b.status || (b.node && b.node !== 'start')));
}

function bindBondedTeammate() {
  if (!STATE.career || !STATE.careerTeam || !NBA2K_DATA) return null;
  var roster = NBA2K_DATA[STATE.careerTeam] || [];
  var candidates = roster.filter(function(p) { return p && !p._isUser; });
  if (!candidates.length) return null;
  var pick = candidates[Math.floor(Math.random() * candidates.length)];
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.bondedTeammate = {
    name: pick.name,
    cname: pick.cname || pick.name,
    pos: pick.pos,
    ovr: pick.ovr,
    team: STATE.careerTeam,
    sinceSeason: STATE.career.seasonCount
  };
  return STATE.career.flags.bondedTeammate;
}

function getBondedTeammateStatus() {
  var t = STATE.career && STATE.career.flags && STATE.career.flags.bondedTeammate;
  if (!t || !t.name) return null;
  var found = null;
  NBA2K_TEAMS.forEach(function(team) {
    if (found) return;
    (NBA2K_DATA[team] || []).forEach(function(p) {
      if (p && p.name === t.name) found = team;
    });
  });
  if (!found) return 'retired_released';
  return found === STATE.careerTeam ? 'same_team' : 'traded';
}

function getBondedTeammateName() {
  var t = STATE.career && STATE.career.flags && STATE.career.flags.bondedTeammate;
  return (t && (t.cname || t.name)) || '那位队友';
}

function fillBranchEventText(str) {
  var flags = STATE.career && STATE.career.flags ? STATE.career.flags : {};
  var recruiter = flags.superstarRecruiterName || '那位巨星';
  var recruitTeam = flags.superstarRecruitTargetTeam ? (getTeamName ? getTeamName(flags.superstarRecruitTargetTeam) : flags.superstarRecruitTargetTeam) : '他的球队';
  return String(str || '')
    .replace(/\{队友\}/g, getBondedTeammateName())
    .replace(/\{招募者\}/g, recruiter)
    .replace(/\{招募球队\}/g, recruitTeam);
}

function getSuperstarRecruitPool() {
  return [
    { aliases: ['卢卡·东契奇','卢卡-东契奇','Luka Dončić','Luka Doncic'], weight: 2 },
    { aliases: ['扬尼斯·阿德托昆博','扬尼斯-阿德托昆博','Giannis Antetokounmpo'], weight: 2 },
    { aliases: ['谢伊·吉尔杰斯-亚历山大','谢伊-吉尔杰斯-亚历山大','Shai Gilgeous-Alexander'], weight: 2 },
    { aliases: ['杰森·塔图姆','杰森-塔图姆','Jayson Tatum'], weight: 1.6 },
    { aliases: ['安东尼·爱德华兹','安东尼-爱德华兹','Anthony Edwards'], weight: 1.8 },
    { aliases: ['维克托·文班亚马','维克托-文班亚马','Victor Wembanyama'], weight: 6 }
  ];
}

function getSuperstarRecruitMatch(cn, en) {
  var pool = getSuperstarRecruitPool();
  for (var i = 0; i < pool.length; i++) {
    var aliases = pool[i].aliases || [];
    if (aliases.indexOf(cn) >= 0 || aliases.indexOf(en) >= 0) return pool[i];
  }
  return null;
}

function pickWeightedRecruitCandidate(candidates) {
  var total = candidates.reduce(function(sum, c) {
    var ovrBonus = 1 + Math.max(0, (c.ovr || 0) - 88) * 0.04;
    return sum + (c.recruitWeight || 1) * ovrBonus;
  }, 0);
  if (total <= 0) return candidates[0] || null;
  var roll = Math.random() * total;
  for (var i = 0; i < candidates.length; i++) {
    var weight = (candidates[i].recruitWeight || 1) * (1 + Math.max(0, (candidates[i].ovr || 0) - 88) * 0.04);
    roll -= weight;
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1] || null;
}

function findRecruitingSuperstar() {
  if (!NBA2K_TEAMS || !NBA2K_DATA) return null;
  var candidates = [];
  NBA2K_TEAMS.forEach(function(t) {
    if (t === STATE.careerTeam) return;
    var roster = NBA2K_DATA[t] || [];
    roster.forEach(function(p) {
      var cn = p.cname || p.name || '';
      var en = p.name || '';
      var match = getSuperstarRecruitMatch(cn, en);
      if (!match) return;
      var ovr = parseInt(p.ovr) || 0;
      if (ovr < 88) return;
      candidates.push({ name: cn, nameEN: p.name || '', team: t, ovr: ovr, recruitWeight: match.weight || 1 });
    });
  });
  if (!candidates.length) return null;
  return pickWeightedRecruitCandidate(candidates);
}

function prepareSuperstarRecruitment() {
  var c = STATE.career;
  if (!c) return null;
  c.flags = c.flags || {};
  if (c.flags.superstarRecruiterName && c.flags.superstarRecruitTargetTeam) {
    return { name: c.flags.superstarRecruiterName, team: c.flags.superstarRecruitTargetTeam };
  }
  var star = findRecruitingSuperstar();
  if (!star) return null;
  c.flags.superstarRecruiterName = star.name;
  c.flags.superstarRecruiterEN = star.nameEN || '';
  c.flags.superstarRecruitTargetTeam = star.team;
  return star;
}

function getRelationshipPartnerType() {
  var p = STATE.career && STATE.career.relationships && STATE.career.relationships.partner;
  return (p && p.type) || 'actress';
}

function isBranchChoiceLocked(ch) {
  if (!ch || typeof ch.requires !== 'function') return false;
  try { return !ch.requires(); } catch(e) { return true; }
}

function applyChoiceBonus(ch, msg) {
  if (!ch || typeof ch.bonus !== 'function') return msg;
  var bonus = null;
  try { bonus = ch.bonus(); } catch(e) { return msg; }
  if (bonus && bonus.text) msg = (msg || '') + '<br><br>强化：' + bonus.text;
  return msg;
}

function getMentalPressure() {
  if (!STATE.career) return 0;
  var mods = getNextSeasonMods();
  var profile = STATE.career.profile || {};
  var rl = getBranchNode('relationship');
  var fm = getBranchNode('family');
  var md = getBranchNode('media');
  var fc = getBranchNode('fan_culture');
  var tp = getBranchNode('team_practice');
  var score = 0;
  score += (mods.mediaPressure || 0) * 1.5;
  score += (profile.controversy || 0);
  score += (mods.formVariance || 0) * 1.5;
  score += (mods.injuryRiskBonus || 0);
  if (rl === 'hurt_scar' || rl === 'hurt_guard' || rl === 'hurt_moved_on') score += 6;
  if (fm === 'family_regret' || fm === 'family_pressure') score += 4;
  if (md === 'persona_controversial') score += 4;
  if (fc === 'fan_controversial') score += 4;
  if (tp === 'practice_identity' && getBranchState('team_practice').identity === 'locker_room_leader') score += 2;
  return score;
}

function isCityTransfer() {
  var city = getBranchState('city_culture');
  if (!city.team || !STATE.careerTeam) return false;
  var node = getBranchNode('city_culture');
  if (node === 'start') return false;
  return city.team !== STATE.careerTeam;
}

function advanceBranch(branchId, delta, data) {
  var b = getBranchState(branchId);
  b.stage = Math.max(0, (b.stage || 0) + (delta || 1));
  if (data) {
    Object.keys(data).forEach(function(k) { b[k] = data[k]; });
  }
  return b;
}

function setBranchStage(branchId, stage, data) {
  var b = getBranchState(branchId);
  b.stage = Math.max(0, stage || 0);
  if (data) {
    Object.keys(data).forEach(function(k) { b[k] = data[k]; });
  }
  return b;
}

function setBranchNode(branchId, node, data) {
  var b = getBranchState(branchId);
  b.node = node || 'start';
  if (data) {
    Object.keys(data).forEach(function(k) { b[k] = data[k]; });
  }
  return b;
}

function recordBranchChoice(ev, ch, msg, phase) {
  var c = STATE.career;
  var playerMsg = sanitizePlayerFacingText(msg);
  c.branchHistory = c.branchHistory || [];
  c.branchHistory.push({
    seasonNum: c.seasonCount,
    phase: phase || ev.phase || 'offseason',
    branch: ev.branch || ev.id,
    eventId: ev.id,
    event: getPlayerFacingBranchTitle(ev.title),
    choice: ch.label,
    result: playerMsg
  });
  if ((phase || ev.phase || 'offseason') === 'offseason') {
    c.offseasonHistory = c.offseasonHistory || [];
    c.offseasonHistory.push({ seasonNum: c.seasonCount, eventId: ev.id, event: getPlayerFacingBranchTitle(ev.title), choice: ch.label, result: playerMsg });
  }
}

function checkSeasonBranchEvent(game, result, stats) {
  if (!STATE.career || !STATE.season || STATE.season.isPlayoffs) return null;
  var c = STATE.career;
  c.branchHistory = c.branchHistory || [];
  c.branchSeasonEvents = c.branchSeasonEvents || {};
  var seasonKey = c.seasonCount || 0;
  if (c.branchSeasonEvents._season !== seasonKey) {
    c.branchSeasonEvents = { _season: seasonKey, _count: 0 };
  }
  // 退役倒计时：按赛程均等分布触发，赛季内独占
  var gamesPlayed = (STATE.season.games || []).length;
  var totalGames = (STATE.season.schedule || []).length;
  var countdownActive = getBranchNode('retirement_countdown') !== 'start';
  if (totalGames > 0 && gamesPlayed >= 1) {
    var countdownSteps = [
      { id: 'countdown_trigger', slot: 0 },
      { id: 'countdown_reflect', slot: 1 },
      { id: 'countdown_close', slot: 2 }
    ];
    var countdownPool = [];
    countdownSteps.forEach(function(st) {
      var ev = getBranchEventById(st.id);
      if (!ev) return;
      if (getEventPhases(ev).indexOf('season') < 0) return;
      try {
        if (ev.requires && !ev.requires({ game: game, result: result, stats: stats })) return;
      } catch(e) { return; }
      var target = 1 + Math.round((totalGames - 1) * (st.slot / 2));
      if (gamesPlayed >= target) countdownPool.push(ev);
    });
    if (countdownPool.length > 0) {
      var forced = pickBranchEvent(countdownPool, true);
      if (forced) {
        c._lastSeasonBranchGame = (STATE.season.games || []).length;
        return forced;
      }
    }
  }
  // 倒计时赛季不弹其它赛季事件
  if (countdownActive) return null;
  var sinceLast = null;
  if (c._lastSeasonBranchGame != null) {
    sinceLast = (STATE.season.games || []).length - c._lastSeasonBranchGame;
    if (sinceLast < 12) return null;
  }
  // 恋爱线一旦开启，每年赛季中都保证推进一次下个节点
  var romanceStepPool = [];
  if (!c.branchSeasonEvents.relationship && totalGames > 0) {
    romanceStepPool = getBranchEventSource().filter(function(ev) {
      if (ev.branch !== 'relationship') return false;
      if (getEventPhases(ev).indexOf('season') < 0) return false;
      return !ev.requires || ev.requires({ game: game, result: result, stats: stats });
    });
  }
  if (romanceStepPool.length > 0) {
    var romanceMinGame = Math.max(10, Math.round(totalGames * 0.25));
    if (gamesPlayed >= romanceMinGame && (sinceLast == null || sinceLast >= 10)) {
      var forcedRomance = pickBranchEvent(romanceStepPool, true);
      if (forcedRomance) {
        c._lastSeasonBranchGame = (STATE.season.games || []).length;
        c.branchSeasonEvents.relationship = true;
        c.branchSeasonEvents._count = (c.branchSeasonEvents._count || 0) + 1;
        return forcedRomance;
      }
    }
  }
  if (Math.random() * 100 >= 5) return null;
  var maxRandomEvents = romanceStepPool.length > 0 ? 1 : 2;
  if ((c.branchSeasonEvents._count || 0) >= maxRandomEvents) return null;
  var pool = getBranchEventSource().filter(function(ev) {
    if (getEventPhases(ev).indexOf('season') < 0) return false;
    if (c.branchSeasonEvents[ev.branch]) return false;
    return !ev.requires || ev.requires({ game: game, result: result, stats: stats });
  });
  if (pool.length === 0) return null;
  var picked = pickBranchEvent(pool, false);
  if (!picked) return null;
  c._lastSeasonBranchGame = (STATE.season.games || []).length;
  c.branchSeasonEvents[picked.branch] = true;
  c.branchSeasonEvents._count = (c.branchSeasonEvents._count || 0) + 1;
  return picked;
}

function showSeasonBranchEvent(ev, done) {
  if (!ev) return;
  STATE._seasonBranchEvent = ev;
  STATE._seasonBranchDone = typeof done === 'function' ? done : null;
  STATE._seasonBranchScenePage = 0;
  showSeasonBranchEventModal();
}

function showSeasonBranchEventModal() {
  var ev = STATE._seasonBranchEvent;
  if (!ev) return;
  var existing = document.getElementById('season-branch-modal');
  if (existing) existing.remove();
  var scenes = ev.scenes || [];
  var sceneIdx = STATE._seasonBranchScenePage || 0;
  var title = getPlayerFacingBranchTitle(ev.title);
  var html = '<div class="team-picker-overlay" id="season-branch-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  if (scenes.length && sceneIdx < scenes.length) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + fillBranchEventText(scenes[sceneIdx]) + '</div>';
    html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continueSeasonBranchScene()">继续</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    return;
  }
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.55;margin-bottom:12px;">' + sanitizePlayerFacingText(fillBranchEventText(ev.body)) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  ev.choices.forEach(function(ch, ci) {
    var locked = isBranchChoiceLocked(ch);
    var lockHint = locked ? (ch.lockHint || '需要其它线路结果') : '';
    var btnStyle = 'width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;' + (locked ? 'opacity:.45;cursor:not-allowed;' : '');
    var onclick = locked ? '' : 'onclick="chooseSeasonBranchEvent(' + ci + ')"';
    html += '<button class="btn btn-secondary btn-sm" style="' + btnStyle + '" ' + onclick + (locked ? ' disabled' : '') + '>' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(fillBranchEventText(locked ? lockHint : (ch.hint || ''))) + '</span></button>';
  });
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueSeasonBranchScene() {
  STATE._seasonBranchScenePage = (STATE._seasonBranchScenePage || 0) + 1;
  showSeasonBranchEventModal();
}

function chooseSeasonBranchEvent(choiceIdx) {
  var ev = STATE._seasonBranchEvent;
  if (!ev) return;
  var ch = ev.choices[choiceIdx];
  if (!ch || isBranchChoiceLocked(ch)) return;
  var msg = ch && ch.apply ? ch.apply() : '';
  msg = applyChoiceBonus(ch, msg);
  recordBranchChoice(ev, ch, msg, 'season');
  var modal = document.getElementById('season-branch-modal');
  if (modal) modal.remove();
  STATE._seasonBranchEvent = null;
  STATE._seasonBranchScenePage = 0;
  if (msg) showSeasonBranchResultModal(ev.title, msg);
  else finishSeasonBranchEvent();
}

function showSeasonBranchResultModal(title, msg) {
  var existing = document.getElementById('season-branch-result-modal');
  if (existing) existing.remove();
  var html = '<div class="team-picker-overlay" id="season-branch-result-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + getPlayerFacingBranchTitle(title) + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += formatBranchResultText(fillBranchEventText(msg));
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="finishSeasonBranchEvent()">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function finishSeasonBranchEvent() {
  var modal = document.getElementById('season-branch-result-modal');
  if (modal) modal.remove();
  var done = STATE._seasonBranchDone;
  STATE._seasonBranchDone = null;
  if (typeof done === 'function') done();
}

function showNextOffseasonEvent() {
  var queue = STATE._offseasonQueue || [];
  var idx = STATE._offseasonEventIdx || 0;
  if (idx >= queue.length) {
    renderTrainingCamp();
    return;
  }
  STATE._branchScenePage = 0;
  showOffseasonEventModal(queue[idx], idx + 1, queue.length);
}

function showOffseasonEventModal(ev, idx, total) {
  var existing = document.getElementById('offseason-event-modal');
  if (existing) existing.remove();
  var scenes = ev.scenes || [];
  var sceneIdx = STATE._branchScenePage || 0;
  var title = getPlayerFacingBranchTitle(ev.title);
  var html = '<div class="team-picker-overlay" id="offseason-event-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  if (scenes.length && sceneIdx < scenes.length) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + fillBranchEventText(scenes[sceneIdx]) + '</div>';
    html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continueOffseasonScene()">继续</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    return;
  }
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.55;margin-bottom:12px;">' + sanitizePlayerFacingText(fillBranchEventText(ev.body)) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  ev.choices.forEach(function(ch, ci) {
    var locked = isBranchChoiceLocked(ch);
    var lockHint = locked ? (ch.lockHint || '需要其它线路结果') : '';
    var btnStyle = 'width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;' + (locked ? 'opacity:.45;cursor:not-allowed;' : '');
    var onclick = locked ? '' : 'onclick="chooseOffseasonEvent(' + ci + ')"';
    html += '<button class="btn btn-secondary btn-sm" style="' + btnStyle + '" ' + onclick + (locked ? ' disabled' : '') + '>' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(fillBranchEventText(locked ? lockHint : (ch.hint || ''))) + '</span></button>';
  });
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueOffseasonScene() {
  var queue = STATE._offseasonQueue || [];
  var idx = STATE._offseasonEventIdx || 0;
  var ev = queue[idx];
  if (!ev) return;
  STATE._branchScenePage = (STATE._branchScenePage || 0) + 1;
  showOffseasonEventModal(ev, idx + 1, queue.length);
}

function chooseOffseasonEvent(choiceIdx) {
  var queue = STATE._offseasonQueue || [];
  var idx = STATE._offseasonEventIdx || 0;
  var ev = queue[idx];
  if (!ev) return;
  var ch = ev.choices[choiceIdx];
  if (!ch || isBranchChoiceLocked(ch)) return;
  var msg = ch && ch.apply ? ch.apply() : '';
  msg = applyChoiceBonus(ch, msg);
  msg = fillBranchEventText(msg);
  recordBranchChoice(ev, ch, msg, 'offseason');
  var modal = document.getElementById('offseason-event-modal');
  if (modal) modal.remove();
  STATE._branchScenePage = 0;
  STATE._offseasonEventIdx = idx + 1;
  if (msg) showOffseasonResultModal(ev.title, msg);
  else showNextOffseasonEvent();
}

function showOffseasonResultModal(title, msg, done) {
  var existing = document.getElementById('offseason-result-modal');
  if (existing) existing.remove();
  STATE._offseasonResultDone = typeof done === 'function' ? done : null;
  var html = '<div class="team-picker-overlay" id="offseason-result-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + getPlayerFacingBranchTitle(title) + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += formatBranchResultText(fillBranchEventText(msg));
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="' + (STATE._offseasonResultDone ? 'continueOffseasonResultWithCallback()' : 'continueOffseasonEvent()') + '">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueOffseasonResultWithCallback() {
  var modal = document.getElementById('offseason-result-modal');
  if (modal) modal.remove();
  var done = STATE._offseasonResultDone;
  STATE._offseasonResultDone = null;
  if (typeof done === 'function') done();
}

function getPlayerFacingBranchTitle(title) {
  return (title || '')
    .replace(/^恋爱线：/, '恋爱：')
    .replace(/^人脉线：/, '人脉：')
    .replace(/^导师线：/, '巨星导师：')
    .replace(/^专项线：/, '专项训练：')
    .replace(/^球队线：/, '球队合练：');
}

function restoreBranchKeptSegment(seg) {
  return (seg || '')
    .replace(/恋爱线进入长期稳定，家庭线解锁。/g, '这段关系进入长期稳定，家人也真正走进你的生活。')
    .replace(/恋爱线进入长期陪伴，家庭线解锁。/g, '这段关系进入长期陪伴，家人也真正走进你的生活。')
    .replace(/恋爱线/g, '恋爱')
    .replace(/人脉线/g, '人脉')
    .replace(/导师线/g, '巨星导师')
    .replace(/专项线/g, '专项训练')
    .replace(/球队线/g, '球队合练')
    .replace(/家庭线解锁。/g, '家人也真正走进你的生活。');
}

function sanitizePlayerFacingText(text) {
  if (!text) return '';
  var keptSegments = [];
  var s = String(text);
  // 重点/影响段落先整体保护，清理内部术语时不会误删玩家可见内容
  s = s.replace(/(?:额外)?(?:重点|影响)：[\s\S]*?(?=<br><br>|$)/g, function(m) {
    keptSegments.push(m);
    return '\u0001' + (keptSegments.length - 1) + '\u0002';
  });
  s = s
    .replace(/；中国男篮支线进入[^；。<]*/g, '')
    .replace(/；恋爱线[^；。<]*/g, '')
    .replace(/；人脉线[^；。<]*/g, '')
    .replace(/；导师线[^；。<]*/g, '')
    .replace(/；专项线[^；。<]*/g, '')
    .replace(/；球队线[^；。<]*/g, '')
    .replace(/；?获得“([^”]+)”(?:长期)?标签/g, '；人们开始用“$1”形容你')
    .replace(/；?记录 Rich Paul 接触/g, '')
    .replace(/；?记录库里圈子/g, '')
    .replace(/；?未来可联动[^；。<]*/g, '')
    .replace(/；?未来自由市场\/品牌线获得伏笔/g, '')
    .replace(/；?下次将进入[^；。<]*/g, '')
    .replace(/；?进入“[^”]+”阶段/g, '')
    .replace(/；?进入二阶段/g, '')
    .replace(/；?进入传承阶段/g, '')
    .replace(/；线进入[^；。<]*/g, '')
    .replace(/；线记录为[^；。<]*/g, '')
    .replace(/；?导师线完成/g, '')
    .replace(/；?专项线完成/g, '')
    .replace(/；?队史分倾向提升/g, '')
    .replace(/结果：恋爱线开启；/g, '结果：你开始了一段关系；')
    .replace(/结果：恋爱线结束；/g, '结果：这段关系结束了；')
    .replace(/开启恋爱线/g, '开始一段关系')
    .replace(/开启人脉线/g, '进入这个圈子')
    .replace(/开启领袖线/g, '承担更多队内责任')
    .replace(/开启长期专项训练线/g, '投入一个长期训练方向')
    .replace(/选择你希望留下的打法标签/g, '选择你希望稳定下来的打法方向')
    .replace(/选择你希望形成的长期打法标签/g, '选择你希望稳定下来的打法方向')
    .replace(/球队线收束。/g, '')
    .replace(/导师线收束。/g, '')
    .replace(/人脉线进入正式会面。/g, '')
    .replace(/恋爱线进入公开节点。/g, '')
    .replace(/专项线/g, '专项训练')
    .replace(/导师线/g, '巨星导师')
    .replace(/球队线/g, '球队合练')
    .replace(/恋爱线/g, '恋爱')
    .replace(/人脉线/g, '人脉')
    .replace(/支线/g, '')
    .replace(/标签/g, '印象')
    .replace(/\s*flag\s+[A-Za-z0-9_\-/]+(?:\s*=\s*(?:true|false|'[^']*'|"[^"]*"))?/g, '')
    .replace(/[（(]\s*[）)]/g, '')
    .replace(/；[。]/g, '。')
    .replace(/；\s*；/g, '；')
    .replace(/：\s*；/g, '：')
    .replace(/<br><br>\s*$/g, '')
    .replace(/^[；。]\s*/g, '')
    .replace(/\s+$/g, '');
  return s.replace(/\u0001(\d+)\u0002/g, function(m, n) {
    return restoreBranchKeptSegment(keptSegments[parseInt(n, 10)]);
  });
}

function formatBranchResultText(msg) {
  var clean = sanitizePlayerFacingText(msg);
  var parts = clean.split('<br><br>');
  var story = parts[0] || '';
  var focus = '';
  var effect = '';
  for (var i = 1; i < parts.length; i++) {
    var p = parts[i] || '';
    if (/^(效果|结果|基础效果|额外效果|额外影响)：/.test(p)) {
      effect = p.replace(/^(效果|结果|基础效果|额外效果|额外影响)：/, '');
    } else if (!focus) {
      focus = p.replace(/^重点：/, '');
    } else {
      effect += (effect ? '<br>' : '') + p;
    }
  }
  effect = effect.replace(/^[；。，、\s]+|[；。，、\s]+$/g, '');
  focus = focus.replace(/^[；。，、\s]+|[；。，、\s]+$/g, '');
  var html = '';
  if (story) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:12px;">' + story + '</div>';
  }
  if (focus) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
    html += '<div style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:12px;">' + focus + '</div>';
  }
  if (effect) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">影响</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.6;margin-bottom:14px;">' + effect + '</div>';
  }
  return html || '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + clean + '</div>';
}

function continueOffseasonEvent() {
  var modal = document.getElementById('offseason-result-modal');
  if (modal) modal.remove();
  STATE._offseasonResultDone = null;
  if (STATE.career && STATE.career.flags && STATE.career.flags.countdownDone) {
    announcePlayerRetirement(); // 放下球衣的那天：退役休赛期直接进入退役结算
    return;
  }
  showNextOffseasonEvent();
}

function maybeShowCityFarewell(callback) {
  if (!isCityTransfer()) return false;
  var ev = getBranchEventById('city_farewell');
  if (!ev) return false;
  STATE._cityFarewellEv = ev;
  STATE._cityFarewellDone = typeof callback === 'function' ? callback : null;
  STATE._branchScenePage = 0;
  showCityFarewellModal();
  return true;
}

function showCityFarewellModal() {
  var ev = STATE._cityFarewellEv;
  if (!ev) return;
  var existing = document.getElementById('city-farewell-modal');
  if (existing) existing.remove();
  var scenes = ev.scenes || [];
  var sceneIdx = STATE._branchScenePage || 0;
  var title = getPlayerFacingBranchTitle(ev.title);
  var html = '<div class="team-picker-overlay" id="city-farewell-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  if (scenes.length && sceneIdx < scenes.length) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + fillBranchEventText(scenes[sceneIdx]) + '</div>';
    html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continueCityFarewellScene()">继续</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    return;
  }
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.55;margin-bottom:12px;">' + sanitizePlayerFacingText(fillBranchEventText(ev.body)) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  ev.choices.forEach(function(ch, ci) {
    var locked = isBranchChoiceLocked(ch);
    var lockHint = locked ? (ch.lockHint || '需要其它线路结果') : '';
    var btnStyle = 'width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;' + (locked ? 'opacity:.45;cursor:not-allowed;' : '');
    var onclick = locked ? '' : 'onclick="chooseCityFarewell(' + ci + ')"';
    html += '<button class="btn btn-secondary btn-sm" style="' + btnStyle + '" ' + onclick + (locked ? ' disabled' : '') + '>' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(fillBranchEventText(locked ? lockHint : (ch.hint || ''))) + '</span></button>';
  });
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueCityFarewellScene() {
  STATE._branchScenePage = (STATE._branchScenePage || 0) + 1;
  showCityFarewellModal();
}

function chooseCityFarewell(choiceIdx) {
  var ev = STATE._cityFarewellEv;
  if (!ev) return;
  var ch = ev.choices[choiceIdx];
  if (!ch || isBranchChoiceLocked(ch)) return;
  var msg = ch && ch.apply ? ch.apply() : '';
  msg = applyChoiceBonus(ch, msg);
  recordBranchChoice(ev, ch, msg, 'offseason');
  var modal = document.getElementById('city-farewell-modal');
  if (modal) modal.remove();
  STATE._branchScenePage = 0;
  function finishCityFarewell() {
    var done = STATE._cityFarewellDone;
    STATE._cityFarewellEv = null;
    STATE._cityFarewellDone = null;
    if (typeof done === 'function') done();
  }
  if (msg) {
    showOffseasonResultModal(ev.title, msg, finishCityFarewell);
  } else {
    finishCityFarewell();
  }
}

function pickOffseasonText(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getOffseasonSeasonStartYear() {
  var n = STATE.career && STATE.career.seasonCount ? STATE.career.seasonCount : 1;
  return 2025 + n;
}

function getChinaTournamentName() {
  var y = getOffseasonSeasonStartYear();
  if (y % 4 === 0) return '奥运会';
  if (y % 4 === 3) return '男篮世界杯';
  return pickOffseasonText(['亚洲杯', '世预赛', '亚运会', '奥运落选赛']);
}

function countCareerHonor(label) {
  var honors = (STATE.career && STATE.career.honors) || [];
  return honors.filter(function(h) { return (h.label || '').indexOf(label) >= 0 && !isRookieHonorForLaterSeason(h); }).length;
}

function hasCareerHonor(label) {
  return countCareerHonor(label) > 0;
}

function addFlagCount(key, n) {
  var c = STATE.career;
  c.flags = c.flags || {};
  c.flags[key] = (c.flags[key] || 0) + (n || 1);
  return c.flags[key];
}

function getBreakthroughChance(key, base) {
  var flags = (STATE.career && STATE.career.flags) || {};
  return Math.min(0.55, base + (flags[key] || 0) * 0.08);
}

function applyTrainingOutcome(primary, secondary, pityKey, sceneList, labels) {
  var mods = getNextSeasonMods();
  var roll = Math.random();
  var boomChance = getBreakthroughChance(pityKey, 0.16);
  var scene = pickOffseasonText(sceneList);
  if (roll < boomChance) {
    STATE.career.flags[pityKey] = 0;
    addAttrDelta(primary, 5);
    if (secondary) addAttrDelta(secondary, 3);
    STATE.finalOVR = calcOVR(STATE.attrs);
    return scene + '<br><br>突飞猛进：连续几天，训练馆里的数据都不像正常成长曲线。教练组把你的训练片段单独剪出来，认为这不是手感，而是技术动作真的换了一层。<br><br>效果：' + labels.primary + '+5' + (secondary ? '，' + labels.secondary + '+3' : '') + '。';
  }
  if (roll < 0.72) {
    addAttrDelta(primary, 2);
    if (secondary) addAttrDelta(secondary, 1);
    STATE.finalOVR = calcOVR(STATE.attrs);
    return scene + '<br><br>稳定进步：这个夏天没有奇迹，但每天都能看到一点点更稳的自己。<br><br>效果：' + labels.primary + '+2' + (secondary ? '，' + labels.secondary + '+1' : '') + '。';
  }
  if (roll < 0.9) {
    var stack = addFlagCount(pityKey, 1);
    return scene + '<br><br>瓶颈期：你练得很狠，但身体像是暂时拒绝吸收新的动作。训练师建议你别急，下次继续冲这个专项时，突破概率会提高。<br><br>效果：本次无属性变化；该专项突破保底层数+' + stack + '。';
  }
  addAttrDelta(primary, 2);
  mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 2);
  STATE.finalOVR = calcOVR(STATE.attrs);
  return scene + '<br><br>过度训练：你咬牙把训练量顶了上去，技术确实进了，但膝盖和脚踝的反馈也变得刺耳。<br><br>效果：' + labels.primary + '+2；下赛季伤病/疲劳事件风险上升。';
}

function calcTrainingPoints() {
  if (!STATE.season) return 1;
  var s = STATE.season;
  var awards = s.awards || [];

  // —— 季后赛深度分 ——
  var playoffPts = 0;
  if (s.playoffBracket && s.playoffBracket.results) {
    var myResults = s.playoffBracket.results.filter(function(r) { return r.isMySeries; });
    if (myResults.length > 0) {
      var last = myResults[myResults.length - 1];
      var userWon = last.teamA === STATE.careerTeam ? last.aWon : !last.aWon;
      if (last.round === 0) playoffPts = 2;
      else if (last.round === 1) playoffPts = 3;
      else if (last.round === 2) playoffPts = 4;
      else if (last.round === 3) playoffPts = userWon ? 6 : 5;
    }
  }

  // —— 个人数据 + 荣誉分 ——
  var pStats = s.playerStats || {};
  var gp = pStats.games || 1;
  var avgPts = (pStats.pts || 0) / gp;
  var avgReb = (pStats.reb || 0) / gp;
  var avgAst = (pStats.ast || 0) / gp;
  var personalPts = 0;
  if (avgPts >= 20) personalPts++;
  if (avgReb >= 5) personalPts++;
  if (avgAst >= 5) personalPts++;

  var awardLabels = awards.map(function(a) { return typeof a === 'string' ? a : (a.label || ''); });
  if (awardLabels.indexOf('全明星') >= 0) personalPts++;
  if (awardLabels.some(function(l) { return l.indexOf('最佳阵容') >= 0; })) personalPts++;
  if (awardLabels.indexOf('MVP') >= 0) personalPts++;
  if (awardLabels.indexOf('DPOY') >= 0) personalPts++;
  if (awardLabels.indexOf('总决赛MVP') >= 0 || awardLabels.indexOf('FMVP') >= 0) personalPts++;
  if (awardLabels.indexOf('最佳新秀') >= 0) personalPts++;

  // 成绩与荣誉可叠加，保底 1，封顶 10（避免单季爆点）
  var total = playoffPts + personalPts;
  if (total < 1) total = 1;
  if (total > 10) total = 10;
  return total;
}

function renderTrainingCamp() {
  showScreen('screen-training');
  var c = STATE.career;
  var tp = calcTrainingPoints();
  document.getElementById('training-sub').textContent = getCurrentSeasonLabel() + ' 准备就绪 · 年龄 ' + c.currentAge;

  if (!STATE._tpPending) STATE._tpPending = {};
  var pending = STATE._tpPending;
  var used = 0;
  for (var k in pending) {
    if (pending.hasOwnProperty(k)) used += pending[k];
  }
  var remaining = tp - used;

  var html = '';
  html += '<div class="tp-header">';
  html += '<div class="tp-points">' + used + ' / ' + tp + '</div>';
  html += '<div class="tp-points-label">训练点数</div>';
  html += '</div>';

  html += '<div class="tp-age-info">⏳ <strong>' + c.currentAge + '岁</strong></div>';

  html += '<div class="tp-section-title">📈 分配属性点 <span style="font-size:12px;color:var(--text-muted);font-weight:400;">剩余 ' + remaining + ' 点</span></div>';
  html += '<div class="tp-attrs" id="tp-attrs"></div>';

  html += '<div class="tp-actions" style="justify-content:center;">';
  html += '<button class="btn btn-secondary btn-sm" onclick="resetTraining()">🔄 重置</button>';
  html += '<button class="btn btn-primary btn-sm" id="tp-confirm-btn" onclick="confirmTraining()">✅ 确认加点</button>';
  html += '</div>';

  document.getElementById('training-content').innerHTML = html;
  var tpl = calcTrainingPoints();
  renderTrainingAttrs(tpl);
}

var MANUAL_SAVE_KEYS = ['lenf_auto_slot'];
var MANUAL_SAVE_META = {};
var SAVE_IDB_NAME = 'lenf_save_v1';
var SAVE_IDB_STORE = 'saves';
var _saveIndexedDbPromise = null;

function getManualSaveSummary(slot) {
  return MANUAL_SAVE_META[slot] || null;
}

function openSaveIndexedDb() {
  if (!window.indexedDB) return Promise.reject(new Error('IndexedDB 不可用'));
  if (_saveIndexedDbPromise) return _saveIndexedDbPromise;
  _saveIndexedDbPromise = new Promise(function(resolve, reject) {
    var request = window.indexedDB.open(SAVE_IDB_NAME, 1);
    request.onupgradeneeded = function() {
      var db = request.result;
      if (!db.objectStoreNames.contains(SAVE_IDB_STORE)) db.createObjectStore(SAVE_IDB_STORE);
    };
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() {
      _saveIndexedDbPromise = null;
      reject(request.error || new Error('IndexedDB 打开失败'));
    };
    request.onblocked = function() {
      _saveIndexedDbPromise = null;
      reject(new Error('IndexedDB 被阻止'));
    };
  });
  return _saveIndexedDbPromise;
}

function indexedDbStorageGet(key) {
  return openSaveIndexedDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var transaction = db.transaction(SAVE_IDB_STORE, 'readonly');
      var request = transaction.objectStore(SAVE_IDB_STORE).get(key);
      request.onsuccess = function() { resolve(request.result == null ? null : request.result); };
      request.onerror = function() { reject(request.error || new Error('IndexedDB 读取失败')); };
    });
  });
}

function indexedDbStorageSet(key, value) {
  return openSaveIndexedDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var transaction = db.transaction(SAVE_IDB_STORE, 'readwrite');
      transaction.objectStore(SAVE_IDB_STORE).put(value, key);
      transaction.oncomplete = function() { resolve({ ok: true, backend: 'indexedDB' }); };
      transaction.onerror = function() { reject(transaction.error || new Error('IndexedDB 写入失败')); };
      transaction.onabort = function() { reject(transaction.error || new Error('IndexedDB 写入中止')); };
    });
  });
}

function indexedDbStorageDelete(key) {
  return openSaveIndexedDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var transaction = db.transaction(SAVE_IDB_STORE, 'readwrite');
      transaction.objectStore(SAVE_IDB_STORE).delete(key);
      transaction.oncomplete = function() { resolve({ ok: true, backend: 'indexedDB' }); };
      transaction.onerror = function() { reject(transaction.error || new Error('IndexedDB 删除失败')); };
      transaction.onabort = function() { reject(transaction.error || new Error('IndexedDB 删除中止')); };
    });
  });
}

function storageGet(key) {
  return indexedDbStorageGet(key);
}

function storageSet(key, value) {
  return value == null ? indexedDbStorageDelete(key) : indexedDbStorageSet(key, value);
}

function refreshManualSaveMeta() {
  return storageGet(MANUAL_SAVE_KEYS[0]).then(function(raw) {
    if (raw == null || raw === '') {
      MANUAL_SAVE_META[1] = null;
    } else {
      var data = null;
      try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) {}
      if (data && (data.c === 1 || data.state)) {
        MANUAL_SAVE_META[1] = { label: data.label || '自动存档', savedAt: data.savedAt || 0 };
      } else {
        MANUAL_SAVE_META[1] = null;
      }
    }
    refreshContinueActivityButton();
    renderMenuSavePanel();
    return MANUAL_SAVE_META[1];
  }, function(error) {
    MANUAL_SAVE_META[1] = null;
    console.error('[Save] IndexedDB 读取失败:', error);
    refreshContinueActivityButton();
    renderMenuSavePanel();
    return null;
  });
}

function buildManualFingerprint(s) {
  var c = s.career || {};
  var sp = (s.season && s.season.playerStats) || {};
  return {
    seasonCount: c.seasonCount || 0,
    currentAge: c.currentAge || 0,
    finalOVR: s.finalOVR || 0,
    careerTeam: s.careerTeam || '',
    games: sp.games || 0,
    pts: sp.pts || 0,
    wins: (s.season && s.season.wins) || 0,
    honors: (c.honors || []).length
  };
}

function buildManualSaveSnapshot() {
  if (typeof loadPlayerAges === 'function') loadPlayerAges();
  if (!_rngState) rngReset();
  var rawState = JSON.parse(JSON.stringify(STATE));
  if (STATE.season && STATE.season._processedDays instanceof Set) {
    rawState.season._processedDays = Array.from(STATE.season._processedDays);
  }
  return {
    v: 1,
    savedAt: Date.now(),
    label: (STATE.career ? '第' + (STATE.career.seasonCount + 1) + '赛季 · ' + STATE.career.currentAge + '岁' : '未开始'),
    screen: (document.querySelector('.screen.active') || {}).id || '',
    hupuUser: {
      nickname: HUPU_USER.nickname || '',
      avatar: HUPU_USER.avatar || '',
      isLogin: !!HUPU_USER.isLogin,
      source: HUPU_USER.source || ''
    },
    state: rawState,
    league: JSON.parse(JSON.stringify(NBA2K_DATA || {})),
    ages: JSON.parse(JSON.stringify(_playerAges || {})),
    genes: JSON.parse(JSON.stringify(_playerGenes || {})),
    rookieState: {
      starQueue: JSON.parse(JSON.stringify(_starRookieQueue || [])),
      usedCandidateNames: JSON.parse(JSON.stringify(_usedRookieCandidateNames || {})),
      rookieNameSeq: _rookieNameSeq || 0
    },
    rng: JSON.parse(JSON.stringify(_rngState)),
    fingerprint: buildManualFingerprint(STATE)
  };
}

function bytesToB64(bytes) {
  var bin = '';
  var chunk = 0x8000;
  for (var i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64ToBytes(b64) {
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function compressText(text) {
  var cs = new CompressionStream('deflate');
  var stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(cs);
  return new Response(stream).arrayBuffer().then(function(ab) {
    return bytesToB64(new Uint8Array(ab));
  });
}

function decompressText(b64) {
  var ds = new DecompressionStream('deflate');
  var stream = new Blob([b64ToBytes(b64)]).stream().pipeThrough(ds);
  return new Response(stream).arrayBuffer().then(function(ab) {
    return new TextDecoder().decode(ab);
  });
}

function manualSaveGame(slot) {
  var snap;
  try {
    snap = buildManualSaveSnapshot();
  } catch(e) {
    showManualSaveToast('保存失败：' + e.message);
    return;
  }
  var key = MANUAL_SAVE_KEYS[slot - 1];
  var raw = JSON.stringify(snap);
  function write(rawStr) {
    storageSet(key, rawStr).then(function() {
      var meta = null;
      try { var parsed = JSON.parse(rawStr); meta = { label: parsed.label || '自动存档', savedAt: parsed.savedAt || 0 }; } catch(e) {}
      MANUAL_SAVE_META[slot] = meta;
      renderAfterSaveLoad(snap.screen);
      renderMenuSavePanel();
      showManualSaveToast('已保存到存档' + slot + '（' + snap.label + '）');
    });
  }
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined') {
    write(raw);
    return;
  }
  compressText(raw).then(function(compressed) {
    write(JSON.stringify({ c: 1, d: compressed, label: snap.label, savedAt: snap.savedAt }));
  }, function() {
    write(raw);
  });
}

function autoSaveGame() {
  var c = STATE.career;
  if (!c || c.retired) return;
  var snap;
  try {
    snap = buildManualSaveSnapshot();
  } catch(e) {
    return;
  }
  var key = MANUAL_SAVE_KEYS[0];
  var raw = JSON.stringify(snap);
  function write(rawStr) {
    return storageSet(key, rawStr).then(function() {
      var meta = null;
      try { var parsed = JSON.parse(rawStr); meta = { label: parsed.label || '自动存档', savedAt: parsed.savedAt || 0 }; } catch(e) {}
      MANUAL_SAVE_META[1] = meta;
      refreshContinueActivityButton();
    });
  }
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined') {
    write(raw);
    return;
  }
  compressText(raw).then(function(compressed) {
    write(JSON.stringify({ c: 1, d: compressed, label: snap.label, savedAt: snap.savedAt }));
  }, function() {
    write(raw);
  });
}

function manualLoadGame(slot) {
  storageGet(MANUAL_SAVE_KEYS[slot - 1]).then(function(raw) {
    if (raw == null || raw === '') {
      showManualSaveToast('暂无自动存档');
      return;
    }
    var data;
    try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) { showManualSaveToast('自动存档损坏'); return; }
    function restoreJson(text) {
      var snap;
      try { snap = JSON.parse(text); } catch(e) { showManualSaveToast('自动存档损坏'); return; }
      if (!snap || !snap.state) { showManualSaveToast('自动存档损坏'); return; }
      try {
        // STATE 与 NBA2K_DATA 是 const，只能原地清空后填充，保证所有引用仍然有效
        Object.keys(STATE).forEach(function(k) { delete STATE[k]; });
        Object.assign(STATE, snap.state);
        if (STATE.season && STATE.season._processedDays && !(STATE.season._processedDays instanceof Set)) {
          STATE.season._processedDays = new Set((Array.isArray(STATE.season._processedDays) ? STATE.season._processedDays : []).map(Number));
        }
        if (snap.league && typeof NBA2K_DATA !== 'undefined') {
          Object.keys(NBA2K_DATA).forEach(function(k) { delete NBA2K_DATA[k]; });
          Object.assign(NBA2K_DATA, snap.league);
        }
        _playerAges = snap.ages || {};
        _playerGenes = snap.genes || {};
        if (snap.rookieState) {
          _starRookieQueue = JSON.parse(JSON.stringify(snap.rookieState.starQueue || []));
          _usedRookieCandidateNames = Object.assign({}, snap.rookieState.usedCandidateNames || {});
          _rookieNameSeq = snap.rookieState.rookieNameSeq || 0;
        }
        _rngState = snap.rng || null;
        if (snap.hupuUser) {
          HUPU_USER.nickname = snap.hupuUser.nickname || HUPU_USER.nickname;
          HUPU_USER.avatar = snap.hupuUser.avatar || HUPU_USER.avatar;
          HUPU_USER.isLogin = !!snap.hupuUser.isLogin;
          HUPU_USER.source = snap.hupuUser.source || HUPU_USER.source;
        }
        ['player-retirement-choice', 'contract-modal', 'contract-retirement-choice', 'legacy-modal', 'offseason-event-modal', 'offseason-result-modal', 'countdown-legacy-modal', 'countdown-legacy-result-modal', 'load-menu-modal'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.remove();
        });
        renderAfterSaveLoad(snap.screen);
        renderMenuSavePanel();
        showManualSaveToast('已恢复上局游戏');
      } catch(e) {
        showManualSaveToast('读档失败：' + e.message);
      }
    }
    if (data && data.c === 1 && typeof data.d === 'string') {
      if (typeof DecompressionStream === 'undefined') {
        showManualSaveToast('当前浏览器不支持压缩存档');
        return;
      }
      MANUAL_SAVE_META[slot] = { label: data.label || '', savedAt: data.savedAt || 0 };
      decompressText(data.d).then(restoreJson, function() {
        showManualSaveToast('自动存档解压失败');
      });
    } else {
      restoreJson(typeof raw === 'string' ? raw : JSON.stringify(raw));
    }
  }, function(error) {
    showManualSaveToast('读取失败：' + ((error && error.message) || 'IndexedDB 不可用'));
  });
}

function manualClearSave(slot) {
  var key = MANUAL_SAVE_KEYS[slot - 1];
  storageGet(key).then(function(raw) {
    if (raw == null || raw === '') {
      showManualSaveToast('暂无自动存档');
      return;
    }
    storageSet(key, null).then(function() {
      MANUAL_SAVE_META[slot] = null;
      var trainingEl = document.getElementById('screen-training');
      if (trainingEl && trainingEl.classList.contains('active')) renderTrainingCamp();
      else if (document.getElementById('screen-roster-review') && document.getElementById('screen-roster-review').classList.contains('active')) showRosterReview();
      renderMenuSavePanel();
      refreshContinueActivityButton();
      if (document.getElementById('load-menu-modal')) showLoadMenu();
      showManualSaveToast('已清除自动存档');
    }, function(error) {
      showManualSaveToast('清除失败：' + ((error && error.message) || 'IndexedDB 不可用'));
    });
  }, function(error) {
    showManualSaveToast('读取失败：' + ((error && error.message) || 'IndexedDB 不可用'));
  });
}

function renderAfterSaveLoad(targetScreen) {
  if (targetScreen === 'screen-roster-review' && typeof showRosterReview === 'function') {
    showRosterReview();
  } else {
    renderTrainingCamp();
  }
}

function showManualSaveToast(msg) {
  var old = document.getElementById('manual-save-toast');
  if (old) old.remove();
  var el = document.createElement('div');
  el.id = 'manual-save-toast';
  el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;background:var(--bg-card);border:2px solid var(--orange);border-radius:12px;padding:10px 18px;font-size:13px;font-weight:600;color:var(--text);box-shadow:0 6px 24px rgba(0,0,0,.25);';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
}

function renderMenuSavePanel() {
  var el = document.getElementById('menu-save-panel');
  if (!el) return;
  var html = '<div style="padding:12px;border:2px solid var(--border);border-radius:10px;background:var(--bg-card);">';
  html += '<div style="font-size:12px;font-weight:700;color:var(--orange);margin-bottom:8px;">💾 读取存档</div>';
  for (var si = 1; si <= 2; si++) {
    var sum = getManualSaveSummary(si);
    html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border-light);">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:12px;font-weight:700;">存档' + si + '</div>';
    html += '<div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (sum ? sum.label + ' · ' + new Date(sum.savedAt).toLocaleString() : '空槽位') + '</div>';
    html += '</div>';
    html += '<button class="btn btn-xs" onclick="manualLoadGame(' + si + ')">读取</button>';
    html += '<button class="btn btn-xs" onclick="manualClearSave(' + si + ')">清除</button>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function hasAutoSave() {
  return !!MANUAL_SAVE_META[1];
}

function refreshContinueActivityButton() {
  var btn = document.getElementById('continue-activity-btn');
  if (!btn) return;
  btn.style.display = hasAutoSave() ? '' : 'none';
}

function clearAutoSaveStorage() {
  storageSet(MANUAL_SAVE_KEYS[0], null).then(function() {
    MANUAL_SAVE_META[1] = null;
    refreshContinueActivityButton();
  }, function(error) {
    console.error('[Save] IndexedDB 清除失败:', error);
  });
}

function showLoadMenu() {
  var existing = document.getElementById('load-menu-modal');
  if (existing) existing.remove();
  var html = '<div class="team-picker-overlay" id="load-menu-modal">';
  html += '<div class="team-picker-modal" style="max-width:400px;">';
  html += '<div class="team-picker-header"><span>📂 继续活动</span><button class="team-picker-close" onclick="closeLoadMenu()">✕</button></div>';
  html += '<div style="padding:14px;">';
  html += '<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">赛程模拟期间每场自动保存，存档统一保存在 IndexedDB</div>';
  for (var si = 1; si <= 1; si++) {
    var sum = getManualSaveSummary(si);
    html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border-light);">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:12px;font-weight:700;">自动存档</div>';
    html += '<div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (sum ? sum.label + ' · ' + new Date(sum.savedAt).toLocaleString() : '暂无自动存档') + '</div>';
    html += '</div>';
    html += '<button class="btn btn-xs" onclick="manualLoadGame(' + si + ')">读取</button>';
    html += '<button class="btn btn-xs" onclick="manualClearSave(' + si + ')">清除</button>';
    html += '</div>';
  }
  html += '<button class="btn btn-secondary btn-sm" style="width:100%;margin-top:10px;" onclick="closeLoadMenu()">返回</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeLoadMenu() {
  var modal = document.getElementById('load-menu-modal');
  if (modal) modal.remove();
}

setTimeout(function() {
  refreshManualSaveMeta().then(function() {
    renderMenuSavePanel();
    refreshContinueActivityButton();
  });
}, 600);

function calcTrainingBreakdown() {
  var pts = calcTrainingPoints();
  var parts = [];
  var s = STATE.season;
  var awards = s.awards || [];
  var pStats = s.playerStats || {};
  var gp = pStats.games || 1;
  var avgPts = (pStats.pts || 0) / gp;
  var avgReb = (pStats.reb || 0) / gp;
  var avgAst = (pStats.ast || 0) / gp;

  if (s.playoffBracket && s.playoffBracket.results) {
    var myResults = s.playoffBracket.results.filter(function(r) { return r.isMySeries; });
    if (myResults.length > 0) {
      var last = myResults[myResults.length - 1];
      var rn = ['首轮','分区半决赛','分区决赛','总决赛'][last.round] || '';
      var userWon = last.teamA === STATE.careerTeam ? last.aWon : !last.aWon;
      if (last.round === 3) parts.push('成绩:' + (userWon ? '🏆冠军+' : '决赛+'));
      else parts.push('成绩:' + rn + '+');
    } else parts.push('成绩:常规赛+');
  } else parts.push('成绩:未进季后赛+');

  if (avgPts >= 20) parts.push('得分20+');
  if (avgReb >= 5) parts.push('篮板5+');
  if (avgAst >= 5) parts.push('助攻5+');

  var awardLabels = awards.map(function(a) { return typeof a === 'string' ? a : (a.label || ''); });
  if (awardLabels.indexOf('全明星') >= 0) parts.push('全明星');
  if (awardLabels.indexOf('MVP') >= 0) parts.push('MVP');
  if (awardLabels.indexOf('DPOY') >= 0) parts.push('DPOY');
  if (awardLabels.indexOf('总决赛MVP') >= 0) parts.push('FMVP');
  if (awardLabels.indexOf('最佳新秀') >= 0) parts.push('最佳新秀');
  if (awardLabels.some(function(l) { return l.indexOf('最佳阵容') >= 0; })) parts.push('最佳阵容');

  if (parts.length === 0) parts.push('保底');
  return parts.join(' + ');
}

function getAgeInfo(age) {
  if (age <= 25) {
    return {
      desc: '成长期 — 技术与身体仍有小幅自然提升',
      penalty: '部分技术/终结/运动属性：0～+1'
    };
  }
  if (age <= 30) {
    return {
      desc: '巅峰期 — 以状态波动为主，无固定大涨大跌',
      penalty: '约三成属性随机 ±1'
    };
  }
  if (age <= 33) {
    return {
      desc: '下滑初期 — 运动与防守先掉，技术仍可维持',
      penalty: '运动/防守类约 -1～-2；投篮传球等基本持平'
    };
  }
  if (age <= 36) {
    return {
      desc: '明显下滑 — 身体与技术同步走低',
      penalty: '运动/防守约 -3～-4；力量/终结约 -2～-3；技术约 -2～-3'
    };
  }
  if (age <= 39) {
    return {
      desc: '老将期 — 全面加速衰退',
      penalty: '多数属性约 -3～-6'
    };
  }
  return {
    desc: '生涯末期 — 衰退幅度最大',
    penalty: '多数属性约 -4～-8'
  };
}

function renderTrainingAttrs(tp) {
  var pending = STATE._tpPending || {};
  var attrsEl = document.getElementById('tp-attrs');
  if (!attrsEl) return;
  var html = '';
  var used = 0;
  for (var kk in pending) { if (pending.hasOwnProperty(kk)) used += pending[kk]; }
  var remaining = tp - used;

  ATTR_KEYS.forEach(function(k) {
    var cur = STATE.attrs[k] || 50;
    var added = pending[k] || 0;
    var after = cur + added;
    var maxAdd = getMaxAdd(added, tp, cur);
    var pct = Math.min(100, cur);
    var addPct = after > cur ? Math.min(100, after) - pct : 0;
    var curGrade = getGrade ? getGrade(cur).letter : '';
    var afterGrade = getGrade ? getGrade(after).letter : '';
    var gradeChanged = curGrade !== afterGrade ? '<span style="color:var(--gold);font-weight:700;">' + curGrade + '→' + afterGrade + '</span>' : curGrade;
    var cost = getPointCost(cur + added);
    var disabled = added >= 8 || remaining < cost || cur >= 99;
    var costLabel = cost > 1 ? ' (×' + cost + ')' : '';
    var btnLabel = remaining >= cost && after < 99 ? '+' : '';

    html += '<div class="tp-row' + (added > 0 ? ' tp-added' : '') + '">';
    html += '<span class="tp-label">' + attrCN(k) + '</span>';
    html += '<div class="tp-bar-wrap"><div class="tp-bar-fill" style="width:' + pct + '%"></div>' + (addPct > 0 ? '<div class="tp-bar-add" style="width:' + addPct + '%;left:' + pct + '%"></div>' : '') + '</div>';
    html += '<span class="tp-val' + (added > 0 ? ' tp-preview' : '') + '">' + cur + (added > 0 ? '→' + after : '') + '</span>';
    html += '<span class="tp-grade">' + gradeChanged + '</span>';
    if (btnLabel) {
      html += '<button class="tp-btn" id="tp-btn-' + k + '" ' + (disabled ? 'disabled' : '') + ' onclick="addTrainingPoint(\'' + k + '\')">+</button>';
    } else {
      html += '<button class="tp-btn" disabled>-</button>';
    }
    if (costLabel) html += '<span style="font-size:9px;color:var(--text-muted);min-width:22px;">' + costLabel + '</span>';
    html += '</div>';
  });
  attrsEl.innerHTML = html;
}

function getPointCost(val) {
  if (val >= 96) return 4;
  if (val >= 90) return 2;
  return 1;
}

function getMaxAdd(alreadyAdded, totalPoints, curVal) {
  var used = 0;
  var p = STATE._tpPending || {};
  for (var kk in p) { if (p.hasOwnProperty(kk)) used += p[kk]; }
  var remaining = totalPoints - used;
  if (remaining <= 0) return 0;
  var cost = getPointCost(curVal + alreadyAdded);
  return Math.floor(remaining / cost);
}

function addTrainingPoint(key) {
  if (!STATE._tpPending) STATE._tpPending = {};
  var added = STATE._tpPending[key] || 0;
  var cur = STATE.attrs[key] || 50;
  if (added >= 8) return;
  var tp = calcTrainingPoints();
  var used = 0;
  for (var kk in STATE._tpPending) { if (STATE._tpPending.hasOwnProperty(kk)) used += STATE._tpPending[kk]; }
  var remaining = tp - used;
  var cost = getPointCost(cur + added);
  if (remaining < cost || cur + added >= 99) return;
  STATE._tpPending[key] = (STATE._tpPending[key] || 0) + 1;
  renderTrainingCamp();
}

function resetTraining() {
  STATE._tpPending = {};
  renderTrainingCamp();
}

function confirmTraining() {
  var pending = STATE._tpPending || {};
  for (var k in pending) {
    if (pending.hasOwnProperty(k)) STATE.attrs[k] = (STATE.attrs[k] || 50) + pending[k];
  }
  STATE.finalOVR = calcOVR(STATE.attrs);

  // 合同扣减
  STATE.career.contract--;

  // 如果生涯还没保存（赛季结束未进生涯页面），这里补保存
  saveCurrentSeasonToCareer();

  STATE.career.currentAge++;
  STATE._tpPending = {};

  if (shouldOfferPlayerRetirement()) {
    showPlayerRetirementChoice();
    return;
  }

  continueCareerAfterTraining();
}

function continueCareerAfterTraining() {
  if (STATE.career && STATE.career.retired) return;
  evolveLeague();
  saveStandings();
  processDraft();
  assignFreeAgents();
  processTrades();
  maybeMoveUserInOffseason(finishOffseasonPipeline);
}

function finishOffseasonPipeline() {
  if (STATE.career && STATE.career.retired) {
    showCareerStats(1);
    return;
  }
  resetForNewSeason();

  // 跳转到阵容预览
  html('gamecast-area').innerHTML = '';
  html('game-list').innerHTML = '';

  if (STATE.career.contract <= 0) {
    showContractOffers();
  } else {
    showOffSeasonModals();
  }
}

function shouldOfferPlayerRetirement() {
  var c = STATE.career || {};
  var age = c.currentAge || 22;
  if (c.retired) return false;
  if (c.flags && (c.flags.countdownDone || c.flags.playOneMore)) return true;
  if (age >= 40) return true;
  if (age >= 38) return Math.random() < 0.65;
  if (age >= 37 && (STATE.finalOVR || 0) < 84) return Math.random() < 0.45;
  if (age >= 37 && countCareerHonor('总冠军') + countCareerHonor('MVP') >= 3) return Math.random() < 0.25;
  return false;
}

function showPlayerRetirementChoice() {
  var c = STATE.career || {};
  var flags = c.flags || {};
  var canPlayMore = (c.currentAge || 22) < 40 && !flags.playOneMore; // 只能选择一次“继续战斗”
  var html = '<div class="team-picker-overlay" id="player-retirement-choice">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>职业生涯节点</span></div>';
  html += '<div style="padding:14px;">';
  html += '<div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px;">是否宣布退役？</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + (c.currentAge || 0) + '岁，OVR ' + (STATE.finalOVR || 0) + '。' + (canPlayMore ? '漫长赛季之后，团队把两份方案放在你面前：继续战斗，或者让职业生涯停在这里，等待历史给出评价。' : '漫长赛季之后，你的身体和联盟都认定，这是生涯的终点。') + '</div>';
  html += '<button class="btn btn-primary btn-sm" style="width:100%;margin-bottom:8px;" onclick="announcePlayerRetirement()">宣布退役</button>';
  if (canPlayMore) {
    html += '<button class="btn btn-secondary btn-sm" style="width:100%;" onclick="playOneMoreSeason()">继续战斗</button>';
  } else {
    html += '<div style="text-align:center;font-size:11px;color:var(--text-dim);margin-top:4px;">联盟与球队已确认，这是生涯终点。</div>';
  }
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function playOneMoreSeason() {
  var modal = document.getElementById('player-retirement-choice');
  if (modal) modal.remove();
  STATE.career.flags = STATE.career.flags || {};
  if (STATE.career.flags.playOneMore || (STATE.career.currentAge || 22) >= 40) {
    announcePlayerRetirement();
    return;
  }
  STATE.career.flags.playOneMore = true;
  delete STATE.career.flags.countdownDone; // 继续战斗后不再强制退役
  continueCareerAfterTraining();
}

function announcePlayerRetirement() {
  ['player-retirement-choice', 'contract-retirement-choice', 'contract-modal', 'legacy-modal'].forEach(function(id) {
    var modal = document.getElementById(id);
    if (modal) modal.remove();
  });
  var c = STATE.career;
  if (!c) return;
  c.flags = c.flags || {};
  c.flags.retiredFromContractChoice = true;
  c.flags.postCareerDeferred = false;
  c.contract = 0;
  saveCurrentSeasonToCareer();
  c.retired = true;
  c.legacy = calculateLegacyResult();
  clearAutoSaveStorage();
  showLegacyModal(0);
}

// ── 退役球衣：30 队专属文案 ──

;


;

function buildJerseyAchievement(info) {
  var parts = [];
  if (info.championships > 0) {
    var champLine = '你为' + getTeamName(info.team) + '带来 ' + info.championships + ' 座总冠军';
    if (info.fmvp > 0) champLine += '和 ' + info.fmvp + ' 次总决赛MVP';
    parts.push(champLine);
  }
  if (info.mvp > 0) parts.push('把 ' + info.mvp + ' 座常规赛MVP留在这座城市');
  if (parts.length === 0) parts.push('你把最好的 ' + (info.years || 0) + ' 年都交给了这座城市');
  return parts.join('，');
}

function buildJerseyCeremonyCopy(info) {
  var team = info.team;
  var pool = JERSEY_RETIREMENT_TEXT_BY_TEAM[team] || JERSEY_RETIREMENT_TEXT_FALLBACK;
  var idx = 0;
  if (Array.isArray(pool)) {
    idx = typeof info.copyVariant === 'number' ? (info.copyVariant % pool.length) : Math.floor(Math.random() * pool.length);
  } else {
    pool = [pool];
  }
  var tpl = pool[idx] || pool[0];
  var vars = {
    team: getTeamName(team),
    city: (window.TEAM_CITY && window.TEAM_CITY[team]) || '',
    years: info.years || 0,
    championships: info.championships || 0,
    mvp: info.mvp || 0,
    fmvp: info.fmvp || 0,
    allStar: info.allStar || 0,
    achievement: buildJerseyAchievement(info),
  };
  return tpl.replace(/\{(\w+)\}/g, function(m, key) {
    return key in vars ? String(vars[key]) : m;
  });
}

// ── 名人堂：30 条入选 + 20 条未入选，围绕生涯经历客制化 ──

;


;

function buildHofAchievement(r) {
  return buildCareerAchievement(r);
}

function buildCareerAchievement(r) {
  var parts = [];
  if (r.championships > 0) parts.push(r.championships + ' 座总冠军');
  if (r.mvp > 0) parts.push(r.mvp + ' 次MVP');
  if (r.fmvp > 0) parts.push(r.fmvp + ' 次总决赛MVP');
  if (r.allNBA > 0) parts.push(r.allNBA + ' 次最佳阵容');
  if (r.allStar > 0) parts.push(r.allStar + ' 次全明星');
  if (parts.length === 0) parts.push('一段没有奖杯却足够完整的生涯');
  return '生涯里，你写下过' + parts.join('、');
}

function buildHofCopy(r) {
  var pool = r.hof ? HOF_TEXT : HOF_FAIL_TEXT;
  var idx = typeof r.hofCopyVariant === 'number' ? (r.hofCopyVariant % pool.length) : Math.floor(Math.random() * pool.length);
  var tpl = pool[idx] || pool[0];
  var vars = {
    achievement: buildHofAchievement(r),
    tier: r.tier || '',
    score: r.score || 0,
    games: r.games || 0,
    points: Math.round(r.points || 0),
    championships: r.championships || 0,
    mvp: r.mvp || 0,
    fmvp: r.fmvp || 0,
    dpoy: r.dpoy || 0,
    allNBA: r.allNBA || 0,
    allStar: r.allStar || 0,
    teamCount: r.teamCount || 0,
    longestTeam: getTeamName(r.longestTeam || r.team || ''),
    longestYears: r.longestYears || 0,
    firstTeam: r.firstTeam || '',
    lastTeam: r.lastTeam || '',
    teamList: r.teamList || '',
    seasonsCount: r.seasonsCount || 0,
  };
  return tpl.replace(/\{(\w+)\}/g, function(m, key) {
    return key in vars ? String(vars[key]) : m;
  });
}

// ── GOAT 历史地位：6 条专属文案 ──

;

function buildGoatHistoryCopy(r) {
  var pool = GOAT_HISTORY_TEXT;
  var idx = typeof r.goatCopyVariant === 'number' ? (r.goatCopyVariant % pool.length) : Math.floor(Math.random() * pool.length);
  var tpl = pool[idx] || pool[0];
  var vars = {
    achievement: buildCareerAchievement(r),
    tier: r.tier || '',
    score: r.score || 0,
    games: r.games || 0,
    points: Math.round(r.points || 0),
    championships: r.championships || 0,
    mvp: r.mvp || 0,
    fmvp: r.fmvp || 0,
    dpoy: r.dpoy || 0,
    allNBA: r.allNBA || 0,
    allStar: r.allStar || 0,
    teamCount: r.teamCount || 0,
    longestTeam: getTeamName(r.longestTeam || r.team || ''),
    longestYears: r.longestYears || 0,
    firstTeam: r.firstTeam || '',
    lastTeam: r.lastTeam || '',
    teamList: r.teamList || '',
    seasonsCount: r.seasonsCount || 0,
  };
  return tpl.replace(/\{(\w+)\}/g, function(m, key) {
    return key in vars ? String(vars[key]) : m;
  });
}

// ── 历史百大：30 条入选 + 20 条未入选，围绕生涯经历客制化 ──

;


;

function buildTop100Copy(r) {
  var pool = r.top100 ? TOP100_TEXT : TOP100_FAIL_TEXT;
  var idx = typeof r.top100CopyVariant === 'number' ? (r.top100CopyVariant % pool.length) : Math.floor(Math.random() * pool.length);
  var tpl = pool[idx] || pool[0];
  var vars = {
    achievement: buildCareerAchievement(r),
    tier: r.tier || '',
    score: r.score || 0,
    games: r.games || 0,
    points: Math.round(r.points || 0),
    championships: r.championships || 0,
    mvp: r.mvp || 0,
    fmvp: r.fmvp || 0,
    dpoy: r.dpoy || 0,
    allNBA: r.allNBA || 0,
    allStar: r.allStar || 0,
    teamCount: r.teamCount || 0,
    longestTeam: getTeamName(r.longestTeam || r.team || ''),
    longestYears: r.longestYears || 0,
    firstTeam: r.firstTeam || '',
    lastTeam: r.lastTeam || '',
    teamList: r.teamList || '',
    seasonsCount: r.seasonsCount || 0,
  };
  return tpl.replace(/\{(\w+)\}/g, function(m, key) {
    return key in vars ? String(vars[key]) : m;
  });
}

// ── GOAT 退役发布会：8 条专属文案 ──

;

// ── 退役发布会：100 条生涯长判词 ──

;

function buildRetirementCopy(r) {
  var pool = r.goat ? GOAT_RETIREMENT_TEXT : RETIREMENT_TEXT;
  var variant = (r.goat && typeof r.goatCopyVariant === 'number') ? r.goatCopyVariant : r.retirementCopyVariant;
  var idx = typeof variant === 'number' ? (variant % pool.length) : Math.floor(Math.random() * pool.length);
  var tpl = pool[idx] || pool[0];
  var vars = {
    achievement: buildCareerAchievement(r),
    tier: r.tier || '',
    score: r.score || 0,
    games: r.games || 0,
    points: Math.round(r.points || 0),
    championships: r.championships || 0,
    mvp: r.mvp || 0,
    fmvp: r.fmvp || 0,
    dpoy: r.dpoy || 0,
    allNBA: r.allNBA || 0,
    allStar: r.allStar || 0,
    teamCount: r.teamCount || 0,
    longestTeam: getTeamName(r.longestTeam || r.team || ''),
    longestYears: r.longestYears || 0,
    firstTeam: r.firstTeam || '',
    lastTeam: r.lastTeam || '',
    teamList: r.teamList || '',
    seasonsCount: r.seasonsCount || 0,
  };
  return tpl.replace(/\{(\w+)\}/g, function(m, key) {
    return key in vars ? String(vars[key]) : m;
  });
}

function calculateLegacyResult() {
  var c = STATE.career || {};
  var seasons = c.seasons || [];
  var honors = c.honors || [];
  function cnt(key) { return honors.filter(function(h) { return (h.label || '').indexOf(key) >= 0 && !isRookieHonorForLaterSeason(h); }).length; }
  var championships = cnt('总冠军');
  var seasonChampTotal = 0;
  seasons.forEach(function(s) { if ((s.playoffResult || '').indexOf('总冠军') >= 0) seasonChampTotal++; });
  if (seasonChampTotal > championships) championships = seasonChampTotal;
  var fmvp = cnt('总决赛MVP') + cnt('FMVP');
  var mvp = honors.filter(function(h) { return (h.label || '') === 'MVP'; }).length;
  var dpoy = cnt('DPOY');
  var allNBA = cnt('最佳阵容');
  var allStar = cnt('全明星');
  var games = (c.totalStats && c.totalStats.games) || 0;
  var points = (c.totalStats && c.totalStats.pts) || 0;
  var longestTeam = '';
  var teamYears = {};
  seasons.forEach(function(s) { teamYears[s.team] = (teamYears[s.team] || 0) + 1; });
  Object.keys(teamYears).forEach(function(t) { if (!longestTeam || teamYears[t] > teamYears[longestTeam]) longestTeam = t; });
  var seenTeams = [];
  seasons.forEach(function(s) { if (seenTeams.indexOf(s.team) < 0) seenTeams.push(s.team); });
  var teamCount = seenTeams.length;
  var teamList = seenTeams.map(getTeamName).join('、');
  var firstTeam = seenTeams.length ? getTeamName(seenTeams[0]) : '';
  var lastTeam = seasons.length ? getTeamName(seasons[seasons.length - 1].team) : '';
  var score = championships * 18 + fmvp * 14 + mvp * 16 + dpoy * 10 + allNBA * 5 + allStar * 3;
  score += Math.min(35, Math.floor(points / 2500));
  score += Math.min(18, Math.floor(games / 120));
  if (teamYears[longestTeam] >= 8) score += 10;
  if (STATE.finalOVR >= 94) score += 8;
  var cd = c.flags || {};
  if (cd.finalShow) score += 2;
  if (cd.finalHurt) score -= 1;
  if (cd.farewellHomeTeam) score += 3;
  if (cd.countdownLegend) score += 2;
  var goat = mvp >= 5 && championships >= 6 && fmvp >= 6 && (mvp + championships + fmvp) >= 18;
  var tier = '优秀职业球员';
  if (goat) tier = 'GOAT级别';
  else if (score >= 180) tier = '历史前十级别';
  else if (score >= 155) tier = '历史前二十级别';
  else if (score >= 140) tier = 'NBA历史百大';
  else if (score >= 100) tier = '名人堂稳进';
  else if (score >= 75) tier = '名人堂边缘';
  else if (score >= 60) tier = '队史传奇';
  var hof = score >= 100 || (score >= 75 && Math.random() < (0.25 + (score - 75) * 0.025));
  var top100 = score >= 140;
  var hofCopyVariant = Math.floor(Math.random() * (hof ? HOF_TEXT : HOF_FAIL_TEXT).length);
  var top100CopyVariant = Math.floor(Math.random() * (top100 ? TOP100_TEXT : TOP100_FAIL_TEXT).length);
  var retirementCopyVariant = Math.floor(Math.random() * RETIREMENT_TEXT.length);
  var goatCopyVariant = Math.floor(Math.random() * GOAT_RETIREMENT_TEXT.length);
  // 每支效力过的球队独立结算，所有达标的球队都会退役球衣，按生涯先后展示
  var seasonTeam = {};
  seasons.forEach(function(s) { seasonTeam[s.seasonNum] = s.team; });
  var seasonChampByTeam = {};
  seasons.forEach(function(s) {
    if ((s.playoffResult || '').indexOf('总冠军') >= 0) {
      seasonChampByTeam[s.team] = (seasonChampByTeam[s.team] || 0) + 1;
    }
  });
  var teamData = {};
  Object.keys(teamYears).forEach(function(t) {
    teamData[t] = { team: t, years: teamYears[t] || 0, championships: seasonChampByTeam[t] || 0, fmvp: 0, mvp: 0, dpoy: 0, allNBA: 0, allStar: 0, firstSeason: 9999 };
  });
  seasons.forEach(function(s) {
    var td = teamData[s.team];
    if (td && s.seasonNum < td.firstSeason) td.firstSeason = s.seasonNum;
  });
  honors.forEach(function(h) {
    if (isRookieHonorForLaterSeason(h)) return;
    var td = teamData[seasonTeam[h.seasonNum]];
    if (!td) return;
    var label = h.label || '';
    if (label.indexOf('总冠军') >= 0) return; // 冠军归属以赛季战绩为准，防止存档错位
    if (label.indexOf('总决赛MVP') >= 0 || label.indexOf('FMVP') >= 0) td.fmvp++;
    if (label === 'MVP') td.mvp++;
    if (label.indexOf('DPOY') >= 0) td.dpoy++;
    if (label.indexOf('最佳阵容') >= 0) td.allNBA++;
    if (label.indexOf('全明星') >= 0) td.allStar++;
  });
  var jerseyTeams = [];
  Object.keys(teamData).forEach(function(t) {
    var td = teamData[t];
    td.teamLegacy = td.years * 7 + td.championships * 12 + td.mvp * 10 + td.fmvp * 8 + td.allStar * 2;
    if (td.teamLegacy >= 80 || (td.championships > 0 && td.years >= 5) || (td.mvp > 0 && td.years >= 4)) {
      var pool = JERSEY_RETIREMENT_TEXT_BY_TEAM[td.team] || JERSEY_RETIREMENT_TEXT_FALLBACK;
      td.copyVariant = Math.floor(Math.random() * (Array.isArray(pool) ? pool.length : 1));
      jerseyTeams.push(td);
    }
  });
  jerseyTeams.sort(function(a, b) { return (a.firstSeason - b.firstSeason) || (b.teamLegacy - a.teamLegacy); });
  var jersey = jerseyTeams.length > 0;
  return { score: score, tier: tier, hof: hof, hofCopyVariant: hofCopyVariant, top100: top100, top100CopyVariant: top100CopyVariant, retirementCopyVariant: retirementCopyVariant, goat: goat, goatCopyVariant: goatCopyVariant, seasonsCount: seasons.length, jersey: jersey, jerseyTeams: jerseyTeams, team: longestTeam, longestTeam: longestTeam, longestYears: teamYears[longestTeam] || 0, teamCount: teamCount, teamList: teamList, firstTeam: firstTeam, lastTeam: lastTeam, teamYears: teamYears[longestTeam] || 0, championships: championships, fmvp: fmvp, mvp: mvp, dpoy: dpoy, allNBA: allNBA, allStar: allStar, points: points, games: games };
}

function showLegacyModal(step, jerseyIdx) {
  var r = STATE.career.legacy || calculateLegacyResult();
  var title = '退役发布会';
  var body = '';
  var next = step + 1;
  var nextJersey = 0;
  if (step === 0) {
    body = buildRetirementCopy(r) + '<br><br>生涯总结：' + r.games + '场，' + Math.round(r.points) + '分，' + r.mvp + '次MVP，' + r.championships + '次总冠军，' + r.allNBA + '次最佳阵容。<br><br>历史分：' + r.score + ' · ' + r.tier + '。';
  } else if (step === 1) {
    var jerseyTeams = r.jerseyTeams || [];
    if (jerseyTeams.length > 0) {
      var idx = jerseyIdx || 0;
      if (idx >= jerseyTeams.length) idx = 0;
      var info = jerseyTeams[idx];
      title = '退役球衣' + (jerseyTeams.length > 1 ? ' · ' + (idx + 1) + '/' + jerseyTeams.length : '');
      var lead = (jerseyTeams.length > 1 && idx === 0) ? '你的名字，同时被 ' + jerseyTeams.length + ' 座城市记住。<br><br>' : '';
      body = lead + buildJerseyCeremonyCopy(info) + '<br><br>结果：' + getTeamName(info.team) + ' 退役你的球衣。';
      if (idx + 1 < jerseyTeams.length) {
        next = 1;
        nextJersey = idx + 1;
      }
    } else {
      title = '退役球衣';
      body = '你的老东家为你准备了致敬短片，但球衣没有升上球馆上空。管理层给出的说法很体面：你属于很多城市，也属于这个时代。<br><br>结果：未触发退役球衣。';
    }
  } else if (step === 2) {
    title = '名人堂投票';
    if (r.hof) body = buildHofCopy(r) + '<br><br>结果：入选名人堂。';
    else body = buildHofCopy(r) + '<br><br>结果：暂未入选名人堂。';
  } else {
    title = 'NBA历史地位';
    if (r.goat) body = buildGoatHistoryCopy(r) + '<br><br>结果：GOAT级别。';
    else if (r.top100) body = buildTop100Copy(r) + '<br><br>结果：入选NBA历史百大。';
    else body = buildTop100Copy(r) + '<br><br>结果：未入选NBA历史百大。';
    next = -1;
  }
  var html = '<div class="team-picker-overlay" id="legacy-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px;">';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + body + '</div>';
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="' + (next >= 0 ? 'closeLegacyAndShow(' + next + ',' + nextJersey + ')' : 'finishLegacyStory()') + '">' + (next >= 0 ? '继续' : '完成') + '</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeLegacyAndShow(next, jerseyIdx) {
  var modal = document.getElementById('legacy-modal');
  if (modal) modal.remove();
  showLegacyModal(next, jerseyIdx || 0);
}

function finishLegacyStory() {
  var modal = document.getElementById('legacy-modal');
  if (modal) modal.remove();
  generateCareerPoster();
}

var _starRookieQueue = STAR_ROOKIES.slice();
var _usedRookieCandidateNames = {};
var _rngState = null;
var _rookieNameSeq = 0;
var _starRookieKeys = {};

function rngReset() {
  var seed = 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues && typeof Uint32Array !== 'undefined') {
    var a = new Uint32Array(1);
    crypto.getRandomValues(a);
    seed = a[0];
  } else {
    seed = (Date.now() & 0xffffffff) >>> 0;
  }
  _rngState = { s: seed, c: 0 };
}

function rngNext() {
  if (!_rngState) rngReset();
  var s = (_rngState.s + 0x6D2B79F5) >>> 0;
  var t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  _rngState.s = s;
  _rngState.c++;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

Math.random = rngNext;
STAR_ROOKIES.forEach(function(s) { _starRookieKeys[s.en] = true; });
var ROOKIE_CANDIDATES = DRAFT_CLASS_2027
  .concat(ROOKIE_NAMES.map(function(x, i) { return { en: x.en, cn: x.cn, pick: i + 1 }; }))
  .filter(function(x) { return !_starRookieKeys[x.en]; });

function generateRookie() {
  var allPos = ['PG','SG','SF','PF','C'];
  var pos = allPos[Math.floor(rngNext() * allPos.length)];
  var available = ROOKIE_CANDIDATES.filter(function(x) { return !_usedRookieCandidateNames[x.en]; });
  if (available.length === 0) available = ROOKIE_CANDIDATES;
  var pick = _starRookieQueue.length > 0
    ? _starRookieQueue.shift()
    : available[Math.floor(rngNext() * available.length)];
  if (pick && pick.en) _usedRookieCandidateNames[pick.en] = true;
  var ovr = pick.ovr || draftOvrByPick(pick.pick || 99); // 六位明星新秀先被抽出且 85 总评，其余按顺位分层
  var p = {
    name: 'Rookie_' + (++_rookieNameSeq),
    nameEN: pick.en,
    cname: pick.cn,
    pos: pos, height: '6\'7"', type: '新秀', ovr: ovr,
    _age: 19 + Math.floor(rngNext() * 3),
  };
  var attrKeys = SIM_CONFIG.ATTR_LIST || ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','IDEF','BLK','REB','ATH','STR','CLU'];
  attrKeys.forEach(function(k) { p[k] = Math.max(25, Math.min(99, ovr + Math.floor(rngNext() * 16) - 8)); });
  return p;
}

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', () => {
  renderModeSelect();
  renderPositionSelect();
  initGame();
});






