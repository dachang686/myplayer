
// 不在控制台输出调试日志
try { console.log = function(){}; console.warn = function(){}; console.error = function(){}; } catch(e) {}
// == use-va-h5-sdk：用户信息只请求一次 ==
var DEFAULT_PLAYER_AVATAR = 'js/data/player_logo.svg';
var DEFAULT_HUPU_NICKNAME = '未登录用户';
var HUPU_USER = {
  requested: false,
  loaded: false,
  promise: null,
  raw: null,
  isLogin: false,
  nickname: DEFAULT_HUPU_NICKNAME,
  avatar: DEFAULT_PLAYER_AVATAR,
  source: 'fallback',
  requestCount: 0
};
window.__HUPU_USER__ = HUPU_USER;

function parseHupuMaybeJson(value) {
  if (typeof value !== 'string') return value;
  var text = value.trim();
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return value;
  try { return JSON.parse(text); } catch (e) { return value; }
}

function normalizeHupuAvatarUrl(value) {
  if (value === undefined || value === null) return '';
  var url = String(value).trim();
  if (!url) return '';
  if (url.startsWith('//')) url = 'https:' + url;
  if (/^data:image\//i.test(url) || /^https?:\/\//i.test(url)) return url;
  return '';
}

function findHupuField(raw, keys, depth, seen) {
  if (depth === undefined) depth = 0;
  if (seen === undefined) seen = new Set();
  raw = parseHupuMaybeJson(raw);
  if (!raw || depth > 7 || typeof raw !== 'object' || seen.has(raw)) return undefined;
  seen.add(raw);
  var keyMap = new Map(Object.keys(raw).map(function(key) { return [key.toLowerCase(), key]; }));
  for (var wi = 0; wi < keys.length; wi++) {
    var wanted = keys[wi];
    var actual = keyMap.get(String(wanted).toLowerCase());
    if (!actual) continue;
    var value = parseHupuMaybeJson(raw[actual]);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  var objKeys = Object.keys(raw);
  for (var oi = 0; oi < objKeys.length; oi++) {
    var found = findHupuField(raw[objKeys[oi]], keys, depth + 1, seen);
    if (found !== undefined && found !== null && found !== '') return found;
  }
  return undefined;
}

function findHupuString(raw, keys) {
  var value = findHupuField(raw, keys);
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (value && typeof value === 'object') {
    var nested = findHupuField(value, ['url', 'src', 'value', 'text', 'name']);
    if (typeof nested === 'string' || typeof nested === 'number') return String(nested).trim();
  }
  return '';
}

function normalizeHupuUserInfo(userInfo) {
  var raw = parseHupuMaybeJson(userInfo) || {};
  var nickname = findHupuString(raw, ['nickname', 'nickName', 'nick', 'userName', 'username', 'displayName', 'display_name']);
  var avatarValue = findHupuField(raw, [
    'avatar', 'avatarUrl', 'avatar_url', 'userAvatar', 'userAvatarUrl', 'head', 'header', 'headerUrl', 'headUrl',
    'headImg', 'headImgUrl', 'headimgurl', 'profileImg', 'profileImage', 'profileImageUrl', 'profilePic', 'profilePicUrl',
    'face', 'faceUrl', 'icon', 'iconUrl', 'photo', 'photoUrl', 'img', 'imgUrl', 'image', 'imageUrl', 'smallAvatar', 'bigAvatar'
  ]);
  if (avatarValue && typeof avatarValue === 'object')
    avatarValue = findHupuField(avatarValue, ['url', 'src', 'imageUrl', 'avatarUrl']);
  var avatar = normalizeHupuAvatarUrl(avatarValue);
  var loginValue = findHupuField(raw, ['islogin', 'isLogin', 'loggedIn', 'login', 'hasLogin']);
  var explicitlyLoggedIn = loginValue === 1 || loginValue === '1' || loginValue === true || loginValue === 'true' || loginValue === 'yes';
  var isLogin = explicitlyLoggedIn || !!nickname || !!avatar;
  return {
    isLogin: isLogin,
    nickname: isLogin && nickname ? nickname : DEFAULT_HUPU_NICKNAME,
    avatar: avatar || DEFAULT_PLAYER_AVATAR,
    raw: userInfo || null
  };
}

function getInjectedVaUserInfo() {
  var candidates = [
    window.__HUPU_USER_INFO__, window.__USER_INFO__, window.hupuUserInfo, window.userInfo,
    window.VaFuSDK && window.VaFuSDK.userInfo, window.VaFuSDK && window.VaFuSDK.currentUser, window.VaFuSDK && window.VaFuSDK.user && window.VaFuSDK.user.info
  ];
  for (var ci = 0; ci < candidates.length; ci++) {
    var value = parseHupuMaybeJson(candidates[ci]);
    if (value && typeof value === 'object') return value;
  }
  return null;
}

function getVaUserInfoGetter() {
  var candidates = [
    [window.VaFuSDK, 'getUserInfo', 'VaFuSDK.getUserInfo'],
    [window.VaFuSDK, 'getCurrentUser', 'VaFuSDK.getCurrentUser'],
    [window.VaFuSDK, 'getUserProfile', 'VaFuSDK.getUserProfile'],
    [window.VaFuSDK && window.VaFuSDK.user, 'getUserInfo', 'VaFuSDK.user.getUserInfo']
  ];
  for (var gi = 0; gi < candidates.length; gi++) {
    var owner = candidates[gi][0], key = candidates[gi][1], label = candidates[gi][2];
    if (owner && typeof owner[key] === 'function') return { owner: owner, fn: owner[key], label: label };
  }
  return null;
}

function waitForVaUserBridge(timeout) {
  if (timeout === undefined) timeout = 8000;
  var started = Date.now();
  return new Promise(function(resolve) {
    function check() {
      var injected = getInjectedVaUserInfo();
      if (injected) { resolve({ injected: injected }); return; }
      var getter = getVaUserInfoGetter();
      if (getter) { resolve({ getter: getter }); return; }
      if (Date.now() - started < timeout) {
        setTimeout(check, 120);
      } else {
        var finalInjected = getInjectedVaUserInfo();
        if (finalInjected) { resolve({ injected: finalInjected }); return; }
        var finalGetter = getVaUserInfoGetter();
        resolve(finalGetter ? { getter: finalGetter } : null);
      }
    }
    check();
  });
}

function invokeVaUserInfoGetter(getter, timeout) {
  if (timeout === undefined) timeout = 5000;
  return new Promise(function(resolve, reject) {
    if (!getter) { resolve(null); return; }
    var settled = false;
    function finish(value) { if (settled) return; settled = true; clearTimeout(timer); resolve(value); }
    function fail(error) { if (settled) return; settled = true; clearTimeout(timer); reject(error); }
    function callback() {
      if (arguments.length > 1 && arguments[1] !== undefined && arguments[1] !== null) finish(arguments[1]);
      else finish(arguments[0]);
    }
    var timer = setTimeout(function() { finish(null); }, timeout);
    try {
      HUPU_USER.requestCount += 1;
      var returned = getter.fn.length > 0 ? getter.fn.call(getter.owner, callback) : getter.fn.call(getter.owner);
      if (returned && typeof returned.then === 'function') returned.then(finish, fail);
      else if (returned !== undefined && returned !== null) finish(returned);
    } catch (e) { fail(e); }
  });
}

async function _fetchHupuUser() {
  try {
    var bridge = await waitForVaUserBridge(8000);
    var raw = null;
    if (bridge && bridge.injected) { raw = bridge.injected; HUPU_USER.source = 'VaFuSDK.injected'; }
    else if (bridge && bridge.getter) { raw = await invokeVaUserInfoGetter(bridge.getter, 5000); HUPU_USER.source = bridge.getter.label; }
    var normalized = normalizeHupuUserInfo(raw);
    HUPU_USER.raw = normalized.raw;
    HUPU_USER.isLogin = normalized.isLogin;
    HUPU_USER.nickname = normalized.nickname;
    HUPU_USER.avatar = normalized.avatar;
    try { console.log('[hupu]', normalized.isLogin ? '已登录' : '未登录', normalized.nickname, HUPU_USER.source); } catch(e) {}
  } catch (e) {
    HUPU_USER.isLogin = false;
    HUPU_USER.nickname = DEFAULT_HUPU_NICKNAME;
    HUPU_USER.avatar = DEFAULT_PLAYER_AVATAR;
    HUPU_USER.source = 'fallback_error';
  } finally {
    HUPU_USER.loaded = true;
  }
  return HUPU_USER;
}

var _hupuRetryCount = 0;
function ensureHupuUser(forceRetry) {
  // 强制重试：之前已加载但未登录，或加载超时
  if (forceRetry) {
    if (HUPU_USER.isLogin || _hupuRetryCount >= 3) return Promise.resolve(HUPU_USER);
    _hupuRetryCount++;
    HUPU_USER.loaded = false;
    HUPU_USER.requested = true;
    HUPU_USER.promise = _fetchHupuUser();
    return HUPU_USER.promise;
  }
  if (HUPU_USER.loaded) return Promise.resolve(HUPU_USER);
  if (!HUPU_USER.requested) { HUPU_USER.requested = true; HUPU_USER.promise = _fetchHupuUser(); }
  return HUPU_USER.promise;
}

function getHupuDisplayName() {
  var custom = getCustomPlayerName();
  if (custom) return custom;
  return (HUPU_USER.isLogin && HUPU_USER.nickname) ? HUPU_USER.nickname : '自建球员';
}
function getHupuAvatarUrl() {
  return HUPU_USER.avatar || '';
}
function isHupuLoggedIn() {
  return !!HUPU_USER.isLogin;
}

function getCustomPlayerName() {
  try { return localStorage.getItem('buildplayer_nickname') || ''; } catch(e) { return ''; }
}
function setCustomPlayerName(name) {
  try { localStorage.setItem('buildplayer_nickname', name); } catch(e) {}
}

function openEditProfile() {
  var existing = document.getElementById('editProfileModal');
  if (existing) existing.remove();
  var currentName = getHupuDisplayName();
  var avatarUrl = getHupuAvatarUrl();
  var defaultAvatar = DEFAULT_PLAYER_AVATAR;
  var M = document.createElement('div');
  M.id = 'editProfileModal';
  M.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;padding:16px;';
  M.onclick = function(e) { if (e.target === M) M.remove(); };
  var C = document.createElement('div');
  C.style.cssText = 'background:#faf5eb;border:2px solid #f0e0cc;border-radius:16px;width:100%;max-width:300px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 48px rgba(0,0,0,0.25);text-align:center;padding:28px 20px 20px;position:relative;';
  M.appendChild(C);
  var closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:8px;border:1.5px solid #f0e0cc;background:#fffaf2;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:#8a7a66;';
  closeBtn.textContent = '✕';
  closeBtn.onclick = function() { M.remove(); };
  C.appendChild(closeBtn);
  var avatarWrap = document.createElement('div');
  avatarWrap.style.cssText = 'width:72px;height:72px;border-radius:50%;margin:0 auto 14px;overflow:hidden;border:3px solid #ff6b35;background:#fffaf2;';
  C.appendChild(avatarWrap);
  var img = document.createElement('img');
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
  img.src = avatarUrl;
  img.onerror = function() { this.onerror = null; this.src = defaultAvatar; };
  avatarWrap.appendChild(img);
  var label = document.createElement('div');
  label.style.cssText = 'font-family:Fredoka,"Noto Sans SC",sans-serif;font-size:13px;color:#8a7a66;margin-bottom:6px;';
  label.textContent = '昵称';
  C.appendChild(label);
  var input = document.createElement('input');
  input.id = 'editNicknameInput';
  input.type = 'text';
  input.maxLength = '20';
  input.value = currentName;
  input.style.cssText = 'width:100%;padding:10px 14px;border:2px solid #f0e0cc;border-radius:10px;font-family:Nunito,"Noto Sans SC",sans-serif;font-size:15px;text-align:center;outline:none;background:#fffaf2;color:#2d1f0e;';
  C.appendChild(input);
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;margin-top:18px;';
  C.appendChild(btnRow);
  var cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = 'flex:1;padding:12px 0;border:2px solid #f0e0cc;border-radius:12px;background:#fffaf2;font-family:Fredoka,"Noto Sans SC",sans-serif;font-size:14px;font-weight:600;color:#8a7a66;cursor:pointer;';
  cancelBtn.textContent = '取消';
  cancelBtn.onclick = function() { M.remove(); };
  btnRow.appendChild(cancelBtn);
  var saveBtn = document.createElement('button');
  saveBtn.style.cssText = 'flex:1;padding:14px 0;border:none;border-radius:12px;background:#ff6b35;color:#fff;font-family:Fredoka,"Noto Sans SC",sans-serif;font-size:15px;font-weight:700;cursor:pointer;';
  saveBtn.textContent = '保存';
  saveBtn.onclick = function() { saveEditProfile(); };
  btnRow.appendChild(saveBtn);
  document.body.appendChild(M);
}
function saveEditProfile() {
  try{console.log('[edit] save clicked')}catch(e){}
  var inp = document.getElementById('editNicknameInput');
  if (!inp) { try{console.warn('[edit] input not found')}catch(e){} return; }
  var name = inp.value.trim();
  if (!name) { alert('昵称不能为空'); return; }
  function doSave() {
    try{console.log('[edit] saving name:', name)}catch(e){}
    setCustomPlayerName(name);
    var m = document.getElementById('editProfileModal');
    if (m) m.remove();
  }
  if (window.ColorboxAI && window.ColorboxAI.security && typeof window.ColorboxAI.security.checkAudit === 'function') {
    try{console.log('[edit] checkAudit available, calling...')}catch(e){}
    var timedOut = false;
    var timer = setTimeout(function() { timedOut = true; try{console.warn('[edit] checkAudit timeout')}catch(e){} doSave(); }, 1000);
    try {
      var p = window.ColorboxAI.security.checkAudit(name);
      if (p && typeof p.then === 'function') {
        p.then(function(res) {
          if (timedOut) return;
          clearTimeout(timer);
          try{console.log('[edit] checkAudit result', res)}catch(e){}
          if (res && res.code === 200 && res.data === true) {
            doSave();
          } else if (res && res.code === 401) {
            alert('请先登录');
          } else if (res && res.data === false) {
            alert('检测到敏感词');
          } else {
            try{console.warn('[edit] checkAudit unexpected', res)}catch(e){}
            alert('安全检查异常，请稍后再试');
          }
        }).catch(function(e) {
          if (timedOut) return;
          clearTimeout(timer);
          try{console.warn('[edit] checkAudit promise error', e)}catch(ex){}
          doSave();
        });
      } else {
        clearTimeout(timer);
        try{console.warn('[edit] checkAudit not promise, fallback')}catch(e){}
        doSave();
      }
    } catch(e) {
      clearTimeout(timer);
      try{console.warn('[edit] checkAudit sync error', e)}catch(ex){}
      doSave();
    }
  } else {
    try{console.warn('[edit] checkAudit unavailable, save directly')}catch(e){}
    doSave();
  }
}
