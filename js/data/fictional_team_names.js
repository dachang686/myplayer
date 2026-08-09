(function installFictionalTeamNames(global) {
  'use strict';

  var names = {
    ATL: '亚特兰大鸡仔', BOS: '波士顿东北虎', BKN: '布鲁克林钢龙', CHA: '夏洛特王冠', CHI: '芝加哥熊猫',
    CLE: '克利夫兰冰原狼', DAL: '达拉斯大侠', DEN: '丹佛挖土机', DET: '底特律机车', GSW: '金州懦夫',
    HOU: '休斯敦意大利炮', IND: '印第安纳散步', LAC: '洛杉矶大潜艇', LAL: '洛杉矶长江', MEM: '孟菲斯河熊',
    MIA: '迈阿密飓风', MIL: '密尔沃基麦穗', MIN: '明尼苏达雪狼', NOP: '新奥尔良铜乐', NYK: '纽约大鲨鱼',
    OKC: '俄克拉荷马城雷鸟', ORL: '奥兰多刘谦', PHI: '费城很多人', PHX: '菲尼克斯火鸟', POR: '波特兰常青',
    SAC: '萨克拉门托皇帝', SAS: '圣安东尼奥牧马', TOR: '多伦多枫港', UTA: '盐湖城白峰', WAS: '华盛顿故宫'
  };

  var config = typeof SIM_CONFIG !== 'undefined' ? SIM_CONFIG : global.SIM_CONFIG;
  if (config && config.TEAM_NAMES) {
    Object.keys(names).forEach(function (team) {
      config.TEAM_NAMES[team] = names[team];
    });
  }
  global.FICTIONAL_TEAM_NAMES = names;
})(window);
