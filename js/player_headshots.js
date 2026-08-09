
/** 名字修正映射（ASCII名 → CDN带重音名） */
var HEADSHOT_NAME_FIX = {
  'Luka Doncic': 'Luka Dončić',
  'Nikola Jokic': 'Nikola Jokić',
  'Nikola Jovic': 'Nikola Jović',
  'Nikola Vucevic': 'Nikola Vučević',
  'Nikola Topic': 'Nikola Topić',
  'Bogdan Bogdanovic': 'Bogdan Bogdanović',
  'Dennis Schroder': 'Dennis Schröder',
  'Kristaps Porzingis': 'Kristaps Porziņģis',
  'Jonas Valanciunas': 'Jonas Valančiūnas',
  'Jusuf Nurkic': 'Jusuf Nurkić',
  'Vit Krejci': 'Vit Krejčí',
  'Moussa Diabate': 'Moussa Diabaté',
  'Tidjane Salaun': 'Tidjane Salaün',
  'Karlo Matkovic': 'Karlo Matković',
  'De\'Aaron Fox': 'DeAaron Fox',
  'D\'Angelo Russell': 'D\'Angelo Russell',
  'De\'Andre Hunter': "De'Andre Hunter",
  'Royce O\'Neale': "Royce O'Neale",
  'Day\'Ron Sharpe': 'DayRon Sharpe',
  'Jae\'Sean Tate': "Jae'Sean Tate",
  'De\'Anthony Melton': "De'Anthony Melton",
  'Ja\'Kobe Walter': "Ja'Kobe Walter",
  'Nae\'Qwan Tomlin': "Nae'Qwan Tomlin",
  'Kel\'el Ware': "Kel'el Ware",
  'KyShawn George': "Kyshawn George",
};
/** 获取球员头像样式（仅 NBA CDN） */
function getPlayerHeadshotStyle(playerName, displaySize) {
  if (!playerName) return '';
  displaySize = displaySize || 30;
  if (typeof NBA_PLAYER_IMAGES !== 'undefined') {
    // 尝试名字修正后再查找
    var fixedName = HEADSHOT_NAME_FIX[playerName] || playerName;
    var pid = NBA_PLAYER_IMAGES[fixedName];
    if (!pid) {
      // 模糊匹配
      for (var key in NBA_PLAYER_IMAGES) {
        if (key.indexOf(playerName) >= 0 || playerName.indexOf(key) >= 0) {
          pid = NBA_PLAYER_IMAGES[key]; break;
        }
        // 也用修正名做模糊匹配
        if (fixedName !== playerName && (key.indexOf(fixedName) >= 0 || fixedName.indexOf(key) >= 0)) {
          pid = NBA_PLAYER_IMAGES[key]; break;
        }
      }
    }
    if (pid) {
      return 'background-image:url(assets/cdn.nba.com/headshots/nba/latest/260x190/' + pid + '.png);background-size:cover;background-position:center;background-repeat:no-repeat;width:' + (displaySize||30) + 'px;height:' + (displaySize||30) + 'px;';
    }
  }
  return '';
}
