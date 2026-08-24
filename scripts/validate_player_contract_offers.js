const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  console: { log() {}, error() {} },
  window: {},
  STATE: {
    careerTeam: 'DEN',
    finalOVR: 99,
    position: 'C',
    attrs: {},
    career: {
      currentAge: 25,
      contract: 0,
      salary: 20,
      _salaryVersion: 2,
      teamTenure: 3,
      flags: {},
      seasons: [],
    },
    season: { isUserStarter: true, playerStats: { games: 82, mins: 2500 } },
    _prevStandings: {},
    _leagueChanges: {},
  },
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
context.document = { getElementById: id => id === 'player-age-data' ? { textContent: html.slice(ageJsonStart, ageJsonEnd) } : null };
context.getMyPlayerDisplayName = () => '99 OVR 测试球员';
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
  return { starters, bench: [] };
};

run('js/offseason.js');
// 按真实新档顺序：先应用 2026 选秀，再收缩超员名单，最后生成玩家合同。
vm.runInContext('applyDraftClass2026(); enforceLeagueRosterCapacity(null, { reason: "contract_offer_validator" });', context);
context.clearLineupCache = () => {};
context.syncUserStarterStatus = () => {};
context.initStandings = () => {};
context.buildRealSchedule = () => {};
context.syncNarrativeAfterPlayerTeamChange = () => {};
context.showFreeAgencyTeamChangeModal = (oldTeam, newTeam, done) => { if (done) done(); };
context.maybeShowCityFarewell = () => false;
context.showOffSeasonModals = () => {};
context.LEAGUE_PLAYER_DATA.ROUND_TEAM = Array.from({ length: 6 }, (_, index) => ({
  id: 'ROUND-' + index,
  cname: 'ROUND-' + index,
  ovr: 70,
  pos: 'SF',
  _age: 27,
  salary: 12,
  _salaryVersion: 2,
  contract: 2,
}));

const result = vm.runInContext(`(() => {
  const legalTeams = LEAGUE_TEAM_IDS
    .filter(team => team !== STATE.careerTeam)
    .map(team => ({ team, offer: getBestCareerContractOffer(team, 2, 3) }))
    .filter(row => !!row.offer)
    .map(row => row.team);
  const displayed = generateContractOffers();
  const displayedTeams = displayed.map(offer => offer.team);
  const roundOffer = getBestCareerContractOffer('ROUND_TEAM', 2, 3);
  selectContractOption('ROUND_TEAM', roundOffer.years, roundOffer.round);
  const selectedContract = {
    team: STATE.careerTeam,
    salary: STATE.career.salary,
    years: STATE.career.contract,
  };
  STATE.careerTeam = 'DEN';
  STATE.career.contract = 0;
  STATE.career.salary = 20;
  STATE.career._salaryVersion = 2;
  STATE.career.seasons = [1, 2, 3, 4].map(seasonNum => ({ seasonNum, team: 'DEN' }));
  STATE.career.teamTenure = 1;
  const birdTenure = getCareerTeamTenure();
  const birdRights = hasCareerPlayerBirdRights('DEN');
  const expiredPayroll = getTeamPayroll('DEN');
  const payrollWithoutUser = getTeamPayrollExcludingPlayer('DEN', getCareerPlayerContractSnapshot());
  return {
    legalTeams,
    displayedTeams,
    displayedCount: displayed.length,
    contractOffers: displayed.filter(offer => !!offer.contractOffer).length,
    roundOffer: roundOffer ? { round: roundOffer.round, salary: roundOffer.salary } : null,
    selectedContract,
    birdTenure,
    birdRights,
    expiredPayrollReleased: Math.abs(expiredPayroll - payrollWithoutUser) < 0.001,
    maxDisplayed: 4,
  };
})()`, context);

const failures = [];
if (result.displayedCount !== Math.min(4, result.legalTeams.length)) {
  failures.push(`玩家合同 UI 链路丢失合法报价：${JSON.stringify(result)}`);
}
if (result.legalTeams.length < 4) failures.push(`99 OVR 玩家合法外队不足4家：${result.legalTeams.join(',')}`);
if (result.contractOffers !== result.displayedCount) failures.push('展示的玩家合同缺少已校验的 contractOffer');
if (new Set(result.displayedTeams).size !== result.displayedTeams.length) failures.push('玩家合同 UI 出现重复球队');
if (!result.selectedContract || result.selectedContract.team !== 'ROUND_TEAM'
    || result.selectedContract.salary !== result.roundOffer.salary
    || result.selectedContract.years !== 2) {
  failures.push(`UI 选择没有按实际 Round 落盘：${JSON.stringify({ selected: result.selectedContract, offer: result.roundOffer })}`);
}
if (!result.roundOffer || result.roundOffer.round !== 2) failures.push(`玩家合同没有在 Round 0 不合法时降价：${JSON.stringify(result.roundOffer)}`);
if (result.birdTenure !== 4 || !result.birdRights) failures.push(`玩家连续效力年限没有恢复 Bird 权利：${JSON.stringify({ tenure: result.birdTenure, bird: result.birdRights })}`);
if (!result.expiredPayrollReleased) failures.push('玩家合同到期后旧工资仍计入母队 payroll');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
