// 退役总结的统一事实源。
// 该模块只读取传入的 career/state，不依赖 DOM 或页面渲染，方便旧存档兼容和单元验证。
(function(root) {
  'use strict';

  var STAT_KEYS = [
    'pts', 'reb', 'ast', 'stl', 'blk', 'tov',
    'fgm', 'fga', 'ftm', 'fta', 'threeM', 'threeA', 'mins', 'games'
  ];

  function hasOwn(object, key) {
    return !!object && Object.prototype.hasOwnProperty.call(object, key);
  }

  function number(value) {
    var result = Number(value);
    return isFinite(result) ? result : 0;
  }

  function cloneStats(source) {
    var stats = source || {};
    var result = {};
    STAT_KEYS.forEach(function(key) {
      result[key] = number(stats[key]);
    });
    return result;
  }

  function hasSeasonPlayerStats(seasons) {
    return seasons.length > 0 && seasons.every(function(season) {
      return !!season.playerStats && hasOwn(season.playerStats, 'games');
    });
  }

  function sumSeasonStats(seasons, fallback) {
    var result = cloneStats();
    var present = {};
    STAT_KEYS.forEach(function(key) { present[key] = false; });
    seasons.forEach(function(season) {
      var stats = season.playerStats || {};
      STAT_KEYS.forEach(function(key) {
        if (hasOwn(stats, key)) {
          present[key] = true;
          result[key] += number(stats[key]);
        }
      });
    });
    STAT_KEYS.forEach(function(key) {
      if (!present[key]) result[key] = number(fallback && fallback[key]);
    });
    return result;
  }

  function labelOf(entry) {
    return typeof entry === 'string' ? entry : (entry && entry.label) || '';
  }

  function normalizedLabel(entry) {
    return String(labelOf(entry) || '')
      .replace(/^[^A-Za-z0-9\u3400-\u9FFF]+/, '')
      .trim();
  }

  function isRookieHonorForLaterSeason(entry) {
    var label = labelOf(entry);
    return label.indexOf('最佳新秀') >= 0 && (parseInt(entry && entry.seasonNum, 10) || 0) !== 1;
  }

  function isChampion(entry) {
    return labelOf(entry).indexOf('总冠军') >= 0;
  }

  function isMvp(entry) {
    return normalizedLabel(entry) === 'MVP';
  }

  function isFmvp(entry) {
    var label = labelOf(entry);
    return label.indexOf('总决赛MVP') >= 0 || label.indexOf('FMVP') >= 0;
  }

  function isDpoy(entry) {
    return labelOf(entry).indexOf('DPOY') >= 0;
  }

  function isAllLeague(entry) {
    return labelOf(entry).indexOf('最佳阵容') >= 0;
  }

  function isAllStar(entry) {
    return labelOf(entry).indexOf('全明星') >= 0;
  }

  function isRoty(entry) {
    return labelOf(entry).indexOf('最佳新秀') >= 0;
  }

  function normalizeAward(entry, season) {
    var result = typeof entry === 'string' ? { label: entry } : Object.assign({}, entry || {});
    if (result.seasonNum == null && season) result.seasonNum = season.seasonNum;
    if (!result.team && season) result.team = season.team;
    return result;
  }

  function getSeasons(career) {
    return (career && Array.isArray(career.seasons) ? career.seasons : [])
      .filter(function(season) { return !!season; })
      .slice()
      .sort(function(a, b) { return (number(a.seasonNum) || 0) - (number(b.seasonNum) || 0); });
  }

  function getHonorEntries(career) {
    return (career && Array.isArray(career.honors) ? career.honors : [])
      .map(function(entry) { return normalizeAward(entry); })
      .filter(function(entry) { return !!labelOf(entry) && !isRookieHonorForLaterSeason(entry); });
  }

  function getSeasonAwardEntries(seasons) {
    var entries = [];
    seasons.forEach(function(season) {
      (Array.isArray(season.awards) ? season.awards : []).forEach(function(entry) {
        var normalized = normalizeAward(entry, season);
        if (labelOf(normalized) && !isRookieHonorForLaterSeason(normalized)) entries.push(normalized);
      });
    });
    return entries;
  }

  function hasCompleteSeasonResults(seasons) {
    return seasons.length > 0 && seasons.every(function(season) {
      return hasOwn(season, 'seasonNum') && hasOwn(season, 'team') && hasOwn(season, 'playoffResult');
    });
  }

  function hasCompleteSeasonAwards(seasons) {
    return seasons.length > 0 && seasons.every(function(season) {
      return hasOwn(season, 'seasonNum') && hasOwn(season, 'team') && Array.isArray(season.awards);
    });
  }

  function countEntries(entries, predicate) {
    return entries.filter(function(entry) { return predicate(entry); }).length;
  }

  function seasonLabels(season, fallbackEntries) {
    var entries = Array.isArray(season.awards)
      ? season.awards.map(function(entry) { return normalizeAward(entry, season); })
      : fallbackEntries.filter(function(entry) { return number(entry.seasonNum) === number(season.seasonNum); });
    return entries.filter(function(entry) { return !isRookieHonorForLaterSeason(entry); });
  }

  function scoreSeason(season, fallbackEntries) {
    var stats = season.playerStats || {};
    var games = Math.max(number(stats.games), 1);
    var pts = number(stats.pts) / games;
    var reb = number(stats.reb) / games;
    var ast = number(stats.ast) / games;
    var stl = number(stats.stl) / games;
    var blk = number(stats.blk) / games;
    var labels = seasonLabels(season, fallbackEntries);
    var awardsScore = 0;
    labels.forEach(function(entry) {
      if (isMvp(entry)) awardsScore += 42;
      else if (isFmvp(entry)) awardsScore += 36;
      else if (isDpoy(entry)) awardsScore += 32;
      else if (isAllLeague(entry)) awardsScore += 18;
      else if (isAllStar(entry)) awardsScore += 7;
    });
    if (String(season.playoffResult || '').indexOf('总冠军') >= 0) awardsScore += 20;

    // 个人产出是主体，OVR、胜场和荣誉只作为上下文，避免球队战绩压过明显更好的个人赛季。
    var personalScore = pts * 2.4 + reb * 1.1 + ast * 1.4 + stl * 3 + blk * 3;
    var contextScore = number(season.ovr) * 0.6 + number(season.wins) * 0.04;
    return {
      season: season,
      score: personalScore + contextScore + awardsScore,
      ppg: pts,
      rpg: reb,
      apg: ast,
      spg: stl,
      bpg: blk,
      awardsScore: awardsScore,
      personalScore: personalScore
    };
  }

  function uniqueTeams(seasons, fallbackTeam) {
    var teams = [];
    seasons.forEach(function(season) {
      if (season.team && teams.indexOf(season.team) < 0) teams.push(season.team);
    });
    if (!teams.length && fallbackTeam) teams.push(fallbackTeam);
    return teams;
  }

  function getAchievementCountsForSeasons(career, seasonNums) {
    var seasons = getSeasons(career);
    var wanted = {};
    (seasonNums || []).forEach(function(seasonNum) { wanted[number(seasonNum)] = true; });
    var selected = seasons.filter(function(season) { return wanted[number(season.seasonNum)]; });
    var honors = getHonorEntries(career);
    var awardsComplete = selected.length > 0 && selected.every(function(season) {
      return Array.isArray(season.awards);
    });
    var resultsComplete = selected.length > 0 && selected.every(function(season) {
      return hasOwn(season, 'playoffResult');
    });
    var entries = awardsComplete
      ? getSeasonAwardEntries(selected)
      : honors.filter(function(entry) { return wanted[number(entry.seasonNum)]; });
    var result = {
      championships: resultsComplete
        ? selected.filter(function(season) { return String(season.playoffResult || '').indexOf('总冠军') >= 0; }).length
        : countEntries(entries, isChampion),
      mvp: countEntries(entries, isMvp),
      fmvp: countEntries(entries, isFmvp),
      dpoy: countEntries(entries, isDpoy),
      allLeague: countEntries(entries, isAllLeague),
      allStar: countEntries(entries, isAllStar),
      roty: countEntries(entries, isRoty)
    };
    return result;
  }

  function normalize(career, state) {
    var c = career || {};
    var seasons = getSeasons(c);
    var regularSeason = hasSeasonPlayerStats(seasons)
      ? sumSeasonStats(seasons, c.totalStats)
      : cloneStats(c.totalStats);
    var playoffs = cloneStats(c.playoffStats);
    var honors = getHonorEntries(c);
    var seasonAwards = getSeasonAwardEntries(seasons);
    var seasonResultsComplete = hasCompleteSeasonResults(seasons);
    var seasonAwardsComplete = hasCompleteSeasonAwards(seasons);
    var achievementEntries = seasonAwardsComplete ? seasonAwards : honors;
    var championshipSeasons = seasonResultsComplete
      ? seasons.filter(function(season) { return String(season.playoffResult || '').indexOf('总冠军') >= 0; })
      : [];
    var championships = seasonResultsComplete
      ? championshipSeasons.length
      : countEntries(achievementEntries, isChampion);

    var teams = uniqueTeams(seasons, state && state.careerTeam);
    var teamYears = {};
    seasons.forEach(function(season) {
      if (season.team) teamYears[season.team] = (teamYears[season.team] || 0) + 1;
    });
    if (!Object.keys(teamYears).length && teams[0]) teamYears[teams[0]] = 0;
    var longestTeam = '';
    Object.keys(teamYears).forEach(function(team) {
      if (!longestTeam || teamYears[team] > teamYears[longestTeam]) longestTeam = team;
    });

    var best = null;
    var peakOVR = 0;
    seasons.forEach(function(season) {
      peakOVR = Math.max(peakOVR, number(season.ovr));
      var scored = scoreSeason(season, honors);
      if (!best || scored.score > best.score ||
          (scored.score === best.score && scored.ppg > best.ppg) ||
          (scored.score === best.score && scored.ppg === best.ppg && number(season.ovr) > number(best.season.ovr))) {
        best = scored;
      }
    });
    if (!peakOVR && state) peakOVR = number(state.finalOVR);

    var flags = c.flags || {};
    var mobility = c.mobility || {};
    var branchHistory = Array.isArray(c.branchHistory) ? c.branchHistory : [];
    var hadMajorInjury = number(flags.majorInjuryInstance) > 0 || !!flags.majorInjuryPendingComeback ||
      !!flags.legacyHurt || !!flags.finalHurt || seasons.some(function(season) {
        return !!(season.events && season.events.majorInjuryThisSeason);
      });
    var wasTraded = !!flags.traded || !!flags.requestedTradeCompleted || number(mobility.trades) > 0 ||
      mobility.lastMove === 'trade' || mobility.lastMove === 'requested_trade' ||
      branchHistory.some(function(item) {
        return /trade|traded/i.test(String(item && (item.choice || item.eventId || item.event) || ''));
      });
    var hasRivalry = !!flags.eventRivalry || branchHistory.some(function(item) {
      return /rivalry|宿敌|对手/i.test(String(item && (item.eventId || item.event) || ''));
    });

    var finalsAppearances = seasonResultsComplete
      ? seasons.filter(function(season) {
          var result = String(season.playoffResult || '');
          return result.indexOf('总决赛') >= 0 || result.indexOf('总冠军') >= 0;
        }).length
      : 0;
    var championshipTeams = [];
    championshipSeasons.forEach(function(season) {
      if (season.team && championshipTeams.indexOf(season.team) < 0) championshipTeams.push(season.team);
    });

    return {
      seasons: seasons,
      seasonsCount: seasons.length,
      regularSeason: regularSeason,
      playoffs: playoffs,
      games: regularSeason.games,
      points: regularSeason.pts,
      playoffGames: playoffs.games,
      playoffPoints: playoffs.pts,
      championships: championships,
      fmvp: countEntries(achievementEntries, isFmvp),
      mvp: countEntries(achievementEntries, isMvp),
      dpoy: countEntries(achievementEntries, isDpoy),
      allLeague: countEntries(achievementEntries, isAllLeague),
      allStar: countEntries(achievementEntries, isAllStar),
      roty: countEntries(achievementEntries, isRoty),
      finalsAppearances: finalsAppearances,
      championshipSeasons: championshipSeasons.map(function(season) {
        return { seasonNum: season.seasonNum, team: season.team };
      }),
      championshipTeams: championshipTeams,
      teams: teams,
      teamCount: teams.length,
      teamYears: teamYears,
      longestTeam: longestTeam,
      longestYears: teamYears[longestTeam] || 0,
      firstTeam: teams[0] || '',
      lastTeam: teams.length ? teams[teams.length - 1] : '',
      oneTeamCareer: teams.length <= 1,
      peakOVR: peakOVR,
      bestSeason: best ? best.season : null,
      bestSeasonScore: best ? best.score : 0,
      bestSeasonStats: best ? {
        ppg: best.ppg,
        rpg: best.rpg,
        apg: best.apg,
        spg: best.spg,
        bpg: best.bpg
      } : null,
      awardEntries: achievementEntries,
      seasonStatsComplete: hasSeasonPlayerStats(seasons),
      seasonArchiveComplete: seasonResultsComplete && seasonAwardsComplete,
      seasonResultsComplete: seasonResultsComplete,
      seasonAwardsComplete: seasonAwardsComplete,
      hadMajorInjury: hadMajorInjury,
      wasTraded: wasTraded,
      hasRivalry: hasRivalry
    };
  }

  root.CareerSummary = {
    normalize: normalize,
    getAchievementCountsForSeasons: getAchievementCountsForSeasons,
    reconcileRegularSeasonTotals: function(career, state) {
      if (!career) return false;
      var summary = normalize(career, state || {});
      if (!summary.seasonStatsComplete) return false;
      career.totalStats = Object.assign({}, career.totalStats || {}, summary.regularSeason);
      return true;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
