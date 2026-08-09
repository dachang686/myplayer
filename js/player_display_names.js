(function installPlayerIdentity(global) {
  'use strict';

  var dynamicSequence = 0;
  var baseIdByChineseName = {};

  function rosterData() {
    return typeof LEAGUE_PLAYER_DATA !== 'undefined' ? LEAGUE_PLAYER_DATA : global.LEAGUE_PLAYER_DATA;
  }

  function allPlayers(data) {
    var league = data || rosterData() || {};
    return Object.keys(league).reduce(function(players, team) {
      return players.concat(Array.isArray(league[team]) ? league[team] : []);
    }, []);
  }

  function chineseSurname(player) {
    var parts = String(player && player.cname || '').split('-').filter(Boolean);
    var surname = parts.length ? parts[parts.length - 1] : '球员';
    return surname.replace(/(?:二世|三世|四世)$/g, '') || '球员';
  }

  function hashIdentity(value) {
    var hash = 2166136261;
    var text = String(value || 'player');
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0');
  }

  function ensurePlayerId(player, seed) {
    if (!player) return '';
    if (!player.id) {
      dynamicSequence += 1;
      player.id = 'R' + hashIdentity([seed || '', player.cname || '', player.pos || '', player.ovr || '', dynamicSequence].join('|'));
    }
    delete player.name;
    delete player.nameEN;
    return player.id;
  }

  function refreshPlayerShortNames(data) {
    allPlayers(data).forEach(function(player, index) {
      ensurePlayerId(player, index);
      player.shortName = chineseSurname(player);
    });
  }

  function findPlayerById(playerId, data) {
    var lookup = String(playerId || '');
    return allPlayers(data).find(function(player) { return player && player.id === lookup; }) || null;
  }

  function normalizeLeaguePlayerIds(league) {
    var legacyMap = {};
    var usedIds = {};
    Object.keys(league || {}).forEach(function(team) {
      var roster = Array.isArray(league[team]) ? league[team] : [];
      roster.forEach(function(player, index) {
        if (!player) return;
        var legacyName = player.name || player.nameEN || '';
        var id = player.id || baseIdByChineseName[player.cname] || ('L' + hashIdentity([legacyName, player.cname, team, index].join('|')));
        while (usedIds[id]) id += 'X';
        usedIds[id] = true;
        player.id = id;
        if (legacyName) legacyMap[legacyName] = id;
        delete player.name;
        delete player.nameEN;
        player.shortName = chineseSurname(player);
      });
    });
    return legacyMap;
  }

  function mapIdentity(value, legacyMap) {
    return legacyMap[String(value || '')] || value;
  }

  function rekeyIdentityObject(source, legacyMap) {
    var target = {};
    Object.keys(source || {}).forEach(function(key) {
      var colon = key.indexOf(':');
      var mappedKey = colon >= 0
        ? key.slice(0, colon + 1) + mapIdentity(key.slice(colon + 1), legacyMap)
        : mapIdentity(key, legacyMap);
      target[mappedKey] = source[key];
    });
    return target;
  }

  function migrateLegacySavePlayerIdentity(snapshot) {
    if (!snapshot || !snapshot.state) return snapshot;
    var legacyMap = normalizeLeaguePlayerIds(snapshot.league || {});
    var state = snapshot.state;
    ['usedPlayers', '_shownThisTeam'].forEach(function(key) {
      if (Array.isArray(state[key])) state[key] = state[key].map(function(value) { return mapIdentity(value, legacyMap); });
    });
    if (state.selectedPlayer) {
      state.selectedPlayer.id = state.selectedPlayer.id || mapIdentity(state.selectedPlayer.name, legacyMap);
      delete state.selectedPlayer.name;
      delete state.selectedPlayer.nameEN;
      state.selectedPlayer.shortName = chineseSurname(state.selectedPlayer);
    }
    Object.keys(state.attrSlots || {}).forEach(function(key) {
      var slot = state.attrSlots[key];
      if (slot && slot.player) slot.player = mapIdentity(slot.player, legacyMap);
    });
    if (state.career && state.career.flags) {
      var flags = state.career.flags;
      if (flags.bondedTeammate) {
        flags.bondedTeammate.id = flags.bondedTeammate.id || mapIdentity(flags.bondedTeammate.name, legacyMap);
        delete flags.bondedTeammate.name;
      }
      if (flags.superstarRecruiterEN) {
        flags.superstarRecruiterId = mapIdentity(flags.superstarRecruiterEN, legacyMap);
        delete flags.superstarRecruiterEN;
      }
    }
    if (state.season) {
      state.season._npcSeasonProfiles = rekeyIdentityObject(state.season._npcSeasonProfiles, legacyMap);
      state.season.leaguePlayerSeasonStats = rekeyIdentityObject(state.season.leaguePlayerSeasonStats, legacyMap);
      (state.season.awards || []).forEach(function(award) {
        if (!award) return;
        if (award.winnerEN) {
          award.winnerId = String(award.winnerEN).split('、').map(function(value) { return mapIdentity(value, legacyMap); }).join('、');
          delete award.winnerEN;
        }
        (award.players || []).forEach(function(player) {
          if (!player) return;
          player.id = player.id || mapIdentity(player.name, legacyMap);
          delete player.name;
          delete player.nameEN;
        });
      });
    }
    Object.keys(state._leagueChanges || {}).forEach(function(changeKey) {
      var changes = state._leagueChanges[changeKey];
      if (!Array.isArray(changes)) return;
      changes.forEach(function(change) {
        if (!change || typeof change !== 'object') return;
        if (change.nameEN) change.playerId = mapIdentity(change.nameEN, legacyMap);
        delete change.nameEN;
      });
    });
    if (snapshot.rookieState) {
      (snapshot.rookieState.starQueue || []).forEach(function(rookie, index) {
        if (!rookie) return;
        var current = (global.STAR_ROOKIES || []).find(function(item) {
          return (rookie.id && item.id === rookie.id) || item.cn === rookie.cn;
        });
        rookie.id = rookie.id || (current && current.id) || ('SLEGACY' + String(index + 1).padStart(3, '0'));
        delete rookie.en;
        delete rookie.nameEN;
      });
      snapshot.rookieState.usedCandidateNames = {};
    }
    snapshot.ages = rekeyIdentityObject(snapshot.ages, legacyMap);
    snapshot.genes = rekeyIdentityObject(snapshot.genes, legacyMap);
    return snapshot;
  }

  var baseChineseNameCounts = {};
  allPlayers().forEach(function(player) {
    if (!player || !player.cname) return;
    baseChineseNameCounts[player.cname] = (baseChineseNameCounts[player.cname] || 0) + 1;
  });
  allPlayers().forEach(function(player) {
    if (player && player.cname && player.id && baseChineseNameCounts[player.cname] === 1) {
      baseIdByChineseName[player.cname] = player.id;
    }
  });

  global.ensurePlayerId = ensurePlayerId;
  global.normalizeLeaguePlayerIds = normalizeLeaguePlayerIds;
  global.migrateLegacySavePlayerIdentity = migrateLegacySavePlayerIdentity;
  global.findLeaguePlayerById = findPlayerById;
  global.refreshPlayerShortNames = refreshPlayerShortNames;
  global.getPlayerShortName = function getPlayerShortName(player) {
    if (!player) return '';
    return player.shortName || chineseSurname(player);
  };
  global.getPlayerShortNameById = function getPlayerShortNameById(playerId) {
    var player = findPlayerById(playerId);
    return player ? global.getPlayerShortName(player) : String(playerId || '');
  };

  refreshPlayerShortNames();
})(window);
