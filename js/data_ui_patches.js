(function fixPlayerCN() {
  var fixMap = {
    "Tamar Bates": "塔马尔贝茨",
    "Trey Lyles": "特雷-莱尔斯"
  };

  if (typeof NBA2K_TEAMS !== "undefined" && typeof NBA2K_DATA !== "undefined") {
    NBA2K_TEAMS.forEach(function(team) {
      (NBA2K_DATA[team] || []).forEach(function(player) {
        if (fixMap[player.name]) player.cname = fixMap[player.name];
      });
    });
  }
})();

(function patchTeamLogoVisibility() {
  var originalGetTeamLogoHTML = window.getTeamLogoHTML;
  if (typeof originalGetTeamLogoHTML === "function") {
    window.getTeamLogoHTML = function(team, size) {
      if (window._HIDE_TEAM_LOGOS) return "";
      return originalGetTeamLogoHTML(team, size);
    };
  }
})();
