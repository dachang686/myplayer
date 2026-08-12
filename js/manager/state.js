(function installManagerState(global) {
  'use strict';

  var VERSION = 4;
  var POSITION_SLOTS = ['PG', 'SG', 'SF', 'PF', 'C'];
  var DEFAULT_MINUTES = [34, 34, 32, 32, 30, 20, 18, 16, 14, 10];

  function deepClone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function hashSeed(value) {
    var text = String(value == null ? '' : value);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRngSeed(teamId, seasonLabel) {
    return hashSeed('manager:' + String(seasonLabel || '') + ':' + String(teamId || ''));
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
    var entries = roster.map(function(player) { return player.id; });
    var assignmentFor = function(playerId) { return (rotation && rotation[playerId]) || { starter: false, minutes: 0 }; };
    var minutesFor = function(playerId) { return Number(assignmentFor(playerId).minutes); };
    var active = entries.filter(function(playerId) {
      return minutesFor(playerId) > 0;
    });
    var starters = entries.filter(function(playerId) { return !!assignmentFor(playerId).starter; });
    var totalMinutes = entries.reduce(function(total, playerId) {
      var minutes = minutesFor(playerId);
      return total + (Number.isFinite(minutes) ? minutes : 0);
    }, 0);

    if (starters.length !== 5) errors.push('首发必须恰好 5 人，当前为 ' + starters.length + ' 人。');
    if (active.length < 9 || active.length > 11) errors.push('轮换人数必须为 9 至 11 人，当前为 ' + active.length + ' 人。');
    if (totalMinutes !== 240) errors.push('总上场时间必须恰好 240 分钟，当前为 ' + totalMinutes + ' 分钟。');

    entries.forEach(function(playerId) {
      var minutes = minutesFor(playerId);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 48) {
        errors.push((rosterById[playerId].cname || playerId) + ' 的上场时间必须是 0 至 48 的整数。');
      }
    });
    starters.forEach(function(playerId) {
      if (minutesFor(playerId) <= 0) {
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
      rngState: createRngSeed(teamId, '2026-27'),
      leagueData: leagueData,
      rotation: createDefaultRotation(roster),
      tradeHistory: [],
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

  function normalizeRecord(record) {
    record = record && typeof record === 'object' ? record : {};
    return {
      wins: Math.max(0, Math.floor(Number(record.wins) || 0)),
      losses: Math.max(0, Math.floor(Number(record.losses) || 0)),
      pointsFor: Math.max(0, Math.floor(Number(record.pointsFor) || 0)),
      pointsAgainst: Math.max(0, Math.floor(Number(record.pointsAgainst) || 0))
    };
  }

  function normalizeRotation(roster, rotation) {
    var defaults = createDefaultRotation(roster);
    if (!rotation || typeof rotation !== 'object' || Array.isArray(rotation)) return defaults;
    roster.forEach(function(player) {
      var saved = rotation[player.id];
      if (!saved || typeof saved !== 'object') return;
      var minutes = Number(saved.minutes);
      defaults[player.id] = {
        starter: !!saved.starter,
        minutes: Number.isFinite(minutes) ? minutes : 0
      };
    });
    return defaults;
  }

  function ensureSeasonDefaults(state, teamIds) {
    var season = state.season;
    if (!season || typeof season !== 'object' || Array.isArray(season)) {
      throw new Error('经理存档的赛季结构已损坏，无法读取。');
    }
    if (!Array.isArray(season.schedule)) {
      throw new Error('经理存档缺少有效赛程，无法安全读取。');
    }
    if (season.games != null && !Array.isArray(season.games)) {
      throw new Error('经理存档的比赛记录已损坏，无法读取。');
    }
    season.games = Array.isArray(season.games) ? season.games : [];
    season.playerStats = season.playerStats && typeof season.playerStats === 'object' && !Array.isArray(season.playerStats) ? season.playerStats : {};
    season.playerStatGameKeys = season.playerStatGameKeys && typeof season.playerStatGameKeys === 'object' && !Array.isArray(season.playerStatGameKeys) ? season.playerStatGameKeys : {};
    season.standings = season.standings && typeof season.standings === 'object' && !Array.isArray(season.standings) ? season.standings : {};
    teamIds.forEach(function(teamId) { season.standings[teamId] = normalizeRecord(season.standings[teamId]); });
    season.scheduleIndex = Math.min(season.schedule.length, Math.max(0, Math.floor(Number(season.scheduleIndex) || 0)));
    season.playoffs = season.playoffs && typeof season.playoffs === 'object' ? season.playoffs : null;
    season.phase = ['regular', 'playoffs', 'complete'].indexOf(season.phase) >= 0 ? season.phase : 'regular';
    season.champion = season.champion || null;
    season.userRound = Math.max(0, Math.floor(Number(season.userRound) || 0));
  }

  function ensureOwnerDefaults(state) {
    state.owner = state.owner && typeof state.owner === 'object' ? state.owner : {};
    state.owner.rating = Math.max(0, Math.min(100, Math.round(Number(state.owner.rating) || 70)));
    if (!state.owner.goal || typeof state.owner.goal !== 'object' || !Number.isFinite(Number(state.owner.goal.targetWins)) || !Number.isFinite(Number(state.owner.goal.targetRound))) {
      state.owner.goal = createOwnerGoal(state.selectedTeam, state.leagueData);
    }
    state.owner.evaluation = state.owner.evaluation && typeof state.owner.evaluation === 'object' ? state.owner.evaluation : null;
  }

  function normalizeTradeHistory(history) {
    if (history == null) return [];
    if (!Array.isArray(history)) throw new Error('经理存档的交易记录已损坏，无法读取。');
    return history.filter(function(trade) {
      return trade && typeof trade === 'object' && typeof trade.userTeam === 'string' && typeof trade.partnerTeam === 'string' && trade.sent && trade.received;
    }).map(function(trade, index) {
      var sent = Array.isArray(trade.sent) ? trade.sent : [trade.sent];
      var received = Array.isArray(trade.received) ? trade.received : [trade.received];
      return {
        id: String(trade.id || ('T' + (index + 1))),
        userTeam: trade.userTeam,
        partnerTeam: trade.partnerTeam,
        sent: deepClone(sent.filter(function(player) { return player && typeof player === 'object' && player.id; })),
        received: deepClone(received.filter(function(player) { return player && typeof player === 'object' && player.id; })),
        acceptedMargin: Number(trade.acceptedMargin) || 0,
        scheduleIndex: Math.max(0, Math.floor(Number(trade.scheduleIndex) || 0)),
        rotationReset: !!trade.rotationReset,
        createdAt: typeof trade.createdAt === 'string' ? trade.createdAt : null
      };
    }).filter(function(trade) { return trade.sent.length && trade.received.length; });
  }

  function migrateVersionOne(state, teamIds) {
    ensureSeasonDefaults(state, teamIds);
    state.rotation = normalizeRotation(state.leagueData[state.selectedTeam], state.rotation);
    ensureOwnerDefaults(state);
    if (!Number.isFinite(Number(state.rngState))) state.rngState = createRngSeed(state.selectedTeam, state.seasonLabel || '2026-27');
    state.version = 2;
    return state;
  }

  function migrateVersionTwo(state, teamIds) {
    ensureSeasonDefaults(state, teamIds);
    state.rotation = normalizeRotation(state.leagueData[state.selectedTeam], state.rotation);
    ensureOwnerDefaults(state);
    state.tradeHistory = normalizeTradeHistory(state.tradeHistory);
    state.version = 3;
    return state;
  }

  function migrateVersionThree(state, teamIds) {
    ensureSeasonDefaults(state, teamIds);
    state.rotation = normalizeRotation(state.leagueData[state.selectedTeam], state.rotation);
    ensureOwnerDefaults(state);
    state.tradeHistory = normalizeTradeHistory(state.tradeHistory);
    state.version = 4;
    return state;
  }

  function normalize(saved) {
    if (!saved || typeof saved !== 'object' || saved.mode !== 'manager' || typeof saved.selectedTeam !== 'string' || !saved.selectedTeam) {
      throw new Error('经理存档格式无效。');
    }
    if (!saved.leagueData || typeof saved.leagueData !== 'object' || Array.isArray(saved.leagueData) || !Array.isArray(saved.leagueData[saved.selectedTeam])) {
      throw new Error('经理存档的球队名单已损坏，无法读取。');
    }
    if (!saved.season || typeof saved.season !== 'object' || Array.isArray(saved.season)) {
      throw new Error('经理存档的赛季结构已损坏，无法读取。');
    }
    var state = deepClone(saved);
    var version = Number(state.version || 1);
    if (!Number.isInteger(version) || version < 1) throw new Error('经理存档版本无效，无法读取。');
    if (version > VERSION) throw new Error('该经理存档来自更新版本，当前版本无法读取。');
    var teamIds = Object.keys(state.leagueData).filter(function(teamId) { return Array.isArray(state.leagueData[teamId]); });
    if (teamIds.length < 2) throw new Error('经理存档的联赛名单已损坏，无法读取。');
    while (version < VERSION) {
      if (version === 1) {
        state = migrateVersionOne(state, teamIds);
        version = state.version;
      } else if (version === 2) {
        state = migrateVersionTwo(state, teamIds);
        version = state.version;
      } else if (version === 3) {
        state = migrateVersionThree(state, teamIds);
        version = state.version;
      }
    }
    ensureSeasonDefaults(state, teamIds);
    state.rotation = normalizeRotation(state.leagueData[state.selectedTeam], state.rotation);
    ensureOwnerDefaults(state);
    state.tradeHistory = normalizeTradeHistory(state.tradeHistory);
    if (!Number.isFinite(Number(state.rngState))) state.rngState = createRngSeed(state.selectedTeam, state.seasonLabel || '2026-27');
    state.version = VERSION;
    state.updatedAt = new Date().toISOString();
    return state;
  }

  global.ManagerState = {
    VERSION: VERSION,
    POSITION_SLOTS: POSITION_SLOTS.slice(),
    deepClone: deepClone,
    createRngSeed: createRngSeed,
    eligiblePositions: eligiblePositions,
    findStarterAssignment: findStarterAssignment,
    createDefaultRotation: createDefaultRotation,
    validateRotation: validateRotation,
    normalizeTradeHistory: normalizeTradeHistory,
    create: create,
    normalize: normalize
  };
  global.MANAGER_STATE = null;
})(typeof window !== 'undefined' ? window : globalThis);
