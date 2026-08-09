const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { console };
context.window = context;
vm.createContext(context);

[
  'js/data/league_players.js',
  'js/player_display_names.js',
  'js/data/league_schedule.js',
  'js/data/player_archetypes.js',
  'js/data/simulation_config.js',
  'js/data/fictional_team_names.js',
  'js/cartoon_art.js'
].forEach((relative) => {
  vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });
});

const result = vm.runInContext(`({
  teams: LEAGUE_TEAM_IDS.length,
  rosters: Object.keys(LEAGUE_PLAYER_DATA).length,
  scheduleTeams: new Set(generateLeagueSchedule({
    teams: LEAGUE_TEAM_IDS,
    conference: SIM_CONFIG.CONFERENCE,
    divisions: SIM_CONFIG.DIVISIONS,
    seed: 'localized-runtime-validation'
  }).flatMap(game => [game.home, game.away])).size,
  attributes: SIM_CONFIG.ATTR_LIST.length,
  newYork: SIM_CONFIG.TEAM_NAMES.NYK,
  logos: Object.keys(window.TEAM_LOGOS).length,
  playerCount: LEAGUE_TEAM_IDS.reduce((count, team) => count + LEAGUE_PLAYER_DATA[team].length, 0),
  uniqueIds: new Set(LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team].map(player => player.id))).size,
  legacyNameFields: LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team]).filter(player => player.name || player.nameEN).length,
  headshot: getPlayerHeadshotStyle('P0452', 30)
})`, context);

const failures = [];
if (result.teams !== 30 || result.rosters !== 30 || result.scheduleTeams !== 30) failures.push('联盟球队或赛程数量发生变化');
if (result.attributes !== 13) failures.push('能力属性数量发生变化');
if (result.newYork !== '纽约大鲨鱼') failures.push('球队名称覆盖失败');
if (result.logos !== 30) failures.push('球队卡通徽章数量错误');
if (result.playerCount !== 525 || result.uniqueIds !== 525) failures.push('球员 ID 数量或唯一性错误');
if (result.legacyNameFields !== 0) failures.push('球员数据仍包含英文姓名字段');
if (!/media\/generated\/players\/avatar-\d{2}\.png/.test(result.headshot)) failures.push('球员卡通头像未接入');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result));
}
