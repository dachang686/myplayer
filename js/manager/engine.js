(function installManagerEngine(global) {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
    var defense = (Number(player && player.PDEF) || 60) * 0.38
      + (Number(player && player.STL) || 60) * 0.22
      + (Number(player && player.IDEF) || 60) * 0.40;
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

  var MAX_TRADE_PLAYERS = 3;
  var MIN_ROSTER_SIZE = 10;
  var MAX_ROSTER_SIZE = 25;

  function playerTradeValue(player) {
    var overall = Number(player && player.ovr) || 0;
    var skills = ['threePT', 'FIN', 'PAS', 'PDEF', 'STL', 'IDEF', 'REB'].reduce(function(sum, key) {
      return sum + (Number(player && player[key]) || 0);
    }, 0) / 7;
    var coreValue = Math.pow(Math.max(0, overall - 55), 1.35) * 1.2;
    return Math.round((coreValue + skills * 0.12) * 10) / 10;
  }

  function packageTradeValue(players) {
    return Math.round((players || []).reduce(function(sum, player) {
      return sum + playerTradeValue(player);
    }, 0) * 10) / 10;
  }

  function playerPackages(players, maxPlayers) {
    var packages = [];
    function visit(start, selected) {
      if (selected.length) packages.push(selected.slice());
      if (selected.length >= maxPlayers) return;
      for (var index = start; index < players.length; index++) {
        selected.push(players[index]);
        visit(index + 1, selected);
        selected.pop();
      }
    }
    visit(0, []);
    return packages;
  }

  function normalizeTradePackage(playerIds, sideLabel) {
    var ids = typeof playerIds === 'string' ? [playerIds] : playerIds;
    if (!Array.isArray(ids) || !ids.length) {
      return { valid: false, reason: '请至少选择 1 名' + sideLabel + '球员。' };
    }
    if (ids.length > MAX_TRADE_PLAYERS) {
      return { valid: false, reason: sideLabel + '球员最多选择 ' + MAX_TRADE_PLAYERS + ' 名。' };
    }
    var unique = {};
    for (var index = 0; index < ids.length; index++) {
      var playerId = ids[index];
      if (typeof playerId !== 'string' || !playerId || unique[playerId]) {
        return { valid: false, reason: sideLabel + '球员选择无效或重复。' };
      }
      unique[playerId] = true;
    }
    return { valid: true, ids: ids.slice() };
  }

  function playerPositions(player) {
    return global.ManagerState.eligiblePositions(player);
  }

  function sharesPosition(first, second) {
    var firstPositions = playerPositions(first);
    var secondPositions = playerPositions(second);
    return firstPositions.some(function(position) { return secondPositions.indexOf(position) >= 0; });
  }

  function positionNeed(roster, player) {
    var options = roster.filter(function(candidate) { return sharesPosition(candidate, player); }).sort(function(a, b) {
      return (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
    });
    var quality = options.slice(0, 3).reduce(function(sum, candidate) { return sum + (Number(candidate.ovr) || 0); }, 0) / Math.max(1, Math.min(3, options.length));
    var depthNeed = Math.max(0, 3 - options.length) * 2;
    return Math.round((Math.max(0, 78 - quality) * 0.18 + depthNeed) * 10) / 10;
  }

  function findPlayerLocation(state, playerId) {
    var teams = Object.keys(state.leagueData || {});
    for (var teamIndex = 0; teamIndex < teams.length; teamIndex++) {
      var teamId = teams[teamIndex];
      var roster = state.leagueData[teamId] || [];
      for (var playerIndex = 0; playerIndex < roster.length; playerIndex++) {
        if (roster[playerIndex] && roster[playerIndex].id === playerId) {
          return { teamId: teamId, playerIndex: playerIndex, player: roster[playerIndex] };
        }
      }
    }
    return null;
  }

  function tradeSnapshot(player) {
    return {
      id: player.id,
      name: player.cname || player.name || player.id,
      pos: player.pos || '',
      ovr: Number(player.ovr) || 0
    };
  }

  function evaluateTrade(state, outgoingIds, incomingIds) {
    if (!state || !state.leagueData || !state.selectedTeam) {
      return { valid: false, accepted: false, reason: '经理状态无效，无法评估交易。' };
    }
    if (!state.season || state.season.phase !== 'regular') {
      return { valid: false, accepted: false, reason: '交易窗口已关闭，只能在常规赛期间交易。' };
    }
    var outgoingPackage = normalizeTradePackage(outgoingIds, '送出');
    var incomingPackage = normalizeTradePackage(incomingIds, '得到');
    if (!outgoingPackage.valid) return { valid: false, accepted: false, reason: outgoingPackage.reason };
    if (!incomingPackage.valid) return { valid: false, accepted: false, reason: incomingPackage.reason };
    var outgoing = outgoingPackage.ids.map(function(playerId) { return findPlayerLocation(state, playerId); });
    var incoming = incomingPackage.ids.map(function(playerId) { return findPlayerLocation(state, playerId); });
    if (outgoing.some(function(location) { return !location; }) || incoming.some(function(location) { return !location; })) {
      return { valid: false, accepted: false, reason: '交易球员不存在。' };
    }
    if (outgoing.some(function(location) { return location.teamId !== state.selectedTeam; })) {
      return { valid: false, accepted: false, reason: '只能送出本队球员。' };
    }
    var partnerTeam = incoming[0].teamId;
    if (partnerTeam === state.selectedTeam || incoming.some(function(location) { return location.teamId !== partnerTeam; })) {
      return { valid: false, accepted: false, reason: '得到的球员必须全部来自同一支其他球队。' };
    }
    var userRoster = state.leagueData[state.selectedTeam] || [];
    var partnerRoster = state.leagueData[partnerTeam] || [];
    var userRosterSize = userRoster.length - outgoing.length + incoming.length;
    var partnerRosterSize = partnerRoster.length - incoming.length + outgoing.length;
    if (userRosterSize < MIN_ROSTER_SIZE || userRosterSize > MAX_ROSTER_SIZE || partnerRosterSize < MIN_ROSTER_SIZE || partnerRosterSize > MAX_ROSTER_SIZE) {
      return { valid: false, accepted: false, reason: '这笔交易会让球队名单超出 ' + MIN_ROSTER_SIZE + ' 至 ' + MAX_ROSTER_SIZE + ' 人范围。' };
    }

    var incomingIdsByKey = {};
    incoming.forEach(function(location) { incomingIdsByKey[location.player.id] = true; });
    var partnerRosterAfterSending = partnerRoster.filter(function(player) { return !incomingIdsByKey[player.id]; });
    var sentPlayers = outgoing.map(function(location) { return location.player; });
    var receivedPlayers = incoming.map(function(location) { return location.player; });
    var sentValue = packageTradeValue(sentPlayers);
    var receivedValue = packageTradeValue(receivedPlayers);
    var partnerNeedForIncoming = sentPlayers.reduce(function(sum, player) { return sum + positionNeed(partnerRosterAfterSending, player); }, 0);
    var partnerNeedForOutgoing = receivedPlayers.reduce(function(sum, player) { return sum + positionNeed(partnerRosterAfterSending, player); }, 0);
    var rosterPressure = Math.max(0, outgoing.length - incoming.length) * 1.25;
    var acceptedMargin = Math.round((sentValue - receivedValue + (partnerNeedForIncoming - partnerNeedForOutgoing) * 1.5 - rosterPressure) * 10) / 10;
    var accepted = acceptedMargin >= -1;
    return {
      valid: true,
      accepted: accepted,
      reason: accepted ? '对方接受这笔 ' + outgoing.length + ' 换 ' + incoming.length + ' 报价。' : '对方认为回报不足，暂不接受这笔报价。',
      outgoing: outgoing,
      incoming: incoming,
      partnerTeam: partnerTeam,
      outgoingValue: sentValue,
      incomingValue: receivedValue,
      acceptedMargin: acceptedMargin,
      partnerNeedForIncoming: partnerNeedForIncoming,
      partnerNeedForOutgoing: partnerNeedForOutgoing,
      rosterPressure: rosterPressure
    };
  }

  function tradeTargets(state, outgoingIds, partnerTeamId) {
    var roster = state && state.leagueData && state.leagueData[partnerTeamId];
    if (!Array.isArray(roster) || partnerTeamId === state.selectedTeam) return [];
    return roster.map(function(player) {
      return evaluateTrade(state, outgoingIds, [player.id]);
    }).filter(function(proposal) { return proposal.valid; }).sort(function(first, second) {
      return Number(second.accepted) - Number(first.accepted) || second.acceptedMargin - first.acceptedMargin || first.incomingValue - second.incomingValue || String(first.incoming[0].player.id).localeCompare(String(second.incoming[0].player.id));
    });
  }

  function inquiryCandidatePool(roster, targetValue) {
    return roster.slice().sort(function(first, second) {
      var firstValue = playerTradeValue(first);
      var secondValue = playerTradeValue(second);
      var firstFit = Math.min(Math.abs(firstValue - targetValue), Math.abs(firstValue * 2 - targetValue), Math.abs(firstValue * 3 - targetValue));
      var secondFit = Math.min(Math.abs(secondValue - targetValue), Math.abs(secondValue * 2 - targetValue), Math.abs(secondValue * 3 - targetValue));
      return firstFit - secondFit || firstValue - secondValue || String(first.id).localeCompare(String(second.id));
    }).slice(0, 8);
  }

  function inquiryOfferScore(proposal) {
    var needDifference = Number(proposal.partnerNeedForIncoming) - Number(proposal.partnerNeedForOutgoing);
    return Math.abs(proposal.acceptedMargin) - needDifference * 0.35;
  }

  function inquireTrade(state, outgoingIds) {
    if (!state || !state.leagueData || !state.selectedTeam) {
      return { valid: false, reason: '经理状态无效，无法发起问价。', offers: [] };
    }
    if (!state.season || state.season.phase !== 'regular') {
      return { valid: false, reason: '交易窗口已关闭，只能在常规赛期间问价。', offers: [] };
    }
    var outgoingPackage = normalizeTradePackage(outgoingIds, '送出');
    if (!outgoingPackage.valid) return { valid: false, reason: outgoingPackage.reason, offers: [] };
    var outgoing = outgoingPackage.ids.map(function(playerId) { return findPlayerLocation(state, playerId); });
    if (outgoing.some(function(location) { return !location; })) {
      return { valid: false, reason: '询价球员不存在。', offers: [] };
    }
    if (outgoing.some(function(location) { return location.teamId !== state.selectedTeam; })) {
      return { valid: false, reason: '只能为本队球员发起问价。', offers: [] };
    }

    var outgoingPlayers = outgoing.map(function(location) { return location.player; });
    var targetValue = packageTradeValue(outgoingPlayers);
    var offers = Object.keys(state.leagueData).filter(function(teamId) {
      return teamId !== state.selectedTeam && Array.isArray(state.leagueData[teamId]);
    }).map(function(partnerTeam) {
      var candidates = inquiryCandidatePool(state.leagueData[partnerTeam], targetValue);
      var proposals = playerPackages(candidates, MAX_TRADE_PLAYERS).map(function(players) {
        return evaluateTrade(state, outgoingPackage.ids, players.map(function(player) { return player.id; }));
      }).filter(function(proposal) {
        if (!proposal.valid || !proposal.accepted || proposal.partnerTeam !== partnerTeam) return false;
        return proposal.partnerNeedForIncoming >= proposal.partnerNeedForOutgoing || proposal.acceptedMargin >= 1;
      }).sort(function(first, second) {
        return inquiryOfferScore(first) - inquiryOfferScore(second) || second.acceptedMargin - first.acceptedMargin || first.incomingValue - second.incomingValue;
      });
      if (!proposals.length) return null;
      var offer = proposals[0];
      offer.interestScore = Math.round((offer.partnerNeedForIncoming - offer.partnerNeedForOutgoing + Math.max(0, offer.acceptedMargin) * 0.2) * 10) / 10;
      return offer;
    }).filter(function(offer) { return !!offer; }).sort(function(first, second) {
      return second.interestScore - first.interestScore || inquiryOfferScore(first) - inquiryOfferScore(second) || String(first.partnerTeam).localeCompare(String(second.partnerTeam));
    });

    return {
      valid: true,
      reason: offers.length ? offers.length + ' 支球队对这组资产感兴趣。' : '暂时没有球队愿意为这组资产报价。',
      outgoing: outgoing,
      outgoingValue: targetValue,
      offers: offers
    };
  }

  function restoreRotationAfterTrade(state, outgoingPlayers, incomingPlayers) {
    var previous = state.rotation || {};
    var next = {};
    var outgoingByRole = outgoingPlayers.slice().sort(function(first, second) {
      var firstRole = previous[first.id] || {};
      var secondRole = previous[second.id] || {};
      return Number(secondRole.starter) - Number(firstRole.starter) || (Number(secondRole.minutes) || 0) - (Number(firstRole.minutes) || 0) || (Number(second.ovr) || 0) - (Number(first.ovr) || 0);
    });
    var incomingAssignments = {};
    incomingPlayers.slice().sort(function(first, second) { return (Number(second.ovr) || 0) - (Number(first.ovr) || 0); }).forEach(function(player, index) {
      var source = outgoingByRole[Math.min(index, outgoingByRole.length - 1)];
      incomingAssignments[player.id] = source ? previous[source.id] : null;
    });
    (state.leagueData[state.selectedTeam] || []).forEach(function(player) {
      var prior = incomingAssignments[player.id] || previous[player.id];
      next[player.id] = prior ? { starter: !!prior.starter, minutes: Number(prior.minutes) || 0 } : { starter: false, minutes: 0 };
    });
    var validation = global.ManagerState.validateRotation(state.leagueData[state.selectedTeam] || [], next);
    if (validation.valid) {
      state.rotation = next;
      return false;
    }
    state.rotation = global.ManagerState.createDefaultRotation(state.leagueData[state.selectedTeam] || []);
    return true;
  }

  function executeTrade(state, outgoingIds, incomingIds) {
    var proposal = evaluateTrade(state, outgoingIds, incomingIds);
    if (!proposal.valid) throw new Error(proposal.reason);
    if (!proposal.accepted) throw new Error(proposal.reason);

    var userRoster = state.leagueData[state.selectedTeam];
    var partnerRoster = state.leagueData[proposal.partnerTeam];
    var outgoingIdsByKey = {};
    var incomingIdsByKey = {};
    proposal.outgoing.forEach(function(location) { outgoingIdsByKey[location.player.id] = true; });
    proposal.incoming.forEach(function(location) { incomingIdsByKey[location.player.id] = true; });
    state.leagueData[state.selectedTeam] = userRoster.filter(function(player) { return !outgoingIdsByKey[player.id]; }).concat(proposal.incoming.map(function(location) { return location.player; }));
    state.leagueData[proposal.partnerTeam] = partnerRoster.filter(function(player) { return !incomingIdsByKey[player.id]; }).concat(proposal.outgoing.map(function(location) { return location.player; }));
    var rotationReset = restoreRotationAfterTrade(state, proposal.outgoing.map(function(location) { return location.player; }), proposal.incoming.map(function(location) { return location.player; }));
    state.tradeHistory = Array.isArray(state.tradeHistory) ? state.tradeHistory : [];
    var tradeId = 'T' + (state.tradeHistory.length + 1) + '-' + (Number(state.season.scheduleIndex) || 0);
    while (state.tradeHistory.some(function(trade) { return trade.id === tradeId; })) tradeId += '-R';
    var trade = {
      id: tradeId,
      userTeam: state.selectedTeam,
      partnerTeam: proposal.partnerTeam,
      sent: proposal.outgoing.map(function(location) { return tradeSnapshot(location.player); }),
      received: proposal.incoming.map(function(location) { return tradeSnapshot(location.player); }),
      acceptedMargin: proposal.acceptedMargin,
      scheduleIndex: Math.max(0, Math.floor(Number(state.season.scheduleIndex) || 0)),
      rotationReset: rotationReset,
      createdAt: new Date().toISOString()
    };
    state.tradeHistory.push(trade);
    state.updatedAt = new Date().toISOString();
    return { trade: trade, proposal: proposal };
  }

  function compareStandings(state, a, b) {
      var recordA = state.season.standings[a] || {};
      var recordB = state.season.standings[b] || {};
      var winsA = Number(recordA.wins) || 0;
      var winsB = Number(recordB.wins) || 0;
      var gamesA = winsA + (Number(recordA.losses) || 0);
      var gamesB = winsB + (Number(recordB.losses) || 0);
      var percentageDiff = (gamesB ? winsB / gamesB : 0) - (gamesA ? winsA / gamesA : 0);
      if (percentageDiff) return percentageDiff;
      var differential = ((recordB.pointsFor || 0) - (recordB.pointsAgainst || 0)) - ((recordA.pointsFor || 0) - (recordA.pointsAgainst || 0));
      return differential || a.localeCompare(b);
  }

  function sortStandings(state, ids) {
    return ids.slice().sort(function(a, b) { return compareStandings(state, a, b); });
  }

  function standingsList(state, conference) {
    var config = getConfig();
    var ids = (config.CONFERENCE && config.CONFERENCE[conference]) || [];
    return sortStandings(state, ids);
  }

  function overallStandingsList(state) {
    var config = getConfig();
    var conferences = config.CONFERENCE || {};
    var ids = (conferences.NORTH || []).concat(conferences.SOUTH || []);
    if (!ids.length) ids = Object.keys(state.season.standings || {});
    return sortStandings(state, ids);
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
      var steals = Math.max(0, Math.round(minutesRatio * (0.12
        + (Number(player.STL) || 60) / 95
        + (Number(player.PDEF) || 60) / 300
        + (Number(player.ATH) || 60) / 400)));
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
    if (!state.season || typeof state.season !== 'object') throw new Error('经理赛季数据无效，无法读取球员统计。');
    if (!state.season.playerStats || typeof state.season.playerStats !== 'object' || Array.isArray(state.season.playerStats)) state.season.playerStats = {};
    if (!state.season.playerStatGameKeys || typeof state.season.playerStatGameKeys !== 'object' || Array.isArray(state.season.playerStatGameKeys)) state.season.playerStatGameKeys = {};
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

  function makeSeries(homeSeed, awaySeed, round, conference, slot) {
    var id = 'P' + round + '-' + conference + '-S' + slot + '-' + homeSeed + '-' + awaySeed;
    return { id: id, homeSeed: homeSeed, awaySeed: awaySeed, conference: conference, round: round, homeWins: 0, awayWins: 0, games: [], winner: null };
  }

  function seedTeams(state, conference) {
    return standingsList(state, conference).slice(0, 8);
  }

  function buildRound(state, round, conference, teams) {
    var pairs = [[0, 7], [3, 4], [1, 6], [2, 5]];
    return pairs.map(function(pair, index) {
      return makeSeries(teams[pair[0]], teams[pair[1]], round, conference, index + 1);
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

  function seriesHomeTeam(series, gameIndex) {
    var homePattern = [true, true, false, false, true, false, true];
    return homePattern[gameIndex] ? series.homeSeed : series.awaySeed;
  }

  function simulateSeriesGame(state, series) {
    if (series.winner) return null;
    var home = seriesHomeTeam(series, series.games.length);
    var away = home === series.homeSeed ? series.awaySeed : series.homeSeed;
    var seedDiff = ((Number(state.season.standings[series.homeSeed].wins) || 0) - (Number(state.season.standings[series.awaySeed].wins) || 0)) * 0.025;
    var result = simulateGame(state, home, away, { phase: 'playoffs', seedDiff: seedDiff });
    if (result.winner === series.homeSeed) series.homeWins++; else series.awayWins++;
    series.games.push({ home: home, away: away, homeScore: result.homeScore, awayScore: result.awayScore, winner: result.winner });
    var gameId = (series.id || ('P' + series.round + '-' + series.conference + '-' + series.homeSeed + '-' + series.awaySeed)) + '-G' + series.games.length;
    state.season.games.push({
      index: gameId,
      home: home,
      away: away,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      winner: result.winner,
      phase: 'playoffs'
    });
    recordGamePlayerStats(state, result, gameId);
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
      playoffs.conferences.NORTH = [makeSeries(north[0].winner, north[1].winner, 2, 'NORTH', 1), makeSeries(north[2].winner, north[3].winner, 2, 'NORTH', 2)];
      playoffs.conferences.SOUTH = [makeSeries(south[0].winner, south[1].winner, 2, 'SOUTH', 1), makeSeries(south[2].winner, south[3].winner, 2, 'SOUTH', 2)];
    } else if (playoffs.round === 2 && allSeriesDone(north) && allSeriesDone(south)) {
      playoffs.round = 3;
      playoffs.conferences.NORTH = [makeSeries(north[0].winner, north[1].winner, 3, 'NORTH', 1)];
      playoffs.conferences.SOUTH = [makeSeries(south[0].winner, south[1].winner, 3, 'SOUTH', 1)];
      playoffs.conferenceWinners = {};
    } else if (playoffs.round === 3 && allSeriesDone(north) && allSeriesDone(south)) {
      playoffs.round = 4;
      playoffs.conferenceWinners.NORTH = north[0].winner;
      playoffs.conferenceWinners.SOUTH = south[0].winner;
      playoffs.finals = makeSeries(playoffs.conferenceWinners.NORTH, playoffs.conferenceWinners.SOUTH, 4, 'FINALS', 1);
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
    var wins = Math.max(0, Number(record.wins) || 0);
    var targetWins = Math.max(1, Number(goal.targetWins) || 1);
    var targetRound = Math.max(1, Number(goal.targetRound) || 1);
    var userRound = Math.max(0, Number(state.season.userRound) || 0);
    var winProgress = Math.min(1, wins / targetWins) * 48;
    var extraWins = Math.min(16, Math.max(0, wins - targetWins)) * 0.75;
    var roundProgress = Math.min(1, userRound / targetRound) * 16;
    var extraRounds = Math.min(2, Math.max(0, userRound - targetRound)) * 5;
    var score = 20 + winProgress + extraWins + roundProgress + extraRounds + (champion ? 10 : 0);
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
    MAX_TRADE_PLAYERS: MAX_TRADE_PLAYERS,
    playerTradeValue: playerTradeValue,
    evaluateTrade: evaluateTrade,
    tradeTargets: tradeTargets,
    inquireTrade: inquireTrade,
    executeTrade: executeTrade,
    standingsList: standingsList,
    overallStandingsList: overallStandingsList,
    playerStatRows: ensureSeasonPlayerStats,
    getNextRegularGame: getNextRegularGame,
    simulateNextRegularGame: simulateNextRegularGame,
    simulateNextUserRegularGame: simulateNextUserRegularGame,
    simulateRemainingRegularSeason: simulateRemainingRegularSeason,
    startPlayoffs: startPlayoffs,
    simulateNextPostseasonGame: simulateNextPostseasonGame,
    simulateNextUserPostseasonGame: simulateNextUserPostseasonGame,
    simulateRemainingPostseason: simulateRemainingPostseason,
    seriesHomeTeam: seriesHomeTeam,
    evaluateOwner: evaluateOwner,
    reset: reset
  };
})(typeof window !== 'undefined' ? window : globalThis);
