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
const trials = Number(process.argv[2]) || 1000;
const STATE = { careerTeam: null, finalOVR: 0, position: null, attrs: {}, season: {}, _lineupCache: {} };
const ovrStart = offseasonSource.indexOf('function getOvrPositions');
const ovrEnd = offseasonSource.indexOf('// ==================== 联盟演变', ovrStart);
const syncLeaguePlayerOvrs = new Function(
  'SIM_CONFIG', 'ATTR_KEYS', 'STATE', 'LEAGUE_PLAYER_DATA', 'LEAGUE_TEAM_IDS', 'clearLineupCache',
  `${offseasonSource.slice(ovrStart, ovrEnd)}\nreturn syncLeaguePlayerOvrs;`,
)(SIM_CONFIG, SIM_CONFIG.ATTR_LIST, STATE, league.LEAGUE_PLAYER_DATA, league.LEAGUE_TEAM_IDS, () => {});
syncLeaguePlayerOvrs();
const engineStart = indexSource.indexOf('function getPlayerPositions');
const engineEnd = indexSource.indexOf('function leagueStatClamp', engineStart);
if (engineStart < 0 || engineEnd < 0) throw new Error('无法定位比赛引擎');
const engine = new Function(
  'LEAGUE_PLAYER_DATA', 'SIM_CONFIG', 'STATE', 'getMyPlayerDisplayName', 'getTeamName',
  'getLeaguePlayerAge', 'af', 'generateBoxScore',
  `${indexSource.slice(engineStart, engineEnd)}\nreturn { simulateGameNew, calcTeamPowerWithPlayer, getTeamBattlePower };`,
)(
  league.LEAGUE_PLAYER_DATA, SIM_CONFIG, STATE, () => '验证球员',
  team => (SIM_CONFIG.TEAM_NAMES && SIM_CONFIG.TEAM_NAMES[team]) || team,
  player => Number(player && player._age) || 27, value => value,
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
const schedule = generateLeagueSchedule({
  teams, conference: conferences, divisions: SIM_CONFIG.DIVISIONS, seed: 'current-roster-upset-2026-08-12',
});
const battlePower = Object.fromEntries(teams.map(team => [team, engine.getTeamBattlePower(team)]));

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

function playInGame(teamA, teamB) {
  const powerA = engine.calcTeamPowerWithPlayer(teamA);
  const powerB = engine.calcTeamPowerWithPlayer(teamB);
  const averageA = (powerA.offense + powerA.defense + powerA.depth) / 3;
  const averageB = (powerB.offense + powerB.defense + powerB.depth) / 3;
  const baseProbability = averageA / (averageA + averageB + 0.01);
  const adjustedProbability = baseProbability * 0.6 + 0.2 + Math.random() * 0.2;
  return Math.random() < adjustedProbability
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
    if (result.won) highWins++; else lowWins++;
  }
  return { lowWon: lowWins === 4, highWins, lowWins };
}

const labels = ['1-8', '2-7', '3-6', '4-5'];
const pairs = [[0, 7], [1, 6], [2, 5], [3, 4]];
const stats = Object.fromEntries(labels.map(label => [label, {
  series: 0, upsets: 0, upsetSweeps: 0, trueUnderdogSeries: 0, trueUnderdogWins: 0, lowerSeedStronger: 0,
}]));
const scores = { '4-0': 0, '4-1': 0, '4-2': 0, '4-3': 0 };
const distribution = Array(9).fill(0);
let allSeries = 0, allUpsets = 0, trueSeries = 0, trueWins = 0, playoffsWithUpset = 0;

for (let trial = 0; trial < trials; trial++) {
  const standings = Object.fromEntries(teams.map(team => [team, { wins: 0, losses: 0 }]));
  const games = [];
  STATE.season = { schedule: [], isPlayoffs: false, standings, _npcSeasonProfiles: {} };
  schedule.forEach(game => {
    const result = engine.simulateGameNew(game.home, game.away, 0, null, { isHomeA: true, isB2B: false });
    if (result.won) { standings[game.home].wins++; standings[game.away].losses++; }
    else { standings[game.away].wins++; standings[game.home].losses++; }
    games.push({ home: game.home, away: game.away, scoreHome: result.scoreA, scoreAway: result.scoreB, homeWon: result.won });
  });
  STATE.season.isPlayoffs = true;
  let trialUpsets = 0;
  Object.keys(conferences).forEach(conf => {
    const field = playoffField(rankConference(conf, standings, games));
    pairs.forEach(([highIndex, lowIndex], pairIndex) => {
      const high = field[highIndex];
      const low = field[lowIndex];
      const row = stats[labels[pairIndex]];
      const result = simulateSeries(high, low, lowIndex - highIndex);
      const isTrueUnderdog = battlePower[low] < battlePower[high] - 0.05;
      row.series++; allSeries++;
      if (isTrueUnderdog) { row.trueUnderdogSeries++; trueSeries++; }
      else if (battlePower[low] > battlePower[high] + 0.05) row.lowerSeedStronger++;
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
console.log(JSON.stringify({
  rosterPlayers: teams.reduce((sum, team) => sum + league.LEAGUE_PLAYER_DATA[team].length, 0),
  trials,
  regularSeasonGamesSimulated: trials * schedule.length,
  firstRoundSeriesSimulated: allSeries,
  overall: {
    seedUpsetRatePct: pct(allUpsets, allSeries),
    truePowerUnderdogWinRatePct: pct(trueWins, trueSeries),
    playoffsWithAtLeastOneUpsetPct: pct(playoffsWithUpset, trials),
    expectedUpsetsPerEightSeries: Number((allUpsets / trials).toFixed(3)),
  },
  byMatchup: Object.fromEntries(Object.entries(stats).map(([label, row]) => [label, {
    seedUpsetPct: pct(row.upsets, row.series),
    truePowerUnderdogWinPct: pct(row.trueUnderdogWins, row.trueUnderdogSeries),
    lowerSeedActuallyStrongerPct: pct(row.lowerSeedStronger, row.series),
    lowerSeedSweepPct: pct(row.upsetSweeps, row.series),
    samples: row.series,
  }])),
  upsetSeriesScoreSharePct: Object.fromEntries(Object.entries(scores).map(([score, count]) => [score, pct(count, allUpsets)])),
  upsetCountDistributionPct: Object.fromEntries(distribution.map((count, index) => [String(index), pct(count, trials)])),
}, null, 2));
