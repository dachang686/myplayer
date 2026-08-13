/*
 * 个人生涯历史纪录：仅依赖 STATE.career / STATE.season，绝不读取或写入经理模式存档。
 * 当前项目的生涯累计口径为常规赛；季后赛仍由 career.playoffStats 单独保存。
 */
(function(root) {
  'use strict';

  var LEGACY_VERSION = 3;
  var RANKING_LIMIT = 10;
  var CATEGORY_CONFIG = {
    points: { field: 'pts', label: '总得分', shortLabel: '得分' },
    rebounds: { field: 'reb', label: '总篮板', shortLabel: '篮板' },
    assists: { field: 'ast', label: '总助攻', shortLabel: '助攻' },
    steals: { field: 'stl', label: '总抢断', shortLabel: '抢断' },
    blocks: { field: 'blk', label: '总盖帽', shortLabel: '盖帽' }
  };

  // NBA 官方常规赛历史累计统计快照，数据截至 2025-26 赛季结束。
  // 采用静态快照而非运行时请求，确保离线游戏的存档排名和里程碑可复现。
  var BASELINE_RECORDS = {
    points: [
      ['nba-points-1', '勒布朗·詹姆斯', 'LAL', 43440], ['nba-points-2', '卡里姆·阿卜杜尔-贾巴尔', 'LAL', 38387],
      ['nba-points-3', '卡尔·马龙', 'UTA', 36928], ['nba-points-4', '科比·布莱恩特', 'LAL', 33643],
      ['nba-points-5', '凯文·杜兰特', 'HOU', 32597], ['nba-points-6', '迈克尔·乔丹', 'CHI', 32292],
      ['nba-points-7', '德克·诺维茨基', 'DAL', 31560], ['nba-points-8', '威尔特·张伯伦', 'LAL', 31419],
      ['nba-points-9', '詹姆斯·哈登', 'HOU', 29339], ['nba-points-10', '卡梅隆·安东尼', 'NYK', 28289]
    ],
    rebounds: [
      ['nba-rebounds-1', '威尔特·张伯伦', 'LAL', 23924], ['nba-rebounds-2', '比尔·拉塞尔', 'BOS', 21620],
      ['nba-rebounds-3', '卡里姆·阿卜杜尔-贾巴尔', 'LAL', 17440], ['nba-rebounds-4', '埃尔文·海耶斯', 'HOU', 16279],
      ['nba-rebounds-5', '摩西·马龙', 'PHI', 16212], ['nba-rebounds-6', '蒂姆·邓肯', 'SAS', 15091],
      ['nba-rebounds-7', '卡尔·马龙', 'UTA', 14968], ['nba-rebounds-8', '罗伯特·帕里什', 'BOS', 14715],
      ['nba-rebounds-9', '凯文·加内特', 'MIN', 14662], ['nba-rebounds-10', '德怀特·霍华德', 'ORL', 14627]
    ],
    assists: [
      ['nba-assists-1', '约翰·斯托克顿', 'UTA', 15806], ['nba-assists-2', '克里斯·保罗', 'LAC', 12552],
      ['nba-assists-3', '贾森·基德', 'DAL', 12091], ['nba-assists-4', '勒布朗·詹姆斯', 'LAL', 12016],
      ['nba-assists-5', '拉塞尔·威斯布鲁克', 'SAC', 10351], ['nba-assists-6', '史蒂夫·纳什', 'PHX', 10335],
      ['nba-assists-7', '马克·杰克逊', 'IND', 10334], ['nba-assists-8', '魔术师·约翰逊', 'LAL', 10141],
      ['nba-assists-9', '奥斯卡·罗伯特森', 'CIN', 9887], ['nba-assists-10', '伊塞亚·托马斯', 'DET', 9061]
    ],
    steals: [
      ['nba-steals-1', '约翰·斯托克顿', 'UTA', 3265], ['nba-steals-2', '克里斯·保罗', 'LAC', 2728],
      ['nba-steals-3', '贾森·基德', 'DAL', 2684], ['nba-steals-4', '迈克尔·乔丹', 'CHI', 2514],
      ['nba-steals-5', '加里·佩顿', 'SEA', 2445], ['nba-steals-6', '莫里斯·奇克斯', 'PHI', 2310],
      ['nba-steals-7', '斯科蒂·皮蓬', 'CHI', 2307], ['nba-steals-8', '克莱德·德雷克斯勒', 'POR', 2207],
      ['nba-steals-9', '哈基姆·奥拉朱旺', 'HOU', 2162], ['nba-steals-10', '阿尔文·罗伯特森', 'SAS', 2112]
    ],
    blocks: [
      ['nba-blocks-1', '哈基姆·奥拉朱旺', 'HOU', 3830], ['nba-blocks-2', '迪肯贝·穆托姆博', 'DEN', 3289],
      ['nba-blocks-3', '卡里姆·阿卜杜尔-贾巴尔', 'LAL', 3189], ['nba-blocks-4', '马克·伊顿', 'UTA', 3064],
      ['nba-blocks-5', '蒂姆·邓肯', 'SAS', 3020], ['nba-blocks-6', '大卫·罗宾逊', 'SAS', 2954],
      ['nba-blocks-7', '帕特里克·尤因', 'NYK', 2894], ['nba-blocks-8', '沙奎尔·奥尼尔', 'LAL', 2732],
      ['nba-blocks-9', '特里·罗林斯', 'ATL', 2542], ['nba-blocks-10', '罗伯特·帕里什', 'BOS', 2361]
    ]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function numberValue(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getState() {
    return typeof STATE !== 'undefined' ? STATE : null;
  }

  function getCareer() {
    var state = getState();
    return state && state.career ? state.career : null;
  }

  function getCurrentDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function getCurrentSeasonNumber() {
    var state = getState();
    var career = getCareer() || {};
    return Math.max(1, numberValue(career.seasonCount) + (state && state._careerSaved ? 0 : 1));
  }

  function getCurrentSeasonName() {
    if (typeof root.getCurrentSeasonLabel === 'function') return root.getCurrentSeasonLabel();
    return '第' + getCurrentSeasonNumber() + '赛季';
  }

  function getPlayerId(career) {
    var state = getState() || {};
    if (!career.legacyPlayerId) {
      var seed = state.gameId || [state.playerName || 'player', career.seasonCount || 0, career.currentAge || 0].join(':');
      career.legacyPlayerId = 'career-player:' + String(seed);
    }
    return career.legacyPlayerId;
  }

  function getPlayerName(state) {
    if (typeof root.getMyPlayerDisplayName === 'function') return root.getMyPlayerDisplayName();
    return (state && state.playerName) || '我的球员';
  }

  function buildBaseline(category) {
    return (BASELINE_RECORDS[category] || []).map(function(row, index) {
      return {
        playerId: row[0],
        playerName: row[1],
        teamId: row[2],
        value: row[3],
        season: 'NBA 常规赛 · 截至 2025-26',
        date: null,
        source: 'NBA 官方常规赛历史统计',
        baselineOrder: index + 1
      };
    });
  }

  function createDefaultCareerLegacyRecords() {
    var categories = {};
    Object.keys(CATEGORY_CONFIG).forEach(function(category) {
      categories[category] = buildBaseline(category);
    });
    return {
      version: LEGACY_VERSION,
      baselineLabel: 'NBA 官方常规赛历史统计 · 数据截至 2025-26 赛季结束',
      categories: categories,
      milestones: {
        fourOneOne: {
          pointsTarget: 40000,
          reboundsTarget: 10000,
          assistsTarget: 10000,
          achieved: false,
          achievedAt: null,
          components: {
            points: { achieved: false, achievedAt: null },
            rebounds: { achieved: false, achievedAt: null },
            assists: { achieved: false, achievedAt: null }
          }
        }
      },
      triggeredEventIds: {},
      processedGameIds: {},
      events: [],
      badges: []
    };
  }

  function normalizeRecord(record) {
    if (!record || typeof record !== 'object') return null;
    if (!record.playerId) return null;
    return {
      playerId: String(record.playerId),
      playerName: String(record.playerName || '未知球员'),
      teamId: String(record.teamId || ''),
      value: Math.max(0, numberValue(record.value)),
      season: record.season || 'NBA 常规赛 · 截至 2025-26',
      date: record.date || null,
      source: record.source || '历史预置',
      baselineOrder: numberValue(record.baselineOrder) || undefined
    };
  }

  function normalizeCategory(records, category) {
    var byPlayerId = {};
    (Array.isArray(records) ? records : []).forEach(function(item) {
      var row = normalizeRecord(item);
      if (!row) return;
      // v1 的原创联盟基准不能与真实 NBA 基准并存；玩家自身累计记录仍会保留。
      if (row.playerId.indexOf('legacy-') === 0) return;
      var previous = byPlayerId[row.playerId];
      if (!previous || row.value > previous.value || (row.value === previous.value && row.baselineOrder < previous.baselineOrder)) {
        byPlayerId[row.playerId] = row;
      }
    });
    buildBaseline(category).forEach(function(row) {
      if (!byPlayerId[row.playerId]) byPlayerId[row.playerId] = row;
    });
    return Object.keys(byPlayerId).map(function(playerId) { return byPlayerId[playerId]; }).sort(function(a, b) {
      if (b.value !== a.value) return b.value - a.value;
      return a.playerId.localeCompare(b.playerId);
    }).slice(0, RANKING_LIMIT);
  }

  function buildArchivedTotals(career) {
    var totals = {};
    Object.keys(CATEGORY_CONFIG).forEach(function(category) {
      totals[CATEGORY_CONFIG[category].field] = 0;
    });
    (career.seasons || []).forEach(function(season) {
      var stats = (season && season.playerStats) || {};
      Object.keys(totals).forEach(function(field) { totals[field] += numberValue(stats[field]); });
    });
    return totals;
  }

  function ensureCareerTotalStats(career) {
    var current = career.totalStats;
    if (!current || typeof current !== 'object') {
      career.totalStats = buildArchivedTotals(career);
      return career.totalStats;
    }
    var archived = buildArchivedTotals(career);
    var hasArchivedSeasons = (career.seasons || []).length > 0;
    var allZero = Object.keys(CATEGORY_CONFIG).every(function(category) {
      return numberValue(current[CATEGORY_CONFIG[category].field]) === 0;
    });
    if (hasArchivedSeasons && allZero) {
      Object.keys(archived).forEach(function(field) { current[field] = archived[field]; });
    }
    return current;
  }

  function getCareerTotals() {
    var state = getState() || {};
    var career = getCareer() || {};
    var savedTotals = ensureCareerTotalStats(career);
    var totals = {};
    Object.keys(CATEGORY_CONFIG).forEach(function(category) {
      var field = CATEGORY_CONFIG[category].field;
      totals[field] = numberValue(savedTotals[field]);
      if (!state._careerSaved && state.season && state.season.playerStats) {
        totals[field] += numberValue(state.season.playerStats[field]);
      }
    });
    return totals;
  }

  function getCurrentMeta(context) {
    var state = getState() || {};
    var contextData = context || {};
    return {
      season: contextData.season || getCurrentSeasonName(),
      date: contextData.date || getCurrentDate(),
      teamId: contextData.teamId || state.careerTeam || '',
      gameId: contextData.gameId || null
    };
  }

  function upsertPlayerRecord(records, category, career, totals, meta) {
    var config = CATEGORY_CONFIG[category];
    var playerId = getPlayerId(career);
    var list = (records.categories[category] || []).filter(function(row) { return row.playerId !== playerId; });
    var value = numberValue(totals[config.field]);
    if (value > 0) {
      list.push({
        playerId: playerId,
        playerName: getPlayerName(getState()),
        teamId: meta.teamId,
        value: value,
        season: meta.season,
        date: meta.date,
        source: career.retired ? '退役' : '现役'
      });
    }
    records.categories[category] = normalizeCategory(list, category);
    return records.categories[category];
  }

  function getPlayerRank(rows, playerId) {
    for (var index = 0; index < rows.length; index++) {
      if (rows[index].playerId === playerId) return index + 1;
    }
    return 0;
  }

  function ensureFourOneOneShape(records) {
    var defaultMilestone = createDefaultCareerLegacyRecords().milestones.fourOneOne;
    var milestone = records.milestones && records.milestones.fourOneOne;
    if (!milestone || typeof milestone !== 'object') {
      records.milestones = records.milestones || {};
      records.milestones.fourOneOne = clone(defaultMilestone);
      return records.milestones.fourOneOne;
    }
    ['pointsTarget', 'reboundsTarget', 'assistsTarget'].forEach(function(key) {
      milestone[key] = Math.max(1, numberValue(milestone[key]) || defaultMilestone[key]);
    });
    if (typeof milestone.achieved !== 'boolean') milestone.achieved = false;
    if (!Object.prototype.hasOwnProperty.call(milestone, 'achievedAt')) milestone.achievedAt = null;
    milestone.components = milestone.components || {};
    ['points', 'rebounds', 'assists'].forEach(function(key) {
      var component = milestone.components[key] || {};
      milestone.components[key] = {
        achieved: !!component.achieved,
        achievedAt: component.achievedAt || null
      };
    });
    return milestone;
  }

  function isCategoryRecordEventId(eventId) {
    return /^legacy:(points|rebounds|assists|steals|blocks):/.test(String(eventId || ''));
  }

  function removeCategoryRecordHistory(career, records) {
    records.events = records.events.filter(function(event) {
      return !event || event.kind !== 'category';
    });
    records.badges = records.badges.filter(function(badge) {
      return !badge || !isCategoryRecordEventId(badge.id);
    });
    Object.keys(records.triggeredEventIds).forEach(function(eventId) {
      if (isCategoryRecordEventId(eventId)) delete records.triggeredEventIds[eventId];
    });
    career.honors = (career.honors || []).filter(function(honor) {
      return !honor || !isCategoryRecordEventId(honor.legacyEventId);
    });
    (career.seasons || []).forEach(function(season) {
      if (!season || !season.events || !Array.isArray(season.events.storyTimeline)) return;
      season.events.storyTimeline = season.events.storyTimeline.filter(function(event) {
        return !event || !isCategoryRecordEventId(event.legacyEventId);
      });
    });
    var state = getState();
    if (state && state.season && state.season.events && Array.isArray(state.season.events.storyTimeline)) {
      state.season.events.storyTimeline = state.season.events.storyTimeline.filter(function(event) {
        return !event || !isCategoryRecordEventId(event.legacyEventId);
      });
    }
  }

  function ensureCareerLegacyRecords(options) {
    options = options || {};
    var career = getCareer();
    if (!career) return null;
    var records = career.legacyRecords;
    if (!records || typeof records !== 'object' || Array.isArray(records)) {
      records = createDefaultCareerLegacyRecords();
      career.legacyRecords = records;
    }
    var shouldMigrateToNbaBaseline = numberValue(records.version) < LEGACY_VERSION;
    records.categories = records.categories || {};
    Object.keys(CATEGORY_CONFIG).forEach(function(category) {
      records.categories[category] = normalizeCategory(records.categories[category], category);
    });
    records.version = LEGACY_VERSION;
    records.baselineLabel = 'NBA 官方常规赛历史统计 · 数据截至 2025-26 赛季结束';
    records.triggeredEventIds = records.triggeredEventIds && typeof records.triggeredEventIds === 'object' ? records.triggeredEventIds : {};
    records.processedGameIds = records.processedGameIds && typeof records.processedGameIds === 'object' ? records.processedGameIds : {};
    records.events = Array.isArray(records.events) ? records.events : [];
    records.badges = Array.isArray(records.badges) ? records.badges : [];
    ensureFourOneOneShape(records);

    if (shouldMigrateToNbaBaseline) {
      // v1 原创榜单和 v2 前五榜的名次、勋章、荣誉无法代表当前 NBA 前十榜，应清除。
      // 411 与其他非排名型生涯里程碑仍保持原样。
      removeCategoryRecordHistory(career, records);
    }

    if (options.reconcile !== false) {
      var totals = getCareerTotals();
      var meta = getCurrentMeta(options);
      Object.keys(CATEGORY_CONFIG).forEach(function(category) {
        upsertPlayerRecord(records, category, career, totals, meta);
      });
    }
    return records;
  }

  function addTimelineEvent(event) {
    var state = getState();
    if (!state || !state.season || !state.season.events || !Array.isArray(state.season.events.storyTimeline)) return;
    var timeline = state.season.events.storyTimeline;
    if (timeline.some(function(item) { return item && item.legacyEventId === event.id; })) return;
    timeline.push({
      legacyEventId: event.id,
      gameNum: (state.season.games || []).length,
      title: event.title,
      desc: event.desc,
      emoji: event.emoji || '🏛️'
    });
  }

  function addBadge(records, event) {
    if (records.badges.some(function(badge) { return badge && badge.id === event.id; })) return;
    records.badges.push({
      id: event.id,
      label: event.badgeLabel || event.title,
      emoji: event.emoji || '🏛️',
      season: event.season,
      date: event.date,
      tier: event.tier
    });
  }

  function addHonor(event) {
    if (event.tier !== 'top3' && event.tier !== 'first' && event.tier !== 'fourOneOne') return;
    var career = getCareer();
    if (!career) return;
    career.honors = Array.isArray(career.honors) ? career.honors : [];
    if (career.honors.some(function(honor) { return honor && honor.legacyEventId === event.id; })) return;
    career.honors.push({
      seasonNum: getCurrentSeasonNumber(),
      label: event.honorLabel || event.title,
      emoji: event.emoji || '🏛️',
      legacyEventId: event.id,
      source: 'legacy'
    });
  }

  function createLegacyEvent(records, event) {
    if (records.triggeredEventIds[event.id]) return null;
    records.triggeredEventIds[event.id] = {
      season: event.season,
      date: event.date,
      gameId: event.gameId || null
    };
    records.events.push(event);
    if (records.events.length > 120) records.events = records.events.slice(-120);
    addTimelineEvent(event);
    addBadge(records, event);
    addHonor(event);
    return event;
  }

  function createCategoryEvent(records, category, tier, rank, previousRank, previousHolder, meta, career, totals) {
    var playerId = getPlayerId(career);
    var config = CATEGORY_CONFIG[category];
    var label = config.shortLabel;
    var tierText = tier === 'top10' ? '跻身历史前十' : (tier === 'top3' ? '杀入历史前三' : '登顶历史第一');
    var holderText = previousHolder && previousHolder.playerName ? '，超越 ' + previousHolder.playerName : '';
    return createLegacyEvent(records, {
      id: 'legacy:' + category + ':' + tier + ':' + playerId,
      kind: 'category',
      tier: tier,
      category: category,
      value: numberValue(totals[config.field]),
      rank: rank,
      previousRank: previousRank || 0,
      previousHolder: previousHolder ? {
        playerId: previousHolder.playerId,
        playerName: previousHolder.playerName,
        value: previousHolder.value
      } : null,
      season: meta.season,
      date: meta.date,
      teamId: meta.teamId,
      gameId: meta.gameId,
      title: '历史' + label + '榜' + tierText,
      desc: '生涯常规赛累计 ' + numberValue(totals[config.field]) + ' ' + label + '，当前位列联盟历史第 ' + rank + ' 名' + holderText + '。',
      emoji: tier === 'first' ? '👑' : (tier === 'top3' ? '🏅' : '📈'),
      badgeLabel: '历史' + label + (tier === 'first' ? '第一' : (tier === 'top3' ? '前三' : '前十')),
      honorLabel: tier === 'first' ? '联盟历史' + label + '第一' : '历史' + label + '榜前三'
    });
  }

  function checkFourOneOne(records, career, totals, meta) {
    var milestone = ensureFourOneOneShape(records);
    var playerId = getPlayerId(career);
    var configs = [
      { key: 'points', field: 'pts', targetKey: 'pointsTarget', label: '40000 分' },
      { key: 'rebounds', field: 'reb', targetKey: 'reboundsTarget', label: '10000 篮板' },
      { key: 'assists', field: 'ast', targetKey: 'assistsTarget', label: '10000 助攻' }
    ];
    var events = [];
    configs.forEach(function(config) {
      var component = milestone.components[config.key];
      var target = numberValue(milestone[config.targetKey]);
      if (numberValue(totals[config.field]) < target || component.achieved) return;
      component.achieved = true;
      component.achievedAt = { season: meta.season, date: meta.date, gameId: meta.gameId || null, teamId: meta.teamId };
      var event = createLegacyEvent(records, {
        id: 'legacy:411:' + config.key + ':' + playerId,
        kind: 'fourOneOne-component',
        tier: 'milestone',
        category: config.key,
        value: numberValue(totals[config.field]),
        target: target,
        season: meta.season,
        date: meta.date,
        teamId: meta.teamId,
        gameId: meta.gameId,
        title: '411 工程完成 ' + config.label,
        desc: '生涯常规赛累计达到 ' + numberValue(totals[config.field]) + '，411 工程再完成一项。',
        emoji: '✨',
        badgeLabel: '411 工程 · ' + config.label
      });
      if (event) events.push(event);
    });

    var allComplete = configs.every(function(config) { return milestone.components[config.key].achieved; });
    if (allComplete && !milestone.achieved) {
      milestone.achieved = true;
      milestone.achievedAt = { season: meta.season, date: meta.date, gameId: meta.gameId || null, teamId: meta.teamId };
      var finalEvent = createLegacyEvent(records, {
        id: 'legacy:411:complete:' + playerId,
        kind: 'fourOneOne',
        tier: 'fourOneOne',
        season: meta.season,
        date: meta.date,
        teamId: meta.teamId,
        gameId: meta.gameId,
        title: '411 工程全部达成',
        desc: '你完成了 40000 分、10000 篮板、10000 助攻的传奇三项工程。',
        emoji: '🌟',
        badgeLabel: '411 传奇工程',
        honorLabel: '411 工程 · 联盟传奇'
      });
      if (finalEvent) events.push(finalEvent);
    }
    return events;
  }

  function recordCareerLegacyAfterRegularGame(context) {
    var career = getCareer();
    if (!career) return { events: [], records: null };
    var meta = getCurrentMeta(context);
    var records = ensureCareerLegacyRecords({ reconcile: false });
    if (!records) return { events: [], records: null };
    if (meta.gameId && records.processedGameIds[meta.gameId]) return { events: [], records: records, skipped: true };

    var playerId = getPlayerId(career);
    var before = {};
    Object.keys(CATEGORY_CONFIG).forEach(function(category) {
      before[category] = (records.categories[category] || []).slice();
    });
    var totals = getCareerTotals();
    var events = [];
    Object.keys(CATEGORY_CONFIG).forEach(function(category) {
      var previousRank = getPlayerRank(before[category], playerId);
      var afterRows = upsertPlayerRecord(records, category, career, totals, meta);
      var nextRank = getPlayerRank(afterRows, playerId);
      var thresholds = [
        { tier: 'top10', maxRank: RANKING_LIMIT },
        { tier: 'top3', maxRank: 3 },
        { tier: 'first', maxRank: 1 }
      ];
      thresholds.forEach(function(threshold) {
        if (!nextRank || nextRank > threshold.maxRank || (previousRank && previousRank <= threshold.maxRank)) return;
        var previousHolder = before[category][threshold.maxRank - 1] || null;
        var event = createCategoryEvent(records, category, threshold.tier, nextRank, previousRank, previousHolder, meta, career, totals);
        if (event) events.push(event);
      });
    });
    events = events.concat(checkFourOneOne(records, career, totals, meta));
    if (meta.gameId) records.processedGameIds[meta.gameId] = { date: meta.date, season: meta.season };
    if (!context || !context.silent) queueLegacyFeedback(events);
    return { events: events, records: records };
  }

  function prefersReducedMotion() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function injectLegacyStyles() {
    if (!root.document || root.document.getElementById('career-legacy-styles')) return;
    var style = root.document.createElement('style');
    style.id = 'career-legacy-styles';
    style.textContent = '' +
      '.legacy-hall{display:flex;flex-direction:column;gap:10px}.legacy-note{font-size:11px;line-height:1.55;color:var(--text-dim);padding:9px 10px;border:1px solid var(--border);border-radius:10px;background:var(--bg-card)}.legacy-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}.legacy-tabs button{white-space:nowrap;border:1px solid var(--border);border-radius:999px;padding:7px 10px;background:var(--bg-card);color:var(--text);font:700 11px var(--font-body);cursor:pointer}.legacy-tabs button.active{background:var(--orange);border-color:var(--orange);color:var(--on-accent)}.legacy-rank-list{display:flex;flex-direction:column;gap:6px}.legacy-rank-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--bg-card)}.legacy-rank-row.me{border-color:var(--orange);background:var(--orange-bg)}.legacy-rank-number{font:800 17px var(--font-display);color:var(--text-dim)}.legacy-rank-row.me .legacy-rank-number{color:var(--orange)}.legacy-rank-name{font-size:13px;font-weight:800;color:var(--text)}.legacy-rank-meta{margin-top:2px;font-size:10px;color:var(--text-dim)}.legacy-rank-value{font:800 17px var(--font-display);color:var(--orange);text-align:right}.legacy-player-status{padding:10px;border-radius:10px;background:var(--bg-card);font-size:12px;line-height:1.6;color:var(--text-dim)}.legacy-player-status strong{color:var(--text)}.legacy-progress{display:flex;flex-direction:column;gap:8px}.legacy-progress-row{padding:9px 10px;border:1px solid var(--border);border-radius:10px;background:var(--bg-card)}.legacy-progress-head{display:flex;justify-content:space-between;gap:10px;font-size:12px;font-weight:700}.legacy-progress-track{height:7px;margin-top:7px;background:var(--border);border-radius:999px;overflow:hidden}.legacy-progress-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--orange),var(--gold))}.legacy-timeline{display:flex;flex-direction:column;gap:7px}.legacy-event{padding:9px 10px;border-left:3px solid var(--orange);background:var(--bg-card);border-radius:0 9px 9px 0}.legacy-event-title{font-size:12px;font-weight:800;color:var(--text)}.legacy-event-copy{margin-top:3px;color:var(--text-dim);font-size:11px;line-height:1.5}.legacy-badges{display:flex;flex-wrap:wrap;gap:6px}.legacy-badge{padding:6px 8px;border:1px solid var(--orange-dim);border-radius:999px;background:var(--orange-bg);font-size:11px;font-weight:700;color:var(--text)}.legacy-toast{position:fixed;right:16px;bottom:84px;z-index:800;max-width:min(360px,calc(100vw - 32px));padding:10px 12px;border:1px solid var(--orange);border-radius:12px;background:var(--bg-card);box-shadow:var(--shadow-lg);animation:legacy-pop .22s ease}.legacy-toast button{border:0;background:transparent;color:var(--text-dim);float:right;font-size:16px;cursor:pointer}.legacy-toast strong{display:block;font-size:13px;color:var(--text)}.legacy-toast span{display:block;margin-top:2px;font-size:11px;color:var(--text-dim);line-height:1.4}.legacy-celebration{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,10,16,.76);backdrop-filter:blur(5px)}.legacy-celebration-card{width:min(420px,100%);padding:25px 20px;border:2px solid var(--gold);border-radius:18px;background:var(--bg);text-align:center;box-shadow:0 18px 60px rgba(0,0,0,.42);animation:legacy-celebrate .45s cubic-bezier(.16,1,.3,1)}.legacy-celebration-icon{font-size:45px}.legacy-celebration-title{margin-top:8px;font:800 22px var(--font-display);color:var(--gold)}.legacy-celebration-copy{margin:10px 0 18px;font-size:13px;line-height:1.65;color:var(--text-dim)}.legacy-celebration-actions{display:flex;gap:8px;justify-content:center}.legacy-celebration-actions button{min-height:38px;border:1px solid var(--border);border-radius:9px;padding:8px 12px;background:var(--bg-card);color:var(--text);font-weight:700;cursor:pointer}.legacy-celebration-actions .primary{background:var(--orange);border-color:var(--orange);color:var(--on-accent)}@keyframes legacy-pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes legacy-celebrate{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}@media (prefers-reduced-motion:reduce){.legacy-toast,.legacy-celebration-card{animation:none!important}}';
    root.document.head.appendChild(style);
  }

  function closeLegacyCelebration() {
    if (!root.document) return;
    var overlay = root.document.getElementById('legacy-celebration-overlay');
    if (overlay) overlay.remove();
  }

  function showLegacyToast(event) {
    if (!root.document) return;
    var oldToast = root.document.getElementById('legacy-record-toast');
    if (oldToast) oldToast.remove();
    var toast = root.document.createElement('div');
    toast.id = 'legacy-record-toast';
    toast.className = 'legacy-toast';
    toast.innerHTML = '<button type="button" aria-label="关闭" onclick="this.parentNode.remove()">×</button><strong>' + escapeHtml(event.emoji + ' ' + event.title) + '</strong><span>' + escapeHtml(event.desc) + '</span>';
    root.document.body.appendChild(toast);
    root.setTimeout(function() { if (toast.parentNode) toast.remove(); }, prefersReducedMotion() ? 2200 : 5200);
  }

  function showLegacyCelebration(event) {
    if (!root.document) return;
    closeLegacyCelebration();
    var overlay = root.document.createElement('div');
    overlay.id = 'legacy-celebration-overlay';
    overlay.className = 'legacy-celebration';
    overlay.innerHTML = '<div class="legacy-celebration-card" role="dialog" aria-modal="true" aria-label="生涯纪录事件">' +
      '<div class="legacy-celebration-icon">' + escapeHtml(event.emoji || '🏛️') + '</div>' +
      '<div class="legacy-celebration-title">' + escapeHtml(event.title) + '</div>' +
      '<div class="legacy-celebration-copy">' + escapeHtml(event.desc) + '</div>' +
      '<div class="legacy-celebration-actions"><button type="button" onclick="closeLegacyCelebration()">跳过</button><button type="button" class="primary" onclick="closeLegacyCelebration();showCareerStats(3)">查看历史殿堂</button></div></div>';
    root.document.body.appendChild(overlay);
  }

  function queueLegacyFeedback(events) {
    if (!events || !events.length || !root.document) return;
    var priority = { top10: 1, milestone: 1, top3: 2, first: 3, fourOneOne: 4 };
    var event = events.slice().sort(function(a, b) { return (priority[b.tier] || 0) - (priority[a.tier] || 0); })[0];
    root.setTimeout(function() {
      if (event.tier === 'first' || event.tier === 'fourOneOne') showLegacyCelebration(event);
      else showLegacyToast(event);
    }, 0);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function(char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
    });
  }

  function formatValue(value) {
    return Math.round(numberValue(value)).toLocaleString('zh-CN');
  }

  function getPlayerStatus(records, category, career, totals) {
    var config = CATEGORY_CONFIG[category];
    var rows = records.categories[category] || [];
    var playerId = getPlayerId(career);
    var rank = getPlayerRank(rows, playerId);
    var value = numberValue(totals[config.field]);
    if (rank) {
      if (rank === 1) return '你的生涯常规赛累计为 <strong>' + formatValue(value) + '</strong>，当前位列历史第一。';
      var previous = rows[rank - 2];
      return '你的生涯常规赛累计为 <strong>' + formatValue(value) + '</strong>，当前第 <strong>' + rank + '</strong> 名，距上一名还差 <strong>' + formatValue(Math.max(0, previous.value - value + 1)) + '</strong>。';
    }
    var fifth = rows[4];
    var gap = fifth ? Math.max(0, fifth.value - value + 1) : 0;
    return '你的生涯常规赛累计为 <strong>' + formatValue(value) + '</strong>，暂未入榜，距历史第五还差 <strong>' + formatValue(gap) + '</strong>。';
  }

  function renderFourOneOne(records, totals) {
    var milestone = ensureFourOneOneShape(records);
    var rows = [
      { key: 'points', field: 'pts', target: milestone.pointsTarget, label: '40000 分' },
      { key: 'rebounds', field: 'reb', target: milestone.reboundsTarget, label: '10000 篮板' },
      { key: 'assists', field: 'ast', target: milestone.assistsTarget, label: '10000 助攻' }
    ];
    var html = '<div class="sr-section cs-section"><div class="sr-section-title">🌟 411 工程' + (milestone.achieved ? ' · 已达成' : '') + '</div><div class="legacy-progress">';
    rows.forEach(function(row) {
      var value = numberValue(totals[row.field]);
      var percent = Math.min(100, Math.round(value / row.target * 100));
      var component = milestone.components[row.key];
      var achievedText = component.achieved ? ' ✅' : '';
      html += '<div class="legacy-progress-row"><div class="legacy-progress-head"><span>' + row.label + achievedText + '</span><span>' + formatValue(value) + ' / ' + formatValue(row.target) + '</span></div><div class="legacy-progress-track"><div class="legacy-progress-fill" style="width:' + percent + '%"></div></div></div>';
    });
    html += '</div>';
    if (milestone.achievedAt) html += '<div class="legacy-event-copy" style="margin-top:8px;">达成于 ' + escapeHtml(milestone.achievedAt.season || '') + ' · ' + escapeHtml(milestone.achievedAt.date || '') + '</div>';
    html += '</div>';
    return html;
  }

  function renderCareerLegacyHall() {
    var career = getCareer();
    if (!career) return '';
    var records = ensureCareerLegacyRecords({ silent: true });
    var totals = getCareerTotals();
    var state = getState() || {};
    var category = CATEGORY_CONFIG[state._legacyHallCategory] ? state._legacyHallCategory : 'points';
    var config = CATEGORY_CONFIG[category];
    var playerId = getPlayerId(career);
    var html = '<div class="legacy-hall">';
    html += '<div class="legacy-note">🏛️ ' + escapeHtml(records.baselineLabel) + '。榜单与进度按生涯<strong>常规赛累计</strong>计算，季后赛数据单独保存且不计入本页。</div>';
    html += '<div class="legacy-tabs" role="tablist" aria-label="历史榜单分类">';
    Object.keys(CATEGORY_CONFIG).forEach(function(key) {
      html += '<button type="button" class="' + (key === category ? 'active' : '') + '" onclick="setCareerLegacyHallCategory(\'' + key + '\')">' + CATEGORY_CONFIG[key].label + '</button>';
    });
    html += '</div>';
    html += '<div class="sr-section cs-section"><div class="sr-section-title">🏆 联盟历史 ' + config.label + ' 前十</div><div class="legacy-rank-list">';
    (records.categories[category] || []).forEach(function(row, index) {
      var mine = row.playerId === playerId;
      html += '<div class="legacy-rank-row' + (mine ? ' me' : '') + '"><span class="legacy-rank-number">' + (index + 1) + '</span><div><div class="legacy-rank-name">' + escapeHtml(row.playerName) + (mine ? ' · 你' : '') + '</div><div class="legacy-rank-meta">' + escapeHtml(row.source || '') + (row.season ? ' · ' + escapeHtml(row.season) : '') + '</div></div><span class="legacy-rank-value">' + formatValue(row.value) + '</span></div>';
    });
    html += '</div><div class="legacy-player-status">' + getPlayerStatus(records, category, career, totals) + '</div></div>';
    html += renderFourOneOne(records, totals);

    var events = records.events.slice().reverse().slice(0, 12);
    html += '<div class="sr-section cs-section"><div class="sr-section-title">🗞️ 最近纪录事件</div><div class="legacy-timeline">';
    if (!events.length) html += '<div class="legacy-event-copy">还没有纪录事件，第一场正式比赛后会开始追踪。</div>';
    events.forEach(function(event) {
      var meta = [event.season, event.date].filter(Boolean).join(' · ');
      html += '<div class="legacy-event"><div class="legacy-event-title">' + escapeHtml((event.emoji || '🏛️') + ' ' + event.title) + '</div><div class="legacy-event-copy">' + escapeHtml(event.desc) + (meta ? '<br>' + escapeHtml(meta) : '') + '</div></div>';
    });
    html += '</div></div>';

    html += '<div class="sr-section cs-section"><div class="sr-section-title">🎖️ 纪录与传奇勋章</div><div class="legacy-badges">';
    if (!records.badges.length) html += '<span class="legacy-event-copy">尚未获得纪录勋章</span>';
    records.badges.forEach(function(badge) {
      html += '<span class="legacy-badge">' + escapeHtml((badge.emoji || '🏛️') + ' ' + badge.label) + '</span>';
    });
    html += '</div></div></div>';
    return html;
  }

  function setCareerLegacyHallCategory(category) {
    var state = getState();
    if (!state || !CATEGORY_CONFIG[category]) return;
    state._legacyHallCategory = category;
    if (typeof root.showCareerStats === 'function') root.showCareerStats(3);
  }

  function reconcileCareerLegacyRecords(options) {
    return ensureCareerLegacyRecords(options || {});
  }

  function installFreshCareerDefaults() {
    if (typeof root.createFreshCareer !== 'function' || root.createFreshCareer._legacyRecordsWrapped) return;
    var original = root.createFreshCareer;
    var wrapped = function() {
      var career = original.apply(this, arguments);
      career.legacyRecords = createDefaultCareerLegacyRecords();
      return career;
    };
    wrapped._legacyRecordsWrapped = true;
    root.createFreshCareer = wrapped;
  }

  root.createDefaultCareerLegacyRecords = createDefaultCareerLegacyRecords;
  root.ensureCareerLegacyRecords = ensureCareerLegacyRecords;
  root.reconcileCareerLegacyRecords = reconcileCareerLegacyRecords;
  root.recordCareerLegacyAfterRegularGame = recordCareerLegacyAfterRegularGame;
  root.renderCareerLegacyHall = renderCareerLegacyHall;
  root.setCareerLegacyHallCategory = setCareerLegacyHallCategory;
  root.closeLegacyCelebration = closeLegacyCelebration;
  root.CareerLegacy = {
    createDefaultRecords: createDefaultCareerLegacyRecords,
    ensure: ensureCareerLegacyRecords,
    reconcile: reconcileCareerLegacyRecords,
    recordRegularGame: recordCareerLegacyAfterRegularGame,
    getCareerTotals: getCareerTotals,
    getPlayerRank: getPlayerRank,
    renderHall: renderCareerLegacyHall
  };

  injectLegacyStyles();
  installFreshCareerDefaults();
})(typeof window !== 'undefined' ? window : globalThis);
