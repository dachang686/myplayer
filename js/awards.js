function getPlayerAwardStreak(player, act) {
  return player && player._awardStreak ? (player._awardStreak[act] || 0) : 0;
}

function addPlayerAwardStreak(player, act) {
  player._awardStreak = player._awardStreak || {};
  player._awardStreak[act] = (player._awardStreak[act] || 0) + 1;
}

function getUserPlayerObject() {
  if (!STATE._userAwardStreak) STATE._userAwardStreak = {};
  if (!STATE._userAwardStreak._awardStreak) STATE._userAwardStreak._awardStreak = {};
  return STATE._userAwardStreak;
}

function getUserRankStreak(act, rank) {
  var m = STATE._userAwardRankStreak || {};
  var rec = m[act];
  return rec && rec.rank === rank ? (rec.count || 0) : 0;
}

function recordUserRank(act, rank) {
  if (!rank) return;
  STATE._userAwardRankStreak = STATE._userAwardRankStreak || {};
  var rec = STATE._userAwardRankStreak[act] || { rank: null, count: 0 };
  if (rec.rank === rank) {
    rec.count = (rec.count || 0) + 1;
  } else {
    rec.rank = rank;
    rec.count = 1;
  }
  STATE._userAwardRankStreak[act] = rec;
}

var MVP_STAR_PROSPECT_IDS = [
  'D26-01', 'D26-02', 'D26-03',
  'S001', 'S002', 'S003',
  'S004', 'S005', 'S006'
];

// 热门新秀专属最佳阵容窗口起始赛季（2026届 2029-30、2027届 2030-31、2028届 2031-32，各持续4个赛季）
var MVP_STAR_ALLLEAGUE_START = [2029, 2029, 2029, 2030, 2030, 2030, 2031, 2031, 2031];

function isMvpStar(p) {
  return p && MVP_STAR_PROSPECT_IDS.indexOf(p._prospectId || p.id) >= 0;
}

function getMvpStarAllLeagueStart(p) {
  if (!p) return null;
  var idx = MVP_STAR_PROSPECT_IDS.indexOf(p._prospectId || p.id);
  return idx >= 0 ? MVP_STAR_ALLLEAGUE_START[idx] : null;
}

function getPlayerEnterYear(p) {
  if (p && p._enterYear) return p._enterYear;
  var age = p ? getLeaguePlayerAge(p) : 22;
  var y = 2025 + ((STATE.career && STATE.career.seasonCount) || 0);
  if (p && typeof age === 'number' && age > 0) p._enterYear = y - (age - 19);
  return (p && p._enterYear) || y;
}

function findPlayerByIdentity(playerId, nameCN) {
  for (var _ft = 0; _ft < LEAGUE_TEAM_IDS.length; _ft++) {
    var roster = (LEAGUE_PLAYER_DATA && LEAGUE_PLAYER_DATA[LEAGUE_TEAM_IDS[_ft]]) || [];
    for (var _fp = 0; _fp < roster.length; _fp++) {
      var p = roster[_fp];
      if (playerId && p.id === playerId) return p;
      if (nameCN && p.cname === nameCN) return p;
    }
  }
  return null;
}

function findPlayerTeamByIdentity(playerId, nameCN) {
  for (var _ftt = 0; _ftt < LEAGUE_TEAM_IDS.length; _ftt++) {
    var roster = (LEAGUE_PLAYER_DATA && LEAGUE_PLAYER_DATA[LEAGUE_TEAM_IDS[_ftt]]) || [];
    for (var _fpt = 0; _fpt < roster.length; _fpt++) {
      var p = roster[_fpt];
      if ((playerId && p.id === playerId) || (nameCN && p.cname === nameCN)) return LEAGUE_TEAM_IDS[_ftt];
    }
  }
  return '';
}

function toPerGameSeasonStats(raw) {
  if (!raw) return null;
  var gp = Number(raw.gp != null ? raw.gp : raw.games) || 0;
  if (!gp) return null;
  if (typeof getPerGameStats === 'function') {
    var shared = getPerGameStats(raw, gp);
    return {
      gp: gp,
      pts: shared.pts,
      reb: shared.reb,
      ast: shared.ast,
      stl: shared.stl,
      blk: shared.blk
    };
  }
  function average(field) {
    return Math.round(((Number(raw[field]) || 0) / gp) * 10) / 10;
  }
  return {
    gp: gp,
    pts: average('pts'),
    reb: average('reb'),
    ast: average('ast'),
    stl: average('stl'),
    blk: average('blk')
  };
}

/** 读取联盟球员本赛季累计统计并转换为场均；奖项模块不得生成或估算 NPC 数据。 */
function getLeaguePlayerSeasonStats(player, team) {
  if (!player || !STATE.season) return null;
  var store = STATE.season.leaguePlayerSeasonStats || {};
  var key = String(team || '') + ':' + String(player.id || '');
  return toPerGameSeasonStats(store[key]);
}

function getUserSeasonAverageStats() {
  return STATE.season ? toPerGameSeasonStats(STATE.season.playerStats) : null;
}

/** 最佳新秀只看当季实际表现；球队排名只提供很小加成，不能盖过明显的数据差距。 */
function calcRookieAwardScore(candidate) {
  var stats = candidate && candidate.stats || {};
  var gp = Number(stats.gp) || 0;
  if (gp < 40) return -10000 + gp;
  var score = (Number(stats.pts) || 0)
    + (Number(stats.reb) || 0) * 0.7
    + (Number(stats.ast) || 0) * 0.8
    + (Number(stats.stl) || 0) * 1.5
    + (Number(stats.blk) || 0) * 1.5
    + (Number(candidate.teamBonus) || 0) * 0.5;
  if (gp < 58) score -= (58 - gp) * 0.75;
  return score;
}

function getRookieAwardTeamBonus(team) {
  var seed = getConferenceSeed(team);
  if (seed <= 3) return 4;
  if (seed <= 6) return 2;
  if (seed <= 10) return 1;
  return 0;
}

function find2026RookieAwardPlayer(cname) {
  if (typeof LEAGUE_TEAM_IDS !== 'undefined' && typeof LEAGUE_PLAYER_DATA !== 'undefined') {
    for (var teamIndex = 0; teamIndex < LEAGUE_TEAM_IDS.length; teamIndex++) {
      var team = LEAGUE_TEAM_IDS[teamIndex];
      var roster = LEAGUE_PLAYER_DATA[team] || [];
      for (var playerIndex = 0; playerIndex < roster.length; playerIndex++) {
        if (roster[playerIndex].cname === cname) {
          return { player: roster[playerIndex], team: team };
        }
      }
    }
  }
  return null;
}

function build2026RookieAwards() {
  if (!STATE.season || !STATE.season.playerStats) return null;
  var draftClass = typeof DRAFT_CLASS_2026 !== 'undefined' ? DRAFT_CLASS_2026 : [];
  if (!draftClass.length) return null;

  var seen = {};
  var rookieCandidates = draftClass.filter(function(draftPlayer) {
    if (!draftPlayer || !draftPlayer.cn || seen[draftPlayer.cn]) return false;
    seen[draftPlayer.cn] = true;
    return true;
  }).map(function(draftPlayer) {
    var match = find2026RookieAwardPlayer(draftPlayer.cn);
    var player = match && match.player;
    var team = match ? match.team : (draftPlayer.team || '');
    return {
      id: player && player.id || '',
      cname: draftPlayer.cn,
      team: team,
      stats: player && team ? getLeaguePlayerSeasonStats(player, team) : null,
      isUser: false,
      teamBonus: team ? getRookieAwardTeamBonus(team) : 0
    };
  });

  rookieCandidates.push(createUserRookieCandidate());
  return buildRookieAwardsFromCandidates(rookieCandidates);
}

function createUserRookieCandidate() {
  return {
    id: '',
    cname: getMyPlayerDisplayName(),
    team: STATE.careerTeam,
    stats: getUserSeasonAverageStats(),
    isUser: true,
    teamBonus: getRookieAwardTeamBonus(STATE.careerTeam)
  };
}

function buildRookieAwardsFromCandidates(rookieCandidates) {
  if (!rookieCandidates || !rookieCandidates.length) return null;
  rookieCandidates.forEach(function(candidate) {
    candidate.awardScore = calcRookieAwardScore(candidate);
  });
  rookieCandidates.sort(function(a, b) {
    return b.awardScore - a.awardScore
      || ((b.stats && b.stats.gp) || 0) - ((a.stats && a.stats.gp) || 0)
      || ((b.stats && b.stats.pts) || 0) - ((a.stats && a.stats.pts) || 0);
  });

  var userRookieIndex = rookieCandidates.findIndex(function(candidate) { return candidate.isUser; });
  var userRookiePlacement = userRookieIndex + 1;
  var rankLabels = ['🥇 第一名', '🥈 第二名', '🥉 第三名', '第四名', '第五名'];
  var userStats = getUserSeasonAverageStats();
  var rotyRank = userRookieIndex >= 0 && userRookieIndex < rankLabels.length
    ? rankLabels[userRookieIndex]
    : ((userStats || {}).gp < 40 ? '出勤不足' : '未进入前五');
  var rotyWinner = rookieCandidates[0];
  var rookiePlayers = rookieCandidates.slice(0, 5).map(function(candidate) {
    return {
      id: candidate.id || '',
      cname: candidate.cname,
      team: candidate.team || '',
      stats: candidate.stats,
      isUser: !!candidate.isUser
    };
  });
  var userInRookie = userRookiePlacement >= 1 && userRookiePlacement <= 5;
  var userRookieRank = userInRookie
    ? '入选最佳新秀阵容'
    : (userRookiePlacement >= 6 && userRookiePlacement <= 10 ? '新秀二阵' : rotyRank);

  return [
    {
      act: 'roty',
      label: '年度最佳新秀',
      winner: rotyWinner.cname,
      winnerId: rotyWinner.id || '',
      team: rotyWinner.team || '',
      isUser: !!rotyWinner.isUser,
      userRank: rotyRank
    },
    {
      act: 'allRookie',
      label: '最佳新秀阵容',
      winner: rookiePlayers.map(function(player) { return player.cname; }).join('、'),
      winnerId: rookiePlayers.map(function(player) { return player.id || ''; }).join('、'),
      team: '',
      players: rookiePlayers,
      isUser: userInRookie,
      userRank: userRookieRank,
      isList: true
    }
  ];
}

/** 后续届新秀以选秀写入的 _rookieSeason 为准；玩家只在首个职业赛季具备资格。 */
function buildCurrentSeasonRookieAwards() {
  if (!STATE.season || !STATE.season.playerStats || typeof LEAGUE_TEAM_IDS === 'undefined') return null;
  var currentSeason = typeof getCurrentLeagueSeasonNumber === 'function'
    ? getCurrentLeagueSeasonNumber()
    : Math.max(1, ((STATE.career && STATE.career.seasonCount) || 0) + 1);
  var seen = {};
  var rookieCandidates = [];
  LEAGUE_TEAM_IDS.forEach(function(team) {
    (LEAGUE_PLAYER_DATA[team] || []).forEach(function(player) {
      if (!player || Number(player._rookieSeason) !== currentSeason) return;
      var key = String(player.id || player.cname || '');
      if (!key || seen[key]) return;
      seen[key] = true;
      rookieCandidates.push({
        id: player.id || '',
        cname: player.cname || '球员',
        team: team,
        stats: getLeaguePlayerSeasonStats(player, team),
        isUser: false,
        teamBonus: getRookieAwardTeamBonus(team)
      });
    });
  });
  if (!STATE.career || STATE.career.seasonCount === 0) rookieCandidates.push(createUserRookieCandidate());
  return buildRookieAwardsFromCandidates(rookieCandidates);
}

function computeSixthManRank(avgPts) {
  var scores = [];
  for (var _st2 = 0; _st2 < LEAGUE_TEAM_IDS.length; _st2++) {
    var t2 = LEAGUE_TEAM_IDS[_st2];
    if (t2 === STATE.careerTeam) continue;
    var lineup2b = calcTeamLineup(t2);
    var bench2b = lineup2b.bench || [];
    var best2 = 0;
    for (var _b2 = 0; _b2 < bench2b.length; _b2++) {
      var pb = bench2b[_b2];
      if (pb._isUser) continue;
      if (getPlayerAwardStreak(pb, 'sixthman') >= 2) continue;
      var o2 = parseInt(pb.ovr) || 0;
      if (o2 > best2) best2 = o2;
    }
    if (best2 > 0) scores.push(best2);
  }
  var userScore = Math.round((avgPts || 0) * 3 + (parseInt(STATE.finalOVR) || 0) * 0.4);
  scores.push(userScore);
  scores.sort(function(x, y) { return y - x; });
  return scores.indexOf(userScore) + 1;
}

function updateAwardStreaks() {
  var c = STATE.career;
  var seasonKey = c && c.seasonCount;
  if (!seasonKey || STATE._awardStreakSeason === seasonKey) return;
  STATE._awardStreakSeason = seasonKey;
  var acts = ['mvp', 'dpoy', 'sixthman', 'scoring', 'rebounding', 'assists', 'steals', 'blocks'];
  var userObj = getUserPlayerObject();
  var winnerByAct = {};
  (STATE.season.awards || []).forEach(function(a) {
    if (!a || !a.act || acts.indexOf(a.act) < 0) return;
    winnerByAct[a.act] = a.isUser ? userObj : findPlayerByIdentity(a.winnerId || '', a.winner || '');
    if (a.userRank) recordUserRank(a.act, a.userRank);
  });
  function nextStreak(player, act) {
    var old = player && player._awardStreak ? (player._awardStreak[act] || 0) : 0;
    return winnerByAct[act] === player ? old + 1 : 0;
  }
  for (var _st = 0; _st < LEAGUE_TEAM_IDS.length; _st++) {
    var roster = (LEAGUE_PLAYER_DATA && LEAGUE_PLAYER_DATA[LEAGUE_TEAM_IDS[_st]]) || [];
    for (var _sp = 0; _sp < roster.length; _sp++) {
      var p = roster[_sp];
      p._awardStreak = p._awardStreak || {};
      for (var _sa = 0; _sa < acts.length; _sa++) p._awardStreak[acts[_sa]] = nextStreak(p, acts[_sa]);
    }
  }
  for (var _ua = 0; _ua < acts.length; _ua++) userObj._awardStreak[acts[_ua]] = nextStreak(userObj, acts[_ua]);
}

/** 计算赛季全量常规赛奖项 */
function calcSeasonAwards() {
  try {
    var ps = STATE.season.playerStats;
    if (!ps || !ps.games) return;
    var leagueSeasonStats = STATE.season.leaguePlayerSeasonStats || {};
    if (Object.keys(leagueSeasonStats).length === 0) {
      console.warn('[calcSeasonAwards] 缺少联盟球员赛季统计，拒绝临时生成 NPC 数据');
      STATE.season.awards = [];
      return;
    }
    var g = ps.games;
    var avg = STATE.season.avgStats || {
      pts: Math.round(ps.pts / g * 10) / 10,
      reb: Math.round(ps.reb / g * 10) / 10,
      ast: Math.round(ps.ast / g * 10) / 10,
      stl: Math.round(ps.stl / g * 10) / 10,
      blk: Math.round(ps.blk / g * 10) / 10,
    };
    STATE.season.awards = [];

    // ---------- 通用工具 ----------
    function lp(name) {
      for (var _t = 0; _t < LEAGUE_TEAM_IDS.length; _t++) {
        var _r = LEAGUE_PLAYER_DATA[LEAGUE_TEAM_IDS[_t]];
        if (!_r) continue;
        for (var _p = 0; _p < _r.length; _p++) {
          if (_r[_p].id === name) {
            return { team: LEAGUE_TEAM_IDS[_t], cname: _r[_p].cname || name, playerName: name };
          }
        }
      }
      return null;
    }

    function getLeagueRank(team) {
      var rows = [];
      for (var _lt = 0; _lt < LEAGUE_TEAM_IDS.length; _lt++) {
        var code = LEAGUE_TEAM_IDS[_lt];
        var st = STATE.season.standings && STATE.season.standings[code];
        rows.push({ team: code, wins: st ? st.wins : 0, losses: st ? st.losses : 82 });
      }
      rows.sort(function(a, b) {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.losses - b.losses;
      });
      for (var _lr = 0; _lr < rows.length; _lr++) {
        if (rows[_lr].team === team) return _lr + 1;
      }
      return 30;
    }

    function getTeamWins(team) {
      var st = STATE.season.standings && STATE.season.standings[team];
      return st ? (st.wins || 0) : 0;
    }

    function getSeedBonus(team) {
      var seed = getConferenceSeed(team);
      if (seed <= 3) return 4;
      if (seed <= 6) return 2;
      if (seed <= 10) return 1;
      return 0;
    }

    // ---------- 1. 从联盟赛季统计构建候选人池 ----------
    var candidates = [];

    for (var ti = 0; ti < LEAGUE_TEAM_IDS.length; ti++) {
      var team = LEAGUE_TEAM_IDS[ti];
      var roster = LEAGUE_PLAYER_DATA[team] || [];
      for (var pi = 0; pi < roster.length; pi++) {
        var p = roster[pi];
        if (p._isUser) continue;
        var pos = (p.pos || 'SF').split('/')[0].trim();
        var ovr = parseInt(p.ovr) || 50;
        var st = getLeaguePlayerSeasonStats(p, team);
        if (!st) continue;
        candidates.push({
          id: p.id,
          cname: p.cname || '球员',
          team: team,
          pos: pos,
          ovr: ovr,
          stats: st,
          isUser: false,
          age: typeof getLeaguePlayerAge === 'function' ? getLeaguePlayerAge(p) : 26,
          raw: p
        });
      }
    }

    var userCandidate = {
      id: 'USER',
      cname: typeof getMyPlayerDisplayName === 'function' ? getMyPlayerDisplayName() : '玩家',
      team: STATE.careerTeam,
      pos: STATE.position || 'SF',
      ovr: STATE.finalOVR || 75,
      stats: {
        pts: avg.pts, reb: avg.reb, ast: avg.ast,
        stl: avg.stl, blk: avg.blk, gp: g
      },
      isUser: true,
      age: (STATE.career && STATE.career.currentAge) || 22,
      raw: {
        PDEF: (STATE.attrs && STATE.attrs.PDEF) || 60,
        STL: (STATE.attrs && STATE.attrs.STL) || 50,
        IDEF: (STATE.attrs && STATE.attrs.IDEF) || 60,
        BLK: (STATE.attrs && STATE.attrs.BLK) || 50,
        ATH: (STATE.attrs && STATE.attrs.ATH) || 60
      }
    };
    candidates.push(userCandidate);
    // 统计王不接受 OVR 门槛；保留独立池以防后续奖项条件变化影响统计归属。
    var statCandidates = candidates.slice();

    // 防守数据榜名次用于 DPOY 加成；并列数据共享同一名次。
    ['reb', 'stl', 'blk'].forEach(function(statKey) {
      var eligible = candidates.filter(function(c) { return c.stats.gp >= 50; });
      eligible.sort(function(a, b) { return (b.stats[statKey] || 0) - (a.stats[statKey] || 0); });
      var lastValue = null;
      var lastRank = 0;
      eligible.forEach(function(c, idx) {
        var value = c.stats[statKey] || 0;
        if (lastValue === null || value < lastValue) lastRank = idx + 1;
        c._defStatRanks = c._defStatRanks || {};
        c._defStatRanks[statKey] = lastRank;
        lastValue = value;
      });
    });

    // ---------- 2. 评分函数 ----------
    function calcMVPScore(c) {
      if (c.stats.gp < 58) return -999;
      var s = c.stats;
      var score =
        s.pts * 1.0 +
        s.reb * 0.55 +
        s.ast * 0.75 +
        s.stl * 1.1 +
        s.blk * 1.1 +
        getTeamWins(c.team) * 0.32 +
        getSeedBonus(c.team) * 1.2 +
        (c.ovr || 70) * 0.12;

      return score;
    }

    function calcDefenseScore(c) {
      if (c.stats.gp < 50) return -999;
      var s = c.stats;
      var p = c.raw || {};
      var pdef, stealAttr, idef, blkAttr;
      if (c.isUser) {
        pdef = parseInt(STATE.attrs && STATE.attrs.PDEF) || 60;
        stealAttr = parseInt(STATE.attrs && STATE.attrs.STL) || 50;
        idef = parseInt(STATE.attrs && STATE.attrs.IDEF) || 60;
        blkAttr = parseInt(STATE.attrs && STATE.attrs.BLK) || 50;
      } else {
        pdef = parseInt(p.PDEF) || 60;
        stealAttr = parseInt(p.STL) || 50;
        idef = parseInt(p.IDEF) || 60;
        blkAttr = parseInt(p.BLK) || 50;
      }
      // DPOY 以本赛季场上产出为主；属性只作为能力底盘，球队战绩仅小幅加成。
      var defenseAttr = (pdef + stealAttr + idef + blkAttr) / 4;
      var score =
        defenseAttr * 0.08 +
        s.reb * 0.40 +
        s.stl * 6.00 +
        s.blk * 7.00 +
        getSeedBonus(c.team);

      var ranks = c._defStatRanks || {};
      if (ranks.blk === 1) score += 4;
      else if (ranks.blk <= 3) score += 2;
      if (ranks.stl === 1) score += 4;
      else if (ranks.stl <= 3) score += 2;
      if (ranks.reb === 1) score += 2;
      else if (ranks.reb <= 3) score += 1;
      if (ranks.blk === 1 && (ranks.reb === 1 || ranks.stl === 1)) score += 3;
      return score;
    }

    function compareDefenseCandidates(a, b) {
      return calcDefenseScore(b) - calcDefenseScore(a)
        || (b.stats.blk || 0) - (a.stats.blk || 0)
        || (b.stats.stl || 0) - (a.stats.stl || 0)
        || (b.stats.reb || 0) - (a.stats.reb || 0)
        || (b.stats.gp || 0) - (a.stats.gp || 0);
    }

    function calcAllLeagueScore(c) {
      if (c.stats.gp < 55) return -999;
      var s = c.stats;
      return s.pts * 1.0 + s.reb * 0.6 + s.ast * 0.7 + s.stl * 1.0 + s.blk * 1.0 +
             (c.ovr || 70) * 0.35 + getTeamWins(c.team) * 0.18 + getSeedBonus(c.team);
    }

    function calcAllDefScore(c) {
      return calcDefenseScore(c);
    }

    // ---------- 3. MVP ----------
    (function() {
      var ranked = candidates.slice().sort(function(a, b) {
        return calcMVPScore(b) - calcMVPScore(a);
      });
      var winner = ranked[0];
      var userIdx = ranked.findIndex(function(x) { return x.isUser; });
      var userRank = '未进入前五';
      if (userIdx === 0) userRank = '🥇 第一名';
      else if (userIdx === 1) userRank = '🥈 第二名';
      else if (userIdx === 2) userRank = '🥉 第三名';
      else if (userIdx === 3) userRank = '第四名';
      else if (userIdx === 4) userRank = '第五名';

      STATE.season.awards.push({
        act: 'mvp',
        label: 'MVP',
        winner: winner.cname,
        winnerId: winner.isUser ? '' : winner.id,
        team: winner.team,
        isUser: !!winner.isUser,
        userRank: userRank
      });
      STATE._seasonMVP = winner;
    })();

    // ---------- 4. DPOY ----------
    (function() {
      var ranked = candidates.slice().sort(compareDefenseCandidates);
      var winner = ranked[0];
      var userIdx = ranked.findIndex(function(x) { return x.isUser; });
      var userRank = '未进入前五';
      if (userIdx === 0) userRank = '🥇 第一名';
      else if (userIdx === 1) userRank = '🥈 第二名';
      else if (userIdx === 2) userRank = '🥉 第三名';
      else if (userIdx === 3) userRank = '第四名';
      else if (userIdx === 4) userRank = '第五名';

      STATE.season.awards.push({
        act: 'dpoy',
        label: 'DPOY',
        winner: winner.cname,
        winnerId: winner.isUser ? '' : winner.id,
        team: winner.team,
        isUser: !!winner.isUser,
        userRank: userRank
      });
      STATE._seasonDPOY = winner;
    })();

    // ---------- 5. 联盟最佳阵容一/二/三阵 ----------
    (function() {
      var ranked = candidates.slice().sort(function(a, b) {
        return calcAllLeagueScore(b) - calcAllLeagueScore(a);
      });

      var mvp = STATE._seasonMVP;
      if (mvp) {
        ranked = ranked.filter(function(x) {
          return !(x.isUser === mvp.isUser && x.id === mvp.id);
        });
        ranked.unshift(mvp);
      }

      // 最佳阵容采用不限位置的评选方式：位置只用于展示，不用于硬塞名额。
      // 一阵先设质量门槛，避免中游 OVR 因位置缺口或补位进入一阵；MVP 保留锁定资格。
      var firstTeam = ranked.filter(function(c) {
        return c.isUser || c.ovr >= 88 || c === mvp;
      }).slice(0, 5);
      var selected = firstTeam.slice();
      var remaining = ranked.filter(function(c) {
        return selected.indexOf(c) < 0;
      });
      var teams = [firstTeam, remaining.slice(0, 5), remaining.slice(5, 10)];

      var labels = ['最佳阵容一阵', '最佳阵容二阵', '最佳阵容三阵'];
      var acts = ['allLeague1', 'allLeague2', 'allLeague3'];
      var rankTexts = ['🥇 一阵', '🥈 二阵', '🥉 三阵'];

      for (var t = 0; t < 3; t++) {
        var list = teams[t];
        var names = list.map(function(x) { return x.cname; }).join('、');
        var playerIds = list.map(function(x) { return x.isUser ? '' : x.id; }).join('、');
        var userIn = list.some(function(x) { return x.isUser; });
        STATE.season.awards.push({
          act: acts[t],
          label: labels[t],
          winner: names,
          winnerId: playerIds,
          players: list.map(function(x) {
            return {
              id: x.id,
              cname: x.cname,
              team: x.team,
              stats: x.stats,
              isUser: !!x.isUser
            };
          }),
          team: '',
          isUser: userIn,
          userRank: userIn ? rankTexts[t] : '未入围',
          isList: true
        });
      }
    })();

    // ---------- 6. 最佳防守阵容一/二队 ----------
    (function() {
      var ranked = candidates.slice().sort(compareDefenseCandidates);

      var dpoy = STATE._seasonDPOY;
      if (dpoy) {
        ranked = ranked.filter(function(x) {
          return !(x.isUser === dpoy.isUser && x.id === dpoy.id);
        });
        ranked.unshift(dpoy);
      }

      // 最佳防守阵容与 DPOY 使用同一排序口径，并采用不限位置的前五/后五。
      var teams = [ranked.slice(0, 5), ranked.slice(5, 10)];

      var labels = ['最佳防守阵容一队', '最佳防守阵容二队'];
      var acts = ['allDef1', 'allDef2'];
      var rankTexts = ['🥇 一队', '🥈 二队'];

      for (var t = 0; t < 2; t++) {
        var list = teams[t];
        var names = list.map(function(x) { return x.cname; }).join('、');
        var playerIds = list.map(function(x) { return x.isUser ? '' : x.id; }).join('、');
        var userIn = list.some(function(x) { return x.isUser; });
        STATE.season.awards.push({
          act: acts[t],
          label: labels[t],
          winner: names,
          winnerId: playerIds,
          players: list.map(function(x) {
            return {
              id: x.id,
              cname: x.cname,
              team: x.team,
              stats: x.stats,
              isUser: !!x.isUser
            };
          }),
          team: '',
          isUser: userIn,
          userRank: userIn ? rankTexts[t] : '未入围',
          isList: true
        });
      }
    })();

    // ---------- 7. 得分王 / 篮板王 / 助攻王 ----------
    function pickStatLeader(statKey, act, label, minGp) {
      minGp = minGp || 58;
      var eligible = statCandidates.filter(function(c) {
        return c.stats.gp >= minGp;
      });
      eligible.sort(function(a, b) {
        return (b.stats[statKey] || 0) - (a.stats[statKey] || 0);
      });
      if (!eligible.length) return;

      var winner = eligible[0];
      var userIdx = eligible.findIndex(function(x) { return x.isUser; });
      var statLabels = { pts: '得分', reb: '篮板', ast: '助攻', stl: '抢断', blk: '盖帽' };
      var statValue = Math.round((winner.stats[statKey] || 0) * 10) / 10;
      var userRank = '未进入前五';
      if (userIdx === 0) userRank = '🥇 第一名';
      else if (userIdx === 1) userRank = '🥈 第二名';
      else if (userIdx === 2) userRank = '🥉 第三名';
      else if (userIdx === 3) userRank = '第四名';
      else if (userIdx === 4) userRank = '第五名';
      else if (g < minGp) userRank = '出勤不足';

      STATE.season.awards.push({
        act: act,
        label: label,
        winner: winner.cname,
        winnerId: winner.isUser ? '' : winner.id,
        team: winner.team,
        isUser: !!winner.isUser,
        userRank: userRank,
        statKey: statKey,
        statLabel: statLabels[statKey] || statKey,
        statValue: statValue
      });
    }

    pickStatLeader('pts', 'scoring', '得分王', 58);
    pickStatLeader('reb', 'rebounding', '篮板王', 58);
    pickStatLeader('ast', 'assists', '助攻王', 58);
    pickStatLeader('stl', 'steals', '抢断王', 58);
    pickStatLeader('blk', 'blocks', '盖帽王', 58);

    // ---------- 8. 全明星 / ROTY / 最佳新秀阵容 / 最佳第六人 ----------
    (function() {
      function getAllStarTeamBonus(team) {
        var seed = getConferenceSeed(team);
        if (seed <= 3) return 4;
        if (seed <= 6) return 2;
        if (seed <= 10) return 1;
        return 0;
      }

      function calcAllStarScore(stat, ovr, team, gamesPlayed) {
        var gp = gamesPlayed == null ? 82 : gamesPlayed;
        if (gp < 40) return -999;
        var score = (stat.pts || 0) * 1.2
          + (stat.reb || 0) * 0.5
          + (stat.ast || 0) * 0.7
          + (stat.stl || 0) * 0.9
          + (stat.blk || 0) * 0.9
          + (parseInt(ovr) || 0) * 0.10
          + getAllStarTeamBonus(team);
        if (gp < 50) score -= 8;
        if ((stat.pts || 0) < 14 && (stat.stl || 0) + (stat.blk || 0) < 3.5) score -= 6;
        return score;
      }

      var allStarCandidates = [];
      candidates.forEach(function(c) {
        if (c.isUser || c.ovr < 82) return;
        allStarCandidates.push({
          name: c.cname,
          playerId: c.id || '',
          team: c.team,
          score: calcAllStarScore(c.stats, c.ovr, c.team, c.stats.gp),
          isUser: false,
        });
      });
      var userAllStarScore = calcAllStarScore(avg, STATE.finalOVR, STATE.careerTeam, g);
      allStarCandidates.push({
        name: getMyPlayerDisplayName(),
        playerId: '',
        team: STATE.careerTeam,
        score: userAllStarScore,
        isUser: true,
      });
      allStarCandidates.sort(function(a, b) { return b.score - a.score; });
      var userAllStarIndex = allStarCandidates.findIndex(function(x) { return x.isUser; });
      var userAllStarRank = userAllStarIndex >= 0 ? userAllStarIndex + 1 : 99;
      var userAllStarSelected = false;
      if (userAllStarScore >= 48) {
        userAllStarSelected = true;
      } else if (userAllStarScore >= 44 && (parseInt(STATE.finalOVR) || 0) >= 86) {
        userAllStarSelected = userAllStarRank <= 24 || Math.random() < 0.25;
      }
      if (g < 40) userAllStarSelected = false;
      var allStarUserRank = userAllStarSelected ? '⭐ 已入围' : (g < 40 ? '出勤不足' : '未入围');
      var topNonUserAllStar = allStarCandidates.find(function(x) { return !x.isUser; });
      var defaultWinnerName = topNonUserAllStar ? topNonUserAllStar.name : '联盟全明星阵容';
      var defaultWinnerId = topNonUserAllStar ? topNonUserAllStar.playerId : '';
      STATE.season.awards.push({
        act: 'allStar',
        label: '全明星',
        winner: userAllStarSelected ? getMyPlayerDisplayName() : defaultWinnerName,
        winnerId: userAllStarSelected ? '' : defaultWinnerId,
        team: userAllStarSelected ? STATE.careerTeam : (topNonUserAllStar ? topNonUserAllStar.team : ''),
        isUser: userAllStarSelected,
        userRank: allStarUserRank
      });
    })();

    var isFirstCareerSeason = !STATE.career || STATE.career.seasonCount === 0;
    var rookieAwards = isFirstCareerSeason ? build2026RookieAwards() : buildCurrentSeasonRookieAwards();
    if (rookieAwards) STATE.season.awards.push.apply(STATE.season.awards, rookieAwards);

    (function() {
      syncUserStarterStatus();
      var userIsBench = !STATE.season.isUserStarter;
      var sixthCandidates = [];
      LEAGUE_TEAM_IDS.forEach(function(team) {
        var lineup = calcTeamLineup(team);
        (lineup.bench || []).forEach(function(player) {
          if (!player || player._isUser) return;
          var stats = getLeaguePlayerSeasonStats(player, team);
          if (!stats || stats.gp < 40) return;
          sixthCandidates.push({ id: player.id || '', cname: player.cname || '球员', team: team, stats: stats,
            ovr: Number(player.ovr) || 0, isUser: false });
        });
      });
      if (userIsBench && g >= 40) {
        sixthCandidates.push({ id: '', cname: getMyPlayerDisplayName(), team: STATE.careerTeam,
          stats: getUserSeasonAverageStats(), ovr: Number(STATE.finalOVR) || 0, isUser: true });
      }
      function sixthScore(candidate) {
        var stats = candidate.stats || {};
        return (stats.pts || 0) + (stats.reb || 0) * 0.55 + (stats.ast || 0) * 0.75
          + (stats.stl || 0) * 1.2 + (stats.blk || 0) * 1.2 + (candidate.ovr || 0) * 0.001;
      }
      sixthCandidates.sort(function(a, b) {
        return sixthScore(b) - sixthScore(a) || (b.stats.gp || 0) - (a.stats.gp || 0);
      });
      var userIdx = sixthCandidates.findIndex(function(candidate) { return candidate.isUser; });
      var winner = sixthCandidates[0];
      var userSixthRank = '首发球员不参与评选';
      if (userIsBench) {
        if (g < 40) userSixthRank = '出勤不足';
        else if (userIdx === 0) userSixthRank = '🥇 第一名';
        else if (userIdx === 1) userSixthRank = '🥈 第二名';
        else if (userIdx === 2) userSixthRank = '🥉 第三名';
        else if (userIdx === 3) userSixthRank = '第四名';
        else if (userIdx === 4) userSixthRank = '第五名';
        else userSixthRank = '未进入前五';
      }
      if (winner) STATE.season.awards.push({ act: 'sixthman', label: '最佳第六人', winner: winner.cname,
        winnerId: winner.isUser ? '' : winner.id, team: winner.team, isUser: winner.isUser, userRank: userSixthRank });
    })();

    updateAwardStreaks();
  } catch (e) {
    console.error('[calcSeasonAwards]', e);
    STATE.season.awards = STATE.season.awards || [];
  }
}

/** 奖项页：每个奖项一行，头像 + 获奖者 + 排名 */
function showAwardsScreen() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC16",label:"常规赛奖项"});
  maybeRecordFirstSixtyWinMilestone();
  if (!STATE.season.awards || STATE.season.awards.length === 0) calcSeasonAwards();
  var awards = STATE.season.awards;
  if (!awards || awards.length === 0) return;

  // 旧存档按中文奖项名称归一化标识，保持既有 IndexedDB 存档可继续展示。
  var bestTeamActs = {
    '最佳阵容一阵': 'allLeague1',
    '最佳阵容二阵': 'allLeague2',
    '最佳阵容三阵': 'allLeague3'
  };
  awards.forEach(function(award) {
    if (award && bestTeamActs[award.label]) award.act = bestTeamActs[award.label];
  });

  STATE.season._awardsViewed = true;
  showScreen('screen-awards');
  scrollSeasonPageToTop();
  html('awards-content').innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100dvh - 120px);">' +
      '<div class="loading-balls"><span class="loading-ball"></span><span class="loading-ball"></span><span class="loading-ball"></span></div>' +
      '<div style="margin-top:16px;font-size:13px;color:var(--text-muted);font-family:var(--font-display);letter-spacing:1px;">统计选票中</div>' +
    '</div>';

  setTimeout(function() {
  var emojiMap = {
    mvp: '🏆',
    dpoy: '🔒',
    allStar: '⭐',
    allLeague1: '🌟',
    allLeague2: '✨',
    allLeague3: '💫',
    allDef1: '🛡️',
    allDef2: '🔰',
    scoring: '🔥',
    rebounding: '💪',
    assists: '🎯',
    steals: '⚡',
    blocks: '🚫',
    roty: '🌱',
    allRookie: '🌱',
    sixthman: '🔥'
  };

  var catMap = {
    mvp: '最有价值球员',
    dpoy: '最佳防守球员',
    allStar: '全明星',
    allLeague1: '最佳阵容一阵',
    allLeague2: '最佳阵容二阵',
    allLeague3: '最佳阵容三阵',
    allDef1: '最佳防守阵容一队',
    allDef2: '最佳防守阵容二队',
    scoring: '得分王',
    rebounding: '篮板王',
    assists: '助攻王',
    steals: '抢断王',
    blocks: '盖帽王',
    roty: '最佳新秀',
    allRookie: '最佳新秀阵容',
    sixthman: '最佳第六人'
  };

  function getHs(enName) {
    if (!enName) return '';
    var s = getPlayerHeadshotStyle(enName, 40);
    return s ? s.replace(/width:\d+px;height:\d+px;?/, '') : '';
  }

  function escapeAwardText(value) {
    if (typeof escapeSeasonUiText === 'function') return escapeSeasonUiText(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  var rowsHtml = '';
  var order = [
    'mvp', 'dpoy',
    'scoring', 'rebounding', 'assists', 'steals', 'blocks',
    'allLeague1', 'allLeague2', 'allLeague3',
    'allDef1', 'allDef2',
    'allStar', 'sixthman',
    'roty', 'allRookie'
  ];
  var isFirstAwardSeason = !STATE.career || STATE.career.seasonCount === 0;
  var rowsRendered = 0;
  for (var oi = 0; oi < order.length; oi++) {
    var a = null;
    for (var ai = 0; ai < awards.length; ai++) { if (awards[ai].act === order[oi]) { a = awards[ai]; break; } }
    if (!a) continue;
    if (!isFirstAwardSeason && (a.act === 'roty' || a.act === 'allRookie')) continue;
    var idx = rowsRendered++;
    var emoji = emojiMap[a.act] || '🏅';
    var cat = catMap[a.act] || a.label;
    var ur = (a && a.userRank) || '';
    var rankCls = 'dim';
    if (ur.indexOf('⭐ 已入围') >= 0 || ur.indexOf('🥇') >= 0 || ur.indexOf('一阵') >= 0 || ur.indexOf('一队') >= 0) {
      rankCls = 'gold';
    } else if (ur.indexOf('🥈') >= 0 || ur.indexOf('二阵') >= 0 || ur.indexOf('二队') >= 0) {
      rankCls = 'orange';
    } else if (ur.indexOf('🥉') >= 0 || ur.indexOf('三阵') >= 0) {
      rankCls = 'orange';
    }

    // 头像（列表奖项留空占位，保证对齐）
    var headshotHtml = '';
    var TEAM_ICON = 'media/generated/teams/team-00.png';
    if (a.act === 'allStar') {
      headshotHtml = '<div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;background:var(--orange-dim);display:flex;align-items:center;justify-content:center;font-size:18px;">' + emoji + '</div>';
    } else if (a.isList) {
      headshotHtml = '<div style="width:44px;height:44px;flex-shrink:0;border-radius:50%;background-image:url(' + TEAM_ICON + ');background-size:cover;background-position:center;border:2px solid var(--orange);"></div>';
    } else {
      var hsStyle = '';
      if (a.isUser) {
        var avatarUrl = getPlayerAvatarUrl();
        if (avatarUrl) hsStyle = 'background-image:url(' + avatarUrl + ');background-size:cover;background-position:center;';
      } else if (a.winnerId) {
        hsStyle = getHs(a.winnerId);
      }
      if (hsStyle) {
        headshotHtml = '<div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;border:2px solid var(--orange);background-size:cover;background-position:center;' + hsStyle + '"></div>';
      } else {
        headshotHtml = '<div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;background:var(--orange-dim);display:flex;align-items:center;justify-content:center;font-size:18px;">' + emoji + '</div>';
      }
    }

    var leftContent = '';
    if (a.act === 'allStar') {
      leftContent = '<div style="font-size:13px;font-weight:600;color:var(--text);margin:1px 0 1px;">你的全明星入选结果</div>';
    } else if (a.isList) {
      var names = a.winner.split('、');
      var winnerIds = a.winnerId ? a.winnerId.split('、') : [];
      var players = Array.isArray(a.players) ? a.players : [];
      leftContent = '<div style="padding:2px 0 0;">';
      for (var ni = 0; ni < names.length; ni++) {
        var isMy = names[ni] === getMyPlayerDisplayName();
        var playerInfo = players[ni] || {};
        var playerId = playerInfo.id || winnerIds[ni] || '';
        var playerNameCN = playerInfo.cname || names[ni];
        var sourcePlayer = isMy ? null : findPlayerByIdentity(playerId, playerNameCN);
        var awardDisplayName = sourcePlayer
          ? (sourcePlayer.cname)
          : names[ni].replace(/·/g, '-');
        var playerTeam = playerInfo.team || (isMy
          ? STATE.careerTeam
          : findPlayerTeamByIdentity(playerId, playerNameCN));
        var teamName = playerTeam ? (typeof getTeamName === 'function' ? getTeamName(playerTeam) : playerTeam) : '';
        var teamHtml = teamName ? '<span class="award-list-team"> · ' + escapeAwardText(teamName) + '</span>' : '';
        var playerStats = playerInfo.stats;
        if (isMy) {
          playerStats = getUserSeasonAverageStats() || playerStats;
        } else if (playerTeam) {
          playerStats = getLeaguePlayerSeasonStats(sourcePlayer, playerTeam) || playerStats;
        }
        var statItems = playerStats ? [
          ['得分', playerStats.pts],
          ['篮板', playerStats.reb],
          ['助攻', playerStats.ast],
          ['抢断', playerStats.stl],
          ['盖帽', playerStats.blk]
        ] : [];
        var listStatsHtml = '';
        if (statItems.length) {
          listStatsHtml = '<div class="award-list-stats" aria-label="场均数据">' + statItems.map(function(item) {
            return '<span>' + item[0] + ' ' + item[1] + '</span>';
          }).join('') + '</div>';
        }
        leftContent += '<div style="font-size:11px;' + (isMy ? 'color:var(--orange);font-weight:700;' : 'color:var(--text);font-weight:500;') + ';line-height:1.5;">' + (isMy ? '⭐ ' : '') + escapeAwardText(awardDisplayName) + teamHtml + '</div>' + listStatsHtml;
      }
      leftContent += '</div>';
    } else {
      var displayStatValue = a.statValue;
      if (a.statKey) {
        var awardWinnerStats = a.isUser
          ? getUserSeasonAverageStats()
          : getLeaguePlayerSeasonStats(findPlayerByIdentity(a.winnerId || '', a.winner || ''), a.team);
        if (awardWinnerStats && awardWinnerStats[a.statKey] != null) displayStatValue = awardWinnerStats[a.statKey];
      }
      var singleAwardPlayer = a.isUser ? null : findPlayerByIdentity(a.winnerId || '', a.winner || '');
      var singleAwardDisplayName = singleAwardPlayer
        ? (singleAwardPlayer.cname)
        : a.winner.replace(/·/g, '-');
      var statLine = displayStatValue != null ? '<div class="award-stat-line">场均 ' + displayStatValue + ' ' + (a.statLabel || '') + '</div>' : '';
      var teamName = a.team ? (typeof getTeamName === 'function' ? getTeamName(a.team) : a.team) : '';
      var teamLine = teamName ? '<div class="award-team">球队：' + escapeAwardText(teamName) + '</div>' : '';
      leftContent = '<div style="font-size:13px;font-weight:600;' + (a.isUser ? 'color:var(--orange);' : 'color:var(--text);') + 'margin:1px 0 1px;">' + (a.isUser ? '⭐ ' : '') + escapeAwardText(singleAwardDisplayName) + '</div>' + teamLine + statLine;
    }

    rowsHtml +=
      '<div class="award-row" data-track-pos="T' + (idx + 2) + '" data-track-label="' + cat + '" style="display:flex;align-items:center;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;' + (idx < rowsRendered - 1 ? 'margin-bottom:5px;' : '') + 'animation-delay:' + (idx * 1.0) + 's;">' +
        // 头像区
        '<div style="padding:0 0 0 12px;flex-shrink:0;">' + headshotHtml + '</div>' +
        // 获奖信息
        '<div style="flex:1;padding:8px 12px;">' +
          '<div class="award-label">' + emoji + ' ' + cat + '</div>' +
          leftContent +
        '</div>' +
        // 排名
        '<div style="width:110px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;border-left:1px solid var(--border-light);">' +
          '<div style="font-size:10px;color:var(--text-muted);letter-spacing:1px;margin-bottom:2px;font-weight:600;">' + (a.act === 'allStar' ? '你的入选情况' : '你的排名') + '</div>' +
          '<div class="award-rank ' + rankCls + '">' + a.userRank + '</div>' +
        '</div>' +
      '</div>';
  }

  var milestoneWins = STATE.season && STATE.season._sixtyWinPageNotice;
  var milestoneHtml = milestoneWins ?
    '<div class="awards-milestone" role="status">' +
      '<div class="awards-milestone-title">🎊 生涯首次 60 胜赛季</div>' +
      '<div class="awards-milestone-copy">' + getTeamName(STATE.careerTeam) + '常规赛拿下 ' + milestoneWins + ' 胜。</div>' +
    '</div>' : '';
  html('awards-content').innerHTML = milestoneHtml + rowsHtml;
  var awardsScreen = document.getElementById('screen-awards');
  if (awardsScreen && awardsScreen.classList.contains('active')) {
    setPostRegularSeasonGlobalAction();
  }
  document.querySelectorAll('#awards-content .award-row').forEach(function(row) {
    trackExposureOnce(row, {act:"exposure",blk:"BMC099",pos:row.getAttribute('data-track-pos'),label:row.getAttribute('data-track-label')});
  });
  }, 1500);
}

