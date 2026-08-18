(function (global) {
  'use strict';

  var STORAGE_KEY = 'court-forge-language';
  var DEFAULT_LANGUAGE = 'en';
  var SOURCE_LANGUAGE = 'zh-CN';
  var SUPPORTED_LANGUAGES = ['en', SOURCE_LANGUAGE];
  var CJK_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/;
  var ATTRIBUTE_NAMES = ['alt', 'aria-label', 'placeholder', 'title', 'value'];
  var translations = (global.COURT_FORGE_TRANSLATIONS && global.COURT_FORGE_TRANSLATIONS.en) || {};
  var trie = null;

  function readLanguage() {
    try {
      var saved = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED_LANGUAGES.indexOf(saved) !== -1) return saved;
    } catch (error) {}
    return DEFAULT_LANGUAGE;
  }

  var language = readLanguage();
  document.documentElement.lang = language;

  function buildTrie() {
    var root = Object.create(null);
    Object.keys(translations).forEach(function (source) {
      if (!source || !CJK_PATTERN.test(source)) return;
      var node = root;
      for (var index = 0; index < source.length; index += 1) {
        var character = source.charAt(index);
        node[character] = node[character] || Object.create(null);
        node = node[character];
      }
      node.$ = translations[source];
    });
    return root;
  }

  function translateFragments(value) {
    if (!CJK_PATTERN.test(value)) return value;
    if (!trie) trie = buildTrie();

    var output = '';
    var cursor = 0;
    while (cursor < value.length) {
      var node = trie;
      var probe = cursor;
      var bestTranslation = null;
      var bestEnd = cursor;

      while (probe < value.length && node[value.charAt(probe)]) {
        node = node[value.charAt(probe)];
        probe += 1;
        if (node.$) {
          bestTranslation = node.$;
          bestEnd = probe;
        }
      }

      if (bestTranslation !== null) {
        output += bestTranslation;
        cursor = bestEnd;
      } else {
        output += value.charAt(cursor);
        cursor += 1;
      }
    }
    return output;
  }

  function preserveOuterWhitespace(source, translated) {
    var leading = source.match(/^\s*/)[0];
    var trailing = source.match(/\s*$/)[0];
    return leading + translated + trailing;
  }

  function translate(value, variables) {
    if (value === null || value === undefined) return value;
    var source = String(value);
    var result = source;

    if (language === 'en' && CJK_PATTERN.test(source)) {
      var trimmed = source.trim();
      if (translations[source]) result = translations[source];
      else if (translations[trimmed]) result = preserveOuterWhitespace(source, translations[trimmed]);
      else result = translateFragments(source);
    }

    if (variables) {
      Object.keys(variables).forEach(function (key) {
        result = result.replace(new RegExp('\\{' + key + '\\}', 'g'), String(variables[key]));
      });
    }
    return result;
  }

  function shouldIgnore(node) {
    var element = node.nodeType === 1 ? node : node.parentElement;
    if (!element) return false;
    return Boolean(element.closest('script, style, noscript, textarea, [data-i18n-ignore]'));
  }

  function translateAttributes(element) {
    if (!element || element.nodeType !== 1 || shouldIgnore(element)) return;
    ATTRIBUTE_NAMES.forEach(function (attribute) {
      if (!element.hasAttribute(attribute)) return;
      var current = element.getAttribute(attribute);
      var next = translate(current);
      if (next !== current) element.setAttribute(attribute, next);
    });
  }

  function translateDom(root) {
    if (language !== 'en' || !root) return;
    if (root.nodeType === 3) {
      if (!shouldIgnore(root)) {
        var translatedText = translate(root.nodeValue);
        if (translatedText !== root.nodeValue) root.nodeValue = translatedText;
      }
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;

    if (root.nodeType === 1) translateAttributes(root);
    var elementRoot = root.nodeType === 9 ? root.documentElement : root;
    if (!elementRoot) return;
    elementRoot.querySelectorAll('*').forEach(translateAttributes);

    var walker = document.createTreeWalker(elementRoot, NodeFilter.SHOW_TEXT);
    var textNode;
    while ((textNode = walker.nextNode())) {
      if (shouldIgnore(textNode)) continue;
      var next = translate(textNode.nodeValue);
      if (next !== textNode.nodeValue) textNode.nodeValue = next;
    }
  }

  function wrapTextMethod(target, methodName, textArgumentIndex) {
    if (!target || typeof target[methodName] !== 'function') return;
    var original = target[methodName];
    target[methodName] = function () {
      var args = Array.prototype.slice.call(arguments);
      args[textArgumentIndex] = translate(args[textArgumentIndex]);
      return original.apply(this, args);
    };
  }

  function installOutputAdapters() {
    wrapTextMethod(global, 'alert', 0);
    wrapTextMethod(global, 'confirm', 0);
    wrapTextMethod(global, 'prompt', 0);

    if (global.CanvasRenderingContext2D && global.CanvasRenderingContext2D.prototype) {
      wrapTextMethod(global.CanvasRenderingContext2D.prototype, 'fillText', 0);
      wrapTextMethod(global.CanvasRenderingContext2D.prototype, 'strokeText', 0);
      wrapTextMethod(global.CanvasRenderingContext2D.prototype, 'measureText', 0);
    }
  }

  function createLanguageButton() {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'language-toggle';
    button.setAttribute('data-i18n-ignore', '');
    button.textContent = language === 'en' ? '中文' : 'EN';
    button.setAttribute('aria-label', language === 'en' ? 'Switch to Chinese' : '切换到英文');
    button.title = button.getAttribute('aria-label');
    button.addEventListener('click', function () {
      setLanguage(language === 'en' ? SOURCE_LANGUAGE : 'en');
    });
    return button;
  }

  function mountLanguageButton() {
    var homeNavbar = document.querySelector('#screen-menu .navbar');
    if (homeNavbar && !homeNavbar.querySelector('.language-toggle')) {
      var helpButton = homeNavbar.querySelector('.home-help-link');
      var actions = document.createElement('div');
      actions.className = 'language-actions';
      if (helpButton) actions.appendChild(helpButton);
      actions.insertBefore(createLanguageButton(), actions.firstChild);
      homeNavbar.appendChild(actions);
    }

    var managerTopbar = document.querySelector('.manager-topbar');
    if (managerTopbar && !managerTopbar.querySelector('.language-toggle')) {
      managerTopbar.appendChild(createLanguageButton());
    }
  }

  function setLanguage(nextLanguage) {
    if (SUPPORTED_LANGUAGES.indexOf(nextLanguage) === -1) return;
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch (error) {}
    global.location.reload();
  }

  function start() {
    installOutputAdapters();
    mountLanguageButton();
    translateDom(document);

    var observer = new MutationObserver(function (records) {
      if (language !== 'en') return;
      records.forEach(function (record) {
        if (record.type === 'characterData') translateDom(record.target);
        record.addedNodes.forEach(translateDom);
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  global.I18N = Object.freeze({
    defaultLanguage: DEFAULT_LANGUAGE,
    getLanguage: function () { return language; },
    setLanguage: setLanguage,
    t: translate,
    translateDom: translateDom,
  });
  global.t = translate;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
