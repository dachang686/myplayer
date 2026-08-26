(function installManagerApp(global) {
  'use strict';

  var root;
  var main;
  var nav;
  var saveActions;
  var toast;
  var view = 'dashboard';
  var standingsView = 'teams';
  var standingsConference = null;
  var playerRankingStat = 'pts';
  var playerRankingLimit = 10;
  var seasonCalendarMonth = null;
  var tradeMode = 'direct';
  var tradeOutgoingIds = [];
  var tradeIncomingIds = [];
  var tradePartnerTeamId = null;
  var tradeInquiry = null;
  var toastTimer = null;
  var storageBusy = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function teamName(teamId) { return global.ManagerEngine.teamName(teamId); }
  function playerOvr(player) {
    return typeof global.getUnifiedPlayerOvr === 'function'
      ? global.getUnifiedPlayerOvr(player, player && player.pos)
      : (Number(player && player.ovr) || 0);
  }
  function leagueData() { return typeof LEAGUE_PLAYER_DATA !== 'undefined' ? LEAGUE_PLAYER_DATA : (global.LEAGUE_PLAYER_DATA || {}); }
  function config() { return typeof SIM_CONFIG !== 'undefined' ? SIM_CONFIG : (global.SIM_CONFIG || {}); }
  function teamIds() { return (typeof LEAGUE_TEAM_IDS !== 'undefined' ? LEAGUE_TEAM_IDS : Object.keys(leagueData())).slice(); }
  function state() { return global.MANAGER_STATE; }
  function money(value) { return Number(value || 0).toFixed(0); }

  function showToast(message, isError) {
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.kind = isError ? 'error' : 'success';
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { toast.hidden = true; }, 3200);
  }

  function setSession(isActive) {
    nav.hidden = !isActive;
    saveActions.hidden = !isActive;
    root.classList.toggle('is-session-active', isActive);
  }

  function rotationValidation(current) {
    return current ? global.ManagerState.validateRotation(current.leagueData[current.selectedTeam] || [], current.rotation) : null;
  }

  function updateActionAvailability(current) {
    current = current || state();
    var validation = rotationValidation(current);
    var rotationBlocked = !!(current && current.season.phase === 'regular' && validation && !validation.valid);
    var reason = rotationBlocked ? (validation.errors[0] || '请先修正轮换配置。') : '';
    if (!root) return;
    root.classList.toggle('is-storage-busy', storageBusy);
    root.querySelectorAll('[data-action="save-game"], [data-action="load-save"]').forEach(function(button) {
      button.disabled = storageBusy;
      button.setAttribute('aria-busy', storageBusy ? 'true' : 'false');
    });
    var tradeWindowClosed = !current || !current.season || current.season.phase !== 'regular';
    root.querySelectorAll('[data-action="complete-trade"], [data-action="run-trade-inquiry"], [data-action="use-trade-inquiry-offer"], [data-action="select-trade-outgoing"], [data-action="select-trade-incoming"], [data-trade-team]').forEach(function(button) {
      var blocked = storageBusy || tradeWindowClosed || button.dataset.tradeReady === 'false';
      button.disabled = blocked;
      button.setAttribute('aria-busy', storageBusy ? 'true' : 'false');
      button.setAttribute('aria-disabled', blocked ? 'true' : 'false');
    });
    root.querySelectorAll('[data-action="set-trade-mode"]').forEach(function(button) {
      button.disabled = storageBusy;
      button.setAttribute('aria-busy', storageBusy ? 'true' : 'false');
    });
    root.querySelectorAll('[data-action="next-step"], [data-action="simulate-next"], [data-action="simulate-regular"], [data-action="simulate-to-season-day"]').forEach(function(button) {
      var blocked = storageBusy || rotationBlocked;
      button.disabled = blocked;
      button.setAttribute('aria-disabled', blocked ? 'true' : 'false');
      button.title = rotationBlocked ? reason : '';
      button.setAttribute('aria-label', rotationBlocked ? '无法推进：' + reason : button.textContent.trim());
    });
  }

  function setStorageBusy(nextBusy) {
    storageBusy = nextBusy;
    updateActionAvailability();
  }

  function renderWelcome() {
    setSession(false);
    main.innerHTML = '<section class="manager-welcome">' +
      '<div class="manager-eyebrow">MANAGER MODE / 01</div>' +
      '<h1>把一支球队，带到<br><span>它应有的位置。</span></h1>' +
      '<p class="manager-lede">选择执教球队，搭建自己的轮换，跑完一个完整赛季。经理存档与球员生涯完全分开。</p>' +
      '<div class="manager-welcome-grid">' +
        '<div class="manager-welcome-note"><strong>纵向切片</strong><span>常规赛 · 季后赛 · 董事会评价</span></div>' +
        '<div class="manager-welcome-note"><strong>独立存档</strong><span>court_forge_manager_v1 · 经理槽位 1</span></div>' +
      '</div>' +
      '<div class="manager-section-heading"><span>选择执教球队</span><small>30 支球队 · 2026-27 赛季</small></div>' +
      '<div class="manager-team-grid">' + teamIds().map(function(id) {
        var roster = leagueData()[id] || [];
        var power = roster.slice().sort(function(a, b) { return playerOvr(b) - playerOvr(a); }).slice(0, 5).reduce(function(sum, player) { return sum + playerOvr(player); }, 0) / Math.max(1, Math.min(5, roster.length));
        return '<button class="manager-team-card" type="button" data-action="select-team" data-team="' + escapeHtml(id) + '">' +
          '<span class="manager-team-code">' + escapeHtml(id) + '</span>' +
          '<span class="manager-team-copy"><strong>' + escapeHtml(teamName(id)) + '</strong><small>核心强度 ' + Math.round(power) + '</small></span>' +
          '<span class="manager-arrow" aria-hidden="true">↗</span>' +
        '</button>';
      }).join('') + '</div>' +
      '<div class="manager-welcome-footer"><button class="manager-button manager-button-secondary" type="button" data-action="load-save">读取已有经理存档</button><span>本页不会读取球员模式存档；可在这里读取已有经理进度。</span></div>' +
    '</section>';
  }

  function ownerDirective(current, record) {
    var goal = current.owner.goal;
    var wins = Number(record.wins) || 0;
    var losses = Number(record.losses) || 0;
    var gamesRemaining = Math.max(0, 82 - wins - losses);
    var winsRemaining = Math.max(0, Number(goal.targetWins) - wins);
    if (current.season.phase === 'regular') {
      if (!winsRemaining) {
        return { title: '常规赛胜场目标已达成', detail: '董事会要求“' + goal.label + '”。当前战绩 ' + wins + '-' + losses + '，请在剩余 ' + gamesRemaining + ' 场中为季后赛保持竞争状态。' };
      }
      if (winsRemaining > gamesRemaining) {
        return { title: '常规赛胜场目标已无法达成', detail: '董事会原目标是“' + goal.label + '”。当前战绩 ' + wins + '-' + losses + '，剩余 ' + gamesRemaining + ' 场，赛季结束后将按最终表现评估。' };
      }
      return { title: '董事会要求：至少 ' + goal.targetWins + ' 胜', detail: '当前战绩 ' + wins + '-' + losses + '，剩余 ' + gamesRemaining + ' 场，还需要 ' + winsRemaining + ' 胜以达到常规赛目标。' };
    }
    if (current.season.phase === 'playoffs') {
      return { title: '董事会要求：' + goal.label, detail: '常规赛已结束。请在季后赛中至少完成既定目标，当前已推进至第 ' + (Number(current.season.userRound) || 0) + ' 轮。' };
    }
    var evaluation = current.owner.evaluation || current.owner;
    return { title: evaluation.label || '赛季评估已完成', detail: evaluation.summary || ('董事会目标为“' + goal.label + '”，最终战绩 ' + wins + '-' + losses + '。') };
  }

  function renderDashboard() {
    var current = state();
    var record = current.season.standings[current.selectedTeam] || { wins: 0, losses: 0 };
    var allRanked = global.ManagerEngine.overallStandingsList(current);
    var place = allRanked.indexOf(current.selectedTeam) + 1;
    var next = current.season.phase === 'regular' ? global.ManagerEngine.getNextRegularGame(current) : null;
    var opponent = next ? (next.home === current.selectedTeam ? next.away : next.home) : null;
    var phaseLabel = current.season.phase === 'regular' ? '常规赛进行中' : (current.season.phase === 'playoffs' ? '季后赛进行中' : '赛季已结束');
    var owner = current.owner.evaluation || current.owner;
    var directive = ownerDirective(current, record);
    main.innerHTML = '<section class="manager-page manager-dashboard">' +
      '<div class="manager-page-head"><div><div class="manager-eyebrow">经理主页 / ' + escapeHtml(current.seasonLabel) + '</div><h1>' + escapeHtml(teamName(current.selectedTeam)) + '</h1><p>' + escapeHtml(phaseLabel) + ' · 董事会目标：' + escapeHtml(current.owner.goal.label) + '</p></div></div>' +
      '<div class="manager-stat-strip"><div><small>战绩</small><strong>' + record.wins + '-' + record.losses + '</strong></div><div><small>联盟排名</small><strong>#' + (place || '—') + '</strong></div><div><small>目标完成度</small><strong>' + (owner.score || current.owner.rating) + '<em>/100</em></strong></div></div>' +
      '<div class="manager-dashboard-grid">' +
        '<article class="manager-panel manager-next-game"><div class="manager-panel-kicker">NEXT GAME</div>' + (next ? '<div class="manager-matchup"><div><strong>' + escapeHtml(teamName(next.home)) + '</strong><small>' + escapeHtml(next.home) + '</small></div><span>VS</span><div class="manager-matchup-away"><strong>' + escapeHtml(teamName(next.away)) + '</strong><small>' + escapeHtml(next.away) + '</small></div></div><p>第 ' + next.gameNum + ' 场 · 赛季日程第 ' + next.day + ' 天</p>' : '<div class="manager-empty-line">常规赛已完成，准备迎接季后赛。</div>') + '</article>' +
        '<article class="manager-panel manager-owner-panel"><div class="manager-panel-kicker">OWNER CHECK-IN</div><div class="manager-owner-score"><strong>' + (owner.score || current.owner.rating) + '</strong><span>/100</span><small>' + escapeHtml(owner.label || '等待赛季结果') + '</small></div><p>' + escapeHtml(owner.summary || '先把轮换稳定下来，再让结果替你说话。') + '</p></article>' +
      '</div>' +
      '<article class="manager-panel manager-command-panel"><div class="manager-owner-directive"><div class="manager-panel-kicker">董事会指令 / OWNER DIRECTIVE</div><h2>' + escapeHtml(directive.title) + '</h2><p>' + escapeHtml(directive.detail) + '</p></div></article>' +
    '</section>';
  }

  function updateNextAction() {
    var label = document.getElementById('manager-next-label');
    var current = state();
    if (!label || !current) return;
    var validation = rotationValidation(current);
    if (current.season.phase === 'regular' && validation && !validation.valid) label.textContent = '先修正轮换';
    else if (current.season.phase === 'regular') label.textContent = '推进下一场';
    else if (current.season.phase === 'playoffs') label.textContent = '推进季后赛';
    else label.textContent = '查看赛季总结';
    updateActionAvailability(current);
  }

  function nextStep() {
    var current = state();
    if (!current) return;
    if (current.season.phase === 'regular') simulate('simulate-next');
    else if (current.season.phase === 'playoffs') simulate('simulate-playoff-next');
    else {
      view = 'standings';
      render();
    }
  }

  function renderRoster() {
    var current = state();
    var roster = current.leagueData[current.selectedTeam] || [];
    var validation = global.ManagerState.validateRotation(roster, current.rotation);
    var sorted = roster.slice().sort(function(a, b) {
      return (Number(current.rotation[b.id] && current.rotation[b.id].minutes) || 0) - (Number(current.rotation[a.id] && current.rotation[a.id].minutes) || 0) || (playerOvr(b) - playerOvr(a));
    });
    main.innerHTML = '<section class="manager-page manager-roster-page">' +
      '<div class="manager-page-head"><div><div class="manager-eyebrow">阵容办公室 / ROTATION</div><h1>把每一分钟都安排好。</h1><p>首发必须覆盖五个位置，轮换人数 9 至 11 人，总时间严格为 240 分钟。</p></div></div>' +
      '<div class="manager-rotation-status ' + (validation.valid ? 'is-valid' : 'is-invalid') + '"><div><strong data-rotation-total>' + validation.totalMinutes + '<em>/240</em></strong><span>总上场时间</span></div><div><strong data-rotation-active>' + validation.activeCount + '<em>/9–11</em></strong><span>轮换人数</span></div><div><strong data-rotation-starters>' + validation.starterCount + '<em>/5</em></strong><span>首发人数</span></div><span class="manager-validation-label" data-rotation-label>' + (validation.valid ? '✓ 轮换合法' : '需要修正') + '</span></div>' +
      '<div class="manager-error-list" data-rotation-errors role="alert" aria-live="assertive"' + (validation.valid ? ' hidden' : '') + '>' + validation.errors.map(function(error) { return '<div>! ' + escapeHtml(error) + '</div>'; }).join('') + '</div>' +
      '<div class="manager-roster-list">' + sorted.map(function(player) {
        var assignment = current.rotation[player.id] || { starter: false, minutes: 0 };
        var positions = escapeHtml(String(player.pos || '').replace(/\s+/g, ' '));
        return '<article class="manager-player-row ' + (assignment.starter ? 'is-starter' : '') + ' ' + (Number(assignment.minutes) > 0 ? 'is-active' : 'is-inactive') + '" data-rotation-player="' + escapeHtml(player.id) + '">' +
          '<div class="manager-player-rank">' + (assignment.starter ? 'S' : (Number(assignment.minutes) > 0 ? 'R' : '—')) + '</div>' +
          '<div class="manager-player-copy"><strong>' + escapeHtml(player.cname || player.name || '球员') + '</strong><span>' + positions + ' · OVR ' + playerOvr(player) + '</span></div>' +
          '<label class="manager-minute-field"><span>分钟</span><input type="number" min="0" max="48" step="1" value="' + (Number(assignment.minutes) || 0) + '" data-minute-player="' + escapeHtml(player.id) + '"></label>' +
          '<button class="manager-toggle-button" type="button" data-action="toggle-starter" data-player="' + escapeHtml(player.id) + '" aria-pressed="' + (!!assignment.starter) + '">' + (assignment.starter ? '首发' : '轮换') + '</button>' +
        '</article>';
      }).join('') + '</div>' +
      '<div class="manager-roster-footer"><span>修改会即时写入经理状态，点击下方保存后刷新仍可恢复。</span></div>' +
    '</section>';
  }

  function playerName(player) {
    return player && (player.cname || player.name || player.id) || '球员';
  }

  function tradePlayerNames(players) {
    return (players || []).map(playerName).join('、') || '未选择球员';
  }

  function selectedTradePlayers(roster, playerIds) {
    var selected = {};
    (playerIds || []).forEach(function(playerId) { selected[playerId] = true; });
    return (roster || []).filter(function(player) { return selected[player.id]; });
  }

  function validTradeSelection(roster, playerIds) {
    var available = {};
    (roster || []).forEach(function(player) { available[player.id] = true; });
    var seen = {};
    return (playerIds || []).filter(function(playerId) {
      if (!available[playerId] || seen[playerId]) return false;
      seen[playerId] = true;
      return true;
    }).slice(0, global.ManagerEngine.MAX_TRADE_PLAYERS || 3);
  }

  function toggleTradeSelection(selection, playerId) {
    var next = (selection || []).slice();
    var index = next.indexOf(playerId);
    if (index >= 0) {
      next.splice(index, 1);
      return next;
    }
    var max = global.ManagerEngine.MAX_TRADE_PLAYERS || 3;
    if (next.length >= max) {
      showToast('每边最多选择 ' + max + ' 名球员。', true);
      return next;
    }
    next.push(playerId);
    return next;
  }

  function tradeInquiryKey(playerIds) {
    return (playerIds || []).slice().sort().join('|');
  }

  function clearTradeInquiry() {
    tradeInquiry = null;
  }

  function tradeableTeams(current) {
    return teamIds().filter(function(teamId) {
      return teamId !== current.selectedTeam && Array.isArray(current.leagueData[teamId]);
    });
  }

  function renderTrade() {
    var current = state();
    var roster = (current.leagueData[current.selectedTeam] || []).slice().sort(function(first, second) {
      return playerOvr(second) - playerOvr(first) || String(first.id).localeCompare(String(second.id));
    });
    var teams = tradeableTeams(current);
    if (teams.indexOf(tradePartnerTeamId) < 0) tradePartnerTeamId = teams[0] || null;
    var partnerRoster = tradePartnerTeamId ? (current.leagueData[tradePartnerTeamId] || []).slice().sort(function(first, second) {
      return playerOvr(second) - playerOvr(first) || String(first.id).localeCompare(String(second.id));
    }) : [];
    tradeOutgoingIds = validTradeSelection(roster, tradeOutgoingIds);
    tradeIncomingIds = validTradeSelection(partnerRoster, tradeIncomingIds);
    var maxPlayers = global.ManagerEngine.MAX_TRADE_PLAYERS || 3;
    var outgoing = selectedTradePlayers(roster, tradeOutgoingIds);
    var incoming = selectedTradePlayers(partnerRoster, tradeIncomingIds);
    var proposal = global.ManagerEngine.evaluateTrade(current, tradeOutgoingIds, tradeIncomingIds);
    var windowOpen = current.season.phase === 'regular';
    var inquiryKey = tradeInquiryKey(tradeOutgoingIds);
    if (tradeInquiry && tradeInquiry.key !== inquiryKey) clearTradeInquiry();
    var inquiryResult = tradeInquiry && tradeInquiry.result;
    var outgoingChoices = roster.map(function(player) {
      var selected = tradeOutgoingIds.indexOf(player.id) >= 0;
      return '<button type="button" class="manager-trade-player-choice ' + (selected ? 'is-selected' : '') + '" data-action="select-trade-outgoing" data-player="' + escapeHtml(player.id) + '" aria-pressed="' + selected + '"' + (windowOpen ? '' : ' disabled') + '>' +
        '<span><b>' + escapeHtml(playerName(player)) + '</b><small>' + escapeHtml(player.pos || '位置待定') + '</small></span><strong>' + playerOvr(player) + '</strong>' +
      '</button>';
    }).join('');
    var incomingChoices = partnerRoster.map(function(player) {
      var selected = tradeIncomingIds.indexOf(player.id) >= 0;
      return '<button type="button" class="manager-trade-player-choice ' + (selected ? 'is-selected' : '') + '" data-action="select-trade-incoming" data-player="' + escapeHtml(player.id) + '" aria-pressed="' + selected + '"' + (windowOpen ? '' : ' disabled') + '>' +
        '<span><b>' + escapeHtml(playerName(player)) + '</b><small>' + escapeHtml(player.pos || '位置待定') + '</small></span><strong>' + playerOvr(player) + '</strong>' +
      '</button>';
    }).join('');
    var history = (current.tradeHistory || []).slice().reverse().slice(0, 4).map(function(trade) {
      return '<div class="manager-trade-history-row"><span>第 ' + (Number(trade.scheduleIndex) + 1) + ' 场前</span><b>' + escapeHtml(tradePlayerNames(trade.sent)) + ' → ' + escapeHtml(teamName(trade.partnerTeam)) + '</b><small>换回 ' + escapeHtml(tradePlayerNames(trade.received)) + (trade.rotationReset ? ' · 轮换已重置' : '') + '</small></div>';
    }).join('');
    var assessment = proposal.valid ? (proposal.accepted ? '对方接受报价' : '对方暂不接受') : proposal.reason;
    var assessmentDetail = proposal.valid ? '送出价值 ' + proposal.outgoingValue.toFixed(1) + ' · 得到价值 ' + proposal.incomingValue.toFixed(1) + ' · 对方评估 ' + (proposal.acceptedMargin >= 0 ? '+' : '') + proposal.acceptedMargin.toFixed(1) : '双方各选 1 至 ' + maxPlayers + ' 名球员后生成评估。';
    var outgoingBuilder = '<article class="manager-panel manager-trade-builder"><div class="manager-trade-builder-heading"><div class="manager-panel-kicker">STEP 1 · 送出资产包</div><span class="manager-trade-selection-count">' + outgoing.length + ' / ' + maxPlayers + '</span></div><div class="manager-trade-player-grid">' + (outgoingChoices || '<div class="manager-empty-line">没有可交易球员。</div>') + '</div><p class="manager-trade-package-copy">送出：' + escapeHtml(tradePlayerNames(outgoing)) + '</p></article>';
    var directTradeBody = '<section class="manager-trade-builder-grid">' + outgoingBuilder +
      '<article class="manager-panel manager-trade-builder"><div class="manager-trade-partner"><label>STEP 2 · 交易对象<select data-trade-team' + (windowOpen ? '' : ' disabled') + '>' + teams.map(function(teamId) { return '<option value="' + escapeHtml(teamId) + '"' + (teamId === tradePartnerTeamId ? ' selected' : '') + '>' + escapeHtml(teamName(teamId)) + '</option>'; }).join('') + '</select></label><span class="manager-trade-selection-count">' + incoming.length + ' / ' + maxPlayers + '</span></div><div class="manager-trade-player-grid">' + (incomingChoices || '<div class="manager-empty-line">当前球队没有可交易球员。</div>') + '</div><p class="manager-trade-package-copy">得到：' + escapeHtml(tradePlayerNames(incoming)) + '</p></article></section>' +
      '<article class="manager-panel manager-trade-assessment" aria-live="polite"><div><div class="manager-panel-kicker">STEP 3 · 对方评估</div><h2>' + escapeHtml(assessment) + '</h2><p>' + escapeHtml(assessmentDetail) + '</p></div><button class="manager-button ' + (proposal.valid && proposal.accepted ? 'manager-button-primary' : 'manager-button-secondary') + '" type="button" data-action="complete-trade" data-trade-ready="' + (proposal.valid && proposal.accepted) + '"' + (proposal.valid && proposal.accepted && windowOpen ? '' : ' disabled') + '>' + (proposal.valid && proposal.accepted ? '提交报价' : '等待可成交报价') + '</button></article>';
    var inquiryOffers = inquiryResult && inquiryResult.offers.length ? '<section class="manager-trade-inquiry-results" aria-live="polite"><div class="manager-section-heading"><span>有兴趣的球队</span><small>' + inquiryResult.offers.length + ' 支球队给出报价</small></div><div class="manager-trade-inquiry-offer-list" role="list">' + inquiryResult.offers.map(function(offer, index) {
      var offeredPlayers = offer.incoming.map(function(location) { return location.player; });
      return '<article class="manager-trade-inquiry-offer" role="listitem"><div><div class="manager-panel-kicker">' + escapeHtml(teamName(offer.partnerTeam)) + '</div><b>愿意送出：' + escapeHtml(tradePlayerNames(offeredPlayers)) + '</b><span>对方得到 ' + offer.outgoing.length + ' 人 · 送出 ' + offer.incoming.length + ' 人</span></div><div class="manager-trade-inquiry-offer-actions"><small>送出价值 ' + offer.outgoingValue.toFixed(1) + ' · 得到价值 ' + offer.incomingValue.toFixed(1) + '</small><button class="manager-button manager-button-secondary" type="button" data-action="use-trade-inquiry-offer" data-offer-index="' + index + '" data-trade-ready="true">采用报价</button></div></article>';
    }).join('') + '</div></section>' : '<section class="manager-trade-inquiry-results" aria-live="polite"><div class="manager-section-heading"><span>有兴趣的球队</span><small>' + (inquiryResult ? '暂无回应' : '等待询价') + '</small></div><div class="manager-empty-line">' + (inquiryResult ? '暂时没有球队愿意为这组资产报价。' : '选好 1 至 ' + maxPlayers + ' 名球员后发起询价。') + '</div></section>';
    var inquiryTradeBody = '<section class="manager-trade-builder-grid">' + outgoingBuilder + '</section><article class="manager-panel manager-trade-inquiry-action"><div><div class="manager-panel-kicker">STEP 2 · 向联盟询价</div><h2>让有兴趣的球队主动报价。</h2><p>系统会综合位置需求、资产价值与名单空间，每队最多给出一份资产包。</p></div><button class="manager-button manager-button-primary" type="button" data-action="run-trade-inquiry" data-trade-ready="' + (outgoing.length > 0) + '"' + (outgoing.length && windowOpen ? '' : ' disabled') + '>开始询价</button></article>' + inquiryOffers;
    var modeIsInquiry = tradeMode === 'inquiry';
    main.innerHTML = '<section class="manager-page manager-trade-page"><div class="manager-page-head"><div><div class="manager-eyebrow">交易中心 / TRADE DESK</div><h1>组合资产，重塑阵容。</h1><p>' + (windowOpen ? '每边可组合 1 至 ' + maxPlayers + ' 名球员。报价按资产价值、位置需求和名单空间评估，不涉及薪资或选秀权。' : '交易窗口已关闭，季后赛与赛季结束后不能再交易。') + '</p></div></div>' +
      '<div class="manager-trade-mode-switch" role="group" aria-label="交易方式"><button type="button" data-action="set-trade-mode" data-trade-mode="direct" aria-pressed="' + (!modeIsInquiry) + '">直接报价</button><button type="button" data-action="set-trade-mode" data-trade-mode="inquiry" aria-pressed="' + modeIsInquiry + '">问价</button></div>' +
      (modeIsInquiry ? inquiryTradeBody : directTradeBody) +
      '<article class="manager-panel manager-trade-history"><div class="manager-panel-kicker">TRADE LOG</div>' + (history || '<div class="manager-empty-line">本赛季尚未完成交易。</div>') + '</article></section>';
  }

  function conferenceForTeam(teamId) {
    var conferences = config().CONFERENCE || {};
    return (conferences.NORTH || []).indexOf(teamId) >= 0 ? 'NORTH' : 'SOUTH';
  }

  function averageOvr(players) {
    if (!players.length) return 0;
    return Math.round(players.reduce(function(sum, player) { return sum + playerOvr(player); }, 0) / players.length);
  }

  function lineupOvr(current, teamId) {
    var roster = (current.leagueData[teamId] || []).slice();
    if (teamId === current.selectedTeam) {
      roster.sort(function(a, b) {
        var aAssignment = current.rotation[a.id] || {};
        var bAssignment = current.rotation[b.id] || {};
        return (Number(bAssignment.minutes) || 0) - (Number(aAssignment.minutes) || 0) || playerOvr(b) - playerOvr(a);
      });
      var starters = roster.filter(function(player) { return current.rotation[player.id] && current.rotation[player.id].starter; }).slice(0, 5);
      var rotation = roster.filter(function(player) { return current.rotation[player.id] && Number(current.rotation[player.id].minutes) > 0; }).slice(0, 10);
      return { starter: averageOvr(starters.length === 5 ? starters : roster.slice(0, 5)), rotation: averageOvr(rotation.length ? rotation : roster.slice(0, 10)) };
    }
    roster.sort(function(a, b) { return playerOvr(b) - playerOvr(a); });
    return { starter: averageOvr(roster.slice(0, 5)), rotation: averageOvr(roster.slice(0, 10)) };
  }

  function recentStreak(current, teamId) {
    var games = current.season.games.filter(function(game) {
      return game.phase === 'regular' && (game.home === teamId || game.away === teamId);
    });
    if (!games.length) return '—';
    var latestWon = games[games.length - 1].winner === teamId;
    var count = 0;
    for (var index = games.length - 1; index >= 0; index--) {
      if ((games[index].winner === teamId) !== latestWon) break;
      count++;
    }
    return (latestWon ? 'W' : 'L') + count;
  }

  function statConfigValue(value) {
    return ['pts', 'reb', 'ast', 'stl', 'blk'].indexOf(value) >= 0 ? value : 'pts';
  }

  function playerOvrRows(current) {
    var rows = [];
    var seen = {};
    Object.keys(current.leagueData || {}).forEach(function(teamId) {
      (current.leagueData[teamId] || []).forEach(function(player) {
        if (!player) return;
        var playerId = String(player.id || '');
        var key = playerId || teamId + ':' + String(player.cname || player.name || '');
        if (seen[key]) return;
        seen[key] = true;
        var ovr = playerOvr(player);
        if (ovr <= 0) return;
        rows.push({
          playerId: playerId,
          playerName: player.cname || player.name || playerId || '未知球员',
          teamId: teamId,
          position: player.pos || player.position || '—',
          ovr: ovr
        });
      });
    });
    return rows.sort(function(a, b) {
      return b.ovr - a.ovr || String(a.playerName).localeCompare(String(b.playerName)) || String(a.playerId).localeCompare(String(b.playerId));
    });
  }

  var SEASON_CALENDAR_MONTHS = [
    { name: '10月', start: 0, end: 10, firstDate: 21, days: 31, firstWday: 3 },
    { name: '11月', start: 11, end: 40, firstDate: 1, days: 30, firstWday: 6 },
    { name: '12月', start: 41, end: 71, firstDate: 1, days: 31, firstWday: 1 },
    { name: '1月', start: 72, end: 102, firstDate: 1, days: 31, firstWday: 4 },
    { name: '2月', start: 103, end: 130, firstDate: 1, days: 28, firstWday: 0 },
    { name: '3月', start: 131, end: 161, firstDate: 1, days: 31, firstWday: 0 },
    { name: '4月', start: 162, end: 191, firstDate: 1, days: 30, firstWday: 3 }
  ];

  function calendarMonthForDay(day) {
    return SEASON_CALENDAR_MONTHS.findIndex(function(month) { return day >= month.start && day <= month.end; });
  }

  function calendarResultMap(current) {
    var results = {};
    (current.season.games || []).filter(function(game) { return game.phase === 'regular'; }).forEach(function(game) {
      results[String(game.index)] = game;
    });
    return results;
  }

  function renderSeasonCalendar(current, userSchedule) {
    var next = current.season.phase === 'regular' ? global.ManagerEngine.getNextRegularGame(current) : null;
    var activeMonth = calendarMonthForDay(next ? next.day : (userSchedule.length ? userSchedule[userSchedule.length - 1].day : 0));
    if (seasonCalendarMonth == null || seasonCalendarMonth < 0 || seasonCalendarMonth >= SEASON_CALENDAR_MONTHS.length) seasonCalendarMonth = Math.max(0, activeMonth);
    var month = SEASON_CALENDAR_MONTHS[seasonCalendarMonth];
    var scheduleByDay = {};
    userSchedule.forEach(function(game) { scheduleByDay[game.day] = game; });
    var resultByIndex = calendarResultMap(current);
    var cells = '';
    for (var blankIndex = 0; blankIndex < month.firstWday; blankIndex++) cells += '<div class="manager-calendar-cell is-empty" aria-hidden="true"></div>';
    for (var date = 1; date <= month.days; date++) {
      var day = month.start + (date - month.firstDate);
      var fixture = scheduleByDay[day];
      if (!fixture) {
        cells += '<div class="manager-calendar-cell is-rest"><span>' + date + '</span></div>';
        continue;
      }
      var result = resultByIndex[String(fixture.gameNum)];
      var isNext = next && fixture.gameNum === next.gameNum;
      var opponent = fixture.home === current.selectedTeam ? fixture.away : fixture.home;
      var prefix = fixture.home === current.selectedTeam ? 'vs' : '@';
      var score = '';
      var outcomeClass = 'is-future';
      if (result) {
        var won = result.winner === current.selectedTeam;
        outcomeClass = won ? 'is-win' : 'is-loss';
        score = '<small>' + (fixture.home === current.selectedTeam ? result.homeScore + '-' + result.awayScore : result.awayScore + '-' + result.homeScore) + '</small>';
      } else if (isNext) {
        outcomeClass = 'is-next';
      }
      var canSimulate = current.season.phase === 'regular' && !result;
      var content = '<span class="manager-calendar-date">' + date + '</span><b>' + prefix + ' ' + escapeHtml(opponent) + '</b>' + score;
      cells += canSimulate ? '<button type="button" class="manager-calendar-cell ' + outcomeClass + '" data-action="simulate-to-season-day" data-season-day="' + day + '" aria-label="' + date + ' 日，' + escapeHtml(prefix + ' ' + opponent) + '，模拟至当天">' + content + '</button>' : '<div class="manager-calendar-cell ' + outcomeClass + '">' + content + '</div>';
    }
    var record = current.season.standings[current.selectedTeam] || { wins: 0, losses: 0 };
    var completed = userSchedule.filter(function(fixture) { return !!resultByIndex[String(fixture.gameNum)]; }).length;
    var hint = current.season.phase === 'regular' ? '点击未赛比赛日，可模拟至当天。' : '常规赛赛程已结束，可回顾每场结果。';
    return '<section class="manager-panel manager-season-calendar"><div class="manager-calendar-head"><button type="button" class="manager-calendar-nav" data-action="set-season-calendar-month" data-calendar-month="' + (seasonCalendarMonth - 1) + '"' + (seasonCalendarMonth === 0 ? ' disabled' : '') + ' aria-label="上个月">‹</button><div><div class="manager-panel-kicker">REGULAR SEASON / CALENDAR</div><strong>' + month.name + '</strong></div><button type="button" class="manager-calendar-nav" data-action="set-season-calendar-month" data-calendar-month="' + (seasonCalendarMonth + 1) + '"' + (seasonCalendarMonth >= SEASON_CALENDAR_MONTHS.length - 1 ? ' disabled' : '') + ' aria-label="下个月">›</button></div><div class="manager-calendar-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="manager-calendar-grid">' + cells + '</div><div class="manager-calendar-footer"><span>' + hint + '</span><strong>' + record.wins + '-' + record.losses + '</strong><small>' + completed + ' / ' + userSchedule.length + ' 场</small></div>' + (current.season.phase === 'regular' ? '<button class="manager-button manager-button-secondary manager-calendar-sim-all" type="button" data-action="simulate-regular">模拟剩余常规赛</button>' : '') + '</section>';
  }

  function seasonImportantEvents(current, userGames) {
    var record = current.season.standings[current.selectedTeam] || { wins: 0, losses: 0 };
    var conference = conferenceForTeam(current.selectedTeam);
    var conferenceName = conference === 'NORTH' ? '北部联盟' : '南部联盟';
    var conferenceRows = global.ManagerEngine.standingsList(current, conference);
    var conferencePlace = conferenceRows.indexOf(current.selectedTeam) + 1;
    var overallPlace = global.ManagerEngine.overallStandingsList(current).indexOf(current.selectedTeam) + 1;
    var directive = ownerDirective(current, record);
    var regularGames = userGames.filter(function(game) { return game.phase === 'regular'; });
    var events = [{ tag: '董事会', title: directive.title, detail: directive.detail }];
    var rankTitle = '联盟 #' + (overallPlace || '—') + ' · ' + conferenceName + ' #' + (conferencePlace || '—');
    var rankDetail = current.season.phase === 'regular'
      ? (conferencePlace <= 8 ? '目前位于季后赛资格区，常规赛还剩 ' + Math.max(0, 82 - regularGames.length) + ' 场。' : '目前位于季后赛资格区外，需在剩余 ' + Math.max(0, 82 - regularGames.length) + ' 场中提升排名。')
      : '常规赛最终战绩 ' + record.wins + '-' + record.losses + '。';
    events.push({ tag: '排名', title: rankTitle, detail: rankDetail });

    var latestTrade = (current.tradeHistory || []).slice(-1)[0];
    if (latestTrade) {
      events.push({
        tag: '交易',
        title: tradePlayerNames(latestTrade.sent) + ' 换回 ' + tradePlayerNames(latestTrade.received),
        detail: '已与 ' + teamName(latestTrade.partnerTeam) + ' 完成最近一笔交易' + (latestTrade.rotationReset ? '，轮换需重新确认。' : '。')
      });
    } else if (current.season.phase === 'regular') {
      events.push({ tag: '交易', title: '交易窗口开放', detail: '可在交易中心发起一对一、组合交易或向其他球队询价。' });
    } else {
      events.push({ tag: '交易', title: '本赛季未完成交易', detail: '交易动态会在完成交易后记录于此。' });
    }

    if (current.season.phase === 'regular') {
      events.push({ tag: '走势', title: '近期 ' + recentStreak(current, current.selectedTeam), detail: '已完成 ' + regularGames.length + ' 场常规赛，当前战绩 ' + record.wins + '-' + record.losses + '。' });
    } else if (current.season.phase === 'playoffs') {
      events.push({ tag: '季后赛', title: '正在冲击第 ' + (Number(current.season.userRound) || 1) + ' 轮', detail: '季后赛已完成 ' + userGames.filter(function(game) { return game.phase === 'playoffs'; }).length + ' 场，继续推进可查看本轮结果。' });
    } else {
      events.push({ tag: '赛季结果', title: '总冠军：' + teamName(current.season.champion), detail: '赛季已结束，董事会已根据最终表现完成评价。' });
    }
    return events;
  }

  function renderStandings() {
    var current = state();
    var owner = current.owner.evaluation || current.owner;
    var conference = standingsConference || conferenceForTeam(current.selectedTeam);
    var rows = global.ManagerEngine.standingsList(current, conference);
    var leaderRecord = current.season.standings[rows[0]] || { wins: 0, losses: 0 };
    var listHtml = '<div class="manager-standing-head"><span>排名</span><span>球队</span><span title="首发与主要轮换的平均总评">总评<small>首 / 轮</small></span><span>战力</span><span>胜</span><span>负</span><span>胜差</span><span>近况</span></div>';
    rows.forEach(function(id, index) {
      var record = current.season.standings[id] || {};
      var ovr = lineupOvr(current, id);
      var power = global.ManagerEngine.rosterPower(current, id).overall;
      var gamesBehind = index === 0 ? '—' : ((leaderRecord.wins - (record.wins || 0) + (record.losses || 0) - leaderRecord.losses) / 2).toFixed(1);
      if (index === 0) listHtml += '<div class="manager-standing-zone">🏀 季后赛区</div>';
      if (index === 8) listHtml += '<div class="manager-standing-zone">📋 非季后赛区</div>';
      listHtml += '<div class="manager-standing-row">' +
        '<span>' + (index + 1) + '</span>' +
        '<span class="manager-standing-team"><b>' + escapeHtml(teamName(id)) + '</b></span>' +
        '<span class="manager-standing-ovr"><b>' + ovr.starter + '</b><b>' + ovr.rotation + '</b></span>' +
        '<span class="manager-standing-power">' + power.toFixed(1) + '</span>' +
        '<span class="manager-standing-win">' + (record.wins || 0) + '</span>' +
        '<span class="manager-standing-loss">' + (record.losses || 0) + '</span>' +
        '<span>' + gamesBehind + '</span>' +
        '<span class="manager-standing-streak">' + recentStreak(current, id) + '</span>' +
      '</div>';
    });
    var teamBody = '<div class="manager-standings-tabs"><button type="button" class="' + (conference === 'SOUTH' ? 'is-active' : '') + '" data-action="set-standings-conference" data-conference="SOUTH" aria-pressed="' + (conference === 'SOUTH') + '">南方</button><button type="button" class="' + (conference === 'NORTH' ? 'is-active' : '') + '" data-action="set-standings-conference" data-conference="NORTH" aria-pressed="' + (conference === 'NORTH') + '">北方</button></div>' +
      '<div class="manager-standings-panel"><div class="manager-standings-list">' + listHtml + '</div></div>';
    var statConfig = {
      pts: { total: 'points', label: '场均得分' },
      reb: { total: 'rebounds', label: '场均篮板' },
      ast: { total: 'assists', label: '场均助攻' },
      stl: { total: 'steals', label: '场均抢断' },
      blk: { total: 'blocks', label: '场均盖帽' }
    };
    var activeStat = statConfig[playerRankingStat] || statConfig.pts;
    var playerRows = global.ManagerEngine.playerStatRows(current).filter(function(row) { return Number(row.games) > 0; }).map(function(row) {
      var copy = Object.assign({}, row);
      copy.average = Number(row[activeStat.total] || 0) / Math.max(1, Number(row.games) || 0);
      return copy;
    }).sort(function(a, b) {
      return b.average - a.average || b.games - a.games || String(a.playerName).localeCompare(String(b.playerName));
    });
    var visiblePlayerRows = playerRows.slice(0, playerRankingLimit);
    var playerListHtml = visiblePlayerRows.length ? visiblePlayerRows.map(function(row, index) {
      return '<div class="manager-player-stat-row">' +
        '<span>' + (index + 1) + '</span>' +
        '<span class="manager-player-stat-name">' + escapeHtml(row.playerName) + '</span>' +
        '<span>' + escapeHtml(row.teamId) + '</span>' +
        '<span>' + row.games + '</span>' +
        '<span class="manager-player-stat-value">' + row.average.toFixed(1) + '</span>' +
      '</div>';
    }).join('') : '<div class="manager-ranking-empty">推进比赛后显示球员排行榜。</div>';
    var remainingPlayerRows = Math.max(0, playerRows.length - visiblePlayerRows.length);
    var playerBody = '<div class="manager-player-stat-tabs">' +
        '<button type="button" class="' + (playerRankingStat === 'pts' ? 'is-active' : '') + '" data-action="set-player-ranking-stat" data-stat="pts" aria-pressed="' + (playerRankingStat === 'pts') + '">得分</button>' +
        '<button type="button" class="' + (playerRankingStat === 'reb' ? 'is-active' : '') + '" data-action="set-player-ranking-stat" data-stat="reb" aria-pressed="' + (playerRankingStat === 'reb') + '">篮板</button>' +
        '<button type="button" class="' + (playerRankingStat === 'ast' ? 'is-active' : '') + '" data-action="set-player-ranking-stat" data-stat="ast" aria-pressed="' + (playerRankingStat === 'ast') + '">助攻</button>' +
        '<button type="button" class="' + (playerRankingStat === 'stl' ? 'is-active' : '') + '" data-action="set-player-ranking-stat" data-stat="stl" aria-pressed="' + (playerRankingStat === 'stl') + '">抢断</button>' +
        '<button type="button" class="' + (playerRankingStat === 'blk' ? 'is-active' : '') + '" data-action="set-player-ranking-stat" data-stat="blk" aria-pressed="' + (playerRankingStat === 'blk') + '">盖帽</button>' +
      '</div>' +
      '<div class="manager-player-stat-panel"><div class="manager-player-stat-list"><div class="manager-player-stat-head"><span>排名</span><span>球员</span><span>球队</span><span>场次</span><span>' + activeStat.label + '</span></div>' + playerListHtml + '</div>' +
      (remainingPlayerRows > 0 ? '<button type="button" class="manager-button manager-button-secondary manager-player-stat-more" data-action="show-more-player-stats">查看更多（下 ' + Math.min(10, remainingPlayerRows) + ' 名）</button>' : '') + '</div>';
    var ovrRows = playerOvrRows(current);
    var visibleOvrRows = ovrRows.slice(0, playerRankingLimit);
    var ovrListHtml = visibleOvrRows.length ? visibleOvrRows.map(function(row, index) {
      return '<div class="manager-player-stat-row manager-player-ovr-row">' +
        '<span>' + (index + 1) + '</span>' +
        '<span class="manager-player-stat-name">' + escapeHtml(row.playerName) + '</span>' +
        '<span>' + escapeHtml(row.teamId) + '</span>' +
        '<span>' + escapeHtml(row.position) + '</span>' +
        '<span class="manager-player-stat-value">' + row.ovr + '</span>' +
      '</div>';
    }).join('') : '<div class="manager-ranking-empty">联盟名单中暂无球员 OVR 数据。</div>';
    var remainingOvrRows = Math.max(0, ovrRows.length - visibleOvrRows.length);
    var ovrBody = '<div class="manager-player-stat-panel manager-player-ovr-panel"><div class="manager-player-stat-list"><div class="manager-player-stat-head manager-player-ovr-head"><span>排名</span><span>球员</span><span>球队</span><span>位置</span><span>OVR</span></div>' + ovrListHtml + '</div>' +
      (remainingOvrRows > 0 ? '<button type="button" class="manager-button manager-button-secondary manager-player-stat-more" data-action="show-more-player-stats">查看更多（下 ' + Math.min(10, remainingOvrRows) + ' 名）</button>' : '') + '</div>';
    main.innerHTML = '<section class="manager-page manager-standings-page"><div class="manager-page-head"><div><div class="manager-eyebrow">赛季排名 / STANDINGS</div><h1>' + (current.season.phase === 'complete' ? '赛季总结' : '联盟排行榜') + '</h1><p>' + (current.season.phase === 'complete' ? '冠军：' + escapeHtml(teamName(current.season.champion)) + ' · 董事会：' + escapeHtml(owner.label || '') : '排名按胜率与净胜分排序，各联盟前八进入季后赛。') + '</p></div></div>' +
      (current.season.phase === 'complete' ? '<div class="manager-review-banner"><strong>' + (owner.score || 0) + '<em>/100</em></strong><div><b>' + escapeHtml(owner.label || '') + '</b><span>' + escapeHtml(owner.summary || '') + '</span></div></div>' : '') +
      '<div class="manager-rankings-view-tabs"><button type="button" class="' + (standingsView === 'teams' ? 'is-active' : '') + '" data-action="set-standings-view" data-standings-view="teams" aria-pressed="' + (standingsView === 'teams') + '">球队战绩</button><button type="button" class="' + (standingsView === 'players' ? 'is-active' : '') + '" data-action="set-standings-view" data-standings-view="players" aria-pressed="' + (standingsView === 'players') + '">球员统计</button><button type="button" class="' + (standingsView === 'ovr' ? 'is-active' : '') + '" data-action="set-standings-view" data-standings-view="ovr" aria-pressed="' + (standingsView === 'ovr') + '">球员 OVR</button></div>' +
      (standingsView === 'players' ? playerBody : (standingsView === 'ovr' ? ovrBody : teamBody)) + '</section>';
  }

  function renderSeason() {
    var current = state();
    var userSchedule = current.season.schedule.filter(function(game) { return game.home === current.selectedTeam || game.away === current.selectedTeam; });
    var userGames = current.season.games.filter(function(game) { return game.home === current.selectedTeam || game.away === current.selectedTeam; });
    var gameCount = userGames.filter(function(game) { return game.phase === 'regular'; }).length;
    var playoffCount = userGames.filter(function(game) { return game.phase === 'playoffs'; }).length;
    var importantEvents = seasonImportantEvents(current, userGames);
    main.innerHTML = '<section class="manager-page manager-season-page"><div class="manager-page-head"><div><div class="manager-eyebrow">赛季中心 / SEASON LOG</div><h1>结果会留下痕迹。</h1><p>点击日历中的未赛比赛日，可模拟至当天；底部“下一步”继续推进当前赛程。</p></div></div>' +
      renderSeasonCalendar(current, userSchedule) +
      '<div class="manager-season-timeline"><div class="is-done"><span>01</span><b>常规赛</b><small>' + gameCount + ' / ' + userSchedule.length + ' 场</small></div><div class="' + (current.season.phase === 'playoffs' || current.season.phase === 'complete' ? 'is-done' : '') + '"><span>02</span><b>季后赛</b><small>' + playoffCount + ' 场已完成</small></div><div class="' + (current.season.phase === 'complete' ? 'is-done' : '') + '"><span>03</span><b>董事会评价</b><small>' + (current.owner.evaluation ? '已生成' : '赛季结束后生成') + '</small></div></div>' +
      '<article class="manager-panel manager-season-log manager-season-highlights"><div class="manager-panel-kicker">赛季大事 / SEASON NOTES</div>' + importantEvents.map(function(event) { return '<div class="manager-season-event-row"><span>' + escapeHtml(event.tag) + '</span><b>' + escapeHtml(event.title) + '</b><small>' + escapeHtml(event.detail) + '</small></div>'; }).join('') + '</article>' +
      '<div class="manager-season-actions">' + (current.season.phase === 'playoffs' ? '<button class="manager-button manager-button-primary" type="button" data-action="simulate-playoffs">模拟至总冠军</button>' : '') + '</div></section>';
  }

  function render() {
    if (!state()) { renderWelcome(); return; }
    setSession(true);
    nav.querySelectorAll('[data-view]').forEach(function(button) {
      var active = button.dataset.view === view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    if (view === 'roster') renderRoster();
    else if (view === 'trade') renderTrade();
    else if (view === 'standings') renderStandings();
    else if (view === 'season') renderSeason();
    else renderDashboard();
    updateNextAction();
    global.scrollTo(0, 0);
  }

  function setState(nextState) {
    global.MANAGER_STATE = nextState;
    seasonCalendarMonth = null;
    view = 'dashboard';
    render();
  }

  function selectTeam(teamId) {
    try {
      var current = global.ManagerState.create(teamId, leagueData(), teamIds(), global.generateLeagueSchedule, config());
      setState(current);
      showToast('已接任 ' + teamName(teamId) + '，先检查你的轮换。');
    } catch (error) { showToast(error.message || '创建经理档案失败。', true); }
  }

  function saveGame() {
    if (!state() || storageBusy) return;
    setStorageBusy(true);
    global.ManagerStorage.save(state()).then(function() {
      showToast('经理存档已保存到独立槽位。');
    }, function(error) {
      showToast(error.message || '保存失败。', true);
    }).then(function() { setStorageBusy(false); });
  }

  function loadSave() {
    if (storageBusy) return;
    setStorageBusy(true);
    global.ManagerStorage.load().then(function(saved) {
      if (!saved) { showToast('没有找到经理模式存档。', true); return; }
      setState(saved);
      showToast('经理存档已读取。');
    }, function(error) {
      showToast(error.message || '读取失败。', true);
    }).then(function() { setStorageBusy(false); });
  }

  function restartGame() {
    if (storageBusy) return;
    if (!global.confirm('确认重开经理模式？这只会删除经理槽位 1，并回到选队页；不会影响球员模式存档或共享联赛数据。')) return;
    setStorageBusy(true);
    global.ManagerStorage.clear().then(function() {
      global.MANAGER_STATE = null;
      view = 'dashboard';
      render();
      showToast('已重开经理模式，请重新选择执教球队。');
    }, function(error) {
      showToast(error.message || '重开失败，经理存档未被删除。', true);
    }).then(function() {
      setStorageBusy(false);
    });
  }

  function simulate(action) {
    if (!state() || storageBusy) return;
    try {
      var count = 0;
      if (action === 'simulate-next') { count = global.ManagerEngine.simulateNextUserRegularGame(state()).result ? 1 : 0; }
      if (action === 'simulate-regular') count = global.ManagerEngine.simulateRemainingRegularSeason(state());
      if (action === 'simulate-playoff-next') { count = global.ManagerEngine.simulateNextUserPostseasonGame(state()).result ? 1 : 0; }
      if (action === 'simulate-playoffs') count = global.ManagerEngine.simulateRemainingPostseason(state());
      render();
      setStorageBusy(true);
      global.ManagerStorage.save(state()).then(function() {
        showToast(count ? '已推进 ' + count + ' 场并已自动保存。' : '赛季状态已更新并已自动保存。');
      }, function(error) {
        showToast((count ? '已推进 ' + count + ' 场，但自动保存失败：' : '赛季状态已更新，但自动保存失败：') + (error.message || '请手动重试保存。'), true);
      }).then(function() { setStorageBusy(false); });
    } catch (error) { showToast(error.message || '模拟失败。', true); }
  }

  function simulateToSeasonDay(targetDay) {
    var current = state();
    var day = Math.floor(Number(targetDay));
    if (!current || storageBusy || !Number.isFinite(day)) return;
    var validation = rotationValidation(current);
    if (current.season.phase !== 'regular' || !validation.valid) {
      showToast(current.season.phase !== 'regular' ? '常规赛已经结束，无法继续按日历模拟。' : (validation.errors[0] || '请先修正轮换。'), true);
      return;
    }
    try {
      var count = 0;
      while (current.season.phase === 'regular') {
        var fixture = global.ManagerEngine.getNextRegularGame(current);
        if (!fixture || fixture.day > day) break;
        global.ManagerEngine.simulateNextRegularGame(current);
        count++;
      }
      if (!count) {
        showToast('该日期的赛程已经完成。');
        renderSeason();
        return;
      }
      renderSeason();
      updateNextAction();
      setStorageBusy(true);
      global.ManagerStorage.save(current).then(function() {
        showToast('已模拟至日历日期，推进 ' + count + ' 场联盟比赛并自动保存。');
      }, function(error) {
        showToast('已模拟至日历日期，但自动保存失败：' + (error.message || '请手动重试保存。'), true);
      }).then(function() { setStorageBusy(false); });
    } catch (error) { showToast(error.message || '日历模拟失败。', true); }
  }

  function completeTrade() {
    var current = state();
    if (!current || storageBusy) return;
    var proposal = global.ManagerEngine.evaluateTrade(current, tradeOutgoingIds, tradeIncomingIds);
    if (!proposal.valid || !proposal.accepted) {
      showToast(proposal.reason || '该交易无法完成。', true);
      renderTrade();
      return;
    }
    var confirmation = '确认送出“' + tradePlayerNames(proposal.outgoing.map(function(location) { return location.player; })) + '”，换回“' + tradePlayerNames(proposal.incoming.map(function(location) { return location.player; })) + '”吗？\n只会修改当前经理存档，交易后会自动保存。';
    if (!global.confirm(confirmation)) return;
    try {
      var result = global.ManagerEngine.executeTrade(current, tradeOutgoingIds, tradeIncomingIds);
      tradeOutgoingIds = [];
      tradeIncomingIds = [];
      clearTradeInquiry();
      render();
      setStorageBusy(true);
      global.ManagerStorage.save(state()).then(function() {
        showToast('交易完成：' + tradePlayerNames(result.trade.sent) + ' 换回 ' + tradePlayerNames(result.trade.received) + '，已自动保存。');
      }, function(error) {
        showToast('交易已完成，但自动保存失败：' + (error.message || '请手动重试保存。'), true);
      }).then(function() { setStorageBusy(false); });
    } catch (error) {
      showToast(error.message || '交易失败。', true);
    }
  }

  function runTradeInquiry() {
    var current = state();
    if (!current || storageBusy) return;
    var result = global.ManagerEngine.inquireTrade(current, tradeOutgoingIds);
    if (!result.valid) {
      showToast(result.reason || '无法发起问价。', true);
      renderTrade();
      return;
    }
    tradeInquiry = { key: tradeInquiryKey(tradeOutgoingIds), result: result };
    renderTrade();
    showToast(result.reason, !result.offers.length);
  }

  function useTradeInquiryOffer(offerIndex) {
    var current = state();
    var result = tradeInquiry && tradeInquiry.key === tradeInquiryKey(tradeOutgoingIds) ? tradeInquiry.result : null;
    var offer = result && result.offers && result.offers[Number(offerIndex)];
    if (!current || storageBusy || !offer) {
      showToast('这份报价已失效，请重新询价。', true);
      return;
    }
    var proposal = global.ManagerEngine.evaluateTrade(current, tradeOutgoingIds, offer.incoming.map(function(location) { return location.player.id; }));
    if (!proposal.valid || !proposal.accepted) {
      showToast(proposal.reason || '这份报价已失效，请重新询价。', true);
      return;
    }
    tradePartnerTeamId = offer.partnerTeam;
    tradeIncomingIds = offer.incoming.map(function(location) { return location.player.id; });
    tradeMode = 'direct';
    renderTrade();
    showToast('已带入 ' + teamName(offer.partnerTeam) + ' 的报价，请确认后提交。');
  }

  function toggleStarter(playerId) {
    var current = state();
    if (!current || !current.rotation[playerId]) return;
    current.rotation[playerId].starter = !current.rotation[playerId].starter;
    if (current.rotation[playerId].starter && Number(current.rotation[playerId].minutes) <= 0) current.rotation[playerId].minutes = 24;
    renderRoster();
    updateNextAction();
  }

  function handleClick(event) {
    var target = event.target.closest('[data-action], [data-view]');
    if (!target) return;
    if (target.dataset.view) { view = target.dataset.view; render(); return; }
    var action = target.dataset.action;
    if (action === 'select-team') selectTeam(target.dataset.team);
    else if (action === 'load-save') loadSave();
    else if (action === 'save-game') saveGame();
    else if (action === 'restart-game') restartGame();
    else if (action === 'next-step') nextStep();
    else if (action === 'set-standings-view') { standingsView = target.dataset.standingsView === 'players' ? 'players' : (target.dataset.standingsView === 'ovr' ? 'ovr' : 'teams'); playerRankingLimit = 10; renderStandings(); }
    else if (action === 'set-standings-conference') { standingsConference = target.dataset.conference === 'NORTH' ? 'NORTH' : 'SOUTH'; renderStandings(); }
    else if (action === 'set-player-ranking-stat') { playerRankingStat = statConfigValue(target.dataset.stat); playerRankingLimit = 10; renderStandings(); }
    else if (action === 'show-more-player-stats') { playerRankingLimit += 10; renderStandings(); }
    else if (action === 'set-season-calendar-month') { seasonCalendarMonth = Math.max(0, Math.min(SEASON_CALENDAR_MONTHS.length - 1, Number(target.dataset.calendarMonth) || 0)); renderSeason(); updateActionAvailability(); }
    else if (action === 'open-dashboard') { view = 'dashboard'; render(); }
    else if (action === 'toggle-starter') toggleStarter(target.dataset.player);
    else if (action === 'set-trade-mode') { tradeMode = target.dataset.tradeMode === 'inquiry' ? 'inquiry' : 'direct'; renderTrade(); }
    else if (action === 'select-trade-outgoing') { tradeOutgoingIds = toggleTradeSelection(tradeOutgoingIds, target.dataset.player); clearTradeInquiry(); renderTrade(); }
    else if (action === 'select-trade-incoming') { tradeIncomingIds = toggleTradeSelection(tradeIncomingIds, target.dataset.player); renderTrade(); }
    else if (action === 'run-trade-inquiry') runTradeInquiry();
    else if (action === 'use-trade-inquiry-offer') useTradeInquiryOffer(target.dataset.offerIndex);
    else if (action === 'complete-trade') completeTrade();
    else if (action === 'simulate-to-season-day') simulateToSeasonDay(target.dataset.seasonDay);
    else if (action === 'simulate-next' || action === 'simulate-regular' || action === 'simulate-playoff-next' || action === 'simulate-playoffs') simulate(action);
  }

  function handleChange(event) {
    var select = event.target.closest('[data-trade-team]');
    if (!select || !state()) return;
    tradePartnerTeamId = select.value;
    tradeIncomingIds = [];
    renderTrade();
  }

  function handleInput(event) {
    var input = event.target.closest('[data-minute-player]');
    if (!input || !state()) return;
    var playerId = input.dataset.minutePlayer;
    if (!state().rotation[playerId]) return;
    state().rotation[playerId].minutes = input.value === '' ? NaN : Number(input.value);
    var validation = rotationValidation(state());
    renderRotationFeedback(validation);
  }

  function renderRotationFeedback(validation) {
    var status = main.querySelector('.manager-rotation-status');
    if (status) {
      status.classList.toggle('is-valid', validation.valid);
      status.classList.toggle('is-invalid', !validation.valid);
      status.querySelector('[data-rotation-label]').textContent = validation.valid ? '✓ 轮换合法' : '需要修正';
      status.querySelector('[data-rotation-total]').innerHTML = validation.totalMinutes + '<em>/240</em>';
      status.querySelector('[data-rotation-active]').innerHTML = validation.activeCount + '<em>/9–11</em>';
      status.querySelector('[data-rotation-starters]').innerHTML = validation.starterCount + '<em>/5</em>';
    }
    var errors = main.querySelector('[data-rotation-errors]');
    if (errors) {
      errors.hidden = validation.valid;
      errors.innerHTML = validation.errors.map(function(error) { return '<div>! ' + escapeHtml(error) + '</div>'; }).join('');
    }
    main.querySelectorAll('[data-rotation-player]').forEach(function(row) {
      var assignment = state().rotation[row.dataset.rotationPlayer] || { starter: false, minutes: 0 };
      var active = Number(assignment.minutes) > 0;
      row.classList.toggle('is-starter', !!assignment.starter);
      row.classList.toggle('is-active', active);
      row.classList.toggle('is-inactive', !active);
      var badge = row.querySelector('.manager-player-rank');
      if (badge) badge.textContent = assignment.starter ? 'S' : (active ? 'R' : '—');
      var toggle = row.querySelector('[data-action="toggle-starter"]');
      if (toggle) {
        toggle.textContent = assignment.starter ? '首发' : '轮换';
        toggle.setAttribute('aria-pressed', assignment.starter ? 'true' : 'false');
      }
    });
    updateNextAction();
  }

  function init() {
    root = document.getElementById('manager-app');
    main = document.getElementById('manager-main');
    nav = document.getElementById('manager-nav');
    saveActions = document.getElementById('manager-save-actions');
    toast = document.getElementById('manager-toast');
    root.addEventListener('click', handleClick);
    root.addEventListener('input', handleInput);
    root.addEventListener('change', handleChange);
    renderWelcome();
    global.ManagerStorage.load().then(function(saved) {
      if (saved) showToast('检测到经理存档，可在欢迎页下方读取。');
    }, function(error) {
      showToast(error.message || '无法检查经理存档。', true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
