(function loadVaH5Sdk() {
  var sdkUrl = "assets/activity-static.hoopchina.com.cn/files/26728-c65ifqrc-upload-1785209154529-12.js";
  if (document.getElementById("va-h5-sdk")) return;

  var script = document.createElement("script");
  script.id = "va-h5-sdk";
  script.src = sdkUrl + "?t=" + Math.floor(Date.now() / 60000);
  script.onload = function() {
    window._sdkReady = true;
    try {
      window.dispatchEvent && window.dispatchEvent(new Event("va-sdk-ready"));
    } catch (e) {}
  };
  document.head.appendChild(script);
})();

(function initWebGuard() {
  if (window.WebGuard && window.WebGuard.init) {
    window.WebGuard.init({
      application: "colorbox-activity-fed",
      ignoreHttpList: ["goblin", "api/v2/user"]
    });
  }
})();
