const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  console: { log() {}, error() {} },
  window: {},
  STATE: {
    careerTeam: 'SAS',
    finalOVR: 99,
    position: 'C',
    attrs: {},
    career: {
      currentAge: 21,
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
context.isMvpStar = () => false;
context.STATE._prevStandings = {};
context.STATE._teamHistory = {};
for (const team of context.LEAGUE_TEAM_IDS) {
  context.STATE._prevStandings[team] = { wins: 41, losses: 41 };
  context.STATE._teamHistory[team] = [0.5];
}
context.STATE.season = { leaguePlayerSeasonStats: {}, isUserStarter: true, playerStats: { games: 82, mins: 2500 } };
context.STATE._contractsInited = false;
context.STATE.career.salary = 14.4;
vm.runInContext(`
  calculateContractStayRate = function() { return 0.72; };
  for (var careerOffseason = 0; careerOffseason < 3; careerOffseason++) {
    evolveLeague();
    STATE.career.seasonCount++;
    assignFreeAgents();
  }
`, context);
context.STATE.career.seasons = [1, 2, 3].map(seasonNum => ({ seasonNum, team: 'SAS' }));
context.STATE.career.teamTenure = 1;
context.STATE.career.contract = 0;
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
  const roundMatrix = LEAGUE_TEAM_IDS
    .filter(team => team !== STATE.careerTeam)
    .map(team => ({
      team,
      payroll: getTeamPayroll(team),
      offers: [0, 1, 2, 3].map(round => {
        const offer = buildCareerContractOffer(team, 2, round);
        return offer ? { round, salary: offer.salary, after: offer.payrollAfterSigning } : null;
      }),
    }));
  const displayed = generateContractOffers();
  const displayedTeams = displayed.map(offer => offer.team);
  const roundOffer = getBestCareerContractOffer('ROUND_TEAM', 2, 3);
  const actualSelection = displayed[0];
  const actualTargetRosterBefore = actualSelection ? (LEAGUE_PLAYER_DATA[actualSelection.team] || []).length : 0;
  if (actualSelection) selectContractOption(actualSelection.team, actualSelection.years, actualSelection.round);
  const actualSelectedContract = actualSelection ? {
    team: STATE.careerTeam,
    salary: STATE.career.salary,
    years: STATE.career.contract,
    rosterCuts: actualSelection.contractOffer.rosterCuts ? actualSelection.contractOffer.rosterCuts.length : 0,
    targetRosterBefore: actualTargetRosterBefore,
    targetRosterAfter: (LEAGUE_PLAYER_DATA[actualSelection.team] || []).length,
  } : null;
  STATE.careerTeam = 'SAS';
  STATE.career.contract = 0;
  STATE.career.salary = 14.4;
  STATE.career._salaryVersion = 2;
  STATE.career.seasons = [];
  STATE.career.teamTenure = 1;
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

  // 长期存档回归：多年自由市场会把大量 NPC 合同更新为市场价，
  // 97 OVR 玩家到期后仍应至少得到一份可以实际签下的合同。
  STATE.finalOVR = 97;
  STATE.careerTeam = 'DEN';
  STATE.career.currentAge = 24;
  STATE.career.contract = 0;
  STATE.career.salary = 30;
  STATE.career._salaryVersion = 2;
  STATE.career.flags = {};
  STATE.career.mobility = {};
  STATE.career.seasonCount = 4;
  for (var veteranOffseason = 0; veteranOffseason < 8; veteranOffseason++) {
    evolveLeague();
    STATE.career.seasonCount++;
    STATE.career.currentAge++;
    assignFreeAgents();
  }
  STATE.career.seasons = Array.from({ length: 12 }, function(_, index) {
    return { seasonNum: index + 1, team: 'DEN' };
  });
  STATE.career.teamTenure = 12;
  STATE.career.contract = 0;
  var veteranOffers = generateContractOffers();
  var veteranRenewal = getBestCareerContractOffer('DEN', 2, 4);
  var veteranPayrolls = LEAGUE_TEAM_IDS.map(function(team) {
    return getTeamPayroll(team);
  });

  // 压力场景：多年后球队可能同时有高薪合同和廉价末端球员。
  // 腾空间时若只裁最便宜的人，即使 97 OVR 球员降到底薪也会被错误判定为无人可签。
  LEAGUE_TEAM_IDS.forEach(function(team) {
    LEAGUE_PLAYER_DATA[team] = Array.from({ length: 18 }, function(_, index) {
      return {
        id: 'CAP-STRESS-' + team + '-' + index,
        cname: 'CAP-STRESS-' + team + '-' + index,
        ovr: index < 2 ? 92 : index < 8 ? 82 : 65,
        pos: ['PG', 'SG', 'SF', 'PF', 'C'][index % 5],
        _age: 27,
        salary: index < 2 ? 30 : index < 8 ? 15 : 2,
        _salaryVersion: 2,
        contract: 2
      };
    });
  });
  STATE.finalOVR = 97;
  STATE.careerTeam = 'DEN';
  STATE.career.currentAge = 32;
  STATE.career.contract = 0;
  STATE.career.flags = {};
  var capStressOffers = generateContractOffers();
  var capStressRenewal = getBestCareerContractOffer('DEN', 2, 4);
  var capStressCoreCut = capStressOffers.some(function(offer) {
    return (offer.rosterCuts || []).some(function(player) { return (Number(player.ovr) || 0) >= 88; });
  });
  return {
    legalTeams,
    roundMatrix,
    displayedTeams,
    displayedCount: displayed.length,
    contractOffers: displayed.filter(offer => !!offer.contractOffer).length,
    roundOffer: roundOffer ? { round: roundOffer.round, salary: roundOffer.salary } : null,
    actualSelectedContract,
    selectedContract,
    birdTenure,
    birdRights,
    expiredPayrollReleased: Math.abs(expiredPayroll - payrollWithoutUser) < 0.001,
    veteranOfferCount: veteranOffers.length,
    veteranOfferTeams: veteranOffers.map(function(offer) { return offer.team; }),
    veteranRenewal: veteranRenewal ? { salary: veteranRenewal.salary, round: veteranRenewal.round } : null,
    veteranPayrollMin: Math.min.apply(Math, veteranPayrolls),
    veteranPayrollMax: Math.max.apply(Math, veteranPayrolls),
    capStressOfferCount: capStressOffers.length,
    capStressOfferTeams: capStressOffers.map(function(offer) { return offer.team; }),
    capStressRenewal: !!capStressRenewal,
    capStressCoreCut: capStressCoreCut,
    maxDisplayed: 4,
  };
})()`, context);

const failures = [];
if (result.displayedCount !== Math.min(4, result.legalTeams.length)) {
  failures.push(`玩家合同 UI 链路丢失合法报价：${JSON.stringify(result)}`);
}
if (result.legalTeams.length < 4) failures.push(`99 OVR 玩家合法外队不足4家：${JSON.stringify({ teams: result.legalTeams, rounds: result.roundMatrix })}`);
if (result.contractOffers !== result.displayedCount) failures.push('展示的玩家合同缺少已校验的 contractOffer');
if (new Set(result.displayedTeams).size !== result.displayedTeams.length) failures.push('玩家合同 UI 出现重复球队');
if (!result.selectedContract || result.selectedContract.team !== 'ROUND_TEAM'
    || result.selectedContract.salary !== result.roundOffer.salary
    || result.selectedContract.years !== 2) {
  failures.push(`UI 选择没有按实际 Round 落盘：${JSON.stringify({ selected: result.selectedContract, offer: result.roundOffer })}`);
}
if (!result.actualSelectedContract || result.actualSelectedContract.team === 'SAS'
    || result.actualSelectedContract.salary <= 0
    || result.actualSelectedContract.targetRosterAfter > 18
    || result.actualSelectedContract.rosterCuts < 2) {
  failures.push(`真实外队合同选择没有正确落盘：${JSON.stringify(result.actualSelectedContract)}`);
}
if (!result.roundOffer || result.roundOffer.round !== 2) failures.push(`玩家合同没有在 Round 0 不合法时降价：${JSON.stringify(result.roundOffer)}`);
if (result.birdTenure !== 4 || !result.birdRights) failures.push(`玩家连续效力年限没有恢复 Bird 权利：${JSON.stringify({ tenure: result.birdTenure, bird: result.birdRights })}`);
if (!result.expiredPayrollReleased) failures.push('玩家合同到期后旧工资仍计入母队 payroll');
if (result.veteranOfferCount < 1 && !result.veteranRenewal) {
  failures.push(`97 OVR 长期生涯后没有任何球队报价：${JSON.stringify({ min: result.veteranPayrollMin, max: result.veteranPayrollMax })}`);
}
if (result.capStressOfferCount < 1 && !result.capStressRenewal) {
  failures.push('97 OVR 玩家在全联盟高薪压力场景下没有任何球队报价');
}
if (!result.capStressRenewal) failures.push('拥有 Bird Rights 的 97 OVR 玩家被母队薪资空间阻止续约');
if (result.capStressCoreCut) failures.push('外队为了签约玩家直接裁掉了 OVR 88+ 核心');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  legalExternalTeams: result.legalTeams.length,
  displayedTeams: result.displayedTeams,
  displayedCount: result.displayedCount,
  roundOffer: result.roundOffer,
  actualSelectedContract: result.actualSelectedContract,
  selectedContract: result.selectedContract,
  birdTenure: result.birdTenure,
  birdRights: result.birdRights,
  expiredPayrollReleased: result.expiredPayrollReleased,
  veteranOffers: result.veteranOfferTeams,
  veteranRenewal: result.veteranRenewal,
  veteranPayrollRange: [result.veteranPayrollMin, result.veteranPayrollMax],
  capStressOffers: result.capStressOfferTeams,
  capStressRenewal: result.capStressRenewal,
  capStressCoreCut: result.capStressCoreCut,
}, null, 2));
