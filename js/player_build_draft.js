/* ============================================================
   PlayerBuildDraft - 14 轮随机球员拼装系统
   当前“新建球员”专用；经典建人继续使用 index.html 内的旧逻辑。
   ============================================================ */

var PLAYER_BUILD_TOTAL_ROUNDS = 14;
var PLAYER_BUILD_MAX_REROLLS = 8;
var PLAYER_BUILD_TIERS = Object.freeze({
  core: Object.freeze({ key: 'core', label: '核心', count: 4, multiplier: 1.00, tone: 'core' }),
  strong: Object.freeze({ key: 'strong', label: '强项', count: 4, multiplier: 0.92, tone: 'strong' }),
  normal: Object.freeze({ key: 'normal', label: '普通', count: 3, multiplier: 0.84, tone: 'normal' }),
  weak: Object.freeze({ key: 'weak', label: '弱项', count: 3, multiplier: 0.76, tone: 'weak' })
});
var PLAYER_BUILD_TIER_ORDER = Object.freeze(['core', 'strong', 'normal', 'weak']);

function calculatePlayerBuildFinalValue(baseValue, tierKey) {
  var tier = PLAYER_BUILD_TIERS[tierKey];
  var base = Number(baseValue);
  if (!tier || !Number.isFinite(base)) return 0;
  return Math.round(base * tier.multiplier);
}

function escapePlayerBuildText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createPlayerBuildState() {
  return {
    version: 4,
    status: 'in_progress',
    round: 1,
    rerollsUsed: 0,
    picks: [],
    usedAttrs: [],
    tiers: { core: 0, strong: 0, normal: 0, weak: 0 },
    currentPlayer: null,
    currentPlayers: [],
    selectedSourcePlayerId: null,
    selectedAttr: null,
    selectedTier: null,
    error: ''
  };
}

function getPlayerBuildTierCounts(build) {
  if (!build.tiers || typeof build.tiers !== 'object') build.tiers = {};
  PLAYER_BUILD_TIER_ORDER.forEach(function(tierKey) {
    var count = Number(build.tiers[tierKey]);
    build.tiers[tierKey] = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  });
  return build.tiers;
}

function ensurePlayerBuildState() {
  var build = STATE.playerBuild;
  if (!build || typeof build !== 'object' || Array.isArray(build)) return null;
  if (!Array.isArray(build.picks)) build.picks = [];
  if (!Array.isArray(build.usedAttrs)) build.usedAttrs = [];
  getPlayerBuildTierCounts(build);
  if (!Number.isFinite(Number(build.rerollsUsed))) build.rerollsUsed = 0;
  build.rerollsUsed = Math.max(0, Math.min(PLAYER_BUILD_MAX_REROLLS, Math.floor(Number(build.rerollsUsed))));
  if (!build.version) build.version = 4;
  if (!build.status) build.status = 'in_progress';
  if (build.status === 'in_progress') {
    build.round = Math.max(1, Math.min(PLAYER_BUILD_TOTAL_ROUNDS, build.picks.length + 1));
  }

  var derivedAttrs = build.picks.map(function(pick) { return pick && pick.attr; }).filter(Boolean);
  if (build.usedAttrs.length !== derivedAttrs.length || derivedAttrs.some(function(key) { return build.usedAttrs.indexOf(key) < 0; })) {
    build.usedAttrs = derivedAttrs.slice();
  }
  STATE._rerollsLeft = Math.max(0, PLAYER_BUILD_MAX_REROLLS - build.rerollsUsed);
  return build;
}

function isDraftPlayerBuildActive() {
  var build = ensurePlayerBuildState();
  return STATE.mode === 'current' && STATE.buildStep === 'player-draft' && !!build && build.status === 'in_progress';
}

function isDraftPlayerBuildComplete() {
  var build = ensurePlayerBuildState();
  return STATE.mode === 'current' && !!build && build.status === 'complete';
}

function getPlayerBuildPool() {
  var pool = [];
  var teams = typeof LEAGUE_TEAM_IDS !== 'undefined' && Array.isArray(LEAGUE_TEAM_IDS)
    ? LEAGUE_TEAM_IDS
    : (typeof LEAGUE_PLAYER_DATA !== 'undefined' ? Object.keys(LEAGUE_PLAYER_DATA) : []);
  teams.forEach(function(team) {
    var players = (typeof LEAGUE_PLAYER_DATA !== 'undefined' && LEAGUE_PLAYER_DATA[team]) || [];
    players.forEach(function(player) {
      if (!player || !player.id) return;
      var complete = ATTR_KEYS.every(function(key) {
        return Number.isFinite(Number(player[key]));
      });
      if (complete) pool.push({ team: team, player: player });
    });
  });
  return pool;
}

function findPlayerBuildSource(source) {
  if (!source || !source.id) return null;
  var teams = source.team ? [source.team] : [];
  if (typeof LEAGUE_TEAM_IDS !== 'undefined' && Array.isArray(LEAGUE_TEAM_IDS)) {
    LEAGUE_TEAM_IDS.forEach(function(team) {
      if (teams.indexOf(team) < 0) teams.push(team);
    });
  }
  for (var i = 0; i < teams.length; i++) {
    var players = (typeof LEAGUE_PLAYER_DATA !== 'undefined' && LEAGUE_PLAYER_DATA[teams[i]]) || [];
    var player = players.find(function(item) { return item && item.id === source.id; });
    if (player) return { team: teams[i], player: player };
  }
  return null;
}

function getPlayerBuildSourceRefs(build) {
  var refs = Array.isArray(build && build.currentPlayers) ? build.currentPlayers.slice() : [];
  if (build && build.currentPlayer && !refs.some(function(ref) { return ref && ref.id === build.currentPlayer.id; })) {
    refs.push(build.currentPlayer);
  }
  var unique = [];
  refs.forEach(function(ref) {
    if (!ref || !ref.id || unique.some(function(item) { return item.id === ref.id; })) return;
    unique.push({ id: ref.id, team: ref.team });
  });
  return unique.slice(0, 2);
}

function getPlayerBuildPickedSourceIds(build) {
  var pickedIds = [];
  var picks = Array.isArray(build && build.picks) ? build.picks : [];
  picks.forEach(function(pick) {
    var playerId = pick && pick.sourcePlayerId;
    if (playerId && pickedIds.indexOf(playerId) < 0) pickedIds.push(playerId);
  });
  return pickedIds;
}

function ensurePlayerBuildSources(build) {
  var refs = getPlayerBuildSourceRefs(build);
  if (!build || build.status !== 'in_progress') return refs.map(findPlayerBuildSource).filter(Boolean);
  var pickedIds = getPlayerBuildPickedSourceIds(build);
  refs = refs.filter(function(ref) { return pickedIds.indexOf(ref.id) < 0; });
  if (refs.length < 2) {
    var pool = getPlayerBuildPool();
    var existingIds = refs.map(function(ref) { return ref.id; });
    var candidates = pool.filter(function(item) {
      return pickedIds.indexOf(item.player.id) < 0 && existingIds.indexOf(item.player.id) < 0;
    });
    while (refs.length < 2 && candidates.length) {
      var pickedIndex = Math.floor(Math.random() * candidates.length);
      var picked = candidates.splice(pickedIndex, 1)[0];
      refs.push({ id: picked.player.id, team: picked.team });
      existingIds.push(picked.player.id);
    }
  }
  build.currentPlayers = refs.slice(0, 2);
  if (!build.currentPlayers.length) return [];
  if (!build.selectedSourcePlayerId || !build.currentPlayers.some(function(ref) { return ref.id === build.selectedSourcePlayerId; })) {
    build.selectedSourcePlayerId = build.currentPlayers[0].id;
  }
  build.currentPlayer = build.currentPlayers.find(function(ref) { return ref.id === build.selectedSourcePlayerId; }) || build.currentPlayers[0];
  return build.currentPlayers.map(findPlayerBuildSource).filter(Boolean);
}

function getPlayerBuildSources(build) {
  return ensurePlayerBuildSources(build);
}

function getCurrentPlayerBuildSource(build) {
  var sources = getPlayerBuildSources(build);
  if (!sources.length) return null;
  var selectedId = build && build.selectedSourcePlayerId;
  return sources.find(function(source) { return source.player.id === selectedId; }) || sources[0];
}

function drawNextPlayerBuildPlayers(excludeIds) {
  var build = ensurePlayerBuildState();
  if (!build) return false;
  var pool = getPlayerBuildPool();
  if (pool.length < 2) {
    build.error = '当前正式球员数据库没有足够的完整14项属性球员。';
    renderDraftPlayerBuildUI();
    return false;
  }
  var excluded = Array.isArray(excludeIds) ? excludeIds : (excludeIds ? [excludeIds] : []);
  var pickedIds = getPlayerBuildPickedSourceIds(build);
  var candidates = pool.filter(function(item) {
    return excluded.indexOf(item.player.id) < 0 && pickedIds.indexOf(item.player.id) < 0;
  });
  if (candidates.length < 2) {
    build.error = '剩余未选球员不足，无法继续本轮建人。';
    renderDraftPlayerBuildUI();
    return false;
  }
  var pickedPlayers = [];
  while (pickedPlayers.length < 2 && candidates.length) {
    var pickedIndex = Math.floor(Math.random() * candidates.length);
    pickedPlayers.push(candidates.splice(pickedIndex, 1)[0]);
  }
  if (pickedPlayers.length < 2) return false;
  build.currentPlayers = pickedPlayers.map(function(item) { return { id: item.player.id, team: item.team }; });
  build.selectedSourcePlayerId = build.currentPlayers[0].id;
  build.currentPlayer = build.currentPlayers[0];
  build.round = build.picks.length + 1;
  build.selectedAttr = null;
  build.selectedTier = null;
  build.error = '';
  STATE.selectedPlayer = null;
  STATE.currentTeam = null;
  STATE.currentRoster = [];
  STATE._mustLockAfterSpin = false;
  return true;
}

function startDraftPlayerBuild() {
  var build = createPlayerBuildState();
  STATE.playerBuild = build;
  STATE.buildStep = 'player-draft';
  STATE.attrs = {};
  STATE.attrSlots = {};
  ATTR_KEYS.forEach(function(key) {
    STATE.attrs[key] = null;
    STATE.attrSlots[key] = null;
  });
  STATE.lockedCount = 0;
  STATE.usedPlayers = [];
  STATE._rerollsLeft = PLAYER_BUILD_MAX_REROLLS;
  STATE._teamsVisited = [];
  STATE._shownThisTeam = [];
  STATE.selectedPlayer = null;
  STATE.currentTeam = null;
  STATE.finalOVR = 0;
  STATE.finalPosition = null;
  STATE.finalArchetype = null;
  drawNextPlayerBuildPlayers();
  showScreen('screen-build');
  renderBuildUI();
  queuePlayerBuildSave();
}

function getPlayerBuildBaseValue(player, attrKey) {
  var value = Number(player && player[attrKey]);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function getPlayerBuildCurrentRound(build) {
  return Math.min(PLAYER_BUILD_TOTAL_ROUNDS, build.picks.length + 1);
}

function isPlayerBuildAttrOwned(build, attrKey) {
  return build.usedAttrs.indexOf(attrKey) >= 0;
}

function isPlayerBuildTierAvailable(build, tierKey) {
  var tier = PLAYER_BUILD_TIERS[tierKey];
  var counts = getPlayerBuildTierCounts(build);
  if (!tier || counts[tierKey] >= tier.count) return false;

  // 选择后剩余名额必须刚好覆盖剩余轮数，避免在最后几轮制造死局。
  var nextCounts = Object.assign({}, counts);
  nextCounts[tierKey]++;
  var remainingRounds = PLAYER_BUILD_TOTAL_ROUNDS - (build.picks.length + 1);
  var remainingSlots = PLAYER_BUILD_TIER_ORDER.reduce(function(total, key) {
    return total + (PLAYER_BUILD_TIERS[key].count - nextCounts[key]);
  }, 0);
  return remainingSlots === remainingRounds;
}

function selectPlayerBuildAttribute(attrKey) {
  if (!isDraftPlayerBuildActive() || ATTR_KEYS.indexOf(attrKey) < 0) return;
  var build = ensurePlayerBuildState();
  var source = getCurrentPlayerBuildSource(build);
  if (!source || isPlayerBuildAttrOwned(build, attrKey)) return;
  build.selectedAttr = attrKey;
  build.selectedTier = null;
  renderDraftPlayerBuildUI();
  queuePlayerBuildSave();
}

function selectPlayerBuildSource(sourceId) {
  if (!isDraftPlayerBuildActive()) return;
  var build = ensurePlayerBuildState();
  var source = getPlayerBuildSources(build).find(function(item) { return item.player.id === sourceId; });
  if (!source) return;
  build.selectedSourcePlayerId = source.player.id;
  build.currentPlayer = { id: source.player.id, team: source.team };
  build.selectedAttr = null;
  build.selectedTier = null;
  renderDraftPlayerBuildUI();
  queuePlayerBuildSave();
}

function selectPlayerBuildTier(tierKey) {
  if (!isDraftPlayerBuildActive() || !PLAYER_BUILD_TIERS[tierKey]) return;
  var build = ensurePlayerBuildState();
  if (!build.selectedAttr || !isPlayerBuildTierAvailable(build, tierKey)) return;
  build.selectedTier = tierKey;
  confirmPlayerBuildRound();
}

function rerollPlayerBuildPlayer() {
  if (!isDraftPlayerBuildActive()) return;
  var build = ensurePlayerBuildState();
  var currentSources = getPlayerBuildSourceRefs(build);
  if (STATE._rerollsLeft <= 0 || !currentSources.length) return;
  var currentIds = currentSources.map(function(source) { return source.id; });
  STATE._rerollsLeft--;
  build.rerollsUsed = PLAYER_BUILD_MAX_REROLLS - STATE._rerollsLeft;
  if (!drawNextPlayerBuildPlayers(currentIds)) {
    STATE._rerollsLeft++;
    build.rerollsUsed = PLAYER_BUILD_MAX_REROLLS - STATE._rerollsLeft;
    return;
  }
  renderDraftPlayerBuildUI();
  queuePlayerBuildSave();
}

function validateCompletedPlayerBuild(build) {
  if (!build || build.picks.length !== PLAYER_BUILD_TOTAL_ROUNDS) return false;
  if (new Set(build.usedAttrs).size !== ATTR_KEYS.length) return false;
  if (ATTR_KEYS.some(function(key) { return build.usedAttrs.indexOf(key) < 0 || !Number.isFinite(Number(STATE.attrs[key])); })) return false;
  return PLAYER_BUILD_TIER_ORDER.every(function(key) {
    return build.tiers[key] === PLAYER_BUILD_TIERS[key].count;
  });
}

function confirmPlayerBuildRound() {
  if (!isDraftPlayerBuildActive()) return;
  var build = ensurePlayerBuildState();
  var source = getCurrentPlayerBuildSource(build);
  var attrKey = build.selectedAttr;
  var tierKey = build.selectedTier;
  if (!source || !attrKey || !tierKey || isPlayerBuildAttrOwned(build, attrKey) || !isPlayerBuildTierAvailable(build, tierKey)) return;

  var baseValue = getPlayerBuildBaseValue(source.player, attrKey);
  var tier = PLAYER_BUILD_TIERS[tierKey];
  var finalValue = calculatePlayerBuildFinalValue(baseValue, tierKey);
  build.picks.push({
    round: build.picks.length + 1,
    sourcePlayerId: source.player.id,
    sourcePlayerName: source.player.cname || source.player.name || source.player.id,
    sourceTeam: source.team,
    attr: attrKey,
    baseValue: baseValue,
    tier: tierKey,
    multiplier: tier.multiplier,
    finalValue: finalValue
  });
  build.usedAttrs.push(attrKey);
  build.tiers[tierKey]++;
  STATE.attrs[attrKey] = finalValue;
  STATE.attrSlots[attrKey] = {
    player: source.player.id,
    team: source.team,
    value: finalValue,
    raw: baseValue,
    penalty: 1,
    capped: false,
    tier: tierKey,
    multiplier: tier.multiplier,
    round: build.picks.length
  };
  STATE.lockedCount = build.picks.length;
  STATE.selectedPlayer = null;
  build.selectedAttr = null;
  build.selectedTier = null;
  build.error = '';

  if (build.picks.length === PLAYER_BUILD_TOTAL_ROUNDS) {
    if (!validateCompletedPlayerBuild(build)) {
      build.error = '建人结果校验未通过，请检查属性和档位名额。';
      renderDraftPlayerBuildUI();
      return;
    }
    build.status = 'complete';
    build.round = PLAYER_BUILD_TOTAL_ROUNDS;
    build.currentPlayer = null;
    STATE.buildStep = 'complete';
    STATE.finalOVR = calcOVR(STATE.attrs, STATE.position);
    STATE.finalPosition = STATE.position;
    renderBuildUI();
    revealPlayer();
    queuePlayerBuildSave();
    return;
  }

  drawNextPlayerBuildPlayers();
  renderDraftPlayerBuildUI();
  queuePlayerBuildSave();
}

function renderPlayerBuildTierCounters(build) {
  return PLAYER_BUILD_TIER_ORDER.map(function(key) {
    var tier = PLAYER_BUILD_TIERS[key];
    var count = getPlayerBuildTierCounts(build)[key];
    return '<div class="pb-tier-counter pb-tier-counter-' + tier.tone + '" data-build-tier-count="' + key + '">' +
      '<span>' + tier.label + '</span><strong>' + count + '<small> / ' + tier.count + '</small></strong></div>';
  }).join('');
}

function renderPlayerBuildAttributes(build, player) {
  var selectedAttr = build.selectedAttr;
  return ATTR_KEYS.map(function(attrKey) {
    var owned = isPlayerBuildAttrOwned(build, attrKey);
    var selected = selectedAttr === attrKey;
    var pick = owned ? build.picks.find(function(item) { return item && item.attr === attrKey; }) : null;
    var lockedValue = Number(STATE.attrs[attrKey]);
    var value = owned && Number.isFinite(lockedValue) ? lockedValue : getPlayerBuildBaseValue(player, attrKey);
    var sourceTeamName = pick && pick.sourceTeam
      ? (typeof getTeamName === 'function' ? getTeamName(pick.sourceTeam) : pick.sourceTeam)
      : '';
    var sourcePlayerName = pick && pick.sourcePlayerName ? pick.sourcePlayerName : '';
    var stateLabel = owned
      ? (sourceTeamName && sourcePlayerName ? sourceTeamName + '-' + sourcePlayerName : '已拥有')
      : (selected ? '已选' : '可选择');
    var disabled = owned ? ' disabled' : '';
    return '<button type="button" class="pb-attr-card' + (owned ? ' is-owned' : '') + (selected ? ' is-selected' : '') + '"' +
      ' data-build-attr="' + attrKey + '" aria-pressed="' + (selected ? 'true' : 'false') + '"' + disabled +
      ' onclick="selectPlayerBuildAttribute(\'' + attrKey + '\')">' +
      '<span class="pb-attr-name">' + escapePlayerBuildText(attrCN(attrKey)) + '</span>' +
      '<strong class="pb-attr-value">' + value + '</strong>' +
      '<span class="pb-attr-state">' + escapePlayerBuildText(stateLabel) + '</span>' +
      '</button>';
  }).join('');
}

function renderPlayerBuildTierChooser(build, player) {
  if (!build.selectedAttr) {
    return '<div class="pb-tier-empty"><span class="pb-tier-empty-icon">↳</span><div><strong>先选一项属性</strong><small>再决定它要成为核心、强项、普通或弱项</small></div></div>';
  }
  var baseValue = getPlayerBuildBaseValue(player, build.selectedAttr);
  return '<div class="pb-tier-options">' + PLAYER_BUILD_TIER_ORDER.map(function(key) {
    var tier = PLAYER_BUILD_TIERS[key];
    var count = getPlayerBuildTierCounts(build)[key];
    var available = isPlayerBuildTierAvailable(build, key);
    var selected = build.selectedTier === key;
    var value = calculatePlayerBuildFinalValue(baseValue, key);
    return '<button type="button" class="pb-tier-option pb-tier-option-' + tier.tone + (selected ? ' is-selected' : '') + (!available ? ' is-full' : '') + '"' +
      ' data-build-tier="' + key + '" aria-pressed="' + (selected ? 'true' : 'false') + '"' + (!available ? ' disabled' : '') +
      ' onclick="selectPlayerBuildTier(\'' + key + '\')">' +
      '<span class="pb-tier-option-top"><strong>' + tier.label + '</strong><small>×' + tier.multiplier.toFixed(2) + '</small></span>' +
      '<span class="pb-tier-option-value"><b>' + baseValue + '</b><span>→</span><strong>' + value + '</strong></span>' +
      '<span class="pb-tier-option-foot">' + (available ? '剩余 ' + (tier.count - count) + ' 名额' : '名额已满') + '</span>' +
      '</button>';
  }).join('') + '</div>';
}

function renderPlayerBuildSourceSwitcher(build, sources) {
  return '<div class="pb-source-switcher" role="group" aria-label="本轮随机的两名球员">' + sources.map(function(source, index) {
    var player = source.player;
    var selected = player.id === build.selectedSourcePlayerId;
    var teamName = typeof getTeamName === 'function' ? getTeamName(source.team) : source.team;
    return '<button type="button" class="pb-source-option' + (selected ? ' is-selected' : '') + '" data-build-source-player="' + escapePlayerBuildText(player.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '" onclick="selectPlayerBuildSource(\'' + player.id + '\')">' +
      '<span class="pb-source-option-index">' + (index === 0 ? 'A' : 'B') + '</span>' +
      '<span class="pb-source-option-copy"><strong>' + escapePlayerBuildText(player.cname || player.id) + '</strong><small>' + escapePlayerBuildText(player.pos || '位置未知') + ' · ' + escapePlayerBuildText(teamName) + '</small></span>' +
      '<span class="pb-source-option-ovr"><small>OVR</small>' + (Number(player.ovr) || '—') + '</span>' +
      '</button>';
  }).join('') + '</div>';
}

function renderDraftPlayerBuildUI() {
  var area = document.getElementById('player-build-area');
  var build = ensurePlayerBuildState();
  if (!area || !build || build.status !== 'in_progress') return;
  var sources = getPlayerBuildSources(build);
  var source = getCurrentPlayerBuildSource(build);
  if (!source || sources.length < 2) {
    area.innerHTML = '<div class="pb-build-shell"><div class="pb-error-state"><strong>无法恢复本轮球员</strong><span>正式球员数据库中找不到两名可用的完整属性球员。</span></div></div>';
    return;
  }
  var player = source.player;
  var round = getPlayerBuildCurrentRound(build);
  var progress = Math.round((build.picks.length / PLAYER_BUILD_TOTAL_ROUNDS) * 100);

  area.innerHTML =
    '<div class="pb-build-shell" data-build-round="' + round + '" data-build-status="in_progress">' +
      '<div class="pb-round-strip">' +
        '<div class="pb-round-copy"><span class="pb-round-kicker">PLAYER FORGE · ROUND ' + String(round).padStart(2, '0') + '</span><strong>第 ' + round + ' / ' + PLAYER_BUILD_TOTAL_ROUNDS + ' 轮</strong></div>' +
        '<div class="pb-reroll-meter"><span>重抽</span><strong>' + STATE._rerollsLeft + ' <small>/ ' + PLAYER_BUILD_MAX_REROLLS + '</small></strong></div>' +
      '</div>' +
      '<div class="pb-progress-track" aria-label="建人进度"><span style="width:' + progress + '%"></span></div>' +
      '<div class="pb-tier-counters" aria-label="档位名额">' + renderPlayerBuildTierCounters(build) + '</div>' +
      '<section class="pb-source-section" aria-labelledby="pb-source-title">' +
        '<div class="pb-section-head"><div><span class="pb-section-kicker">CURRENT SOURCES · 2 PLAYERS</span><h2 id="pb-source-title">本轮随机2名球员</h2></div><span class="pb-rule-copy">点击切换来源，再拿 1 项</span></div>' +
        '<div class="pb-source-card">' +
          renderPlayerBuildSourceSwitcher(build, sources) +
          '<div class="pb-source-divider"></div>' +
          '<div class="pb-attr-grid" aria-label="当前球员14项属性">' + renderPlayerBuildAttributes(build, player) + '</div>' +
        '</div>' +
      '</section>' +
      '<section class="pb-tier-section" aria-labelledby="pb-tier-title">' +
        '<div class="pb-section-head"><div><span class="pb-section-kicker">CHOOSE A TIER</span><h2 id="pb-tier-title">' + (build.selectedAttr ? '选择「' + escapePlayerBuildText(attrCN(build.selectedAttr)) + '」的定位' : '为这项能力选择档位') + '</h2></div><span class="pb-rule-copy">点击档位立即锁定</span></div>' +
        renderPlayerBuildTierChooser(build, player) +
      '</section>' +
      '<div class="pb-build-actions">' +
        '<button type="button" class="pb-reroll-button" data-build-reroll onclick="rerollPlayerBuildPlayer()"' + (STATE._rerollsLeft > 0 ? '' : ' disabled') + '><span>↻</span>重新随机 <small>剩余 ' + STATE._rerollsLeft + ' 次</small></button>' +
      '</div>' +
      '<p class="pb-build-footnote" aria-live="polite">' + (build.error ? escapePlayerBuildText(build.error) : '点击一个档位后立即锁定，系统会自动抽取下一名球员。') + '</p>' +
    '</div>';
}

function queuePlayerBuildSave() {
  if (typeof autoSaveGame !== 'function' || !STATE.career || STATE.career.retired) return;
  if (queuePlayerBuildSave.timer) clearTimeout(queuePlayerBuildSave.timer);
  queuePlayerBuildSave.pending = true;
  queuePlayerBuildSave.timer = setTimeout(function flushPlayerBuildSave() {
    queuePlayerBuildSave.timer = null;
    if (!queuePlayerBuildSave.pending || queuePlayerBuildSave.inFlight) return;
    queuePlayerBuildSave.pending = false;
    queuePlayerBuildSave.inFlight = true;
    Promise.resolve(autoSaveGame()).catch(function(error) {
      console.warn('[PlayerBuild] 建人进度保存失败:', error && error.message ? error.message : error);
    }).then(function() {
      queuePlayerBuildSave.inFlight = false;
      if (queuePlayerBuildSave.pending) queuePlayerBuildSave();
    });
  }, 120);
}

function resumePlayerBuildIfNeeded() {
  var build = ensurePlayerBuildState();
  if (STATE.mode !== 'current' || !build) return false;
  if (build.status === 'in_progress' && STATE.buildStep === 'player-draft') {
    showScreen('screen-build');
    renderBuildUI();
  return true;
}
  if (build.status === 'complete' && !STATE.careerTeam && !(STATE.season && STATE.season.schedule)) {
    revealPlayer();
    return true;
  }
  return false;
}

window.PLAYER_BUILD_TIERS = PLAYER_BUILD_TIERS;
window.calculatePlayerBuildFinalValue = calculatePlayerBuildFinalValue;
