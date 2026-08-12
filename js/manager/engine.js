(function installManagerEngine(global) {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hashSeed(value) {
    var text = String(value == null ? '' : value);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function nextRandom(state) {
    var value = (Number(state.rngState) >>> 0) || 0x9e3779b9;
    value = (value + 0x6D2B79F5) >>> 0;
    var mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    state.rngState = value >>> 0;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  }

  function normal(state, mean, deviation) {
    var u = Math.max(nextRandom(state), 0.000001);
    var v = nextRandom(state);
    return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * deviation;
  }

  function teamName(teamId) {
    var names = global.FICTIONAL_TEAM_NAMES || {};
    var config = typeof SIM_CONFIG !== 'undefined' ? SIM_CONFIG : (global.SIM_CONFIG || {});
    return names[teamId] || (config.TEAM_NAMES || {})[teamId] || teamId;
  }

  function getConfig() {
    return typeof SIM_CONFIG !== 'undefined' ? SIM_CONFIG : (global.SIM_CONFIG || {});
  }

  function positionScore(player, offense) {
    var base = Number(player && player.ovr) || 70;
    var finishing = Number(player && player.FIN) || 60;
    var shooting = Number(player && player.threePT) || 60;
    var passing = Number(player && player.PAS) || 60;
    var defense = ((Number(player && player.PDEF) || 60) + (Number(player && player.IDEF) || 60)) / 2;
    var rebounding = Number(player && player.REB) || 60;
    if (offense) return base * 0.52 + finishing * 0.16 + shooting * 0.16 + passing * 0.10 + rebounding * 0.06;
    return base * 0.48 + defense * 0.25 + rebounding * 0.17 + (Number(player && player.ATH) || 60) * 0.10;
  }

  function rosterPower(state, teamId) {
    var roster = state.leagueData[teamId] || [];
    var rotation = teamId === state.selectedTeam ? state.rotation : null;
    var ranked = roster.slice().sort(function(a, b) {
      var aMinutes = rotation && rotation[a.id] ? Number(rotation[a.id].minutes) : 0;
      var bMinutes = rotation && rotation[b.id] ? Number(rotation[b.id].minutes) : 0;
      return (bMinutes - aMinutes) || ((Number(b.ovr) || 0) - (Number(a.ovr) || 0));
    });
    var selected = rotation
      ? ranked.filter(function(player) { return rotation[player.id] && Number(rotation[player.id].minutes) > 0; }).slice(0, 11)
      : ranked.slice(0, 10);
    if (!selected.length) selected = ranked.slice(0, 10);
    var totalMinutes = selected.reduce(function(sum, player) {
      return sum + (rotation && rotation[player.id] ? Math.max(1, Number(rotation[player.id].minutes) || 0) : 24);
    }, 0) || 1;
    var offense = selected.reduce(function(sum, player) {
      var minutes = rotation && rotation[player.id] ? Math.max(1, Number(rotation[player.id].minutes) || 0) : 24;
      return sum + positionScore(player, true) * minutes;
    }, 0) / totalMinutes;
    var defense = selected.reduce(function(sum, player) {
      var minutes = rotation && rotation[player.id] ? Math.max(1, Number(rotation[player.id].minutes) || 0) : 24;
      return sum + positionScore(player, false) * minutes;
    }, 0) / totalMinutes;
    return {
      offense: offense,
      defense: defense,
      overall: offense * 0.56 + defense * 0.44,
      rosterSize: selected.length
    };
  }

  function standingsList(state, conference) {
    var config = getConfig();
    var ids = (config.CONFERENCE && config.CONFERENCE[conference]) || [];
    return ids.slice().sort(function(a, b) {
      var recordA = state.season.standings[a] || {};
      var recordB = state.season.standings[b] || {};
      var winDiff = (recordB.wins || 0) - (recordA.wins || 0);
      if (winDiff) return winDiff;
      var differential = ((recordB.pointsFor || 0) - (recordB.pointsAgainst || 0)) - ((recordA.pointsFor || 0) - (recordA.pointsAgainst || 0));
      return differential || a.localeCompare(b);
    });
  }

  function activePlayerMinutes(state, teamId) {
    var roster = (state.leagueData[teamId] || []).slice();
    var defaultMinutes = [34, 32, 30, 28, 26, 22, 20, 18, 16, 14];
    if (teamId === state.selectedTeam) {
      roster.sort(function(a, b) {
        var aMinutes = state.rotation[a.id] ? Number(state.rotation[a.id].minutes) || 0 : 0;
        var bMinutes = state.rotation[b.id] ? Number(state.rotation[b.id].minutes) || 0 : 0;
        return bMinutes - aMinutes || (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
      });
      return roster.filter(function(player) {
        return state.rotation[player.id] && Number(state.rotation[player.id].minutes) > 0;
      }).slice(0, 11).map(function(player) {
        return { player: player, minutes: Number(state.rotation[player.id].minutes) || 0 };
      });
    }
    roster.sort(function(a, b) { return (Number(b.ovr) || 0) - (Number(a.ovr) || 0); });
    return roster.slice(0, 10).map(function(player, index) {
      return { player: player, minutes: defaultMinutes[index] };
    });
  }

  function allocatePoints(entries, teamScore) {
    var weights = entries.map(function(entry) {
      var player = entry.player;
      var scoring = (Number(player.ovr) || 70) * 0.52 + (Number(player.FIN) || 60) * 0.20 + (Number(player.threePT) || 60) * 0.18 + (Number(player.PAS) || 60) * 0.10;
      return Math.max(1, entry.minutes * scoring);
    });
    var totalWeight = weights.reduce(function(sum, weight) { return sum + weight; }, 0) || 1;
    var allocations = weights.map(function(weight, index) {
      var exact = teamScore * weight / totalWeight;
      return { index: index, value: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    var allocated = allocations.reduce(function(sum, item) { return sum + item.value; }, 0);
    allocations.slice().sort(function(a, b) { return b.remainder - a.remainder || a.index - b.index; }).slice(0, Math.max(0, teamScore - allocated)).forEach(function(item) {
      allocations[item.index].value++;
    });
    return allocations.map(function(item) { return item.value; });
  }

  function recordTeamPlayerStats(state, teamId, teamScore) {
    var entries = activePlayerMinutes(state, teamId);
    var points = allocatePoints(entries, teamScore);
    state.season.playerStats = state.season.playerStats || {};
    entries.forEach(function(entry, index) {
      var player = entry.player;
      var key = teamId + ':' + player.id;
      var minutesRatio = entry.minutes / 36;
      var rebounds = Math.max(0, Math.round(minutesRatio * (1.2 + (Number(player.REB) || 60) / 10.5)));
      var assists = Math.max(0, Math.round(minutesRatio * (0.8 + (Number(player.PAS) || 60) / 12.5)));
      var steals = Math.max(0, Math.round(minutesRatio * (0.15 + ((Number(player.PDEF) || 60) + (Number(player.ATH) || 60)) / 150)));
      var blocks = Math.max(0, Math.round(minutesRatio * (0.08 + (Number(player.IDEF) || 60) / 95)));
      var totals = state.season.playerStats[key] || {
        playerId: player.id,
        playerName: player.cname || player.name || '球员',
        teamId: teamId,
        games: 0,
        minutes: 0,
        points: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0
      };
      totals.games++;
      totals.minutes += entry.minutes;
      totals.points += points[index];
      totals.rebounds += rebounds;
      totals.assists += assists;
      totals.steals += steals;
      totals.blocks += blocks;
      state.season.playerStats[key] = totals;
    });
  }

  function recordGamePlayerStats(state, game, index) {
    state.season.playerStatGameKeys = state.season.playerStatGameKeys || {};
    var key = String(index) + ':' + game.home + ':' + game.away;
    if (state.season.playerStatGameKeys[key]) return;
    recordTeamPlayerStats(state, game.home, Number(game.homeScore) || 0);
    recordTeamPlayerStats(state, game.away, Number(game.awayScore) || 0);
    state.season.playerStatGameKeys[key] = true;
  }

  function ensureSeasonPlayerStats(state) {
    return Object.keys(state.season.playerStats).map(function(key) { return state.season.playerStats[key]; });
  }

  function simulateGame(state, home, away, options) {
    options = options || {};
    var homePower = rosterPower(state, home);
    var awayPower = rosterPower(state, away);
    var expectedMargin = clamp((homePower.overall - awayPower.overall) * 0.42 + 2.1, -18, 18);
    if (options.seedDiff) expectedMargin += clamp(Number(options.seedDiff) || 0, -4, 4);
    var total = clamp(218 + (homePower.offense + awayPower.offense - 150) * 0.33 + normal(state, 0, 5.2), 182, 258);
    var margin = expectedMargin + normal(state, 0, 8.2);
    var homeScore = Math.max(75, Math.round((total + margin) / 2));
    var awayScore = Math.max(75, Math.round((total - margin) / 2));
    if (homeScore === awayScore) {
      if (nextRandom(state) < 0.5) homeScore++; else awayScore++;
    }
    var winner = homeScore > awayScore ? home : away;
    var loser = winner === home ? away : home;
    return { home: home, away: away, homeScore: homeScore, awayScore: awayScore, winner: winner, loser: loser, margin: homeScore - awayScore, phase: options.phase || 'regular' };
  }

  function recordGame(state, result, index) {
    var homeRecord = state.season.standings[result.home];
    var awayRecord = state.season.standings[result.away];
    homeRecord.pointsFor += result.homeScore;
    homeRecord.pointsAgainst += result.awayScore;
    awayRecord.pointsFor += result.awayScore;
    awayRecord.pointsAgainst += result.homeScore;
    homeRecord[result.winner === result.home ? 'wins' : 'losses']++;
    awayRecord[result.winner === result.away ? 'wins' : 'losses']++;
    state.season.games.push({
      index: index,
      home: result.home,
      away: result.away,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      winner: result.winner,
      phase: result.phase
    });
    recordGamePlayerStats(state, result, index);
  }

  function getNextLeagueRegularGame(state) {
    return state.season.schedule[state.season.scheduleIndex] || null;
  }

  function getNextRegularGame(state) {
    for (var index = state.season.scheduleIndex; index < state.season.schedule.length; index++) {
      var game = state.season.schedule[index];
      if (game.home === state.selectedTeam || game.away === state.selectedTeam) return game;
    }
    return null;
  }

  function ensureRotation(state) {
    var roster = state.leagueData[state.selectedTeam] || [];
    var validation = global.ManagerState.validateRotation(roster, state.rotation);
    if (!validation.valid) throw new Error(validation.errors[0] || '请先修正轮换配置。');
    return validation;
  }

  function simulateNextRegularGame(state) {
    if (state.season.phase !== 'regular') return { done: true, result: null };
    ensureRotation(state);
    var fixture = getNextLeagueRegularGame(state);
    if (!fixture) {
      startPlayoffs(state);
      return { done: true, result: null };
    }
    var result = simulateGame(state, fixture.home, fixture.away, { phase: 'regular' });
    recordGame(state, result, fixture.gameNum);
    state.season.scheduleIndex++;
    if (state.season.scheduleIndex >= state.season.schedule.length) startPlayoffs(state);
    return { done: state.season.phase !== 'regular', result: result };
  }

  function simulateNextUserRegularGame(state) {
    if (state.season.phase !== 'regular') return { done: true, result: null, leagueGames: 0 };
    ensureRotation(state);
    var leagueGames = 0;
    while (state.season.phase === 'regular') {
      var fixture = getNextLeagueRegularGame(state);
      if (!fixture) {
        startPlayoffs(state);
        break;
      }
      var isUserGame = fixture.home === state.selectedTeam || fixture.away === state.selectedTeam;
      var step = simulateNextRegularGame(state);
      leagueGames++;
      if (isUserGame) return { done: step.done, result: step.result, leagueGames: leagueGames };
    }
    return { done: true, result: null, leagueGames: leagueGames };
  }

  function simulateRemainingRegularSeason(state) {
    ensureRotation(state);
    var count = 0;
    while (state.season.phase === 'regular' && state.season.scheduleIndex < state.season.schedule.length) {
      simulateNextRegularGame(state);
      count++;
    }
    if (state.season.phase === 'regular') startPlayoffs(state);
    return count;
  }

  function makeSeries(homeSeed, awaySeed, round, conference) {
    return { homeSeed: homeSeed, awaySeed: awaySeed, conference: conference, round: round, homeWins: 0, awayWins: 0, games: [], winner: null };
  }

  function seedTeams(state, conference) {
    return standingsList(state, conference).slice(0, 8);
  }

  function buildRound(state, round, conference, teams) {
    var pairs = [[0, 7], [3, 4], [1, 6], [2, 5]];
    return pairs.map(function(pair) {
      return makeSeries(teams[pair[0]], teams[pair[1]], round, conference);
    });
  }

  function startPlayoffs(state) {
    if (state.season.phase !== 'regular') return;
    var north = seedTeams(state, 'NORTH');
    var south = seedTeams(state, 'SOUTH');
    state.season.phase = 'playoffs';
    state.season.userRound = 0;
    state.season.playoffs = {
      round: 1,
      conferences: {
        NORTH: buildRound(state, 1, 'NORTH', north),
        SOUTH: buildRound(state, 1, 'SOUTH', south)
      },
      conferenceWinners: {},
      finals: null,
      champion: null
    };
  }

  function seriesWinner(series) {
    if (series.homeWins >= 4) return series.homeSeed;
    if (series.awayWins >= 4) return series.awaySeed;
    return null;
  }

  function simulateSeriesGame(state, series) {
    if (series.winner) return null;
    var home = series.games.length % 2 < 2 ? series.homeSeed : series.awaySeed;
    var away = home === series.homeSeed ? series.awaySeed : series.homeSeed;
    var seedDiff = ((Number(state.season.standings[series.homeSeed].wins) || 0) - (Number(state.season.standings[series.awaySeed].wins) || 0)) * 0.025;
    var result = simulateGame(state, home, away, { phase: 'playoffs', seedDiff: seedDiff });
    if (result.winner === series.homeSeed) series.homeWins++; else series.awayWins++;
    series.games.push({ home: home, away: away, homeScore: result.homeScore, awayScore: result.awayScore, winner: result.winner });
    state.season.games.push({
      index: 'P' + series.round + '-' + series.conference + '-' + series.games.length,
      home: home,
      away: away,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      winner: result.winner,
      phase: 'playoffs'
    });
    series.winner = seriesWinner(series);
    return result;
  }

  function allSeriesDone(seriesList) {
    return seriesList.every(function(series) { return !!series.winner; });
  }

  function advanceRound(state) {
    var playoffs = state.season.playoffs;
    var north = playoffs.conferences.NORTH;
    var south = playoffs.conferences.SOUTH;
    if (playoffs.round === 1 && allSeriesDone(north) && allSeriesDone(south)) {
      playoffs.round = 2;
      playoffs.conferences.NORTH = [makeSeries(north[0].winner, north[1].winner, 2, 'NORTH'), makeSeries(north[2].winner, north[3].winner, 2, 'NORTH')];
      playoffs.conferences.SOUTH = [makeSeries(south[0].winner, south[1].winner, 2, 'SOUTH'), makeSeries(south[2].winner, south[3].winner, 2, 'SOUTH')];
    } else if (playoffs.round === 2 && allSeriesDone(north) && allSeriesDone(south)) {
      playoffs.round = 3;
      playoffs.conferences.NORTH = [makeSeries(north[0].winner, north[1].winner, 3, 'NORTH')];
      playoffs.conferences.SOUTH = [makeSeries(south[0].winner, south[1].winner, 3, 'SOUTH')];
      playoffs.conferenceWinners = {};
    } else if (playoffs.round === 3 && allSeriesDone(north) && allSeriesDone(south)) {
      playoffs.round = 4;
      playoffs.conferenceWinners.NORTH = north[0].winner;
      playoffs.conferenceWinners.SOUTH = south[0].winner;
      playoffs.finals = makeSeries(playoffs.conferenceWinners.NORTH, playoffs.conferenceWinners.SOUTH, 4, 'FINALS');
      playoffs.conferences.NORTH = [];
      playoffs.conferences.SOUTH = [];
    } else if (playoffs.round === 4 && playoffs.finals && playoffs.finals.winner) {
      playoffs.champion = playoffs.finals.winner;
      state.season.champion = playoffs.champion;
      state.season.phase = 'complete';
      state.owner.evaluation = evaluateOwner(state);
    }
  }

  function simulateNextPostseasonGame(state) {
    if (state.season.phase !== 'playoffs') return { done: true, result: null };
    var playoffs = state.season.playoffs;
    var pending = [];
    if (playoffs.round < 4) {
      pending = playoffs.conferences.NORTH.concat(playoffs.conferences.SOUTH);
    } else if (playoffs.finals) pending = [playoffs.finals];
    var series = pending.find(function(item) { return !item.winner; });
    if (!series) {
      advanceRound(state);
      return simulateNextPostseasonGame(state);
    }
    var result = simulateSeriesGame(state, series);
    if (series.homeSeed === state.selectedTeam || series.awaySeed === state.selectedTeam) {
      state.season.userRound = Math.max(state.season.userRound, series.round);
    }
    if (series.winner) advanceRound(state);
    if (state.season.phase === 'complete') state.season.userRound = state.season.champion === state.selectedTeam ? 4 : state.season.userRound;
    return { done: state.season.phase === 'complete', result: result };
  }

  function simulateNextUserPostseasonGame(state) {
    var leagueGames = 0;
    while (state.season.phase === 'playoffs') {
      var step = simulateNextPostseasonGame(state);
      leagueGames++;
      if (step.result && (step.result.home === state.selectedTeam || step.result.away === state.selectedTeam)) {
        return { done: step.done, result: step.result, leagueGames: leagueGames };
      }
    }
    return { done: true, result: null, leagueGames: leagueGames };
  }

  function simulateRemainingPostseason(state) {
    var count = 0;
    while (state.season.phase === 'playoffs') {
      simulateNextPostseasonGame(state);
      count++;
    }
    return count;
  }

  function evaluateOwner(state) {
    var record = state.season.standings[state.selectedTeam] || { wins: 0 };
    var goal = state.owner.goal;
    var winsComplete = record.wins >= goal.targetWins;
    var roundComplete = (state.season.userRound || 0) >= goal.targetRound;
    var champion = state.season.champion === state.selectedTeam;
    var score = 50 + (winsComplete ? 22 : Math.max(0, record.wins - goal.targetWins) * 0.5) + (roundComplete ? 20 : (state.season.userRound || 0) * 4) + (champion ? 12 : 0);
    score = Math.round(clamp(score, 0, 100));
    var label = score >= 85 ? '超出预期' : (score >= 68 ? '达到预期' : (score >= 50 ? '仍有机会' : '低于预期'));
    return {
      score: score,
      label: label,
      winsComplete: winsComplete,
      roundComplete: roundComplete,
      champion: champion,
      summary: champion ? '你带领球队夺得总冠军。' : (roundComplete ? '季后赛推进符合董事会期待。' : '董事会希望下赛季更进一步。')
    };
  }

  function reset(state) {
    var fresh = global.ManagerState.create(state.selectedTeam, state.leagueData, Object.keys(state.leagueData), global.generateLeagueSchedule, global.SIM_CONFIG);
    global.MANAGER_STATE = fresh;
    return fresh;
  }

  global.ManagerEngine = {
    teamName: teamName,
    rosterPower: rosterPower,
    standingsList: standingsList,
    playerStatRows: ensureSeasonPlayerStats,
    getNextRegularGame: getNextRegularGame,
    simulateNextRegularGame: simulateNextRegularGame,
    simulateNextUserRegularGame: simulateNextUserRegularGame,
    simulateRemainingRegularSeason: simulateRemainingRegularSeason,
    startPlayoffs: startPlayoffs,
    simulateNextPostseasonGame: simulateNextPostseasonGame,
    simulateNextUserPostseasonGame: simulateNextUserPostseasonGame,
    simulateRemainingPostseason: simulateRemainingPostseason,
    evaluateOwner: evaluateOwner,
    reset: reset
  };
})(typeof window !== 'undefined' ? window : globalThis);
