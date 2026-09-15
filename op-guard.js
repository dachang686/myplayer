/*
 * OpenInstall init 响应守卫
 * 必须在 openinstall SDK 之前加载。
 *
 * 背景：SDK 对 /init3 响应的 st 做数字类型断言，st 非数字时抛异常，其 catch 分支会执行
 *       sat && 导航表[sm](su)，用户未做任何操作即被带到 su。实测只有 st 为数字时不触发。
 * 做法：把 st 规整为有限数字（尽量保值），堵住异常路径；并在 su 为 http/https 时关闭 sat
 *       作为第二道防线。su 为自定义 scheme（唤起已安装 App）时放行。其余字段一律不动。
 */
(function () {
  'use strict';
  if (typeof XMLHttpRequest === 'undefined') return;

  var P = XMLHttpRequest.prototype;
  var desc = Object.getOwnPropertyDescriptor(P, 'responseText');
  if (!desc || !desc.get) return;

  // 置为 false 可连自定义 scheme 的自动唤起一并关闭
  var ALLOW_SCHEME_AUTO_WAKEUP = true;

  var KEY = [0xa0, 0x2d, 0xeb, 0xf1, 0xfb, 0x7b, 0x7c, 0xc1, 0xe3, 0xd3, 0xab, 0xff,
             0x89, 0x3e, 0x49, 0x1f, 0x25, 0xea, 0x7a, 0xfc, 0x39, 0x4f, 0x38, 0x4d,
             0x39, 0x89, 0xb5, 0x1e, 0x28, 0x68, 0x34, 0x0b];
  var AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  function fromB64(s) {
    var out = [], buf = 0, bits = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '=') break;
      var v = AB.indexOf(c);
      if (v < 0) return null;
      buf = (buf << 6) | v;
      bits += 6;
      if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 0xff); }
    }
    return out;
  }

  function toB64(b) {
    var s = '', i = 0, n;
    for (; i + 2 < b.length; i += 3) {
      n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
      s += AB[(n >> 18) & 63] + AB[(n >> 12) & 63] + AB[(n >> 6) & 63] + AB[n & 63];
    }
    var rem = b.length - i;
    if (rem === 1) { n = b[i] << 16; s += AB[(n >> 18) & 63] + AB[(n >> 12) & 63]; }
    else if (rem === 2) { n = (b[i] << 16) | (b[i + 1] << 8); s += AB[(n >> 18) & 63] + AB[(n >> 12) & 63] + AB[(n >> 6) & 63]; }
    return s;
  }

  function xor(b) {
    for (var i = 0; i < b.length; i++) b[i] ^= KEY[i % KEY.length];
    return b;
  }

  function toBytes(str) {
    var u = encodeURIComponent(str), out = [];
    for (var i = 0; i < u.length; i++) {
      if (u.charAt(i) === '%') { out.push(parseInt(u.substr(i + 1, 2), 16)); i += 2; }
      else out.push(u.charCodeAt(i));
    }
    return out;
  }

  function toStr(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) s += (b[i] < 0x10 ? '%0' : '%') + b[i].toString(16);
    try { return decodeURIComponent(s); } catch (e) { return null; }
  }

  // 自动唤起只放行自定义 scheme，http/https 一律视为外站跳转
  function isAppScheme(u) {
    u = String(u == null ? '' : u);
    return /^[a-z][a-z0-9+.\-]*:/i.test(u) && !/^https?:/i.test(u);
  }

  var origOpen = P.open;
  P.open = function (method, url) {
    try { this.__oiUrl = url; } catch (e) {}
    return origOpen.apply(this, arguments);
  };

  Object.defineProperty(P, 'responseText', {
    configurable: true,
    get: function () {
      var raw = desc.get.call(this);
      try {
        var url = String(this.__oiUrl || this.responseURL || '');
        if (!raw || !/\/init3(\?|$)/.test(url)) return raw;

        var bytes = fromB64(raw);
        if (!bytes) return raw;
        var json = toStr(xor(bytes));
        if (!json) return raw;
        var cfg = JSON.parse(json);
        var touched = false;

        // SDK 对 st 做数字类型断言，非数字会抛异常并走进 catch 分支触发自动导航。
        // st 同时被当作唤起判定超时使用，故尽量保值。
        if (typeof cfg.st !== 'number' || !isFinite(cfg.st)) {
          var n = parseInt(cfg.st, 10);
          cfg.st = isFinite(n) ? n : 0;
          touched = true;
        }

        if (cfg.sat && !(ALLOW_SCHEME_AUTO_WAKEUP && isAppScheme(cfg.su))) {
          cfg.sat = false;
          touched = true;
        }

        if (!touched) return raw;
        return toB64(xor(toBytes(JSON.stringify(cfg))));
      } catch (e) {
        return raw;
      }
    }
  });
})();
