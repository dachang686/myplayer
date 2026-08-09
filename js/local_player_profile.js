(function bootstrapLocalPlayerProfile(global) {
  'use strict';

  var PROFILE_KEY = 'court_forge:profile';
  var DEFAULT_AVATAR = 'js/data/player_logo.svg';

  function readProfile() {
    try {
      var raw = global.localStorage.getItem(PROFILE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return {
        nickname: typeof parsed.nickname === 'string' ? parsed.nickname.trim() : '',
        avatar: typeof parsed.avatar === 'string' ? parsed.avatar : DEFAULT_AVATAR
      };
    } catch (error) {
      return { nickname: '', avatar: DEFAULT_AVATAR };
    }
  }

  function persistProfile() {
    try {
      global.localStorage.setItem(PROFILE_KEY, JSON.stringify({
        nickname: profile.nickname,
        avatar: profile.avatar
      }));
    } catch (error) {}
  }

  var profile = readProfile();
  profile.loaded = true;
  profile.isLocal = true;
  profile.isLogin = false;
  profile.source = 'local';
  global.LOCAL_PLAYER_PROFILE = profile;

  global.ensureLocalPlayerProfile = function ensureLocalPlayerProfile() {
    return Promise.resolve(profile);
  };

  global.getCustomPlayerName = function getCustomPlayerName() {
    try {
      return global.localStorage.getItem('buildplayer_nickname') || profile.nickname || '';
    } catch (error) {
      return profile.nickname || '';
    }
  };

  global.setCustomPlayerName = function setCustomPlayerName(name) {
    var normalized = String(name || '').trim().slice(0, 20);
    profile.nickname = normalized;
    persistProfile();
    try { global.localStorage.setItem('buildplayer_nickname', normalized); } catch (error) {}
    if (typeof global.STATE !== 'undefined') global.STATE.playerName = normalized;
  };

  global.getMyPlayerDisplayName = function getMyPlayerDisplayName() {
    var stateName = typeof global.STATE !== 'undefined' && global.STATE.playerName;
    return stateName || global.getCustomPlayerName() || '自建球员';
  };

  global.getPlayerAvatarUrl = function getPlayerAvatarUrl() {
    return profile.avatar || DEFAULT_AVATAR;
  };

  global.hasLocalPlayerProfile = function hasLocalPlayerProfile() {
    return !!global.getCustomPlayerName();
  };

  global.openEditProfile = function openEditProfile() {
    var nextName = global.prompt('输入球员昵称（最多 20 个字符）', global.getMyPlayerDisplayName());
    if (nextName == null) return;
    nextName = nextName.trim();
    if (!nextName) {
      global.alert('昵称不能为空');
      return;
    }
    global.setCustomPlayerName(nextName);
  };

  global.saveEditProfile = function saveEditProfile() {
    var input = global.document.getElementById('editNicknameInput');
    if (input) global.setCustomPlayerName(input.value);
  };
})(window);
