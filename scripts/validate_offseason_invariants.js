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

const result = vm.runInContext(`(() => {
  const ageAudit = validateLeaguePlayerAgeData();
  const rows = LEAGUE_TEAM_IDS.map(team => ({ team, payroll: getTeamPayroll(team) }))
    .sort((a, b) => a.payroll - b.payroll);
  const total = rows.reduce((sum, row) => sum + row.payroll, 0);
  const players = LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team] || []);
  const p0168 = players.find(player => player.id === 'P0168');
  const testSuperstar = { id: 'TEST-SUPERSTAR', ovr: 98, pos: 'C', _age: 31, _origTeam: 'DEN', _lastTeam: 'DEN', _teamTenure: 5, _birdTeam: 'DEN' };
  const superstarOfferTeams = LEAGUE_TEAM_IDS.map(team => buildContractOffer(testSuperstar, team, {
    source: 'free_agent', round: 0, birdRights: team === testSuperstar._origTeam,
  })).filter(Boolean).map(offer => offer.teamId);
  return {
    teams: LEAGUE_TEAM_IDS.length,
    players: players.length,
    ageAudit,
    p0168: p0168 ? { age: getLeaguePlayerAge(p0168), source: p0168._ageSource } : null,
    superstarOfferTeams,
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
if (result.players !== 525) failures.push(`现役 NPC 数量异常：${result.players}`);
if (result.ageAudit.missing.length) failures.push(`运行时仍缺少年龄：${result.ageAudit.missing.join(',')}`);
if (result.ageAudit.invalid.length) failures.push(`年龄超出 18-45：${JSON.stringify(result.ageAudit.invalid)}`);
if (!result.p0168 || result.p0168.age !== 27 || result.p0168.source !== 'official_override') {
  failures.push(`P0168 年龄校准异常：${JSON.stringify(result.p0168)}`);
}
if (!(result.payroll.average < 110 && result.payroll.max <= result.market.secondApron && result.payroll.underSoftCap > 0)) {
  failures.push(`初始工资分布异常：${JSON.stringify(result.payroll)}`);
}
if (result.superstarOfferTeams.length < 2) failures.push(`98 OVR 自由球员仍只有母队可报价：${result.superstarOfferTeams.join(',')}`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
