// ==================== 玩家流动性（被交易/被裁/不被续约） ====================
function getMobility() {
  var c = STATE.career;
  if (!c) return null;
  c.mobility = c.mobility || {};
  var m = c.mobility;
  if (m.trades == null) m.trades = 0;
  if (m.teamInitiatedTrades == null) m.teamInitiatedTrades = m.trades || 0;
  if (m.playerRequestedTrades == null) m.playerRequestedTrades = 0;
  m.waived = m.waived || 0;
  m.nonRenewals = m.nonRenewals || 0;
  if (m.lastMove == null) m.lastMove = null;
  if (m.lastMoveSeason == null) m.lastMoveSeason = 0;
  if (m.lastTeam == null) m.lastTeam = null;
  return m;
}

function getTeamInitiatedTradeCount() {
  var m = getMobility();
  return m ? (m.teamInitiatedTrades || 0) : 0;
}

function getLastSeasonWinRate() {
  var st = STATE._prevStandings;
  if (!st || !STATE.careerTeam) return 0.5;
  var s = st[STATE.careerTeam];
  if (!s) return 0.5;
  var w = s.wins || 0, l = s.losses || 0;
  return (w + l) > 0 ? w / (w + l) : 0.5;
}

function isUserRookieProtected() {
  var c = STATE.career;
  if (!c || !c.draft) return false;
  if (c.draft.type === 'undrafted') return false;
  return (c.seasonCount || 0) <= 1;
}

function isUserStarProtected() {
  return (STATE.finalOVR || 0) >= 88
    || hasCareerHonor('全明星')
    || hasCareerHonor('最佳阵容')
    || hasCareerHonor('MVP');
}

function getUserTradeChance() {
  if (getTeamInitiatedTradeCount() >= 1) return 0;
  var ovr = STATE.finalOVR || 70;
  var age = (STATE.career && STATE.career.currentAge) || 22;
  var bench = !STATE.season.isUserStarter;
  var rate = getLastSeasonWinRate();
  var score = 0;
  if (ovr < 75) score += 12;
  else if (ovr < 80) score += 7;
  else if (ovr < 85) score += 3;
  if (age >= 33) score += 6;
  else if (age >= 30) score += 3;
  if (bench) score += 5;
  if (rate < 0.4) score += 6;
  else if (rate > 0.6) score -= 5;
  return Math.max(1, Math.min(18, score));
}

function getUserWaiveChance() {
  var ovr = STATE.finalOVR || 70;
  var age = (STATE.career && STATE.career.currentAge) || 22;
  var bench = !STATE.season.isUserStarter;
  var rate = getLastSeasonWinRate();
  var score = 0;
  if (ovr < 70) score += 30;
  else if (ovr < 75) score += 18;
  else if (ovr < 80) score += 6;
  if (age >= 35) score += 14;
  else if (age >= 33) score += 6;
  if (bench) score += 8;
  if (rate < 0.4) score += 8;
  return Math.max(1, Math.min(35, score));
}

function getTeamRenewalWillingness() {
  var c = STATE.career;
  if (!c) return false;
  if (c.flags && c.flags.waived) return false;
  var mobility = getMobility();
  if (mobility && (mobility.nonRenewals || 0) >= 1) return true;
  var ovr = STATE.finalOVR || 70;
  var age = c.currentAge || 22;
  var bench = !STATE.season.isUserStarter;
  if (ovr >= 85) return true;
  if (ovr < 72) return Math.random() < 0.35;
  var p = 0.86;
  if (age >= 33) p -= 0.16;
  if (bench) p -= 0.12;
  if (ovr < 78) p -= 0.12;
  if (getLastSeasonWinRate() < 0.45) p -= 0.08;
  return Math.random() < Math.max(0.45, p);
}

function pickTradeDestination() {
  var myPos = STATE.position;
  var candidates = [];
  LEAGUE_TEAM_IDS.forEach(function(t) {
    if (t === STATE.careerTeam) return;
    var lineup = calcTeamLineup(t);
    var weak = null, weakOvr = 999;
    ['PG','SG','SF','PF','C'].forEach(function(pos) {
      var p = lineup.starters[pos];
      if (p && !p._isUser && p.ovr < weakOvr) { weakOvr = p.ovr; weak = pos; }
    });
    var score = 0;
    if (weak === myPos) score += 30;
    else if (weak && canPlayPosition(weak, myPos)) score += 18;
    if (weakOvr < (STATE.finalOVR || 70)) score += 20;
    var st = STATE._prevStandings && STATE._prevStandings[t];
    if (st) {
      var w = st.wins || 0, l = st.losses || 0;
      var rate = (w + l) > 0 ? w / (w + l) : 0.5;
      if (rate < 0.45) score += 12;
    }
    if (score > 0) candidates.push({ team: t, score: score });
  });
  if (candidates.length === 0) {
    LEAGUE_TEAM_IDS.forEach(function(t) {
      if (t !== STATE.careerTeam) candidates.push({ team: t, score: 1 });
    });
  }
  candidates.sort(function(a, b) { return b.score - a.score; });
  var top = candidates.slice(0, 6);
  return top[Math.floor(Math.random() * top.length)].team;
}

function recordMobilityHistory(moveType, title, detail) {
  var c = STATE.career;
  if (!c) return;
  c.branchHistory = c.branchHistory || [];
  c.branchHistory.push({
    seasonNum: c.seasonCount,
    phase: 'offseason',
    branch: 'transfer',
    eventId: 'user_' + moveType,
    event: title,
    choice: moveType,
    result: detail || ''
  });
}

function showMobilityChoiceModal(title, scene, choices, onDone) {
  var old = document.getElementById('mobility-modal');
  if (old) old.remove();
  var html = '<div class="team-picker-overlay" id="mobility-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + sanitizePlayerFacingText(scene) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  choices.forEach(function(ch, ci) {
    html += '<button class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;" onclick="chooseMobilityChoice(' + ci + ')">' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(ch.hint || '') + '</span></button>';
  });
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  STATE._mobilityChoice = { title: title, choices: choices, onDone: onDone };
}

function chooseMobilityChoice(idx) {
  var modal = STATE._mobilityChoice;
  if (!modal) return;
  var ch = modal.choices[idx];
  if (!ch) return;
  var msg = '';
  try { msg = ch.apply ? ch.apply() : ''; } catch(e) { msg = ''; }
  msg = sanitizePlayerFacingText(msg || '');
  var done = modal.onDone;
  var overlay = document.getElementById('mobility-modal');
  if (overlay) overlay.remove();
  STATE._mobilityChoice = null;
  if (msg) showOffseasonResultModal(modal.title, msg, done);
  else if (done) done();
}

function doTradeUser(destTeam, done) {
  var old = STATE.careerTeam;
  var displayName = getMyPlayerDisplayName();
  var m = getMobility();
  if ((m.teamInitiatedTrades || 0) >= 1) {
    if (done) done();
    return;
  }
  STATE.careerTeam = destTeam;
  m.teamInitiatedTrades = (m.teamInitiatedTrades || 0) + 1;
  m.trades = m.teamInitiatedTrades + (m.playerRequestedTrades || 0);
  m.lastMove = 'trade';
  m.lastMoveSeason = STATE.career.seasonCount;
  m.lastTeam = old;
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.traded = true;
  addProfileDelta('fanSupport', -2);
  addProfileDelta('loyalty', -1);
  addSeasonMod('mediaPressure', 1, -10, 10);
  setBranchNode('transfer', 'transfer_start');
  if (STATE._leagueChanges) {
    STATE._leagueChanges.trades = STATE._leagueChanges.trades || [];
    STATE._leagueChanges.trades.push({ from: old, to: destTeam, playerA: displayName, playerB: '选秀权' });
  }
  var oldTn = getTeamName ? getTeamName(old) : old;
  var newTn = getTeamName ? getTeamName(destTeam) : destTeam;
  var msg = '休赛期的最后一天，交易官宣：' + oldTn + '把' + displayName + '送到' + newTn + '。新闻标题很短：换未来资产。<br><br>效果：球迷支持-2；忠诚-1；媒体压力+1。';
  recordMobilityHistory('trade', '交易官宣', msg);
  showOffseasonResultModal('交易官宣', msg, function() {
    showMobilityChoiceModal('交易官宣',
      '你在新球队的新闻发布会上坐定。记者问的第一个问题是：你对这笔交易怎么看？',
      [
        { label: '接受并表态', hint: '向前看，尽快融入', apply: function() {
          addProfileDelta('mediaTrust', 1);
          addProfileDelta('fanSupport', 1);
          return '你说：我感谢老东家，也准备好为这里打球。新球迷愿意相信你，媒体也喜欢这句话。<br><br>效果：媒体好感+1；球迷支持+1。';
        }},
        { label: '沉默', hint: '用表现回应一切', apply: function() {
          addSeasonMod('formVariance', -1, -10, 10);
          return '你只回答了一个字：好。剩下的问题，你打算留到球场上回答。<br><br>效果：状态波动-1。';
        }},
        { label: '公开表达不满', hint: '情绪会放大，关注度也会升高', apply: function() {
          setBranchNode('transfer', 'transfer_resentment');
          addProfileDelta('controversy', 1);
          addSeasonMod('mediaPressure', 1, -10, 10);
          return '你说：我没有要求离开。这句话被反复播放，交易流言变成了新闻连续剧。<br><br>效果：争议+1；媒体压力+1。';
        }}
      ],
      done);
  });
}

function pickPlayerRequestedTradeDestination(request) {
  var preferred = request && request.preferredTeam;
  if (preferred && preferred !== STATE.careerTeam && LEAGUE_TEAM_IDS.indexOf(preferred) >= 0 && Math.random() < 0.8) {
    return preferred;
  }
  return pickTradeDestination();
}

function completePlayerRequestedTrade(destTeam, request, done) {
  var old = STATE.careerTeam;
  if (!destTeam || destTeam === old) {
    request.status = 'failed';
    request.failureReason = 'no_destination';
    if (done) done();
    return;
  }

  var c = STATE.career;
  var m = getMobility();
  var displayName = getMyPlayerDisplayName();
  STATE.careerTeam = destTeam;
  m.playerRequestedTrades = (m.playerRequestedTrades || 0) + 1;
  m.trades = (m.teamInitiatedTrades || 0) + m.playerRequestedTrades;
  m.lastMove = 'requested_trade';
  m.lastMoveSeason = c.seasonCount || 0;
  m.lastTeam = old;
  request.status = 'completed';
  request.completedSeason = c.seasonCount || 0;
  request.destination = destTeam;
  c.flags = c.flags || {};
  c.flags.tradeRequested = false;
  c.flags.requestedTradeCompleted = true;
  c.flags.traded = true;
  addProfileDelta('fanSupport', -1);
  addSeasonMod('mediaPressure', 1, -10, 10);
  setBranchNode('transfer', 'transfer_start');

  if (STATE._leagueChanges) {
    STATE._leagueChanges.trades = STATE._leagueChanges.trades || [];
    STATE._leagueChanges.trades.push({ from: old, to: destTeam, playerA: displayName, playerB: '未来资产', requested: true });
  }

  var oldName = getTeamName ? getTeamName(old) : old;
  var newName = getTeamName ? getTeamName(destTeam) : destTeam;
  var preferredMissed = request.preferredTeam && request.preferredTeam !== destTeam;
  var msg = oldName + '正式将' + displayName + '交易到' + newName + '。' +
    (preferredMissed ? '这不是你最初列出的首选下家，但双方最终完成了谈判。' : '管理层兑现了处理交易申请的承诺。') +
    '<br><br>效果：加盟新球队；球迷支持-1；媒体压力+1。';
  recordMobilityHistory('requested_trade', '申请交易完成', msg);
  showOffseasonResultModal('申请交易完成', msg, done);
}

function doWaiveUser(done) {
  var old = STATE.careerTeam;
  var displayName = getMyPlayerDisplayName();
  var m = getMobility();
  m.waived = (m.waived || 0) + 1;
  m.lastMove = 'waive';
  m.lastMoveSeason = STATE.career.seasonCount;
  m.lastTeam = old;
  STATE.career.contract = 0;
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.waived = true;
  addProfileDelta('fanSupport', -1);
  addSeasonMod('mediaPressure', 1, -10, 10);
  setBranchNode('transfer', 'transfer_start');
  var oldTn = getTeamName ? getTeamName(old) : old;
  var msg = oldTn + '宣布裁掉' + displayName + '。管理层没有多解释，新闻稿只有一行：感谢为球队所做的一切。<br><br>效果：球迷支持-1；媒体压力+1；你将进入自由市场。';
  recordMobilityHistory('waive', '裁员官宣', msg);
  showOffseasonResultModal('裁员官宣', msg, done);
}

function maybeMoveUserInOffseason(done) {
  if (typeof done !== 'function') done = function() {};
  var c = STATE.career;
  if (!c || c.retired) return done();
  var m = getMobility();
  var request = m.tradeRequest;
  if (!request && c.flags && c.flags.tradeRequested) {
    request = {
      season: c.seasonCount || 0,
      submittedGame: 0,
      preferredTeam: '',
      source: 'legacy_event',
      status: 'approved',
      approvalChance: 100
    };
    m.tradeRequest = request;
  }
  if (request && request.status === 'approved' && request.season <= (c.seasonCount || 0)) {
    var requestedDestination = pickPlayerRequestedTradeDestination(request);
    if (requestedDestination) {
      completePlayerRequestedTrade(requestedDestination, request, done);
      return;
    }
    request.status = 'failed';
    request.failureReason = 'no_destination';
  }
  if (isUserRookieProtected() || isUserStarProtected()) return done();
  if ((c.contract || 0) <= 0) return done();
  if (m.lastMoveSeason === (c.seasonCount || 0)) return done();
  if (getTeamInitiatedTradeCount() >= 1) {
    var waiveOnlyChance = getUserWaiveChance();
    if (Math.random() * 100 < waiveOnlyChance) {
      doWaiveUser(done);
      return;
    }
    done();
    return;
  }
  var tradeChance = getUserTradeChance();
  var waiveChance = getUserWaiveChance();
  var roll = Math.random() * 100;
  if (roll < tradeChance) {
    var dest = pickTradeDestination();
    if (dest) { doTradeUser(dest, done); return; }
  } else if (roll < tradeChance + waiveChance) {
    doWaiveUser(done);
    return;
  }
  done();
}

// ==================== 合同到期选队 ====================
function isSuperstarRecruitOfferTeam(team) {
  var flags = STATE.career && STATE.career.flags ? STATE.career.flags : {};
  var interest = flags.superstarRecruitInterest;
  return !!(team && flags.superstarRecruitTargetTeam === team && (interest === 'serious' || interest === 'public'));
}

function getTeamPowerScore(team) {
  if (typeof calcTeamPowerWithPlayer !== 'function') return 0;
  var p = calcTeamPowerWithPlayer(team);
  if (!p || typeof p === 'number') return p || 0;
  return ((p.offense || 0) * 0.35 + (p.defense || 0) * 0.35 + (p.depth || 0) * 0.3);
}

function generateContractOffers() {
  var offers = [];
  var usedTeams = {};
  var myPos = STATE.position;
  var myOvr = STATE.finalOVR;
  var myAge = STATE.career.currentAge;
  var choice = STATE.career.flags && STATE.career.flags.freeAgentChoice;
  var bigMarket = ['LAL', 'NYK', 'GSW', 'MIA', 'CHI', 'BOS', 'DAL', 'HOU', 'PHI', 'TOR'];

  LEAGUE_TEAM_IDS.forEach(function(t) {
    if (t === STATE.careerTeam) return;
    var lineup = calcTeamLineup(t);
    var currentStarter = lineup.starters[myPos];
    var need = currentStarter ? (myOvr > currentStarter.ovr) : true;
    if (!need) return;
    usedTeams[t] = true;

    var roster = LEAGUE_PLAYER_DATA[t] || [];
    var sorted = roster.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); });
    var topTwo = sorted.slice(0, 2);

    var years = (function(a) {
      if (a <= 23) return 3 + Math.floor(Math.random() * 2);
      if (a <= 26) return 2 + Math.floor(Math.random() * 2);
      if (a <= 30) return 1 + Math.floor(Math.random() * 3);
      return 1;
    })(myAge);
    if (choice === 'short') years = 2;
    years = Math.max(2, years);

    var role = currentStarter ? (myOvr > currentStarter.ovr + 3 ? '立即首发' : '竞争上岗') : '立即首发';
    var teamOvr = choice === 'contender' ? getTeamPowerScore(t) : 0;
    var isBig = bigMarket.indexOf(t) >= 0;
    var score = currentStarter ? myOvr - currentStarter.ovr : 99;
    if (choice === 'contender') score += teamOvr * 2.2;
    if (choice === 'market') score += isBig ? 60 : -20;
    var recruited = isSuperstarRecruitOfferTeam(t);
    if (recruited) score += 90;
    offers.push({ team: t, topTwo: topTwo, years: years, role: role, needStrength: currentStarter ? myOvr - currentStarter.ovr : 99, score: score, teamOvr: Math.round(teamOvr), bigMarket: isBig, superstarRecruit: recruited });
  });

  var recruitTarget = STATE.career && STATE.career.flags ? STATE.career.flags.superstarRecruitTargetTeam : '';
  if (isSuperstarRecruitOfferTeam(recruitTarget) && recruitTarget !== STATE.careerTeam && !usedTeams[recruitTarget]) {
    var rr = LEAGUE_PLAYER_DATA[recruitTarget] || [];
    var rsortedTop = rr.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); });
    var rYears = myAge <= 30 ? 2 : 1;
    if (choice === 'short') rYears = 2;
    rYears = Math.max(2, rYears);
    offers.push({
      team: recruitTarget,
      topTwo: rsortedTop.slice(0, 2),
      years: rYears,
      role: '巨星联手',
      needStrength: 0,
      score: 88,
      teamOvr: 0,
      bigMarket: bigMarket.indexOf(recruitTarget) >= 0,
      superstarRecruit: true
    });
    usedTeams[recruitTarget] = true;
  }

  // 替补/轮换/底薪档：只有没有首发报价时才给，且最多 2 家
  if (offers.length === 0) {
    var benchCandidates = [];
    LEAGUE_TEAM_IDS.forEach(function(t) {
      if (t === STATE.careerTeam || usedTeams[t]) return;
      var lineup = calcTeamLineup(t);
      var currentStarter = lineup.starters[myPos];
      if (!currentStarter) return;
      var diff = myOvr - currentStarter.ovr;
      if (diff > 0) return;
      var benchSpot = 0;
      (lineup.bench || []).forEach(function(bp) { if (bp && bp.ovr < myOvr) benchSpot++; });
      if (benchSpot === 0 && diff < -8) return;
      var st = STATE._prevStandings && STATE._prevStandings[t];
      var winRate = st ? (function(s) { var w = s.wins || 0, l = s.losses || 0; return (w + l) > 0 ? w / (w + l) : 0.5; })(st) : 0.5;
      if (winRate > 0.65) return;
      var score = benchSpot * 12 + (0.5 - winRate) * 40 + Math.max(-6, diff);
      if (isSuperstarRecruitOfferTeam(t)) score += 90;
      benchCandidates.push({ team: t, diff: diff, benchSpot: benchSpot, score: score });
    });
    benchCandidates.sort(function(a, b) { return b.score - a.score; });
    var benchCount = Math.min(2, benchCandidates.length);
    for (var bi = 0; bi < benchCount; bi++) {
      var bt = benchCandidates[bi].team;
      usedTeams[bt] = true;
      var blineup = calcTeamLineup(bt);
      var bStarter = blineup.starters[myPos];
      var broster = LEAGUE_PLAYER_DATA[bt] || [];
      var bsorted = broster.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); });
      var byears = myAge <= 26 ? 2 : 1;
      if (choice === 'short') byears = 2;
      byears = Math.max(2, byears);
      var bRecruit = isSuperstarRecruitOfferTeam(bt);
      offers.push({ team: bt, topTwo: bsorted.slice(0, 2), years: byears, role: '替补/轮换', needStrength: bStarter ? myOvr - bStarter.ovr : 0, score: -20 - (bStarter ? Math.abs(myOvr - bStarter.ovr) : 0) + (bRecruit ? 90 : 0), teamOvr: 0, bigMarket: false, superstarRecruit: bRecruit });
    }
  }

  offers.sort(function(a, b) { return (b.score || b.needStrength) - (a.score || a.needStrength); });
  var result = offers.slice(0, choice === 'short' ? 6 : 4);
  if (result.length === 0) {
    // 兜底：保证永远有下家
    LEAGUE_TEAM_IDS.forEach(function(t) {
      if (t === STATE.careerTeam || usedTeams[t]) return;
      if (result.length >= 2) return;
      var r = LEAGUE_PLAYER_DATA[t] || [];
      var lineup2 = calcTeamLineup(t);
      var s2 = lineup2.starters[myPos];
      if (s2 && (myOvr - s2.ovr) > 3) return;
      var st2 = STATE._prevStandings && STATE._prevStandings[t];
      var winRate2 = st2 ? (function(s) { var w = s.wins || 0, l = s.losses || 0; return (w + l) > 0 ? w / (w + l) : 0.5; })(st2) : 0.5;
      if (winRate2 > 0.65) return;
      var sr2 = r.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); }).slice(0, 2);
      var rRecruit = isSuperstarRecruitOfferTeam(t);
      result.push({ team: t, topTwo: sr2, years: 2, role: '底薪/替补', needStrength: s2 ? myOvr - s2.ovr : -5, score: -50 + (rRecruit ? 90 : 0), teamOvr: 0, bigMarket: false, superstarRecruit: rRecruit });
      usedTeams[t] = true;
    });
    if (result.length === 0) {
      // 极端情况兜底：保证永远有下家
      LEAGUE_TEAM_IDS.forEach(function(t) {
        if (result.length >= 2) return;
        if (t === STATE.careerTeam || usedTeams[t]) return;
        var r3 = LEAGUE_PLAYER_DATA[t] || [];
        var sr3 = r3.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); }).slice(0, 2);
        var eRecruit = isSuperstarRecruitOfferTeam(t);
        result.push({ team: t, topTwo: sr3, years: 2, role: '底薪/替补', needStrength: -10, score: -80 + (eRecruit ? 90 : 0), teamOvr: 0, bigMarket: false, superstarRecruit: eRecruit });
        usedTeams[t] = true;
      });
    }
  }
  return result;
}

function showContractOffers() {
  if (STATE.career && STATE.career.retired) {
    showCareerStats(1);
    return;
  }
  if (typeof showMyCard === 'function') showMyCard();
  var c = STATE.career;
  var myOvr = STATE.finalOVR;
  var myAge = STATE.career.currentAge;
  var offers = generateContractOffers();
  var currTeam = getTeamName ? getTeamName(STATE.careerTeam) : STATE.careerTeam;
  var choice = STATE.career.flags && STATE.career.flags.freeAgentChoice;
  var choiceText = { stay: '留守母队，要求补强', contender: '加盟争冠球队', market: '选择大市场球队', short: '签短约保持自由' }[choice] || '';
  var stayYears = choice === 'stay' ? 3 : 2;
  var canRenew = !(c.flags && c.flags.waived) && getTeamRenewalWillingness();
  if (!canRenew && c.flags && !c.flags.waived && !c.flags.nonRenewed) {
    c.flags.nonRenewed = true;
    var m = getMobility();
    m.nonRenewals = (m.nonRenewals || 0) + 1;
    m.lastMove = 'non_renew';
    m.lastMoveSeason = c.seasonCount;
    setBranchNode('transfer', 'transfer_start');
  }
  var headerText = c.flags && c.flags.waived ? '📋 你被裁了，自由市场在等你' : '📋 你的合同到期了';

  var html = '<div class="team-picker-overlay" id="contract-modal">';
  html += '<div class="team-picker-modal" style="max-width:420px;">';
  html += '<div class="team-picker-header"><span>' + headerText + '</span><button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 8px;min-height:26px;border-color:var(--red);color:var(--red);background:var(--bg-card);" onclick="showContractRetirementChoice()">退役</button></div>';
  html += '<div style="padding:6px 12px;font-size:13px;color:var(--text-dim);border-bottom:1px solid var(--border-light);">' + currTeam + ' · ' + STATE.finalPosition + ' · OVR ' + myOvr + ' · ' + myAge + '岁</div>';
  if (choiceText) {
    html += '<div style="padding:6px 12px;font-size:12px;color:var(--orange);border-bottom:1px solid var(--border-light);">自由市场前夜的决定：' + choiceText + '</div>';
  }
  html += '<div style="padding:8px 12px;max-height:55vh;overflow-y:auto;">';

  // 续约母队选项
  if (canRenew) {
    html += '<div class="team-pick-card" style="cursor:pointer;margin-bottom:6px;border-color:' + (choice === 'stay' ? '#ffd700' : 'var(--orange)') + ';" onclick="previewTeamRosterModal(\'' + STATE.careerTeam + '\', function(){ selectContractOption(\'' + STATE.careerTeam + '\', -1); }, ' + stayYears + ')">';
    html += '<div style="font-size:14px;font-weight:700;color:var(--orange);">📝 续约 ' + currTeam + '</div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">';
    html += '<div style="font-size:11px;color:var(--text-dim);">继续留在 ' + currTeam + ' · ' + stayYears + ' 年</div>';
    html += '<span style="font-size:10px;color:var(--orange);">📋 查看阵容</span>';
    html += '</div>';
    html += '</div>';
  } else {
    html += '<div class="team-pick-card" style="margin-bottom:6px;opacity:.75;border-style:dashed;">';
    html += '<div style="font-size:14px;font-weight:700;color:var(--text-dim);">📝 ' + currTeam + ' 没有提出续约</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);">你需要在其他球队里找一份新合同</div>';
    html += '</div>';
  }

  offers.forEach(function(o, idx) {
    var tn = getTeamName ? getTeamName(o.team) : o.team;
    var tp1 = o.topTwo[0];
    var tp2 = o.topTwo[1];
    var tp1Name = tp1 ? (tp1.cname) : '—';
    var tp1Ovr = tp1 ? (tp1.ovr || '—') : '—';
    var tp2Name = tp2 ? (tp2.cname) : '—';
    var tp2Ovr = tp2 ? (tp2.ovr || '—') : '—';

    html += '<div class="team-pick-card" style="cursor:pointer;margin-bottom:6px;text-align:left;padding:10px;" onclick="previewTeamRosterModal(\'' + o.team + '\', function(){ selectContractOption(\'' + o.team + '\', ' + o.years + '); }, ' + o.years + ')">';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
    html += getTeamLogo(o.team, 28);
    html += '<span style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--text);">' + tn + '</span>';
    html += '<span style="font-size:11px;color:var(--orange);margin-left:auto;">' + o.role + '</span>';
    if (o.superstarRecruit) html += '<span style="font-size:10px;color:var(--gold);">⭐ 巨星招募目标</span>';
    if (choice === 'market' && o.bigMarket) html += '<span style="font-size:10px;color:var(--gold);">大市场</span>';
    html += '</div>';
    if (o.superstarRecruit && STATE.career.flags && STATE.career.flags.superstarRecruiterName) {
      html += '<div style="font-size:11px;color:var(--gold);margin-bottom:3px;">' + STATE.career.flags.superstarRecruiterName + ' 希望与你联手</div>';
    }
    html += '<div style="display:flex;gap:8px;padding:4px 0;">';
    html += '<span style="font-size:11px;color:var(--text-dim);">' + tp1Name + ' ' + tp1Ovr + '</span>';
    html += '<span style="font-size:11px;color:var(--text-muted);">|</span>';
    html += '<span style="font-size:11px;color:var(--text-dim);">' + tp2Name + ' ' + tp2Ovr + '</span>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<span style="font-size:11px;color:var(--gold);">🖊️ ' + o.years + ' 年合同</span>';
    html += '<span style="font-size:10px;color:var(--orange);">📋 查看阵容 / 签约</span>';
    html += '</div>';
    html += '</div>';
  });

  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function showContractRetirementChoice() {
  var contractModal = document.getElementById('contract-modal');
  if (contractModal) contractModal.remove();
  var old = document.getElementById('contract-retirement-choice');
  if (old) old.remove();
  var c = STATE.career || {};
  var html = '<div class="team-picker-overlay" id="contract-retirement-choice">';
  html += '<div class="team-picker-modal" style="max-width:390px;">';
  html += '<div class="team-picker-header"><span>合同节点 · 退役决定</span></div>';
  html += '<div style="padding:14px;">';
  html += '<div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px;">不再接受新合同？</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + (c.currentAge || 0) + '岁，OVR ' + (STATE.finalOVR || 0) + '。你可以在自由市场开启下一章，也可以把职业生涯停在这里。</div>';
  html += '<button class="btn btn-primary btn-sm" style="width:100%;margin-bottom:8px;" onclick="announcePlayerRetirement()">确认退役</button>';
  html += '<button class="btn btn-secondary btn-sm" style="width:100%;" onclick="closeContractRetirementChoice()">返回合同选择</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeContractRetirementChoice() {
  var modal = document.getElementById('contract-retirement-choice');
  if (modal) modal.remove();
  showContractOffers();
}

function buildTeamCareerReviewData(team) {
  var c = STATE.career || {};
  var seasons = (c.seasons || []).filter(function(s) { return s && s.team === team; });
  var hasUsefulSeason = seasons.some(function(s) {
    return s && s.playerStats && ((s.playerStats.games || 0) > 0 || (s.playerStats.pts || 0) > 0);
  });
  if (!hasUsefulSeason && c.lastCompletedSeasonSnapshot && c.lastCompletedSeasonSnapshot.team === team) {
    seasons = [c.lastCompletedSeasonSnapshot];
  }
  var seasonNums = {};
  seasons.forEach(function(s) { seasonNums[s.seasonNum] = true; });
  var totals = { pts:0, reb:0, ast:0, stl:0, blk:0, games:0, mins:0 };
  seasons.forEach(function(s) {
    var ps = s.playerStats || {};
    ['pts','reb','ast','stl','blk','games','mins'].forEach(function(k) {
      totals[k] += ps[k] || 0;
    });
  });
  var honors = (c.honors || []).filter(function(h) {
    return h && seasonNums[h.seasonNum] && !isRookieHonorForLaterSeason(h);
  });
  if (!honors.length) {
    seasons.forEach(function(s) {
      (s.awards || []).forEach(function(a) {
        if (a && !isRookieHonorForLaterSeason(a)) honors.push(a);
      });
    });
  }
  return { seasons: seasons, totals: totals, honors: honors };
}

function showFreeAgencyTeamChangeModal(oldTeam, newTeam, done) {
  var oldName = getTeamName ? getTeamName(oldTeam) : oldTeam;
  var newName = getTeamName ? getTeamName(newTeam) : newTeam;
  var data = buildTeamCareerReviewData(oldTeam);
  var totals = data.totals;
  var gp = totals.games || 0;
  var avgPts = gp ? Math.round(totals.pts / gp * 10) / 10 : 0;
  var avgReb = gp ? Math.round(totals.reb / gp * 10) / 10 : 0;
  var avgAst = gp ? Math.round(totals.ast / gp * 10) / 10 : 0;
  var totalWins = 0, totalLosses = 0;
  data.seasons.forEach(function(s) { totalWins += s.wins || 0; totalLosses += s.losses || 0; });

  var honorHtml = '';
  if (data.honors.length) {
    data.honors.forEach(function(h) {
      var cls = 'ch-badge';
      var label = h.label || '';
      if (label.indexOf('总冠军') >= 0 || label.indexOf('MVP') >= 0 || label.indexOf('FMVP') >= 0) cls += ' gold';
      honorHtml += renderHonorBadge(label, h.emoji || '🏅', cls);
    });
  } else {
    honorHtml = '<span style="font-size:12px;color:var(--text-muted);">暂无队内荣誉</span>';
  }

  var seasonsHtml = '';
  if (data.seasons.length) {
    data.seasons.forEach(function(s) {
      seasonsHtml += '<div class="sr-info-row"><span>' + getSeasonLabel(s.seasonNum) + '</span><span>' + (s.wins || 0) + '-' + (s.losses || 0) + ' · ' + (s.playoffResult || '未晋级') + '</span></div>';
    });
  } else {
    seasonsHtml = '<div style="font-size:12px;color:var(--text-muted);">还没有完整赛季记录</div>';
  }

  var old = document.getElementById('fa-team-change-modal');
  if (old) old.remove();
  var html = '<div class="team-picker-overlay" id="fa-team-change-modal">';
  html += '<div class="team-picker-modal" style="max-width:430px;">';
  html += '<div class="team-picker-header"><span>🧳 生涯新篇章</span></div>';
  html += '<div style="padding:14px 14px 8px;text-align:center;">';
  html += '<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px;">' + getTeamLogo(oldTeam, 34) + '<span style="font-size:18px;color:var(--text-dim);">→</span>' + getTeamLogo(newTeam, 34) + '</div>';
  html += '<div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--orange);line-height:1.3;">您选择在' + newName + '开启自己的生涯新篇章！</div>';
  html += '<div style="font-size:12px;color:var(--text-dim);margin-top:6px;line-height:1.55;">离开' + oldName + '之前，这座城市把你的这一站生涯收进档案。</div>';
  html += '</div>';
  html += '<div style="padding:0 12px 12px;max-height:58vh;overflow-y:auto;">';
  html += '<div class="sr-section" style="text-align:left;margin-bottom:8px;"><div class="sr-section-title">📊 ' + oldName + '生涯总数据</div>';
  html += '<div class="sr-stats-grid"><div class="sr-stat"><div class="sr-stat-val">' + gp + '</div><div class="sr-stat-lbl">场次</div></div><div class="sr-stat"><div class="sr-stat-val">' + Math.round(totals.pts) + '</div><div class="sr-stat-lbl">总分</div></div><div class="sr-stat"><div class="sr-stat-val">' + (totalWins + '-' + totalLosses) + '</div><div class="sr-stat-lbl">战绩</div></div></div>';
  html += '<div class="sr-pct-line">场均 ' + avgPts + '分 ' + avgReb + '板 ' + avgAst + '助</div></div>';
  html += '<div class="sr-section" style="text-align:left;margin-bottom:8px;"><div class="sr-section-title">🏅 在队荣誉</div><div class="sr-awards">' + honorHtml + '</div></div>';
  html += '<div class="sr-section" style="text-align:left;margin-bottom:8px;"><div class="sr-section-title">📅 各赛季战绩</div>' + seasonsHtml + '</div>';
  html += '<button class="btn btn-primary btn-sm" id="faTeamChangeContinue" style="width:100%;">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('faTeamChangeContinue').onclick = function() {
    var modal = document.getElementById('fa-team-change-modal');
    if (modal) modal.remove();
    if (typeof done === 'function') done();
  };
}

function selectContractOption(team, years) {
  var modal = document.getElementById('contract-modal');
  if (modal) modal.remove();

  var oldTeam = STATE.careerTeam;
  var changedTeam = years > 0 && team !== oldTeam;
  if (years > 0) {
    STATE.careerTeam = team;
    STATE.career.contract = Math.max(2, years);
  } else {
    STATE.career.contract = (STATE.career.flags && STATE.career.flags.freeAgentChoice === 'stay') ? 3 : 2;
  }
  if (STATE.career && STATE.career.flags) STATE.career.flags.waived = false;
  if (STATE.career && STATE.career.flags && STATE.career.flags.superstarRecruitInterest) {
    STATE.career.flags.lastSuperstarRecruitChoiceTeam = team;
    delete STATE.career.flags.superstarRecruitInterest;
    delete STATE.career.flags.superstarRecruitTargetTeam;
    delete STATE.career.flags.superstarRecruiterName;
    delete STATE.career.flags.superstarRecruiterEN;
  }

  if (changedTeam && STATE.season) {
    clearLineupCache();
    STATE.season.games = [];
    STATE.season.wins = 0;
    STATE.season.losses = 0;
    STATE.season._leagueGameLog = [];
    STATE.season._processedDays = new Set();
    syncUserStarterStatus();
    initStandings();
    buildRealSchedule();
  }
  refreshSeasonTeamHeader();
  var continueAfterContract = function() {
    if (!maybeShowCityFarewell(showOffSeasonModals)) showOffSeasonModals();
  };
  if (changedTeam) showFreeAgencyTeamChangeModal(oldTeam, team, continueAfterContract);
  else continueAfterContract();
}

function refreshSeasonTeamHeader() {
  var el = document.getElementById('season-header');
  if (!el) return;
  el.innerHTML = '';
}

// ==================== 休赛期联盟变动与新赛季入口 ====================
function isHiddenRetiredPlayer(r) {
  return !!(r && r.hidden);
}

function showOffSeasonModals() {
  startNewSeason();
}

function showRetirementModal(callback) {
  var changes = STATE._leagueChanges || { retired: [] };
  var retired = (changes.retired || []).filter(function(r) { return !isHiddenRetiredPlayer(r); });
  var html = '<div class="team-picker-overlay" id="retirement-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>📢 退役球员</span></div>';
  html += '<div style="padding:8px 12px;max-height:60vh;overflow-y:auto;">';
  retired.forEach(function(r) {
    var teamCn = (typeof TEAM_NAMES_EV !== 'undefined' && TEAM_NAMES_EV[r.team]) ? TEAM_NAMES_EV[r.team] : r.team;
    var hs = getPlayerHeadshotStyle(r.playerId || '', 30);
    var avatarHtml = hs
      ? '<div class="bp-headshot" style="' + hs + ';width:30px;height:30px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;"></div>'
      : '<span style="color:var(--red);font-size:16px;">🔴</span>';
    html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 2px;border-bottom:1px solid var(--border-light);font-size:13px;">';
    html += avatarHtml;
    var retiredDisplayName = r.displayName || getPlayerDisplayName(r.playerId) || '球员';
    html += '<span style="flex:1;font-weight:600;">' + retiredDisplayName + '</span>';
    html += '<span style="color:var(--text-dim);font-size:11px;">' + teamCn + ' · ' + r.ovr + ' OVR</span>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div style="padding:10px 12px 14px;text-align:center;border-top:1px solid var(--border-light);">';
  html += '<button class="btn btn-primary btn-sm" onclick="closeRetirementModal(event, function(){})" style="max-width:180px;">下一步</button>';
  html += '</div></div></div>';
  var el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el.firstElementChild);
  document.getElementById('retirement-modal').querySelector('.btn-primary').onclick = function() {
    document.getElementById('retirement-modal').remove();
    if (callback) callback();
  };
}

function showFAModal(callback) {
  var changes = STATE._leagueChanges || {};
  var allSignings = changes.freeSignings || [];
  var signings = allSignings.filter(function(s) { return s.ovr >= 86; });
  var html = '<div class="team-picker-overlay" id="fa-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>📋 自由球员市场</span></div>';
  html += '<div style="padding:8px 12px;max-height:60vh;overflow-y:auto;">';
  if (signings.length > 0) {
    html += '<div style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:4px;">➡️ 自由球员转会</div>';
    signings.forEach(function(s) {
      var fromTn = getTeamName ? getTeamName(s.from) : s.from;
      var toTn = getTeamName ? getTeamName(s.to) : s.to;
      var hs = getPlayerHeadshotStyle(s.playerId || '', 30);
      var avatarHtml = hs
        ? '<div class="bp-headshot" style="' + hs + ';width:30px;height:30px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;"></div>'
        : '<span style="color:var(--orange);font-size:14px;">➡️</span>';
      html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 2px;border-bottom:1px solid var(--border-light);font-size:13px;">';
      html += avatarHtml;
      var signingDisplayName = s.name || getPlayerDisplayName(s.playerId) || '球员';
      var signingRoute = s.returned || s.from === s.to ? fromTn + ' 重新签约' : fromTn + ' → ' + toTn;
      html += '<span style="flex:1;"><strong>' + signingDisplayName + '</strong> ' + signingRoute + '</span>';
      html += '<span style="color:var(--text-dim);font-size:11px;">OVR ' + s.ovr + '</span>';
      html += '</div>';
    });
  } else {
    html += '<div style="text-align:center;padding:20px;font-size:13px;color:var(--text-muted);">无自由球员变动</div>';
  }
  html += '</div>';
  html += '<div style="padding:10px 12px 14px;text-align:center;border-top:1px solid var(--border-light);">';
  html += '<button class="btn btn-primary btn-sm" style="max-width:180px;">下一步</button>';
  html += '</div></div></div>';
  var el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el.firstElementChild);
  document.getElementById('fa-modal').querySelector('.btn-primary').onclick = function() {
    document.getElementById('fa-modal').remove();
    if (callback) callback();
  };
}

function showTradesModal(callback) {
  var changes = STATE._leagueChanges || { trades: [] };
  var trades = changes.trades;
  var html = '<div class="team-picker-overlay" id="trades-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>🔄 联盟交易</span></div>';
  html += '<div style="padding:8px 12px;max-height:60vh;overflow-y:auto;">';
  trades.forEach(function(tr) {
    var ta = getTeamName ? getTeamName(tr.from) : tr.from;
    var tb = getTeamName ? getTeamName(tr.to) : tr.to;
    html += '<div style="background:var(--bg-card);border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px;">';
    html += '<div style="font-family:var(--font-display);font-size:12px;color:var(--text);font-weight:600;margin-bottom:4px;">🔁 ' + ta + ' ⇄ ' + tb + '</div>';
    var playerBDisplayName = getPlayerDisplayName(tr.playerB);
    var playerADisplayName = getPlayerDisplayName(tr.playerA);
    html += '<div style="font-size:12px;color:var(--text-dim);padding:2px 0;">👤 ' + playerBDisplayName + ' → ' + tb + '</div>';
    html += '<div style="font-size:12px;color:var(--text-dim);padding:2px 0;">👤 ' + playerADisplayName + ' → ' + ta + '</div>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div style="padding:10px 12px 14px;text-align:center;border-top:1px solid var(--border-light);">';
  html += '<button class="btn btn-primary btn-sm" style="max-width:180px;">查看阵容</button>';
  html += '</div></div></div>';
  var el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el.firstElementChild);
  document.getElementById('trades-modal').querySelector('.btn-primary').onclick = function() {
    document.getElementById('trades-modal').remove();
    if (callback) callback();
  };
}
function showRosterReview() {
  showScreen('screen-roster-review');
  clearLineupCache();
  var c = STATE.career;
  var changes = STATE._leagueChanges || { retired: [], rookies: [], teamChanges: {} };
  var teamName = getTeamName ? getTeamName(STATE.careerTeam) : STATE.careerTeam;
  var prevRecord = (c.seasons.length > 0) ? (c.seasons[c.seasons.length - 1].wins + '-' + c.seasons[c.seasons.length - 1].losses) : '新赛季';
  var displayName = getMyPlayerDisplayName();

  var lineup = calcTeamLineup(STATE.careerTeam);
  if (STATE.season) {
    var rosterStarter = !!lineup.isUserStarter;
    if (STATE.career && STATE.career.flags && STATE.career.flags.startBench) rosterStarter = false;
    STATE.season.isUserStarter = rosterStarter;
  }
  var teamChanges = changes.teamChanges[STATE.careerTeam] || { retired: [], rookies: [] };

  var avatarUrl = getPlayerAvatarUrl();
  var defaultAvatar = avatarUrl;

  function renderPlayer(p, isUser) {
    var pOvr = parseInt(p.ovr) || 0;
    var pPos = p.posCn || p.pos || '—';
    var pName = p.cname;
    var imgHtml;
    if (isUser) {
      imgHtml = '<' + 'img style="border-radius:50%;border:2px solid var(--border);width:28px;height:28px;object-fit:cover;flex-shrink:0;" src="' + avatarUrl + '" onerror="this.onerror=null;this.src=\'' + defaultAvatar + '\'">';
    } else {
      var hs = getPlayerHeadshotStyle(p.id, 28);
      imgHtml = hs ? '<div style="' + hs + ';border-radius:50%;border:2px solid var(--border);width:28px;height:28px;flex-shrink:0;"></div>' : '<div style="width:28px;height:28px;border-radius:50%;background:var(--border);flex-shrink:0;"></div>';
    }
    var starBadge = isUser ? '<span style="font-size:10px;margin-left:2px;">⭐</span>' : '';
    return '<div style="display:flex;align-items:center;gap:5px;padding:4px 6px;border-bottom:1px solid var(--border-light);font-size:12px;' + (isUser ? 'background:var(--orange-bg);border-radius:6px;margin:1px 0;border:1.5px solid var(--orange);' : '') + '">'
      + imgHtml
      + '<span style="width:40px;font-size:10px;color:var(--text-dim);flex-shrink:0;">' + pPos + '</span>'
      + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:' + (isUser ? '700' : '400') + ';color:' + (isUser ? 'var(--orange)' : 'var(--text)') + ';">' + pName + starBadge + '</span>'
      + '<span style="font-family:var(--font-display);font-weight:700;font-size:13px;color:' + (isUser ? 'var(--orange)' : 'var(--text)') + ';flex-shrink:0;">' + pOvr + '</span>'
      + '</div>';
  }

  var html = '<div id="career-scroll">';

  // 主卡片
  html += '<div class="reveal-card" style="position:relative;">';
  html += '<div style="position:absolute;top:8px;left:8px;">' + getTeamLogo(STATE.careerTeam, 32) + '</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);">' + getCurrentSeasonLabel() + '</div>';
  html += '<div style="font-size:24px;font-weight:800;margin:6px 0;font-family:var(--font-display);letter-spacing:2px;">' + teamName + '</div>';
  html += '<div style="font-size:12px;color:var(--text-dim);">' + STATE.finalPosition + ' · OVR ' + STATE.finalOVR + ' · ' + c.currentAge + '岁</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">上赛季 ' + prevRecord + '</div>';
  html += '</div>';

  // 阵容列表
  html += '<div style="margin-top:8px;background:var(--bg-card);border:2px solid var(--border);border-radius:var(--radius-sm);padding:8px 4px;">';
  html += '<div style="font-family:var(--font-display);font-size:11px;color:var(--orange);padding:2px 4px 4px;letter-spacing:0.5px;">🏀 首发阵容</div>';
  var posOrder = ['PG','SG','SF','PF','C'];
  posOrder.forEach(function(pos) {
    var p = lineup.starters[pos];
    if (p) html += renderPlayer(p, p._isUser);
  });
  if (lineup.bench && lineup.bench.length > 0) {
    html += '<div style="font-family:var(--font-display);font-size:11px;color:var(--text-dim);padding:6px 4px 4px;letter-spacing:0.5px;border-top:1px solid var(--border);margin-top:2px;">🔄 替补阵容</div>';
    lineup.bench.forEach(function(p) {
      html += renderPlayer(p, p._isUser);
    });
  }
  html += '</div>';

  html += '</div>';
  document.getElementById('roster-review-content').innerHTML = html;
  setGlobalNextAction('👤 进入我的球员', startNewSeason);
}

function startNewSeason() {
  if (STATE.career && !STATE.career.retired && STATE._autoSaveSeason !== STATE.career.seasonCount) {
    STATE._autoSaveSeason = STATE.career.seasonCount;
    autoSaveGame();
  }
  STATE._calendarAutoSimulating = false;
  STATE._calendarMonth = 0;
  STATE.season._simulationStarted = false;
  if (typeof renderSeasonScreenDOM === 'function') renderSeasonScreenDOM();
  if (typeof showMyCard === 'function') showMyCard();
}

function resetForNewSeason() {
  saveCurrentSeasonToCareer();
  _rngState = null;
  var oldTeam = STATE.careerTeam;
  STATE._careerSaved = false;
  STATE.season = {
    wins: 0, losses: 0,
    games: [],
    playerStats: { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, games:0, mins:0 },
    leaguePlayerSeasonStats: {}, leaguePlayerGameStats: [], _recordedLeagueGameIds: {},
    playoffStats: { pts:0, reb:0, ast:0, stl:0, blk:0, tov:0, fgm:0, fga:0, ftm:0, fta:0, threeM:0, threeA:0, games:0, mins:0 },
    awards: [], playoffResult: null, playoffEliminated: false,
    standings: {}, statLeaders: {}, schedule: [], day: 0,
    isPlayoffs: false, isChampion: false,
    playoffBracket: null, otherBracket: null,
    _viewConf: null, _gamesPlayed: {}, _leagueGameLog: [], rankings: null,
    _simulationStarted: false,
    events: { suspensionGamesLeft:0, suspensionReason:'', injuryGamesLeft:0, injuryReason:'', triggeredIds:[], storyTimeline:[], lastTriggerGameNum:null, playoffEventCount:0, injuryRiskBonus: getNextSeasonMods().injuryRiskBonus || 0, majorInjuryThisSeason:false, playThroughPrompted:{}, regularPlayThroughPromptCount:0 },
  };
  STATE.careerTeam = oldTeam;
  if (STATE.career && STATE.career.flags) delete STATE.career.flags.startBench;
  STATE.career.nextSeasonMods = { injuryRiskBonus: 0, formVariance: 0, teamChemistry: 0 };
  syncUserStarterStatus();
  initStandings();
  buildRealSchedule();

  STATE._calendarAutoSimulating = false;
  STATE._calendarMonth = 0;
  renderSeasonScreenDOM();
}

function renderSeasonScreenDOM() {
  var confName = getConference(STATE.careerTeam) === 'SOUTH' ? '南方' : '北方';
  html('season-header').innerHTML = '';

  html('season-controls').innerHTML = '';
  html('gamecast-area').innerHTML = '';
  html('game-list').innerHTML = '';
  renderCalendar();
  renderSeasonInsights();
  if (typeof renderSeasonSimulationControl === 'function') renderSeasonSimulationControl();
}

// ==================== 选秀系统 ====================
var DRAFT_CLASS_2026 = [
  { pick: 1, team: 'WAS', cn: 'A-J-迪班萨', pos: '前锋', height: '2.06米' },
  { pick: 2, team: 'UTA', cn: '达林-彼得森', pos: '后卫', height: '1.98米' },
  { pick: 3, team: 'MEM', cn: '卡梅隆-布泽尔', pos: '前锋', height: '2.06米' },
  { pick: 4, team: 'CHI', cn: '凯莱布-威尔逊', pos: '前锋', height: '2.08米' },
  { pick: 5, team: 'LAC', cn: '基顿-瓦格勒', pos: '后卫', height: '1.98米' },
  { pick: 6, team: 'BKN', cn: '米克尔-布朗-二世', pos: '后卫', height: '1.96米' },
  { pick: 7, team: 'SAC', cn: '达里乌斯-阿库夫-二世', pos: '后卫', height: '1.91米' },
  { pick: 8, team: 'ATL', cn: '金斯顿-弗莱明斯', pos: '后卫', height: '1.93米' },
  { pick: 9, team: 'DAL', cn: '莫雷兹-约翰逊-二世', pos: '前锋', height: '2.06米' },
  { pick: 10, team: 'MIL', cn: '布雷登-伯里斯', pos: '后卫', height: '1.93米' },
  { pick: 11, team: 'GSW', cn: '雅克塞尔-兰德伯格', pos: '前锋', height: '2.06米' },
  { pick: 12, team: 'OKC', cn: '阿戴-马拉', pos: '中锋', height: '2.21米' },
  { pick: 13, team: 'MIL', cn: '内特-阿门特', pos: '前锋', height: '2.08米' },
  { pick: 14, team: 'CHA', cn: '汉内斯-斯坦巴赫', pos: '前锋', height: '2.11米' },
  { pick: 15, team: 'CHI', cn: '戴林-斯温', pos: '后卫', height: '2.03米' },
  { pick: 16, team: 'OKC', cn: '班尼特-斯蒂尔茨', pos: '后卫', height: '1.93米' },
  { pick: 17, team: 'DET', cn: '埃布卡-奥科里', pos: '后卫', height: '1.88米' },
  { pick: 18, team: 'CHA', cn: '克里斯蒂安-安德森', pos: '后卫', height: '1.91米' },
  { pick: 19, team: 'TOR', cn: '艾伦-格雷夫斯', pos: '前锋', height: '2.06米' },
  { pick: 20, team: 'SAS', cn: '杰登-昆坦斯', pos: '前锋', height: '2.08米' },
  { pick: 21, team: 'MEM', cn: '卡里姆-洛佩兹', pos: '前锋', height: '2.03米' },
  { pick: 22, team: 'PHI', cn: '拉巴伦-菲隆-二世', pos: '后卫', height: '1.93米' },
  { pick: 23, team: 'ATL', cn: '祖比-埃吉奥福', pos: '前锋', height: '2.06米' },
  { pick: 24, team: 'LAL', cn: '卡梅隆-卡尔', pos: '后卫', height: '1.96米' },
  { pick: 25, team: 'DAL', cn: '塞尔希奥-德-拉雷亚', pos: '前锋', height: '1.98米' },
  { pick: 26, team: 'SAS', cn: '塔里斯-里德-二世', pos: '中锋', height: '2.11米' },
  { pick: 27, team: 'BOS', cn: '克里斯-塞纳克-二世', pos: '前锋', height: '2.11米' },
  { pick: 28, team: 'BKN', cn: '约书亚-杰斐逊', pos: '前锋', height: '2.06米' },
  { pick: 29, team: 'SAC', cn: '亚历克斯-卡拉班', pos: '前锋', height: '2.03米' },
  { pick: 30, team: 'PHX', cn: '科亚-皮特', pos: '前锋', height: '2.03米' },
  { pick: 31, team: 'HOU', cn: '布鲁斯-桑顿-二世', pos: '后卫', height: '1.88米' },
  { pick: 32, team: 'MEM', cn: '里奇-桑德斯', pos: '后卫', height: '1.96米' },
  { pick: 33, team: 'MIN', cn: '赛亚-埃文斯', pos: '后卫', height: '1.98米' },
  { pick: 34, team: 'CLE', cn: '米里克-托马斯', pos: '后卫', height: '1.96米' },
  { pick: 35, team: 'DEN', cn: '特雷文-布拉齐尔', pos: '前锋', height: '2.08米' },
  { pick: 36, team: 'LAC', cn: '巴巴-米勒', pos: '前锋', height: '2.11米' },
  { pick: 37, team: 'MIA', cn: '赖安-康威尔', pos: '后卫', height: '1.93米' },
  { pick: 38, team: 'IND', cn: '布雷登-史密斯', pos: '后卫', height: '1.83米' },
  { pick: 39, team: 'NYK', cn: '杰克-卡伊尔', pos: '后卫', height: '1.91米' },
  { pick: 40, team: 'BOS', cn: '狄龙-米切尔', pos: '前锋', height: '2.03米' },
  { pick: 41, team: 'OKC', cn: '奥特加-奥韦', pos: '后卫', height: '1.93米' },
  { pick: 42, team: 'SAS', cn: '贾科比-吉莱斯皮', pos: '后卫', height: '1.85米' },
  { pick: 43, team: 'BKN', cn: '泰勒-比洛多', pos: '前锋', height: '2.06米' },
  { pick: 44, team: 'SAS', cn: '马利克-布朗', pos: '前锋', height: '2.06米' },
  { pick: 45, team: 'SAC', cn: '伊曼纽尔-夏普', pos: '后卫', height: '1.91米' },
  { pick: 46, team: 'WAS', cn: '菲利克斯-奥帕拉', pos: '前锋', height: '2.11米' },
  { pick: 47, team: 'NYK', cn: '泰勒-尼克尔', pos: '前锋', height: '2.01米' },
  { pick: 48, team: 'DAL', cn: '托比-拉瓦尔', pos: '前锋', height: '2.03米' },
  { pick: 49, team: 'DEN', cn: '布莱斯-霍普金斯', pos: '前锋', height: '2.01米' },
  { pick: 50, team: 'TOR', cn: '贾登-布拉德利', pos: '后卫', height: '1.91米' },
  { pick: 51, team: 'ORL', cn: '伊赛亚-尼尔森', pos: '前锋', height: '2.08米' },
  { pick: 52, team: 'ATL', cn: '亨利-维萨尔', pos: '中锋', height: '2.13米' },
  { pick: 53, team: 'DET', cn: '乌戈纳-奥尼恩索', pos: '中锋', height: '2.13米' },
  { pick: 54, team: 'GSW', cn: '拉杰-琼斯', pos: '后卫', height: '2.01米' },
  { pick: 55, team: 'LAC', cn: '尼克-马蒂内利', pos: '前锋', height: '2.01米' },
  { pick: 56, team: 'DAL', cn: '弗谢沃洛德-伊什琴科', pos: '后卫', height: '1.91米' },
  { pick: 57, team: 'LAC', cn: '纳西斯-恩戈伊', pos: '中锋', height: '2.13米' },
  { pick: 58, team: 'NOP', cn: '贾伦-皮埃尔-二世', pos: '后卫', height: '1.96米' },
  { pick: 59, team: 'MIN', cn: '特雷-考夫曼-雷恩', pos: '前锋', height: '2.06米' },
  { pick: 60, team: 'MIL', cn: '马利克-刘易斯', pos: '前锋', height: '2.03米' },
];

function draftOvrByPick(pick) {
  if (pick <= 3) return 81;
  if (pick <= 8) return 80;
  if (pick <= 15) return 79;
  if (pick <= 22) return 78;
  if (pick <= 30) return 77;
  if (pick <= 40) return 75;
  if (pick <= 50) return 73;
  if (pick <= 60) return 71;
  if (pick <= 80) return 70;
  if (pick <= 110) return 69;
  return 68;
}

function draftPosToCode(pos) {
  if (pos === '后卫') return Math.random() < 0.5 ? 'PG' : 'SG';
  if (pos === '前锋') return Math.random() < 0.5 ? 'SF' : 'PF';
  return 'C';
}

function applyDraftClass2026() {
  if (!LEAGUE_PLAYER_DATA || LEAGUE_PLAYER_DATA._draftClass2026Applied) return;
  LEAGUE_PLAYER_DATA._draftClass2026Applied = true;
  var byTeam = {};
  DRAFT_CLASS_2026.forEach(function(p) {
    byTeam[p.team] = byTeam[p.team] || [];
    byTeam[p.team].push(p);
  });
  Object.keys(byTeam).forEach(function(t) {
    var roster = LEAGUE_PLAYER_DATA[t];
    if (!roster) return;
    var picks = byTeam[t];
    picks.forEach(function(pk) {
      var pad = String(pk.pick);
      while (pad.length < 2) pad = '0' + pad;
      var rookieId = 'D26-' + pad;
      var fixedRating = typeof DRAFT_CLASS_2026_RATINGS !== 'undefined'
        ? DRAFT_CLASS_2026_RATINGS[rookieId]
        : null;
      var ovr = fixedRating ? fixedRating.ovr : draftOvrByPick(pk.pick);
      var rookie = {
        id: rookieId,
        cname: pk.cn,
        pos: fixedRating ? fixedRating.pos : draftPosToCode(pk.pos),
        height: pk.height,
        type: '新秀',
        ovr: ovr,
        _age: 19 + Math.floor(Math.random() * 3),
        contract: pk.pick <= 14 ? 3 : (pk.pick <= 30 ? 2 : 1),
        loyalty: inferPlayerLoyalty('D26-' + pad),
        _awardStreak: {},
      };
      if (fixedRating) {
        rookie._rookieProfile = fixedRating.profile;
        rookie._rookieGenerationVersion = ROOKIE_ATTRIBUTE_PROFILE_VERSION;
        rookie._rookieSeason = getCurrentLeagueSeasonNumber();
        ATTR_KEYS.forEach(function(key) {
          rookie[key] = fixedRating.attributes[key];
        });
        normalizeRookieAttributesToOvr(rookie, fixedRating.ovr);
      } else {
        applyRookieAttributeProfile(rookie, ovr, Math.random);
      }
      roster.push(rookie);
    });
  });
}

function saveStandings() {
  STATE._prevStandings = STATE.season.standings ? JSON.parse(JSON.stringify(STATE.season.standings)) : null;
  if (STATE._prevStandings) {
    if (!STATE._teamHistory) STATE._teamHistory = {};
    LEAGUE_TEAM_IDS.forEach(function(t) {
      var st = STATE._prevStandings[t];
      if (!st) return;
      var pct = (st.wins + st.losses) > 0 ? st.wins / (st.wins + st.losses) : 0.5;
      if (!STATE._teamHistory[t]) STATE._teamHistory[t] = [];
      STATE._teamHistory[t].unshift(pct);
      if (STATE._teamHistory[t].length > 4) STATE._teamHistory[t].pop();
    });
  }
}

function processDraft() {
  if (!STATE._prevStandings) return;
  var st = STATE._prevStandings;
  // 按胜率排（差在前）
  var teams = LEAGUE_TEAM_IDS.slice().sort(function(a, b) {
    var aw = (st[a] && st[a].wins) || 0, al = (st[a] && st[a].losses) || 0;
    var bw = (st[b] && st[b].wins) || 0, bl = (st[b] && st[b].losses) || 0;
    var ap = aw + al > 0 ? aw / (aw + al) : 0.5;
    var bp = bw + bl > 0 ? bw / (bw + bl) : 0.5;
    return ap - bp;
  });
  teams.forEach(function(t, idx) {
    var ovrRange;
    if (idx === 0) ovrRange = { min: 75, max: 82 };
    else if (idx === 1) ovrRange = { min: 73, max: 80 };
    else if (idx === 2) ovrRange = { min: 72, max: 78 };
    else if (idx < 10) ovrRange = { min: 68, max: 75 };
    else ovrRange = { min: 60, max: 70 };

    var rookie = generateRookie();
    // 当届新秀只在本次休赛期受交易保护，下一休赛期会统一解除。
    rookie._justSigned = true;
    var targetOvr = ovrRange.min + Math.floor(rngNext() * (ovrRange.max - ovrRange.min + 1));
    if (rookie._fixedProspectRating) {
      normalizeRookieAttributesToOvr(rookie, rookie.ovr);
      rookie._rookieSeason = getCurrentLeagueSeasonNumber();
    } else {
      rookie.ovr = targetOvr;
      applyRookieAttributeProfile(rookie, targetOvr, rngNext);
    }
    // 新秀合同
    if (idx < 5) rookie.contract = 3 + Math.floor(rngNext() * 2);
    else if (idx < 14) rookie.contract = 2 + Math.floor(rngNext() * 3);
    else rookie.contract = 1 + Math.floor(rngNext() * 3);
    rookie.loyalty = getRookieContractLoyalty(rookie.contract);

    var roster = LEAGUE_PLAYER_DATA[t];
    if (!roster) return;
    var lowestIdx = -1, lowestOvr = 999;
    roster.forEach(function(p, pi) {
      if (p.id && p.id.indexOf('R') === 0 && p.ovr < lowestOvr) {
        lowestOvr = p.ovr; lowestIdx = pi;
      }
    });
    if (lowestIdx >= 0) roster[lowestIdx] = rookie;
  });
}

// ==================== 自由球员系统 ====================
function randomContractByAge(age) {
  if (age <= 23) return 2 + Math.floor(rngNext() * 3);
  if (age <= 26) return 2 + Math.floor(rngNext() * 2);
  if (age <= 30) return 1 + Math.floor(rngNext() * 3);
  if (age <= 33) return 1 + Math.floor(rngNext() * 2);
  return 1;
}

// ==================== 玩家主动申请交易 ====================
function getActiveTradeRequestSeason() {
  var c = STATE.career;
  return c ? (c.seasonCount || 0) + 1 : 1;
}

function getPlayerTradeRequest() {
  var m = getMobility();
  return m && m.tradeRequest ? m.tradeRequest : null;
}

function getTradeRequestAvailability() {
  var c = STATE.career;
  var season = STATE.season;
  if (!c || !season || c.retired) return { allowed: false, reason: '当前没有进行中的职业生涯' };
  if (season.isPlayoffs || season._resultsViewed) return { allowed: false, reason: '季后赛及赛季结束后不能提交申请' };
  if ((c.contract || 0) <= 1) return { allowed: false, reason: '合同将在本赛季后到期，请通过自由市场选择球队' };

  var currentSeason = getActiveTradeRequestSeason();
  var request = getPlayerTradeRequest();
  if (request && request.season === currentSeason) {
    if (request.status === 'approved') return { allowed: false, reason: '申请已获准，将在休赛期完成交易', status: request.status };
    if (request.status === 'denied') return { allowed: false, reason: '本赛季的交易申请已被拒绝', status: request.status };
    return { allowed: false, reason: '本赛季已经提交过交易申请', status: request.status };
  }

  var gamesPlayed = (season.schedule || []).filter(function(game) { return game && game.simulated; }).length;
  if (gamesPlayed < 10) return { allowed: false, reason: '常规赛至少完成 10 场后开放', gamesNeeded: 10 - gamesPlayed };
  return { allowed: true, reason: '每赛季限申请一次；意向球队不保证成为最终下家' };
}

function getTradeRequestApprovalChance(preferredTeam) {
  var c = STATE.career || {};
  var season = STATE.season || {};
  var profile = typeof getCareerProfile === 'function' ? getCareerProfile() : {};
  var total = (season.wins || 0) + (season.losses || 0);
  var winRate = total ? (season.wins || 0) / total : 0.5;
  var chance = 52;

  if ((c.contract || 0) === 2) chance += 12;
  else if ((c.contract || 0) >= 4) chance -= 10;
  if (winRate < 0.4) chance += 10;
  else if (winRate > 0.62) chance -= 8;
  if ((STATE.finalOVR || 0) >= 90) chance -= 12;
  else if ((STATE.finalOVR || 0) < 76) chance += 8;
  chance += Math.min(8, Math.max(0, profile.controversy || 0));

  if (preferredTeam && preferredTeam !== STATE.careerTeam && typeof calcTeamLineup === 'function') {
    var lineup = calcTeamLineup(preferredTeam);
    var starter = lineup && lineup.starters ? lineup.starters[STATE.position] : null;
    if (!starter || (STATE.finalOVR || 0) >= (starter.ovr || 0) + 3) chance += 12;
    else if ((STATE.finalOVR || 0) < (starter.ovr || 0) - 5) chance -= 8;
  }
  return Math.max(25, Math.min(85, Math.round(chance)));
}

function getTradeRequestCandidates() {
  var candidates = [];
  (LEAGUE_TEAM_IDS || []).forEach(function(team) {
    if (team === STATE.careerTeam) return;
    var lineup = calcTeamLineup(team);
    var starter = lineup && lineup.starters ? lineup.starters[STATE.position] : null;
    var starterOvr = starter ? (starter.ovr || 0) : 55;
    var fit = (STATE.finalOVR || 0) - starterOvr;
    var standing = STATE.season && STATE.season.standings ? STATE.season.standings[team] : null;
    var games = standing ? (standing.wins || 0) + (standing.losses || 0) : 0;
    var rate = games ? (standing.wins || 0) / games : 0.5;
    var score = fit * 4 + rate * 18 + (fit >= 3 ? 18 : 0);
    candidates.push({ team: team, starterOvr: starterOvr, score: score });
  });
  candidates.sort(function(a, b) { return b.score - a.score || a.team.localeCompare(b.team); });
  return candidates.slice(0, 8);
}

function recordPlayerTradeRequest(request, resultText) {
  var c = STATE.career;
  if (!c || request.source !== 'manual') return;
  c.branchHistory = c.branchHistory || [];
  c.branchHistory.push({
    seasonNum: c.seasonCount || 0,
    phase: 'career',
    branch: 'transfer',
    eventId: 'player_trade_request_' + request.season,
    event: '主动申请交易',
    choice: request.preferredTeam ? ('意向球队：' + getTeamName(request.preferredTeam)) : '不指定下家',
    result: resultText || ''
  });
}

function createPlayerTradeRequest(preferredTeam, source, options) {
  options = options || {};
  var availability = getTradeRequestAvailability();
  if (!availability.allowed) return null;
  if (preferredTeam && (preferredTeam === STATE.careerTeam || LEAGUE_TEAM_IDS.indexOf(preferredTeam) < 0)) return null;

  var chance = getTradeRequestApprovalChance(preferredTeam);
  var approved = Math.random() * 100 < chance;
  var request = {
    season: getActiveTradeRequestSeason(),
    submittedGame: (STATE.season.schedule || []).filter(function(game) { return game && game.simulated; }).length,
    preferredTeam: preferredTeam || '',
    source: source || 'manual',
    status: approved ? 'approved' : 'denied',
    approvalChance: chance
  };
  getMobility().tradeRequest = request;
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.tradeRequested = true;

  if (options.applyEffects !== false) {
    addProfileDelta('loyalty', -2);
    addProfileDelta('lockerRoomTrust', -1);
    addProfileDelta('controversy', 1);
    addProfileDelta('businessValue', 1);
    if (typeof addActiveEventEffect === 'function') addActiveEventEffect('player-trade-request', '交易申请风波', -0.5, 4);
  }

  var teamName = preferredTeam ? getTeamName(preferredTeam) : '其他球队';
  var resultText = approved
    ? '管理层同意在赛季结束后为你寻找交易。你的首选下家是' + teamName + '，但最终去向仍取决于谈判。'
    : '管理层拒绝了申请，表示本赛季仍需要你完成合同责任。你本赛季不能再次申请。';
  recordPlayerTradeRequest(request, resultText);
  if (typeof queueSeasonAutoSave === 'function') queueSeasonAutoSave();
  return { request: request, resultText: resultText };
}

function closeTradeRequestModal() {
  var modal = document.getElementById('trade-request-modal');
  if (modal) modal.remove();
}

function showTradeRequestModal() {
  var availability = getTradeRequestAvailability();
  if (!availability.allowed) return;
  closeTradeRequestModal();
  var candidates = getTradeRequestCandidates();
  var cards = '';
  candidates.forEach(function(candidate) {
    var team = candidate.team;
    cards += '<button class="team-pick-card" style="font:inherit;cursor:pointer;" onclick="showTradeRequestConfirmation(\'' + team + '\')">' +
      getTeamLogo(team, 36) +
      '<span class="tpc-abbr">' + getTeamName(team) + '</span>' +
      '<span class="tpc-name">同位置首发 OVR ' + candidate.starterOvr + '</span>' +
      '</button>';
  });
  var html = '<div class="team-picker-overlay" id="trade-request-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>📨 申请交易</span><button class="team-picker-close" onclick="closeTradeRequestModal()">✕</button></div>';
  html += '<div style="padding:10px 14px 4px;font-size:12px;line-height:1.6;color:var(--text-dim);">选择一支意向球队。管理层可能拒绝申请；即使获准，意向球队也不保证成为最终下家。</div>';
  html += '<div class="team-picker-grid">' + cards + '</div>';
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function showTradeRequestConfirmation(team) {
  var modal = document.getElementById('trade-request-modal');
  if (!modal || team === STATE.careerTeam || LEAGUE_TEAM_IDS.indexOf(team) < 0) return;
  var chance = getTradeRequestApprovalChance(team);
  modal.innerHTML = '<div class="team-picker-modal" style="max-width:380px;">' +
    '<div class="team-picker-header"><span>确认提交申请</span><button class="team-picker-close" onclick="closeTradeRequestModal()">✕</button></div>' +
    '<div style="padding:18px 14px;text-align:center;">' + getTeamLogo(team, 52) +
    '<div style="font:700 18px var(--font-display);margin:8px 0 6px;">' + getTeamName(team) + '</div>' +
    '<div style="font-size:12px;line-height:1.65;color:var(--text-dim);">将该队列为首选下家。当前管理层批准概率约为 ' + chance + '%；提交后本赛季不能撤回或再次申请。</div></div>' +
    '<div style="padding:10px 12px;border-top:1px solid var(--border);display:flex;gap:8px;">' +
    '<button class="btn btn-secondary btn-sm" style="flex:1;" onclick="showTradeRequestModal()">返回</button>' +
    '<button class="btn btn-primary btn-sm" style="flex:1;" onclick="submitPlayerTradeRequest(\'' + team + '\')">提交申请</button>' +
    '</div></div>';
}

function submitPlayerTradeRequest(team) {
  var result = createPlayerTradeRequest(team, 'manual');
  closeTradeRequestModal();
  if (!result) return;
  var effectText = result.request.status === 'approved'
    ? '<br><br>影响：忠诚-2；更衣室信任-1；争议+1；未来四场球队气势略降。'
    : '<br><br>影响：忠诚-2；更衣室信任-1；争议+1；本赛季申请次数已用完。';
  showOffseasonResultModal(result.request.status === 'approved' ? '交易申请获准' : '交易申请被拒', result.resultText + effectText, function() {
    showMyCard();
  });
}

function renderPlayerTradeRequestCard() {
  var availability = getTradeRequestAvailability();
  var request = getPlayerTradeRequest();
  var currentSeason = getActiveTradeRequestSeason();
  var title = '📨 申请交易';
  var body = availability.reason || '';
  var action = '';
  if (availability.allowed) {
    action = '<button class="btn btn-secondary btn-sm" style="width:100%;margin-top:9px;" onclick="showTradeRequestModal()">选择意向球队</button>';
  } else if (request && request.season === currentSeason && request.preferredTeam) {
    body += ' · 首选 ' + getTeamName(request.preferredTeam);
  }
  return '<div class="mc-section"><div class="mc-section-title">' + title + '</div>' +
    '<div style="font-size:12px;line-height:1.6;color:var(--text-dim);">' + body + '</div>' + action + '</div>';
}

// ==================== 自由球员签约偏好 ====================
function getTeamHistoricalWinPct(teamId, standings) {
  var row = standings && standings[teamId];
  var wins = (row && row.wins) || 0;
  var losses = (row && row.losses) || 0;
  return wins + losses > 0 ? wins / (wins + losses) : 0.5;
}

function getFreeAgentRoleOpportunityScore(player, teamId) {
  if (!player || typeof calcTeamLineup !== 'function') return 0;
  var lineup = calcTeamLineup(teamId);
  var positions = ['PG','SG','SF','PF','C'].filter(function(pos) {
    return canPlayPosition(player.pos || '', pos);
  });
  if (!positions.length) positions = [(player.pos || 'SF').split('/')[0].trim()];
  var bestGap = -20;
  positions.forEach(function(pos) {
    var starter = lineup && lineup.starters ? lineup.starters[pos] : null;
    var gap = starter ? (Number(player.ovr) || 0) - (Number(starter.ovr) || 0) : 20;
    if (gap > bestGap) bestGap = gap;
  });
  var ovr = Number(player.ovr) || 70;
  if (ovr >= 88) {
    if (bestGap >= 2) return 0.22;
    if (bestGap >= 0) return 0.14;
    if (bestGap >= -3) return -0.08;
    return -0.22;
  }
  if (ovr >= 84) {
    if (bestGap >= 1) return 0.15;
    if (bestGap >= -2) return 0.05;
    if (bestGap >= -5) return -0.07;
    return -0.14;
  }
  if (bestGap >= 0) return 0.08;
  if (bestGap <= -7) return -0.08;
  return 0;
}

function getFreeAgentTeamPreferenceScore(player, teamId, standings, noise) {
  var winPct = getTeamHistoricalWinPct(teamId, standings);
  var score = player.ovr >= 85 ? winPct : 1 - winPct;
  if (teamId === player._origTeam) {
    score += (getPlayerLoyalty(player) - 50) * 0.005;
  }
  return score + getFreeAgentRoleOpportunityScore(player, teamId) + (Number(noise) || 0);
}

function assignFreeAgents() {
  var pool = STATE._freeAgentPool || [];
  if (pool.length === 0) return;

  if (!STATE._leagueChanges) STATE._leagueChanges = {};
  if (!STATE._leagueChanges.freeSignings) STATE._leagueChanges.freeSignings = [];

  console.log('[FA] 自由球员分配:', pool.length, '人');

  pool.sort(function(a, b) { return b.ovr - a.ovr; });
  var st = STATE._prevStandings;
  var teams = LEAGUE_TEAM_IDS.slice().sort(function(a, b) {
    var aw = (st && st[a] && st[a].wins) || 0, al = (st && st[a] && st[a].losses) || 0;
    var bw = (st && st[b] && st[b].wins) || 0, bl = (st && st[b] && st[b].losses) || 0;
    return (aw + al > 0 ? aw / (aw + al) : 0.5) - (bw + bl > 0 ? bw / (bw + bl) : 0.5);
  });

  // 本轮自由市场已签约 OVR ≥ 86 的球队（防扎堆）
  var starSignedTeams = {};

  pool.forEach(function(fa) {
    if (!fa._origTeam) console.log('[FA] 无_origTeam:', (fa.cname || fa.id), 'ovr:', fa.ovr);
    var pos = (fa.pos || 'SF').split('/')[0].trim();
    // 大牌优先争冠队、角色球员优先弱队；忠诚度决定原队在自由市场中的额外吸引力。
    var targetTeams = teams.map(function(teamId) {
      return {
        teamId: teamId,
        score: getFreeAgentTeamPreferenceScore(fa, teamId, st, (rngNext() - 0.5) * 0.15)
      };
    }).sort(function(a, b) { return b.score - a.score; }).map(function(item) { return item.teamId; });
    for (var ti = 0; ti < targetTeams.length; ti++) {
      var t = targetTeams[ti];
      // ★ 简化版薪资约束：任何球队 OVR≥85 球员不超过 3 名
      if (fa.ovr >= 82) {
        var starCount = (LEAGUE_PLAYER_DATA[t] || []).filter(function(p) { return !p._isUser && p.ovr >= 85; }).length;
        if (starCount >= 3) continue;
      }
      if (fa.ovr > 86) {
        if (t !== fa._origTeam && starSignedTeams[t]) { console.log('[FA] 该队已签球星，跳过:', (fa.cname || fa.id), t); continue; }
        var hasStar = false;
        (LEAGUE_PLAYER_DATA[t] || []).forEach(function(p) {
          // 全队范围检查：不论位置，只要有 OVR≥84 的球星就拦截
          if (p !== fa && !p._isUser && p.ovr >= 84) hasStar = true;
        });
        if (t !== fa._origTeam && hasStar) continue;
      }
      var roster = LEAGUE_PLAYER_DATA[t];
      if (!roster || roster.length >= 18) continue;
      var posCount = 0;
      roster.forEach(function(p) {
        if (canPlayPosition(p.pos || '', pos)) posCount++;
      });
      var roleOpportunity = getFreeAgentRoleOpportunityScore(fa, t);
      var roleFits = fa.ovr >= 82 ? roleOpportunity >= 0 : posCount < 2;
      if (roleFits) {
        roster.push(fa);
        fa._justSigned = true;
        fa.contract = randomContractByAge(getLeaguePlayerAge(fa));
        if (fa.ovr > 86) starSignedTeams[t] = true;
        var returnedToOriginalTeam = t === fa._origTeam;
        var loyaltyChange = recordPlayerLoyaltyDecision(fa, returnedToOriginalTeam ? 'renew' : 'leave', fa.contract, true, t);
        if (returnedToOriginalTeam) console.log('[FA] 自由市场回签:', (fa.cname || fa.id), t, '忠诚度', getPlayerLoyalty(fa));
        STATE._leagueChanges.freeSignings.push({ name: fa.cname, playerId: fa.id, from: fa._origTeam, to: t, ovr: fa.ovr, returned: returnedToOriginalTeam, years: fa.contract, loyaltyChange: loyaltyChange });
        if (t === STATE.careerTeam) {
          if (!STATE._leagueChanges.teamChanges) STATE._leagueChanges.teamChanges = {};
          STATE._leagueChanges.teamChanges[t] = STATE._leagueChanges.teamChanges[t] || { retired: [], rookies: [] };
          STATE._leagueChanges.teamChanges[t].rookies.push(fa.cname);
        }
        return;
      }
    }
    // fallback
    for (var fi = 0; fi < targetTeams.length; fi++) {
      var fb = targetTeams[fi];
      if (fa.ovr > 86) {
        if (fb !== fa._origTeam && starSignedTeams[fb]) continue;
        var hasStarFB = false;
        (LEAGUE_PLAYER_DATA[fb] || []).forEach(function(p) {
          if (p !== fa && !p._isUser && p.ovr >= 84) hasStarFB = true;
        });
        if (fb !== fa._origTeam && hasStarFB) continue;
      }
      var fbRoster = LEAGUE_PLAYER_DATA[fb];
      if (fbRoster && fbRoster.length < 18) {
        fbRoster.push(fa);
        fa._justSigned = true;
        fa.contract = randomContractByAge(getLeaguePlayerAge(fa));
        if (fa.ovr > 86) starSignedTeams[fb] = true;
        var fallbackReturned = fb === fa._origTeam;
        var fallbackLoyaltyChange = recordPlayerLoyaltyDecision(fa, fallbackReturned ? 'renew' : 'leave', fa.contract, true, fb);
        if (fallbackReturned) console.log('[FA] 自由市场回签:', (fa.cname || fa.id), fb, '忠诚度', getPlayerLoyalty(fa));
        STATE._leagueChanges.freeSignings.push({ name: fa.cname, playerId: fa.id, from: fa._origTeam, to: fb, ovr: fa.ovr, returned: fallbackReturned, years: fa.contract, loyaltyChange: fallbackLoyaltyChange });
        break;
      }
    }
  });

  STATE._freeAgentPool = [];
}

// ==================== 交易系统 ====================
function clearPreviousOffseasonTransactionFlags() {
  if (typeof LEAGUE_TEAM_IDS === 'undefined' || typeof LEAGUE_PLAYER_DATA === 'undefined') return;
  LEAGUE_TEAM_IDS.forEach(function(team) {
    (LEAGUE_PLAYER_DATA[team] || []).forEach(function(player) {
      if (player && player._justSigned) delete player._justSigned;
    });
  });
}

function findTradeCandidate(roster, pos, excludeOvr, tradedSet) {
  var best = null;
  for (var i = 0; i < roster.length; i++) {
    var p = roster[i];
    if (p._isUser) continue;
    if (p._justSigned) continue;
    if (p.ovr > 92) continue;
    if (tradedSet && tradedSet.has(p)) continue;
    if (excludeOvr != null && Math.abs(p.ovr - excludeOvr) > 10) continue;
    if (canPlayPosition(p.pos || '', pos)) {
      if (!best || Math.abs(p.ovr - (excludeOvr || 75)) < Math.abs(best.ovr - (excludeOvr || 75))) best = p;
    }
  }
  return best;
}

function swapRosterPlayers(teamA, teamB, playerA, playerB) {
  var rosterA = LEAGUE_PLAYER_DATA[teamA];
  var rosterB = LEAGUE_PLAYER_DATA[teamB];
  var idxA = -1, idxB = -1;
  for (var i = 0; i < rosterA.length; i++) { if (rosterA[i] === playerB) { idxA = i; break; } }
  for (var j = 0; j < rosterB.length; j++) { if (rosterB[j] === playerA) { idxB = j; break; } }
  if (idxA < 0 || idxB < 0) return;
  rosterA[idxA] = playerA;
  rosterB[idxB] = playerB;
  STATE._leagueChanges.trades.push({
    from: teamA, to: teamB,
    playerA: playerA.id,
    playerB: playerB.id,
  });
}

function processTrades() {
  if (!LEAGUE_PLAYER_DATA) return;
  if (!STATE._leagueChanges) STATE._leagueChanges = { retired: [], rookies: [], teamChanges: {}, trades: [] };
  if (!STATE._leagueChanges.trades) STATE._leagueChanges.trades = [];

  // 算每队需求位置
  var needs = {};
  LEAGUE_TEAM_IDS.forEach(function(t) {
    var lineup = calcTeamLineup(t);
    var weakest = null, weakOvr = 999;
    ['PG','SG','SF','PF','C'].forEach(function(pos) {
      var p = lineup.starters[pos];
      if (p && !p._isUser && p.ovr < weakOvr) {
        weakOvr = p.ovr; weakest = pos;
      }
    });
    needs[t] = weakest;
  });

  console.log('[Trade] 需求:', JSON.stringify(needs));

  var tradedPlayers = new Set();
  var tradedTeams = new Map(); // 改用 Map 支持计数

  // 打乱球队顺序，让交易分布更随机
  var shuffled = LEAGUE_TEAM_IDS.slice().sort(function() { return rngNext() - 0.5; });

  var tradeCount = 0;
  for (var ti = 0; ti < shuffled.length && tradeCount < 16; ti++) {
    var a = shuffled[ti];
    if ((tradedTeams.get(a) || 0) >= 2) continue; // 每队最多参与 2 笔

    var needA = needs[a];
    if (!needA) continue;

    // 找一支和 A 互补的球队
    for (var tj = ti + 1; tj < shuffled.length && tradeCount < 16; tj++) {
      var b = shuffled[tj];
      if (b === a || (tradedTeams.get(b) || 0) >= 2) continue;

      var needB = needs[b];
      if (!needB) continue;
      if (needA === needB) continue;

      var rosterA = LEAGUE_PLAYER_DATA[a];
      var rosterB = LEAGUE_PLAYER_DATA[b];
      if (!rosterA || !rosterB) continue;

      var playerForB = findTradeCandidate(rosterA, needB, null, tradedPlayers);
      var playerForA = findTradeCandidate(rosterB, needA, null, tradedPlayers);

      if (playerForA && playerForB) {
        var diff = Math.abs(playerForA.ovr - playerForB.ovr);
        console.log('[Trade] 配对:', a, needA, 'vs', b, needB, '候选人:', (playerForA.cname || playerForA.id), playerForA.ovr, (playerForB.cname || playerForB.id), playerForB.ovr, 'diff:', diff);
        if (diff <= 15) { // 放宽至 <= 15，允许弱队出售大牌换潜力股
          tradedPlayers.add(playerForA);
          tradedPlayers.add(playerForB);
          tradedTeams.set(a, (tradedTeams.get(a) || 0) + 1);
          tradedTeams.set(b, (tradedTeams.get(b) || 0) + 1);
          swapRosterPlayers(a, b, playerForA, playerForB);
          tradeCount++;
          // 重新算两队需求
          lineup = calcTeamLineup(a);
          var w2 = null, wo2 = 999;
          ['PG','SG','SF','PF','C'].forEach(function(pos) {
            var p2 = lineup.starters[pos];
            if (p2 && !p2._isUser && p2.ovr < wo2) { wo2 = p2.ovr; w2 = pos; }
          });
          needs[a] = w2;
          lineup = calcTeamLineup(b);
          w2 = null; wo2 = 999;
          ['PG','SG','SF','PF','C'].forEach(function(pos) {
            var p2 = lineup.starters[pos];
            if (p2 && !p2._isUser && p2.ovr < wo2) { wo2 = p2.ovr; w2 = pos; }
          });
          needs[b] = w2;
          break;
        }
      }
    }
  }
}

function getOvrPositions(pos) {
  var fallback = (typeof STATE !== 'undefined' && STATE && STATE.position) ? STATE.position : 'SG';
  var positions = String(pos || fallback).split('/').map(function(value) { return value.trim(); }).filter(Boolean);
  var valid = SIM_CONFIG && SIM_CONFIG.OVR_MODEL ? SIM_CONFIG.OVR_MODEL.positionWeights : null;
  positions = positions.filter(function(value) { return valid && valid[value]; });
  return positions.length ? positions.slice(0, 2) : ['SG'];
}

function calcOvrEffectiveAttribute(attrs, key) {
  var value = (attrs && attrs[key] != null) ? Number(attrs[key]) : 50;
  value = Math.max(25, Math.min(99, Number.isFinite(value) ? value : 50));
  return Math.pow((value - 25) / 74, 1.275);
}

function calcOvrDimensionRating(value) {
  var normalized = Math.max(0, Math.min(1, Number(value) || 0));
  return Math.max(25, Math.min(99, 25 + 74 * Math.pow(normalized, 1 / 1.275)));
}

function calcOvrDimensions(attrs) {
  function skill(key) { return calcOvrEffectiveAttribute(attrs, key); }
  var three = skill('threePT');
  var mid = skill('MID');
  var finish = skill('FIN');
  var dunk = skill('DNK');
  var handle = skill('HAN');
  var pass = skill('PAS');
  var perimeterDefense = skill('PDEF');
  var interiorDefense = skill('IDEF');
  var block = skill('BLK');
  var rebound = skill('REB');
  var athletic = skill('ATH');
  var strength = skill('STR');
  var clutch = skill('CLU');

  var scoringOptions = [
    three * 0.60 + handle * 0.24 + athletic * 0.10 + clutch * 0.06,
    mid * 0.58 + handle * 0.24 + clutch * 0.10 + strength * 0.08,
    handle * 0.30 + athletic * 0.25 + finish * 0.23 + strength * 0.14 + dunk * 0.08,
    finish * 0.34 + dunk * 0.28 + athletic * 0.22 + strength * 0.16,
    strength * 0.34 + finish * 0.28 + mid * 0.23 + handle * 0.15,
    athletic * 0.35 + finish * 0.28 + dunk * 0.25 + handle * 0.12
  ].sort(function(a, b) { return b - a; });
  var defenseOptions = [
    perimeterDefense * 0.65 + athletic * 0.25 + strength * 0.10,
    interiorDefense * 0.44 + block * 0.32 + strength * 0.14 + rebound * 0.10,
    rebound * 0.52 + interiorDefense * 0.28 + strength * 0.20
  ].sort(function(a, b) { return b - a; });
  var allSkills = [three, mid, finish, dunk, handle, pass, perimeterDefense, interiorDefense, block, rebound, athletic, strength, clutch]
    .sort(function(a, b) { return b - a; });
  var versatility = allSkills.slice(0, 7).reduce(function(sum, value) { return sum + value; }, 0) / 7;

  return {
    scoring: calcOvrDimensionRating(scoringOptions[0] * 0.50 + scoringOptions[1] * 0.30 + scoringOptions[2] * 0.20),
    playmaking: calcOvrDimensionRating(pass * 0.55 + handle * 0.30 + clutch * 0.15),
    defense: calcOvrDimensionRating(defenseOptions[0] * 0.55 + defenseOptions[1] * 0.30 + defenseOptions[2] * 0.15),
    physical: calcOvrDimensionRating(athletic * 0.45 + strength * 0.30 + dunk * 0.15 + rebound * 0.10),
    clutch: calcOvrDimensionRating(clutch * 0.50 + handle * 0.15 + pass * 0.15 + three * 0.10 + mid * 0.10),
    versatility: calcOvrDimensionRating(versatility)
  };
}

function calcOvrPositionScore(dimensions, pos) {
  var weights = SIM_CONFIG.OVR_MODEL.positionWeights[pos];
  return Object.keys(weights).reduce(function(sum, key) {
    return sum + dimensions[key] * weights[key];
  }, 0);
}

function calcOvrFormulaScore(attrs, pos) {
  var model = SIM_CONFIG && SIM_CONFIG.OVR_MODEL;
  if (!model) return 50;
  var positions = getOvrPositions(pos);
  var dimensions = calcOvrDimensions(attrs);
  var primaryScore = calcOvrPositionScore(dimensions, positions[0]);
  var positionScore = primaryScore;
  if (positions[1]) {
    var secondaryWeight = Math.max(0, Math.min(0.5, Number(model.secondaryPositionWeight) || 0));
    positionScore = primaryScore * (1 - secondaryWeight) + calcOvrPositionScore(dimensions, positions[1]) * secondaryWeight;
  }
  var calibration = model.calibration[positions[0]] || model.calibration.SG;
  var eliteBonus = Math.max(0, positionScore - model.eliteThreshold) * calibration.eliteScale;
  // 保留未截断的连续公式分作为成长基准，避免高 OVR 球员在 99 分平台上失去成长响应。
  return calibration.offset + positionScore * calibration.scale + eliteBonus;
}

function calcOVR(attrs, pos) {
  var formulaScore = calcOvrFormulaScore(attrs, pos);
  var model = SIM_CONFIG && SIM_CONFIG.OVR_MODEL;
  var anchor = model && model.sourceAnchor;
  if (attrs && anchor && !isGeneratedLeaguePlayer(attrs)) {
    var anchorVersion = Number(attrs._ovrAnchorVersion);
    var anchorOvr = Number(attrs._ovrAnchorOvr);
    var anchorScore = Number(attrs._ovrAnchorScore);
    if (anchorVersion === Number(anchor.version) && Number.isFinite(anchorOvr) && Number.isFinite(anchorScore)) {
      var deltaScale = Number(anchor.attributeDeltaScale);
      if (!Number.isFinite(deltaScale)) deltaScale = 1;
      return Math.max(40, Math.min(99, Math.round(anchorOvr + (formulaScore - anchorScore) * deltaScale)));
    }
  }
  return Math.max(40, Math.min(99, Math.round(formulaScore)));
}

function isGeneratedLeaguePlayer(player) {
  if (!player) return false;
  var id = String(player.id || '');
  return !!player._prospectId || /^R\d+$/.test(id) || /^D\d{2}-\d+$/.test(id);
}

var ROOKIE_ATTRIBUTE_PROFILE_VERSION = 2;
var ROOKIE_ATTRIBUTE_PROFILES = {
  PG: [
    { id: 'playmaker', label: '组织核心', strengths: ['HAN','PAS','ATH'], weaknesses: ['IDEF','BLK','REB','STR'] },
    { id: 'scoring_guard', label: '进攻后卫', strengths: ['threePT','MID','HAN','CLU'], weaknesses: ['IDEF','BLK','REB','STR'] }
  ],
  SG: [
    { id: 'perimeter_scorer', label: '外线得分手', strengths: ['threePT','MID','FIN','HAN'], weaknesses: ['IDEF','BLK','REB','STR'] },
    { id: 'two_way_slasher', label: '双向突破手', strengths: ['FIN','DNK','PDEF','ATH'], weaknesses: ['IDEF','BLK','REB','PAS'] }
  ],
  SF: [
    { id: 'two_way_wing', label: '双向锋线', strengths: ['FIN','PDEF','ATH','STR'], weaknesses: ['PAS','BLK','REB','MID'] },
    { id: 'point_forward', label: '组织前锋', strengths: ['HAN','PAS','FIN','PDEF'], weaknesses: ['BLK','REB','threePT','STR'] }
  ],
  PF: [
    { id: 'interior_forward', label: '内线前锋', strengths: ['FIN','IDEF','REB','STR'], weaknesses: ['threePT','MID','HAN','PAS'] },
    { id: 'stretch_four', label: '空间四号位', strengths: ['threePT','MID','PDEF','IDEF'], weaknesses: ['HAN','PAS','BLK','DNK'] }
  ],
  C: [
    { id: 'rim_protector', label: '护框中锋', strengths: ['FIN','IDEF','BLK','REB','STR'], weaknesses: ['threePT','MID','HAN','PAS','PDEF'] },
    { id: 'skilled_big', label: '技术型内线', strengths: ['FIN','MID','IDEF','REB','PAS'], weaknesses: ['threePT','HAN','PDEF','ATH','DNK'] }
  ]
};

function getGeneratedPlayerMainPos(player) {
  var pos = String(player && player.pos || '').split('/')[0].trim();
  return ROOKIE_ATTRIBUTE_PROFILES[pos] ? pos : 'SF';
}

function getRookieProfile(player, randomFn) {
  var profiles = ROOKIE_ATTRIBUTE_PROFILES[getGeneratedPlayerMainPos(player)] || ROOKIE_ATTRIBUTE_PROFILES.SF;
  for (var i = 0; i < profiles.length; i++) {
    if (profiles[i].id === player._rookieProfile) return profiles[i];
  }
  var random = typeof randomFn === 'function' ? randomFn : Math.random;
  return profiles[Math.floor(random() * profiles.length) % profiles.length];
}

function clampLeagueAttribute(value) {
  return Math.max(25, Math.min(99, Math.round(value)));
}

function normalizeRookieAttributesToOvr(player, targetOvr) {
  var pos = getGeneratedPlayerMainPos(player);
  var target = Math.max(55, Math.min(99, Math.round(Number(targetOvr) || 55)));
  var current = calcOVR(player, pos);
  var correction = target - current;
  if (correction) {
    ATTR_KEYS.forEach(function(key) {
      player[key] = clampLeagueAttribute((Number(player[key]) || 50) + correction);
    });
  }
  var guard = 0;
  current = calcOVR(player, pos);
  while (current !== target && guard++ < 320) {
    var step = current < target ? 1 : -1;
    var changed = false;
    for (var i = 0; i < ATTR_KEYS.length; i++) {
      var key = ATTR_KEYS[i];
      var before = Number(player[key]) || 50;
      var next = clampLeagueAttribute(before + step);
      if (next === before) continue;
      player[key] = next;
      var candidate = calcOVR(player, pos);
      var staysOnTargetSide = step > 0 ? candidate <= target : candidate >= target;
      if (staysOnTargetSide) {
        current = candidate;
        changed = true;
        break;
      }
      player[key] = before;
    }
    if (!changed) break;
  }
  player.ovr = calcOVR(player, pos);
  return player.ovr;
}

function getCurrentLeagueSeasonNumber() {
  return Math.max(1, ((STATE && STATE.career && STATE.career.seasonCount) || 0) + 1);
}

function refreshGeneratedPlayerType(player) {
  if (!isGeneratedLeaguePlayer(player)) return false;
  var profile = getRookieProfile(player);
  var currentSeason = getCurrentLeagueSeasonNumber();
  var nextType = currentSeason <= (Number(player._rookieSeason) || currentSeason) ? '新秀' : profile.label;
  if (player.type === nextType) return false;
  player.type = nextType;
  return true;
}

function applyRookieAttributeProfile(player, targetOvr, randomFn) {
  var random = typeof randomFn === 'function' ? randomFn : Math.random;
  var profile = getRookieProfile(player, random);
  player._rookieProfile = profile.id;
  player._rookieGenerationVersion = ROOKIE_ATTRIBUTE_PROFILE_VERSION;
  if (!player._rookieSeason) player._rookieSeason = getCurrentLeagueSeasonNumber();
  ATTR_KEYS.forEach(function(key) {
    var offset;
    if (profile.strengths.indexOf(key) >= 0) offset = 7 + Math.floor(random() * 5);
    else if (profile.weaknesses.indexOf(key) >= 0) offset = -(10 + Math.floor(random() * 6));
    else offset = Math.floor(random() * 7) - 3;
    player[key] = clampLeagueAttribute((Number(targetOvr) || 55) + offset);
  });
  normalizeRookieAttributesToOvr(player, targetOvr);
  refreshGeneratedPlayerType(player);
  return player;
}

function createGeneratedPlayerMigrationRandom(player) {
  var text = [player.id || '', player._prospectId || '', player.pos || '', player.ovr || ''].join(':');
  var seed = 2166136261;
  for (var i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  return function() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function rebalanceLegacyGeneratedPlayer(player) {
  if (!isGeneratedLeaguePlayer(player) || player._rookieGenerationVersion >= ROOKIE_ATTRIBUTE_PROFILE_VERSION) return false;
  var targetOvr = Math.max(55, Math.min(99, Math.round(Number(player.ovr) || 70)));
  if (!player._rookieSeason) {
    var age = Number(player._age) || 20;
    player._rookieSeason = Math.max(1, getCurrentLeagueSeasonNumber() - Math.max(0, age - 20));
  }
  applyRookieAttributeProfile(player, targetOvr, createGeneratedPlayerMigrationRandom(player));
  return true;
}

function evolveGeneratedPlayerAttributes(player, oldOvr, newOvr) {
  if (!isGeneratedLeaguePlayer(player)) return false;
  if (player._rookieGenerationVersion < ROOKIE_ATTRIBUTE_PROFILE_VERSION) rebalanceLegacyGeneratedPlayer(player);
  var profile = getRookieProfile(player);
  var delta = Math.round(newOvr) - Math.round(oldOvr);
  if (!delta) return false;
  ATTR_KEYS.forEach(function(key) {
    var attrDelta = delta;
    if (delta > 0 && profile.strengths.indexOf(key) >= 0) attrDelta = delta + 1;
    else if (delta > 0 && profile.weaknesses.indexOf(key) >= 0) attrDelta = Math.max(0, delta - 1);
    else if (delta < 0 && profile.weaknesses.indexOf(key) >= 0) attrDelta = delta - 1;
    player[key] = clampLeagueAttribute((Number(player[key]) || 50) + attrDelta);
  });
  normalizeRookieAttributesToOvr(player, newOvr);
  return true;
}

function syncGeneratedLeaguePlayerOvr(player) {
  if (!isGeneratedLeaguePlayer(player)) return false;
  var pos = String(player.pos || '').split('/')[0].trim();
  if (!SIM_CONFIG || !SIM_CONFIG.OVR_WEIGHTS || !SIM_CONFIG.OVR_WEIGHTS[pos]) return false;
  var nextOvr = calcOVR(player, pos);
  if (player.ovr === nextOvr) return false;
  player.ovr = nextOvr;
  return true;
}

function syncGeneratedLeaguePlayerOvrs() {
  if (typeof LEAGUE_PLAYER_DATA === 'undefined' || typeof LEAGUE_TEAM_IDS === 'undefined') return 0;
  var changed = 0;
  LEAGUE_TEAM_IDS.forEach(function(teamId) {
    (LEAGUE_PLAYER_DATA[teamId] || []).forEach(function(player) {
      var playerChanged = rebalanceLegacyGeneratedPlayer(player);
      if (refreshGeneratedPlayerType(player)) playerChanged = true;
      if (syncGeneratedLeaguePlayerOvr(player)) playerChanged = true;
      if (playerChanged) changed++;
    });
  });
  if (changed && typeof clearLineupCache === 'function') clearLineupCache();
  return changed;
}

function syncLeaguePlayerOvrs() {
  if (typeof LEAGUE_PLAYER_DATA === 'undefined' || typeof LEAGUE_TEAM_IDS === 'undefined') return 0;
  var changed = 0;
  LEAGUE_TEAM_IDS.forEach(function(teamId) {
    (LEAGUE_PLAYER_DATA[teamId] || []).forEach(function(player) {
      if (!player || !player.pos) return;
      var hadSourceOvr = Object.prototype.hasOwnProperty.call(player, '_sourceOvr');
      if (!hadSourceOvr) {
        try {
          Object.defineProperty(player, '_sourceOvr', { value: Number(player.ovr) || 50, writable: true, configurable: true, enumerable: true });
        } catch (error) {
          player._sourceOvr = Number(player.ovr) || 50;
        }
      }
      if (isGeneratedLeaguePlayer(player)) {
        rebalanceLegacyGeneratedPlayer(player);
        refreshGeneratedPlayerType(player);
      } else {
        var anchor = SIM_CONFIG && SIM_CONFIG.OVR_MODEL && SIM_CONFIG.OVR_MODEL.sourceAnchor;
        var expectedAnchorVersion = anchor ? Number(anchor.version) : 0;
        var hasCurrentAnchor = anchor
          && Number(player._ovrAnchorVersion) === expectedAnchorVersion
          && Number.isFinite(Number(player._ovrAnchorOvr))
          && Number.isFinite(Number(player._ovrAnchorScore));
        if (anchor && !hasCurrentAnchor) {
          var seasonCount = Number(STATE && STATE.career && STATE.career.seasonCount) || 0;
          // 新名单以审核 OVR 为基准；旧的长期存档升级公式时保留当时的运行 OVR，避免进度跳变。
          var anchorOvr = hadSourceOvr && seasonCount > 0 ? Number(player.ovr) : Number(player._sourceOvr);
          player._ovrAnchorVersion = expectedAnchorVersion;
          player._ovrAnchorOvr = Math.max(40, Math.min(99, Math.round(anchorOvr || 50)));
          player._ovrAnchorScore = calcOvrFormulaScore(player, player.pos);
        }
      }
      var nextOvr = calcOVR(player, player.pos);
      if (player.ovr === nextOvr) return;
      player.ovr = nextOvr;
      changed++;
    });
  });
  if (changed && typeof clearLineupCache === 'function') clearLineupCache();
  return changed;
}

// ==================== 联盟演变 ====================
var _playerAges = null;
var _playerGenes = null;
var PLAYER_LOYALTY_GENE_VERSION = 3;

function loadPlayerAges() {
  if (_playerAges) return;
  _playerAges = {};
  _playerGenes = {};
  try {
    var data = document.getElementById('player-age-data');
    if (data) {
      var rows = JSON.parse(data.textContent);
      rows.forEach(function(r) {
        _playerAges[r.id] = r.a;
        _playerGenes[r.id] = { v: r.v || (1 + Math.floor(rngNext() * 4)) };
      });
      assignKnownPlayerPotentials();
    }
  } catch(e) {}
}

function getPlayerAge(playerId) {
  loadPlayerAges();
  return _playerAges && _playerAges[playerId] ? _playerAges[playerId] : null;
}

function inferLeaguePlayerPotential(player, age) {
  var ovr = Math.max(55, Math.min(99, Number(player && player.ovr) || 55));
  var playerAge = Number(age) || inferAge(player && player.id, ovr);
  if (playerAge >= 29) return ovr;

  // 现实球员以当前能力相对同龄人的领先程度决定上限，年轻球员保留更多成长空间。
  var ageRoom = Math.max(1, 29 - playerAge);
  var ageBenchmark = Math.max(68, Math.min(88, 68 + Math.max(0, playerAge - 18) * 2));
  var abilityBonus = Math.max(-2, Math.min(3, Math.round((ovr - ageBenchmark) / 5)));
  var potential = ovr + Math.max(0, ageRoom + abilityBonus);
  if (typeof isMvpStar === 'function' && isMvpStar(player)) potential = Math.max(potential, ovr + 10);
  return Math.max(ovr, Math.min(99, potential));
}

function getPublishedPlayerLoyalty(playerId) {
  if (typeof PLAYER_LOYALTY_DATA === 'undefined') return null;
  var value = PLAYER_LOYALTY_DATA[playerId];
  return typeof value === 'number' ? Math.max(0, Math.min(100, value)) : null;
}

function getRookieContractLoyalty(contractYears) {
  var years = Math.max(1, Math.min(4, Number(contractYears) || 1));
  return 58 + years * 2;
}

function ensurePlayerLoyaltyGene(gene, player) {
  if (!gene) return gene;
  if (gene.loyaltyVersion !== PLAYER_LOYALTY_GENE_VERSION) {
    gene.loyalty = inferPlayerLoyalty(player);
    gene.loyaltyVersion = PLAYER_LOYALTY_GENE_VERSION;
    gene.loyaltyRenewals = 0;
    gene.loyaltyLastEvent = '';
    gene.loyaltyTeam = '';
  } else if (typeof gene.loyalty !== 'number') {
    gene.loyalty = inferPlayerLoyalty(player);
  }
  if (typeof gene.roleUnderuseSeasons !== 'number') gene.roleUnderuseSeasons = 0;
  return gene;
}

function inferPlayerLoyalty(player) {
  var playerId = player && typeof player === 'object' ? player.id : player;
  var published = getPublishedPlayerLoyalty(playerId);
  if (published !== null) return published;
  if (player && typeof player === 'object' && typeof player.loyalty === 'number') {
    return Math.max(0, Math.min(100, player.loyalty));
  }
  var id = String(playerId || '');
  if ((player && player.type === '新秀') || /^R\d/.test(id) || /^D\d{2}-/.test(id)) {
    return getRookieContractLoyalty(player && player.contract);
  }
  return 50;
}

function getPlayerLoyalty(player) {
  var gene = getPlayerGene(player);
  return Math.max(0, Math.min(100, Number(gene && gene.loyalty) || 50));
}

function getPlayerLoyaltyLabel(loyalty) {
  var value = Math.max(0, Math.min(100, Number(loyalty) || 50));
  if (value >= 80) return '忠诚型';
  if (value >= 60) return '稳定型';
  if (value >= 40) return '观望型';
  return '流动型';
}

function recordPlayerLoyaltyDecision(player, decision, contractYears, throughFreeAgency, teamId) {
  var gene = getPlayerGene(player);
  var before = Math.max(0, Math.min(100, Number(gene.loyalty) || 50));
  var after = before;
  if (decision === 'renew') {
    var years = Math.max(1, Math.min(4, Number(contractYears) || 1));
    if (gene.loyaltyTeam && teamId && gene.loyaltyTeam !== teamId) gene.loyaltyRenewals = 0;
    var baseGain = [0, 2, 3, 4, 5][years];
    var repeatBonus = gene.loyaltyRenewals >= 2 ? 3 : gene.loyaltyRenewals >= 1 ? 2 : 0;
    var rawGain = Math.max(1, baseGain + repeatBonus - (throughFreeAgency ? 1 : 0));
    var headroomFactor = Math.max(0.25, (95 - before) / 45);
    var gain = Math.max(1, Math.round(rawGain * headroomFactor));
    after = Math.max(before, Math.min(95, before + gain));
    gene.loyaltyRenewals = (Number(gene.loyaltyRenewals) || 0) + 1;
    gene.loyaltyLastEvent = throughFreeAgency ? '自由市场回签' : years + '年续约';
    if (teamId) gene.loyaltyTeam = teamId;
  } else if (decision === 'leave') {
    var penalty = before >= 80 ? 12 : before >= 60 ? 10 : 8;
    after = Math.max(5, before - penalty);
    gene.loyaltyRenewals = 0;
    gene.loyaltyLastEvent = '主动离队';
    gene.loyaltyTeam = '';
  }
  gene.loyalty = after;
  return after - before;
}

function getPlayerLoyaltyBasis(player) {
  var playerId = player && typeof player === 'object' ? player.id : player;
  var publishedBasis = typeof PLAYER_LOYALTY_BASIS !== 'undefined' ? PLAYER_LOYALTY_BASIS[playerId] : '';
  var gene = _playerGenes && _playerGenes[playerId];
  var dynamicBasis = gene && gene.loyaltyLastEvent ? '游戏内：' + gene.loyaltyLastEvent : '';
  var roleBasis = gene && gene.lastRoleSample && !gene.lastRoleStarter
    ? '上季替补 ' + Math.round(gene.lastRoleMpg) + ' 分钟'
    : '';
  if (dynamicBasis && roleBasis) dynamicBasis += ' · ' + roleBasis;
  else if (roleBasis) dynamicBasis = roleBasis;
  if (publishedBasis) return publishedBasis + (dynamicBasis ? ' · ' + dynamicBasis : '');
  var id = String(playerId || '');
  if ((player && player.type === '新秀') || /^R\d/.test(id) || /^D\d{2}-/.test(id)) {
    return '新秀合同·不推测个人意愿' + (dynamicBasis ? ' · ' + dynamicBasis : '');
  }
  return '公开信息不足·中性值' + (dynamicBasis ? ' · ' + dynamicBasis : '');
}

function assignKnownPlayerPotentials() {
  if (!_playerGenes || typeof LEAGUE_PLAYER_DATA === 'undefined' || typeof LEAGUE_TEAM_IDS === 'undefined') return;
  LEAGUE_TEAM_IDS.forEach(function(teamId) {
    (LEAGUE_PLAYER_DATA[teamId] || []).forEach(function(player) {
      var gene = _playerGenes[player.id];
      if (!gene) return;
      if (typeof gene.potential !== 'number') {
        var age = _playerAges[player.id] || player._age || inferAge(player.id, player.ovr);
        gene.potential = inferLeaguePlayerPotential(player, age);
      }
      ensurePlayerLoyaltyGene(gene, player);
    });
  });
}

function getPlayerGene(player) {
  loadPlayerAges();
  var playerId = player && typeof player === 'object' ? player.id : player;
  var playerObject = player && typeof player === 'object' ? player : null;
  if (_playerGenes && _playerGenes[playerId]) {
    var existingGene = _playerGenes[playerId];
    return ensurePlayerLoyaltyGene(existingGene, playerObject || playerId);
  }
  var age = playerObject ? getLeaguePlayerAge(playerObject) : null;
  var g = {
    v: 1 + Math.floor(rngNext() * 4),
    potential: inferLeaguePlayerPotential(playerObject, age),
    loyalty: inferPlayerLoyalty(playerObject || playerId),
    loyaltyVersion: PLAYER_LOYALTY_GENE_VERSION,
    loyaltyRenewals: 0,
    loyaltyLastEvent: '',
    loyaltyTeam: '',
    roleUnderuseSeasons: 0
  };
  if (_playerGenes) _playerGenes[playerId] = g;
  return g;
}

function getPotentialGrowthBias(potential, ovr, age) {
  if (typeof potential !== 'number' || age > 28) return 0;
  var room = potential - ovr;
  if (room <= 0) return 0;
  if (age <= 22) return Math.max(-0.25, Math.min(0.5, (room - 5) * 0.1));
  if (age <= 26) return Math.max(-0.15, Math.min(0.35, (room - 3) * 0.08));
  return Math.min(0.2, room * 0.05);
}

function inferAge(playerId, ovr) {
  if (ovr >= 90) return 28;
  if (ovr >= 80) return 26;
  if (ovr >= 70) return 24;
  return 22;
}

function getLeaguePlayerAge(player) {
  if (player && typeof player._age === 'number') return player._age;
  var age = getPlayerAge(player && player.id) || inferAge(player && player.id, player && player.ovr);
  if (player) player._age = age;
  return age;
}

function getLeaguePlayerRoleStayAdjustment(player, roleContext) {
  if (!player || !roleContext || !roleContext.hasSample || roleContext.isStarter) return 0;
  var ovr = Number(roleContext.ovr != null ? roleContext.ovr : player.ovr) || 70;
  var mpg = Number(roleContext.mpg) || 0;
  if (ovr >= 88) {
    if (mpg >= 26) return -0.08;
    if (mpg >= 20) return -0.20;
    return -0.32;
  }
  if (ovr >= 84) {
    if (mpg >= 24) return -0.04;
    if (mpg >= 18) return -0.12;
    return -0.22;
  }
  if (ovr >= 80) {
    if (mpg >= 18) return 0;
    if (mpg >= 14) return -0.06;
    return -0.12;
  }
  return mpg < 10 ? -0.05 : 0;
}

function getLeaguePlayerSeasonRoleContext(teamId, player, lineup) {
  var stats = STATE.season && STATE.season.leaguePlayerSeasonStats;
  var row = stats && stats[teamId + ':' + player.id];
  var gp = Number(row && row.gp) || 0;
  var mpg = gp > 0 ? (Number(row.min) || 0) / gp : 0;
  var starters = lineup && lineup.starters ? Object.values(lineup.starters) : [];
  return {
    gp: gp,
    mpg: mpg,
    ovr: Number(player.ovr) || 70,
    hasSample: gp >= 10,
    isStarter: starters.indexOf(player) >= 0
  };
}

function updatePlayerRoleSatisfactionHistory(player, roleContext) {
  var gene = getPlayerGene(player);
  var adjustment = getLeaguePlayerRoleStayAdjustment(player, roleContext);
  if (roleContext && roleContext.hasSample) {
    gene.roleUnderuseSeasons = adjustment <= -0.12 ? (Number(gene.roleUnderuseSeasons) || 0) + 1 : 0;
    gene.lastRoleMpg = Number(roleContext.mpg) || 0;
    gene.lastRoleStarter = !!roleContext.isStarter;
    gene.lastRoleSample = true;
  }
  return gene.roleUnderuseSeasons || 0;
}

function calculateContractStayRate(player, history, roleContext) {
  var avgPct = 0.5;
  if (history && history.length > 0) {
    var sum = 0;
    history.forEach(function(value) { sum += value; });
    avgPct = sum / history.length;
  }
  var teamFactor = avgPct >= 0.65 ? 1.35 : avgPct >= 0.55 ? 1.15 : avgPct >= 0.45 ? 0.95 : avgPct >= 0.35 ? 0.75 : 0.6;
  var starFactor = player.ovr >= 88 ? 0.95 : 1.0;
  var trendFactor = 1.0;
  if (history && history.length >= 3) {
    if (history[0] - history[1] < -0.02 && history[1] - history[2] < -0.02) trendFactor = 0.85;
    else if (history[0] - history[1] > 0.02 && history[1] - history[2] > 0.02) trendFactor = 1.1;
  }
  var loyaltyBonus = (getPlayerLoyalty(player) - 50) * 0.004;
  var roleAdjustment = getLeaguePlayerRoleStayAdjustment(player, roleContext);
  var gene = getPlayerGene(player);
  var repeatedUnderusePenalty = roleAdjustment <= -0.12 && gene.roleUnderuseSeasons >= 2 ? -0.10 : 0;
  var contenderRefund = roleAdjustment < 0 ? (avgPct >= 0.65 ? 0.08 : avgPct >= 0.55 ? 0.04 : 0) : 0;
  var stayRate = 0.80 * teamFactor * starFactor * trendFactor + loyaltyBonus + roleAdjustment + repeatedUnderusePenalty + contenderRefund;
  return Math.max(0.1, Math.min(0.96, stayRate));
}

function advanceSpecialLeaguePlayerAge(player, age) {
  if (player && player._protectedRetirementAge) player._specialAge = (age || player._age || 40) + 1;
}

function evolveLeague() {
  STATE._leagueChanges = { retired: [], rookies: [], teamChanges: {}, trades: [] };
  var teams = typeof LEAGUE_TEAM_IDS !== 'undefined' ? LEAGUE_TEAM_IDS : [];
  syncLeaguePlayerOvrs();
  var seasonRoleContexts = {};
  teams.forEach(function(t) {
    var roleRoster = LEAGUE_PLAYER_DATA[t] || [];
    var lineup = typeof calcTeamLineup === 'function' ? calcTeamLineup(t) : null;
    roleRoster.forEach(function(player) {
      var context = getLeaguePlayerSeasonRoleContext(t, player, lineup);
      updatePlayerRoleSatisfactionHistory(player, context);
      seasonRoleContexts[t + ':' + player.id] = context;
    });
  });
  teams.forEach(function(t) {
    var roster = LEAGUE_PLAYER_DATA[t];
    if (!roster || !roster.length) return;
    STATE._leagueChanges.teamChanges[t] = { before: roster.length, retired: [], rookies: [] };
    var newRoster = [];
    roster.forEach(function(p) {
      var age = getLeaguePlayerAge(p);
      var gene = getPlayerGene(p);
      var volatility = gene.v;
      var ageFactor = 0;
      if (age <= 22) ageFactor = 1 + rngNext() * 1.5;
      else if (age <= 28) ageFactor = (rngNext() - 0.5) * 1.5;
      else if (age <= 33) ageFactor = -1 - rngNext() * 1.5;
      else ageFactor = -2 - rngNext() * 2;
      var volFactor = (rngNext() - 0.5) * volatility * 0.6;
      var randFactor = (rngNext() - 0.5) * 1.5;
      var change = ageFactor * 0.5 + volFactor * 0.3 + randFactor * 0.2;
      change += getPotentialGrowthBias(gene.potential, p.ovr, age);
      if (isMvpStar(p) && age <= 26) change += 0.6 + rngNext() * 0.8; // 重点新秀成长加速
      if (change > 0 && p.ovr >= gene.potential) change = 0;
      change = Math.sign(change) * Math.round(Math.abs(change));
      var newOvr = Math.max(55, Math.min(99, p.ovr + change));
      if (newOvr !== p.ovr) {
        var oldOvr = p.ovr;
        if (!evolveGeneratedPlayerAttributes(p, oldOvr, newOvr)) {
          var baseRatio = Math.round(newOvr) / oldOvr;
          var decayFast    = ['ATH', 'STR', 'PDEF'];
          var decayResist  = ['threePT', 'MID', 'PAS', 'HAN', 'CLU'];
          SIM_CONFIG.ATTR_LIST.forEach(function(attrKey) {
            if (p[attrKey] == null) return;
            var r = baseRatio;
            if (baseRatio < 1) {
              if (decayFast.indexOf(attrKey) >= 0)   r = 1 - (1 - baseRatio) * 1.5; // 运动衰退放大
              if (decayResist.indexOf(attrKey) >= 0) r = 1 - (1 - baseRatio) * 0.3; // 投射/球商几乎不退
            }
            p[attrKey] = Math.max(25, Math.min(99, Math.round(p[attrKey] * r)));
          });
          p.ovr = calcOVR(p, p.pos);
        }
      }
      var retireChance = 0;
      if (p._protectedRetirementAge && age < p._protectedRetirementAge) {
        retireChance = 0;
      } else if (age >= 38) retireChance = 50;
      else if (age >= 36) retireChance = 25;
      else if (age >= 34 && p.ovr < 75) retireChance = 35;
      if (rngNext() * 100 < retireChance) {
        STATE._leagueChanges.retired.push({ displayName: p.cname, playerId: p.id, hidden: !!p._veteranTribute, ovr: p.ovr, team: t, age: age });
        if (t === STATE.careerTeam && STATE._leagueChanges.teamChanges[t]) {
          STATE._leagueChanges.teamChanges[t].retired.push(p.cname);
        }
        return;
      }
      p._age = age + 1; // 临时实验：球员年龄真实上涨，每年 +1
      refreshGeneratedPlayerType(p);
      newRoster.push(p);
    });
    var draftSlot = 0;
    while (newRoster.length < 18) { // 休赛期名单补齐到 18 人
      draftSlot++;
      var rk = generateRookie();
      // 补位新秀与选秀新秀一致，只保护当前休赛期，避免刚加入就被交易。
      rk._justSigned = true;
      // 前3个空位（更弱的队）：OVR 68-74（彩票区球员）；之后：OVR 60-67（次轮/末签）
      var fillerOvr = draftSlot <= 3
        ? 68 + Math.floor(rngNext() * 7)
        : 60 + Math.floor(rngNext() * 8);
      if (rk._fixedProspectRating) {
        normalizeRookieAttributesToOvr(rk, rk.ovr);
        rk._rookieSeason = getCurrentLeagueSeasonNumber();
      } else {
        rk.ovr = fillerOvr;
        applyRookieAttributeProfile(rk, fillerOvr, rngNext);
      }
      rk.contract = draftSlot <= 3 ? 3 : 2;
      rk.loyalty = getRookieContractLoyalty(rk.contract);
      newRoster.push(rk);
      STATE._leagueChanges.rookies.push({ name: rk.cname, playerId: rk.id, team: t });
      if (t === STATE.careerTeam && STATE._leagueChanges.teamChanges[t]) {
        STATE._leagueChanges.teamChanges[t].rookies.push(rk.cname);
      }
    }
    LEAGUE_PLAYER_DATA[t] = newRoster;
  });

  // ── 合同初始化（一次性）──
  if (!STATE._contractsInited) {
    LEAGUE_TEAM_IDS.forEach(function(t) {
      (LEAGUE_PLAYER_DATA[t] || []).forEach(function(p) {
        if (p.contract === undefined) {
          var age = getLeaguePlayerAge(p);
          if (age <= 23) p.contract = 2 + Math.floor(rngNext() * 3);
          else if (age <= 26) p.contract = 2 + Math.floor(rngNext() * 2);
          else if (age <= 30) p.contract = 1 + Math.floor(rngNext() * 3);
          else if (age <= 33) p.contract = 1 + Math.floor(rngNext() * 2);
          else p.contract = 1;
        }
      });
    });
    STATE._contractsInited = true;
  }

  // ── 合同扣减 + 留队判定 + 到期剥离 ──
  var freeAgents = [];
  LEAGUE_TEAM_IDS.forEach(function(t) {
    var roster = LEAGUE_PLAYER_DATA[t];
    if (!roster) return;
    var newRoster = [];
    roster.forEach(function(p) {
      if (p.contract === undefined) p.contract = 4;
      p.contract--;
      if (p.contract <= 0) {
        // 留队判定
        var age = getLeaguePlayerAge(p);
        var hist = STATE._teamHistory ? STATE._teamHistory[t] : null;
        var roleContext = seasonRoleContexts[t + ':' + p.id];
        var stayRate = calculateContractStayRate(p, hist, roleContext);

        if (rngNext() < stayRate) {
          // 留队续约
          p.contract = randomContractByAge(age);
          var loyaltyChange = recordPlayerLoyaltyDecision(p, 'renew', p.contract, false, t);
          p._justSigned = true;
          newRoster.push(p);
          STATE._leagueChanges.stayed = STATE._leagueChanges.stayed || [];
          STATE._leagueChanges.stayed.push({ name: p.cname, playerId: p.id, team: t, years: p.contract, loyaltyChange: loyaltyChange });
        } else {
          // 离队进自由池
          p._origTeam = t;
          freeAgents.push(p);
          STATE._leagueChanges.freeAgents = STATE._leagueChanges.freeAgents || [];
          STATE._leagueChanges.freeAgents.push({ name: p.cname, playerId: p.id, ovr: p.ovr, team: t, age: age });
        }
      } else {
        newRoster.push(p);
      }
    });
    LEAGUE_PLAYER_DATA[t] = newRoster;
  });
  STATE._leagueChanges.freeAgentCount = freeAgents.length;
  STATE._freeAgentPool = freeAgents;
}

