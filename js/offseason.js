// 休赛期默认不输出逐候选日志，避免交易组合较多时阻塞主线程。
// 调试时可在控制台执行：window.__DEBUG_OFFSEASON__ = true
var OFFSEASON_DEBUG_PAIR_LIMIT = 24;

function isOffseasonDebugEnabled() {
  return (typeof window !== 'undefined' && window.__DEBUG_OFFSEASON__ === true)
    || (typeof STATE !== 'undefined' && STATE && STATE._debugOffseason === true);
}

function offseasonDebugLog() {
  if (!isOffseasonDebugEnabled() || typeof console === 'undefined' || typeof console.log !== 'function') return;
  console.log.apply(console, arguments);
}

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
  if (m.lastNonRenewalTeam == null) m.lastNonRenewalTeam = null;
  if (m.lastNonRenewalSeason == null) m.lastNonRenewalSeason = 0;
  if (m.renewalDecision == null) m.renewalDecision = null;
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

function hasRecentCareerStarHonor(seasonsBack) {
  var c = STATE.career;
  if (!c) return false;
  var currentSeason = Math.max(0, Number(c.seasonCount) || 0);
  var minSeason = Math.max(1, currentSeason - Math.max(1, Number(seasonsBack) || 1) + 1);
  return (c.honors || []).some(function(honor) {
    if (!honor) return false;
    var seasonNum = Number(honor.seasonNum) || 0;
    var label = String(honor.label || '');
    return seasonNum >= minSeason && seasonNum <= currentSeason
      && (label.indexOf('全明星') >= 0 || label.indexOf('最佳阵容') >= 0 || label.indexOf('MVP') >= 0);
  });
}

function isUserStarProtected() {
  var c = STATE.career;
  var ovr = Number(STATE.finalOVR) || 0;
  var age = Number(c && c.currentAge) || 22;
  if (ovr >= 88) return true;
  return ovr >= 82 && age <= 34 && hasRecentCareerStarHonor(2);
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
  var currentTeam = STATE.careerTeam || null;
  var currentSeason = Number(c.seasonCount) || 0;
  var cachedDecision = mobility && mobility.renewalDecision;
  if (cachedDecision
      && cachedDecision.team === currentTeam
      && Number(cachedDecision.season) === currentSeason) {
    return !!cachedDecision.willing;
  }
  function rememberDecision(willing) {
    if (mobility) {
      mobility.renewalDecision = {
        team: currentTeam,
        season: currentSeason,
        willing: !!willing
      };
    }
    return !!willing;
  }
  var ovr = STATE.finalOVR || 70;
  var age = c.currentAge || 22;
  var bench = !STATE.season.isUserStarter;
  if (ovr >= 85) return rememberDecision(true);
  if (ovr < 72) return rememberDecision(Math.random() < 0.35);
  var p = 0.86;
  if (age >= 33) p -= 0.16;
  if (bench) p -= 0.12;
  if (ovr < 78) p -= 0.12;
  if (getLastSeasonWinRate() < 0.45) p -= 0.08;
  return rememberDecision(Math.random() < Math.max(0.45, p));
}

function recordTeamNonRenewal() {
  var c = STATE.career;
  if (!c || (c.flags && c.flags.waived)) return false;
  c.flags = c.flags || {};
  var mobility = getMobility();
  if (!mobility) return false;
  var season = Number(c.seasonCount) || 0;
  if (mobility.lastNonRenewalTeam === STATE.careerTeam
      && Number(mobility.lastNonRenewalSeason) === season) return false;
  c.flags.nonRenewed = true;
  mobility.nonRenewals = (mobility.nonRenewals || 0) + 1;
  mobility.lastMove = 'non_renew';
  mobility.lastMoveSeason = season;
  mobility.lastNonRenewalTeam = STATE.careerTeam;
  mobility.lastNonRenewalSeason = season;
  setBranchNode('transfer', 'transfer_start');
  return true;
}

function isCareerTradePayrollLegal(destTeam) {
  if (!destTeam) return false;
  if (typeof FREE_AGENT_MARKET === 'undefined') return false;
  if (typeof STATE === 'undefined' || !STATE || !STATE.career || Number(STATE.career.contract) <= 0) return false;
  if (typeof getTeamPayroll !== 'function' || typeof getCareerPlayerSalary !== 'function') return false;
  var payrollAfter = getTeamPayroll(destTeam) + getCareerPlayerSalary();
  return payrollAfter <= FREE_AGENT_MARKET.secondApron + 0.001;
}

function pickTradeDestination() {
  var myPos = STATE.position;
  var candidates = [];
  LEAGUE_TEAM_IDS.forEach(function(t) {
    if (t === STATE.careerTeam) return;
    if (!isCareerTradePayrollLegal(t)) return;
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
      if (t !== STATE.careerTeam && isCareerTradePayrollLegal(t)) candidates.push({ team: t, score: 1 });
    });
  }
  if (!candidates.length) return null;
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
  html += '<div class="team-picker-header"><span>' + escapeNarrativeText(title) + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + renderNarrativeText(scene) + '</div>';
  html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
  choices.forEach(function(ch, ci) {
    html += '<button class="btn btn-secondary btn-sm" style="width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;" onclick="chooseMobilityChoice(' + ci + ')">' + escapeNarrativeText(ch.label) + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + renderNarrativeText(ch.hint || '') + '</span></button>';
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
  if (!isCareerTradePayrollLegal(destTeam)) {
    if (done) done();
    return;
  }
  STATE.careerTeam = destTeam;
  STATE.career.teamTenure = 1;
  if (typeof enforceCareerRosterCapacity === 'function') enforceCareerRosterCapacity(destTeam);
  if (typeof syncNarrativeAfterPlayerTeamChange === 'function') syncNarrativeAfterPlayerTeamChange(null, old);
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
    STATE._leagueChanges.trades.push({ from: old, to: destTeam, playerA: '选秀权', playerB: displayName });
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
  if (preferred && preferred !== STATE.careerTeam && LEAGUE_TEAM_IDS.indexOf(preferred) >= 0
      && isCareerTradePayrollLegal(preferred) && Math.random() < 0.8) {
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
  if (!isCareerTradePayrollLegal(destTeam)) {
    request.status = 'failed';
    request.failureReason = 'destination_payroll_cap';
    if (done) done();
    return;
  }

  var c = STATE.career;
  var m = getMobility();
  var displayName = getMyPlayerDisplayName();
  STATE.careerTeam = destTeam;
  STATE.career.teamTenure = 1;
  if (typeof enforceCareerRosterCapacity === 'function') enforceCareerRosterCapacity(destTeam);
  if (typeof syncNarrativeAfterPlayerTeamChange === 'function') syncNarrativeAfterPlayerTeamChange(null, old);
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
    STATE._leagueChanges.trades.push({ from: old, to: destTeam, playerA: '未来资产', playerB: displayName, requested: true });
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
  STATE.career.salary = 0;
  STATE.career._salaryVersion = FREE_AGENT_MARKET.salaryVersion;
  STATE.career.teamTenure = 0;
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
  return typeof getTeamCompetitiveRating === 'function'
    ? getTeamCompetitiveRating(p).total
    : (p.overall || 0);
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

  function decorateLegalContractOffers(rawOffers, maxRound) {
    var lastRound = maxRound == null ? 3 : maxRound;
    return rawOffers.map(function(offer) {
      var terms = getBestCareerContractOffer(offer.team, offer.years, lastRound);
      if (!terms) return null;
      offer.years = terms.years;
      offer.round = terms.round;
      offer.salary = terms.salary;
      offer.payroll = terms.payroll;
      offer.payrollAfterSigning = terms.payrollAfterSigning;
      offer.rosterCuts = terms.rosterCuts;
      offer.rosterCut = terms.rosterCut;
      offer.birdRights = terms.birdRights;
      offer.contractOffer = terms;
      if (terms.emergencyMinimum) offer.role = '一年底薪/替补';
      return offer;
    }).filter(Boolean);
  }

  // 必须先做工资帽/阵容合法性过滤，再按篮球层面的意愿排序；否则前四家
  // 中的非法球队会把后面真正能签约的球队提前截掉。
  var legalOffers = decorateLegalContractOffers(offers);
  if (legalOffers.length === 0) {
    // 兜底：只在“合法主报价确实为 0”时寻找替补/底薪下家。
    var fallbackOffers = [];
    LEAGUE_TEAM_IDS.forEach(function(t) {
      if (t === STATE.careerTeam || usedTeams[t]) return;
      if (fallbackOffers.length >= 2) return;
      var r = LEAGUE_PLAYER_DATA[t] || [];
      var lineup2 = calcTeamLineup(t);
      var s2 = lineup2.starters[myPos];
      if (s2 && (myOvr - s2.ovr) > 3) return;
      var st2 = STATE._prevStandings && STATE._prevStandings[t];
      var winRate2 = st2 ? (function(s) { var w = s.wins || 0, l = s.losses || 0; return (w + l) > 0 ? w / (w + l) : 0.5; })(st2) : 0.5;
      if (winRate2 > 0.65) return;
      var sr2 = r.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); }).slice(0, 2);
      var rRecruit = isSuperstarRecruitOfferTeam(t);
      fallbackOffers.push({ team: t, topTwo: sr2, years: 2, role: '底薪/替补', needStrength: s2 ? myOvr - s2.ovr : -5, score: -50 + (rRecruit ? 90 : 0), teamOvr: 0, bigMarket: false, superstarRecruit: rRecruit });
      usedTeams[t] = true;
    });
    if (fallbackOffers.length === 0) {
      // 极端情况先扩大到其他外部球队，后续仍统一做合法性过滤。
      LEAGUE_TEAM_IDS.forEach(function(t) {
        if (fallbackOffers.length >= 2) return;
        if (t === STATE.careerTeam || usedTeams[t]) return;
        var r3 = LEAGUE_PLAYER_DATA[t] || [];
        var sr3 = r3.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); }).slice(0, 2);
        var eRecruit = isSuperstarRecruitOfferTeam(t);
        fallbackOffers.push({ team: t, topTwo: sr3, years: 2, role: '底薪/替补', needStrength: -10, score: -80 + (eRecruit ? 90 : 0), teamOvr: 0, bigMarket: false, superstarRecruit: eRecruit });
        usedTeams[t] = true;
      });
    }
    legalOffers = decorateLegalContractOffers(fallbackOffers);
  }
  if (legalOffers.length === 0) {
    // 常规报价均不合法时，对所有外部球队尝试一年联盟底薪，
    // 仍然必须同时通过阵容人数与工资帽校验。
    var emergencyOffers = LEAGUE_TEAM_IDS.filter(function(t) {
      return t !== STATE.careerTeam;
    }).map(function(t) {
      var roster = LEAGUE_PLAYER_DATA[t] || [];
      var topTwo = roster.slice().sort(function(a, b) { return (b.ovr || 0) - (a.ovr || 0); }).slice(0, 2);
      var recruited = isSuperstarRecruitOfferTeam(t);
      return {
        team: t,
        topTwo: topTwo,
        years: 1,
        role: '一年底薪/替补',
        needStrength: -10,
        score: -100 - getTeamPayroll(t) + (recruited ? 90 : 0),
        teamOvr: 0,
        bigMarket: false,
        superstarRecruit: recruited
      };
    });
    legalOffers = decorateLegalContractOffers(emergencyOffers, 4);
  }
  legalOffers.sort(function(a, b) { return (b.score || b.needStrength) - (a.score || a.needStrength); });
  return legalOffers.slice(0, choice === 'short' ? 6 : 4);
}

function showContractOffers() {
  if (STATE.career && STATE.career.retired) {
    showMyCard();
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
  var renewalOffer = canRenew ? getBestCareerContractOffer(STATE.careerTeam, stayYears, 3) : null;
  if (canRenew && !renewalOffer) canRenew = false;
  if (!canRenew && !(c.flags && c.flags.waived)) {
    recordTeamNonRenewal();
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
    html += '<div class="team-pick-card" style="cursor:pointer;margin-bottom:6px;border-color:' + (choice === 'stay' ? '#ffd700' : 'var(--orange)') + ';" onclick="previewTeamRosterModal(\'' + STATE.careerTeam + '\', function(){ selectContractOption(\'' + STATE.careerTeam + '\', -1, ' + (renewalOffer ? renewalOffer.round : 0) + '); }, ' + stayYears + ')">';
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

    html += '<div class="team-pick-card" style="cursor:pointer;margin-bottom:6px;text-align:left;padding:10px;" onclick="previewTeamRosterModal(\'' + o.team + '\', function(){ selectContractOption(\'' + o.team + '\', ' + o.years + ', ' + (Number(o.round) || 0) + '); }, ' + o.years + ')">';
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
  var teamReviewAvg = typeof getPerGameStats === 'function' ? getPerGameStats(totals, gp) : null;
  var avgPts = teamReviewAvg ? teamReviewAvg.pts : (gp ? Math.round(totals.pts / gp * 10) / 10 : 0);
  var avgReb = teamReviewAvg ? teamReviewAvg.reb : (gp ? Math.round(totals.reb / gp * 10) / 10 : 0);
  var avgAst = teamReviewAvg ? teamReviewAvg.ast : (gp ? Math.round(totals.ast / gp * 10) / 10 : 0);
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
  html += '<div class="sr-section" style="text-align:left;margin-bottom:8px;"><div class="sr-section-title">📊 ' + oldName + '常规赛队内累计</div>';
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

function selectContractOption(team, years, round) {
  var modal = document.getElementById('contract-modal');
  if (modal) modal.remove();

  var oldTeam = STATE.careerTeam;
  var requestedYears = years > 0
    ? years
    : ((STATE.career.flags && STATE.career.flags.freeAgentChoice === 'stay') ? 3 : 2);
  var requestedRound = Math.max(0, Math.min(4, Number(round) || 0));
  var contractOffer = buildCareerContractOffer(team, requestedYears, requestedRound);
  if (!contractOffer || !applyCareerContractOffer(team, contractOffer, oldTeam)) {
    var reject = '这份合同没有通过当前工资帽与阵容名额校验，请重新选择一份合法报价。';
    if (typeof showOffseasonResultModal === 'function') {
      showOffseasonResultModal('合同未通过联盟规则', reject, function() { showContractOffers(); });
    } else {
      showContractOffers();
    }
    return;
  }
  var changedTeam = years > 0 && team !== oldTeam;
  STATE.careerTeam = team;
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
    if (typeof syncNarrativeAfterPlayerTeamChange === 'function') syncNarrativeAfterPlayerTeamChange(null, oldTeam);
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

function getCareerTeamOffseasonChanges(teamId) {
  var changes = STATE._leagueChanges || {};
  var team = String(teamId || '');
  var sameTeam = function(value) { return String(value || '') === team; };
  var stayedByPlayerId = {};
  (changes.stayed || []).forEach(function(row) {
    if (sameTeam(row.team) && row.playerId) stayedByPlayerId[String(row.playerId)] = true;
  });
  var returnedByPlayerId = {};
  (changes.freeSignings || []).forEach(function(row) {
    if (!sameTeam(row.to) || !row.playerId) return;
    if (row.returned || sameTeam(row.from)) returnedByPlayerId[String(row.playerId)] = true;
  });
  var trades = (changes.trades || []).filter(function(trade) {
    return sameTeam(trade.from) || sameTeam(trade.to);
  }).map(function(trade) {
    var fromTeam = sameTeam(trade.from);
    return {
      partner: fromTeam ? trade.to : trade.from,
      incoming: fromTeam ? trade.playerA : trade.playerB,
      outgoing: fromTeam ? trade.playerB : trade.playerA
    };
  });

  return {
    teamId: team,
    departures: (changes.freeAgents || []).filter(function(row) {
      if (!sameTeam(row.team)) return false;
      var playerId = row.playerId ? String(row.playerId) : '';
      // 同一休赛期先到期、后被母队回签时，最终状态是留队，不能再显示为离队。
      return !stayedByPlayerId[playerId] && !returnedByPlayerId[playerId];
    }),
    retired: (changes.retired || []).filter(function(row) { return sameTeam(row.team) && !isHiddenRetiredPlayer(row); }),
    signings: (changes.freeSignings || []).filter(function(row) { return sameTeam(row.to); }),
    renewals: (changes.stayed || []).filter(function(row) { return sameTeam(row.team); }),
    rookies: (changes.rookies || []).filter(function(row) { return sameTeam(row.team); }),
    trades: trades
  };
}

function showCareerTeamOffseasonChangesModal(callback) {
  callback = typeof callback === 'function' ? callback : function() {};
  var summary = getCareerTeamOffseasonChanges(STATE.careerTeam);
  var teamName = getTeamName ? getTeamName(summary.teamId) : summary.teamId;
  var old = document.getElementById('career-team-offseason-changes-modal');
  if (old) old.remove();

  function text(value) {
    return typeof escapeSeasonUiText === 'function'
      ? escapeSeasonUiText(value)
      : String(value == null ? '' : value);
  }

  function playerName(row, fallback) {
    return row && (row.name || row.displayName)
      || (row && row.playerId && typeof getPlayerDisplayName === 'function' ? getPlayerDisplayName(row.playerId) : '')
      || fallback || '球员';
  }

  function renderRow(icon, name, detail, value, tone) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--border-light);">' +
      '<span style="width:24px;height:24px;display:grid;place-items:center;border-radius:7px;background:' + (tone || 'var(--orange-bg)') + ';font-size:13px;flex-shrink:0;">' + icon + '</span>' +
      '<div style="min-width:0;flex:1;"><strong style="display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + text(name) + '</strong>' +
      '<small style="display:block;color:var(--text-dim);font-size:10px;margin-top:2px;line-height:1.35;">' + text(detail) + '</small></div>' +
      (value ? '<span style="font-size:11px;color:var(--text-dim);white-space:nowrap;">' + text(value) + '</span>' : '') +
      '</div>';
  }

  function renderSection(title, icon, rows) {
    if (!rows.length) return '';
    return '<section style="background:var(--bg-card);border:1px solid var(--border);border-radius:9px;padding:7px 10px;margin-bottom:8px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;font-family:var(--font-display);font-size:12px;color:var(--orange);padding:2px 0 4px;">' +
        '<span>' + icon + ' ' + title + '</span><span style="font-size:10px;color:var(--text-muted);">' + rows.length + ' 人/笔</span>' +
      '</div>' + rows.join('') + '</section>';
  }

  var departureRows = summary.departures.map(function(row) {
    var reason = row.reason === 'draft_cut' ? '选秀后裁员' : row.reason === 'superstar_roster_clear' ? '为签约腾出名额' : '合同到期/未续约';
    return renderRow('↗', playerName(row), reason, row.ovr != null ? 'OVR ' + row.ovr : '', 'rgba(230,57,70,.12)');
  });
  summary.retired.forEach(function(row) {
    departureRows.push(renderRow('⏹', playerName(row), '退役离开联盟', row.ovr != null ? 'OVR ' + row.ovr : '', 'rgba(120,120,120,.14)'));
  });

  var signingRows = summary.signings.map(function(row) {
    var detail = row.returned ? '自由市场回签' : '自由球员签约';
    if (row.years) detail += ' · ' + row.years + ' 年合同';
    return renderRow('↙', row.name || row.playerId, detail, row.ovr != null ? 'OVR ' + row.ovr : '', 'rgba(46,196,182,.14)');
  });
  summary.renewals.forEach(function(row) {
    var detail = '球队续约';
    if (row.years) detail += ' · ' + row.years + ' 年合同';
    signingRows.push(renderRow('↻', row.name || row.playerId, detail, '', 'rgba(46,196,182,.14)'));
  });
  summary.rookies.forEach(function(row) {
    var detail = row.undrafted ? '落选秀补充' : (row.pick ? '首轮第 ' + row.pick + ' 顺位' : '选秀加入');
    signingRows.push(renderRow('★', row.name || row.playerId, detail, row.ovr != null ? 'OVR ' + row.ovr : '', 'rgba(247,166,0,.16)'));
  });

  var tradeRows = summary.trades.map(function(row) {
    var partnerName = getTeamName ? getTeamName(row.partner) : row.partner;
    return renderRow('⇄', '与 ' + partnerName + ' 完成交易', '送出：' + playerName({ playerId: row.outgoing }, row.outgoing) + ' · 得到：' + playerName({ playerId: row.incoming }, row.incoming), '', 'rgba(247,166,0,.16)');
  });

  var totalChanges = departureRows.length + signingRows.length + tradeRows.length;
  var html = '<div class="team-picker-overlay" id="career-team-offseason-changes-modal">';
  html += '<div class="team-picker-modal" style="max-width:430px;">';
  html += '<div class="team-picker-header"><span>📋 我的球队人员变化</span><span style="font-size:10px;color:var(--text-muted);">自由市场结束</span></div>';
  html += '<div style="display:flex;align-items:center;gap:9px;padding:10px 12px;border-bottom:1px solid var(--border-light);">' + getTeamLogo(summary.teamId, 32) + '<div><strong style="display:block;font-size:15px;">' + text(teamName) + '</strong><small style="color:var(--text-dim);font-size:11px;">本次休赛期共 ' + totalChanges + ' 项人员变化</small></div></div>';
  html += '<div style="padding:8px 12px;max-height:58vh;overflow-y:auto;">';
  html += renderSection('离队', '↗', departureRows);
  html += renderSection('签约 / 新加入', '↙', signingRows);
  html += renderSection('交易', '⇄', tradeRows);
  if (!totalChanges) html += '<div style="text-align:center;padding:24px 8px;color:var(--text-muted);font-size:12px;">本次自由市场没有影响我球队的人员变化</div>';
  html += '</div><div style="padding:10px 12px 14px;text-align:center;border-top:1px solid var(--border-light);">';
  html += '<button class="btn btn-primary btn-sm" id="careerTeamOffseasonChangesContinue" style="width:100%;">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('careerTeamOffseasonChangesContinue').onclick = function() {
    var modal = document.getElementById('career-team-offseason-changes-modal');
    if (modal) modal.remove();
    callback();
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
    var pPos = escapeSeasonUiText(p.posCn || p.pos || '—');
    var pName = escapeSeasonUiText(p.cname);
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
  // 本届选秀已经结算并写入 draftHistory；新赛季不能携带旧的流程状态。
  delete STATE.offseasonDraft;
  _rngState = null;
  var oldTeam = STATE.careerTeam;
  var configuredEngine = (STATE.season && STATE.season.simulationEngine) || STATE.simulationEngine;
  var simulationEngine = configuredEngine === 'v1' ? 'v1' : 'v2';
  STATE.simulationEngine = simulationEngine;
  var seasonMods = typeof consumeNextSeasonMods === 'function'
    ? consumeNextSeasonMods()
    : getNextSeasonMods();
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
    mods: typeof createSeasonModifierState === 'function' ? createSeasonModifierState(seasonMods) : seasonMods,
    simulationEngine: simulationEngine,
    events: typeof createSeasonEventState === 'function'
      ? createSeasonEventState(seasonMods.injuryRiskBonus || 0)
      : { suspensionGamesLeft:0, suspensionReason:'', injuryGamesLeft:0, injuryReason:'', triggeredIds:[], storyTimeline:[], lastTriggerGameNum:null, playoffEventCount:0, injuryRiskBonus: seasonMods.injuryRiskBonus || 0, majorInjuryThisSeason:false, playThroughPrompted:{}, regularPlayThroughPromptCount:0 },
  };
  STATE.careerTeam = oldTeam;
  if (STATE.career && STATE.career.flags) delete STATE.career.flags.startBench;
  syncUserStarterStatus();
  initStandings();
  buildRealSchedule();
  if (typeof initializeSeasonNarrative === 'function') initializeSeasonNarrative();

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
        // 所有选秀球员至少有三年新秀合同，避免尚未取得母队续约权就过早失业。
        contract: pk.pick <= 14 ? 4 : 3,
        loyalty: inferPlayerLoyalty('D26-' + pad),
        _awardStreak: {},
        _justSigned: true,
      };
      if (fixedRating) {
        rookie._rookieProfile = fixedRating.profile;
        rookie._rookieGenerationVersion = ROOKIE_ATTRIBUTE_PROFILE_VERSION;
        rookie._rookieSeason = getCurrentLeagueSeasonNumber();
        ATTR_KEYS.forEach(function(key) {
          rookie[key] = fixedRating.attributes[key];
        });
        syncAuthoredRookieOvr(rookie);
      } else {
        applyRookieAttributeProfile(rookie, ovr, Math.random);
      }
      rookie._draftOvr = Number(rookie.ovr) || ovr;
      rookie._rookieSeason = getCurrentLeagueSeasonNumber();
      roster.push(rookie);
    });
  });
  enforceLeagueRosterCapacity(null, { reason: 'draft_class_capacity' });
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
  if (typeof prepareScheduledStarRookiesForDraft === 'function') prepareScheduledStarRookiesForDraft();
  var targetOvrs = buildGeneratedDraftOvrTargets(teams.length, rngNext);
  teams.forEach(function(t, idx) {
    var rookie = generateRookie();
    // 当届新秀只在本次休赛期受交易保护，下一休赛期会统一解除。
    rookie._justSigned = true;
    var targetOvr = targetOvrs[idx] || 60;
    prepareDraftProspectForTarget(rookie, targetOvr, rngNext);
    var rookieGene = getPlayerGene(rookie);
    rookieGene.potential = inferLeaguePlayerPotential(rookie, getLeaguePlayerAge(rookie));
    rookieGene.potentialVersion = PLAYER_POTENTIAL_MODEL_VERSION;
    // 新秀合同
    if (idx < 5) rookie.contract = 4;
    else rookie.contract = 3;
    rookie.loyalty = getRookieContractLoyalty(rookie.contract);

    var roster = LEAGUE_PLAYER_DATA[t];
    if (!roster) return;
    roster.push(rookie);
  });
  if (typeof enforceLeagueRosterCapacity === 'function') {
    enforceLeagueRosterCapacity(null, { reason: 'post_draft_capacity' });
  }
}

// ==================== 自由球员系统 ====================
// 这是一个隐藏的薪资单位，而不是现实货币。工资用于体现市场价值和球队成本，
// 但不会作为自由市场签约/续约的硬性资格门槛；阵容名额仍然严格限制。
var FREE_AGENT_MARKET = {
  rosterLimit: 18,
  externalNinetyPlusLimit: 3,
  softCap: 100,
  taxLine: 120,
  firstApron: 127,
  secondApron: 134,
  // 市场报价和既有合同是两套数值：初始名单使用折价合同，只有签约/续约
  // 才会把当期市场报价写入 salary。这样重建的 30 队会保留真实的工资空间，
  // 顶薪球员也不会因为全联盟都被“今天的身价”填满而失去外部报价。
  initialSalaryScale: 0.55,
  rookieSalaryScale: 0.45,
  salaryVersion: 2,
  demandMultipliers: [1.00, 0.92, 0.82, 0.70]
};

function clampFreeAgentValue(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function getPlayerMarketTier(player) {
  var ovr = Number(player && player.ovr) || 0;
  if (ovr >= 94) return 'SUPERSTAR';
  if (ovr >= 90) return 'ALL_STAR';
  if (ovr >= 86) return 'STAR';
  if (ovr >= 82) return 'STARTER';
  if (ovr >= 78) return 'ROTATION';
  if (ovr >= 73) return 'ROLE';
  return 'FRINGE';
}

function getPlayerMarketPerformanceBonus(player) {
  var stats = typeof STATE !== 'undefined' && STATE.season && STATE.season.leaguePlayerSeasonStats;
  if (!stats || !player || !player.id) return 0;
  var row = null;
  var preferredKey = player._lastTeam ? player._lastTeam + ':' + player.id : '';
  if (preferredKey && stats[preferredKey]) row = stats[preferredKey];
  if (!row) {
    Object.keys(stats).some(function(key) {
      if (String(key).slice(-String(player.id).length - 1) === ':' + player.id) {
        row = stats[key];
        return true;
      }
      return false;
    });
  }
  var gp = Number(row && (row.gp || row.games)) || 0;
  if (gp < 10) return 0;
  var ppg = (Number(row.pts) || 0) / gp;
  var apg = (Number(row.ast) || 0) / gp;
  var rpg = (Number(row.reb) || 0) / gp;
  return clampFreeAgentValue((ppg - 12) * 0.04 + (apg - 3) * 0.03 + (rpg - 5) * 0.02, -1.5, 1.5);
}

/** 返回每年薪资单位；OVR 只提供基准，年龄和上一季角色会做小幅修正。 */
function getPlayerMarketValue(player) {
  var ovr = clampFreeAgentValue(player && player.ovr, 55, 99);
  var value;
  if (ovr >= 94) value = 27 + (ovr - 94) * 1.25;
  else if (ovr >= 90) value = 22 + (ovr - 90) * 1.67;
  else if (ovr >= 86) value = 16 + (ovr - 86) * 2;
  else if (ovr >= 82) value = 11 + (ovr - 82) * 1.25;
  else if (ovr >= 78) value = 7 + (ovr - 78) * 1;
  else if (ovr >= 73) value = 4 + (ovr - 73) * 0.75;
  else value = 1 + Math.max(0, ovr - 60) * 0.23;

  var age = typeof getLeaguePlayerAge === 'function' ? getLeaguePlayerAge(player) : Number(player && player._age) || 27;
  if (age >= 26 && age <= 31) value += 0.6;
  else if (age >= 32) value -= Math.min(4, (age - 31) * 0.7);
  else if (age <= 22) value -= 0.6;

  if (player && player._lastRoleStarter) value += 0.35;
  if (player && Number(player._lastRoleMpg) >= 28) value += 0.35;
  value += getPlayerMarketPerformanceBonus(player);
  return Math.round(clampFreeAgentValue(value, 1, 32) * 10) / 10;
}

function isGeneratedOrRookiePlayer(player) {
  if (!player) return false;
  var id = String(player.id || '');
  return player.type === '新秀' || !!player._prospectId || /^R\d+$/.test(id) || /^D\d{2}-\d+$/.test(id);
}

function getInitialContractSalary(player, options) {
  if (!player) return 0;
  var marketValue = getPlayerMarketValue(player);
  var age = typeof getLeaguePlayerAge === 'function'
    ? getLeaguePlayerAge(player)
    : Number(player._age) || 27;
  var rookie = !!(options && options.rookie) || isGeneratedOrRookiePlayer(player);
  var scale = rookie ? FREE_AGENT_MARKET.rookieSalaryScale : FREE_AGENT_MARKET.initialSalaryScale;
  if (!rookie && age >= 34) scale -= 0.05;
  if (!rookie && age <= 22) scale -= 0.05;
  return Math.round(clampFreeAgentValue(marketValue * scale, 1, 24) * 10) / 10;
}

function getPlayerSalary(player) {
  if (!player) return 0;
  var saved = Number(player.salary);
  if (player._salaryVersion === FREE_AGENT_MARKET.salaryVersion && Number.isFinite(saved) && saved >= 0) return saved;

  // 旧存档中的 salary 是按市场价懒初始化的，不能继续把它当作已签合同。
  // 迁移只发生一次，并写入版本标记；新签约/续约也会显式写入同一标记。
  var salary = getInitialContractSalary(player);
  player.salary = salary;
  player._salaryVersion = FREE_AGENT_MARKET.salaryVersion;
  return salary;
}

function getCareerPlayerContractSnapshot() {
  if (typeof STATE === 'undefined' || !STATE || !STATE.career || !STATE.careerTeam || !STATE.finalOVR) return null;
  var attrs = STATE.attrs && typeof STATE.attrs === 'object' ? STATE.attrs : {};
  var playerStats = STATE.season && STATE.season.playerStats && typeof STATE.season.playerStats === 'object'
    ? STATE.season.playerStats
    : {};
  var games = Number(playerStats.games) || 0;
  var totalMinutes = Number(playerStats.mins) || 0;
  var player = {
    id: '__CAREER_PLAYER__',
    cname: typeof getMyPlayerDisplayName === 'function' ? getMyPlayerDisplayName() : '我的球员',
    ovr: Number(STATE.finalOVR) || 60,
    pos: STATE.position || 'SF',
    _age: Number(STATE.career.currentAge) || 18,
    _isUser: true,
    _lastRoleStarter: !!(STATE.season && STATE.season.isUserStarter),
    _lastRoleMpg: games > 0 ? totalMinutes / games : 0
  };
  Object.keys(attrs).forEach(function(key) { player[key] = attrs[key]; });
  if (Number.isFinite(Number(STATE.career.salary)) && Number(STATE.career.salary) >= 0) player.salary = Number(STATE.career.salary);
  return player;
}

function ensureCareerPlayerContract(forceRookie) {
  if (typeof STATE === 'undefined' || !STATE || !STATE.career || !STATE.careerTeam || !STATE.finalOVR) return 0;
  var career = STATE.career;
  var saved = Number(career.salary);
  if (career._salaryVersion === FREE_AGENT_MARKET.salaryVersion
      && Number.isFinite(saved)
      && (saved > 0 || Number(career.contract) <= 0)) return saved;
  var snapshot = getCareerPlayerContractSnapshot();
  var salary = getInitialContractSalary(snapshot, {
    rookie: !!forceRookie || ((Number(career.seasonCount) || 0) === 0 && !(career.flags && career.flags.draftDone))
  });
  career.salary = salary;
  career._salaryVersion = FREE_AGENT_MARKET.salaryVersion;
  return salary;
}

function getCareerPlayerSalary() {
  return ensureCareerPlayerContract(false);
}

function getTeamRosterCount(teamId) {
  var count = (LEAGUE_PLAYER_DATA[teamId] || []).length;
  var userActive = typeof STATE !== 'undefined' && STATE && STATE.career && !STATE.career.retired
    && STATE.careerTeam === teamId && Number(STATE.career.contract) > 0 && Number(STATE.finalOVR) > 0;
  return count + (userActive ? 1 : 0);
}

// 外部自由市场签约最多只能为一队带来第 4 名 90+ 球员；
// 原队回签、常规续约和后续成长均不受此规则影响，避免强拆既有核心。
function getTeamNinetyPlusCount(teamId) {
  var count = (LEAGUE_PLAYER_DATA[teamId] || []).reduce(function(sum, player) {
    return sum + ((Number(player && player.ovr) || 0) >= 90 ? 1 : 0);
  }, 0);
  var userActive = typeof STATE !== 'undefined' && STATE && STATE.career && !STATE.career.retired
    && STATE.careerTeam === teamId && Number(STATE.career.contract) > 0 && Number(STATE.finalOVR) > 0;
  if (userActive && Number(STATE.finalOVR) >= 90) count++;
  return count;
}

function isExternalFreeAgentSigning(player, teamId) {
  return !!player && player._origTeam !== teamId;
}

function getTeamPayrollExcludingPlayer(teamId, excludedPlayer) {
  var total = (LEAGUE_PLAYER_DATA[teamId] || []).reduce(function(sum, player) {
    if (player === excludedPlayer) return sum;
    return sum + getPlayerSalary(player);
  }, 0);
  var user = getCareerPlayerContractSnapshot();
  var userActive = user && STATE.career && !STATE.career.retired && Number(STATE.career.contract) > 0;
  if (userActive && teamId === STATE.careerTeam && excludedPlayer !== user && !(excludedPlayer && excludedPlayer._isUser)) {
    total += getCareerPlayerSalary();
  }
  return Math.round(total * 10) / 10;
}

function getTeamPayroll(teamId) {
  return getTeamPayrollExcludingPlayer(teamId, null);
}

function hasFreeAgentBirdRights(player, teamId) {
  if (!player || !teamId) return false;
  var tenure = Number(player._teamTenure) || 0;
  return tenure >= 3 && (player._birdTeam === teamId || player._origTeam === teamId || player._lastTeam === teamId);
}

function randomContractByAge(age, player, options) {
  var p = player || {};
  var ovr = Number(p.ovr) || 0;
  var years;
  if (ovr >= 94 && age <= 31) years = 4 + Math.floor(rngNext() * 2);
  else if (ovr >= 90 && age <= 31) years = 3 + Math.floor(rngNext() * 2);
  else if (ovr >= 86 && age <= 33) years = 2 + Math.floor(rngNext() * 3);
  else if (ovr >= 82 && age >= 27 && age <= 32) years = 2 + Math.floor(rngNext() * 3);
  else if (age <= 23) years = 2 + Math.floor(rngNext() * 3);
  else if (age <= 26) years = 2 + Math.floor(rngNext() * 2);
  else if (age <= 33) years = 1 + Math.floor(rngNext() * 3);
  else years = 1 + Math.floor(rngNext() * 2);

  var maxYears = options && options.birdRights ? 5 : 4;
  if (age >= 34) maxYears = Math.min(maxYears, 3);
  return Math.max(1, Math.min(maxYears, years));
}

function getFreeAgentContractYears(player, round, birdRights) {
  var age = typeof getLeaguePlayerAge === 'function' ? getLeaguePlayerAge(player) : Number(player && player._age) || 27;
  var years = randomContractByAge(age, player, { birdRights: birdRights });
  if (round >= 2 && Number(player && player.ovr) >= 86) years = Math.max(2, years - 1);
  if (round >= 3 && Number(player && player.ovr) < 86) years = 1;
  return birdRights ? Math.min(5, years) : Math.min(4, years);
}

function getFreeAgentSalaryDemand(player, round) {
  var multiplier = FREE_AGENT_MARKET.demandMultipliers[Math.max(0, Math.min(3, Number(round) || 0))];
  return Math.round(Math.max(1, getPlayerMarketValue(player) * multiplier) * 10) / 10;
}

function getFreeAgentRound(player) {
  var ovr = Number(player && player.ovr) || 0;
  if (ovr >= 90) return 0;
  if (ovr >= 84) return 1;
  if (ovr >= 77) return 2;
  return 3;
}

// 简化版受限制自由球员：年轻主力即使母队不主动续约，也不会在自由市场结束后
// 因为阵容算法而直接失业。母队保有最后的回签机会。
function isYoungCoreFreeAgent(player) {
  if (!player) return false;
  var age = typeof getLeaguePlayerAge === 'function'
    ? getLeaguePlayerAge(player)
    : Number(player._age) || 99;
  return age <= 24 && (Number(player.ovr) || 0) >= 84;
}

function getCareerTeamTenure() {
  if (typeof STATE === 'undefined' || !STATE || !STATE.career) return 0;
  var team = STATE.careerTeam;
  if (!team) return 0;
  var seasons = Array.isArray(STATE.career.seasons) ? STATE.career.seasons : [];
  var tenure = 0;
  for (var i = seasons.length - 1; i >= 0; i--) {
    if (seasons[i] && seasons[i].team === team) tenure++;
    else break;
  }
  // teamTenure 只作为没有历史赛季记录的旧存档/新入队状态的兜底；
  // 一旦存在历史记录，以连续同队赛季为准，避免旧值 1 永久阻断 Bird Rights。
  return tenure > 0 ? tenure : Math.max(1, Number(STATE.career.teamTenure) || 1);
}

function hasCareerPlayerBirdRights(teamId) {
  return !!teamId && teamId === (typeof STATE !== 'undefined' && STATE ? STATE.careerTeam : null) && getCareerTeamTenure() >= 3;
}

function isContractRetentionSource(source) {
  return source === 'retention' || source === 'career_retention';
}

/**
 * 统一 NPC/玩家续约与自由签约的合同条款和工资合法性。
 * source=retention 时会排除球员当前合同；source=career_retention 同理排除玩家工资。
 */
function buildContractOffer(player, teamId, options) {
  options = options || {};
  if (!player || !teamId) return null;
  var source = options.source || 'free_agent';
  var isRetention = isContractRetentionSource(source);
  var birdRights = options.birdRights != null
    ? !!options.birdRights
    : (player._isUser ? hasCareerPlayerBirdRights(teamId) : hasFreeAgentBirdRights(player, teamId));
  var round = Math.max(0, Math.min(3, Number(options.round) || 0));
  var salary = options.salary != null
    ? Math.round(Math.max(1, Number(options.salary) || 1) * 10) / 10
    : getFreeAgentSalaryDemand(player, round);
  var years = options.years != null
    ? Math.max(1, Math.round(Number(options.years) || 1))
    : getFreeAgentContractYears(player, round, birdRights);
  years = Math.min(birdRights ? 5 : 4, years);
  if (getLeaguePlayerAge(player) >= 34) years = Math.min(3, years);

  var roster = LEAGUE_PLAYER_DATA[teamId] || (LEAGUE_PLAYER_DATA[teamId] = []);
  var payrollBefore = getTeamPayrollExcludingPlayer(teamId, isRetention ? player : null);
  var rosterCuts = [];
  var payrollAfterCut = payrollBefore;
  var userIncomingCount = player._isUser && teamId !== STATE.careerTeam ? 1 : 0;
  var rosterTarget = Math.max(0, getLeagueRosterNpcLimit(teamId) - userIncomingCount);
  var incomingNpcCount = player._isUser ? 0 : 1;
  var minimumRoster = Math.min(rosterTarget, 12);
  var cutCandidates = [];
  if (!isRetention) {
    var preferredCandidates = getFreeAgentRosterCutCandidates(teamId, false);
    var fallbackCandidates = getFreeAgentRosterCutCandidates(teamId, true);
    var seenCandidates = {};
    preferredCandidates.concat(fallbackCandidates).forEach(function(candidate) {
      var key = String(candidate && (candidate.id || candidate.cname) || '');
      if (!candidate || candidate === player || (key && seenCandidates[key])) return;
      if (key) seenCandidates[key] = true;
      cutCandidates.push(candidate);
    });
  }

  function rosterNeedsCut() {
    return roster.length - rosterCuts.length + incomingNpcCount > rosterTarget;
  }

  function takeNextRosterCutCandidate() {
    if (!player._isUser) return cutCandidates.shift();
    var eligibleIndices = [];
    cutCandidates.forEach(function(candidate, index) {
      // 玩家加盟不能靠直接裁掉另一名核心完成；高 OVR 合同应留给交易系统处理。
      if ((Number(candidate && candidate.ovr) || 0) < 88) eligibleIndices.push(index);
    });
    if (!eligibleIndices.length) return null;
    return cutCandidates.splice(eligibleIndices[0], 1)[0];
  }

  // 工资帽不再阻断报价；只有球队满员时才会腾出阵容位置。
  while (!isRetention && rosterNeedsCut()) {
    var candidate = takeNextRosterCutCandidate();
    if (!candidate) break;
    // 不为签下一名同等或更低评分的球员裁掉现有球员。
    if (!player._isUser && (Number(candidate.ovr) || 0) >= (Number(player.ovr) || 0)) break;
    if (roster.length - rosterCuts.length - 1 < minimumRoster) break;
    rosterCuts.push(candidate);
    payrollAfterCut -= getPlayerSalary(candidate);
  }

  if (!isRetention && rosterNeedsCut()) return null;

  var totalAfterSigning = payrollAfterCut + salary;
  return {
    teamId: teamId,
    salary: salary,
    years: years,
    round: round,
    payroll: payrollAfterCut,
    payrollAfterSigning: totalAfterSigning,
    birdRights: birdRights,
    rosterCuts: rosterCuts,
    rosterCut: rosterCuts[0] || null,
    source: source,
    // 保留这个字段给现有 UI/调用方；工资帽不再决定报价是否合法。
    capLegal: true,
    rosterCount: roster.length
  };
}

function buildCareerContractOffer(teamId, years, round) {
  var player = getCareerPlayerContractSnapshot();
  if (!player) return null;
  var isCurrentTeam = teamId === STATE.careerTeam;
  if (isCurrentTeam && STATE.career.flags && STATE.career.flags.waived) return null;
  var requestedRound = Math.max(0, Math.min(4, Number(round) || 0));
  var emergencyMinimum = requestedRound === 4;
  var offer = buildContractOffer(player, teamId, {
    source: isCurrentTeam ? 'career_retention' : 'career_external',
    years: emergencyMinimum ? 1 : years,
    salary: emergencyMinimum ? 1 : null,
    birdRights: hasCareerPlayerBirdRights(teamId),
    round: Math.min(3, requestedRound)
  });
  if (offer && emergencyMinimum) {
    offer.round = 4;
    offer.emergencyMinimum = true;
  }
  return offer;
}

function getBestCareerContractOffer(teamId, years, maxRound) {
  var requestedRound = maxRound == null ? 3 : Number(maxRound);
  if (!Number.isFinite(requestedRound)) requestedRound = 3;
  var lastRound = Math.max(0, Math.min(4, requestedRound));
  for (var round = 0; round <= lastRound; round++) {
    var offer = buildCareerContractOffer(teamId, years, round);
    if (offer) return offer;
  }
  return null;
}

function applyCareerContractOffer(teamId, offer, oldTeam) {
  if (!offer || !STATE.career || !teamId || offer.teamId !== teamId) return false;
  var salary = Number(offer.salary);
  var years = Number(offer.years);
  if (!Number.isFinite(salary) || salary < 1 || !Number.isInteger(years) || years < 1) return false;
  var maxYears = offer.birdRights ? 5 : 4;
  if ((Number(STATE.career.currentAge) || 0) >= 34) maxYears = Math.min(maxYears, 3);
  if (years > maxYears) return false;

  var roster = LEAGUE_PLAYER_DATA[teamId];
  if (!Array.isArray(roster)) return false;
  var rosterCuts = Array.isArray(offer.rosterCuts)
    ? offer.rosterCuts.slice()
    : (offer.rosterCut ? [offer.rosterCut] : []);
  if (rosterCuts.length) {
    var validatedCuts = [];
    if (rosterCuts.some(function(player) {
      if (!player || roster.indexOf(player) < 0 || validatedCuts.indexOf(player) >= 0) return true;
      validatedCuts.push(player);
      return false;
    })) return false;
    rosterCuts.forEach(function(player) {
      roster.splice(roster.indexOf(player), 1);
      player._waived = true;
      addPlayerToFreeAgentPool(player, 'career_contract_capacity', teamId);
    });
  }
  STATE.career.salary = salary;
  STATE.career._salaryVersion = FREE_AGENT_MARKET.salaryVersion;
  STATE.career.contract = years;
  if (teamId !== oldTeam) STATE.career.teamTenure = 1;
  else STATE.career.teamTenure = Math.max(1, getCareerTeamTenure()) + 1;
  if (typeof clearLineupCache === 'function') clearLineupCache();
  return true;
}

function addPlayerToFreeAgentPool(player, reason, teamId) {
  if (!player) return;
  STATE._freeAgentPool = Array.isArray(STATE._freeAgentPool) ? STATE._freeAgentPool : [];
  var id = String(player.id || player.cname || '');
  if (id && STATE._freeAgentPool.some(function(current) { return String(current && (current.id || current.cname) || '') === id; })) return;
  player._origTeam = teamId || player._origTeam;
  player._lastTeam = teamId || player._lastTeam;
  player._teamTenure = 1;
  player.contract = 0;
  delete player.salary;
  STATE._freeAgentPool.push(player);
  STATE._leagueChanges = STATE._leagueChanges || {};
  STATE._leagueChanges.freeAgents = STATE._leagueChanges.freeAgents || [];
  STATE._leagueChanges.freeAgents.push({
    name: player.cname,
    playerId: player.id,
    ovr: player.ovr,
    team: teamId || 'FA',
    age: getLeaguePlayerAge(player),
    reason: reason || 'roster_capacity'
  });
}

function getLeagueRosterNpcLimit(teamId) {
  var userActive = typeof STATE !== 'undefined' && STATE && STATE.career && !STATE.career.retired
    && STATE.careerTeam === teamId && Number(STATE.career.contract) > 0 && Number(STATE.finalOVR) > 0;
  return Math.max(0, FREE_AGENT_MARKET.rosterLimit - (userActive ? 1 : 0));
}

/** 全联盟统一名单上限；被挤出的球员进入 FA 池，不允许静默丢失。 */
function enforceLeagueRosterCapacity(teamId, options) {
  if (typeof LEAGUE_PLAYER_DATA === 'undefined') return 0;
  options = options || {};
  var teams = teamId
    ? [teamId]
    : (typeof LEAGUE_TEAM_IDS !== 'undefined' ? LEAGUE_TEAM_IDS.slice() : []);
  var reason = options.reason || 'roster_capacity';
  var totalCuts = 0;
  teams.forEach(function(team) {
    var roster = LEAGUE_PLAYER_DATA[team] || (LEAGUE_PLAYER_DATA[team] = []);
    var npcLimit = getLeagueRosterNpcLimit(team);
    while (roster.length > npcLimit) {
      // 先保护本休赛期刚签/刚选中的球员；只有全队都处于保护期时才允许兜底裁掉。
      var cut = getFreeAgentRosterCutCandidate(team, false) || getFreeAgentRosterCutCandidate(team, true);
      if (!cut) break;
      var index = roster.indexOf(cut);
      if (index < 0) break;
      roster.splice(index, 1);
      cut._waived = true;
      addPlayerToFreeAgentPool(cut, reason, team);
      totalCuts++;
    }
  });
  if (totalCuts && typeof clearLineupCache === 'function') clearLineupCache();
  return totalCuts;
}

function enforceCareerRosterCapacity(teamId) {
  return enforceLeagueRosterCapacity(teamId, { reason: 'career_roster_capacity' });
}

function getLeagueAttributeKeys() {
  if (typeof ATTR_KEYS !== 'undefined' && Array.isArray(ATTR_KEYS) && ATTR_KEYS.length) return ATTR_KEYS;
  if (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG && Array.isArray(SIM_CONFIG.ATTR_LIST) && SIM_CONFIG.ATTR_LIST.length) return SIM_CONFIG.ATTR_LIST;
  return ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'ATH', 'STR', 'REB', 'PDEF', 'IDEF', 'STL', 'BLK', 'CLU'];
}

var LEAGUE_POSITION_DEVELOPMENT = {
  PG: { primary: ['HAN','PAS','threePT','MID','ATH'], slow: ['IDEF','BLK','REB','STR'] },
  SG: { primary: ['threePT','MID','FIN','HAN','ATH','PDEF','STL'], slow: ['IDEF','BLK','REB','PAS'] },
  SF: { primary: ['FIN','PDEF','STL','ATH','STR','threePT'], slow: ['BLK','PAS'] },
  PF: { primary: ['FIN','IDEF','REB','STR','PDEF','MID'], slow: ['HAN','PAS','threePT'] },
  C:  { primary: ['FIN','IDEF','BLK','REB','STR'], slow: ['threePT','MID','HAN','PAS','PDEF'] }
};

function getLeaguePlayerDevelopmentProfile(player) {
  if (isGeneratedLeaguePlayer(player) && typeof getRookieProfile === 'function') {
    var rookieProfile = getRookieProfile(player);
    return { primary: rookieProfile.strengths.slice(), slow: rookieProfile.weaknesses.slice() };
  }
  var pos = String(player && player.pos || '').split('/')[0].trim();
  return LEAGUE_POSITION_DEVELOPMENT[pos] || LEAGUE_POSITION_DEVELOPMENT.SF;
}

/**
 * 目标 OVR 只用于表达本季成长方向和强度。属性先按位置/角色显式演变；
 * 所有球员以当前公式 OVR 为成长基准；来源 OVR 仅供审计，
 * 不参与成长结果。属性不会为命中目标反向改写。
 */
function applyLeaguePlayerAttributeRound(player, profile, direction, roundMagnitude, options) {
  var generatedPlayer = options.generatedPlayer;
  var age = options.age;
  var cap = options.cap;
  var declineFast = options.declineFast;
  var declineResist = options.declineResist;
  getLeagueAttributeKeys().forEach(function(attrKey) {
    var current = Number(player[attrKey]);
    if (!Number.isFinite(current)) return;
    var attrMagnitude;
    if (direction > 0) {
      if (profile.primary.indexOf(attrKey) >= 0) {
        attrMagnitude = roundMagnitude;
      } else if (profile.slow.indexOf(attrKey) >= 0) {
        attrMagnitude = generatedPlayer ? 0 : Math.max(0, roundMagnitude - 1);
      } else {
        attrMagnitude = generatedPlayer ? 0 : Math.max(0, roundMagnitude - 1);
      }
    } else {
      if (age >= 29 && declineFast.indexOf(attrKey) >= 0) attrMagnitude = Math.min(2, roundMagnitude + 1);
      else if (declineResist.indexOf(attrKey) >= 0) attrMagnitude = Math.max(0, roundMagnitude - 1);
      else attrMagnitude = roundMagnitude;
    }
    player[attrKey] = Math.max(25, Math.min(99, Math.round(current + direction * attrMagnitude)));
  });
}

function rollbackLeaguePlayerAttributesToFormulaLimit(player, profile, beforeAttributes, beforeFormulaOvr, direction, limit, targetFormulaOvr) {
  if (typeof calcOVR !== 'function') return Number(beforeFormulaOvr) || 0;
  var primaryKeys = profile.primary.slice();
  var slowKeys = profile.slow.slice();
  var neutralKeys = getLeagueAttributeKeys().filter(function(key) {
    return primaryKeys.indexOf(key) < 0 && slowKeys.indexOf(key) < 0;
  });
  var rollbackOrder = neutralKeys.concat(slowKeys, primaryKeys);
  var afterFormulaOvr = calcOVR(player, player.pos);
  var guard = 0;
  function exceedsLimit() {
    if (Number.isFinite(Number(targetFormulaOvr))) {
      return (direction > 0 && afterFormulaOvr > targetFormulaOvr)
        || (direction < 0 && afterFormulaOvr < targetFormulaOvr);
    }
    var formulaDelta = afterFormulaOvr - beforeFormulaOvr;
    if (direction > 0) return formulaDelta > limit;
    if (direction < 0) return formulaDelta < -limit;
    return false;
  }
  while (exceedsLimit() && guard++ < 240) {
    var adjusted = false;
    for (var rollbackIndex = 0; rollbackIndex < rollbackOrder.length; rollbackIndex++) {
      var rollbackKey = rollbackOrder[rollbackIndex];
      var currentValue = Number(player[rollbackKey]);
      var originalValue = Number(beforeAttributes[rollbackKey]);
      if (!Number.isFinite(currentValue) || !Number.isFinite(originalValue)) continue;
      if (direction > 0 && currentValue > originalValue) {
        player[rollbackKey] = currentValue - 1;
        adjusted = true;
      } else if (direction < 0 && currentValue < originalValue) {
        player[rollbackKey] = currentValue + 1;
        adjusted = true;
      }
      if (adjusted) {
        afterFormulaOvr = calcOVR(player, player.pos);
        break;
      }
    }
    if (!adjusted) break;
  }
  return afterFormulaOvr;
}

function completeLeaguePlayerDeclineToFormulaTarget(player, beforeAttributes, targetFormulaOvr, declineFast, declineResist) {
  if (typeof calcOVR !== 'function') return Number(player && player.ovr) || 0;
  var afterFormulaOvr = calcOVR(player, player.pos);
  if (afterFormulaOvr <= targetFormulaOvr) return afterFormulaOvr;

  var keys = getLeagueAttributeKeys();
  var neutralKeys = keys.filter(function(key) {
    return declineFast.indexOf(key) < 0 && declineResist.indexOf(key) < 0;
  });
  var declineOrder = declineFast.concat(neutralKeys, declineResist);
  var guard = 0;
  while (afterFormulaOvr > targetFormulaOvr && guard++ < declineOrder.length) {
    var key = declineOrder[guard - 1];
    var current = Number(player[key]);
    var original = Number(beforeAttributes[key]);
    if (!Number.isFinite(current) || !Number.isFinite(original)) continue;
    var maximumDecline = declineFast.indexOf(key) >= 0 ? 3 : (declineResist.indexOf(key) >= 0 ? 1 : 2);
    var floor = Math.max(25, original - maximumDecline);
    if (current <= floor) continue;
    player[key] = current - 1;
    afterFormulaOvr = calcOVR(player, player.pos);
  }
  return afterFormulaOvr;
}

function applyLeaguePlayerOvrChange(player, oldOvr, newOvr) {
  if (!player) return Number(newOvr) || 0;
  var before = Math.round(Number(oldOvr) || Number(player.ovr) || 60);
  var requested = Math.round(Number(newOvr) || before);
  var direction = Math.sign(requested - before);
  if (!direction) {
    player.ovr = before;
    return player.ovr;
  }

  var generatedPlayer = isGeneratedLeaguePlayer(player);
  if (generatedPlayer && typeof migrateLegacyGeneratedPlayerAttributes === 'function') {
    migrateLegacyGeneratedPlayerAttributes(player);
  }

  var age = Number(player._age) || 27;
  var requestedMagnitude = Math.max(1, Math.abs(requested - before));
  var cap = Math.min(2, requestedMagnitude);
  var magnitude = cap;
  var profile = getLeaguePlayerDevelopmentProfile(player);
  var declineFast = ['ATH','STR','PDEF','STL','DNK'];
  var declineResist = ['threePT','MID','PAS','HAN','CLU'];
  var roundOptions = {
    generatedPlayer: generatedPlayer,
    age: age,
    cap: cap,
    declineFast: declineFast,
    declineResist: declineResist
  };

  var beforeFormulaOvr = typeof calcOVR === 'function' ? calcOVR(player, player.pos) : before;
  // Real players now expose formula OVR everywhere. If a legacy caller passes
  // an old source rating, preserve only the requested direction and apply it
  // from the current formula value instead of creating a one-time rating jump.
  if (!generatedPlayer && typeof calcOVR === 'function') {
    before = beforeFormulaOvr;
    requested = before + direction * requestedMagnitude;
  }
  var beforeAttributes = {};
  getLeagueAttributeKeys().forEach(function(attrKey) {
    beforeAttributes[attrKey] = Number(player[attrKey]);
  });
  var growthRounds = generatedPlayer && direction > 0 && requestedMagnitude <= 2 ? 2 : 1;
  for (var growthRound = 0; growthRound < growthRounds; growthRound++) {
    if (typeof calcOVR === 'function') {
      var currentFormulaOvr = calcOVR(player, player.pos);
      if (generatedPlayer) {
        if (direction > 0 && currentFormulaOvr >= requested) break;
        if (direction < 0 && currentFormulaOvr <= requested) break;
      } else {
        if (direction > 0 && currentFormulaOvr >= beforeFormulaOvr + requestedMagnitude) break;
        if (direction < 0 && currentFormulaOvr <= beforeFormulaOvr - requestedMagnitude) break;
      }
    }
    var roundMagnitude = generatedPlayer && direction > 0 ? 1 : magnitude;
    applyLeaguePlayerAttributeRound(player, profile, direction, roundMagnitude, roundOptions);
    if (!generatedPlayer || direction < 0 || requestedMagnitude > 2) break;
  }

  if (typeof calcOVR === 'function') {
    var targetFormulaOvr = generatedPlayer
      ? requested
      : (beforeFormulaOvr + direction * requestedMagnitude);
    var afterFormulaOvr = rollbackLeaguePlayerAttributesToFormulaLimit(
      player, profile, beforeAttributes, beforeFormulaOvr, direction, requestedMagnitude, targetFormulaOvr
    );
    if (direction < 0 && afterFormulaOvr > targetFormulaOvr) {
      var missingDecline = afterFormulaOvr - targetFormulaOvr;
      player._ovrDeclineRoundingCarry = Math.min(2,
        Math.max(0, Number(player._ovrDeclineRoundingCarry) || 0) + missingDecline * 0.5
      );
      if (player._ovrDeclineRoundingCarry >= 1) {
        var beforeCompletionOvr = afterFormulaOvr;
        afterFormulaOvr = completeLeaguePlayerDeclineToFormulaTarget(
          player, beforeAttributes, targetFormulaOvr, declineFast, declineResist
        );
        var completedDecline = Math.max(0, beforeCompletionOvr - afterFormulaOvr);
        player._ovrDeclineRoundingCarry = Math.max(0, player._ovrDeclineRoundingCarry - completedDecline);
      }
      if (player._ovrDeclineRoundingCarry < 0.01) delete player._ovrDeclineRoundingCarry;
    }
    player.ovr = afterFormulaOvr;
  } else {
    player.ovr = Math.max(55, Math.min(99, requested));
  }
  return player.ovr;
}

function getLeaguePlayerRetirementChance(player, age, options) {
  var currentAge = Number(age) || Number(player && player._age) || 27;
  if (player && player._protectedRetirementAge && currentAge < Number(player._protectedRetirementAge)) return 0;
  var ovr = Number(player && player.ovr) || 0;
  var unsigned = !!(options && options.unsigned);
  var chance = 0;
  // 高龄必须有基础退役率，避免 35+ 且 OVR≥75 永久滞留；球星档略缓，边缘人更快出清。
  if (currentAge >= 40) chance = 80;
  else if (currentAge >= 38) chance = ovr >= 88 ? 48 : 65;
  else if (currentAge >= 36) chance = ovr >= 85 ? 28 : (ovr >= 78 ? 42 : 55);
  else if (currentAge >= 35) chance = ovr >= 85 ? 16 : (ovr >= 78 ? 32 : 48);
  else if (currentAge >= 34) chance = ovr < 75 ? 40 : (ovr < 80 ? 18 : 0);
  else if (currentAge >= 33) chance = ovr < 72 ? 30 : (ovr < 76 ? 12 : 0);
  else if (currentAge >= 32) chance = ovr < 68 ? 20 : 0;
  if (unsigned && currentAge >= 33 && ovr < 76) {
    chance = Math.min(90, chance + 18);
  }
  return chance;
}

function evolveUnsignedFreeAgents() {
  var pool = Array.isArray(STATE._freeAgentPool) ? STATE._freeAgentPool : [];
  if (!pool.length) return;
  STATE._leagueChanges = STATE._leagueChanges || {};
  STATE._leagueChanges.retired = STATE._leagueChanges.retired || [];
  var nextPool = [];
  pool.forEach(function(player) {
    if (!player) return;
    var age = typeof getLeaguePlayerAge === 'function' ? getLeaguePlayerAge(player) : Number(player._age) || 27;
    var oldOvr = Number(player.ovr) || 60;
    player._age = age + 1;
    player.contract = 0;
    delete player.salary;

    // 年轻生成球员在无队时仍会以较低强度兑现潜力，避免被裁后永久停滞。
    var faCatchupActive = isGeneratedLeaguePlayer(player)
      && age <= 29
      && Number(player._talentCatchupSeasons) > 0;
    if ((age <= 26 || faCatchupActive) && isGeneratedLeaguePlayer(player)) {
      var gene = getPlayerGene(player);
      var potential = Number(gene && gene.potential);
      if (Number.isFinite(potential) && oldOvr < potential) {
        var faGrowth = (age <= 26 ? getPotentialGrowthBias(potential, oldOvr, age) * 0.55 : 0)
          + (rngNext() - 0.35) * 0.35
          + (faCatchupActive ? 0.55 : 0);
        faGrowth = roundLeagueOvrChange(faGrowth);
        if (faGrowth > 0) {
          applyLeaguePlayerOvrChange(player, oldOvr, Math.min(potential, oldOvr + faGrowth));
        }
      }
      if (faCatchupActive) {
        player._talentCatchupSeasons = Math.max(0, Number(player._talentCatchupSeasons) - 1);
        if (!player._talentCatchupSeasons) delete player._talentCatchupSeasons;
      }
    }

    // 无队状态下的衰退比在队球员更温和；高龄和低 OVR 球员仍会逐步退出联盟。
    if (age >= 31 && rngNext() < 0.72) {
      var decline = age >= 35 ? 1 + Math.floor(rngNext() * 2) : 1;
      applyLeaguePlayerOvrChange(player, oldOvr, Math.max(55, oldOvr - decline));
    }
    var retireChance = getLeaguePlayerRetirementChance(player, age, { unsigned: true });
    if (rngNext() * 100 < retireChance) {
      STATE._leagueChanges.retired.push({ displayName: player.cname, playerId: player.id, hidden: false, ovr: player.ovr, team: 'FA', age: player._age });
      return;
    }
    nextPool.push(player);
  });
  STATE._freeAgentPool = nextPool;
}

function mergeFreeAgentPools(carriedPlayers, newlyExpiredPlayers) {
  var merged = [];
  var seen = {};
  (carriedPlayers || []).concat(newlyExpiredPlayers || []).forEach(function(player) {
    if (!player) return;
    var key = String(player.id || player.cname || '');
    if (key && seen[key]) return;
    if (key) seen[key] = true;
    merged.push(player);
  });
  return merged;
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

var REINFORCEMENT_POSITION_META = {
  PG: { label: '控球后卫', short: 'PG', icon: '🧭' },
  SG: { label: '得分后卫', short: 'SG', icon: '🎯' },
  SF: { label: '小前锋', short: 'SF', icon: '🪽' },
  PF: { label: '大前锋', short: 'PF', icon: '🧱' },
  C: { label: '中锋', short: 'C', icon: '🛡️' }
};

function getPlayerReinforcementRequest() {
  var m = getMobility();
  return m && m.reinforcementRequest ? m.reinforcementRequest : null;
}

function isPlayerReinforcementOffseasonWindow() {
  var season = STATE.season;
  if (!season) return false;
  var pipelineStage = typeof window !== 'undefined' ? window._offseasonPipelineStage || '' : '';
  if (pipelineStage === 'trades' || pipelineStage === 'roster_fill' || pipelineStage === 'player_mobility' || pipelineStage === 'new_season') return false;
  if (typeof hasActiveSeasonPlayoffs === 'function' && hasActiveSeasonPlayoffs()) return false;
  if (season._resultsViewed || season.playoffsDone || season.playoffEliminated || season.isChampion || (season.playInState && season.playInState.isEliminated)) return true;
  return false;
}

function getPlayerReinforcementRequestSeason() {
  var c = STATE.career || {};
  if (isPlayerReinforcementOffseasonWindow()) {
    // 赛季总结页可能还没调用 saveCurrentSeasonToCareer；两种状态都指向同一个休赛期。
    return STATE._careerSaved ? (c.seasonCount || 0) : (c.seasonCount || 0) + 1;
  }
  return (c.seasonCount || 0) + 1;
}

function getReinforcementPositionLabel(position) {
  var meta = REINFORCEMENT_POSITION_META[position];
  return meta ? meta.label : '阵容短板';
}

function getPlayerReinforcementWeakestStarter(team) {
  var lineup = typeof calcTeamLineup === 'function' ? calcTeamLineup(team) : null;
  var weakest = null;
  var weakOvr = 999;
  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(function(pos) {
    var player = lineup && lineup.starters ? lineup.starters[pos] : null;
    if (player && !player._isUser && (Number(player.ovr) || 0) < weakOvr) {
      weakest = { position: pos, ovr: Number(player.ovr) || 0 };
      weakOvr = Number(player.ovr) || 0;
    }
  });
  if (weakest) return weakest;
  return { position: STATE.position || 'SF', ovr: 0 };
}

function getReinforcementRequestAvailability() {
  var c = STATE.career;
  var season = STATE.season;
  if (!c || !season || c.retired) return { allowed: false, reason: '当前没有进行中的职业生涯' };
  var offseasonWindow = isPlayerReinforcementOffseasonWindow();

  var currentSeason = getPlayerReinforcementRequestSeason();
  var request = getPlayerReinforcementRequest();
  if (request && request.season === currentSeason) {
    if (request.status === 'approved') return { allowed: false, reason: '补强要求已获准，将在休赛期优先评估', status: request.status };
    if (request.status === 'denied') return { allowed: false, reason: '本赛季的补强要求已被拒绝', status: request.status };
    return { allowed: false, reason: '本赛季已经提交过补强要求', status: request.status };
  }

  if (!offseasonWindow) {
    var gamesPlayed = (season.schedule || []).filter(function(game) { return game && game.simulated; }).length;
    if (gamesPlayed < 10) return { allowed: false, reason: '常规赛至少完成 10 场后开放', gamesNeeded: 10 - gamesPlayed };
  }
  return { allowed: true, reason: offseasonWindow ? '休赛期可提交一次；获批后优先处理本次阵容调整' : '每赛季限一次；获批后将在休赛期优先处理' };
}

function getReinforcementApprovalChance(priority) {
  var season = STATE.season || {};
  var profile = typeof getCareerProfile === 'function' ? getCareerProfile() : {};
  var total = (season.wins || 0) + (season.losses || 0);
  var winRate = total ? (season.wins || 0) / total : 0.5;
  var chance = 54;

  if (winRate < 0.4) chance += 10;
  else if (winRate > 0.65) chance -= 8;
  if ((STATE.finalOVR || 0) >= 88) chance += 8;
  else if ((STATE.finalOVR || 0) < 76) chance -= 4;
  chance += Math.min(8, Math.max(0, Number(profile.leadership) || 0));
  chance += Math.min(5, Math.max(0, Number(profile.coachTrust) || 0));

  var weakest = getPlayerReinforcementWeakestStarter(STATE.careerTeam);
  if (priority === weakest.position) chance += 8;
  return Math.max(30, Math.min(88, Math.round(chance)));
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
    if (!isCareerTradePayrollLegal(team)) return;
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

function recordPlayerReinforcementRequest(request, resultText) {
  var c = STATE.career;
  if (!c || request.source !== 'manual') return;
  c.branchHistory = c.branchHistory || [];
  c.branchHistory.push({
    seasonNum: c.seasonCount || 0,
    phase: 'career',
    branch: 'team_building',
    eventId: 'player_reinforcement_request_' + request.season,
    event: '要求阵容补强',
    choice: '优先补强：' + getReinforcementPositionLabel(request.priority),
    result: resultText || ''
  });
}

function recordPlayerReinforcementOutcome(request, resultText) {
  var c = STATE.career;
  if (!c) return;
  c.branchHistory = c.branchHistory || [];
  c.branchHistory.push({
    seasonNum: c.seasonCount || 0,
    phase: 'offseason',
    branch: 'team_building',
    eventId: 'player_reinforcement_outcome_' + request.season,
    event: '补强要求结果',
    choice: '优先补强：' + getReinforcementPositionLabel(request.priority),
    result: resultText || ''
  });
}

function createPlayerReinforcementRequest(priority, source, options) {
  options = options || {};
  var availability = getReinforcementRequestAvailability();
  if (!availability.allowed) return null;
  if (!REINFORCEMENT_POSITION_META[priority]) return null;

  var chance = getReinforcementApprovalChance(priority);
  var approved = Math.random() * 100 < chance;
  var request = {
    season: getPlayerReinforcementRequestSeason(),
    submittedGame: (STATE.season.schedule || []).filter(function(game) { return game && game.simulated; }).length,
    priority: priority,
    source: source || 'manual',
    status: approved ? 'approved' : 'denied',
    approvalChance: chance
  };
  getMobility().reinforcementRequest = request;
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.reinforcementRequested = approved;

  if (options.applyEffects !== false) {
    if (approved) addProfileDelta('leadership', 1);
    else addProfileDelta('coachTrust', -1);
  }

  var positionLabel = getReinforcementPositionLabel(priority);
  var resultText = approved
    ? '管理层接受了你的建议，将在休赛期优先评估' + positionLabel + '的补强。最终是否完成，仍取决于市场和可用资产。'
    : '管理层暂不承诺在休赛期补强' + positionLabel + '，表示会继续观察阵容。';
  recordPlayerReinforcementRequest(request, resultText);
  if (typeof queueSeasonAutoSave === 'function') queueSeasonAutoSave();
  return { request: request, resultText: resultText, positionLabel: positionLabel };
}

function closeReinforcementRequestModal() {
  var modal = document.getElementById('reinforcement-request-modal');
  if (modal) modal.remove();
}

function showReinforcementRequestModal() {
  var availability = getReinforcementRequestAvailability();
  if (!availability.allowed) return;
  closeReinforcementRequestModal();

  var weakest = getPlayerReinforcementWeakestStarter(STATE.careerTeam);
  var cards = '';
  Object.keys(REINFORCEMENT_POSITION_META).forEach(function(position) {
    var meta = REINFORCEMENT_POSITION_META[position];
    var recommended = position === weakest.position;
    cards += '<button class="team-pick-card" style="font:inherit;cursor:pointer;min-height:78px;position:relative;" onclick="showReinforcementRequestConfirmation(\'' + position + '\')">' +
      '<span style="font-size:22px;line-height:1.1;">' + meta.icon + '</span>' +
      '<span class="tpc-abbr">' + meta.short + '</span>' +
      '<span class="tpc-name">' + meta.label + '</span>' +
      (recommended ? '<span style="font-size:9px;color:var(--orange);font-weight:700;margin-top:2px;">当前短板</span>' : '') +
      '</button>';
  });

  var html = '<div class="team-picker-overlay" id="reinforcement-request-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>🧩 要求补强</span><button class="team-picker-close" onclick="closeReinforcementRequestModal()">✕</button></div>';
  html += '<div style="padding:10px 14px 4px;font-size:12px;line-height:1.6;color:var(--text-dim);">选择一个优先方向。管理层会在休赛期交易和签约阶段优先评估，但不会保证一定完成。</div>';
  html += '<div style="padding:0 14px 5px;font-size:11px;color:var(--orange);">当前建议短板：' + getReinforcementPositionLabel(weakest.position) + (weakest.ovr ? ' · 首发 OVR ' + weakest.ovr : '') + '</div>';
  html += '<div class="team-picker-grid">' + cards + '</div>';
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function showReinforcementRequestConfirmation(priority) {
  var modal = document.getElementById('reinforcement-request-modal');
  var meta = REINFORCEMENT_POSITION_META[priority];
  if (!modal || !meta) return;
  var chance = getReinforcementApprovalChance(priority);
  var weakest = getPlayerReinforcementWeakestStarter(STATE.careerTeam);
  modal.innerHTML = '<div class="team-picker-modal" style="max-width:380px;">' +
    '<div class="team-picker-header"><span>确认补强要求</span><button class="team-picker-close" onclick="closeReinforcementRequestModal()">✕</button></div>' +
    '<div style="padding:18px 14px;text-align:center;">' + meta.icon +
    '<div style="font:700 18px var(--font-display);margin:8px 0 6px;">优先补强' + meta.label + '</div>' +
    '<div style="font-size:12px;line-height:1.65;color:var(--text-dim);">当前管理层接受概率约为 ' + chance + '%。提交后本赛季不能撤回或再次提出其他补强要求。</div>' +
    (priority === weakest.position ? '<div style="font-size:11px;color:var(--orange);margin-top:8px;">这是系统识别出的当前首发短板。</div>' : '') + '</div>' +
    '<div style="padding:10px 12px;border-top:1px solid var(--border);display:flex;gap:8px;">' +
    '<button class="btn btn-secondary btn-sm" style="flex:1;" onclick="showReinforcementRequestModal()">返回</button>' +
    '<button class="btn btn-primary btn-sm" style="flex:1;" onclick="submitPlayerReinforcementRequest(\'' + priority + '\')">提交要求</button>' +
    '</div></div>';
}

function submitPlayerReinforcementRequest(priority) {
  var result = createPlayerReinforcementRequest(priority, 'manual');
  closeReinforcementRequestModal();
  if (!result) return;
  var effectText = result.request.status === 'approved'
    ? '<br><br>影响：领导力+1；休赛期优先评估' + result.positionLabel + '补强。'
    : '<br><br>影响：教练信任-1；本赛季补强要求次数已用完。';
  showOffseasonResultModal(result.request.status === 'approved' ? '补强要求获准' : '补强要求被拒', result.resultText + effectText, function() {
    showMyCard();
  });
}

function renderPlayerReinforcementRequestCard() {
  var availability = getReinforcementRequestAvailability();
  var request = getPlayerReinforcementRequest();
  var currentSeason = getPlayerReinforcementRequestSeason();
  var title = '🧩 要求补强';
  var body = availability.reason || '';
  var action = '';

  if (availability.allowed) {
    if (request && request.season < currentSeason && request.status === 'fulfilled') {
      body = '上次要求已落实：' + getReinforcementPositionLabel(request.priority) + '。' + availability.reason;
    } else if (request && request.season < currentSeason && request.status === 'reviewed') {
      body = '上次要求暂未找到合适交易。' + availability.reason;
    }
    action = '<button class="btn btn-secondary btn-sm" style="width:100%;margin-top:9px;" onclick="showReinforcementRequestModal()">提出补强要求</button>';
  } else if (request && request.season === currentSeason) {
    body += ' · 优先补强' + getReinforcementPositionLabel(request.priority);
  }

  return '<div class="mc-section"><div class="mc-section-title">' + title + '</div>' +
    '<div style="font-size:12px;line-height:1.6;color:var(--text-dim);">' + body + '</div>' + action + '</div>';
}

function createPlayerTradeRequest(preferredTeam, source, options) {
  options = options || {};
  var availability = getTradeRequestAvailability();
  if (!availability.allowed) return null;
  if (preferredTeam && (preferredTeam === STATE.careerTeam || LEAGUE_TEAM_IDS.indexOf(preferredTeam) < 0)) return null;
  if (preferredTeam && !isCareerTradePayrollLegal(preferredTeam)) return null;

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
    cards += '<button class="team-pick-card" style="font:inherit;cursor:pointer;" onclick="showTradeRequestTeamRoster(\'' + team + '\')" title="点击查看球队名单">' +
      getTeamLogo(team, 36) +
      '<span class="tpc-abbr">' + getTeamName(team) + '</span>' +
      '<span class="tpc-name">首发 OVR ' + candidate.starterOvr + ' · 查看名单</span>' +
      '</button>';
  });
  var html = '<div class="team-picker-overlay" id="trade-request-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>📨 申请交易</span><button class="team-picker-close" onclick="closeTradeRequestModal()">✕</button></div>';
  html += '<div style="padding:10px 14px 4px;font-size:12px;line-height:1.6;color:var(--text-dim);">点击球队卡片查看完整名单，再选择一支意向球队。管理层可能拒绝申请；即使获准，意向球队也不保证成为最终下家。</div>';
  html += '<div class="team-picker-grid">' + cards + '</div>';
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function showTradeRequestTeamRoster(team) {
  var modal = document.getElementById('trade-request-modal');
  if (!modal || team === STATE.careerTeam || LEAGUE_TEAM_IDS.indexOf(team) < 0) return;
  if (typeof previewTeamRosterModal !== 'function') {
    showTradeRequestConfirmation(team);
    return;
  }
  previewTeamRosterModal(team, function() {
    showTradeRequestConfirmation(team);
  }, null, '📨 选择这支球队');
}

function showTradeRequestConfirmation(team) {
  var modal = document.getElementById('trade-request-modal');
  if (!modal || team === STATE.careerTeam || LEAGUE_TEAM_IDS.indexOf(team) < 0 || !isCareerTradePayrollLegal(team)) return;
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

function getFreeAgentRoleOpportunityScore(player, teamId, cachedLineup) {
  if (!player || typeof calcTeamLineup !== 'function') return 0;
  var lineup = cachedLineup || calcTeamLineup(teamId);
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

function getFreeAgentPlayerPreferenceScore(player, teamId, standings, offer, noise) {
  var tier = getPlayerMarketTier(player);
  var winPct = offer && Number.isFinite(Number(offer.winPct))
    ? Number(offer.winPct)
    : getTeamHistoricalWinPct(teamId, standings);
  var roleOpportunity = offer && Number.isFinite(Number(offer.roleOpportunity))
    ? Number(offer.roleOpportunity)
    : getFreeAgentRoleOpportunityScore(player, teamId);
  var roleScore = clampFreeAgentValue(0.5 + roleOpportunity * 1.8, 0, 1);
  var salary = offer ? Number(offer.salary) || 0 : getPlayerMarketValue(player);
  var contractScore = clampFreeAgentValue(salary / 32, 0, 1);
  var yearsScore = offer ? clampFreeAgentValue((Number(offer.years) || 1) / 5, 0, 1) : 0.5;
  var loyalty = clampFreeAgentValue(getPlayerLoyalty(player) / 100, 0, 1);
  var isOriginalTeam = teamId === player._origTeam;
  var loyaltyScore = isOriginalTeam ? loyalty : 0.22 + (1 - loyalty) * 0.12;
  var weights;

  if (tier === 'SUPERSTAR') weights = { contract: 0.30, years: 0.04, role: 0.25, contender: 0.25, loyalty: 0.15, fit: 0.01 };
  else if (tier === 'ALL_STAR' || tier === 'STAR') weights = { contract: 0.35, years: 0.05, role: 0.20, contender: 0.18, loyalty: 0.15, fit: 0.07 };
  else if (tier === 'FRINGE') weights = { contract: 0.40, years: 0.04, role: 0.30, contender: 0.10, loyalty: 0.08, fit: 0.08 };
  else weights = { contract: 0.35, years: 0.05, role: 0.20, contender: 0.18, loyalty: 0.15, fit: 0.07 };

  // roleScore 同时代表预计角色和位置适配；这样不会再把“队内已有其他位置球星”
  // 错当成签约禁令。
  return weights.contract * contractScore
    + weights.years * yearsScore
    + weights.role * roleScore
    + weights.contender * winPct
    + weights.loyalty * loyaltyScore
    + weights.fit * roleScore
    + (Number(noise) || 0);
}

function getFreeAgentRosterCutCandidates(teamId, allowJustSigned) {
  return (LEAGUE_PLAYER_DATA[teamId] || [])
    .filter(function(player) { return player && !player._isUser && (allowJustSigned || !player._justSigned); })
    .sort(function(a, b) {
      return getPlayerMarketValue(a) - getPlayerMarketValue(b) || (Number(a.ovr) || 0) - (Number(b.ovr) || 0);
    });
}

function getFreeAgentRosterCutCandidate(teamId, allowJustSigned) {
  return getFreeAgentRosterCutCandidates(teamId, allowJustSigned)[0] || null;
}

function buildFreeAgentOffer(player, teamId, round, standings, options) {
  options = options || {};
  if ((Number(player && player.ovr) || 0) >= 90
      && isExternalFreeAgentSigning(player, teamId)
      && getTeamNinetyPlusCount(teamId) >= FREE_AGENT_MARKET.externalNinetyPlusLimit) {
    return null;
  }
  var terms = buildContractOffer(player, teamId, {
    source: 'free_agent',
    round: round,
    birdRights: hasFreeAgentBirdRights(player, teamId)
  });
  if (!terms) return null;
  var birdRights = terms.birdRights;
  var salary = terms.salary;
  var roleOpportunity = Number.isFinite(Number(options.roleOpportunity))
    ? Number(options.roleOpportunity)
    : getFreeAgentRoleOpportunityScore(player, teamId);

  var tier = getPlayerMarketTier(player);
  // 同位置已经有压倒性核心时，球员可能不接受替补角色；这只是角色判断，
  // 不再使用“队里有 84+ 就禁止签 86+”的全队硬拦截。
  if (tier === 'SUPERSTAR' && roleOpportunity < -0.20 && !birdRights) return null;

  var offer = {
    teamId: teamId,
    salary: salary,
    years: terms.years,
    payroll: terms.payroll,
    payrollAfterSigning: terms.payrollAfterSigning,
    birdRights: birdRights,
    rosterCuts: terms.rosterCuts,
    roleOpportunity: roleOpportunity,
    rosterCut: terms.rosterCut,
    overTax: terms.payrollAfterSigning > FREE_AGENT_MARKET.taxLine,
    winPct: getTeamHistoricalWinPct(teamId, standings),
  };
  offer.preferenceScore = getFreeAgentPlayerPreferenceScore(player, teamId, standings, offer, (rngNext() - 0.5) * 0.05)
    - (offer.overTax ? 0.03 : 0);
  return offer;
}

function assignFreeAgents(options) {
  options = options || {};
  var yieldToBrowser = !!options.yieldToBrowser;
  enforceLeagueRosterCapacity(null, { reason: 'pre_free_agent_capacity' });
  var rawPool = Array.isArray(STATE._freeAgentPool) ? STATE._freeAgentPool : [];
  var pool = [];
  var seenPlayers = {};
  rawPool.forEach(function(player) {
    var key = String(player && player.id || '');
    if (!player || (key && seenPlayers[key])) return;
    if (key) seenPlayers[key] = true;
    pool.push(player);
  });
  if (pool.length === 0) {
    enforceLeagueRosterCapacity(null, { reason: 'post_free_agent_capacity' });
    return yieldToBrowser ? Promise.resolve() : undefined;
  }

  if (!STATE._leagueChanges) STATE._leagueChanges = {};
  if (!STATE._leagueChanges.freeSignings) STATE._leagueChanges.freeSignings = [];
  if (!STATE._leagueChanges.freeAgents) STATE._leagueChanges.freeAgents = [];

  offseasonDebugLog('[FA] 自由球员分配:', pool.length, '人');

  var st = STATE._prevStandings;
  var teams = LEAGUE_TEAM_IDS.slice();
  var unsignedPlayers = [];
  var signedIds = {};
  // 一轮内同一支球队的首发结构不会变化；只有完成签约时才让该队缓存失效。
  var lineupCache = {};

  function getCachedRoleOpportunity(player, teamId) {
    if (!Object.prototype.hasOwnProperty.call(lineupCache, teamId)) {
      lineupCache[teamId] = typeof calcTeamLineup === 'function' ? calcTeamLineup(teamId) : null;
    }
    return getFreeAgentRoleOpportunityScore(player, teamId, lineupCache[teamId]);
  }

  function addFreeAgentSummary(player, team, reason) {
    STATE._leagueChanges.freeAgents.push({
      name: player.cname,
      playerId: player.id,
      ovr: player.ovr,
      team: team,
      age: getLeaguePlayerAge(player),
      reason: reason || 'free_agent'
    });
  }

  function signFreeAgent(fa, offer, round, offersCount) {
    var roster = LEAGUE_PLAYER_DATA[offer.teamId] || (LEAGUE_PLAYER_DATA[offer.teamId] = []);
    var rosterCuts = Array.isArray(offer.rosterCuts)
      ? offer.rosterCuts.slice()
      : (offer.rosterCut ? [offer.rosterCut] : []);
    rosterCuts.forEach(function(cut) {
      var cutIndex = roster.indexOf(cut);
      if (cutIndex >= 0) roster.splice(cutIndex, 1);
      cut._origTeam = offer.teamId;
      cut._lastTeam = offer.teamId;
      cut._teamTenure = 1;
      cut._waived = true;
      cut.contract = 0;
      delete cut.salary;
      unsignedPlayers.push(cut);
      addFreeAgentSummary(cut, offer.teamId, 'superstar_roster_clear');
    });

    var returnedToOriginalTeam = offer.teamId === fa._origTeam;
    roster.push(fa);
    fa.salary = offer.salary;
    fa._salaryVersion = FREE_AGENT_MARKET.salaryVersion;
    fa.contract = offer.years;
    fa._lastTeam = offer.teamId;
    fa._teamTenure = returnedToOriginalTeam ? Math.max(1, Number(fa._teamTenure) || 1) + 1 : 1;
    fa._birdTeam = returnedToOriginalTeam ? offer.teamId : null;
    delete fa._waived;
    fa._justSigned = true;

    var loyaltyChange = recordPlayerLoyaltyDecision(fa, returnedToOriginalTeam ? 'renew' : 'leave', fa.contract, true, offer.teamId);
    STATE._leagueChanges.freeSignings.push({
      name: fa.cname,
      playerId: fa.id,
      from: fa._origTeam,
      to: offer.teamId,
      ovr: fa.ovr,
      marketValue: getPlayerMarketValue(fa),
      salary: fa.salary,
      returned: returnedToOriginalTeam,
      birdRights: offer.birdRights,
      rosterCut: rosterCuts[0] ? rosterCuts[0].id : null,
      rosterCuts: rosterCuts.map(function(cut) { return cut.id; }),
      years: fa.contract,
      offers: offersCount,
      round: round + 1,
      loyaltyChange: loyaltyChange
    });
    if (returnedToOriginalTeam) offseasonDebugLog('[FA] 自由市场回签:', (fa.cname || fa.id), offer.teamId, '忠诚度', getPlayerLoyalty(fa));
    if (offer.teamId === STATE.careerTeam) {
      if (!STATE._leagueChanges.teamChanges) STATE._leagueChanges.teamChanges = {};
      STATE._leagueChanges.teamChanges[offer.teamId] = STATE._leagueChanges.teamChanges[offer.teamId] || { retired: [], rookies: [] };
      STATE._leagueChanges.teamChanges[offer.teamId].rookies.push(fa.cname);
    }
    delete lineupCache[offer.teamId];
    signedIds[String(fa.id || fa.cname)] = true;
  }

  function getRoundCandidates(round) {
    return pool.filter(function(fa) {
      // 工资帽不再造成“第一轮无合法报价、后续降薪重试”的情况；
      // 每名球员只在所属轮次结算一次，避免四轮重复扫描同一批人。
      return !signedIds[String(fa.id || fa.cname)] && getFreeAgentRound(fa) === round;
    }).sort(function(a, b) {
      return getPlayerMarketValue(b) - getPlayerMarketValue(a) || (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
    });
  }

  function processFreeAgentCandidate(fa, round) {
    if (signedIds[String(fa.id || fa.cname)]) return;
    if (!fa._origTeam) offseasonDebugLog('[FA] 无_origTeam:', (fa.cname || fa.id), 'ovr:', fa.ovr);
    var best = null;
    var offersCount = 0;
    teams.forEach(function(teamId) {
      var offer = buildFreeAgentOffer(fa, teamId, round, st, {
        roleOpportunity: getCachedRoleOpportunity(fa, teamId)
      });
      if (!offer) return;
      offersCount++;
      if (!best
          || offer.preferenceScore > best.preferenceScore
          || (offer.preferenceScore === best.preferenceScore && String(offer.teamId).localeCompare(String(best.teamId)) < 0)) {
        best = offer;
      }
    });
    if (!best) return;

    var tier = getPlayerMarketTier(fa);
    var acceptanceFloor = tier === 'SUPERSTAR' ? 0.30 : tier === 'FRINGE' ? 0.34 : 0.27;
    // 低价值球员在最后一轮可能仍拒绝明显不合适的角色；顶级球星不会被这层随机性蒸发。
    if (best.preferenceScore < acceptanceFloor && tier !== 'SUPERSTAR' && rngNext() < 0.65) return;
    signFreeAgent(fa, best, round, offersCount);
  }

  function finishFreeAgentAssignment() {
    // 年轻核心的母队拥有最后回签权。正常四轮市场已给其他球队充分竞争机会；
    // 若仍无人签下，原队会在不受工资帽阻断的前提下给出市场合同。
    pool.forEach(function(fa) {
      if (signedIds[String(fa.id || fa.cname)] || !isYoungCoreFreeAgent(fa)) return;
      var originalTeam = fa._origTeam;
      if (teams.indexOf(originalTeam) < 0) return;
      var returnOffer = buildFreeAgentOffer(fa, originalTeam, 3, st);
      if (returnOffer) signFreeAgent(fa, returnOffer, 3, 1);
    });
    pool.forEach(function(fa) {
      if (!signedIds[String(fa.id || fa.cname)]) unsignedPlayers.push(fa);
    });
    // 未签约球员是合法的自由球员状态，必须继续保存在池中，供下一休赛期或赛季中补员。
    STATE._freeAgentPool = unsignedPlayers;
    enforceLeagueRosterCapacity(null, { reason: 'post_free_agent_capacity' });
  }

  // 脚本测试和其他后台调用继续使用同步路径，保证既有调用语义不变。
  if (!yieldToBrowser) {
    for (var round = 0; round < 4; round++) {
      getRoundCandidates(round).forEach(function(fa) {
        processFreeAgentCandidate(fa, round);
      });
    }
    finishFreeAgentAssignment();
    return;
  }

  // UI 入口按时间片分批执行，避免一个大自由球员池长时间占满主线程。
  var currentRound = 0;
  var currentCandidates = getRoundCandidates(currentRound);
  var candidateIndex = 0;
  var batchSize = Math.max(1, Number(options.batchSize) || 6);
  var timeBudgetMs = Math.max(4, Number(options.timeBudgetMs) || 12);
  var scheduleBatch = typeof setTimeout === 'function'
    ? function(callback) { setTimeout(callback, 0); }
    : function(callback) { callback(); };

  return new Promise(function(resolve, reject) {
    function reportProgress() {
      if (typeof options.onProgress !== 'function') return;
      options.onProgress({
        round: Math.min(4, currentRound + 1),
        rounds: 4,
        signed: Object.keys(signedIds).length,
        total: pool.length
      });
    }

    function runBatch() {
      try {
        var startedAt = Date.now();
        var processed = 0;
        while (currentRound < 4) {
          if (candidateIndex >= currentCandidates.length) {
            currentRound++;
            if (currentRound >= 4) break;
            currentCandidates = getRoundCandidates(currentRound);
            candidateIndex = 0;
            continue;
          }

          processFreeAgentCandidate(currentCandidates[candidateIndex], currentRound);
          candidateIndex++;
          processed++;
          if (processed >= batchSize || Date.now() - startedAt >= timeBudgetMs) {
            reportProgress();
            scheduleBatch(runBatch);
            return;
          }
        }

        finishFreeAgentAssignment();
        reportProgress();
        resolve();
      } catch (error) {
        reject(error);
      }
    }

    reportProgress();
    scheduleBatch(runBatch);
  });
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
    if (p._draftPickTradeSeason === Math.max(1, Number(STATE.career && STATE.career.seasonCount) || 1)) continue;
    if (p.ovr > 92) continue;
    if (tradedSet && tradedSet.has(p)) continue;
    if (excludeOvr != null && Math.abs(p.ovr - excludeOvr) > 10) continue;
    if (canPlayPosition(p.pos || '', pos)) {
      if (!best || Math.abs(p.ovr - (excludeOvr || 75)) < Math.abs(best.ovr - (excludeOvr || 75))) best = p;
    }
  }
  return best;
}

function isTradePayrollLegal(teamA, teamB, playerA, playerB) {
  if (!playerA || !playerB) return false;
  var payrollA = typeof getTeamPayroll === 'function'
    ? getTeamPayroll(teamA)
    : (LEAGUE_PLAYER_DATA[teamA] || []).reduce(function(sum, player) { return sum + (Number(player.salary) || 0); }, 0);
  var payrollB = typeof getTeamPayroll === 'function'
    ? getTeamPayroll(teamB)
    : (LEAGUE_PLAYER_DATA[teamB] || []).reduce(function(sum, player) { return sum + (Number(player.salary) || 0); }, 0);
  var incomingA = typeof getPlayerSalary === 'function' ? getPlayerSalary(playerA) : (Number(playerA.salary) || 0);
  var incomingB = typeof getPlayerSalary === 'function' ? getPlayerSalary(playerB) : (Number(playerB.salary) || 0);
  var afterA = payrollA - incomingB + incomingA;
  var afterB = payrollB - incomingA + incomingB;
  var tradeApron = typeof FREE_AGENT_MARKET !== 'undefined' ? FREE_AGENT_MARKET.secondApron : Infinity;
  return afterA <= tradeApron + 0.001 && afterB <= tradeApron + 0.001;
}

function swapRosterPlayers(teamA, teamB, playerA, playerB) {
  var rosterA = LEAGUE_PLAYER_DATA[teamA];
  var rosterB = LEAGUE_PLAYER_DATA[teamB];
  var idxA = -1, idxB = -1;
  for (var i = 0; i < rosterA.length; i++) { if (rosterA[i] === playerB) { idxA = i; break; } }
  for (var j = 0; j < rosterB.length; j++) { if (rosterB[j] === playerA) { idxB = j; break; } }
  if (idxA < 0 || idxB < 0 || !isTradePayrollLegal(teamA, teamB, playerA, playerB)) return false;
  rosterA[idxA] = playerA;
  rosterB[idxB] = playerB;
  STATE._leagueChanges.trades.push({
    from: teamA, to: teamB,
    playerA: playerA.id,
    playerB: playerB.id,
  });
  return true;
}

function getTeamTradeNeed(team) {
  var lineup = calcTeamLineup(team);
  var weakest = null;
  var weakOvr = 999;
  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(function(pos) {
    var player = lineup && lineup.starters ? lineup.starters[pos] : null;
    if (player && !player._isUser && player.ovr < weakOvr) {
      weakOvr = player.ovr;
      weakest = pos;
    }
  });
  return weakest;
}

function getReinforcementBenchmarkOvr(team, priority) {
  var lineup = calcTeamLineup(team);
  var starter = lineup && lineup.starters ? lineup.starters[priority] : null;
  if (starter && !starter._isUser) return Number(starter.ovr) || 0;
  var roster = LEAGUE_PLAYER_DATA[team] || [];
  var best = 0;
  roster.forEach(function(player) {
    if (player && !player._isUser && canPlayPosition(player.pos || '', priority)) {
      best = Math.max(best, Number(player.ovr) || 0);
    }
  });
  return best;
}

function tryFulfillPlayerReinforcementRequest(request, needs, shuffled, tradedPlayers, tradedTeams) {
  var c = STATE.career || {};
  if (!request || request.status !== 'approved' || request.processedSeason === (c.seasonCount || 0)) return null;
  if (request.season > (c.seasonCount || 0) || !STATE.careerTeam) return null;

  var targetTeam = STATE.careerTeam;
  var priority = REINFORCEMENT_POSITION_META[request.priority] ? request.priority : getTeamTradeNeed(targetTeam);
  if (!priority) return null;
  if ((tradedTeams.get(targetTeam) || 0) >= 2) return null;

  var targetRoster = LEAGUE_PLAYER_DATA[targetTeam] || [];
  var baselineOvr = getReinforcementBenchmarkOvr(targetTeam, priority);
  var best = null;
  shuffled.forEach(function(partner) {
    if (partner === targetTeam || (tradedTeams.get(partner) || 0) >= 2) return;
    var partnerRoster = LEAGUE_PLAYER_DATA[partner] || [];
    var incoming = findTradeCandidate(partnerRoster, priority, null, tradedPlayers);
    if (!incoming || incoming._isUser) return;

    var improvement = baselineOvr > 0 ? incoming.ovr - baselineOvr : incoming.ovr - 60;
    if (baselineOvr > 0 && improvement < 1) return;

    var partnerNeed = needs[partner] || getTeamTradeNeed(partner);
    if (!partnerNeed || partnerNeed === priority) return;
    var outgoing = findTradeCandidate(targetRoster, partnerNeed, incoming.ovr, tradedPlayers)
      || findTradeCandidate(targetRoster, partnerNeed, null, tradedPlayers);
    if (!outgoing || outgoing._isUser) return;

    var diff = Math.abs(incoming.ovr - outgoing.ovr);
    if (diff > 15) return;
    var standing = STATE._prevStandings && STATE._prevStandings[partner];
    var partnerWinRate = standing ? ((standing.wins || 0) + (standing.losses || 0) > 0
      ? (standing.wins || 0) / ((standing.wins || 0) + (standing.losses || 0))
      : 0.5) : 0.5;
    var score = improvement * 10 + incoming.ovr * 0.2 - diff * 0.75 + (0.5 - partnerWinRate) * 8;
    if (!best || score > best.score) {
      best = { partner: partner, incoming: incoming, outgoing: outgoing, position: priority, score: score };
    }
  });

  if (!best) return null;
  if (!swapRosterPlayers(targetTeam, best.partner, best.incoming, best.outgoing)) return null;
  tradedPlayers.add(best.incoming);
  tradedPlayers.add(best.outgoing);
  tradedTeams.set(targetTeam, (tradedTeams.get(targetTeam) || 0) + 1);
  tradedTeams.set(best.partner, (tradedTeams.get(best.partner) || 0) + 1);
  needs[targetTeam] = getTeamTradeNeed(targetTeam);
  needs[best.partner] = getTeamTradeNeed(best.partner);

  var tradeLog = STATE._leagueChanges.trades[STATE._leagueChanges.trades.length - 1];
  if (tradeLog) {
    tradeLog.requestedReinforcement = true;
    tradeLog.reinforcementPosition = priority;
    tradeLog.incomingOvr = best.incoming.ovr;
  }
  return best;
}

function processTrades() {
  if (!LEAGUE_PLAYER_DATA) return;
  if (!STATE._leagueChanges) STATE._leagueChanges = { retired: [], rookies: [], teamChanges: {}, trades: [] };
  if (!STATE._leagueChanges.trades) STATE._leagueChanges.trades = [];
  if (typeof enforceLeagueRosterCapacity === 'function') enforceLeagueRosterCapacity(null, { reason: 'pre_trade_capacity' });

  // 算每队需求位置
  var needs = {};
  LEAGUE_TEAM_IDS.forEach(function(t) {
    needs[t] = getTeamTradeNeed(t);
  });

  var debugOffseason = isOffseasonDebugEnabled();
  offseasonDebugLog('[Trade] 需求:', needs);

  var tradedPlayers = new Set();
  var tradedTeams = new Map(); // 改用 Map 支持计数
  var tradePairLogs = debugOffseason ? [] : null;
  var tradePairStats = {
    considered: 0,
    succeeded: 0,
    salaryRejected: 0,
    ovrRejected: 0
  };

  // 打乱球队顺序，让交易分布更随机
  var shuffled = LEAGUE_TEAM_IDS.slice().sort(function() { return rngNext() - 0.5; });

  var tradeCount = 0;
  var reinforcementRequest = typeof getPlayerReinforcementRequest === 'function' ? getPlayerReinforcementRequest() : null;
  if (reinforcementRequest && reinforcementRequest.status === 'approved' && reinforcementRequest.season <= (STATE.career.seasonCount || 0)) {
    var reinforcementTrade = tryFulfillPlayerReinforcementRequest(reinforcementRequest, needs, shuffled, tradedPlayers, tradedTeams);
    reinforcementRequest.processedSeason = STATE.career.seasonCount || 0;
    STATE.career.flags = STATE.career.flags || {};
    STATE.career.flags.reinforcementRequested = false;
    if (reinforcementTrade) {
      reinforcementRequest.status = 'fulfilled';
      reinforcementRequest.completedSeason = STATE.career.seasonCount || 0;
      reinforcementRequest.outcome = 'trade';
      var reinforcementLabel = getReinforcementPositionLabel(reinforcementTrade.position);
      var reinforcementResult = '管理层完成了一笔针对' + reinforcementLabel + '的交易，补强要求已落实。';
      recordPlayerReinforcementOutcome(reinforcementRequest, reinforcementResult);
      if (typeof addNextSeasonMod === 'function') {
        addNextSeasonMod('teamChemistry', 1, -10, 10);
        addNextSeasonMod('moraleBonus', 1, -10, 10);
      }
    } else {
      reinforcementRequest.status = 'reviewed';
      reinforcementRequest.completedSeason = STATE.career.seasonCount || 0;
      reinforcementRequest.outcome = 'no_match';
      recordPlayerReinforcementOutcome(reinforcementRequest, '管理层评估了补强要求，但本次休赛期没有找到合适的交易组合。');
    }
    if (typeof queueSeasonAutoSave === 'function') queueSeasonAutoSave();
    if (reinforcementTrade) tradeCount++;
  }

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
        tradePairStats.considered++;
        var diff = Math.abs(playerForA.ovr - playerForB.ovr);
        var pairLog = debugOffseason && tradePairLogs.length < OFFSEASON_DEBUG_PAIR_LIMIT
          ? a + ' ' + needA + ' vs ' + b + ' ' + needB
            + ' 候选人: ' + (playerForA.cname || playerForA.id) + ' ' + playerForA.ovr
            + ' / ' + (playerForB.cname || playerForB.id) + ' ' + playerForB.ovr
            + ' diff: ' + diff
          : null;
        if (diff <= 15) { // 放宽至 <= 15，允许弱队出售大牌换潜力股
          if (swapRosterPlayers(a, b, playerForA, playerForB)) {
            tradePairStats.succeeded++;
            if (pairLog) tradePairLogs.push(pairLog + ' ✅成功');
            tradedPlayers.add(playerForA);
            tradedPlayers.add(playerForB);
            tradedTeams.set(a, (tradedTeams.get(a) || 0) + 1);
            tradedTeams.set(b, (tradedTeams.get(b) || 0) + 1);
            tradeCount++;
            // 重新算两队需求
            needs[a] = getTeamTradeNeed(a);
            needs[b] = getTeamTradeNeed(b);
            break;
          }
          tradePairStats.salaryRejected++;
          if (pairLog) tradePairLogs.push(pairLog + ' ❌未成交（薪资或交易校验失败）');
        } else {
          tradePairStats.ovrRejected++;
          if (pairLog) tradePairLogs.push(pairLog + ' ⏭️未通过 OVR 差距');
        }
      }
    }
  }
  if (debugOffseason) {
    offseasonDebugLog('[Trade] 配对汇总:', {
      considered: tradePairStats.considered,
      succeeded: tradePairStats.succeeded,
      salaryRejected: tradePairStats.salaryRejected,
      ovrRejected: tradePairStats.ovrRejected,
      samples: tradePairLogs
    });
  }
  if (typeof enforceLeagueRosterCapacity === 'function') enforceLeagueRosterCapacity(null, { reason: 'post_trade_capacity' });
}

function getOvrPositions(pos) {
  var fallback = (typeof STATE !== 'undefined' && STATE && STATE.position) ? STATE.position : 'SG';
  var positions = String(pos || fallback).split('/').map(function(value) { return value.trim(); }).filter(Boolean);
  var valid = SIM_CONFIG && SIM_CONFIG.OVR_MODEL ? SIM_CONFIG.OVR_MODEL.positionWeights : null;
  positions = positions.filter(function(value) { return valid && valid[value]; });
  return positions.length ? positions.slice(0, 2) : ['SG'];
}

function calcOvrAttribute(attrs, key) {
  var value = (attrs && attrs[key] != null) ? Number(attrs[key]) : 50;
  return Math.max(25, Math.min(99, Number.isFinite(value) ? value : 50));
}

function calcOvrPositionScore(attrs, pos) {
  var model = SIM_CONFIG.OVR_MODEL;
  var weights = model.positionWeights[pos];
  return Object.keys(weights).reduce(function(sum, key) {
    return sum + (calcOvrAttribute(attrs, key) - 25) * weights[key];
  }, Number(model.positionOffsets[pos]) || 0);
}

function calcOVR(attrs, pos) {
  var unifiedOvr = typeof getUnifiedPlayerOvr === 'function'
    ? getUnifiedPlayerOvr
    : (SIM_CONFIG && SIM_CONFIG.getUnifiedPlayerOvr);
  if (typeof unifiedOvr === 'function') return unifiedOvr(attrs, pos);
  var model = SIM_CONFIG && SIM_CONFIG.OVR_MODEL;
  if (!model) return 50;
  var positions = getOvrPositions(pos);
  var primaryScore = calcOvrPositionScore(attrs, positions[0]);
  var positionScore = primaryScore;
  if (positions[1]) {
    var secondaryWeight = Math.max(0, Math.min(0.5, Number(model.secondaryPositionWeight) || 0));
    positionScore = primaryScore * (1 - secondaryWeight) + calcOvrPositionScore(attrs, positions[1]) * secondaryWeight;
  }
  var values = ATTR_KEYS.map(function(key) { return calcOvrAttribute(attrs, key); }).sort(function(a, b) { return b - a; });
  var scoringBreadth = Math.min(Math.max(calcOvrAttribute(attrs, 'threePT'), calcOvrAttribute(attrs, 'MID')), calcOvrAttribute(attrs, 'FIN'));
  var topFourAverage = values.slice(0, 4).reduce(function(sum, value) { return sum + value; }, 0) / 4;
  var bonuses = model.bonuses;
  var eliteExcess = values.reduce(function(sum, value) { return sum + Math.max(0, value - bonuses.eliteThreshold); }, 0);
  var raw = model.base + positionScore
    + scoringBreadth * bonuses.scoringBreadth
    + topFourAverage * bonuses.topFourAverage
    + eliteExcess * bonuses.eliteExcess;
  return Math.max(40, Math.min(99, Math.round(raw)));
}

function isGeneratedLeaguePlayer(player) {
  if (!player) return false;
  var id = String(player.id || '');
  return !!player._prospectId || /^R\d+$/.test(id) || /^D\d{2}-\d+$/.test(id);
}

var ROOKIE_ATTRIBUTE_PROFILE_VERSION = 3;
var ROOKIE_ATTRIBUTE_PROFILES = {
  PG: [
    { id: 'playmaker', label: '组织核心', strengths: ['HAN','PAS','ATH'], weaknesses: ['IDEF','BLK','REB','STR'] },
    { id: 'scoring_guard', label: '进攻后卫', strengths: ['threePT','MID','HAN','CLU'], weaknesses: ['IDEF','BLK','REB','STR'] }
  ],
  SG: [
    { id: 'perimeter_scorer', label: '外线得分手', strengths: ['threePT','MID','FIN','HAN'], weaknesses: ['IDEF','BLK','REB','STR'] },
    { id: 'two_way_slasher', label: '双向突破手', strengths: ['FIN','DNK','PDEF','STL','ATH'], weaknesses: ['IDEF','BLK','REB','PAS'] }
  ],
  SF: [
    { id: 'two_way_wing', label: '双向锋线', strengths: ['FIN','PDEF','STL','ATH','STR'], weaknesses: ['PAS','BLK','REB','MID'] },
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

function syncAuthoredRookieOvr(player) {
  if (!player) return 0;
  var pos = getGeneratedPlayerMainPos(player);
  player.ovr = calcOVR(player, pos);
  return player.ovr;
}

/** 随机新秀只允许做有限统一平移；强弱项顺序不会翻转，也不要求精确命中目标。 */
function calibrateGeneratedRookieAttributes(player, targetOvr, maxAdjustment) {
  var pos = getGeneratedPlayerMainPos(player);
  var target = Math.max(50, Math.min(99, Math.round(Number(targetOvr) || 50)));
  var cap = Math.max(0, Math.min(3, Math.round(Number(maxAdjustment) || 3)));
  var original = {};
  ATTR_KEYS.forEach(function(key) { original[key] = Number(player[key]) || 50; });
  var bestShift = 0;
  var bestDistance = Infinity;
  for (var shift = -cap; shift <= cap; shift++) {
    ATTR_KEYS.forEach(function(key) { player[key] = clampLeagueAttribute(original[key] + shift); });
    var candidateOvr = calcOVR(player, pos);
    var distance = Math.abs(candidateOvr - target);
    if (distance < bestDistance || (distance === bestDistance && Math.abs(shift) < Math.abs(bestShift))) {
      bestDistance = distance;
      bestShift = shift;
    }
  }
  ATTR_KEYS.forEach(function(key) { player[key] = clampLeagueAttribute(original[key] + bestShift); });
  player.ovr = calcOVR(player, pos);
  return player.ovr;
}

// 未来随机选秀的正式稀有度：每届约 4 名高即战力 + 3 名高水平，其余以轮换/发展型为主。
// 总强新人仍为 7 人，只调整潜在球星的档位结构，用年轻供给替代老将冻结。
var GENERATED_DRAFT_OVR_TIERS = [
  { id: 'elite', share: 0.133, min: 80, max: 84 },
  { id: 'high', share: 0.100, min: 75, max: 79 },
  { id: 'rotation', share: 0.433, min: 68, max: 74 },
  { id: 'development', share: 0.267, min: 60, max: 67 },
  { id: 'longshot', share: 0.067, min: 50, max: 59 }
];

function buildGeneratedDraftOvrTargets(count, randomFn) {
  var total = Math.max(0, Math.floor(Number(count) || 0));
  var random = typeof randomFn === 'function' ? randomFn : Math.random;
  var rows = GENERATED_DRAFT_OVR_TIERS.map(function(tier, index) {
    var exact = total * tier.share;
    return { tier: tier, index: index, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  var assigned = rows.reduce(function(sum, row) { return sum + row.count; }, 0);
  rows.slice().sort(function(left, right) {
    return right.remainder - left.remainder || left.index - right.index;
  }).forEach(function(row) {
    if (assigned >= total) return;
    row.count++;
    assigned++;
  });
  var targets = [];
  rows.forEach(function(row) {
    for (var index = 0; index < row.count; index++) {
      targets.push(row.tier.min + Math.floor(random() * (row.tier.max - row.tier.min + 1)));
    }
  });
  return targets.sort(function(left, right) { return right - left; });
}

/**
 * 固定候选人的原始属性只定义球风轮廓，不再绕过当届选秀稀有度。
 * 运行时对克隆对象做统一平移，保留所有强弱项顺序，并选择最接近当届目标 OVR 的结果。
 */
function fitAuthoredRookieAttributesToTarget(player, targetOvr) {
  if (!player) return player;
  var target = Math.max(50, Math.min(99, Math.round(Number(targetOvr) || 50)));
  var pos = getGeneratedPlayerMainPos(player);
  var original = {};
  ATTR_KEYS.forEach(function(key) { original[key] = calcOvrAttribute(player, key); });
  var authoredOvr = calcOVR(player, pos);
  var bestShift = 0;
  var bestDistance = Infinity;
  var bestAttributes = null;
  for (var shift = -55; shift <= 25; shift++) {
    var candidate = {};
    ATTR_KEYS.forEach(function(key) {
      candidate[key] = clampLeagueAttribute(original[key] + shift);
      player[key] = candidate[key];
    });
    var distance = Math.abs(calcOVR(player, pos) - target);
    if (distance < bestDistance || (distance === bestDistance && Math.abs(shift) < Math.abs(bestShift))) {
      bestDistance = distance;
      bestShift = shift;
      bestAttributes = candidate;
    }
  }
  ATTR_KEYS.forEach(function(key) { player[key] = bestAttributes[key]; });
  player._authoredProspectOvr = Number(player._authoredProspectOvr) || authoredOvr;
  player._draftAttributeShift = bestShift;
  player._rookieGenerationVersion = ROOKIE_ATTRIBUTE_PROFILE_VERSION;
  player.ovr = calcOVR(player, pos);
  return player;
}

function prepareDraftProspectForTarget(player, targetOvr, randomFn) {
  if (!player) return player;
  var target = Math.max(50, Math.min(99, Math.round(Number(targetOvr) || 50)));
  if (player._fixedProspectRating && ATTR_KEYS.every(function(key) { return Number.isFinite(Number(player[key])); })) {
    fitAuthoredRookieAttributesToTarget(player, target);
  } else {
    player.ovr = target;
    applyRookieAttributeProfile(player, target, randomFn);
  }
  player._rookieSeason = getCurrentLeagueSeasonNumber();
  player._draftOvr = Number(player.ovr) || target;
  refreshGeneratedPlayerType(player);
  return player;
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
  var target = Math.max(50, Math.min(99, Math.round(Number(targetOvr) || 50)));
  player._rookieProfile = profile.id;
  player._rookieGenerationVersion = ROOKIE_ATTRIBUTE_PROFILE_VERSION;
  if (!player._rookieSeason) player._rookieSeason = getCurrentLeagueSeasonNumber();
  var offsets = {};
  ATTR_KEYS.forEach(function(key) {
    var offset;
    if (profile.strengths.indexOf(key) >= 0) offset = 7 + Math.floor(random() * 5);
    else if (profile.weaknesses.indexOf(key) >= 0) offset = -(10 + Math.floor(random() * 6));
    else offset = Math.floor(random() * 7) - 3;
    offsets[key] = offset;
  });
  // 目标只选择最接近的模板基准，不覆盖已生成的强弱项；落地后仍只允许 ±3 有限校准。
  var bestAttributes = null;
  var bestDistance = Infinity;
  var bestBaseDistance = Infinity;
  for (var base = target - 12; base <= target + 12; base++) {
    var candidateAttributes = {};
    ATTR_KEYS.forEach(function(key) {
      candidateAttributes[key] = clampLeagueAttribute(base + offsets[key]);
      player[key] = candidateAttributes[key];
    });
    var distance = Math.abs(calcOVR(player, getGeneratedPlayerMainPos(player)) - target);
    var baseDistance = Math.abs(base - target);
    if (distance < bestDistance || (distance === bestDistance && baseDistance < bestBaseDistance)) {
      bestAttributes = candidateAttributes;
      bestDistance = distance;
      bestBaseDistance = baseDistance;
    }
  }
  ATTR_KEYS.forEach(function(key) { player[key] = bestAttributes[key]; });
  calibrateGeneratedRookieAttributes(player, target, 3);
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

function migrateLegacyGeneratedPlayerAttributes(player) {
  if (!isGeneratedLeaguePlayer(player) || player._rookieGenerationVersion >= ROOKIE_ATTRIBUTE_PROFILE_VERSION) return false;
  var targetOvr = Math.max(55, Math.min(99, Math.round(Number(player.ovr) || 70)));
  if (!player._rookieSeason) {
    var age = Number(player._age) || 20;
    player._rookieSeason = Math.max(1, getCurrentLeagueSeasonNumber() - Math.max(0, age - 20));
  }
  var random = createGeneratedPlayerMigrationRandom(player);
  var profile = getRookieProfile(player, random);
  player._rookieProfile = profile.id;
  ATTR_KEYS.forEach(function(key) {
    if (Number.isFinite(Number(player[key]))) return;
    var offset;
    if (profile.strengths.indexOf(key) >= 0) offset = 7 + Math.floor(random() * 5);
    else if (profile.weaknesses.indexOf(key) >= 0) offset = -(10 + Math.floor(random() * 6));
    else offset = Math.floor(random() * 7) - 3;
    player[key] = clampLeagueAttribute(targetOvr + offset);
  });
  player._rookieGenerationVersion = ROOKIE_ATTRIBUTE_PROFILE_VERSION;
  syncAuthoredRookieOvr(player);
  refreshGeneratedPlayerType(player);
  return true;
}

function evolveGeneratedPlayerAttributes(player, oldOvr, newOvr) {
  if (!isGeneratedLeaguePlayer(player)) return false;
  var delta = Math.round(newOvr) - Math.round(oldOvr);
  if (!delta) return false;
  migrateLegacyGeneratedPlayerAttributes(player);
  applyLeaguePlayerOvrChange(player, oldOvr, newOvr);
  return true;
}

function syncGeneratedLeaguePlayerOvr(player) {
  if (!isGeneratedLeaguePlayer(player)) return false;
  var pos = String(player.pos || '').split('/')[0].trim();
  if (!SIM_CONFIG || !pos || typeof calcOVR !== 'function') return false;
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
      var playerChanged = migrateLegacyGeneratedPlayerAttributes(player);
      if (refreshGeneratedPlayerType(player)) playerChanged = true;
      if (syncGeneratedLeaguePlayerOvr(player)) playerChanged = true;
      if (playerChanged) changed++;
    });
  });
  if (changed && typeof clearLineupCache === 'function') clearLineupCache();
  return changed;
}

var LEAGUE_OVR_ANCHOR_VERSION = 1;
var LEAGUE_TALENT_BALANCE_VERSION = 2;
var LEAGUE_ATTRIBUTE_SCHEMA_VERSION = 3;
var LEAGUE_ATTRIBUTE_SOURCE_VERSION = 2;

function getExpectedGeneratedCareerOvr(player, age, potential) {
  var draftOvr = inferGeneratedPlayerDraftOvr(player, Number(player && player.ovr) || 60, age);
  var gap = Math.max(0, Number(potential) - draftOvr);
  var progress;
  if (age <= 20) progress = 0;
  else if (age <= 22) progress = 0.12 + (age - 20) * 0.14;
  else if (age <= 25) progress = 0.40 + (age - 22) * 0.10;
  else if (age <= 28) progress = 0.70 + (age - 25) * 0.05;
  else progress = 0.85;
  return Math.min(Number(potential), Math.round(draftOvr + gap * progress));
}

function migrateLeagueTalentBalance(player) {
  if (!player || !isGeneratedLeaguePlayer(player) || player._isUser) return false;
  if (Number(player._talentBalanceVersion) >= LEAGUE_TALENT_BALANCE_VERSION) return false;
  var age = getLeaguePlayerAge(player);
  if (age < 21 || age > 29) {
    player._talentBalanceVersion = LEAGUE_TALENT_BALANCE_VERSION;
    return false;
  }
  var gene = getPlayerGene(player);
  var potential = Number(gene && gene.potential);
  var currentOvr = Math.round(Number(player.ovr) || 60);
  if (!Number.isFinite(potential) || currentOvr >= potential) {
    player._talentBalanceVersion = LEAGUE_TALENT_BALANCE_VERSION;
    return false;
  }
  var expectedOvr = getExpectedGeneratedCareerOvr(player, age, potential);
  var compensation = Math.min(2, Math.max(0, expectedOvr - currentOvr));
  player._talentBalanceVersion = LEAGUE_TALENT_BALANCE_VERSION;
  if (compensation <= 0) return false;
  migrateLegacyGeneratedPlayerAttributes(player);
  applyLeaguePlayerOvrChange(player, currentOvr, Math.min(potential, currentOvr + compensation));
  player._talentBalanceMigrationSeason = getCurrentLeagueSeasonNumber();
  refreshGeneratedPlayerType(player);
  return true;
}

function getTalentBalanceMigrationAge(player) {
  if (typeof getLeaguePlayerAge === 'function') {
    try {
      var leagueAge = Number(getLeaguePlayerAge(player));
      if (Number.isFinite(leagueAge)) return leagueAge;
    } catch (error) {}
  }
  var savedAge = Number(player && player._age);
  return Number.isFinite(savedAge) ? savedAge : 99;
}

function migrateLeagueTalentBalanceAll() {
  if (typeof LEAGUE_PLAYER_DATA === 'undefined' || typeof LEAGUE_TEAM_IDS === 'undefined') return 0;
  var allPlayers = [];
  LEAGUE_TEAM_IDS.forEach(function(teamId) {
    allPlayers = allPlayers.concat(LEAGUE_PLAYER_DATA[teamId] || []);
  });
  if (Array.isArray(STATE._freeAgentPool)) allPlayers = allPlayers.concat(STATE._freeAgentPool);

  // V1 只能给单个年轻球员补少量 OVR，无法修复旧存档连续多个选秀届没有
  // 年轻球星的年龄断层。V2 只在版本升级时挑选欠账球员，并在未来三季渐进追赶。
  var topPlayers = allPlayers.filter(function(player) {
    return player && !player._isUser && Number(player.ovr) > 0;
  }).sort(function(left, right) {
    return (Number(right.ovr) || 0) - (Number(left.ovr) || 0);
  }).slice(0, 35);
  var topUnderThirty = topPlayers.filter(function(player) {
    return getTalentBalanceMigrationAge(player) < 30;
  }).length;
  var topPlayerSet = new Set(topPlayers);
  var catchupNeeded = Math.max(0, 12 - topUnderThirty);
  var candidateBuckets = [[], [], []];
  allPlayers.forEach(function(player) {
    if (!player || player._isUser || !isGeneratedLeaguePlayer(player) || topPlayerSet.has(player)) return;
    if (Number(player._talentBalanceVersion) >= LEAGUE_TALENT_BALANCE_VERSION) return;
    var age = getTalentBalanceMigrationAge(player);
    if (age < 21 || age > 29) return;
    var gene = getPlayerGene(player);
    var potential = Number(gene && gene.potential);
    if (!Number.isFinite(potential) || potential < 88 || potential <= Number(player.ovr)) return;
    var bucketIndex = age <= 23 ? 0 : (age <= 26 ? 1 : 2);
    candidateBuckets[bucketIndex].push({
      player: player,
      potential: potential,
      gap: potential - (Number(player.ovr) || 0)
    });
  });
  candidateBuckets.forEach(function(bucket) {
    bucket.sort(function(left, right) {
      return right.potential - left.potential
        || right.gap - left.gap
        || (Number(right.player.ovr) || 0) - (Number(left.player.ovr) || 0)
        || String(left.player.id || '').localeCompare(String(right.player.id || ''));
    });
  });
  var selectedCatchups = 0;
  while (selectedCatchups < catchupNeeded) {
    var selectedThisRound = false;
    for (var bucketIndex = 0; bucketIndex < candidateBuckets.length && selectedCatchups < catchupNeeded; bucketIndex++) {
      var candidate = candidateBuckets[bucketIndex].shift();
      if (!candidate) continue;
      candidate.player._talentCatchupSeasons = Math.max(3, Number(candidate.player._talentCatchupSeasons) || 0);
      selectedCatchups++;
      selectedThisRound = true;
    }
    if (!selectedThisRound) break;
  }

  var changed = 0;
  allPlayers.forEach(function(player) {
    if (migrateLeagueTalentBalance(player)) changed++;
  });
  changed += selectedCatchups;
  if (changed && typeof clearLineupCache === 'function') clearLineupCache();
  return changed;
}

function getCanonicalLeaguePlayer(playerId) {
  if (!playerId || typeof _baseLeagueRosterSnapshot === 'undefined' || !_baseLeagueRosterSnapshot) return null;
  var teams = typeof LEAGUE_TEAM_IDS !== 'undefined' ? LEAGUE_TEAM_IDS : Object.keys(_baseLeagueRosterSnapshot);
  for (var teamIndex = 0; teamIndex < teams.length; teamIndex++) {
    var roster = _baseLeagueRosterSnapshot[teams[teamIndex]] || [];
    for (var playerIndex = 0; playerIndex < roster.length; playerIndex++) {
      if (roster[playerIndex] && roster[playerIndex].id === playerId) return roster[playerIndex];
    }
  }
  return null;
}

function medianLeagueAttributeDelta(player, canonical) {
  var deltas = getLeagueAttributeKeys().filter(function(key) { return key !== 'HAN'; }).map(function(key) {
    return Number(player[key]) - Number(canonical[key]);
  }).filter(Number.isFinite).sort(function(left, right) { return left - right; });
  if (!deltas.length) return 0;
  var middle = Math.floor(deltas.length / 2);
  return deltas.length % 2 ? deltas[middle] : (deltas[middle - 1] + deltas[middle]) / 2;
}

function migrateRealPlayerAttributeSource(player, canonical) {
  if (!player || !canonical || isGeneratedLeaguePlayer(player)) return false;
  if (Number(player._attributeSourceVersion) >= LEAGUE_ATTRIBUTE_SOURCE_VERSION) return false;
  var migration = typeof LEAGUE_ATTRIBUTE_SOURCE_MIGRATION !== 'undefined'
    ? LEAGUE_ATTRIBUTE_SOURCE_MIGRATION
    : null;
  var keys = migration && Array.isArray(migration.attributeKeys) ? migration.attributeKeys : [];
  var legacyValues = migration && migration.legacyById ? migration.legacyById[player.id] : null;
  if (legacyValues && legacyValues.length === keys.length) {
    var canonicalDistance = 0;
    var legacyDistance = 0;
    keys.forEach(function(key, index) {
      canonicalDistance += Math.abs(Number(player[key]) - Number(canonical[key]));
      legacyDistance += Math.abs(Number(player[key]) - Number(legacyValues[index]));
    });
    if (legacyDistance < canonicalDistance) {
      var deltas = keys.map(function(key, index) {
        return Math.round(Number(player[key]) - Number(legacyValues[index]));
      });
      var deltaCounts = {};
      deltas.forEach(function(delta) {
        if (!delta) return;
        deltaCounts[delta] = (deltaCounts[delta] || 0) + 1;
      });
      var uniformLegacyShift = Object.keys(deltaCounts).some(function(delta) {
        return deltaCounts[delta] >= 8;
      });
      keys.forEach(function(key, index) {
        // V8 曾用同一 OVR 差值批量平移十余项属性。检测到这种指纹时直接恢复
        // V9 的逐球员语义画像；正常生涯的分散成长/衰退则继续保留。
        var developmentDelta = uniformLegacyShift ? 0 : Number(player[key]) - Number(legacyValues[index]);
        player[key] = clampLeagueAttribute(Number(canonical[key]) + developmentDelta);
      });
    }
  }
  player._attributeSourceVersion = LEAGUE_ATTRIBUTE_SOURCE_VERSION;
  return true;
}

function migrateRealPlayerAttributeSchema(player, canonical) {
  if (!player || !canonical || isGeneratedLeaguePlayer(player)) return false;
  if (Number(player._attributeSchemaVersion) >= LEAGUE_ATTRIBUTE_SCHEMA_VERSION) return false;
  var developmentDelta = medianLeagueAttributeDelta(player, canonical);
  player.HAN = clampLeagueAttribute(Number(canonical.HAN) + developmentDelta);
  player._attributeSchemaVersion = LEAGUE_ATTRIBUTE_SCHEMA_VERSION;
  return true;
}

function syncLeaguePlayerOvrs() {
  if (typeof LEAGUE_PLAYER_DATA === 'undefined' || typeof LEAGUE_TEAM_IDS === 'undefined') return 0;
  var changed = 0;
  var syncedPlayers = new Set();
  function syncPlayer(player) {
    if (!player || !player.pos || syncedPlayers.has(player)) return;
    syncedPlayers.add(player);
    // 旧存档没有独立抢断属性时，以外防作为一次性迁移基准；新名单和新秀均保存独立 STL。
    if (!Number.isFinite(Number(player.STL))) player.STL = calcOvrAttribute(player, 'PDEF');
    if (isGeneratedLeaguePlayer(player)) {
      migrateLegacyGeneratedPlayerAttributes(player);
      refreshGeneratedPlayerType(player);
      var generatedOvr = calcOVR(player, player.pos);
      if (player.ovr === generatedOvr) return;
      player.ovr = generatedOvr;
      changed++;
      return;
    }
    var canonical = getCanonicalLeaguePlayer(player.id);
    var realPlayerChanged = false;
    if (migrateRealPlayerAttributeSource(player, canonical)) realPlayerChanged = true;
    if (migrateRealPlayerAttributeSchema(player, canonical)) realPlayerChanged = true;
    var sourceOvr = Number(player._sourceOvr)
      || Number(canonical && canonical.ovr)
      || Number(player.ovr)
      || 50;
    var currentFormulaOvr = calcOVR(player, player.pos);
    var canonicalFormulaOvr = canonical ? calcOVR(canonical, canonical.pos) : currentFormulaOvr;
    if (Number(player._sourceOvr) !== sourceOvr) {
      player._sourceOvr = sourceOvr;
      realPlayerChanged = true;
    }
    if (Number(player._sourceFormulaOvr) !== canonicalFormulaOvr) {
      player._sourceFormulaOvr = canonicalFormulaOvr;
      realPlayerChanged = true;
    }
    if (Number(player._ovrAnchorVersion) !== LEAGUE_OVR_ANCHOR_VERSION) {
      player._ovrAnchorVersion = LEAGUE_OVR_ANCHOR_VERSION;
      realPlayerChanged = true;
    }
    if (player.ovr !== currentFormulaOvr) {
      player.ovr = currentFormulaOvr;
      realPlayerChanged = true;
    }
    if (realPlayerChanged) changed++;
  }
  LEAGUE_TEAM_IDS.forEach(function(teamId) {
    (LEAGUE_PLAYER_DATA[teamId] || []).forEach(syncPlayer);
  });
  if (typeof STATE !== 'undefined' && Array.isArray(STATE._freeAgentPool)) {
    STATE._freeAgentPool.forEach(syncPlayer);
  }
  if (changed && typeof clearLineupCache === 'function') clearLineupCache();
  return changed;
}

// ==================== 联盟演变 ====================
var _playerAges = null;
var _playerGenes = null;
var _playerAgeSources = null;
var PLAYER_LOYALTY_GENE_VERSION = 3;
var PLAYER_POTENTIAL_MODEL_VERSION = 2;
// 数据校准：NBA 官方资料显示 Nate Williams（P0168）在 2025-26 赛季为 27 岁；
// 旧年龄表的 73 是明显的脏数据，运行时先用 ID 覆盖，避免进入衰退/退役链路。
// VJ Edgecombe（P0383）为 2025 年新秀，2025-26 赛季校准为 19 岁。
// LeBron James（P0379）在 2025-26 赛季为 41 岁（1984 年 12 月生），确保触发老将生涯周期。
var PLAYER_AGE_OVERRIDES = { P0168: 27, P0383: 19, P0379: 41 };

function loadPlayerAges() {
  if (_playerAges) return;
  _playerAges = {};
  _playerGenes = {};
  _playerAgeSources = {};
  try {
    var data = document.getElementById('player-age-data');
    if (data) {
      var rows = JSON.parse(data.textContent);
      rows.forEach(function(r) {
        _playerAges[r.id] = r.a;
        _playerAgeSources[r.id] = 'published';
        _playerGenes[r.id] = { v: r.v || (1 + Math.floor(rngNext() * 4)) };
      });
      Object.keys(PLAYER_AGE_OVERRIDES).forEach(function(id) {
        _playerAges[id] = PLAYER_AGE_OVERRIDES[id];
        _playerAgeSources[id] = 'official_override';
      });
      // 年龄表是外部资料快照，未覆盖的现实名单不能再无标记地落入 inferAge。
      // 这里保留一个明确的估算来源，后续补齐资料时可按 source 定点替换。
      if (typeof LEAGUE_TEAM_IDS !== 'undefined' && typeof LEAGUE_PLAYER_DATA !== 'undefined') {
        LEAGUE_TEAM_IDS.forEach(function(teamId) {
          (LEAGUE_PLAYER_DATA[teamId] || []).forEach(function(player) {
            if (!player || !player.id || Number.isFinite(Number(_playerAges[player.id]))) return;
            _playerAges[player.id] = inferAge(player.id, player.ovr);
            _playerAgeSources[player.id] = 'ovr_estimate';
            if (!_playerGenes[player.id]) _playerGenes[player.id] = { v: 1 + Math.floor(rngNext() * 4) };
          });
        });
      }
      assignKnownPlayerPotentials();
    }
  } catch(e) {}
}

function getPlayerAge(playerId) {
  loadPlayerAges();
  return _playerAges && _playerAges[playerId] ? _playerAges[playerId] : null;
}

function validateLeaguePlayerAgeData() {
  loadPlayerAges();
  var rows = [];
  var missing = [];
  var invalid = [];
  var estimated = [];
  if (typeof LEAGUE_TEAM_IDS === 'undefined' || typeof LEAGUE_PLAYER_DATA === 'undefined') {
    return { total: 0, rows: 0, missing: [], invalid: [], estimated: [] };
  }
  var seen = {};
  var allPlayers = [];
  LEAGUE_TEAM_IDS.forEach(function(teamId) {
    allPlayers = allPlayers.concat(LEAGUE_PLAYER_DATA[teamId] || []);
  });
  allPlayers = allPlayers.concat(Array.isArray(STATE._freeAgentPool) ? STATE._freeAgentPool : []);
  allPlayers.forEach(function(player) {
    if (!player || !player.id || seen[player.id]) return;
    seen[player.id] = true;
    rows.push(player.id);
    var age = Number(_playerAges[player.id]);
    var ageSource = _playerAgeSources[player.id];
    if (!Number.isFinite(age) && Number.isFinite(Number(player._age))) {
      age = Number(player._age);
      ageSource = player._ageSource || 'player_record';
    }
    if (!Number.isFinite(age)) missing.push(player.id);
    else if (age < 18 || age > 45) invalid.push({ id: player.id, age: age });
    if (ageSource === 'ovr_estimate') estimated.push(player.id);
  });
  return { total: rows.length, rows: Object.keys(_playerAges || {}).length, missing: missing, invalid: invalid, estimated: estimated };
}

function generatedPlayerStableHash(player) {
  var text = String(player && (player._prospectId || player.id) || 'generated');
  var hash = 2166136261;
  for (var index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function inferGeneratedPlayerDraftOvr(player, currentOvr, age) {
  var saved = Number(player && player._draftOvr);
  if (Number.isFinite(saved)) return Math.max(50, Math.min(84, Math.round(saved)));
  var currentSeason = typeof getCurrentLeagueSeasonNumber === 'function' ? getCurrentLeagueSeasonNumber() : 1;
  var rookieSeason = Number(player && player._rookieSeason);
  var seasonsPlayed = Number.isFinite(rookieSeason)
    ? Math.max(0, currentSeason - rookieSeason)
    : Math.max(0, (Number(age) || 20) - 20);
  var estimated = Math.round((Number(currentOvr) || 60) - Math.min(12, seasonsPlayed * 1.25));
  estimated = Math.max(50, Math.min(84, estimated));
  if (player) player._draftOvr = estimated;
  return estimated;
}

function isEliteGeneratedDraftPick(player) {
  if (!isGeneratedLeaguePlayer(player)) return false;
  var draftOvr = Number(player && player._draftOvr);
  if (!Number.isFinite(draftOvr)) {
    draftOvr = inferGeneratedPlayerDraftOvr(player, Number(player && player.ovr) || 60, getLeaguePlayerAge(player));
  }
  return draftOvr >= 80 && draftOvr <= 84;
}

function getEliteDraftGrowthBonus(player, age) {
  if (!isEliteGeneratedDraftPick(player)) return 0;
  var bonus = age <= 22 ? 0.30 : (age <= 25 ? 0.32 : (age <= 28 ? 0.24 : 0));
  // 每届约四名精英中只有一名获得时代级兑现加成；不提高入联盟 OVR，
  // 也不延长 30 岁后的巅峰，用极少数顶尖球员维持联盟最高值。
  if (generatedPlayerStableHash(player) % 4 === 0) {
    if (age <= 22) bonus += 0.12;
    else if (age <= 25) bonus += 0.18;
    else if (age <= 28) bonus += 0.14;
  }
  return bonus;
}

function isHighGeneratedDraftPick(player) {
  if (!isGeneratedLeaguePlayer(player)) return false;
  var draftOvr = Number(player && player._draftOvr);
  if (!Number.isFinite(draftOvr)) {
    draftOvr = inferGeneratedPlayerDraftOvr(player, Number(player && player.ovr) || 60, getLeaguePlayerAge(player));
  }
  return draftOvr >= 75 && draftOvr <= 79;
}

function getHighDraftGrowthBonus(player, age) {
  if (!isHighGeneratedDraftPick(player)) return 0;
  if (age <= 22) return 0.14;
  if (age <= 25) return 0.09;
  if (age <= 28) return 0.05;
  return 0;
}

function getGeneratedPlayerAgeFactor(player, age, ovr) {
  if (age <= 22) return 1 + rngNext() * 1.5;
  if (age <= 28) return (rngNext() - 0.35) * 1.2;
  if (age <= 30) return (rngNext() - 0.62) * 0.8;
  // 年龄曲线只由年龄决定，不能因为当前 OVR 或选秀档位而冻结衰退。
  // 31–32 岁轻度下滑，33–34 岁稳定下滑，35 岁后快速下滑（相对初版略加重）。
  if (age <= 32) return -0.50 - rngNext() * 0.55;
  if (age <= 34) return -1.12 - rngNext() * 0.92;
  if (age <= 35) return -1.88 - rngNext() * 1.15;
  return -2.32 - rngNext() * 2.25;
}

function getGeneratedPlayerPotentialCap(player, draftOvr) {
  var identity = String(player && (player._prospectId || player.id) || '');
  if (typeof MVP_STAR_PROSPECT_IDS !== 'undefined') {
    var starIndex = MVP_STAR_PROSPECT_IDS.indexOf(identity);
    if (starIndex >= 0) {
      var authoredStarCaps = [98, 96, 95, 99, 97, 96, 99, 97, 96];
      return authoredStarCaps[starIndex] || 96;
    }
  }
  if (draftOvr <= 59) return 80;
  if (draftOvr <= 67) return 86;
  if (draftOvr <= 74) return 92;
  if (draftOvr <= 79) return 96;
  return 98;
}

function inferGeneratedPlayerPotential(player, age) {
  var currentOvr = Math.max(50, Math.min(99, Number(player && player.ovr) || 50));
  var draftOvr = inferGeneratedPlayerDraftOvr(player, currentOvr, age);
  var identity = String(player && (player._prospectId || player.id) || '');
  var starIndex = typeof MVP_STAR_PROSPECT_IDS !== 'undefined'
    ? MVP_STAR_PROSPECT_IDS.indexOf(identity)
    : -1;
  var potential;
  if (starIndex >= 0) {
    potential = getGeneratedPlayerPotentialCap(player, draftOvr);
  } else {
    var variance = generatedPlayerStableHash(player) % 3;
    var baseGain = draftOvr <= 59 ? 13 : (draftOvr <= 67 ? 14 : (draftOvr <= 74 ? 15 : (draftOvr <= 79 ? 15 : 18)));
    potential = Math.min(getGeneratedPlayerPotentialCap(player, draftOvr), draftOvr + baseGain + variance);
  }
  // 不回退已有存档的当前能力；新版只阻止后续继续越过合理上限。
  return Math.max(currentOvr, Math.min(99, potential));
}

function inferLeaguePlayerPotential(player, age) {
  var currentOvr = Number(player && player.ovr) || 55;
  if (isGeneratedLeaguePlayer(player)) return inferGeneratedPlayerPotential(player, age);
  var ovr = Math.max(55, Math.min(99, currentOvr));
  var playerAge = Number(age) || inferAge(player && player.id, ovr);
  if (playerAge >= 29) return ovr;

  // 现实球员以当前能力相对同龄人的领先程度决定上限，年轻球员保留更多成长空间。
  var ageRoom = Math.max(1, 29 - playerAge);
  var ageBenchmark = Math.max(68, Math.min(88, 68 + Math.max(0, playerAge - 18) * 2));
  var abilityBonus = Math.max(-2, Math.min(3, Math.round((ovr - ageBenchmark) / 5)));
  var potential = ovr + Math.max(0, ageRoom + abilityBonus);
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
      if (typeof gene.potential !== 'number'
        || (isGeneratedLeaguePlayer(player) && Number(gene.potentialVersion) < PLAYER_POTENTIAL_MODEL_VERSION)) {
        var age = _playerAges[player.id] || player._age || inferAge(player.id, player.ovr);
        gene.potential = inferLeaguePlayerPotential(player, age);
        gene.potentialVersion = PLAYER_POTENTIAL_MODEL_VERSION;
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
    if (playerObject && isGeneratedLeaguePlayer(playerObject)
      && Number(existingGene.potentialVersion) < PLAYER_POTENTIAL_MODEL_VERSION) {
      existingGene.potential = inferLeaguePlayerPotential(playerObject, getLeaguePlayerAge(playerObject));
      existingGene.potentialVersion = PLAYER_POTENTIAL_MODEL_VERSION;
    }
    return ensurePlayerLoyaltyGene(existingGene, playerObject || playerId);
  }
  var age = playerObject ? getLeaguePlayerAge(playerObject) : null;
  var g = {
    v: 1 + Math.floor(rngNext() * 4),
    potential: inferLeaguePlayerPotential(playerObject, age),
    potentialVersion: PLAYER_POTENTIAL_MODEL_VERSION,
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

function roundLeagueOvrChange(rawChange) {
  var magnitude = Math.abs(Number(rawChange) || 0);
  if (magnitude < 0.05) return 0;
  if (magnitude < 1) return rngNext() < magnitude ? Math.sign(rawChange || 1) : 0;
  return Math.sign(rawChange) * Math.round(magnitude);
}

function getPotentialGrowthBias(potential, ovr, age) {
  if (typeof potential !== 'number' || age > 29) return 0;
  var potentialGap = potential - ovr;
  if (potentialGap <= 0) return 0;
  if (age <= 22) return Math.min(1.35, potentialGap * 0.11);
  if (age <= 25) return Math.min(1.05, potentialGap * 0.09);
  if (age <= 28) return Math.min(0.60, potentialGap * 0.06);
  return Math.min(0.25, potentialGap * 0.03);
}

function inferAge(playerId, ovr) {
  if (ovr >= 90) return 28;
  if (ovr >= 80) return 26;
  if (ovr >= 70) return 24;
  return 22;
}

function getLeaguePlayerAge(player) {
  if (player && typeof player._age === 'number') {
    player._ageSource = player._ageSource || 'player_record';
    return player._age;
  }
  var age = getPlayerAge(player && player.id) || inferAge(player && player.id, player && player.ovr);
  if (player) {
    player._age = age;
    player._ageSource = (_playerAgeSources && _playerAgeSources[player.id]) || 'runtime_estimate';
  }
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
  evolveUnsignedFreeAgents();
  var carriedFreeAgents = Array.isArray(STATE._freeAgentPool) ? STATE._freeAgentPool.slice() : [];
  var teams = typeof LEAGUE_TEAM_IDS !== 'undefined' ? LEAGUE_TEAM_IDS : [];
  migrateLeagueTalentBalanceAll();
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
      var legacyStarWithoutTenure = !Object.prototype.hasOwnProperty.call(p, '_teamTenure')
        && !!STATE._contractsInited && Number(p.ovr) >= 90;
      if (p._lastTeam === t) p._teamTenure = Math.max(1, Number(p._teamTenure) || 1) + 1;
      else p._teamTenure = legacyStarWithoutTenure ? 3 : 1;
      p._lastTeam = t;
      if (!p._birdTeam && p._teamTenure >= 3) p._birdTeam = t;
      getPlayerSalary(p);
      var gene = getPlayerGene(p);
      var volatility = gene.v;
      var ageFactor = getGeneratedPlayerAgeFactor(p, age, p.ovr);
      var volFactor = (rngNext() - 0.5) * volatility * 0.6;
      var randFactor = (rngNext() - 0.5) * 1.5;
      var change = ageFactor * 0.5 + volFactor * 0.3 + randFactor * 0.2;
      change += getPotentialGrowthBias(gene.potential, p.ovr, age);
      change += getEliteDraftGrowthBonus(p, age);
      change += getHighDraftGrowthBonus(p, age);
      var catchupActive = isGeneratedLeaguePlayer(p)
        && age <= 29
        && Number(p._talentCatchupSeasons) > 0
        && Number(gene.potential) > Number(p.ovr);
      if (catchupActive) change += 0.55;
      if (change > 0 && isGeneratedLeaguePlayer(p)
        && Number(p._talentBalanceMigrationSeason) === getCurrentLeagueSeasonNumber()) {
        change = 0;
      }
      if (change <= 0 && isGeneratedLeaguePlayer(p) && age <= 25 && Number(gene.potential) - Number(p.ovr) >= 8) {
        if (rngNext() < (isEliteGeneratedDraftPick(p) ? 0.48 : 0.38)) change = 0.85;
      }
      if (isMvpStar(p) && age <= 26) change += 0.25 + rngNext() * 0.40; // 重点新秀仍更快成长，但不再稳定每年跳 2 点
      if (change > 0 && p.ovr >= gene.potential) change = 0;
      change = roundLeagueOvrChange(change);
      var minimumOvr = isGeneratedLeaguePlayer(p) ? 50 : 55;
      var newOvr = Math.max(minimumOvr, Math.min(99, p.ovr + change));
      if (change > 0 && Number.isFinite(Number(gene.potential))) newOvr = Math.min(newOvr, Number(gene.potential));
      if (newOvr !== p.ovr) {
        var oldOvr = p.ovr;
        applyLeaguePlayerOvrChange(p, oldOvr, newOvr);
      }
      var retireChance = getLeaguePlayerRetirementChance(p, age);
      if (rngNext() * 100 < retireChance) {
        STATE._leagueChanges.retired.push({ displayName: p.cname, playerId: p.id, hidden: !!p._veteranTribute, ovr: p.ovr, team: t, age: age });
        if (t === STATE.careerTeam && STATE._leagueChanges.teamChanges[t]) {
          STATE._leagueChanges.teamChanges[t].retired.push(p.cname);
        }
        return;
      }
      p._age = age + 1; // 临时实验：球员年龄真实上涨，每年 +1
      var migratedThisSeason = Number(p._talentBalanceMigrationSeason) === getCurrentLeagueSeasonNumber();
      if (migratedThisSeason) {
        delete p._talentBalanceMigrationSeason;
      }
      if (catchupActive && !migratedThisSeason) {
        p._talentCatchupSeasons = Math.max(0, Number(p._talentCatchupSeasons) - 1);
        if (!p._talentCatchupSeasons) delete p._talentCatchupSeasons;
      } else if (age > 29 || Number(gene.potential) <= Number(p.ovr)) {
        delete p._talentCatchupSeasons;
      }
      refreshGeneratedPlayerType(p);
      newRoster.push(p);
    });
    LEAGUE_PLAYER_DATA[t] = newRoster;
  });

  // ── 合同初始化（一次性）──
  // 初始存档的合同代表“进入新赛季时可用的合同年限”，不能在同一次
  // 休赛期流程里又立即 contract--，否则 1 年合同会刚生成就到期。
  var contractsJustInitialized = !STATE._contractsInited;
  if (contractsJustInitialized) {
    LEAGUE_TEAM_IDS.forEach(function(t) {
      (LEAGUE_PLAYER_DATA[t] || []).forEach(function(p) {
        if (p.contract === undefined) {
          var age = getLeaguePlayerAge(p);
          p.contract = randomContractByAge(age, p, { birdRights: hasFreeAgentBirdRights(p, t) });
        }
        getPlayerSalary(p);
      });
    });
    STATE._contractsInited = true;
  }

  if (contractsJustInitialized) {
    STATE._leagueChanges.freeAgentCount = 0;
    STATE._freeAgentPool = Array.isArray(STATE._freeAgentPool) ? STATE._freeAgentPool : [];
    return;
  }

  // ── 合同扣减 + 留队判定 + 到期剥离 ──
  var freeAgents = [];
  LEAGUE_TEAM_IDS.forEach(function(t) {
    var roster = LEAGUE_PLAYER_DATA[t];
    if (!roster) return;
    var newRoster = [];
    roster.forEach(function(p) {
      var remainingContractYears = p.contract === undefined ? 4 : Number(p.contract);
      if (!Number.isFinite(remainingContractYears)) remainingContractYears = 0;
      p.contract = Math.max(0, Math.floor(remainingContractYears) - 1);
      if (p.contract <= 0) {
        // 留队判定
        var age = getLeaguePlayerAge(p);
        var hist = STATE._teamHistory ? STATE._teamHistory[t] : null;
        var roleContext = seasonRoleContexts[t + ':' + p.id];
        var stayRate = calculateContractStayRate(p, hist, roleContext);

        if (rngNext() < stayRate) {
          // 留队意愿只是第一道门；工资帽不再否决续约，工资仅记录球队成本。
          var retentionOffer = buildContractOffer(p, t, {
            source: 'retention',
            round: 0,
            birdRights: hasFreeAgentBirdRights(p, t)
          });
          if (!retentionOffer) {
            p._origTeam = t;
            p.contract = 0;
            delete p.salary;
            freeAgents.push(p);
            STATE._leagueChanges.freeAgents = STATE._leagueChanges.freeAgents || [];
            STATE._leagueChanges.freeAgents.push({ name: p.cname, playerId: p.id, ovr: p.ovr, team: t, age: age, reason: 'retention_unavailable' });
            return;
          }

          // 留队续约
          p.contract = retentionOffer.years;
          p.salary = retentionOffer.salary;
          p._salaryVersion = FREE_AGENT_MARKET.salaryVersion;
          var loyaltyChange = recordPlayerLoyaltyDecision(p, 'renew', p.contract, false, t);
          p._justSigned = true;
          newRoster.push(p);
          STATE._leagueChanges.stayed = STATE._leagueChanges.stayed || [];
          STATE._leagueChanges.stayed.push({ name: p.cname, playerId: p.id, team: t, years: p.contract, loyaltyChange: loyaltyChange });
        } else {
          // 离队进自由池
          p._origTeam = t;
          p.contract = 0;
          delete p.salary;
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
  var mergedFreeAgents = mergeFreeAgentPools(carriedFreeAgents, freeAgents);
  STATE._leagueChanges.freeAgentCount = mergedFreeAgents.length;
  STATE._freeAgentPool = mergedFreeAgents;
}
