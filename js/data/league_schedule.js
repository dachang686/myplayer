// 每个赛季按职业篮球联赛规则生成一次联盟赛程；调用方负责把结果保存在赛季状态中。
var generateLeagueSchedule = (function() {
  'use strict';

  var SEASON_DAYS = 174;
  var ALL_STAR_BREAK_START = 115;
  var ALL_STAR_BREAK_END = 120;
  var MAX_GAMES_PER_DAY = 10;

  function hashSeed(value) {
    var text = String(value == null ? '' : value);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRandom(seed) {
    var state = hashSeed(seed) || 0x9e3779b9;
    return function() {
      state = (state + 0x6D2B79F5) >>> 0;
      var value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(values, random) {
    var result = values.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  function pairKey(teamA, teamB) {
    return teamA < teamB ? teamA + '|' + teamB : teamB + '|' + teamA;
  }

  function buildLeagueMaps(teams, conference, divisions) {
    var conferenceByTeam = {};
    var divisionByTeam = {};

    Object.keys(conference || {}).forEach(function(conf) {
      (conference[conf] || []).forEach(function(team) {
        if (conferenceByTeam[team]) throw new Error('球队重复出现在联盟配置中：' + team);
        conferenceByTeam[team] = conf;
      });
    });
    Object.keys(divisions || {}).forEach(function(division) {
      (divisions[division] || []).forEach(function(team) {
        if (divisionByTeam[team]) throw new Error('球队重复出现在分区配置中：' + team);
        divisionByTeam[team] = division;
      });
    });

    teams.forEach(function(team) {
      if (!conferenceByTeam[team]) throw new Error('球队缺少联盟配置：' + team);
      if (!divisionByTeam[team]) throw new Error('球队缺少分区配置：' + team);
    });
    return { conferenceByTeam: conferenceByTeam, divisionByTeam: divisionByTeam };
  }

  // 同联盟非同分区的 10 个对手中，每队有 4 个对手交手 3 次，其余交手 4 次。
  // 每两个分区之间取两组不重复完美匹配，使每队在另两个分区各有 2 个三场对手。
  function buildThreeGamePairs(teams, conference, divisions, maps, random) {
    var result = {};
    Object.keys(conference).forEach(function(conf) {
      var conferenceTeams = conference[conf].filter(function(team) { return teams.indexOf(team) >= 0; });
      var divisionNames = Object.keys(divisions).filter(function(division) {
        var divisionTeams = divisions[division] || [];
        return divisionTeams.length > 0 && divisionTeams.every(function(team) {
          return maps.conferenceByTeam[team] === conf;
        });
      });
      if (conferenceTeams.length !== 15 || divisionNames.length !== 3) {
        throw new Error(conf + ' 联盟必须由 3 个五队分区组成');
      }

      for (var leftIndex = 0; leftIndex < divisionNames.length; leftIndex++) {
        for (var rightIndex = leftIndex + 1; rightIndex < divisionNames.length; rightIndex++) {
          var left = shuffled(divisions[divisionNames[leftIndex]], random);
          var right = shuffled(divisions[divisionNames[rightIndex]], random);
          if (left.length !== 5 || right.length !== 5) throw new Error('每个分区必须包含 5 支球队');

          var firstShift = Math.floor(random() * 5);
          var secondShift = (firstShift + 1 + Math.floor(random() * 4)) % 5;
          for (var i = 0; i < 5; i++) {
            var firstOpponent = right[(i + firstShift) % 5];
            var secondOpponent = right[(i + secondShift) % 5];
            // 三场系列需要一方多一个主场。两组匹配反向分配，保证每队最终 41 主、41 客。
            result[pairKey(left[i], firstOpponent)] = left[i];
            result[pairKey(left[i], secondOpponent)] = secondOpponent;
          }
        }
      }
    });
    return result;
  }

  function createMatchups(teams, maps, threeGamePairs) {
    var games = [];
    for (var i = 0; i < teams.length; i++) {
      for (var j = i + 1; j < teams.length; j++) {
        var teamA = teams[i];
        var teamB = teams[j];
        var sameConference = maps.conferenceByTeam[teamA] === maps.conferenceByTeam[teamB];
        var sameDivision = maps.divisionByTeam[teamA] === maps.divisionByTeam[teamB];
        var key = pairKey(teamA, teamB);
        var gameCount = sameDivision ? 4 : (!sameConference ? 2 : (threeGamePairs[key] ? 3 : 4));
        var balancedGames = Math.floor(gameCount / 2);

        for (var homeA = 0; homeA < balancedGames; homeA++) {
          games.push({ home: teamA, away: teamB, pair: key });
        }
        for (var homeB = 0; homeB < balancedGames; homeB++) {
          games.push({ home: teamB, away: teamA, pair: key });
        }
        if (gameCount % 2 === 1) {
          var extraHome = threeGamePairs[key];
          games.push({ home: extraHome, away: extraHome === teamA ? teamB : teamA, pair: key });
        }
      }
    }
    return games;
  }

  function wouldCreateThreeInARow(days, day) {
    return (day >= 2 && days[day - 1] && days[day - 2])
      || (day >= 1 && day + 1 < SEASON_DAYS && days[day - 1] && days[day + 1])
      || (day + 2 < SEASON_DAYS && days[day + 1] && days[day + 2]);
  }

  function assignDays(matchups, teams, random) {
    var availableDays = [];
    for (var day = 0; day < SEASON_DAYS; day++) {
      if (day < ALL_STAR_BREAK_START || day > ALL_STAR_BREAK_END) availableDays.push(day);
    }

    for (var attempt = 0; attempt < 16; attempt++) {
      var orderedGames = shuffled(matchups, random).map(function(game) {
        return { home: game.home, away: game.away, pair: game.pair };
      });
      var occupied = {};
      teams.forEach(function(team) { occupied[team] = new Uint8Array(SEASON_DAYS); });
      var gamesPerDay = new Uint8Array(SEASON_DAYS);
      var pairDays = {};
      var failed = false;

      for (var gameIndex = 0; gameIndex < orderedGames.length; gameIndex++) {
        var game = orderedGames[gameIndex];
        var bestDay = -1;
        var bestScore = Infinity;
        var scanStart = Math.floor(random() * availableDays.length);

        for (var scan = 0; scan < availableDays.length; scan++) {
          var candidate = availableDays[(scanStart + scan) % availableDays.length];
          if (gamesPerDay[candidate] >= MAX_GAMES_PER_DAY) continue;
          if (occupied[game.home][candidate] || occupied[game.away][candidate]) continue;
          if (wouldCreateThreeInARow(occupied[game.home], candidate)) continue;
          if (wouldCreateThreeInARow(occupied[game.away], candidate)) continue;

          var adjacentGames = 0;
          if (candidate > 0) {
            adjacentGames += occupied[game.home][candidate - 1] + occupied[game.away][candidate - 1];
          }
          if (candidate + 1 < SEASON_DAYS) {
            adjacentGames += occupied[game.home][candidate + 1] + occupied[game.away][candidate + 1];
          }

          var repeatPenalty = 0;
          var previousPairDays = pairDays[game.pair] || [];
          for (var pairDayIndex = 0; pairDayIndex < previousPairDays.length; pairDayIndex++) {
            var distance = Math.abs(candidate - previousPairDays[pairDayIndex]);
            if (distance < 7) repeatPenalty += (7 - distance) * 4;
          }

          var score = gamesPerDay[candidate] * 3 + adjacentGames * 9 + repeatPenalty + random();
          if (score < bestScore) {
            bestScore = score;
            bestDay = candidate;
          }
        }

        if (bestDay < 0) {
          failed = true;
          break;
        }
        game.day = bestDay;
        occupied[game.home][bestDay] = 1;
        occupied[game.away][bestDay] = 1;
        gamesPerDay[bestDay]++;
        if (!pairDays[game.pair]) pairDays[game.pair] = [];
        pairDays[game.pair].push(bestDay);
      }

      if (!failed) return orderedGames;
    }
    throw new Error('无法在赛季日历内安排完整赛程');
  }

  return function(options) {
    options = options || {};
    var teams = (options.teams || []).slice();
    var conference = options.conference || {};
    var divisions = options.divisions || {};
    if (teams.length !== 30) throw new Error('联盟赛程生成器要求 30 支球队');

    var random = createRandom(options.seed || 'league-schedule');
    var maps = buildLeagueMaps(teams, conference, divisions);
    var threeGamePairs = buildThreeGamePairs(teams, conference, divisions, maps, random);
    var matchups = createMatchups(teams, maps, threeGamePairs);
    var games = assignDays(matchups, teams, random);

    games.sort(function(a, b) {
      return a.day - b.day || a.home.localeCompare(b.home) || a.away.localeCompare(b.away);
    });
    return games.map(function(game, index) {
      return { home: game.home, away: game.away, day: game.day, gameNum: index + 1 };
    });
  };
})();
