(function bootstrapLocalPlatform(global) {
  'use strict';

  var STORAGE_PREFIX = 'court_forge:v1:';
  var LEGACY_PREFIX = 'cb_storage:project-ai-1783761934042:';
  var MAX_STORAGE_BYTES = 5 * 1024 * 1024;

  function decodeLegacyValue(raw) {
    if (raw == null) return null;
    var text = String(raw);
    if (text.indexOf('__b64__:') === 0) {
      try {
        text = decodeURIComponent(escape(global.atob(text.slice(8))));
      } catch (error) {
        return null;
      }
    }
    try { return JSON.parse(text); } catch (error) { return text; }
  }

  function read(key) {
    try {
      var value = global.localStorage.getItem(STORAGE_PREFIX + key);
      if (value != null) return decodeLegacyValue(value);

      var legacyValue = global.localStorage.getItem(LEGACY_PREFIX + key);
      if (legacyValue == null) return null;
      var migrated = decodeLegacyValue(legacyValue);
      write(key, migrated);
      return migrated;
    } catch (error) {
      return null;
    }
  }

  function write(key, value) {
    try {
      var serialized = JSON.stringify(value);
      if ((STORAGE_PREFIX + key).length + serialized.length > MAX_STORAGE_BYTES) {
        return false;
      }
      global.localStorage.setItem(STORAGE_PREFIX + key, serialized);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readAll() {
    var result = {};
    try {
      for (var index = 0; index < global.localStorage.length; index += 1) {
        var storageKey = global.localStorage.key(index);
        if (storageKey && storageKey.indexOf(STORAGE_PREFIX) === 0) {
          var key = storageKey.slice(STORAGE_PREFIX.length);
          result[key] = read(key);
        }
      }
    } catch (error) {}
    return result;
  }

  function setValue(key, value) {
    if (key && typeof key === 'object') {
      Object.keys(key).forEach(function writeEntry(entryKey) {
        write(entryKey, key[entryKey]);
      });
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve({ ok: write(String(key), value) });
  }

  function getValue(key) {
    return Promise.resolve(key == null || key === '' ? readAll() : read(String(key)));
  }

  function unavailable(feature) {
    return function unavailableFeature() {
      return Promise.reject(new Error(feature + ' is unavailable in local mode'));
    };
  }

  global.GamePlatform = {
    mode: 'local',
    project: {
      id: 'court-forge-local',
      getSettings: function getSettings() {
        return Promise.resolve({ title: '篮坛造星局' });
      }
    },
    storage: {
      maxBytes: MAX_STORAGE_BYTES,
      setValue: setValue,
      getValue: getValue,
      set: setValue,
      get: getValue
    },
    security: {
      checkAudit: function checkAudit() {
        return Promise.resolve({ code: 200, data: true });
      }
    },
    auth: {
      getUserInfo: function getUserInfo() { return Promise.resolve(null); },
      getAuthToken: function getAuthToken() { return Promise.resolve(''); }
    },
    score: {
      getScore: function getScore() { return Promise.resolve(0); },
      addScore: function addScore() { return Promise.resolve({ ok: false, localOnly: true }); }
    },
    bbs: {
      getPostDetail: unavailable('Community'),
      getTopicThreads: unavailable('Community'),
      buildPostSchema: function buildPostSchema() { return ''; },
      openPostEditor: function openPostEditor() { return ''; }
    },
    oss: { uploadFile: unavailable('Cloud upload') },
    track: function track() {},
    navigateTo: function navigateTo() { return false; },
    openUrl: function openUrl() { return false; }
  };

  global.__LOCAL_GAME__ = true;
})(window);
