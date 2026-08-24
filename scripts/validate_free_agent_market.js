const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const failures = [];
const context = {
  console: { log() {}, error() {} },
  document: { getElementById() { return null; } },
  window: {},
  LEAGUE_TEAM_IDS: ['A', 'B', 'C'],
  LEAGUE_PLAYER_DATA: { A: [], B: [], C: [] },
  STATE: {
    careerTeam: null,
    finalOVR: 0,
    position: null,
    season: null,
    _prevStandings: {
      A: { wins: 55, losses: 27 },
      B: { wins: 42, losses: 40 },
      C: { wins: 30, losses: 52 },
    },
    _leagueChanges: {},
  },
};

let seed = 123456789;
context.rngNext = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
context.canPlayPosition = (playerPos, targetPos) => String(playerPos || '').split('/').map(value => value.trim()).includes(targetPos);
context.calcTeamLineup = (teamId) => {
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

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8'), context, { filename: 'js/offseason.js' });

function player(id, ovr, pos, age, extra) {
  return Object.assign({ id, cname: id, ovr, pos, _age: age, contract: 3 }, extra || {});
}

// B 队已有高水平 SG，但 C 位很弱；这覆盖“不同位置球星不应成为全队禁签”的场景。
context.LEAGUE_PLAYER_DATA.A = [
  player('A-SG-STAR', 84, 'SG', 27, { _lastTeam: 'A', _teamTenure: 4, _birdTeam: 'A' }),
  player('A-PG', 72, 'PG', 27), player('A-SF', 72, 'SF', 27), player('A-PF', 72, 'PF', 27), player('A-C', 72, 'C', 27),
];
context.LEAGUE_PLAYER_DATA.B = [
  player('B-SG-STAR', 84, 'SG', 27),
  player('B-PG', 66, 'PG', 27), player('B-SF', 66, 'SF', 27), player('B-PF', 66, 'PF', 27), player('B-C', 66, 'C', 27),
];
context.LEAGUE_PLAYER_DATA.C = Array.from({ length: 18 }, (_, index) => player('C-' + index, 65, index % 5 === 0 ? 'C' : 'SF', 27));
for (const teamId of ['A', 'B']) {
  while (context.LEAGUE_PLAYER_DATA[teamId].length < 18) {
    const index = context.LEAGUE_PLAYER_DATA[teamId].length;
    context.LEAGUE_PLAYER_DATA[teamId].push(player(teamId + '-depth-' + index, 65, 'SF', 27));
  }
}

context._playerAges = {};
context._playerGenes = {};
for (const roster of Object.values(context.LEAGUE_PLAYER_DATA)) {
  for (const current of roster) context._playerGenes[current.id] = { v: 1, potential: current.ovr, loyalty: 50, loyaltyVersion: 3, loyaltyRenewals: 0, loyaltyLastEvent: '', loyaltyTeam: '', roleUnderuseSeasons: 0 };
}

const superstar = player('FA-SUPERSTAR', 98, 'C', 31, {
  _origTeam: 'A',
  _lastTeam: 'A',
  _teamTenure: 5,
  _birdTeam: 'A',
  contract: 0,
});
const fringe = player('FA-FRINGE', 72, 'PG', 35, { _origTeam: 'B', contract: 0 });
context.STATE._freeAgentPool = [superstar, fringe];
vm.runInContext('assignFreeAgents()', context);

const freeAgentIds = () => (context.STATE._freeAgentPool || []).map(current => current.id);
const signed = context.STATE._leagueChanges.freeSignings || [];
const superstarSigning = signed.find(entry => entry.playerId === 'FA-SUPERSTAR');
const initialUnsignedIds = freeAgentIds();

if (!superstarSigning) failures.push('98 OVR 超级球星没有生成任何签约');
if (freeAgentIds().includes('FA-SUPERSTAR')) failures.push('98 OVR 超级球星签约后仍错误留在自由市场');
if (!Object.values(context.LEAGUE_PLAYER_DATA).some(roster => roster.some(current => current.id === 'FA-SUPERSTAR'))) {
  failures.push('98 OVR 超级球星签约后没有出现在球队名单');
}
if (!freeAgentIds().includes('FA-FRINGE')) failures.push('低价值、无空间球员没有保留在自由市场池');
if (superstarSigning && superstarSigning.salary < 20) failures.push('超级球星市场薪资没有保持在顶薪档');
if (superstarSigning && superstarSigning.years > 5) failures.push('合同年限超过 Bird 权利上限');
if (context.STATE._freeAgentPool.some(current => current.id === 'FA-SUPERSTAR')) failures.push('自由市场池仍存在已签球员副本');

const fringeAgeBeforeCarry = fringe._age;
vm.runInContext('evolveUnsignedFreeAgents()', context);
if (!context.STATE._freeAgentPool.some(current => current.id === 'FA-FRINGE')) failures.push('未签约球员跨赛季没有继续保留');
if (fringe._age !== fringeAgeBeforeCarry + 1) failures.push('未签约球员跨赛季没有年龄推进');

const market = vm.runInContext(`({
  superstar: getPlayerMarketValue({ ovr: 98, _age: 31 }),
  fringe: getPlayerMarketValue({ ovr: 72, _age: 35 }),
  birdYears: randomContractByAge(31, { ovr: 98 }, { birdRights: true }),
  externalYears: randomContractByAge(31, { ovr: 98 }, { birdRights: false })
})`, context);
if (!(market.superstar >= 30 && market.superstar <= 32)) failures.push(`98 OVR 市场价值不在 30 左右：${market.superstar}`);
if (!(market.fringe >= 1 && market.fringe <= 5)) failures.push(`72 OVR 老将市场价值异常：${market.fringe}`);
if (market.birdYears > 5 || market.externalYears > 4) failures.push('Bird/外队合同年限上限异常');

// 完整生命周期回归：上一季未签 FA 不能被本季新到期球员覆盖。
const oldFreeAgent = player('FA-OLD', 72, 'PG', 27, { _origTeam: 'B', contract: 0 });
const newlyExpired = player('FA-NEW', 70, 'PG', 27, { contract: 1, _lastTeam: 'A', _teamTenure: 1 });
context.LEAGUE_PLAYER_DATA.A = [newlyExpired];
context.LEAGUE_PLAYER_DATA.B = [];
context.LEAGUE_PLAYER_DATA.C = [];
context.STATE._freeAgentPool = [oldFreeAgent];
context.STATE._contractsInited = true;
context.STATE._teamHistory = {};
context.STATE.season = { leaguePlayerSeasonStats: {} };
context.SIM_CONFIG = { ATTR_LIST: [] };
context._playerGenes = {
  'FA-NEW': { v: 1, potential: 70, loyalty: 50, loyaltyVersion: 3, loyaltyRenewals: 0, loyaltyLastEvent: '', loyaltyTeam: '', roleUnderuseSeasons: 0 },
  'FA-OLD': { v: 1, potential: 72, loyalty: 50, loyaltyVersion: 3, loyaltyRenewals: 0, loyaltyLastEvent: '', loyaltyTeam: '', roleUnderuseSeasons: 0 },
};
try {
  vm.runInContext(`
    syncLeaguePlayerOvrs = function() { return 0; };
    updatePlayerRoleSatisfactionHistory = function() { return 0; };
    calculateContractStayRate = function() { return 0; };
    isMvpStar = function() { return false; };
    calcOVR = function(current) { return Number(current.ovr) || 60; };
    evolveLeague();
  `, context);
} catch (error) {
  failures.push('完整 evolveLeague 生命周期测试抛出异常：' + error.message);
}

const afterEvolvePool = context.STATE._freeAgentPool || [];
const afterEvolveIds = afterEvolvePool.map(current => current.id);
if (!afterEvolveIds.includes('FA-OLD')) failures.push('完整 evolveLeague 后旧 FA 被覆盖');
if (!afterEvolveIds.includes('FA-NEW')) failures.push('完整 evolveLeague 后新到期 FA 缺失');
if (new Set(afterEvolveIds).size !== afterEvolveIds.length) failures.push('完整 evolveLeague 后 FA 池出现重复 ID');
if (context.STATE._leagueChanges.freeAgentCount !== 2) failures.push(`完整 evolveLeague 的 freeAgentCount 异常：${context.STATE._leagueChanges.freeAgentCount}`);

try {
  vm.runInContext('assignFreeAgents()', context);
} catch (error) {
  failures.push('合并后的 FA 池进入 assignFreeAgents 时抛出异常：' + error.message);
}
for (const id of ['FA-OLD', 'FA-NEW']) {
  const rosterCount = Object.values(context.LEAGUE_PLAYER_DATA).reduce((count, roster) => count + roster.filter(current => current.id === id).length, 0);
  const poolCount = (context.STATE._freeAgentPool || []).filter(current => current.id === id).length;
  const retiredCount = (context.STATE._leagueChanges.retired || []).filter(current => current.playerId === id).length;
  if (rosterCount + poolCount + retiredCount !== 1) failures.push(`${id} 生命周期归属不是恰好一种：${rosterCount}/${poolCount}/${retiredCount}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  signedSuperstar: superstarSigning,
  initialUnsignedIds,
  market,
  lifecycle: {
    afterEvolveIds,
    finalPoolIds: (context.STATE._freeAgentPool || []).map(current => current.id),
  },
}, null, 2));
