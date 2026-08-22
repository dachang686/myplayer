const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const awardsSource = fs.readFileSync(path.join(root, 'js/awards.js'), 'utf8');
const { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS } = new Function(
  `${dataSource}\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };`,
)();

const state = {
  careerTeam: 'WAS',
  position: 'C',
  finalOVR: 88,
  attrs: { PDEF: 65, STL: 58, IDEF: 72, BLK: 80, ATH: 82 },
  career: { seasonCount: 1, currentAge: 23 },
  season: {
    playerStats: {
      games: 82,
      pts: 23.1 * 82,
      reb: 14.3 * 82,
      ast: 2.5 * 82,
      stl: 0.8 * 82,
      blk: 2.2 * 82,
    },
    avgStats: { pts: 23.1, reb: 14.3, ast: 2.5, stl: 0.8, blk: 2.2 },
    leaguePlayerSeasonStats: {},
    standings: {},
  },
};

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

LEAGUE_TEAM_IDS.forEach((team, teamIndex) => {
  state.season.standings[team] = { wins: 60 - (teamIndex % 15) * 2, losses: 22 + (teamIndex % 15) * 2 };
  (LEAGUE_PLAYER_DATA[team] || []).forEach(player => {
    const ovr = Number(player.ovr) || 70;
    const rebAttr = Number(player.REB) || 50;
    const pdef = Number(player.PDEF) || 50;
    const stealAttr = Number(player.STL) || 50;
    const blkAttr = Number(player.BLK) || 50;
    const pos = String(player.pos || 'SF').split('/')[0];
    const bigBonus = pos === 'C' ? 1.8 : (pos === 'PF' ? 1.2 : 0);
    const perGame = {
      pts: clamp(7, 31, 7 + (ovr - 70) * 0.65),
      reb: clamp(2, 12.5, 2 + (rebAttr - 45) * 0.11 + bigBonus),
      ast: clamp(1, 9, 1 + ((Number(player.PAS) || 50) - 45) * 0.08),
      stl: clamp(0.4, 2, 0.4 + (stealAttr - 45) * 0.021 + (pdef - 45) * 0.004),
      blk: clamp(0.1, 2.1, 0.1 + (blkAttr - 40) * 0.035 + bigBonus * 0.12),
    };
    const totals = { gp: 82 };
    Object.keys(perGame).forEach(field => { totals[field] = perGame[field] * 82; });
    state.season.leaguePlayerSeasonStats[`${team}:${player.id}`] = totals;
  });
});

function getConferenceSeed(team) {
  return LEAGUE_TEAM_IDS.indexOf(team) % 15 + 1;
}

function getConferenceSorted(conference) {
  const offset = conference === 'NORTH' ? 15 : 0;
  return LEAGUE_TEAM_IDS.slice(offset, offset + 15).map(team => ({ team }));
}

function calcTeamLineup(team) {
  return { bench: (LEAGUE_PLAYER_DATA[team] || []).slice(5) };
}

function syncUserStarterStatus() {
  state.season.isUserStarter = true;
}

const calcSeasonAwards = new Function(
  'STATE',
  'LEAGUE_PLAYER_DATA',
  'LEAGUE_TEAM_IDS',
  'getConferenceSeed',
  'getConferenceSorted',
  'calcTeamLineup',
  'syncUserStarterStatus',
  'getLeaguePlayerAge',
  'getMyPlayerDisplayName',
  `${awardsSource}\nreturn calcSeasonAwards;`,
)(
  state,
  LEAGUE_PLAYER_DATA,
  LEAGUE_TEAM_IDS,
  getConferenceSeed,
  getConferenceSorted,
  calcTeamLineup,
  syncUserStarterStatus,
  player => Number(player._age) || 27,
  () => '验证球员',
);

calcSeasonAwards();

const dpoy = state.season.awards.find(award => award.act === 'dpoy');
const allDef1 = state.season.awards.find(award => award.act === 'allDef1');
const rebounds = state.season.awards.find(award => award.act === 'rebounding');
const blocks = state.season.awards.find(award => award.act === 'blocks');
const failures = [];

if (!rebounds || !rebounds.isUser) failures.push('验证球员未成为篮板王');
if (!blocks || !blocks.isUser) failures.push('验证球员未成为盖帽王');
if (!dpoy || dpoy.userRank === '未进入前五') failures.push('篮板王+盖帽王仍未进入 DPOY 前五');
if (!allDef1 || !allDef1.isUser) failures.push('DPOY 前五与最佳防守一阵排名不一致');

// 审计回归：低 OVR 的统计王、非分区头名替补的第六人，以及后续届 ROTY 必须进入对应候选池。
const auditTeam = LEAGUE_TEAM_IDS[7];
const auditVeteran = { id: 'audit-low-ovr', cname: '低评统计王', pos: 'SG', ovr: 60 };
const auditRookie = { id: 'audit-rookie', cname: '后续届新秀', pos: 'PG', ovr: 65, _rookieSeason: 2 };
LEAGUE_PLAYER_DATA[auditTeam].push(auditVeteran, auditRookie);
state.season.leaguePlayerSeasonStats[`${auditTeam}:${auditVeteran.id}`] = {
  gp: 82, pts: 40 * 82, reb: 4 * 82, ast: 5 * 82, stl: 1.2 * 82, blk: 0.2 * 82,
};
state.season.leaguePlayerSeasonStats[`${auditTeam}:${auditRookie.id}`] = {
  gp: 82, pts: 36 * 82, reb: 5 * 82, ast: 6 * 82, stl: 1.4 * 82, blk: 0.3 * 82,
};
state.season.awards = [];
delete state._awardStreakSeason;
calcSeasonAwards();
const auditScoring = state.season.awards.find(award => award.act === 'scoring');
const auditSixth = state.season.awards.find(award => award.act === 'sixthman');
const auditRoty = state.season.awards.find(award => award.act === 'roty');
if (!auditScoring || auditScoring.winnerId !== auditVeteran.id) failures.push('OVR < 72 的统计王仍被排除');
if (!auditSixth || auditSixth.winnerId !== auditVeteran.id) failures.push('最佳第六人没有从全联盟替补统一比较');
if (!auditRoty || auditRoty.winnerId !== auditRookie.id) failures.push('后续赛季没有生成基于 _rookieSeason 的 ROTY');

console.log(JSON.stringify({
  dpoyUserRank: dpoy && dpoy.userRank,
  dpoyWinner: dpoy && dpoy.winner,
  allDef1IncludesUser: !!(allDef1 && allDef1.isUser),
  reboundLeader: rebounds && rebounds.winner,
  blockLeader: blocks && blocks.winner,
  auditScoringLeader: auditScoring && auditScoring.winner,
  auditSixthMan: auditSixth && auditSixth.winner,
  auditRoty: auditRoty && auditRoty.winner,
}, null, 2));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
