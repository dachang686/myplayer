const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  console: { log() {}, error() {} },
  window: {},
  STATE: {
    careerTeam: null,
    finalOVR: 0,
    position: null,
    attrs: {},
    career: { seasonCount: 0, currentAge: 18, flags: {}, seasons: [] },
    season: { leaguePlayerSeasonStats: {} },
    _prevStandings: {},
    _teamHistory: {},
    _leagueChanges: {},
  },
};

let seed = 42424242;
context.rngNext = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
context.canPlayPosition = (playerPos, targetPos) => String(playerPos || '').split('/').map(value => value.trim()).includes(targetPos);
context.calcTeamLineup = teamId => {
  const roster = context.LEAGUE_PLAYER_DATA[teamId] || [];
  const starters = {};
  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(position => {
    const candidate = roster
      .filter(player => context.canPlayPosition(player.pos, position))
      .sort((a, b) => (Number(b.ovr) || 0) - (Number(a.ovr) || 0))[0];
    if (candidate) starters[position] = candidate;
  });
  return { starters, bench: roster.slice().sort((a, b) => (Number(b.ovr) || 0) - (Number(a.ovr) || 0)).slice(5, 10) };
};

vm.createContext(context);
function run(relative, suffix) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  vm.runInContext(source + (suffix || ''), context, { filename: relative });
}

run('js/data/league_players.js', '\nthis.LEAGUE_PLAYER_DATA = LEAGUE_PLAYER_DATA; this.LEAGUE_TEAM_IDS = LEAGUE_TEAM_IDS;');
run('js/data/simulation_config.js', '\nthis.SIM_CONFIG = SIM_CONFIG;');
context.ATTR_KEYS = context.SIM_CONFIG.ATTR_LIST;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ageStart = html.indexOf('player-age-data');
const ageJsonStart = html.indexOf('>', ageStart) + 1;
const ageJsonEnd = html.indexOf('</script>', ageJsonStart);
context.document = { getElementById: id => id === 'player-age-data' ? { textContent: html.slice(ageJsonStart, ageJsonEnd) } : null };
context.getMyPlayerDisplayName = () => '用户';
context.isMvpStar = () => false;

run('js/offseason.js');
vm.runInContext(`
  calculateContractStayRate = function() { return 0; };
  updatePlayerRoleSatisfactionHistory = function() {};
  isMvpStar = function() { return false; };
`, context);

const teamChangeSummary = vm.runInContext(`(() => {
  STATE._leagueChanges = {
    freeAgents: [{ team: 'ATL', name: '离队球员' }, { team: 'BOS', name: '其他球队球员' }],
    retired: [{ team: 'ATL', displayName: '退役球员', hidden: false }],
    freeSignings: [{ to: 'ATL', name: '签约球员' }, { to: 'BOS', name: '其他签约球员' }],
    stayed: [{ team: 'ATL', name: '续约球员' }, { team: 'BOS', name: '其他续约球员' }],
    rookies: [{ team: 'ATL', name: '新秀球员' }],
    trades: [
      { from: 'ATL', to: 'BOS', playerA: '加入球员', playerB: '离队球员' },
      { from: 'CLE', to: 'ATL', playerA: '加入球员2', playerB: '离队球员2' },
      { from: 'BOS', to: 'CLE', playerA: '无关球员', playerB: '无关球员2' }
    ]
  };
  return getCareerTeamOffseasonChanges('ATL');
})()`, context);
if (teamChangeSummary.departures.length !== 1
  || teamChangeSummary.retired.length !== 1
  || teamChangeSummary.signings.length !== 1
  || teamChangeSummary.renewals.length !== 1
  || teamChangeSummary.rookies.length !== 1
  || teamChangeSummary.trades.length !== 2) {
  console.error(`球队人员变化汇总过滤错误：${JSON.stringify(teamChangeSummary)}`);
  process.exit(1);
}
context.STATE._leagueChanges = {};

const originalIds = vm.runInContext('LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team] || []).map(player => player.id)', context);
vm.runInContext('LEAGUE_TEAM_IDS.forEach(team => { STATE._prevStandings[team] = { wins: 41, losses: 41 }; STATE._teamHistory[team] = [0.5]; });', context);
vm.runInContext('evolveLeague();', context);
const firstSeasonRetired = vm.runInContext('(STATE._leagueChanges.retired || []).slice()', context);
vm.runInContext('evolveLeague();', context);

const beforeAssignment = vm.runInContext(`(() => {
  const players = LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team] || []);
  const freeAgents = STATE._freeAgentPool || [];
  const retired = (STATE._leagueChanges && STATE._leagueChanges.retired) || [];
  const ids = players.map(player => player.id).concat(freeAgents.map(player => player.id), retired.map(row => row.playerId));
  const ovrConsistency = freeAgents.every(player => isGeneratedLeaguePlayer(player)
    ? Math.round(calcOVR(player, player.pos)) === Math.round(player.ovr)
    : player._ovrAnchorVersion === LEAGUE_OVR_ANCHOR_VERSION
      && Number.isFinite(Number(player._sourceOvr)));
  return { roster: players.length, freeAgents: freeAgents.length, retired: retired.length, unique: new Set(ids).size, ids: ids.length, ovrConsistency };
})()`, context);

const failures = [];
if (beforeAssignment.ids !== beforeAssignment.unique) failures.push(`第二赛季演变后存在重复身份：${JSON.stringify(beforeAssignment)}`);
if (!beforeAssignment.ovrConsistency) failures.push('FA 未遵守现实球员 OVR 锚点/生成球员属性直算规则');

vm.runInContext('assignFreeAgents();', context);
const afterAssignment = vm.runInContext(`(() => {
  const players = LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team] || []);
  const freeAgents = STATE._freeAgentPool || [];
  const retired = (STATE._leagueChanges && STATE._leagueChanges.retired) || [];
  const ids = players.map(player => player.id).concat(freeAgents.map(player => player.id), retired.map(row => row.playerId));
  const locate = id => ({ roster: players.filter(player => player.id === id).length, freeAgent: freeAgents.filter(player => player.id === id).length, retired: retired.filter(row => row.playerId === id).length });
  const rosterCounts = LEAGUE_TEAM_IDS.map(team => ({ team, count: (LEAGUE_PLAYER_DATA[team] || []).length }));
  return { roster: players.length, freeAgents: freeAgents.length, retired: retired.length, unique: new Set(ids).size, ids: ids.length, missing: [], rosterCounts, jokic: locate('P0120'), lebron: locate('P0379') };
})()`, context);

const afterIds = vm.runInContext(`(() => {
  const players = LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team] || []);
  const freeAgents = STATE._freeAgentPool || [];
  const retired = (STATE._leagueChanges && STATE._leagueChanges.retired) || [];
  return new Set(players.map(player => player.id).concat(freeAgents.map(player => player.id), retired.map(row => row.playerId)));
})()`, context);
firstSeasonRetired.forEach(row => afterIds.add(row.playerId));
afterAssignment.missing = originalIds.filter(id => !afterIds.has(id));
afterAssignment.historicalRetired = firstSeasonRetired.length + afterAssignment.retired;

if (afterAssignment.ids !== afterAssignment.unique) failures.push(`自由市场分配后存在重复身份：${JSON.stringify(afterAssignment)}`);
if (afterAssignment.missing.length) failures.push(`生命周期中丢失球员：${afterAssignment.missing.join(',')}`);
if (afterAssignment.rosterCounts.some(row => row.count > 18)) failures.push(`自由市场完成后存在超员球队：${JSON.stringify(afterAssignment.rosterCounts.filter(row => row.count > 18))}`);
if (afterAssignment.ids + firstSeasonRetired.length !== originalIds.length) failures.push(`跨赛季身份总数异常：${JSON.stringify(afterAssignment)}`);
for (const [id, location] of Object.entries({ P0120: afterAssignment.jokic, P0379: afterAssignment.lebron })) {
  if (location.roster + location.freeAgent + location.retired !== 1) failures.push(`${id} 生命周期归属异常：${JSON.stringify(location)}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({ beforeAssignment, afterAssignment }, null, 2));
