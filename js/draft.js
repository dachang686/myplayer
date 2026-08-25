// ==================== 休赛期选秀抽签与选秀大会 ====================
(function() {
  var LOTTERY_WEIGHTS = [14, 14, 14, 12.5, 10.5, 9, 7.5, 6, 4.5, 3, 2, 1.5, 1, 0.5];
  var DRAFT_ROSTER_LIMIT = 18;
  var draftPipelineRunning = false;

  function hashText(value) {
    var text = String(value || 'draft');
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededValue(seed, key) {
    var x = hashText(String(seed) + '|' + String(key));
    x += 0x6D2B79F5;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  function getDraftSeasonNumber() {
    return Math.max(1, Number(STATE.career && STATE.career.seasonCount) || 1);
  }

  function getDraftYearLabel(seasonNum) {
    var year = 2026 + Math.max(1, Number(seasonNum) || 1);
    return year + ' 选秀大会';
  }

  function getStandingRow(team) {
    var standings = (STATE.season && STATE.season.standings) || STATE._prevStandings || {};
    var row = standings[team] || {};
    var wins = Number(row.wins) || 0;
    var losses = Number(row.losses) || 0;
    return {
      team: team,
      wins: wins,
      losses: losses,
      pct: wins + losses ? wins / (wins + losses) : 0.5
    };
  }

  function sortTeamsByRecord(teams, seed) {
    return teams.map(getStandingRow).sort(function(a, b) {
      if (a.pct !== b.pct) return a.pct - b.pct;
      if (a.wins !== b.wins) return a.wins - b.wins;
      return seededValue(seed, 'record|' + a.team) - seededValue(seed, 'record|' + b.team);
    });
  }

  function collectPlayoffTeams() {
    var found = {};
    function addBracket(bracket) {
      if (!bracket || !Array.isArray(bracket.teams)) return;
      bracket.teams.forEach(function(item) {
        var team = item && (item.team || item);
        if (team) found[team] = true;
      });
    }
    addBracket(STATE.season && STATE.season.playoffBracket);
    addBracket(STATE.season && STATE.season.otherBracket);
    return Object.keys(found);
  }

  function getPlayoffFinishStage(team) {
    var stage = 0;
    var champion = false;
    function scan(bracket) {
      if (!bracket || !Array.isArray(bracket.results)) return;
      bracket.results.forEach(function(result) {
        if (!result || (result.teamA !== team && result.teamB !== team)) return;
        var round = Number(result.round) || 0;
        if (result.winner === team) {
          stage = Math.max(stage, round + 1);
          if (round === 3) champion = true;
        } else {
          stage = Math.max(stage, round);
        }
      });
    }
    scan(STATE.season && STATE.season.playoffBracket);
    scan(STATE.season && STATE.season.otherBracket);
    return champion ? 4 : stage;
  }

  function buildDraftOrder(seed) {
    var allTeams = (typeof LEAGUE_TEAM_IDS !== 'undefined' ? LEAGUE_TEAM_IDS : []).slice();
    var playoffTeams = collectPlayoffTeams();
    var playoffMap = {};
    playoffTeams.forEach(function(team) { playoffMap[team] = true; });
    var eligible = allTeams.filter(function(team) { return !playoffMap[team]; });
    var recordOrder = sortTeamsByRecord(allTeams, seed);

    if (eligible.length !== 14) eligible = recordOrder.slice(0, 14).map(function(row) { return row.team; });
    var eligibleRows = sortTeamsByRecord(eligible, seed);
    var originalRank = {};
    eligibleRows.forEach(function(row, index) { originalRank[row.team] = index + 1; });

    var weightedPool = eligibleRows.map(function(row, index) {
      return { team: row.team, weight: LOTTERY_WEIGHTS[index] || 0.5 };
    });
    var topFour = [];
    for (var pick = 1; pick <= 4; pick++) {
      var total = weightedPool.reduce(function(sum, item) { return sum + item.weight; }, 0);
      var roll = seededValue(seed, 'lottery|' + pick) * total;
      var selectedIndex = weightedPool.length - 1;
      for (var wi = 0; wi < weightedPool.length; wi++) {
        roll -= weightedPool[wi].weight;
        if (roll <= 0) { selectedIndex = wi; break; }
      }
      topFour.push(weightedPool.splice(selectedIndex, 1)[0].team);
    }
    var topMap = {};
    topFour.forEach(function(team) { topMap[team] = true; });
    var lotteryOrder = topFour.concat(eligibleRows.filter(function(row) {
      return !topMap[row.team];
    }).map(function(row) { return row.team; }));

    var lotteryMap = {};
    lotteryOrder.forEach(function(team) { lotteryMap[team] = true; });
    var postseason = allTeams.filter(function(team) { return !lotteryMap[team]; }).map(function(team) {
      var row = getStandingRow(team);
      row.stage = getPlayoffFinishStage(team);
      return row;
    }).sort(function(a, b) {
      if (a.stage !== b.stage) return a.stage - b.stage;
      if (a.pct !== b.pct) return a.pct - b.pct;
      return seededValue(seed, 'post|' + a.team) - seededValue(seed, 'post|' + b.team);
    });

    var fullOrder = lotteryOrder.concat(postseason.map(function(row) { return row.team; }));
    return {
      eligibleTeams: eligibleRows.map(function(row, index) {
        return { team: row.team, wins: row.wins, losses: row.losses, originalRank: index + 1, odds: LOTTERY_WEIGHTS[index] };
      }),
      lotteryOrder: lotteryOrder,
      draftOrder: fullOrder.map(function(team, index) {
        return {
          pick: index + 1,
          originalTeam: team,
          ownerTeam: team,
          originalRank: originalRank[team] || null
        };
      })
    };
  }

  function createOffseasonDraftState() {
    var seasonNum = getDraftSeasonNumber();
    var seed = hashText((STATE.gameId || 'career') + '|draft|' + seasonNum);
    var order = buildDraftOrder(seed);
    return {
      version: 2,
      seasonNum: seasonNum,
      yearLabel: getDraftYearLabel(seasonNum),
      seed: seed,
      phase: 'lottery',
      lottery: {
        eligibleTeams: order.eligibleTeams,
        order: order.lotteryOrder,
        revealedCount: 0
      },
      draftOrder: order.draftOrder,
      pickTrades: {
        strategy: 'hold',
        submitted: false,
        result: '',
        transactions: []
      },
      prospects: [],
      picks: [],
      currentPick: 0,
      pendingSuggestionId: '',
      completed: false,
      historySaved: false
    };
  }

  function ensureOffseasonDraftState() {
    var seasonNum = getDraftSeasonNumber();
    if (!STATE.offseasonDraft || STATE.offseasonDraft.seasonNum !== seasonNum) {
      STATE.offseasonDraft = createOffseasonDraftState();
    }
    var draft = STATE.offseasonDraft;
    // pipelineStarted 曾作为点击锁写进存档；中断后会让按钮永久静默失效。
    if (draft.pipelineStarted != null) delete draft.pipelineStarted;
    draft.version = Math.max(2, Number(draft.version) || 1);
    draft.pickTrades = draft.pickTrades || {
      strategy: 'hold',
      submitted: false,
      result: '',
      transactions: []
    };
    draft.pickTrades.transactions = draft.pickTrades.transactions || [];
    (draft.draftOrder || []).forEach(function(entry) {
      if (!entry.ownerTeam) entry.ownerTeam = entry.originalTeam;
      if (!Array.isArray(entry.tradeHistory)) entry.tradeHistory = [];
    });
    return draft;
  }

  window.shouldRunOffseasonDraftLottery = function() {
    var draft = ensureOffseasonDraftState();
    return draft.phase === 'lottery';
  };

  function persistDraftProgress() {
    if (typeof autoSaveGame === 'function') {
      Promise.resolve(autoSaveGame()).catch(function(error) {
        console.error('[Draft] 自动保存失败:', error);
      });
    }
  }

  function lotteryMovementLabel(team, pick, eligibleTeams) {
    var original = null;
    eligibleTeams.some(function(item) {
      if (item.team === team) { original = item.originalRank; return true; }
      return false;
    });
    if (!original || original === pick) return '保持';
    return original > pick ? '上升 ' + (original - pick) + ' 位' : '下降 ' + (pick - original) + ' 位';
  }

  function renderLotteryRows(draft) {
    var revealed = Number(draft.lottery.revealedCount) || 0;
    var threshold = 15 - revealed;
    var html = '';
    for (var pick = 14; pick >= 1; pick--) {
      var team = draft.lottery.order[pick - 1];
      var isRevealed = pick >= threshold;
      var isMine = team === STATE.careerTeam;
      html += '<div class="draft-lottery-row' + (isRevealed ? ' is-revealed' : '') + (isMine ? ' is-mine' : '') + '">';
      html += '<span class="draft-pick-no">' + pick + '</span>';
      if (isRevealed) {
        html += '<span class="draft-team-logo">' + getTeamLogo(team, 28) + '</span>';
        html += '<span class="draft-team-name">' + getTeamName(team) + (isMine ? '<small>我的球队</small>' : '') + '</span>';
        html += '<span class="draft-movement">' + lotteryMovementLabel(team, pick, draft.lottery.eligibleTeams) + '</span>';
      } else {
        html += '<span class="draft-team-logo is-hidden">?</span>';
        html += '<span class="draft-team-name is-hidden">等待揭晓</span>';
        html += '<span class="draft-movement">乐透签</span>';
      }
      html += '</div>';
    }
    return html;
  }

  window.showOffseasonDraftLottery = function() {
    var draft = ensureOffseasonDraftState();
    if (draft.phase !== 'lottery') {
      beginOffseason();
      return;
    }
    showScreen('screen-draft-lottery');
    var target = document.getElementById('draft-lottery-content');
    if (!target) return;
    var revealed = Number(draft.lottery.revealedCount) || 0;
    var myEntry = draft.draftOrder.filter(function(item) { return item.ownerTeam === STATE.careerTeam; })[0];
    var myLottery = myEntry && myEntry.pick <= 14;
    var myPickRevealed = myEntry && (!myLottery || myEntry.pick >= 15 - revealed);
    var nextPick = Math.max(1, 14 - revealed);
    var actionHtml = '';
    if (revealed < 14) {
      actionHtml = '<button type="button" class="draft-action-primary" onclick="revealNextLotteryPick()">' +
        (revealed ? '揭晓第 ' + nextPick + ' 顺位' : '开始抽签') + '</button>' +
        '<button type="button" class="draft-action-secondary" onclick="revealAllLotteryPicks()">全部揭晓</button>';
    } else {
      actionHtml = '<button type="button" class="draft-action-primary" onclick="completeOffseasonDraftLottery()">进入选秀签交易窗口</button>';
    }
    target.innerHTML = '<main class="draft-shell">' +
      '<header class="draft-page-head"><div><span class="draft-kicker">DRAFT LOTTERY</span><h1>选秀抽签</h1></div><span class="draft-year">' + draft.yearLabel + '</span></header>' +
      '<div class="draft-context"><span>' + (myLottery ? '你的球队拥有乐透签' : '你的球队不参加乐透抽签') + '</span>' +
        '<strong>' + (myPickRevealed ? '首轮第 ' + myEntry.pick + ' 顺位' : '乐透结果待揭晓') + '</strong></div>' +
      '<section class="draft-lottery-board" aria-label="乐透抽签结果">' + renderLotteryRows(draft) + '</section>' +
      '<p id="draft-live-status" class="draft-live-status" aria-live="polite">' +
        (revealed ? '已揭晓 ' + revealed + ' 个乐透顺位' : '结果已锁定，揭晓操作不会改变抽签结果') + '</p>' +
      '<div class="draft-actions">' + actionHtml + '</div>' +
      '</main>';
  };

  window.revealNextLotteryPick = function() {
    var draft = ensureOffseasonDraftState();
    if (draft.phase !== 'lottery' || draft.lottery.revealedCount >= 14) return;
    draft.lottery.revealedCount++;
    showOffseasonDraftLottery();
    persistDraftProgress();
  };

  window.revealAllLotteryPicks = function() {
    var draft = ensureOffseasonDraftState();
    if (draft.phase !== 'lottery') return;
    draft.lottery.revealedCount = 14;
    showOffseasonDraftLottery();
    persistDraftProgress();
  };

  window.completeOffseasonDraftLottery = function() {
    var draft = ensureOffseasonDraftState();
    if (draft.lottery.revealedCount < 14) return;
    draft.phase = 'pick_trades';
    persistDraftProgress();
    showDraftPickTradeScreen();
  };

  function getDraftPickTradeValue(pick) {
    pick = Math.max(1, Math.min(30, Number(pick) || 30));
    if (pick <= 4) return 105 - (pick - 1) * 8;
    if (pick <= 14) return 77 - (pick - 5) * 3;
    if (pick <= 22) return 47 - (pick - 15) * 2;
    return 31 - (pick - 23) * 1.5;
  }

  function getDraftPlayerTradeValue(player) {
    var ovr = Number(player && player.ovr) || 60;
    var value = ovr >= 90 ? 95 + (ovr - 90) * 8
      : ovr >= 86 ? 73 + (ovr - 86) * 6
      : ovr >= 82 ? 53 + (ovr - 82) * 5
      : ovr >= 78 ? 37 + (ovr - 78) * 4
      : ovr >= 74 ? 23 + (ovr - 74) * 3
      : Math.max(6, 10 + (ovr - 68) * 2);
    var age = typeof getLeaguePlayerAge === 'function' ? getLeaguePlayerAge(player) : 27;
    var ageFactor = age <= 25 ? 1.15 : age <= 29 ? 1 : age <= 32 ? 0.85 : 0.66;
    var contract = Number(player && player.contract) || 1;
    var contractFactor = contract >= 3 ? 1.05 : contract === 1 ? 0.94 : 1;
    return Math.max(4, Math.round(value * ageFactor * contractFactor));
  }

  window.getDraftPickTradeValue = getDraftPickTradeValue;
  window.getDraftPlayerTradeValue = getDraftPlayerTradeValue;

  function isPickTradePlayerAvailable(player, draft, team) {
    if (!player || player._isUser || player._justSigned || (Number(player.ovr) || 0) > 92 ||
      player._draftPickTradeSeason === draft.seasonNum) return false;
    var roster = (LEAGUE_PLAYER_DATA[team] || []).slice().sort(function(a, b) {
      return (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
    });
    return roster.indexOf(player) >= 4;
  }

  function closestTradePlayer(team, targetValue, draft, minimumValue, maximumValue) {
    var roster = LEAGUE_PLAYER_DATA[team] || [];
    var candidates = roster.filter(function(player) {
      if (!isPickTradePlayerAvailable(player, draft, team)) return false;
      var value = getDraftPlayerTradeValue(player);
      return value >= (minimumValue || 0) && value <= (maximumValue || 999);
    });
    candidates.sort(function(a, b) {
      var delta = Math.abs(getDraftPlayerTradeValue(a) - targetValue) - Math.abs(getDraftPlayerTradeValue(b) - targetValue);
      return delta || seededValue(draft.seed, 'trade-player|' + a.id) - seededValue(draft.seed, 'trade-player|' + b.id);
    });
    return candidates[0] || null;
  }

  function moveTradePlayer(fromTeam, toTeam, player, draft) {
    var fromRoster = LEAGUE_PLAYER_DATA[fromTeam] || [];
    var toRoster = LEAGUE_PLAYER_DATA[toTeam] || (LEAGUE_PLAYER_DATA[toTeam] = []);
    var index = fromRoster.indexOf(player);
    if (index < 0) return false;
    fromRoster.splice(index, 1);
    toRoster.push(player);
    player._draftPickTradeSeason = draft.seasonNum;
    return true;
  }

  function swapTradePlayers(teamA, playerA, teamB, playerB, draft) {
    var rosterA = LEAGUE_PLAYER_DATA[teamA] || [];
    var rosterB = LEAGUE_PLAYER_DATA[teamB] || [];
    var indexA = rosterA.indexOf(playerA);
    var indexB = rosterB.indexOf(playerB);
    if (indexA < 0 || indexB < 0) return false;
    rosterA[indexA] = playerB;
    rosterB[indexB] = playerA;
    playerA._draftPickTradeSeason = draft.seasonNum;
    playerB._draftPickTradeSeason = draft.seasonNum;
    return true;
  }

  function updatePickOwner(entry, newOwner, transactionId) {
    var previousOwner = entry.ownerTeam;
    entry.ownerTeam = newOwner;
    entry.tradeHistory.push({ from: previousOwner, to: newOwner, transactionId: transactionId });
  }

  function recordPickTrade(draft, transaction) {
    draft.pickTrades.transactions.push(transaction);
    clearLineupCache();
  }

  function executePickSwap(draft, higherEntry, lowerEntry, bridgePlayer, playerFromTeam, source) {
    var higherOwner = higherEntry.ownerTeam;
    var lowerOwner = lowerEntry.ownerTeam;
    if (!moveTradePlayer(playerFromTeam, playerFromTeam === higherOwner ? lowerOwner : higherOwner, bridgePlayer, draft)) return false;
    var transactionId = 'pick-trade-' + draft.seasonNum + '-' + (draft.pickTrades.transactions.length + 1);
    updatePickOwner(higherEntry, lowerOwner, transactionId);
    updatePickOwner(lowerEntry, higherOwner, transactionId);
    recordPickTrade(draft, {
      id: transactionId,
      kind: 'pick_swap',
      source: source,
      teams: [higherOwner, lowerOwner],
      picks: [higherEntry.pick, lowerEntry.pick],
      playerId: bridgePlayer.id,
      playerName: bridgePlayer.cname,
      playerFrom: playerFromTeam,
      playerTo: playerFromTeam === higherOwner ? lowerOwner : higherOwner
    });
    return true;
  }

  function findUserPickSwap(draft, strategy) {
    var mine = draft.draftOrder.filter(function(entry) { return entry.ownerTeam === STATE.careerTeam && !entry.tradeHistory.length; })[0];
    if (!mine) return null;
    var targets = draft.draftOrder.filter(function(entry) {
      if (entry.ownerTeam === STATE.careerTeam || entry.tradeHistory.length) return false;
      return strategy === 'move_up' ? entry.pick < mine.pick : entry.pick > mine.pick;
    }).sort(function(a, b) {
      var targetA = Math.abs(a.pick - mine.pick);
      var targetB = Math.abs(b.pick - mine.pick);
      return targetA - targetB || seededValue(draft.seed, 'user-target|' + a.pick) - seededValue(draft.seed, 'user-target|' + b.pick);
    });
    for (var i = 0; i < targets.length; i++) {
      var target = targets[i];
      if (Math.abs(target.pick - mine.pick) > 10) continue;
      var higher = strategy === 'move_up' ? target : mine;
      var lower = strategy === 'move_up' ? mine : target;
      var bridgeTeam = lower.ownerTeam;
      var gap = getDraftPickTradeValue(higher.pick) - getDraftPickTradeValue(lower.pick);
      var player = closestTradePlayer(bridgeTeam, gap, draft, Math.max(4, gap * 0.72), gap * 1.28 + 4);
      if (player) return { higher: higher, lower: lower, player: player, gap: gap };
    }
    return null;
  }

  function executeAiPickTrades(draft, limit) {
    limit = Math.max(0, Number(limit) || 0);
    var completed = 0;
    var entries = draft.draftOrder.slice().sort(function(a, b) {
      return seededValue(draft.seed, 'ai-pick|' + a.pick) - seededValue(draft.seed, 'ai-pick|' + b.pick);
    });
    for (var i = 0; i < entries.length && completed < limit; i++) {
      var first = entries[i];
      if (first.ownerTeam === STATE.careerTeam || first.tradeHistory.length) continue;
      for (var j = i + 1; j < entries.length; j++) {
        var second = entries[j];
        if (second.ownerTeam === STATE.careerTeam || second.ownerTeam === first.ownerTeam || second.tradeHistory.length) continue;
        var higher = first.pick < second.pick ? first : second;
        var lower = first.pick < second.pick ? second : first;
        if (lower.pick - higher.pick > 8) continue;
        var gap = getDraftPickTradeValue(higher.pick) - getDraftPickTradeValue(lower.pick);
        var player = closestTradePlayer(lower.ownerTeam, gap, draft, Math.max(4, gap * 0.76), gap * 1.24 + 3);
        if (!player) continue;
        if (seededValue(draft.seed, 'ai-accept|' + higher.pick + '|' + lower.pick) > 0.58) continue;
        if (executePickSwap(draft, higher, lower, player, lower.ownerTeam, 'ai')) completed++;
        break;
      }
    }
  }

  function executeAiPickAcquisition(draft) {
    var entries = draft.draftOrder.slice().sort(function(a, b) {
      return seededValue(draft.seed, 'ai-acquire-pick|' + a.pick) - seededValue(draft.seed, 'ai-acquire-pick|' + b.pick);
    });
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var seller = entry.ownerTeam;
      if (entry.pick < 15 || seller === STATE.careerTeam || entry.tradeHistory.length) continue;
      var sellerPlayer = closestTradePlayer(seller, 16, draft, 6, 30);
      if (!sellerPlayer) continue;
      var sellerPlayerValue = getDraftPlayerTradeValue(sellerPlayer);
      var targetValue = getDraftPickTradeValue(entry.pick) + sellerPlayerValue;
      var buyers = LEAGUE_TEAM_IDS.slice().filter(function(team) { return team !== seller && team !== STATE.careerTeam; });
      buyers.sort(function(a, b) {
        return seededValue(draft.seed, 'ai-buyer|' + entry.pick + '|' + a) - seededValue(draft.seed, 'ai-buyer|' + entry.pick + '|' + b);
      });
      for (var j = 0; j < buyers.length; j++) {
        var buyer = buyers[j];
        var buyerPlayer = closestTradePlayer(buyer, targetValue, draft, targetValue * 0.82, targetValue * 1.18);
        if (!buyerPlayer) continue;
        if (seededValue(draft.seed, 'ai-acquire-accept|' + entry.pick + '|' + buyer) > 0.52) continue;
        if (!swapTradePlayers(seller, sellerPlayer, buyer, buyerPlayer, draft)) continue;
        var transactionId = 'pick-trade-' + draft.seasonNum + '-' + (draft.pickTrades.transactions.length + 1);
        updatePickOwner(entry, buyer, transactionId);
        recordPickTrade(draft, {
          id: transactionId,
          kind: 'pick_acquisition',
          source: 'ai',
          teams: [seller, buyer],
          picks: [entry.pick],
          playerId: buyerPlayer.id,
          playerName: buyerPlayer.cname,
          playerFrom: buyer,
          playerTo: seller,
          returnedPlayerId: sellerPlayer.id,
          returnedPlayerName: sellerPlayer.cname
        });
        return true;
      }
    }
    return false;
  }

  function strategyLabel(strategy) {
    if (strategy === 'move_up') return '尝试向上交易';
    if (strategy === 'move_down') return '考虑向下交易';
    return '保留当前签位';
  }

  window.setDraftPickTradeStrategy = function(strategy) {
    var draft = ensureOffseasonDraftState();
    if (draft.phase !== 'pick_trades' || draft.pickTrades.submitted) return;
    if (['hold', 'move_up', 'move_down'].indexOf(strategy) < 0) return;
    draft.pickTrades.strategy = strategy;
    showDraftPickTradeScreen();
  };

  window.submitDraftPickTradeAdvice = function() {
    var draft = ensureOffseasonDraftState();
    var tradeState = draft.pickTrades;
    if (draft.phase !== 'pick_trades' || tradeState.submitted) return;
    tradeState.submitted = true;
    var strategy = tradeState.strategy || 'hold';
    if (strategy === 'hold') {
      tradeState.result = '管理层采纳了保留建议：你的球队不会在本窗口主动交易首轮签。';
    } else {
      var offer = findUserPickSwap(draft, strategy);
      if (!offer) {
        tradeState.result = '管理层询价后没有找到价值匹配的方案，本轮保留现有签位。';
      } else {
        var profile = typeof getCareerProfile === 'function' ? getCareerProfile() : {};
        var influence = (Number(profile.coachTrust) || 0) * 1.5 + (Number(profile.leadership) || 0);
        var chance = Math.max(48, Math.min(88, Math.round(68 + influence)));
        var accepted = seededValue(draft.seed, 'user-pick-advice|' + strategy + '|' + offer.higher.pick + '|' + offer.lower.pick) * 100 < chance;
        if (accepted && executePickSwap(draft, offer.higher, offer.lower, offer.player, offer.lower.ownerTeam, 'user_advice')) {
          var acquired = draft.draftOrder.filter(function(entry) { return entry.ownerTeam === STATE.careerTeam && entry.tradeHistory.length; })[0];
          tradeState.result = '管理层采纳建议并完成交易，你的球队现持有首轮第 ' + acquired.pick + ' 顺位。';
        } else {
          tradeState.result = '管理层听取了建议，但认为对方报价过高，本轮保留现有签位。';
        }
      }
    }
    var aiBudget = Math.max(0, 3 - draft.pickTrades.transactions.length);
    if (aiBudget && executeAiPickAcquisition(draft)) aiBudget--;
    executeAiPickTrades(draft, aiBudget);
    showDraftPickTradeScreen();
    persistDraftProgress();
  };

  function renderPickTradeTransaction(transaction) {
    var playerMove = getTeamName(transaction.playerFrom) + '送出 ' + transaction.playerName + ' 至 ' + getTeamName(transaction.playerTo);
    if (transaction.returnedPlayerName) playerMove += '，换回 ' + transaction.returnedPlayerName;
    var pickMove = transaction.kind === 'pick_acquisition'
      ? getTeamName(transaction.teams[0]) + '送出首轮第 ' + transaction.picks[0] + ' 顺位'
      : '首轮第 ' + transaction.picks[0] + ' 顺位 ↔ 第 ' + transaction.picks[1] + ' 顺位';
    return '<div class="draft-trade-row"><div><strong>' + getTeamName(transaction.teams[0]) + ' ↔ ' + getTeamName(transaction.teams[1]) + '</strong>' +
      '<span>' + pickMove + '</span><small>' + playerMove + '</small></div>' +
      '<em>' + (transaction.source === 'user_advice' ? '你的建议' : '联盟交易') + '</em></div>';
  }

  window.showDraftPickTradeScreen = function() {
    var draft = ensureOffseasonDraftState();
    if (draft.phase !== 'pick_trades') {
      beginOffseason();
      return;
    }
    showScreen('screen-draft-trades');
    var target = document.getElementById('draft-trades-content');
    if (!target) return;
    var tradeState = draft.pickTrades;
    var myPicks = draft.draftOrder.filter(function(entry) { return entry.ownerTeam === STATE.careerTeam; });
    var pickText = myPicks.length ? myPicks.map(function(entry) { return '首轮第 ' + entry.pick + ' 顺位'; }).join('、') : '当前没有首轮签';
    var choices = ['hold', 'move_up', 'move_down'].map(function(strategy) {
      var descriptions = {
        hold: '不主动报价，锁定当前签位',
        move_up: '用较低签位和球员报价更高签位',
        move_down: '退后选秀并争取获得一名轮换球员'
      };
      return '<button type="button" class="draft-strategy-card' + (tradeState.strategy === strategy ? ' is-selected' : '') + '" onclick="setDraftPickTradeStrategy(\'' + strategy + '\')" ' + (tradeState.submitted ? 'disabled' : '') + '>' +
        '<strong>' + strategyLabel(strategy) + '</strong><span>' + descriptions[strategy] + '</span></button>';
    }).join('');
    var transactions = tradeState.transactions.map(renderPickTradeTransaction).join('');
    target.innerHTML = '<main class="draft-shell">' +
      '<header class="draft-page-head"><div><span class="draft-kicker">PICK TRADE WINDOW</span><h1>选秀签交易</h1></div><span class="draft-year">仅限当年首轮</span></header>' +
      '<section class="draft-trade-summary"><span>你的球队当前资产</span><strong>' + pickText + '</strong><small>签位归属一旦交易，将直接决定选秀大会由哪支球队选择。</small></section>' +
      '<section class="draft-strategy-panel"><div class="draft-section-head"><h2>向管理层提出建议</h2><span>最终决定由球队做出</span></div>' + choices + '</section>' +
      (tradeState.result ? '<p class="draft-trade-result" aria-live="polite">' + tradeState.result + '</p>' : '') +
      '<section class="draft-trade-log"><div class="draft-section-head"><h2>本窗口成交</h2><span>' + tradeState.transactions.length + ' 笔</span></div>' +
        (transactions || '<p class="draft-empty">提交建议后，联盟球队将同步完成选秀签交易。</p>') + '</section>' +
      '<div class="draft-actions">' + (tradeState.submitted
        ? '<button type="button" class="draft-action-primary" onclick="completeDraftPickTradeWindow()">关闭窗口，继续休赛期</button>'
        : '<button type="button" class="draft-action-primary" onclick="submitDraftPickTradeAdvice()">提交给管理层</button>') + '</div>' +
      '</main>';
  };

  window.completeDraftPickTradeWindow = function() {
    var draft = ensureOffseasonDraftState();
    if (draft.phase !== 'pick_trades' || !draft.pickTrades.submitted) return;
    draft.phase = 'offseason';
    persistDraftProgress();
    beginOffseason();
  };

  function getProspectProfileLabel(player) {
    if (typeof getRookieProfile !== 'function') return '综合型球员';
    var profile = getRookieProfile(player);
    return profile && profile.label ? profile.label : '综合型球员';
  }

  function getProspectStrengths(player) {
    var keys = ['threePT','MID','FIN','DNK','HAN','PAS','PDEF','STL','IDEF','BLK','REB','ATH','STR','CLU'];
    return keys.sort(function(a, b) { return (Number(player[b]) || 0) - (Number(player[a]) || 0); })
      .slice(0, 2)
      .map(function(key) { return typeof attrCN === 'function' ? attrCN(key) : key; })
      .join(' / ');
  }

  function prepareDraftProspects(draft) {
    if (draft.prospects && draft.prospects.length >= 30) return;
    var prospects = [];
    for (var i = 0; i < 30; i++) {
      var player = generateRookie();
      if (player._fixedProspectRating) {
        normalizeRookieAttributesToOvr(player, player.ovr);
      } else {
        applyRookieAttributeProfile(player, player.ovr, rngNext);
      }
      player._draftTie = seededValue(draft.seed, 'board|' + player.id);
      prospects.push(player);
    }
    prospects.sort(function(a, b) {
      return (Number(b.ovr) || 0) - (Number(a.ovr) || 0) || a._draftTie - b._draftTie;
    });
    prospects.forEach(function(player, index) {
      player._draftBoardRank = index + 1;
      player._draftProjection = index < 5 ? '前 5' : index < 14 ? '乐透' : index < 22 ? '首轮中段' : '首轮末段';
      player._draftProfileLabel = getProspectProfileLabel(player);
      player._draftStrengths = getProspectStrengths(player);
    });
    draft.prospects = prospects;
  }

  function availableProspects(draft) {
    var selected = {};
    draft.picks.forEach(function(pick) { selected[pick.playerId] = true; });
    return draft.prospects.filter(function(player) { return !selected[player.id]; });
  }

  function getTeamPositionNeed(team, position) {
    var roster = LEAGUE_PLAYER_DATA[team] || [];
    var count = 0;
    var best = 0;
    roster.forEach(function(player) {
      if (canPlayPosition(player.pos || '', position)) {
        count++;
        best = Math.max(best, Number(player.ovr) || 0);
      }
    });
    if (count === 0) return 28;
    if (count === 1) return 18;
    if (best < 75) return 12;
    if (best < 82) return 6;
    return 0;
  }

  function getTeamDraftNeeds(team) {
    return ['PG','SG','SF','PF','C'].map(function(pos) {
      return { pos: pos, score: getTeamPositionNeed(team, pos) };
    }).sort(function(a, b) { return b.score - a.score; }).slice(0, 2).map(function(item) { return item.pos; });
  }

  function rankProspectsForTeam(draft, team, pickNumber) {
    var available = availableProspects(draft);
    var boardWindow = pickNumber <= 10 ? 5 : (pickNumber <= 20 ? 8 : 12);
    available.sort(function(a, b) { return a._draftBoardRank - b._draftBoardRank; });
    return available.slice(0, Math.min(boardWindow, available.length)).map(function(player) {
      var primaryPos = String(player.pos || 'SF').split('/')[0];
      var score = (Number(player.ovr) || 0) * 10;
      score += getTeamPositionNeed(team, primaryPos);
      score += seededValue(draft.seed, 'fit|' + pickNumber + '|' + team + '|' + player.id) * 8;
      return { player: player, score: score };
    }).sort(function(a, b) { return b.score - a.score; });
  }

  function getSuggestionDecision(draft, team, pickNumber, ranked) {
    var suggestionId = draft.pendingSuggestionId;
    if (!suggestionId || team !== STATE.careerTeam) return null;
    var suggested = availableProspects(draft).filter(function(player) { return player.id === suggestionId; })[0];
    if (!suggested) return null;
    var profile = typeof getCareerProfile === 'function' ? getCareerProfile() : {};
    var rankIndex = -1;
    ranked.some(function(item, index) {
      if (item.player.id === suggestionId) { rankIndex = index; return true; }
      return false;
    });
    var chance = 72 + (Number(profile.coachTrust) || 0) * 2 + (Number(profile.leadership) || 0) * 1.5;
    chance += rankIndex >= 0 ? Math.max(0, 10 - rankIndex * 3) : -24;
    chance = Math.max(45, Math.min(92, Math.round(chance)));
    var accepted = seededValue(draft.seed, 'advice|' + pickNumber + '|' + suggestionId) * 100 < chance;
    return { player: suggested, accepted: accepted, chance: chance };
  }

  function chooseProspect(draft, order) {
    var ranked = rankProspectsForTeam(draft, order.ownerTeam, order.pick);
    var advice = getSuggestionDecision(draft, order.ownerTeam, order.pick, ranked);
    if (advice && advice.accepted) return { player: advice.player, advice: advice };
    var chosen = ranked.length ? ranked[0].player : availableProspects(draft)[0];
    if (advice && chosen && chosen.id === advice.player.id && ranked.length > 1) chosen = ranked[1].player;
    return { player: chosen, advice: advice };
  }

  function moveCutPlayerToFreeAgency(team, rookie) {
    var roster = LEAGUE_PLAYER_DATA[team] || [];
    var cuts = [];
    while (roster.length > DRAFT_ROSTER_LIMIT) {
      var candidates = roster.filter(function(player) {
        return player !== rookie && !player._isUser && !player._justSigned;
      });
      if (!candidates.length) candidates = roster.filter(function(player) { return player !== rookie && !player._isUser; });
      candidates.sort(function(a, b) { return (Number(a.ovr) || 0) - (Number(b.ovr) || 0); });
      var cut = candidates[0];
      if (!cut) break;
      var index = roster.indexOf(cut);
      if (index >= 0) roster.splice(index, 1);
      cut._origTeam = team;
      STATE._freeAgentPool = STATE._freeAgentPool || [];
      STATE._freeAgentPool.push(cut);
      STATE._leagueChanges.freeAgents = STATE._leagueChanges.freeAgents || [];
      STATE._leagueChanges.freeAgents.push({ name: cut.cname, playerId: cut.id, ovr: cut.ovr, team: team, age: getLeaguePlayerAge(cut), reason: 'draft_cut' });
      cuts.push(cut);
    }
    return cuts;
  }

  function addDraftedPlayerToRoster(draft, order, player) {
    var team = order.ownerTeam;
    var roster = LEAGUE_PLAYER_DATA[team] || (LEAGUE_PLAYER_DATA[team] = []);
    player._justSigned = true;
    player._rookieSeason = getCurrentLeagueSeasonNumber();
    player.contract = order.pick <= 14 ? 4 : 3;
    player.loyalty = getRookieContractLoyalty(player.contract);
    player.type = '新秀';
    roster.push(player);
    STATE._leagueChanges = STATE._leagueChanges || { retired: [], rookies: [], teamChanges: {}, trades: [] };
    STATE._leagueChanges.rookies = STATE._leagueChanges.rookies || [];
    STATE._leagueChanges.teamChanges = STATE._leagueChanges.teamChanges || {};
    STATE._leagueChanges.teamChanges[team] = STATE._leagueChanges.teamChanges[team] || { retired: [], rookies: [] };
    var cuts = moveCutPlayerToFreeAgency(team, player);
    STATE._leagueChanges.rookies.push({ name: player.cname, playerId: player.id, team: team, pick: order.pick });
    STATE._leagueChanges.teamChanges[team].rookies.push(player.cname);
    clearLineupCache();
    return cuts;
  }

  function saveDraftHistory(draft) {
    if (draft.historySaved || !STATE.career) return;
    STATE.career.draftHistory = STATE.career.draftHistory || [];
    var exists = STATE.career.draftHistory.some(function(item) { return item.seasonNum === draft.seasonNum; });
    if (!exists) {
      STATE.career.draftHistory.push({
        seasonNum: draft.seasonNum,
        yearLabel: draft.yearLabel,
        pickTrades: draft.pickTrades.transactions.slice(),
        picks: draft.picks.map(function(pick) {
          return {
            pick: pick.pick, team: pick.team, playerId: pick.playerId,
            name: pick.name, pos: pick.pos, ovr: pick.ovr,
            suggestion: pick.suggestion || null
          };
        })
      });
    }
    draft.historySaved = true;
  }

  window.beginOffseasonDraft = function() {
    var draft = ensureOffseasonDraftState();
    if (draft.phase === 'lottery') {
      // 兼容已处于训练营的旧存档：名单演进已经开始时不回退并重复训练。
      draft.lottery.revealedCount = 14;
      draft.phase = 'offseason';
    }
    if (draft.phase === 'offseason') {
      prepareDraftProspects(draft);
      draft.phase = 'draft';
      draft.currentPick = draft.picks.length;
      persistDraftProgress();
    }
    showOffseasonDraftScreen();
  };

  window.suggestDraftProspect = function(playerId) {
    var draft = ensureOffseasonDraftState();
    if (draft.phase !== 'draft') return;
    var order = draft.draftOrder[draft.currentPick];
    if (!order || order.ownerTeam !== STATE.careerTeam) return;
    var valid = availableProspects(draft).some(function(player) { return player.id === playerId; });
    if (!valid) return;
    draft.pendingSuggestionId = draft.pendingSuggestionId === playerId ? '' : playerId;
    showOffseasonDraftScreen();
  };

  function executeNextDraftPick(draft) {
    if (draft.phase !== 'draft' || draft.currentPick >= draft.draftOrder.length) return;
    var order = draft.draftOrder[draft.currentPick];
    var decision = chooseProspect(draft, order);
    if (!decision.player) return;
    var cuts = addDraftedPlayerToRoster(draft, order, decision.player);
    var suggestion = null;
    if (decision.advice) {
      suggestion = {
        playerId: decision.advice.player.id,
        playerName: decision.advice.player.cname,
        accepted: decision.advice.accepted,
        chance: decision.advice.chance
      };
    }
    draft.picks.push({
      pick: order.pick,
      team: order.ownerTeam,
      playerId: decision.player.id,
      name: decision.player.cname,
      pos: decision.player.pos,
      ovr: decision.player.ovr,
      profile: decision.player._draftProfileLabel,
      cutPlayer: cuts.length ? cuts.map(function(player) { return player.cname; }).join('、') : '',
      suggestion: suggestion
    });
    draft.pendingSuggestionId = '';
    draft.currentPick = draft.picks.length;
    if (draft.currentPick >= draft.draftOrder.length) {
      draft.completed = true;
      draft.phase = 'complete';
      saveDraftHistory(draft);
    }
    return true;
  }

  window.makeNextDraftPick = function() {
    var draft = ensureOffseasonDraftState();
    if (!executeNextDraftPick(draft)) return;
    showOffseasonDraftScreen();
    persistDraftProgress();
  };

  window.simulateDraftToMyTeam = function() {
    var draft = ensureOffseasonDraftState();
    if (draft.phase !== 'draft') return;
    while (draft.currentPick < draft.draftOrder.length) {
      var order = draft.draftOrder[draft.currentPick];
      if (order.ownerTeam === STATE.careerTeam) break;
      if (!executeNextDraftPick(draft)) break;
    }
    showOffseasonDraftScreen();
    persistDraftProgress();
  };

  window.finishAllDraftPicks = function() {
    var draft = ensureOffseasonDraftState();
    if (draft.phase !== 'draft') return;
    while (draft.phase === 'draft' && draft.currentPick < draft.draftOrder.length) {
      if (!executeNextDraftPick(draft)) break;
    }
    showOffseasonDraftScreen();
    persistDraftProgress();
  };

  function prospectRow(player, canSuggest, suggested) {
    return '<div class="draft-prospect-row' + (suggested ? ' is-suggested' : '') + '">' +
      '<span class="draft-board-rank">' + player._draftBoardRank + '</span>' +
      '<div class="draft-prospect-main"><strong>' + player.cname + '</strong><span>' + player.pos + ' · ' + (player.height || '身高未知') + ' · ' + player._draftProfileLabel + '</span><small>优势：' + player._draftStrengths + '</small></div>' +
      '<div class="draft-prospect-side"><span>' + player._draftProjection + '</span>' +
        (canSuggest ? '<button type="button" onclick="suggestDraftProspect(\'' + player.id + '\')">' + (suggested ? '已建议' : '建议选择') + '</button>' : '') +
      '</div></div>';
  }

  function draftPickRow(pick) {
    var advice = '';
    if (pick.suggestion) {
      advice = '<small class="draft-advice-result ' + (pick.suggestion.accepted ? 'is-accepted' : 'is-declined') + '">' +
        (pick.suggestion.accepted ? '管理层采纳了你的建议' : '管理层未采纳你的建议') + '</small>';
    }
    return '<div class="draft-result-row' + (pick.team === STATE.careerTeam ? ' is-mine' : '') + '">' +
      '<span class="draft-pick-no">' + pick.pick + '</span><span class="draft-team-logo">' + getTeamLogo(pick.team, 26) + '</span>' +
      '<div><strong>' + pick.name + '</strong><span>' + getTeamName(pick.team) + ' · ' + pick.pos + ' · OVR ' + pick.ovr + '</span>' + advice + '</div></div>';
  }

  function renderCompletedDraft(draft) {
    var myPick = draft.picks.filter(function(pick) { return pick.team === STATE.careerTeam; })[0];
    var adviceText = '';
    if (myPick && myPick.suggestion) {
      adviceText = myPick.suggestion.accepted
        ? '管理层采纳建议，选择了 ' + myPick.name
        : '管理层未采纳建议，最终选择了 ' + myPick.name;
    }
    return '<main class="draft-shell draft-complete">' +
      '<header class="draft-page-head"><div><span class="draft-kicker">DRAFT COMPLETE</span><h1>选秀完成</h1></div><span class="draft-year">' + draft.yearLabel + '</span></header>' +
      '<section class="draft-my-result"><span>你的球队</span><div>' + getTeamLogo(STATE.careerTeam, 42) + '<div><strong>' + (myPick ? myPick.name : '未获得首轮签') + '</strong><small>' +
        (myPick ? '第 ' + myPick.pick + ' 顺位 · ' + myPick.pos + ' · OVR ' + myPick.ovr : '本届没有选择') + '</small></div></div>' +
        (adviceText ? '<p>' + adviceText + '</p>' : '') + '</section>' +
      '<section class="draft-results-list"><h2>首轮结果</h2>' + draft.picks.map(draftPickRow).join('') + '</section>' +
      '<div class="draft-actions"><button type="button" class="draft-action-primary" onclick="advanceAfterOffseasonDraft(this)">进入自由市场</button></div>' +
      '</main>';
  }

  window.showOffseasonDraftScreen = function() {
    var draft = ensureOffseasonDraftState();
    if (draft.phase === 'offseason') prepareDraftProspects(draft);
    showScreen('screen-draft');
    var target = document.getElementById('draft-content');
    if (!target) return;
    if (draft.phase === 'complete') {
      target.innerHTML = renderCompletedDraft(draft);
      return;
    }
    if (draft.phase !== 'draft') return;
    var order = draft.draftOrder[draft.currentPick];
    var team = order && order.ownerTeam;
    var isMine = team === STATE.careerTeam;
    var available = availableProspects(draft).sort(function(a, b) { return a._draftBoardRank - b._draftBoardRank; });
    var shown = available.slice(0, 12);
    var needs = team ? getTeamDraftNeeds(team) : [];
    var recent = draft.picks.slice(-8).reverse();
    var nextMyPick = draft.draftOrder.slice(draft.currentPick).filter(function(item) { return item.ownerTeam === STATE.careerTeam; })[0];
    target.innerHTML = '<main class="draft-shell">' +
      '<header class="draft-page-head"><div><span class="draft-kicker">ON THE CLOCK</span><h1>选秀大会</h1></div><span class="draft-year">' + draft.yearLabel + '</span></header>' +
      '<section class="draft-clock' + (isMine ? ' is-mine' : '') + '"><span class="draft-clock-pick">第 ' + order.pick + ' 顺位</span>' +
        '<div>' + getTeamLogo(team, 40) + '<div><strong>' + getTeamName(team) + '</strong><small>阵容需求：' + needs.join(' / ') + '</small></div></div>' +
        (isMine ? '<p>你可以向管理层建议一名球员。建议会被认真考虑，但最终决定仍由球队做出。</p>' : '') + '</section>' +
      '<section class="draft-prospects"><div class="draft-section-head"><h2>待选新秀</h2><span>真实 OVR 将在选中后揭晓</span></div>' +
        shown.map(function(player) { return prospectRow(player, isMine, draft.pendingSuggestionId === player.id); }).join('') + '</section>' +
      '<section class="draft-results-list"><h2>最近选择</h2>' + (recent.length ? recent.map(draftPickRow).join('') : '<p class="draft-empty">选秀尚未开始</p>') + '</section>' +
      '<div class="draft-actions"><button type="button" class="draft-action-primary" onclick="makeNextDraftPick()">公布下一签</button>' +
        (!isMine && nextMyPick ? '<button type="button" class="draft-action-secondary" onclick="simulateDraftToMyTeam()">模拟到我的球队</button>' : '') +
        '<button type="button" class="draft-action-secondary" onclick="finishAllDraftPicks()">完成全部选秀</button></div>' +
      '</main>';
  };

  window.advanceAfterOffseasonDraft = function(button) {
    var draft = ensureOffseasonDraftState();
    if (draft.phase !== 'complete' || draftPipelineRunning) return;
    draftPipelineRunning = true;
    if (button) {
      button.disabled = true;
      button.textContent = '正在进入自由市场…';
    }
    function handlePipelineError(error) {
      console.error('[Draft] 进入自由市场失败:', error);
      if (button) {
        var stageLabels = {
          free_agents: '自由球员分配',
          trades: '联盟交易',
          roster_fill: '补齐球队名单',
          player_mobility: '玩家流动',
          new_season: '新赛季初始化'
        };
        var stage = stageLabels[window._offseasonPipelineStage] || '休赛期流程';
        var reason = error && error.message ? String(error.message) : String(error || '未知错误');
        button.disabled = false;
        button.textContent = stage + '失败：' + reason;
        button.title = error && error.stack ? error.stack : reason;
      }
      draftPipelineRunning = false;
    }

    var pipeline;
    try {
      saveDraftHistory(draft);
      pipeline = continueCareerAfterLeagueDraft();
    } catch (error) {
      handlePipelineError(error);
      return;
    }

    Promise.resolve(pipeline).then(function() {
      draftPipelineRunning = false;
    }, handlePipelineError);
  };

  window.fillLeagueRostersAfterDraft = function() {
    if (typeof LEAGUE_TEAM_IDS === 'undefined' || typeof LEAGUE_PLAYER_DATA === 'undefined') return;
    STATE._leagueChanges = STATE._leagueChanges || { retired: [], rookies: [], teamChanges: {}, trades: [] };
    STATE._leagueChanges.rookies = STATE._leagueChanges.rookies || [];
    STATE._leagueChanges.teamChanges = STATE._leagueChanges.teamChanges || {};
    LEAGUE_TEAM_IDS.forEach(function(team) {
      var roster = LEAGUE_PLAYER_DATA[team] || (LEAGUE_PLAYER_DATA[team] = []);
      STATE._leagueChanges.teamChanges[team] = STATE._leagueChanges.teamChanges[team] || { retired: [], rookies: [] };
      while (roster.length < DRAFT_ROSTER_LIMIT) {
        if (typeof getLeagueRosterNpcLimit === 'function' && roster.length >= getLeagueRosterNpcLimit(team)) break;
        var player = generateRookie();
        if (player._fixedProspectRating) {
          normalizeRookieAttributesToOvr(player, player.ovr);
        } else {
          var targetOvr = 60 + Math.floor(rngNext() * 8);
          player.ovr = targetOvr;
          applyRookieAttributeProfile(player, targetOvr, rngNext);
        }
        player._justSigned = true;
        player._rookieSeason = getCurrentLeagueSeasonNumber();
        player.contract = 1 + Math.floor(rngNext() * 2);
        player.loyalty = getRookieContractLoyalty(player.contract);
        roster.push(player);
        STATE._leagueChanges.rookies.push({ name: player.cname, playerId: player.id, team: team, undrafted: true });
        STATE._leagueChanges.teamChanges[team].rookies.push(player.cname);
      }
    });
    if (typeof enforceLeagueRosterCapacity === 'function') enforceLeagueRosterCapacity(null, { reason: 'draft_roster_fill_capacity' });
    clearLineupCache();
  };
})();
