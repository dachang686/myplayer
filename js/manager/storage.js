(function installManagerStorage(global) {
  'use strict';

  var DB_NAME = 'court_forge_manager_v1';
  var STORE_NAME = 'manager_saves';
  var SAVE_KEY = 'manager_slot_1';

  function openDb() {
    return new Promise(function(resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error('当前浏览器不支持 IndexedDB。'));
        return;
      }
      var request = global.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function() {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = function() { resolve(request.result); };
      request.onerror = function() { reject(request.error || new Error('经理存档数据库打开失败。')); };
    });
  }

  function transaction(mode, callback) {
    return openDb().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, mode);
        var store = tx.objectStore(STORE_NAME);
        var request = callback(store);
        tx.oncomplete = function() { db.close(); resolve(request && request.result); };
        tx.onerror = function() { db.close(); reject(tx.error || new Error('经理存档操作失败。')); };
        tx.onabort = function() { db.close(); reject(tx.error || new Error('经理存档操作已取消。')); };
      });
    });
  }

  function save(state) {
    var snapshot = global.ManagerState.deepClone(state);
    snapshot.updatedAt = new Date().toISOString();
    return transaction('readwrite', function(store) { return store.put(snapshot, SAVE_KEY); }).then(function() {
      return snapshot;
    });
  }

  function load() {
    return transaction('readonly', function(store) { return store.get(SAVE_KEY); }).then(function(value) {
      return value ? global.ManagerState.normalize(value) : null;
    });
  }

  function clear() {
    return transaction('readwrite', function(store) { return store.delete(SAVE_KEY); });
  }

  global.ManagerStorage = {
    DB_NAME: DB_NAME,
    STORE_NAME: STORE_NAME,
    SAVE_KEY: SAVE_KEY,
    save: save,
    load: load,
    clear: clear
  };
})(typeof window !== 'undefined' ? window : globalThis);
