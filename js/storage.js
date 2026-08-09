
// ── Storage 工具 ──
var Storage = {
  _ready: null,
  waitForReady: function(cb) {
    if (!Storage._ready) {
      Storage._ready = new Promise(function(resolve) {
        function check() {
          if (window.ColorboxAI && window.ColorboxAI.storage) { resolve(); return; }
          setTimeout(check, 100);
        }
        check();
      });
    }
    if (typeof cb === 'function') { Storage._ready.then(cb).catch(function(){}); }
    return Storage._ready;
  },
  _validateKey: function(key) {
    if (typeof key !== 'string') return false;
    var k = key.trim();
    return k.length > 0 && /^[a-zA-Z0-9_-]+$/.test(k);
  },
  setValue: function(data) {
    try {
      if (!window.ColorboxAI || !window.ColorboxAI.storage) return Promise.resolve();
      for (var key in data) {
        if (!data.hasOwnProperty(key)) continue;
        if (!Storage._validateKey(key)) { return Promise.resolve(); }
      }
      var serialized = JSON.stringify(data);
      if (serialized.length > 4.5 * 1024 * 1024) {
        console.warn('[Storage] 写入数据过大超出4.5MB上限:', serialized.length);
        return Promise.resolve();
      }
      return window.ColorboxAI.storage.setValue(data).catch(function(err){ console.error('[Storage] setValue 失败:', err); });
    } catch(e) {}
    return Promise.resolve();
  },
  getValue: function(key) {
    try {
      if (!window.ColorboxAI || !window.ColorboxAI.storage) return Promise.resolve(null);
      if (key !== undefined && !Storage._validateKey(key)) return Promise.resolve(null);
      if (key === undefined) return window.ColorboxAI.storage.getValue().catch(function(){ return null; });
      return window.ColorboxAI.storage.getValue(key).catch(function(){ return null; });
    } catch(e) { return Promise.resolve(null); }
  },
  savePlayer: function(playerData) {
    if (!window.ColorboxAI || !window.ColorboxAI.storage) return;
    Storage.getValue('players').then(function(raw) {
      var arr = [];
      if (raw != null) {
        if (Array.isArray(raw)) { arr = raw; }
        else if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch(e) { arr = []; } }
        if (!Array.isArray(arr)) arr = [];
      }
      arr.push(playerData);
      Storage.setValue({ players: arr });
    }).catch(function() {
      Storage.setValue({ players: [playerData] });
    });
  }
};
