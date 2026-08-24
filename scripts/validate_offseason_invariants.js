const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  console: { log() {}, error() {} },
  window: {},
  STATE: { careerTeam: null, finalOVR: 0, career: {}, season: {} },
  rngNext: () => 0.5,
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
context.document = {
  getElementById(id) {
    return id === 'player-age-data' ? { textContent: html.slice(ageJsonStart, ageJsonEnd) } : null;
  },
};
context.getMyPlayerDisplayName = () => '用户';
context.canPlayPosition = (playerPos, targetPos) => String(playerPos || '').split('/').map(value => value.trim()).includes(targetPos);
context.calcTeamLineup = () => ({ starters: {} });

run('js/offseason.js');

context._rawRosterCounts = vm.runInContext('LEAGUE_TEAM_IDS.map(team => ({ team, count: (LEAGUE_PLAYER_DATA[team] || []).length }))', context);
vm.runInContext('enforceLeagueRosterCapacity(null, { reason: "validator_initial_capacity" });', context);

const result = vm.runInContext(`(() => {
  const ageAudit = validateLeaguePlayerAgeData();
  const rows = LEAGUE_TEAM_IDS.map(team => ({ team, payroll: getTeamPayroll(team) }))
    .sort((a, b) => a.payroll - b.payroll);
  const total = rows.reduce((sum, row) => sum + row.payroll, 0);
  const players = LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team] || []);
  const freeAgents = (STATE._freeAgentPool || []).slice();
  const currentPlayers = players.concat(freeAgents);
  const p0168 = currentPlayers.find(player => player.id === 'P0168');
  const testSuperstar = { id: 'TEST-SUPERSTAR', ovr: 98, pos: 'C', _age: 31, _origTeam: 'DEN', _lastTeam: 'DEN', _teamTenure: 5, _birdTeam: 'DEN' };
  const superstarOfferTeams = LEAGUE_TEAM_IDS.map(team => buildContractOffer(testSuperstar, team, {
    source: 'free_agent', round: 0, birdRights: team === testSuperstar._origTeam,
  })).filter(Boolean).map(offer => offer.teamId);
  const initialRosterCounts = LEAGUE_TEAM_IDS.map(team => ({ team, count: getTeamRosterCount(team) }));
  const initialRosterViolations = initialRosterCounts.filter(row => row.count > FREE_AGENT_MARKET.rosterLimit);

  applyDraftClass2026();
  const postDraftPlayers = LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team] || []);
  const postDraftFreeAgents = STATE._freeAgentPool || [];
  const postDraftIds = postDraftPlayers.map(player => player.id).concat(postDraftFreeAgents.map(player => player.id));
  const postDraftRosterCounts = LEAGUE_TEAM_IDS.map(team => ({ team, count: getTeamRosterCount(team) }));
  return {
    teams: LEAGUE_TEAM_IDS.length,
    players: players.length,
    freeAgents: freeAgents.length,
    lifecycleIds: currentPlayers.map(player => player.id),
    rawRosterCounts: _rawRosterCounts,
    initialRosterCounts,
    initialRosterViolations,
    ageAudit,
    p0168: p0168 ? { age: getLeaguePlayerAge(p0168), source: p0168._ageSource } : null,
    superstarOfferTeams,
    rosterLimit: FREE_AGENT_MARKET.rosterLimit,
    postDraftRosterCounts,
    postDraftRosterViolations: postDraftRosterCounts.filter(row => row.count > FREE_AGENT_MARKET.rosterLimit),
    postDraftPlayers: postDraftPlayers.length,
    postDraftFreeAgents: postDraftFreeAgents.length,
    postDraftLifecycleIds: postDraftIds,
    postDraftUniqueIds: new Set(postDraftIds).size,
    payroll: {
      min: rows[0] && rows[0].payroll,
      median: rows[Math.floor(rows.length / 2)] && rows[Math.floor(rows.length / 2)].payroll,
      average: total / Math.max(1, rows.length),
      max: rows[rows.length - 1] && rows[rows.length - 1].payroll,
      underSoftCap: rows.filter(row => row.payroll <= FREE_AGENT_MARKET.softCap).length,
      overSecondApron: rows.filter(row => row.payroll > FREE_AGENT_MARKET.secondApron).length,
    },
    market: { secondApron: FREE_AGENT_MARKET.secondApron },
  };
})()`, context);

const failures = [];
if (result.teams !== 30) failures.push(`球队数量异常：${result.teams}`);
if (result.rosterLimit !== 18) failures.push(`名单上限配置异常：${result.rosterLimit}`);
if (result.rawRosterCounts.filter(row => row.count > result.rosterLimit).length === 0) failures.push('初始化测试数据没有覆盖超员球队场景');
if (result.initialRosterViolations.length) failures.push(`初始化后仍有超员球队：${JSON.stringify(result.initialRosterViolations)}`);
if (result.players + result.freeAgents !== 525) failures.push(`初始化生命周期总数异常：${result.players + result.freeAgents}`);
if (new Set(result.lifecycleIds).size !== result.lifecycleIds.length) failures.push('初始化球队/FA池存在重复球员 ID');
if (result.ageAudit.missing.length) failures.push(`运行时仍缺少年龄：${result.ageAudit.missing.join(',')}`);
if (result.ageAudit.invalid.length) failures.push(`年龄超出 18-45：${JSON.stringify(result.ageAudit.invalid)}`);
if (!result.p0168 || result.p0168.age !== 27 || result.p0168.source !== 'official_override') {
  failures.push(`P0168 年龄校准异常：${JSON.stringify(result.p0168)}`);
}
if (!(result.payroll.average < 110 && result.payroll.max <= result.market.secondApron && result.payroll.underSoftCap > 0)) {
  failures.push(`初始工资分布异常：${JSON.stringify(result.payroll)}`);
}
if (result.superstarOfferTeams.length < 2) failures.push(`98 OVR 自由球员仍只有母队可报价：${result.superstarOfferTeams.join(',')}`);
if (result.postDraftRosterViolations.length) failures.push(`选秀加入后仍有超员球队：${JSON.stringify(result.postDraftRosterViolations)}`);
if (result.postDraftPlayers + result.postDraftFreeAgents !== 585) failures.push(`选秀后生命周期总数异常：${result.postDraftPlayers + result.postDraftFreeAgents}`);
if (result.postDraftUniqueIds !== result.postDraftLifecycleIds.length) failures.push('选秀后球队/FA池存在重复球员 ID');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  teams: result.teams,
  initial: {
    rosterPlayers: result.players,
    freeAgents: result.freeAgents,
    rawOverfullTeams: result.rawRosterCounts.filter(row => row.count > result.rosterLimit),
    maxRoster: Math.max(...result.initialRosterCounts.map(row => row.count)),
  },
  age: {
    total: result.ageAudit.total,
    missing: result.ageAudit.missing.length,
    invalid: result.ageAudit.invalid.length,
    estimated: result.ageAudit.estimated.length,
  },
  p0168: result.p0168,
  superstarOfferTeams: result.superstarOfferTeams,
  postDraft: {
    rosterPlayers: result.postDraftPlayers,
    freeAgents: result.postDraftFreeAgents,
    maxRoster: Math.max(...result.postDraftRosterCounts.map(row => row.count)),
    uniqueIds: result.postDraftUniqueIds,
  },
  payroll: result.payroll,
}, null, 2));
