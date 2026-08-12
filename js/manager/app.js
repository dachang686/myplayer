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
  var toastTimer = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function teamName(teamId) { return global.ManagerEngine.teamName(teamId); }
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
        var power = roster.slice().sort(function(a, b) { return (Number(b.ovr) || 0) - (Number(a.ovr) || 0); }).slice(0, 5).reduce(function(sum, player) { return sum + (Number(player.ovr) || 0); }, 0) / Math.max(1, Math.min(5, roster.length));
        return '<button class="manager-team-card" type="button" data-action="select-team" data-team="' + escapeHtml(id) + '">' +
          '<span class="manager-team-code">' + escapeHtml(id) + '</span>' +
          '<span class="manager-team-copy"><strong>' + escapeHtml(teamName(id)) + '</strong><small>核心强度 ' + Math.round(power) + '</small></span>' +
          '<span class="manager-arrow" aria-hidden="true">↗</span>' +
        '</button>';
      }).join('') + '</div>' +
      '<div class="manager-welcome-footer"><button class="manager-button manager-button-secondary" type="button" data-action="load-save">读取已有经理存档</button><span>本页不会读取球员模式存档。</span></div>' +
    '</section>';
  }

  function renderDashboard() {
    var current = state();
    var record = current.season.standings[current.selectedTeam] || { wins: 0, losses: 0 };
    var allRanked = teamIds().slice().sort(function(a, b) {
      var x = current.season.standings[a] || {}, y = current.season.standings[b] || {};
      return (y.wins - x.wins) || ((y.pointsFor - y.pointsAgainst) - (x.pointsFor - x.pointsAgainst));
    });
    var place = allRanked.indexOf(current.selectedTeam) + 1;
    var next = current.season.phase === 'regular' ? global.ManagerEngine.getNextRegularGame(current) : null;
    var opponent = next ? (next.home === current.selectedTeam ? next.away : next.home) : null;
    var phaseLabel = current.season.phase === 'regular' ? '常规赛进行中' : (current.season.phase === 'playoffs' ? '季后赛进行中' : '赛季已结束');
    var owner = current.owner.evaluation || current.owner;
    main.innerHTML = '<section class="manager-page manager-dashboard">' +
      '<div class="manager-page-head"><div><div class="manager-eyebrow">经理主页 / ' + escapeHtml(current.seasonLabel) + '</div><h1>' + escapeHtml(teamName(current.selectedTeam)) + '</h1><p>' + escapeHtml(phaseLabel) + ' · 董事会目标：' + escapeHtml(current.owner.goal.label) + '</p></div></div>' +
      '<div class="manager-stat-strip"><div><small>战绩</small><strong>' + record.wins + '-' + record.losses + '</strong></div><div><small>联盟排名</small><strong>#' + (place || '—') + '</strong></div><div><small>目标完成度</small><strong>' + (owner.score || current.owner.rating) + '<em>/100</em></strong></div></div>' +
      '<div class="manager-dashboard-grid">' +
        '<article class="manager-panel manager-next-game"><div class="manager-panel-kicker">NEXT GAME</div>' + (next ? '<div class="manager-matchup"><div><strong>' + escapeHtml(teamName(next.home)) + '</strong><small>' + escapeHtml(next.home) + '</small></div><span>VS</span><div class="manager-matchup-away"><strong>' + escapeHtml(teamName(next.away)) + '</strong><small>' + escapeHtml(next.away) + '</small></div></div><p>第 ' + next.gameNum + ' 场 · 赛季日程第 ' + next.day + ' 天</p>' : '<div class="manager-empty-line">常规赛已完成，准备迎接季后赛。</div>') + '</article>' +
        '<article class="manager-panel manager-owner-panel"><div class="manager-panel-kicker">OWNER CHECK-IN</div><div class="manager-owner-score"><strong>' + (owner.score || current.owner.rating) + '</strong><span>/100</span><small>' + escapeHtml(owner.label || '等待赛季结果') + '</small></div><p>' + escapeHtml(owner.summary || '先把轮换稳定下来，再让结果替你说话。') + '</p></article>' +
      '</div>' +
      '<article class="manager-panel manager-command-panel"><div><div class="manager-panel-kicker">办公室指令</div><h2>' + (current.season.phase === 'regular' ? '把时间交给赛程' : (current.season.phase === 'playoffs' ? '向冠军推进' : '复盘本赛季')) + '</h2><p>' + (current.season.phase === 'regular' ? '每场推进可检查结果，也可以一次性模拟剩余常规赛。' : (current.season.phase === 'playoffs' ? '系列赛采用七场四胜制，完成后将生成董事会评价。' : '查看完整排名、轮换与最终评价。')) + '</p></div><div class="manager-command-actions"><button class="manager-button manager-button-secondary" type="button" data-action="open-roster">调整轮换</button>' + commandButtons(current) + '</div></article>' +
    '</section>';
  }

  function commandButtons(current) {
    if (current.season.phase === 'regular') return '<button class="manager-button manager-button-secondary" type="button" data-action="simulate-regular">模拟完常规赛</button>';
    if (current.season.phase === 'playoffs') return '<button class="manager-button manager-button-secondary" type="button" data-action="simulate-playoffs">模拟至总冠军</button>';
    return '<button class="manager-button manager-button-secondary" type="button" data-view="standings">查看赛季总结</button>';
  }

  function updateNextAction() {
    var label = document.getElementById('manager-next-label');
    var current = state();
    if (!label || !current) return;
    if (current.season.phase === 'regular') label.textContent = '推进下一场';
    else if (current.season.phase === 'playoffs') label.textContent = '推进季后赛';
    else label.textContent = '查看赛季总结';
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
      return (Number(current.rotation[b.id] && current.rotation[b.id].minutes) || 0) - (Number(current.rotation[a.id] && current.rotation[a.id].minutes) || 0) || ((Number(b.ovr) || 0) - (Number(a.ovr) || 0));
    });
    main.innerHTML = '<section class="manager-page manager-roster-page">' +
      '<div class="manager-page-head"><div><div class="manager-eyebrow">阵容办公室 / ROTATION</div><h1>把每一分钟都安排好。</h1><p>首发必须覆盖五个位置，轮换人数 9 至 11 人，总时间严格为 240 分钟。</p></div></div>' +
      '<div class="manager-rotation-status ' + (validation.valid ? 'is-valid' : 'is-invalid') + '"><div><strong>' + validation.totalMinutes + '<em>/240</em></strong><span>总上场时间</span></div><div><strong>' + validation.activeCount + '<em>/9–11</em></strong><span>轮换人数</span></div><div><strong>' + validation.starterCount + '<em>/5</em></strong><span>首发人数</span></div><span class="manager-validation-label">' + (validation.valid ? '✓ 轮换合法' : '需要修正') + '</span></div>' +
      (validation.valid ? '' : '<div class="manager-error-list" role="alert">' + validation.errors.map(function(error) { return '<div>! ' + escapeHtml(error) + '</div>'; }).join('') + '</div>') +
      '<div class="manager-roster-list">' + sorted.map(function(player) {
        var assignment = current.rotation[player.id] || { starter: false, minutes: 0 };
        var positions = escapeHtml(String(player.pos || '').replace(/\s+/g, ' '));
        return '<article class="manager-player-row ' + (assignment.starter ? 'is-starter' : '') + ' ' + (assignment.minutes > 0 ? 'is-active' : 'is-inactive') + '">' +
          '<div class="manager-player-rank">' + (assignment.starter ? 'S' : (assignment.minutes > 0 ? 'R' : '—')) + '</div>' +
          '<div class="manager-player-copy"><strong>' + escapeHtml(player.cname || player.name || '球员') + '</strong><span>' + positions + ' · OVR ' + (Number(player.ovr) || 0) + '</span></div>' +
          '<label class="manager-minute-field"><span>分钟</span><input type="number" min="0" max="48" step="1" value="' + (Number(assignment.minutes) || 0) + '" data-minute-player="' + escapeHtml(player.id) + '"></label>' +
          '<button class="manager-toggle-button" type="button" data-action="toggle-starter" data-player="' + escapeHtml(player.id) + '" aria-pressed="' + (!!assignment.starter) + '">' + (assignment.starter ? '首发' : '轮换') + '</button>' +
        '</article>';
      }).join('') + '</div>' +
      '<div class="manager-roster-footer"><span>修改会即时写入经理状态，点击下方保存后刷新仍可恢复。</span></div>' +
    '</section>';
  }

  function conferenceForTeam(teamId) {
    var conferences = config().CONFERENCE || {};
    return (conferences.NORTH || []).indexOf(teamId) >= 0 ? 'NORTH' : 'SOUTH';
  }

  function averageOvr(players) {
    if (!players.length) return 0;
    return Math.round(players.reduce(function(sum, player) { return sum + (Number(player.ovr) || 0); }, 0) / players.length);
  }

  function lineupOvr(current, teamId) {
    var roster = (current.leagueData[teamId] || []).slice();
    if (teamId === current.selectedTeam) {
      roster.sort(function(a, b) {
        var aAssignment = current.rotation[a.id] || {};
        var bAssignment = current.rotation[b.id] || {};
        return (Number(bAssignment.minutes) || 0) - (Number(aAssignment.minutes) || 0) || (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
      });
      var starters = roster.filter(function(player) { return current.rotation[player.id] && current.rotation[player.id].starter; }).slice(0, 5);
      var rotation = roster.filter(function(player) { return current.rotation[player.id] && Number(current.rotation[player.id].minutes) > 0; }).slice(0, 10);
      return { starter: averageOvr(starters.length === 5 ? starters : roster.slice(0, 5)), rotation: averageOvr(rotation.length ? rotation : roster.slice(0, 10)) };
    }
    roster.sort(function(a, b) { return (Number(b.ovr) || 0) - (Number(a.ovr) || 0); });
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
    var teamBody = '<div class="manager-standings-tabs"><button type="button" class="' + (conference === 'SOUTH' ? 'is-active' : '') + '" data-action="set-standings-conference" data-conference="SOUTH">南方</button><button type="button" class="' + (conference === 'NORTH' ? 'is-active' : '') + '" data-action="set-standings-conference" data-conference="NORTH">北方</button></div>' +
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
        '<button type="button" class="' + (playerRankingStat === 'pts' ? 'is-active' : '') + '" data-action="set-player-ranking-stat" data-stat="pts">得分</button>' +
        '<button type="button" class="' + (playerRankingStat === 'reb' ? 'is-active' : '') + '" data-action="set-player-ranking-stat" data-stat="reb">篮板</button>' +
        '<button type="button" class="' + (playerRankingStat === 'ast' ? 'is-active' : '') + '" data-action="set-player-ranking-stat" data-stat="ast">助攻</button>' +
        '<button type="button" class="' + (playerRankingStat === 'stl' ? 'is-active' : '') + '" data-action="set-player-ranking-stat" data-stat="stl">抢断</button>' +
        '<button type="button" class="' + (playerRankingStat === 'blk' ? 'is-active' : '') + '" data-action="set-player-ranking-stat" data-stat="blk">盖帽</button>' +
      '</div>' +
      '<div class="manager-player-stat-panel"><div class="manager-player-stat-list"><div class="manager-player-stat-head"><span>排名</span><span>球员</span><span>球队</span><span>场次</span><span>' + activeStat.label + '</span></div>' + playerListHtml + '</div>' +
      (remainingPlayerRows > 0 ? '<button type="button" class="manager-button manager-button-secondary manager-player-stat-more" data-action="show-more-player-stats">查看更多（下 ' + Math.min(10, remainingPlayerRows) + ' 名）</button>' : '') + '</div>';
    main.innerHTML = '<section class="manager-page manager-standings-page"><div class="manager-page-head"><div><div class="manager-eyebrow">赛季排名 / STANDINGS</div><h1>' + (current.season.phase === 'complete' ? '赛季总结' : '联盟排行榜') + '</h1><p>' + (current.season.phase === 'complete' ? '冠军：' + escapeHtml(teamName(current.season.champion)) + ' · 董事会：' + escapeHtml(owner.label || '') : '排名按战绩与净胜分排序，各联盟前八进入季后赛。') + '</p></div></div>' +
      (current.season.phase === 'complete' ? '<div class="manager-review-banner"><strong>' + (owner.score || 0) + '<em>/100</em></strong><div><b>' + escapeHtml(owner.label || '') + '</b><span>' + escapeHtml(owner.summary || '') + '</span></div></div>' : '') +
      '<div class="manager-rankings-view-tabs"><button type="button" class="' + (standingsView === 'teams' ? 'is-active' : '') + '" data-action="set-standings-view" data-standings-view="teams">球队战绩</button><button type="button" class="' + (standingsView === 'players' ? 'is-active' : '') + '" data-action="set-standings-view" data-standings-view="players">球员统计</button></div>' +
      (standingsView === 'players' ? playerBody : teamBody) + '</section>';
  }

  function renderSeason() {
    var current = state();
    var next = current.season.phase === 'regular' ? global.ManagerEngine.getNextRegularGame(current) : null;
    var userSchedule = current.season.schedule.filter(function(game) { return game.home === current.selectedTeam || game.away === current.selectedTeam; });
    var userGames = current.season.games.filter(function(game) { return game.home === current.selectedTeam || game.away === current.selectedTeam; });
    var gameCount = userGames.filter(function(game) { return game.phase === 'regular'; }).length;
    var playoffCount = userGames.filter(function(game) { return game.phase === 'playoffs'; }).length;
    main.innerHTML = '<section class="manager-page manager-season-page"><div class="manager-page-head"><div><div class="manager-eyebrow">赛季中心 / SEASON LOG</div><h1>结果会留下痕迹。</h1><p>逐场推进适合观察，批量模拟适合快速完成赛季。</p></div></div>' +
      '<div class="manager-season-timeline"><div class="is-done"><span>01</span><b>常规赛</b><small>' + gameCount + ' / ' + userSchedule.length + ' 场</small></div><div class="' + (current.season.phase === 'playoffs' || current.season.phase === 'complete' ? 'is-done' : '') + '"><span>02</span><b>季后赛</b><small>' + playoffCount + ' 场已完成</small></div><div class="' + (current.season.phase === 'complete' ? 'is-done' : '') + '"><span>03</span><b>董事会评价</b><small>' + (current.owner.evaluation ? '已生成' : '赛季结束后生成') + '</small></div></div>' +
      '<article class="manager-panel manager-season-log"><div class="manager-panel-kicker">MY GAME LOG</div>' + (userGames.slice(-8).reverse().map(function(game) { return '<div class="manager-log-row"><span>' + (game.phase === 'regular' ? '常规赛' : '季后赛') + '</span><b>' + escapeHtml(teamName(game.home)) + ' ' + game.homeScore + ' : ' + game.awayScore + ' ' + escapeHtml(teamName(game.away)) + '</b><small>' + (game.winner === current.selectedTeam ? '你的球队获胜' : '你的球队失利') + '</small></div>'; }).join('') || '<div class="manager-empty-line">还没有你的比赛记录。</div>') + '</article>' +
      '<div class="manager-season-actions">' + (current.season.phase === 'regular' ? '<button class="manager-button manager-button-primary" type="button" data-action="simulate-regular">模拟完常规赛</button>' : '') + (current.season.phase === 'playoffs' ? '<button class="manager-button manager-button-primary" type="button" data-action="simulate-playoffs">模拟至总冠军</button>' : '') + (next ? '<span>下一场：' + escapeHtml(teamName(next.home === current.selectedTeam ? next.away : next.home)) + '</span>' : '') + '</div></section>';
  }

  function render() {
    if (!state()) { renderWelcome(); return; }
    setSession(true);
    nav.querySelectorAll('[data-view]').forEach(function(button) { button.classList.toggle('is-active', button.dataset.view === view); });
    if (view === 'roster') renderRoster();
    else if (view === 'standings') renderStandings();
    else if (view === 'season') renderSeason();
    else renderDashboard();
    updateNextAction();
    global.scrollTo(0, 0);
  }

  function setState(nextState) {
    global.MANAGER_STATE = nextState;
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
    if (!state()) return;
    global.ManagerStorage.save(state()).then(function() { showToast('经理存档已保存到独立槽位。'); }).catch(function(error) { showToast(error.message || '保存失败。', true); });
  }

  function loadSave() {
    global.ManagerStorage.load().then(function(saved) {
      if (!saved) { showToast('没有找到经理模式存档。', true); return; }
      setState(saved);
      showToast('经理存档已读取。');
    }).catch(function(error) { showToast(error.message || '读取失败。', true); });
  }

  function restartGame() {
    global.ManagerStorage.clear().catch(function() {}).then(function() {
      global.MANAGER_STATE = null;
      view = 'dashboard';
      render();
      showToast('已重开经理模式，请重新选择执教球队。');
    });
  }

  function simulate(action) {
    if (!state()) return;
    try {
      var count = 0;
      if (action === 'simulate-next') { count = global.ManagerEngine.simulateNextUserRegularGame(state()).result ? 1 : 0; }
      if (action === 'simulate-regular') count = global.ManagerEngine.simulateRemainingRegularSeason(state());
      if (action === 'simulate-playoff-next') { count = global.ManagerEngine.simulateNextUserPostseasonGame(state()).result ? 1 : 0; }
      if (action === 'simulate-playoffs') count = global.ManagerEngine.simulateRemainingPostseason(state());
      global.ManagerStorage.save(state()).catch(function() {});
      render();
      showToast(count ? '已推进 ' + count + ' 场。' : '赛季状态已更新。');
    } catch (error) { showToast(error.message || '模拟失败。', true); }
  }

  function toggleStarter(playerId) {
    var current = state();
    if (!current || !current.rotation[playerId]) return;
    current.rotation[playerId].starter = !current.rotation[playerId].starter;
    if (current.rotation[playerId].starter && Number(current.rotation[playerId].minutes) <= 0) current.rotation[playerId].minutes = 24;
    renderRoster();
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
    else if (action === 'set-standings-view') { standingsView = target.dataset.standingsView === 'players' ? 'players' : 'teams'; playerRankingLimit = 10; renderStandings(); }
    else if (action === 'set-standings-conference') { standingsConference = target.dataset.conference === 'NORTH' ? 'NORTH' : 'SOUTH'; renderStandings(); }
    else if (action === 'set-player-ranking-stat') { playerRankingStat = statConfigValue(target.dataset.stat); playerRankingLimit = 10; renderStandings(); }
    else if (action === 'show-more-player-stats') { playerRankingLimit += 10; renderStandings(); }
    else if (action === 'open-roster') { view = 'roster'; render(); }
    else if (action === 'open-dashboard') { view = 'dashboard'; render(); }
    else if (action === 'toggle-starter') toggleStarter(target.dataset.player);
    else if (action === 'simulate-next' || action === 'simulate-regular' || action === 'simulate-playoff-next' || action === 'simulate-playoffs') simulate(action);
  }

  function handleInput(event) {
    var input = event.target.closest('[data-minute-player]');
    if (!input || !state()) return;
    var playerId = input.dataset.minutePlayer;
    if (!state().rotation[playerId]) return;
    state().rotation[playerId].minutes = Number(input.value);
    var validation = global.ManagerState.validateRotation(state().leagueData[state().selectedTeam] || [], state().rotation);
    var status = main.querySelector('.manager-rotation-status');
    if (status) {
      status.classList.toggle('is-valid', validation.valid);
      status.classList.toggle('is-invalid', !validation.valid);
      status.querySelector('.manager-validation-label').textContent = validation.valid ? '✓ 轮换合法' : '需要修正';
      status.querySelector('div:first-child strong').innerHTML = validation.totalMinutes + '<em>/240</em>';
      status.querySelector('div:nth-child(2) strong').innerHTML = validation.activeCount + '<em>/9–11</em>';
    }
  }

  function init() {
    root = document.getElementById('manager-app');
    main = document.getElementById('manager-main');
    nav = document.getElementById('manager-nav');
    saveActions = document.getElementById('manager-save-actions');
    toast = document.getElementById('manager-toast');
    root.addEventListener('click', handleClick);
    root.addEventListener('input', handleInput);
    renderWelcome();
    global.ManagerStorage.load().then(function(saved) {
      if (saved) showToast('检测到经理存档，可从右上角读取。');
    }).catch(function() {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
