(function () {
  window.__COLORBOX_AI_CONFIG__ = {
    projectId: "project-ai-1783761934042",
    settings: {"ownerId":402116,"projectId":"project-ai-1783761934042","title":"完美球员模拟器","trackingCode":"PHBS7947","bizCategory":"match","isGamePlay":true,"postTopicId":"152165","shareInviteParams":"1783761934042","rewardVideoIncomeId":"16899","shareTitle":"","shareSubtitle":"","shareCover":"","theme":{"webviewBackground":"#ffffff","skeletonColor":"#edeef0","containerBackground":"#ffffff"},"dayNightMode":"auto"},
    pagePi: "activity_match_project-ai-1783761934042"
  };
  "use strict";
(() => {
  // src/iframe-runtime/fallbacks.ts
  function createLocalFallbackApi() {
    return {
      getPostDetail: function() {
        return Promise.reject(new Error("ColorboxAI SDK is not loaded"));
      },
      getTopicThreads: function() {
        return Promise.reject(new Error("ColorboxAI SDK is not loaded"));
      },
      buildPostSchema: function() {
        return "";
      },
      openPostEditor: function() {
        return "";
      }
    };
  }
  function createLocalSecurityFallbackApi() {
    return {
      checkAudit: function() {
        return Promise.reject(new Error("ColorboxAI SDK is not loaded"));
      }
    };
  }
  function createLocalScoreFallbackApi() {
    return {
      getScore: function() {
        return Promise.reject(new Error("ColorboxAI SDK is not loaded"));
      },
      addScore: function() {
        return Promise.reject(new Error("ColorboxAI SDK is not loaded"));
      }
    };
  }
  function createLocalOssFallbackApi() {
    return {
      uploadFile: function() {
        return Promise.reject(new Error("ColorboxAI SDK is not loaded"));
      }
    };
  }
  function createLocalAuthFallbackApi() {
    return {
      getUserInfo: function() {
        const info = window.userInfo || window.HupuBridge && window.HupuBridge.nainfo;
        return Promise.resolve(info || null);
      },
      getAuthToken: function() {
        const info = window.userInfo || window.HupuBridge && window.HupuBridge.nainfo;
        const token = info && (info.authToken || info.token) || "";
        return Promise.resolve(token);
      }
    };
  }

  // src/iframe-runtime/storage.ts
  var MAX_STORAGE_BYTES = 5 * 1024 * 1024;
  function createColorboxStorageApi(params) {
    const pId = params.projectId;
    function resolveScopedKey(key) {
      return "cb_storage:" + pId + ":" + key;
    }
    function isStorageAvailable() {
      try {
        const testKey = "__colorbox_storage_test__";
        window.localStorage.setItem(testKey, "test");
        window.localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    }
    const isLocalAvailable = isStorageAvailable();
    function safeB64Encode(str) {
      try {
        const base64 = window.btoa(unescape(encodeURIComponent(str)));
        return base64;
      } catch (error) {
        logError("safeB64Encode failed.", error);
        throw error;
      }
    }
    function safeB64Decode(str) {
      try {
        const decoded = decodeURIComponent(escape(window.atob(str)));
        return decoded;
      } catch (error) {
        logError("safeB64Decode failed.", error);
        throw error;
      }
    }
    function serializeStorageValue(value) {
      if (value == null) return "";
      const text = typeof value === "string" ? value : JSON.stringify(value);
      try {
        const encoded = safeB64Encode(text);
        return "__b64__:" + encoded;
      } catch (error) {
        return text;
      }
    }
    function parseStorageValue(value, scopedKey) {
      if (value == null) return null;
      if (typeof value !== "string") return value;
      let text = value;
      if (text.indexOf("__b64__:") === 0) {
        text = safeB64Decode(text.slice(8));
      }
      if (text.charAt(0) !== "{" && text.charAt(0) !== "[") {
        return text;
      }
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          if (!Array.isArray(parsed) && scopedKey && parsed[scopedKey] != null) {
            return parseStorageValue(parsed[scopedKey], scopedKey);
          }
        }
        return text;
      } catch (parseError) {
        if (text.charAt(0) === "{" && text.charAt(text.length - 1) === "}") {
          const escapedKey = (scopedKey || "").replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
          const pattern = new RegExp('^\\{\\s*"' + (escapedKey || '[^"]+') + '"\\s*:\\s*"(.*)"\\s*\\}\\s*$');
          const match = text.match(pattern);
          if (match) {
            let rawValue = match[1];
            rawValue = rawValue.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
            return parseStorageValue(rawValue, scopedKey);
          }
        }
        return text;
      }
    }
    function readLocalStorageValue(scopedKey) {
      if (!isLocalAvailable) return null;
      try {
        return parseStorageValue(window.localStorage.getItem(scopedKey), scopedKey);
      } catch (e) {
        return null;
      }
    }
    function writeLocalStorageValue(scopedKey, value) {
      if (!isLocalAvailable) return false;
      try {
        window.localStorage.setItem(scopedKey, serializeStorageValue(value));
        return true;
      } catch (e) {
        return false;
      }
    }
    function readLocalStorageAll() {
      const result = {};
      if (!isLocalAvailable) return result;
      try {
        const prefix = "cb_storage:" + pId + ":";
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.indexOf(prefix) === 0) {
            const rawKey = k.substring(prefix.length);
            const val = readLocalStorageValue(k);
            if (val !== null) {
              result[rawKey] = val;
            }
          }
        }
      } catch (e) {
      }
      return result;
    }
    function calculateStorageSize() {
      let size = 0;
      if (!isLocalAvailable) return size;
      try {
        const prefix = "cb_storage:" + pId + ":";
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.indexOf(prefix) === 0) {
            const val = window.localStorage.getItem(k);
            size += k.length + (val ? val.length : 0);
          }
        }
      } catch (e) {
      }
      return size;
    }
    function deleteLocalStorageValue(scopedKey) {
      if (!isLocalAvailable) return false;
      try {
        window.localStorage.removeItem(scopedKey);
        return true;
      } catch (e) {
        return false;
      }
    }
    function resolveProjectId() {
      return pId;
    }
    function logInfo(stage, detail) {
      console.log("[ColorboxAI.Storage] " + stage, detail || {});
    }
    function logError(stage, error, extra) {
      console.error("[ColorboxAI.Storage] Error: " + stage, error);
      try {
        const isBridgeError = stage.toLowerCase().indexOf("bridge") >= 0;
        if (isBridgeError && window.WebGuard && typeof window.WebGuard.hupuLog === "function") {
          window.WebGuard.hupuLog({
            type: "jsError",
            message: "[ColorboxAI.Storage] " + stage + ": " + (error && error.message || String(error)),
            stack: error && error.stack || new Error().stack || "",
            detail: Object.assign({
              projectId: pId,
              stage
            }, extra || {})
          });
        }
      } catch (e) {
        console.error("[ColorboxAI.Storage] Failed to report to WebGuard", e);
      }
    }
    function shouldUseBridge() {
      const ua = navigator.userAgent || "";
      return /kanqiu/i.test(ua);
    }
    function writeBridgeValue(scopedKey, value) {
      const payload = {
        method: "hupu.common.setValue",
        data: {
          key: scopedKey,
          value: serializeStorageValue(value)
        }
      };
      return new Promise(function(resolve, reject) {
        if (window.HupuBridge && typeof window.HupuBridge.send === "function") {
          window.HupuBridge.send(payload.method, payload.data).then(resolve).catch(reject);
        } else {
          reject(new Error("HupuBridge not available for storage set"));
        }
      });
    }
    function readBridgeValue(scopedKey) {
      const payload = {
        method: "hupu.common.getValue",
        data: { key: scopedKey }
      };
      return new Promise(function(resolve, reject) {
        if (window.HupuBridge && typeof window.HupuBridge.send === "function") {
          window.HupuBridge.send(payload.method, payload.data).then(function(res) {
            const val = res && res.value;
            resolve(parseStorageValue(val, scopedKey));
          }).catch(reject);
        } else {
          reject(new Error("HupuBridge not available for storage get"));
        }
      });
    }
    function setValue(key, value) {
      return Promise.resolve().then(function() {
        if (key == null || typeof key === "object") {
          const batch = key || {};
          const keys = Object.keys(batch);
          if (!keys.length) return { ok: true, size: calculateStorageSize(), bridgeSynced: false };
          let currentSize2 = calculateStorageSize();
          let delta2 = 0;
          const writeTasks = [];
          keys.forEach(function(k) {
            const scopedKey2 = resolveScopedKey(k);
            const val = batch[k];
            const rawVal2 = JSON.stringify(val);
            const oldRaw2 = isLocalAvailable ? window.localStorage.getItem(scopedKey2) : null;
            const keyDelta = scopedKey2.length + rawVal2.length - (oldRaw2 ? scopedKey2.length + oldRaw2.length : 0);
            delta2 += keyDelta;
            writeTasks.push({ scopedKey: scopedKey2, val });
          });
          if (currentSize2 + delta2 > MAX_STORAGE_BYTES) {
            throw new Error("Storage quota exceeded (max 5MB limit). Set value failed.");
          }
          let ok2 = true;
          const bridgeKeys = [];
          writeTasks.forEach(function(task) {
            const success = writeLocalStorageValue(task.scopedKey, task.val);
            if (!success) ok2 = false;
            bridgeKeys.push(task.scopedKey);
          });
          if (shouldUseBridge()) {
            const bridgePayload = {
              method: "hupu.common.setValue",
              data: {
                keys: bridgeKeys,
                values: keys.map(function(k) {
                  return serializeStorageValue(batch[k]);
                })
              }
            };
            return new Promise(function(resolve) {
              if (window.HupuBridge && typeof window.HupuBridge.send === "function") {
                window.HupuBridge.send(bridgePayload.method, bridgePayload.data).then(function(res) {
                  resolve({ ok: ok2, size: calculateStorageSize(), bridgeSynced: true, rawBridgeResult: res });
                }).catch(function(err) {
                  logError("Bridge batch write failed", err, { keys: bridgeKeys });
                  resolve({ ok: ok2, size: calculateStorageSize(), bridgeSynced: false, error: err });
                });
              } else {
                resolve({ ok: ok2, size: calculateStorageSize(), bridgeSynced: false });
              }
            }).then(function(result3) {
              logInfo("\u5199\u5165\u5B58\u50A8\u6570\u636E\u6210\u529F", {
                projectId: resolveProjectId(),
                input: batch,
                payload: bridgePayload,
                result: result3
              });
              return result3;
            });
          }
          const result2 = { ok: ok2, size: calculateStorageSize(), bridgeSynced: false };
          logInfo("\u5199\u5165\u5B58\u50A8\u6570\u636E\u6210\u529F", {
            projectId: resolveProjectId(),
            input: batch,
            payload: null,
            result: result2
          });
          return result2;
        }
        const storageKey = String(key);
        const scopedKey = resolveScopedKey(storageKey);
        const rawVal = JSON.stringify(value);
        const oldRaw = isLocalAvailable ? window.localStorage.getItem(scopedKey) : null;
        const currentSize = calculateStorageSize();
        const delta = scopedKey.length + rawVal.length - (oldRaw ? scopedKey.length + oldRaw.length : 0);
        if (currentSize + delta > MAX_STORAGE_BYTES) {
          throw new Error("Storage quota exceeded (max 5MB limit). Set value failed.");
        }
        let ok = true;
        if (value === void 0) {
          ok = deleteLocalStorageValue(scopedKey);
        } else {
          ok = writeLocalStorageValue(scopedKey, value);
        }
        if (shouldUseBridge()) {
          const bridgePayload = {
            method: "hupu.common.setValue",
            data: {
              key: scopedKey,
              value: serializeStorageValue(value)
            }
          };
          return writeBridgeValue(scopedKey, value).then(function(bridgeResult) {
            return { ok, key: storageKey, size: calculateStorageSize(), bridgeSynced: bridgeResult !== null };
          }).catch(function(err) {
            logError("Bridge write failed for key " + storageKey, err, { key: storageKey });
            return { ok, key: storageKey, size: calculateStorageSize(), bridgeSynced: false, error: err };
          }).then(function(result2) {
            logInfo("\u5199\u5165\u5B58\u50A8\u6570\u636E\u6210\u529F", {
              projectId: resolveProjectId(),
              input: value,
              payload: bridgePayload,
              result: result2
            });
            return result2;
          });
        }
        const result = { ok, key: storageKey, size: calculateStorageSize(), bridgeSynced: false };
        logInfo("\u5199\u5165\u5B58\u50A8\u6570\u636E\u6210\u529F", {
          projectId: resolveProjectId(),
          input: value,
          payload: null,
          result
        });
        return result;
      }).catch(function(error) {
        logError("\u5199\u5165\u5B58\u50A8\u6570\u636E\u5931\u8D25", error, { key });
        return Promise.reject(error);
      });
    }
    function getValue(key) {
      const hasKey = key != null && key !== "";
      const storageKey = hasKey ? String(key) : "";
      return Promise.resolve().then(function() {
        if (!hasKey) {
          const allValues = readLocalStorageAll();
          logInfo("\u8BFB\u53D6\u5B58\u50A8\u6570\u636E\u6210\u529F", {
            projectId: resolveProjectId(),
            key: "",
            scopedKey: "",
            source: "localStorage",
            result: allValues
          });
          return allValues;
        }
        const scopedKey = resolveScopedKey(storageKey);
        if (!shouldUseBridge()) {
          const localOnlyValue = readLocalStorageValue(scopedKey);
          logInfo("\u8BFB\u53D6\u5B58\u50A8\u6570\u636E\u6210\u529F", {
            projectId: resolveProjectId(),
            key: storageKey,
            scopedKey,
            source: "localStorage",
            result: localOnlyValue
          });
          return localOnlyValue;
        }
        return readBridgeValue(scopedKey).catch(function(err) {
          logError("Bridge read failed for key " + storageKey, err, { key: storageKey });
          throw err;
        }).then(function(bridgeValue) {
          if (bridgeValue != null) {
            logInfo("\u8BFB\u53D6\u5B58\u50A8\u6570\u636E\u6210\u529F", {
              projectId: resolveProjectId(),
              key: storageKey,
              scopedKey,
              source: "hupu.common.getValue",
              result: bridgeValue
            });
            return bridgeValue;
          }
          const localValue = readLocalStorageValue(scopedKey);
          logInfo("\u8BFB\u53D6\u5B58\u50A8\u6570\u636E\u6210\u529F", {
            projectId: resolveProjectId(),
            key: storageKey,
            scopedKey,
            source: "localStorage",
            result: localValue
          });
          return localValue;
        });
      }).catch(function(error) {
        logError("\u8BFB\u53D6\u5B58\u50A8\u6570\u636E\u5931\u8D25", error, { key: storageKey });
        return hasKey ? null : {};
      });
    }
    return {
      maxBytes: MAX_STORAGE_BYTES,
      setValue,
      getValue,
      set: setValue,
      get: getValue
    };
  }

  // src/iframe-runtime/index.ts
  (function() {
    const config = window.__COLORBOX_AI_CONFIG__ || {
      projectId: "",
      settings: {
        title: "",
        trackingCode: "",
        bizCategory: "",
        shareTitle: "",
        shareSubtitle: "",
        shareCover: ""
      },
      pagePi: ""
    };
    const { settings, projectId, pagePi } = config;
    const sessionId = "ai-runtime-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    window.__colorbox_runtime__ = true;
    window.__colorbox_ai_runtime__ = true;
    window.globalState = Object.assign({}, window.globalState || {}, {
      name: settings.title,
      pageTrackCode: settings.trackingCode,
      wxShareTitle: settings.shareTitle,
      wxShareSubTitle: settings.shareSubtitle,
      wxShareImage: settings.shareCover,
      bizCode: settings.bizCategory,
      webViewColor: settings.theme && settings.theme.webviewBackground,
      containerColor: settings.theme && settings.theme.containerBackground,
      pi: pagePi
    });
    if (settings.title) {
      document.title = settings.title;
    }
    function setupRuntimeIssueGuard() {
      if (window.__colorbox_ai_runtime_issue_guard__) return;
      window.__colorbox_ai_runtime_issue_guard__ = true;
      let lastTick = Date.now();
      window.setInterval(function() {
        const now = Date.now();
        const drift = now - lastTick - 1e3;
        if (drift > 3e3) {
          console.error("[ColorboxAI.Runtime] Main thread blocked for " + drift + "ms; possible long task or infinite loop.");
        }
        lastTick = now;
      }, 1e3);
    }
    const frameTrackDebugLog = [];
    function pushFrameTrackDebug(stage, detail) {
      const entry = { stage, detail: detail || {}, ts: Date.now() };
      frameTrackDebugLog.push(entry);
      if (frameTrackDebugLog.length > 200) {
        frameTrackDebugLog.shift();
      }
      try {
        console.log("[ColorboxAI.Track] " + stage, detail || {});
      } catch (error) {
      }
    }
    function createTrackTraceId() {
      return "trk_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    }
    function post(type, payload) {
      const trackTraceId = payload && payload.trackTraceId;
      try {
        if (!window.parent || window.parent === window) {
          if (type === "events.track") {
            pushFrameTrackDebug("frame.post.skip", {
              trackTraceId,
              reason: "no_parent_or_same_window"
            });
          }
          return;
        }
        window.parent.postMessage({
          protocol: "colorbox-ai-bridge",
          version: 1,
          direction: "frame-to-host",
          sessionId,
          projectId,
          type,
          payload: payload || {},
          timestamp: Date.now()
        }, "*");
        if (type === "events.track") {
          pushFrameTrackDebug("frame.post.ok", { trackTraceId, projectId });
        }
      } catch (error) {
        if (type === "events.track") {
          pushFrameTrackDebug("frame.post.error", {
            trackTraceId,
            message: error && error.message || String(error)
          });
        }
      }
    }
    window.ColorboxAI = window.ColorboxAI || {};
    window.ColorboxAI.project = window.ColorboxAI.project || {
      id: projectId,
      settings,
      getSettings: function() {
        return Promise.resolve(settings);
      }
    };
    if (typeof window.ColorboxAI.configure === "function") {
      window.ColorboxAI.configure({
        trackingCode: settings.trackingCode,
        pi: pagePi
      });
    }
    window.__colorbox_ai_track_debug_frame__ = frameTrackDebugLog;
    window.ColorboxAI.track = function (trackParams) {
      const trackTraceId = createTrackTraceId();
      pushFrameTrackDebug("frame.call", {
        trackTraceId,
        params: trackParams || {},
        hasParent: !!(window.parent && window.parent !== window)
      });
      try {
        const customDebugger = window.ColorboxCustomDebugger;
        if (customDebugger && typeof customDebugger.addLog === "function") {
          customDebugger.addLog(trackParams || {});
        }
      } catch (error) {
        pushFrameTrackDebug("frame.debug.error", {
          trackTraceId,
          message: error && error.message || String(error)
        });
      }
      post("events.track", { trackParams: trackParams || {}, trackTraceId });
    };
    window.ColorboxAI.navigateTo = function(url, target) {
      post("navigation.open", { url, target });
    };
    window.ColorboxAI.openUrl = window.ColorboxAI.navigateTo;
    window.ColorboxAI.bbs = window.ColorboxAI.bbs || createLocalFallbackApi();
    window.ColorboxAI.security = window.ColorboxAI.security || createLocalSecurityFallbackApi();
    window.ColorboxAI.score = window.ColorboxAI.score || createLocalScoreFallbackApi();
    window.ColorboxAI.oss = window.ColorboxAI.oss || createLocalOssFallbackApi();
    window.ColorboxAI.auth = window.ColorboxAI.auth || createLocalAuthFallbackApi();
    window.ColorboxAI.storage = window.ColorboxAI.storage || createColorboxStorageApi({ projectId });
    window.ColorboxAI.runtime = window.ColorboxAI.runtime || {};
    window.ColorboxAI.runtime.log = function() {
      post("runtime.log", { args: Array.prototype.slice.call(arguments) });
    };
    window.ColorboxAI.hupuLog = function(params) {
      if (window.WebGuard && typeof window.WebGuard.hupuLog === "function") {
        window.WebGuard.hupuLog(params);
      }
    };
    window.addEventListener("error", function(event) {
      if (event.target && event.target !== window && event.target !== document) {
        return;
      }
      const errorMsg = event.message || event.error && event.error.message || "Unknown error";
      console.error("[ColorboxAI.Runtime] Uncaught error:", errorMsg);
      post("runtime.error", {
        message: errorMsg,
        sourceFile: event.filename || "",
        line: event.lineno || 0,
        column: event.colno || 0,
        stack: event.error && event.error.stack || ""
      });
    }, true);
    window.addEventListener("unhandledrejection", function(event) {
      const reason = event.reason || {};
      console.error("[ColorboxAI.Runtime] Unhandled promise rejection:", reason);
      post("runtime.error", {
        message: reason.message || String(reason),
        stack: reason.stack || ""
      });
    });
    setupRuntimeIssueGuard();
    post("runtime.ready", { href: location.href });
  })();
})();

})();
