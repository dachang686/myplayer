const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const scheduleSource = fs.readFileSync(path.join(root, 'js/data/league_schedule.js'), 'utf8');
const league = new Function(`${leagueSource}\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };`)();
const SIM_CONFIG = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const generateLeagueSchedule = new Function(`${scheduleSource}\nreturn generateLeagueSchedule;`)();
const benchmarkMode = process.argv.includes('--2k27') ? '2k27-top8' : 'current-roster';
const trialArgument = process.argv.slice(2).find(value => /^\d+$/.test(value));
const trials = Number(trialArgument) || 1000;
const STATE = { careerTeam: null, finalOVR: 0, position: null, attrs: {}, season: {}, _lineupCache: {} };
const ovrStart = offseasonSource.indexOf('function getOvrPositions');
const ovrEnd = offseasonSource.indexOf('// ==================== 联盟演变', ovrStart);
const syncLeaguePlayerOvrs = new Function(
  'SIM_CONFIG', 'ATTR_KEYS', 'STATE', 'LEAGUE_PLAYER_DATA', 'LEAGUE_TEAM_IDS', 'clearLineupCache',
  `${offseasonSource.slice(ovrStart, ovrEnd)}\nreturn syncLeaguePlayerOvrs;`,
)(SIM_CONFIG, SIM_CONFIG.ATTR_LIST, STATE, league.LEAGUE_PLAYER_DATA, league.LEAGUE_TEAM_IDS, () => {});
syncLeaguePlayerOvrs();
const engineStart = indexSource.indexOf('function getPlayerPositions');
const engineEnd = indexSource.indexOf('function generateBoxScore', engineStart);
if (engineStart < 0 || engineEnd < 0) throw new Error('无法定位比赛引擎');
const attrFactor = value => {
  const bounded = Math.max(25, Math.min(99, Number(value) || 50));
  return Math.pow((bounded - 25) / 74, 0.85);
};
const af = value => Math.pow(attrFactor(value), 1.5);
const engine = new Function(
  'LEAGUE_PLAYER_DATA', 'SIM_CONFIG', 'STATE', 'getMyPlayerDisplayName', 'getTeamName',
  'getLeaguePlayerAge', 'af', 'generateBoxScore',
  `${indexSource.slice(engineStart, engineEnd)}\nreturn { simulateGameNew, calcTeamLineup, calcTeamPowerWithPlayer, getTeamBattlePower };`,
)(
  league.LEAGUE_PLAYER_DATA, SIM_CONFIG, STATE, () => '验证球员',
  team => (SIM_CONFIG.TEAM_NAMES && SIM_CONFIG.TEAM_NAMES[team]) || team,
  player => Number(player && player._age) || 27, af,
  (teamA, teamB) => ({ [teamA]: [], [teamB]: [] }),
);

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}
Math.random = seededRandom(20260812);

const teams = league.LEAGUE_TEAM_IDS;
const conferences = SIM_CONFIG.CONFERENCE;
const conferenceByTeam = {};
Object.entries(conferences).forEach(([conf, list]) => list.forEach(team => { conferenceByTeam[team] = conf; }));
const TWO_K_27_TEAM_DATA = {
  ATL: { ovr: 81, best: 87, ins: 75, out: 85, ath: 78, pla: 75, def: 61, reb: 56, int: 69 },
  BOS: { ovr: 82, best: 93, ins: 71, out: 86, ath: 82, pla: 80, def: 72, reb: 63, int: 81 },
  BKN: { ovr: 79, best: 85, ins: 75, out: 82, ath: 80, pla: 66, def: 60, reb: 60, int: 82 },
  CHA: { ovr: 81, best: 85, ins: 61, out: 86, ath: 75, pla: 68, def: 60, reb: 58, int: 73 },
  CHI: { ovr: 81, best: 84, ins: 62, out: 82, ath: 79, pla: 79, def: 58, reb: 59, int: 81 },
  CLE: { ovr: 83, best: 93, ins: 75, out: 83, ath: 84, pla: 76, def: 73, reb: 60, int: 68 },
  DAL: { ovr: 82, best: 87, ins: 67, out: 86, ath: 77, pla: 73, def: 64, reb: 60, int: 73 },
  DEN: { ovr: 83, best: 98, ins: 77, out: 87, ath: 78, pla: 76, def: 63, reb: 56, int: 79 },
  DET: { ovr: 83, best: 93, ins: 74, out: 76, ath: 84, pla: 72, def: 75, reb: 60, int: 77 },
  GSW: { ovr: 82, best: 95, ins: 68, out: 84, ath: 83, pla: 79, def: 65, reb: 55, int: 77 },
  HOU: { ovr: 83, best: 93, ins: 83, out: 83, ath: 80, pla: 77, def: 67, reb: 54, int: 66 },
  IND: { ovr: 83, best: 90, ins: 73, out: 81, ath: 77, pla: 72, def: 68, reb: 55, int: 77 },
  LAC: { ovr: 80, best: 84, ins: 63, out: 87, ath: 77, pla: 71, def: 53, reb: 52, int: 68 },
  LAL: { ovr: 82, best: 97, ins: 72, out: 88, ath: 81, pla: 82, def: 55, reb: 54, int: 81 },
  MEM: { ovr: 80, best: 81, ins: 65, out: 83, ath: 71, pla: 64, def: 59, reb: 56, int: 78 },
  MIA: { ovr: 82, best: 97, ins: 85, out: 82, ath: 88, pla: 72, def: 79, reb: 59, int: 79 },
  MIL: { ovr: 81, best: 85, ins: 59, out: 85, ath: 77, pla: 79, def: 59, reb: 55, int: 67 },
  MIN: { ovr: 83, best: 96, ins: 72, out: 88, ath: 84, pla: 75, def: 68, reb: 51, int: 76 },
  NOP: { ovr: 81, best: 85, ins: 76, out: 83, ath: 82, pla: 72, def: 60, reb: 58, int: 69 },
  NYK: { ovr: 85, best: 96, ins: 79, out: 87, ath: 83, pla: 74, def: 61, reb: 51, int: 74 },
  OKC: { ovr: 84, best: 98, ins: 79, out: 86, ath: 81, pla: 76, def: 79, reb: 55, int: 72 },
  ORL: { ovr: 82, best: 87, ins: 80, out: 84, ath: 79, pla: 75, def: 59, reb: 57, int: 78 },
  PHI: { ovr: 85, best: 92, ins: 74, out: 88, ath: 84, pla: 83, def: 68, reb: 55, int: 80 },
  PHX: { ovr: 82, best: 91, ins: 71, out: 86, ath: 82, pla: 72, def: 68, reb: 55, int: 72 },
  POR: { ovr: 83, best: 88, ins: 63, out: 84, ath: 86, pla: 81, def: 60, reb: 54, int: 70 },
  SAC: { ovr: 80, best: 85, ins: 79, out: 83, ath: 74, pla: 62, def: 50, reb: 58, int: 70 },
  SAS: { ovr: 85, best: 97, ins: 77, out: 86, ath: 81, pla: 78, def: 76, reb: 57, int: 78 },
  TOR: { ovr: 83, best: 93, ins: 81, out: 88, ath: 84, pla: 80, def: 77, reb: 57, int: 84 },
  UTA: { ovr: 82, best: 86, ins: 83, out: 83, ath: 76, pla: 62, def: 67, reb: 57, int: 85 },
  WAS: { ovr: 82, best: 90, ins: 71, out: 81, ath: 80, pla: 74, def: 65, reb: 60, int: 80 },
};

function buildTwoKBenchmarkRoster(team, rating) {
  const positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG/SG', 'SF/PF', 'C/PF', 'SG/SF', 'PF/C'];
  const remainingTopEight = rating.ovr * 8 - rating.best;
  const base = Math.floor(remainingTopEight / 7);
  let remainder = remainingTopEight - base * 7;
  const topEight = [rating.best].concat(Array.from({ length: 7 }, () => base + (remainder-- > 0 ? 1 : 0)));
  const ovrs = topEight.concat([Math.max(68, base - 2), Math.max(67, base - 3)]);
  return ovrs.map((ovr, index) => ({
    id: `2K27-${team}-${index + 1}`,
    cname: `2K27 ${team} ${index + 1}`,
    pos: positions[index],
    ovr,
    threePT: rating.out,
    MID: rating.out,
    FIN: rating.ins,
    DNK: Math.round((rating.ins + rating.ath) / 2),
    HAN: rating.pla,
    PAS: rating.pla,
    PDEF: rating.def,
    IDEF: rating.def,
    STL: rating.def,
    BLK: rating.def,
    REB: rating.reb,
    ATH: rating.ath,
    STR: rating.ath,
    CLU: rating.int,
  }));
}

if (benchmarkMode === '2k27-top8') {
  teams.forEach(team => {
    if (!TWO_K_27_TEAM_DATA[team]) throw new Error(`缺少2K27球队数据: ${team}`);
    league.LEAGUE_PLAYER_DATA[team] = buildTwoKBenchmarkRoster(team, TWO_K_27_TEAM_DATA[team]);
  });
  STATE._lineupCache = {};
}
const schedule = generateLeagueSchedule({
  teams, conference: conferences, divisions: SIM_CONFIG.DIVISIONS, seed: 'current-roster-upset-2026-08-12',
});
STATE.season.isPlayoffs = false;
const battlePower = Object.fromEntries(teams.map(team => [team, engine.getTeamBattlePower(team)]));
STATE.season.isPlayoffs = true;
const playoffBattlePower = Object.fromEntries(teams.map(team => [team, engine.getTeamBattlePower(team)]));
STATE.season.isPlayoffs = false;
function buildLineupSummary(powerByTeam, playoffPowerByTeam) {
  return Object.fromEntries(teams.map(team => {
    const lineup = engine.calcTeamLineup(team);
    const teamPower = engine.calcTeamPowerWithPlayer(team);
    const starterOvrs = Object.values(lineup.starters).map(player => Number(player.ovr) || 0);
    const topTenOvrs = starterOvrs.concat((lineup.bench || []).slice(0, 5).map(player => Number(player.ovr) || 0));
    const sortedOvrs = topTenOvrs.slice().sort((a, b) => b - a);
    const average = values => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
    return [team, {
      top1: sortedOvrs[0] || 0,
      top3Average: Number(average(sortedOvrs.slice(0, 3)).toFixed(2)),
      starterAverage: Number(average(starterOvrs).toFixed(2)),
      top10Average: Number(average(topTenOvrs).toFixed(2)),
      fifthPlayer: sortedOvrs[4] || 0,
      tenthPlayer: sortedOvrs[9] || 0,
      battlePower: powerByTeam ? powerByTeam[team] : null,
      playoffBattlePower: playoffPowerByTeam ? playoffPowerByTeam[team] : null,
      overall: Number(teamPower.overall.toFixed(2)),
      offense: Number(teamPower.offense.toFixed(2)),
      defense: Number(teamPower.defense.toFixed(2)),
      starConcentration: Number((teamPower.starConcentration || 0).toFixed(2)),
    }];
  }));
}
const lineupSummary = buildLineupSummary(battlePower, playoffBattlePower);
const allPlayers = teams.flatMap(team => league.LEAGUE_PLAYER_DATA[team] || []);
const currentPlayerOvrs = allPlayers.map(player => Number(player.ovr) || 0);
const sourcePlayerOvrs = allPlayers.map(player => Number(player._sourceOvr) || Number(player.ovr) || 0);
const syncedOvrs = new Map();
teams.forEach(team => (league.LEAGUE_PLAYER_DATA[team] || []).forEach(player => {
  syncedOvrs.set(player, player.ovr);
  if (Number.isFinite(Number(player._sourceOvr))) player.ovr = Number(player._sourceOvr);
}));
STATE._lineupCache = {};
const sourceOvrBattlePower = Object.fromEntries(teams.map(team => [team, engine.getTeamBattlePower(team)]));
STATE.season.isPlayoffs = true;
const sourceOvrPlayoffBattlePower = Object.fromEntries(teams.map(team => [team, engine.getTeamBattlePower(team)]));
STATE.season.isPlayoffs = false;
const sourceLineupSummary = buildLineupSummary(sourceOvrBattlePower, sourceOvrPlayoffBattlePower);
syncedOvrs.forEach((ovr, player) => { player.ovr = ovr; });
STATE._lineupCache = {};
function percentile(values, ratio) {
  if (!values.length) return 0;
  const position = (values.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (position - lower);
}

function summarizePowerDistribution(powerByTeam) {
  const values = Object.values(powerByTeam).slice().sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const standardDeviation = Math.sqrt(values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length);
  return {
    max: Number(values[values.length - 1].toFixed(2)),
    p90: Number(percentile(values, 0.90).toFixed(2)),
    p75: Number(percentile(values, 0.75).toFixed(2)),
    median: Number(percentile(values, 0.50).toFixed(2)),
    p25: Number(percentile(values, 0.25).toFixed(2)),
    p10: Number(percentile(values, 0.10).toFixed(2)),
    min: Number(values[0].toFixed(2)),
    mean: Number(mean.toFixed(2)),
    standardDeviation: Number(standardDeviation.toFixed(2)),
    range: Number((values[values.length - 1] - values[0]).toFixed(2)),
  };
}

function pearsonCorrelation(left, right) {
  if (left.length !== right.length || left.length < 2) return 0;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let covariance = 0, leftVariance = 0, rightVariance = 0;
  left.forEach((value, index) => {
    const leftDelta = value - leftMean;
    const rightDelta = right[index] - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  });
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator ? covariance / denominator : 0;
}

function rankValues(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end++;
    const averageRank = (start + end - 1) / 2 + 1;
    for (let index = start; index < end; index++) ranks[sorted[index].index] = averageRank;
    start = end;
  }
  return ranks;
}

function spearmanCorrelation(left, right) {
  return pearsonCorrelation(rankValues(left), rankValues(right));
}

const powerDistribution = summarizePowerDistribution(battlePower);
const playoffPowerDistribution = summarizePowerDistribution(playoffBattlePower);
const sourceOvrPowerDistribution = summarizePowerDistribution(sourceOvrBattlePower);
const sourceOvrPlayoffPowerDistribution = summarizePowerDistribution(sourceOvrPlayoffBattlePower);
const playerOvrDistribution = summarizePowerDistribution(Object.fromEntries(currentPlayerOvrs.map((value, index) => [index, value])));
const sourcePlayerOvrDistribution = summarizePowerDistribution(Object.fromEntries(sourcePlayerOvrs.map((value, index) => [index, value])));
const lineupMetricDistribution = Object.fromEntries([
  ['top1', 'top1'],
  ['top3Average', 'top3Average'],
  ['starterAverage', 'starterAverage'],
  ['top10Average', 'top10Average'],
].map(([label, field]) => [label, summarizePowerDistribution(Object.fromEntries(
  teams.map(team => [team, lineupSummary[team][field]]),
))]));
const sourceVsCurrentPowerDelta = teams.map(team => ({
  team,
  sourcePower: sourceOvrBattlePower[team],
  currentPower: battlePower[team],
  delta: Number((sourceOvrBattlePower[team] - battlePower[team]).toFixed(2)),
})).sort((a, b) => b.delta - a.delta);

function getMetrics(team, tiedTeams, conf, games) {
  let headWins = 0, headGames = 0, confWins = 0, confGames = 0, pointDiff = 0;
  games.forEach(game => {
    if (game.home !== team && game.away !== team) return;
    const isHome = game.home === team;
    const opponent = isHome ? game.away : game.home;
    const won = isHome ? game.homeWon : !game.homeWon;
    if (tiedTeams.has(opponent)) { headGames++; if (won) headWins++; }
    if (conferenceByTeam[opponent] === conf) { confGames++; if (won) confWins++; }
    pointDiff += isHome ? game.scoreHome - game.scoreAway : game.scoreAway - game.scoreHome;
  });
  return {
    head: headGames ? headWins / headGames : null,
    conference: confGames ? confWins / confGames : null,
    pointDiff,
  };
}

function rankTie(rows, conf, games, criterion = 0) {
  if (rows.length <= 1) return rows.slice();
  const tiedTeams = new Set(rows.map(row => row.team));
  const metrics = Object.fromEntries(rows.map(row => [row.team, getMetrics(row.team, tiedTeams, conf, games)]));
  const criteria = ['head', 'conference', 'pointDiff'];
  if (criterion >= criteria.length) return rows.slice().sort((a, b) => a.team.localeCompare(b.team));
  const key = criteria[criterion];
  if (rows.some(row => metrics[row.team][key] == null)) return rankTie(rows, conf, games, criterion + 1);
  const sorted = rows.slice().sort((a, b) => metrics[b.team][key] - metrics[a.team][key]);
  const groups = [];
  sorted.forEach(row => {
    const value = metrics[row.team][key];
    const last = groups[groups.length - 1];
    if (!last || Math.abs(last.value - value) > 0.0000001) groups.push({ value, rows: [row] });
    else last.rows.push(row);
  });
  if (groups.length === 1) return rankTie(rows, conf, games, criterion + 1);
  return groups.reduce((all, group) => all.concat(group.rows.length > 1
    ? rankTie(group.rows, conf, games, 0)
    : group.rows), []);
}

function rankConference(conf, standings, games) {
  const sorted = conferences[conf]
    .map(team => ({ team, ...standings[team] }))
    .sort((a, b) => b.wins - a.wins);
  const ranked = [];
  for (let index = 0; index < sorted.length;) {
    let end = index + 1;
    while (end < sorted.length && sorted[end].wins === sorted[index].wins) end++;
    ranked.push(...rankTie(sorted.slice(index, end), conf, games));
    index = end;
  }
  return ranked;
}

const edgeSamples = {
  matchup: [],
  star: [],
  displayAppliedGap: [],
  matchupCapHits: 0,
  starCapHits: 0,
  games: 0,
};

function recordEdgeSaturation(result) {
  const components = result && result.marginComponents;
  if (!components) return;
  const rawMatchup = Number(components.rawMatchupEdge);
  const rawStar = Number(components.rawStarEdge);
  if (!Number.isFinite(rawMatchup) || !Number.isFinite(rawStar)) return;
  const appliedMatchup = Number(components.matchupEdge) || 0;
  const appliedStar = Number(components.starEdge) || 0;
  edgeSamples.matchup.push(Math.abs(rawMatchup));
  edgeSamples.star.push(Math.abs(rawStar));
  edgeSamples.displayAppliedGap.push(Math.abs(
    (rawMatchup + rawStar) - (appliedMatchup + appliedStar)
  ));
  if (Math.abs(rawMatchup) > 8 + 0.0000001) edgeSamples.matchupCapHits++;
  if (Math.abs(rawStar) > 8 + 0.0000001) edgeSamples.starCapHits++;
  edgeSamples.games++;
}

function playInGame(teamA, teamB) {
  const result = engine.simulateGameNew(teamA, teamB, 0, null, {
    isHomeA: true,
    isB2B: false,
  });
  recordEdgeSaturation(result);
  return result.won
    ? { winner: teamA, loser: teamB }
    : { winner: teamB, loser: teamA };
}

function playoffField(ranked) {
  const first = playInGame(ranked[6].team, ranked[7].team);
  const second = playInGame(ranked[8].team, ranked[9].team);
  const final = playInGame(first.loser, second.winner);
  return ranked.slice(0, 6).map(row => row.team).concat(first.winner, final.winner);
}

const homePattern = [true, true, false, false, true, false, true];
function simulateSeries(high, low, seedGap) {
  let highWins = 0, lowWins = 0;
  for (let game = 0; game < 7 && highWins < 4 && lowWins < 4; game++) {
    const result = engine.simulateGameNew(high, low, 0.4 * seedGap, null, {
      isHomeA: homePattern[game], isB2B: false,
    });
    recordEdgeSaturation(result);
    if (result.won) highWins++; else lowWins++;
  }
  return { lowWon: lowWins === 4, highWins, lowWins };
}

const labels = ['1-8', '2-7', '3-6', '4-5'];
const pairs = [[0, 7], [1, 6], [2, 5], [3, 4]];
const stats = Object.fromEntries(labels.map(label => [label, {
  series: 0, upsets: 0, upsetSweeps: 0, trueUnderdogSeries: 0, trueUnderdogWins: 0,
  lowerSeedStronger: 0, totalPowerGap: 0,
}]));
const scores = { '4-0': 0, '4-1': 0, '4-2': 0, '4-3': 0 };
const distribution = Array(9).fill(0);
let allSeries = 0, allUpsets = 0, trueSeries = 0, trueWins = 0, playoffsWithUpset = 0;
let recordPowerPearsonTotal = 0, recordPowerSpearmanTotal = 0;

for (let trial = 0; trial < trials; trial++) {
  const standings = Object.fromEntries(teams.map(team => [team, { wins: 0, losses: 0 }]));
  const games = [];
  STATE.season = { schedule: [], isPlayoffs: false, standings, _npcSeasonProfiles: {} };
  schedule.forEach(game => {
    const result = engine.simulateGameNew(game.home, game.away, 0, null, { isHomeA: true, isB2B: false });
    recordEdgeSaturation(result);
    if (result.won) { standings[game.home].wins++; standings[game.away].losses++; }
    else { standings[game.away].wins++; standings[game.home].losses++; }
    games.push({ home: game.home, away: game.away, scoreHome: result.scoreA, scoreAway: result.scoreB, homeWon: result.won });
  });
  const winTotals = teams.map(team => standings[team].wins);
  const regularSeasonPowers = teams.map(team => battlePower[team]);
  recordPowerPearsonTotal += pearsonCorrelation(winTotals, regularSeasonPowers);
  recordPowerSpearmanTotal += spearmanCorrelation(winTotals, regularSeasonPowers);
  STATE.season.isPlayoffs = true;
  let trialUpsets = 0;
  Object.keys(conferences).forEach(conf => {
    const field = playoffField(rankConference(conf, standings, games));
    pairs.forEach(([highIndex, lowIndex], pairIndex) => {
      const high = field[highIndex];
      const low = field[lowIndex];
      const row = stats[labels[pairIndex]];
      const result = simulateSeries(high, low, lowIndex - highIndex);
      const powerGap = playoffBattlePower[high] - playoffBattlePower[low];
      const isTrueUnderdog = powerGap > 0.05;
      row.totalPowerGap += powerGap;
      row.series++; allSeries++;
      if (isTrueUnderdog) { row.trueUnderdogSeries++; trueSeries++; }
      else if (powerGap < -0.05) row.lowerSeedStronger++;
      if (!result.lowWon) return;
      row.upsets++; allUpsets++; trialUpsets++;
      scores[`4-${result.highWins}`]++;
      if (result.highWins === 0) row.upsetSweeps++;
      if (isTrueUnderdog) { row.trueUnderdogWins++; trueWins++; }
    });
  });
  if (trialUpsets) playoffsWithUpset++;
  distribution[trialUpsets]++;
}

const pct = (value, total) => total ? Number((100 * value / total).toFixed(2)) : 0;
function summarizeAbsoluteEdges(values, capHits, cap) {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    samples: sorted.length,
    p95: Number(percentile(sorted, 0.95).toFixed(3)),
    p99: Number(percentile(sorted, 0.99).toFixed(3)),
    max: Number((sorted[sorted.length - 1] || 0).toFixed(3)),
    cap,
    capHitPct: pct(capHits, sorted.length),
  };
}
console.log(JSON.stringify({
  benchmarkMode,
  rosterPlayers: teams.reduce((sum, team) => sum + league.LEAGUE_PLAYER_DATA[team].length, 0),
  trials,
  powerDistribution,
  playoffPowerDistribution,
  sourceOvrPowerDistribution,
  sourceOvrPlayoffPowerDistribution,
  playerOvrDistribution,
  sourcePlayerOvrDistribution,
  lineupMetricDistribution,
  teamPowers: Object.fromEntries(Object.entries(battlePower).sort((a, b) => b[1] - a[1])),
  playoffTeamPowers: Object.fromEntries(Object.entries(playoffBattlePower).sort((a, b) => b[1] - a[1])),
  lineupSummary: Object.fromEntries(Object.entries(lineupSummary).sort((a, b) => battlePower[b[0]] - battlePower[a[0]])),
  sourceLineupSummary: Object.fromEntries(Object.entries(sourceLineupSummary).sort((a, b) => sourceOvrBattlePower[b[0]] - sourceOvrBattlePower[a[0]])),
  sourceVsCurrentPowerDelta: {
    largest10: sourceVsCurrentPowerDelta.slice(0, 10),
    smallest10: sourceVsCurrentPowerDelta.slice(-10).reverse(),
  },
  regularSeasonGamesSimulated: trials * schedule.length,
  firstRoundSeriesSimulated: allSeries,
  edgeSaturation: {
    matchupEdge: summarizeAbsoluteEdges(edgeSamples.matchup, edgeSamples.matchupCapHits, 8),
    starEdge: summarizeAbsoluteEdges(edgeSamples.star, edgeSamples.starCapHits, 8),
    displayVsAppliedGap: summarizeAbsoluteEdges(edgeSamples.displayAppliedGap, 0, null),
  },
  recordPowerCorrelation: {
    meanPearson: Number((recordPowerPearsonTotal / trials).toFixed(4)),
    meanSpearman: Number((recordPowerSpearmanTotal / trials).toFixed(4)),
  },
  overall: {
    seedUpsetRatePct: pct(allUpsets, allSeries),
    truePowerUnderdogWinRatePct: pct(trueWins, trueSeries),
    playoffsWithAtLeastOneUpsetPct: pct(playoffsWithUpset, trials),
    expectedUpsetsPerEightSeries: Number((allUpsets / trials).toFixed(3)),
  },
  byMatchup: Object.fromEntries(Object.entries(stats).map(([label, row]) => [label, {
    seedUpsetPct: pct(row.upsets, row.series),
    highSeedAdvancePct: Number((100 - pct(row.upsets, row.series)).toFixed(2)),
    truePowerUnderdogWinPct: pct(row.trueUnderdogWins, row.trueUnderdogSeries),
    lowerSeedActuallyStrongerPct: pct(row.lowerSeedStronger, row.series),
    lowerSeedSweepPct: pct(row.upsetSweeps, row.series),
    averageHighSeedPowerEdge: Number((row.totalPowerGap / row.series).toFixed(2)),
    samples: row.series,
  }])),
  upsetSeriesScoreSharePct: Object.fromEntries(Object.entries(scores).map(([score, count]) => [score, pct(count, allUpsets)])),
  upsetCountDistributionPct: Object.fromEntries(distribution.map((count, index) => [String(index), pct(count, trials)])),
}, null, 2));
