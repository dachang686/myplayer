window.__HUPU_GAME_OFFLINE__ = true;
window.open = function(){ return null; };
(function(){
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if (nativeFetch) {
    window.fetch = function(input, init) {
      try {
        var raw = typeof input === 'string' ? input : input.url;
        var target = new URL(raw, location.href);
        if (target.origin !== location.origin) {
          return Promise.resolve(new Response('{}', {status:200,headers:{'Content-Type':'application/json'}}));
        }
      } catch (e) {}
      return nativeFetch(input, init);
    };
  }
  try { navigator.sendBeacon = function(){ return true; }; } catch (e) {}
})();
  
