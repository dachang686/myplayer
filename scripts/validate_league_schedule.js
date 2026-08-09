const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { console };
context.window = context;
vm.createContext(context);

[
  'js/data/league_players.js',
  'js/data/league_schedule.js',
  'js/data/simulation_config.js'
].forEach((relative) => {
  vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });
});

function generate(seed) {
  context.__scheduleSeed = seed;
  return vm.runInContext(`generateLeagueSchedule({
    teams: LEAGUE_TEAM_IDS,
    conference: SIM_CONFIG.CONFERENCE,
    divisions: SIM_CONFIG.DIVISIONS,
    seed: __scheduleSeed
  })`, context);
}

function pairKey(teamA, teamB) {
  return teamA < teamB ? `${teamA}|${teamB}` : `${teamB}|${teamA}`;
}

function validate(schedule, seed) {
  const teams = vm.runInContext('LEAGUE_TEAM_IDS.slice()', context);
  const conference = vm.runInContext('JSON.parse(JSON.stringify(SIM_CONFIG.CONFERENCE))', context);
  const divisions = vm.runInContext('JSON.parse(JSON.stringify(SIM_CONFIG.DIVISIONS))', context);
  const conferenceByTeam = {};
  const divisionByTeam = {};
  Object.entries(conference).forEach(([name, members]) => members.forEach(team => { conferenceByTeam[team] = name; }));
  Object.entries(divisions).forEach(([name, members]) => members.forEach(team => { divisionByTeam[team] = name; }));

  const failures = [];
  const gamesByTeam = Object.fromEntries(teams.map(team => [team, []]));
  const pairGames = {};
  const occupied = Object.fromEntries(teams.map(team => [team, new Set()]));
  const gameNums = new Set();
  const gamesPerDay = {};

  if (schedule.length !== 1230) failures.push(`全联盟场次应为 1230，实际 ${schedule.length}`);
  schedule.forEach((game) => {
    if (!gamesByTeam[game.home] || !gamesByTeam[game.away] || game.home === game.away) {
      failures.push(`非法对阵：${JSON.stringify(game)}`);
      return;
    }
    gamesByTeam[game.home].push({ ...game, isHome: true });
    gamesByTeam[game.away].push({ ...game, isHome: false });
    const key = pairKey(game.home, game.away);
    (pairGames[key] || (pairGames[key] = [])).push(game);
    if (occupied[game.home].has(game.day) || occupied[game.away].has(game.day)) {
      failures.push(`同队同日重复比赛：day ${game.day} ${game.home}-${game.away}`);
    }
    occupied[game.home].add(game.day);
    occupied[game.away].add(game.day);
    if (game.day < 0 || game.day > 173 || (game.day >= 115 && game.day <= 120)) {
      failures.push(`比赛日越界或落在全明星休赛期：${game.day}`);
    }
    if (gameNums.has(game.gameNum)) failures.push(`比赛编号重复：${game.gameNum}`);
    gameNums.add(game.gameNum);
    gamesPerDay[game.day] = (gamesPerDay[game.day] || 0) + 1;
  });

  Object.entries(gamesPerDay).forEach(([day, count]) => {
    if (count > 10) failures.push(`day ${day} 单日比赛超过 10 场：${count}`);
  });

  teams.forEach((team) => {
    const games = gamesByTeam[team].sort((a, b) => a.day - b.day);
    const homeGames = games.filter(game => game.isHome).length;
    if (games.length !== 82) failures.push(`${team} 场次应为 82，实际 ${games.length}`);
    if (homeGames !== 41) failures.push(`${team} 主场应为 41，实际 ${homeGames}`);
    let backToBacks = 0;
    for (let i = 1; i < games.length; i++) {
      if (games[i].day === games[i - 1].day + 1) backToBacks++;
    }
    if (backToBacks > 16) failures.push(`${team} 背靠背超过限制：${backToBacks}`);
    for (let i = 2; i < games.length; i++) {
      if (games[i].day === games[i - 1].day + 1 && games[i - 1].day === games[i - 2].day + 1) {
        failures.push(`${team} 出现连续三天比赛：${games[i - 2].day}-${games[i].day}`);
      }
    }

    const opponents = teams.filter(other => other !== team);
    let threeGameConferenceOpponents = 0;
    opponents.forEach((opponent) => {
      const count = (pairGames[pairKey(team, opponent)] || []).length;
      const sameDivision = divisionByTeam[team] === divisionByTeam[opponent];
      const sameConference = conferenceByTeam[team] === conferenceByTeam[opponent];
      if (sameDivision && count !== 4) failures.push(`${team}-${opponent} 同分区应交手 4 次，实际 ${count}`);
      if (!sameConference && count !== 2) failures.push(`${team}-${opponent} 跨联盟应交手 2 次，实际 ${count}`);
      if (sameConference && !sameDivision) {
        if (count === 3) threeGameConferenceOpponents++;
        else if (count !== 4) failures.push(`${team}-${opponent} 同联盟交手次数非法：${count}`);
      }
    });
    if (threeGameConferenceOpponents !== 4) {
      failures.push(`${team} 应有 4 个同联盟三场对手，实际 ${threeGameConferenceOpponents}`);
    }
  });

  if (gameNums.size !== 1230 || Math.min(...gameNums) !== 1 || Math.max(...gameNums) !== 1230) {
    failures.push('比赛编号必须连续覆盖 1-1230');
  }
  if (failures.length) throw new Error(`[${seed}]\n${failures.slice(0, 20).join('\n')}`);
}

const seeds = Array.from({ length: 25 }, (_, index) => `schedule-validation-${index + 1}`);
seeds.forEach(seed => validate(generate(seed), seed));

const stableA = JSON.stringify(generate('stable-seed'));
const stableB = JSON.stringify(generate('stable-seed'));
if (stableA !== stableB) throw new Error('同一种子没有生成相同赛程');
if (stableA === JSON.stringify(generate('different-seed'))) throw new Error('不同种子生成了相同赛程');

console.log(JSON.stringify({ seeds: seeds.length, gamesPerSeason: 1230, gamesPerTeam: 82, homeGamesPerTeam: 41 }));
