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
vm.runInContext('enforceLeagueRosterCapacity(null, { reason: "contract_offer_validator" });', context);

const result = vm.runInContext(`(() => {
  const legalTeams = LEAGUE_TEAM_IDS
    .filter(team => team !== STATE.careerTeam)
    .map(team => ({ team, offer: buildCareerContractOffer(team, 2) }))
    .filter(row => !!row.offer)
    .map(row => row.team);
  const displayed = generateContractOffers();
  const displayedTeams = displayed.map(offer => offer.team);
  return {
    legalTeams,
    displayedTeams,
    displayedCount: displayed.length,
    contractOffers: displayed.filter(offer => !!offer.contractOffer).length,
    maxDisplayed: 4,
  };
})()`, context);

const failures = [];
if (result.displayedCount !== Math.min(4, result.legalTeams.length)) {
  failures.push(`玩家合同 UI 链路丢失合法报价：${JSON.stringify(result)}`);
}
if (result.contractOffers !== result.displayedCount) failures.push('展示的玩家合同缺少已校验的 contractOffer');
if (new Set(result.displayedTeams).size !== result.displayedTeams.length) failures.push('玩家合同 UI 出现重复球队');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
