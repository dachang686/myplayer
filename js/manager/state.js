(function installManagerState(global) {
  'use strict';

  var VERSION = 1;
  var POSITION_SLOTS = ['PG', 'SG', 'SF', 'PF', 'C'];
  var DEFAULT_MINUTES = [34, 34, 32, 32, 30, 20, 18, 16, 14, 10];

  function deepClone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function eligiblePositions(player) {
    return String(player && player.pos || '')
      .split('/')
      .map(function(position) { return position.trim().toUpperCase(); })
      .filter(function(position) { return POSITION_SLOTS.indexOf(position) >= 0; });
  }

  function findStarterAssignment(starters) {
    var byFlexibility = starters.slice().sort(function(a, b) {
      return eligiblePositions(a).length - eligiblePositions(b).length;
    });
    var used = {};
    var assignment = {};

    function assign(index) {
      if (index >= byFlexibility.length) return true;
      var player = byFlexibility[index];
      var positions = eligiblePositions(player);
      for (var i = 0; i < positions.length; i++) {
        var position = positions[i];
        if (used[position]) continue;
        used[position] = true;
        assignment[player.id] = position;
        if (assign(index + 1)) return true;
        delete assignment[player.id];
        delete used[position];
      }
      return false;
    }

    return byFlexibility.length === 5 && assign(0) ? assignment : null;
  }

  function selectDefaultStarters(roster) {
    var candidates = roster.slice().sort(function(a, b) {
      return (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
    });
    var best = null;

    function search(selected, startIndex) {
      if (best) return;
      if (selected.length === 5) {
        if (findStarterAssignment(selected)) best = selected.slice();
        return;
      }
      for (var i = startIndex; i < candidates.length; i++) {
        selected.push(candidates[i]);
        search(selected, i + 1);
        selected.pop();
        if (best) return;
      }
    }

    search([], 0);
    return best || candidates.slice(0, 5);
  }

  function createDefaultRotation(roster) {
    var sorted = roster.slice().sort(function(a, b) {
      return (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
    });
    var starters = selectDefaultStarters(sorted);
    var starterIds = {};
    starters.forEach(function(player) { starterIds[player.id] = true; });
    var ordered = starters.concat(sorted.filter(function(player) { return !starterIds[player.id]; }));
    var rotation = {};
    ordered.forEach(function(player, index) {
      rotation[player.id] = {
        starter: !!starterIds[player.id],
        minutes: index < DEFAULT_MINUTES.length ? DEFAULT_MINUTES[index] : 0
      };
    });
    return rotation;
  }

  function validateRotation(roster, rotation) {
    var errors = [];
    var rosterById = {};
    roster.forEach(function(player) { rosterById[player.id] = player; });
    var entries = Object.keys(rotation || {}).filter(function(playerId) { return !!rosterById[playerId]; });
    var active = entries.filter(function(playerId) {
      return Number(rotation[playerId].minutes) > 0;
    });
    var starters = entries.filter(function(playerId) { return !!rotation[playerId].starter; });
    var totalMinutes = active.reduce(function(total, playerId) {
      return total + (Number(rotation[playerId].minutes) || 0);
    }, 0);

    if (starters.length !== 5) errors.push('首发必须恰好 5 人，当前为 ' + starters.length + ' 人。');
    if (active.length < 9 || active.length > 11) errors.push('轮换人数必须为 9 至 11 人，当前为 ' + active.length + ' 人。');
    if (totalMinutes !== 240) errors.push('总上场时间必须恰好 240 分钟，当前为 ' + totalMinutes + ' 分钟。');

    active.forEach(function(playerId) {
      var minutes = Number(rotation[playerId].minutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 48) {
        errors.push((rosterById[playerId].cname || playerId) + ' 的上场时间必须是 1 至 48 的整数。');
      }
    });
    starters.forEach(function(playerId) {
      if (Number(rotation[playerId].minutes) <= 0) {
        errors.push((rosterById[playerId].cname || playerId) + ' 已设为首发，必须进入轮换。');
      }
    });

    if (starters.length === 5) {
      var starterPlayers = starters.map(function(playerId) { return rosterById[playerId]; });
      if (!findStarterAssignment(starterPlayers)) {
        errors.push('首发位置不完整，必须能够覆盖 PG、SG、SF、PF、C。');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      totalMinutes: totalMinutes,
      activeCount: active.length,
      starterCount: starters.length,
      assignment: starters.length === 5
        ? findStarterAssignment(starters.map(function(playerId) { return rosterById[playerId]; }))
        : null
    };
  }

  function createOwnerGoal(teamId, leagueData) {
    var strengths = Object.keys(leagueData).map(function(id) {
      var topTen = leagueData[id].slice().sort(function(a, b) {
        return (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
      }).slice(0, 10);
      return {
        id: id,
        strength: topTen.reduce(function(sum, player) { return sum + (Number(player.ovr) || 0); }, 0) / Math.max(1, topTen.length)
      };
    }).sort(function(a, b) { return b.strength - a.strength; });
    var rank = strengths.findIndex(function(team) { return team.id === teamId; }) + 1;
    if (rank <= 6) return { targetWins: 50, targetRound: 3, label: '至少 50 胜并打进分区决赛', rosterRank: rank };
    if (rank <= 16) return { targetWins: 44, targetRound: 2, label: '至少 44 胜并突破首轮', rosterRank: rank };
    return { targetWins: 36, targetRound: 1, label: '至少 36 胜并打进季后赛', rosterRank: rank };
  }

  function create(teamId, sourceLeagueData, teamIds, scheduleFactory, config) {
    if (!teamId || teamIds.indexOf(teamId) < 0) throw new Error('请选择有效球队。');
    var leagueData = deepClone(sourceLeagueData);
    var roster = leagueData[teamId] || [];
    var schedule = scheduleFactory({
      teams: teamIds.slice(),
      conference: deepClone(config.CONFERENCE),
      divisions: deepClone(config.DIVISIONS),
      seed: 'manager-2026-' + teamId
    });
    var standings = {};
    teamIds.forEach(function(id) {
      standings[id] = { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
    });

    return {
      version: VERSION,
      mode: 'manager',
      selectedTeam: teamId,
      seasonLabel: '2026-27 赛季',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rngState: 2166136261 ^ teamId.charCodeAt(0) ^ teamId.charCodeAt(teamId.length - 1),
      leagueData: leagueData,
      rotation: createDefaultRotation(roster),
      owner: {
        rating: 70,
        goal: createOwnerGoal(teamId, leagueData),
        evaluation: null
      },
      season: {
        phase: 'regular',
        schedule: schedule,
        scheduleIndex: 0,
        games: [],
        standings: standings,
        playerStats: {},
        playerStatGameKeys: {},
        playoffs: null,
        champion: null,
        userRound: 0
      }
    };
  }

  function normalize(saved) {
    if (!saved || saved.mode !== 'manager' || !saved.selectedTeam || !saved.leagueData || !saved.season) {
      throw new Error('经理存档格式无效。');
    }
    var state = deepClone(saved);
    state.version = VERSION;
    state.updatedAt = new Date().toISOString();
    return state;
  }

  global.ManagerState = {
    VERSION: VERSION,
    POSITION_SLOTS: POSITION_SLOTS.slice(),
    deepClone: deepClone,
    eligiblePositions: eligiblePositions,
    findStarterAssignment: findStarterAssignment,
    createDefaultRotation: createDefaultRotation,
    validateRotation: validateRotation,
    create: create,
    normalize: normalize
  };
  global.MANAGER_STATE = null;
})(typeof window !== 'undefined' ? window : globalThis);
