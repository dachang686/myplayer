(function installCartoonArt(global) {
  'use strict';

  var TEAM_IDS = [
    'ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW',
    'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK',
    'OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'
  ];
  var PLAYER_AVATAR_COUNT = 16;

  function numberedAsset(folder, prefix, index) {
    return 'media/generated/' + folder + '/' + prefix + '-' + String(index).padStart(2, '0') + '.png';
  }

  function stableIndex(value, count) {
    var hash = 2166136261;
    var text = String(value || 'player');
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % count;
  }

  global.TEAM_LOGOS = {};
  TEAM_IDS.forEach(function (team, index) {
    global.TEAM_LOGOS[team] = numberedAsset('teams', 'team', index);
  });

  global.getCartoonPlayerAvatar = function getCartoonPlayerAvatar(playerId) {
    return numberedAsset('players', 'avatar', stableIndex(playerId, PLAYER_AVATAR_COUNT));
  };

  global.getPlayerHeadshotStyle = function getPlayerHeadshotStyle(playerId, displaySize) {
    if (!playerId) return '';
    var size = displaySize || 30;
    return 'background-image:url(' + global.getCartoonPlayerAvatar(playerId) + ');' +
      'background-size:cover;background-position:center 18%;background-repeat:no-repeat;' +
      'width:' + size + 'px;height:' + size + 'px;';
  };
})(window);
