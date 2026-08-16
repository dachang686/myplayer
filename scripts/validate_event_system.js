const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const playoffsSource = fs.readFileSync(path.join(root, 'js', 'playoffs.js'), 'utf8');

const failures = [];
const inlineScripts = [...indexSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(Boolean);

inlineScripts.forEach((source, index) => {
  try {
    parser.parse(source, { sourceType: 'script', plugins: ['optionalChaining'] });
  } catch (error) {
    failures.push(`第 ${index + 1} 个内联脚本无法解析：${error.message}`);
  }
});

const stateStart = indexSource.indexOf('function createSeasonEventState');
const stateEnd = indexSource.indexOf('// 每个赛季内页面只在这里声明', stateStart);
if (stateStart < 0 || stateEnd < 0) {
  failures.push('无法定位赛季事件状态兼容层');
} else {
  const state = { season: { events: { version: 6, injuryGamesLeft: 3, playerUnavailableGames: 2, storyTimeline: [{ id: 'legacy' }] } } };
  const stateFns = new Function(
    'STATE',
    `${indexSource.slice(stateStart, stateEnd)}\nreturn { createSeasonEventState, ensureSeasonEventState };`,
  )(state);
  const repaired = stateFns.ensureSeasonEventState();
  if (repaired.injuryGamesLeft !== 3 || repaired.storyTimeline.length !== 1) {
    failures.push('旧存档事件数据在兼容修复时被覆盖');
  }
  if (repaired.playerInjuryMissedGames !== 2 || repaired.playerSuspensionMissedGames !== 0) {
    failures.push('旧存档总缺席数没有保守迁移到新的伤病/禁赛计数结构');
  }
  for (const key of ['lastTriggerByLane', 'eventCounts', 'opponentHistory', 'activeEffects', 'lastActiveEffectTickKey', 'careerTeamGamesPlayed', 'playerUnavailableGames', 'playerInjuryMissedGames', 'playerSuspensionMissedGames', 'storyThreads', 'storySignals', 'directorEvents', 'narrativeSeasonFinalized']) {
    if (!Object.prototype.hasOwnProperty.call(repaired, key)) failures.push(`旧存档没有补齐事件字段 ${key}`);
  }
}

const registryStart = indexSource.indexOf('var EVENT_REGISTRY = []');
const registryEnd = indexSource.indexOf('</script>', registryStart);
if (registryStart < 0 || registryEnd < 0) {
  failures.push('无法定位随机事件脚本');
} else {
  const state = {
    finalOVR: 88,
    careerTeam: 'HOME',
    career: { seasonCount: 1, currentAge: 28, contract: 2, profile: {}, flags: {}, seasons: [] },
    season: {
      games: [{ game: { opponent: 'AWAY' } }],
      wins: 1,
      losses: 0,
      isPlayoffs: false,
      playoffStats: { games: 0 },
      events: {
        suspensionGamesLeft: 0,
        injuryGamesLeft: 0,
        triggeredIds: [],
        storyTimeline: [],
        injuryRiskBonus: 0,
      },
    },
  };
  const profile = () => state.career.profile;
  const addProfileDelta = (key, delta) => {
    state.career.profile[key] = (state.career.profile[key] || 0) + delta;
    return state.career.profile[key];
  };
  const createEventState = injuryRiskBonus => ({
    version: 7,
    suspensionGamesLeft: 0, suspensionReason: '', injuryGamesLeft: 0, injuryReason: '',
    triggeredIds: [], storyTimeline: [], lastTriggerGameNum: null, lastTriggerByLane: {}, eventCounts: {},
    playoffEventCount: 0, injuryRiskBonus: Number(injuryRiskBonus) || 0, majorInjuryThisSeason: false,
    playThroughPrompted: {}, regularPlayThroughPromptCount: 0, opponentHistory: {}, activeEffects: [],
    lastActiveEffectTickKey: null, careerTeamGamesPlayed: 0, playerUnavailableGames: 0,
    playerInjuryMissedGames: 0, playerSuspensionMissedGames: 0,
    seasonTheme: null, storyThreads: [],
    storySignals: { games: 0, wins: 0, losses: 0, winStreak: 0, lossStreak: 0, standoutStreak: 0, closeGames: 0, lastOpponent: null },
    directorEvents: [], narrativeSeasonFinalized: false,
  });
  const ensureEventState = () => {
    const current = state.season.events || {};
    const defaults = createEventState(current.injuryRiskBonus || 0);
    for (const [key, value] of Object.entries(defaults)) {
      if (current[key] == null) current[key] = value;
    }
    state.season.events = current;
    return current;
  };
  const leagueData = {
    HOME: [{ id: 'home-star', cname: '故事队友', ovr: 87 }, { id: 'home-wing', cname: '轮换队友', ovr: 82 }],
    AWAY: [{ id: 'active-rival', cname: '现役宿敌', ovr: 90 }],
  };
  const eventModule = new Function(
    'window',
    'STATE',
    'LEAGUE_PLAYER_DATA',
    'addProfileDelta',
    'getCareerProfile',
    'getBondedTeammateName',
    'ensureSeasonEventState',
    `${indexSource.slice(registryStart, registryEnd)}\nreturn { EVENT_REGISTRY, checkRandomEvents, getRandomEventLane, initializeSeasonNarrative, canTriggerEventByLifecycle, recordEventLifecycle, meetsCareerEventIdentity, recordNarrativePlayoffSeries, finalizeSeasonNarrativeAtSeasonEnd, commitDirectorThreadChoice, resolveDirectorThread, getNarrativeThreadOutcome, getSeasonThemeEventWeight, chooseSeasonNarrativeTheme, chooseNarrativeThemeVariant, getSeasonThemeStoryline, getSeasonNarrativeTeammate, getNarrativeFormerTeammates, getDirectorThreadOpening, queueGameDrivenPressureThread, getActiveNarrativeThreadCount, selectNarrativeFormerTeammate, checkSeasonNarrativeDirector, consumeActiveEventEffectsForCareerGame, afterCareerTeamGame, findNarrativePlayer, syncNarrativeReunitedTeammates };`,
  )({}, state, leagueData, addProfileDelta, profile, () => '测试队友', ensureEventState);

  const registry = eventModule.EVENT_REGISTRY;
  leagueData._draftClass2026Applied = true;
  const narrativePlayerWithMetadata = eventModule.findNarrativePlayer('active-rival');
  if (!narrativePlayerWithMetadata || narrativePlayerWithMetadata.team !== 'AWAY') {
    failures.push('叙事球员查找无法跳过联盟名单元数据字段');
  }
  const ids = registry.map(event => event.id);
  if (registry.length < 98) failures.push(`事件数量不足：${registry.length}`);
  if (new Set(ids).size !== ids.length) failures.push('事件 ID 存在重复');

  const requiredCareerEvents = [
    'career_rivalry_spark',
    'career_rivalry_rematch',
    'career_coach_role_meeting',
    'career_trade_deadline_rumor',
    'career_playoff_adjustment',
    'career_major_injury_comeback',
    'career_award_race_pressure',
  ];
  for (const id of requiredCareerEvents) {
    const event = registry.find(item => item.id === id);
    if (!event) failures.push(`缺少职业剧情事件 ${id}`);
    else if (eventModule.getRandomEventLane(event) !== 'career') failures.push(`${id} 未进入职业剧情通道`);
  }

  const rivalryRematch = registry.find(item => item.id === 'career_rivalry_rematch');
  if (rivalryRematch) {
    state.season.games = Array.from({ length: 20 }, () => ({ game: { opponent: 'AWAY' } }));
    state.career.seasonCount = 2;
    state.career.flags = {
      eventRivalry: { playerId: 'retired-rival', team: 'AWAY', sinceGame: 1, sinceSeason: 1 },
    };
    if (rivalryRematch.condition({ game: { opponent: 'AWAY' } })) {
      failures.push('已退役或转会的宿敌仍会触发再次相遇事件');
    }

    state.career.flags.eventRivalry.playerId = 'active-rival';
    if (!rivalryRematch.condition({ game: { opponent: 'AWAY' } })) {
      failures.push('现役且在对手阵容中的宿敌无法触发再次相遇事件');
    }
  }

  const coachRoleMeeting = registry.find(item => item.id === 'career_coach_role_meeting');
  if (coachRoleMeeting) {
    state.season.games = Array.from({ length: 20 }, () => ({ game: { opponent: 'AWAY' } }));
    state.season.isUserStarter = true;
    state.finalOVR = 92;
    state.career.seasonCount = 5;
    state.career.flags = {};
    if (coachRoleMeeting.condition()) failures.push('已建立核心地位的球员仍会触发角色会议');

    state.career.seasonCount = 1;
    state.finalOVR = 78;
    state.season.isUserStarter = false;
    if (!coachRoleMeeting.condition()) failures.push('早期未稳定角色的球员无法触发角色会议');

    state.career.flags = { coachRoleMeetingDone: true };
    if (coachRoleMeeting.condition()) failures.push('已完成的角色会议仍会重复触发');
  }

  // 赛季导演必须在赛季开始时生成主题与 2-4 条长线，并以比赛节点开场、延后结算。
  state.career.seasonCount = 0;
  state.career.currentAge = 22;
  state.career.contract = 3;
  state.career.flags = {};
  state.season.isPlayoffs = false;
  state.season.isUserStarter = false;
  state.season.wins = 0;
  state.season.losses = 0;
  state.season.playerStats = { games: 0, pts: 0, reb: 0, ast: 0 };
  state.season.events = createEventState(0);
  state.season.games = [];
  const narrativeState = eventModule.initializeSeasonNarrative();
  if (!narrativeState.seasonTheme || !narrativeState.seasonTheme.id) failures.push('赛季导演没有生成赛季主题');
  if (narrativeState.storyThreads.length < 2 || narrativeState.storyThreads.length > 4) failures.push('赛季导演没有生成 2-4 条长期悬念');
  const roleThread = narrativeState.storyThreads.find(thread => thread.kind === 'role');
  if (!roleThread) {
    failures.push('新秀赛季没有生成角色成长线');
  } else {
    state.season.games = Array.from({ length: roleThread.openingGame }, () => ({ game: { opponent: 'AWAY' } }));
    const opening = eventModule.checkRandomEvents(
      { opponent: 'AWAY' },
      { won: true, scoreA: 110, scoreB: 106 },
      { pts: 24, reb: 5, ast: 6 },
    );
    if (!opening || opening._eventLane !== 'director' || !Array.isArray(opening.choices)) {
      failures.push('比赛节点没有优先推进赛季导演剧情');
    } else {
      opening.choices[0].apply();
      if (roleThread.state !== 'committed') failures.push('赛季导演选择没有留下未解决矛盾');
      state.season.games = Array.from({ length: roleThread.resolutionGame }, () => ({ game: { opponent: 'AWAY' } }));
      const resolution = eventModule.checkRandomEvents(
        { opponent: 'AWAY' },
        { won: true, scoreA: 112, scoreB: 104 },
        { pts: 26, reb: 6, ast: 7 },
      );
      if (!resolution || resolution._eventLane !== 'director' || roleThread.state !== 'resolved') {
        failures.push('赛季导演没有在后续比赛结算长期悬念');
      }
    }
  }

  // 生命周期：生涯唯一事件不能跨季重抽；可重复花絮至少间隔一个完整赛季。
  state.career.flags = {};
  state.career.seasonCount = 0;
  const careerOnce = { id: 'record_milestone_ball', lane: 'story' };
  eventModule.recordEventLifecycle(careerOnce);
  if (eventModule.canTriggerEventByLifecycle(careerOnce)) failures.push('career_once 事件可在生涯中重复触发');
  const repeatable = { id: 'team_dinner', lane: 'story' };
  eventModule.recordEventLifecycle(repeatable);
  if (eventModule.canTriggerEventByLifecycle(repeatable)) failures.push('repeatable 事件没有阻止相邻赛季重复');
  state.career.seasonCount = 2;
  if (!eventModule.canTriggerEventByLifecycle(repeatable)) failures.push('repeatable 事件经过间隔后无法再次触发');

  // 身份过滤：替补新秀不能进入奖项舆论战，核心球员可以。
  const awardRace = registry.find(item => item.id === 'career_award_race_pressure');
  if (awardRace) {
    state.career.seasonCount = 1;
    state.finalOVR = 78;
    state.career.profile = {};
    state.season.isUserStarter = false;
    if (eventModule.meetsCareerEventIdentity(awardRace)) failures.push('替补新秀错误进入奖项舆论事件');
    state.finalOVR = 92;
    state.career.profile = { fame: 16 };
    state.season.isUserStarter = true;
    if (!eventModule.meetsCareerEventIdentity(awardRace)) failures.push('核心球员被错误排除在奖项舆论事件外');
  }

  // 季后赛系列赛必须为宿敌留下跨赛季结果，而非只保留当场弹窗。
  state.career.flags = { eventRivalry: { team: 'AWAY', playerId: 'active-rival', playerName: '现役宿敌', heat: 1 } };
  state.career.seasonCount = 2;
  eventModule.recordNarrativePlayoffSeries({ isMySeries: true, teamA: 'HOME', teamB: 'AWAY', aWon: false });
  if (state.career.flags.eventRivalry.playoffLosses !== 1 || state.career.flags.eventRivalry.playoffMeetings !== 1) {
    failures.push('季后赛宿敌结果没有写入跨赛季状态');
  }

  // 未结剧情必须被写入 career flags，并在下一季重新变成可结算线程。
  state.career.flags = {};
  state.career.seasonCount = 2;
  state.season = {
    games: Array.from({ length: 80 }, () => ({ game: { opponent: 'AWAY' } })), wins: 42, losses: 38,
    isPlayoffs: false, isUserStarter: true, playerStats: { games: 80, pts: 1600, ast: 400, reb: 400 }, schedule: [],
    events: createEventState(0),
  };
  state.season.events.seasonTheme = { id: 'title', season: 3 };
  state.season.events.storyThreads = [{
    id: 'carry-role', kind: 'role', title: '角色线 Lv2', emoji: '📋', state: 'committed', choice: 'team_first', payload: { level: 2 },
  }];
  eventModule.finalizeSeasonNarrativeAtSeasonEnd();
  if (!state.career.flags.narrativeCarryOvers?.length) failures.push('未结剧情没有写入跨赛季存档');
  state.career.seasonCount = 3;
  state.season.events = createEventState(0);
  const nextSeasonNarrative = eventModule.initializeSeasonNarrative();
  const carriedThread = nextSeasonNarrative.storyThreads.find(thread => thread.carryOver && thread.kind === 'role');
  if (!carriedThread || carriedThread.state !== 'committed' || state.career.flags.narrativeCarryOvers.length) {
    failures.push('跨赛季剧情没有在新赛季恢复为可结算线程');
  }

  // broad theme 必须符合真实身份；连续争冠通过 variant 变化，而不是退回“崭露头角”。
  const playoffAdjustment = registry.find(item => item.id === 'career_playoff_adjustment');
  state.season.events.seasonTheme = { id: 'title' };
  if (playoffAdjustment && eventModule.getSeasonThemeEventWeight(playoffAdjustment) <= playoffAdjustment.weight) {
    failures.push('赛季主题没有改变对应职业事件权重');
  }
  state.career.flags = { seasonThemeHistory: [{ id: 'title', variantId: 'title_all_in', season: 3 }] };
  state.career.currentAge = 28;
  state.career.contract = 3;
  state.finalOVR = 92;
  state.season.isUserStarter = true;
  const repeatedTitleTheme = eventModule.chooseSeasonNarrativeTheme();
  if (repeatedTitleTheme.id !== 'title' || repeatedTitleTheme.variantId === 'title_all_in') {
    failures.push('争冠核心为了防重复被错误降级为不符合身份的主题');
  }
  state.career.flags = {
    seasonCommitment: { outcome: 'fell_short' },
    seasonThemeHistory: [{ id: 'reset', variantId: 'reset_accountability', season: 3 }],
  };
  state.finalOVR = 86;
  const repeatedResetTheme = eventModule.chooseSeasonNarrativeTheme();
  if (repeatedResetTheme.id !== 'reset' || repeatedResetTheme.variantId === 'reset_accountability') {
    failures.push('失败后的重整主题为了防重复被错误改写成成长主题');
  }

  // 长期替补与生涯暮年可以保留大主题，但必须轮换具体矛盾与文案。
  state.career.seasonCount = 10;
  state.career.currentAge = 35;
  state.career.flags = { seasonThemeHistory: [{ id: 'legacy', variantId: 'legacy_farewell', season: 10 }] };
  const legacyVariant = eventModule.chooseSeasonNarrativeTheme();
  if (legacyVariant.id !== 'legacy' || legacyVariant.variantId === 'legacy_farewell') {
    failures.push('生涯暮年主题没有轮换传承、转型与最后冲刺等子主题');
  }
  state.career.seasonCount = 3;
  state.career.currentAge = 24;
  state.career.contract = 3;
  state.season.isUserStarter = false;
  state.career.flags = { seasonThemeHistory: [{ id: 'prove', variantId: 'prove_trust', season: 3 }] };
  const proveVariant = eventModule.chooseSeasonNarrativeTheme();
  if (proveVariant.id !== 'prove' || proveVariant.variantId === 'prove_trust') {
    failures.push('长期替补的证明自己主题没有轮换具体角色矛盾');
  }

  // Theme variant 必须覆盖自己的选择与后果，而不只是替换标题和正文。
  const pressureStory = eventModule.getSeasonThemeStoryline({ id: 'title', variantId: 'title_pressure' });
  if (pressureStory.effectProfile !== 'responsibility' || pressureStory.choices?.[0]?.[1] !== '主动承担最关键的责任') {
    failures.push('赛季主题 variant 没有提供与具体矛盾匹配的选择');
  } else {
    state.career.flags = {};
    state.career.profile = {};
    state.season.events = createEventState(0);
    state.season.wins = 0;
    state.season.losses = 0;
    state.season.playerStats = { games: 0, pts: 0, ast: 0, reb: 0 };
    const themeThread = {
      id: 'theme-pressure-test', kind: 'team', title: pressureStory.title, emoji: '🏆', state: 'queued', choice: null,
      payload: { themeId: 'title', themeTitle: '争冠窗口：核心承压', effectProfile: pressureStory.effectProfile },
    };
    eventModule.commitDirectorThreadChoice(themeThread, 'all_in');
    const immediateThemeEffect = state.season.events.activeEffects.find(effect => effect.id === 'director-theme-commit-theme-pressure-test');
    state.season.events.storySignals = { games: 4, wins: 3, losses: 1 };
    state.season.events.careerTeamGamesPlayed = 4;
    state.season.wins = 3;
    state.season.losses = 1;
    const themeResolution = eventModule.resolveDirectorThread(themeThread);
    if (!themeResolution.body.includes('主动承担最关键的责任') ||
        !immediateThemeEffect || !state.career.profile.leadership) {
      failures.push('赛季主题 variant 选择仍然执行 Broad Theme 的固定后果');
    }
  }

  // 同一 broad theme 的变体按该主题自己的历史推进，不能被全局赛季数锁死在部分索引。
  state.career.flags = {
    seasonThemeHistory: [
      { id: 'title', variantId: 'title_all_in', season: 1 },
      { id: 'reset', variantId: 'reset_accountability', season: 2 },
      { id: 'title', variantId: 'title_pressure', season: 3 },
    ],
  };
  if (eventModule.chooseNarrativeThemeVariant('title')?.id !== 'title_depth') {
    failures.push('赛季主题变体游标仍受全局历史干扰，部分 title 变体不可达');
  }

  // 健康主题的负荷选择必须在表态时立即改变风险，阶段结算再依据真实缺席场次判断。
  state.career.flags = {};
  state.career.profile = {};
  state.season = {
    games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true,
    playerStats: { games: 0, pts: 0, ast: 0, reb: 0 }, events: createEventState(0),
  };
  const healthThread = {
    id: 'theme-health-test', kind: 'team', title: '健康与负荷', emoji: '🩺', state: 'queued', choice: null,
    payload: { themeId: 'title', themeTitle: '争冠窗口：健康与负荷', effectProfile: 'health' },
  };
  eventModule.commitDirectorThreadChoice(healthThread, 'foundation');
  if (state.season.events.injuryRiskBonus !== -0.8 || !state.season.events.activeEffects.some(effect => effect.id === 'director-theme-commit-theme-health-test')) {
    failures.push('健康主题选择没有在表态时立即改变伤病风险与比赛策略');
  }
  state.season.events.careerTeamGamesPlayed = 4;
  state.season.events.playerUnavailableGames = 1;
  state.season.events.playerInjuryMissedGames = 1;
  state.season.events.storySignals = { games: 3, wins: 2, losses: 1 };
  state.season.wins = 2;
  state.season.losses = 2;
  const healthOutcome = eventModule.getNarrativeThreadOutcome(healthThread);
  if (healthOutcome.success || healthOutcome.unavailableGames !== 1) {
    failures.push('健康主题阶段结算没有读取选择后的真实缺席场次');
  }

  // 结算只能读取选择之后的比赛，不能用早先的高场均分掩盖之后的连败。
  state.season = {
    games: Array.from({ length: 32 }, () => ({ game: { opponent: 'AWAY' } })), wins: 12, losses: 20,
    isPlayoffs: false, isUserStarter: true, playerStats: { games: 32, pts: 960, ast: 240, reb: 200 },
    events: createEventState(0),
  };
  state.season.events.storySignals = { games: 12, wins: 4, losses: 8, lossStreak: 5, standoutStreak: 0 };
  const badLockerOutcome = eventModule.getNarrativeThreadOutcome({
    kind: 'locker_room', commitSnapshot: { gameNum: 20, storyGames: 0, storyWins: 0, storyLosses: 0, wins: 8, losses: 12, playerGames: 20, pts: 560, ast: 120, reb: 120, lossStreak: 4 },
  });
  if (badLockerOutcome.success) failures.push('更衣室剧情错误使用全赛季高分掩盖选择后的连败');

  // 宿敌以球员身份跟随转会；两次失利产生旧债，复仇后旧债必须关闭。
  state.career.flags = { eventRivalry: { team: 'AWAY', playerId: 'active-rival', playerName: '现役宿敌', heat: 1 } };
  state.career.seasonCount = 3;
  state.season = { games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {}, schedule: [{ opponent: 'AWAY', gameNum: 8 }], events: createEventState(0) };
  eventModule.recordNarrativePlayoffSeries({ isMySeries: true, teamA: 'HOME', teamB: 'AWAY', aWon: false });
  eventModule.recordNarrativePlayoffSeries({ isMySeries: true, teamA: 'HOME', teamB: 'AWAY', aWon: false });
  if (state.career.flags.eventRivalry.debtState !== 'owed') failures.push('两次季后赛失利没有生成可结算的宿敌旧债');
  const reckoning = { kind: 'rivalry_reckoning', state: 'queued', choice: null, payload: {} };
  eventModule.commitDirectorThreadChoice(reckoning, 'respect');
  eventModule.resolveDirectorThread(reckoning);
  if (state.career.flags.eventRivalry.debtState !== 'reckoning' || state.career.flags.eventRivalry.reckoningTone !== 'respect') {
    failures.push('常规赛旧债结算提前替代了真实季后赛复仇结果');
  }
  state.career.seasonCount = 4;
  state.season = {
    games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {},
    schedule: [{ opponent: 'AWAY', gameNum: 8 }], events: createEventState(0),
  };
  if (eventModule.initializeSeasonNarrative().storyThreads.some(thread => thread.kind === 'rivalry_reckoning')) {
    failures.push('已经表态的季后赛旧债在等待真实复仇时仍会逐季重播');
  }
  eventModule.recordNarrativePlayoffSeries({ isMySeries: true, teamA: 'HOME', teamB: 'AWAY', aWon: true });
  if (state.career.flags.eventRivalry.debtState !== 'avenged') failures.push('季后赛复仇后宿敌旧债没有关闭');

  // 宿敌旧债必须高于 carry-over、球队主题和普通关系线，不能被四条容量截断。
  const rivalryMemory = state.career.flags.eventRivalry;
  rivalryMemory.debtState = 'owed';
  state.career.flags = {
    eventRivalry: rivalryMemory,
    roleArc: { level: 0 },
    narrativeCarryOvers: [{ id: 'carry-media', kind: 'media', title: '上季舆论余波', choice: 'ignore', fromSeason: 3 }],
  };
  state.career.seasonCount = 4;
  state.career.currentAge = 28;
  state.career.contract = 3;
  state.finalOVR = 92;
  state.season = {
    games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {},
    schedule: [{ opponent: 'AWAY', gameNum: 8 }], events: createEventState(0),
  };
  const prioritizedNarrative = eventModule.initializeSeasonNarrative();
  if (!prioritizedNarrative.storyThreads.some(thread => thread.kind === 'rivalry_reckoning') ||
      !prioritizedNarrative.storyThreads.some(thread => thread.carryOver) ||
      !prioritizedNarrative.storyThreads.some(thread => thread.kind === 'team')) {
    failures.push('四条剧情容量没有优先保留宿敌旧债、跨季未决线与赛季主题');
  }

  leagueData.MOVED = leagueData.AWAY.splice(0, 1);
  eventModule.recordNarrativePlayoffSeries({ isMySeries: true, teamA: 'HOME', teamB: 'MOVED', aWon: false });
  if (state.career.flags.eventRivalry.team !== 'MOVED' || state.career.flags.eventRivalry.playoffMeetings !== 4) {
    failures.push('宿敌转会后季后赛结果没有按球员身份继续记录');
  }

  // 已结算线程只保留为历史，不应阻止比赛继续制造新剧情。
  state.season.events = createEventState(0);
  state.season.events.storyThreads = Array.from({ length: 4 }, (_, index) => ({ id: `resolved-${index}`, kind: 'role', state: 'resolved' }));
  state.season.events.storySignals.standoutStreak = 5;
  const gameDrivenThread = eventModule.queueGameDrivenPressureThread();
  if (!gameDrivenThread || gameDrivenThread.kind !== 'media' || eventModule.getActiveNarrativeThreadCount() !== 1) {
    failures.push('已结算线程仍占用四条活跃剧情容量');
  }

  // 本场先释放到期线程，再保存同场达成的五连高光，不能让信号因旧容量已满而丢失。
  state.career.flags = {};
  state.season = {
    games: Array.from({ length: 20 }, () => ({ game: { opponent: 'OLD' } })),
    wins: 12, losses: 8, isPlayoffs: false, isUserStarter: true,
    playerStats: { games: 20, pts: 500, ast: 120, reb: 100 }, schedule: [], events: createEventState(0),
  };
  state.season.events.seasonTheme = { id: 'rise', variantId: 'rise_usage', title: '成长赛季', season: 5 };
  state.season.events.storySignals = { games: 4, wins: 3, losses: 1, winStreak: 1, lossStreak: 0, standoutStreak: 4, closeGames: 0 };
  const dueThread = {
    id: 'due-locker', kind: 'locker_room', title: '到期剧情', emoji: '🚪', state: 'committed', choice: 'coach_plan',
    resolutionGame: 20, payload: {}, commitSnapshot: { storyGames: 0, storyWins: 0, storyLosses: 0, playerGames: 0, pts: 0, ast: 0, reb: 0 },
  };
  state.season.events.storyThreads = [dueThread].concat(Array.from({ length: 3 }, (_, index) => ({
    id: `waiting-${index}`, kind: `waiting-${index}`, state: 'queued', openingGame: 99, payload: {},
  })));
  eventModule.checkSeasonNarrativeDirector({
    game: { opponent: 'OLD' }, result: { won: true, scoreA: 118, scoreB: 108 }, stats: { pts: 34, reb: 6, ast: 8 },
  });
  if (dueThread.state !== 'resolved' || !state.season.events.storyThreads.some(thread => thread.kind === 'media')) {
    failures.push('到期剧情释放槽位后，同场达成的比赛驱动剧情仍被永久错过');
  }

  // 跨季当前队友在休赛期转会时，未结线程必须迁移为同一个 NPC 的旧友线。
  const carryNpc = { id: 'carry-mate', cname: '跨季队友', ovr: 86 };
  const newNpc = { id: 'new-current-mate', cname: '新队友', ovr: 84 };
  leagueData.HOME.push(carryNpc, newNpc);
  state.career.flags = {
    storyTeammate: { id: carryNpc.id, cname: carryNpc.cname, affinity: 5, sinceSeason: 3 },
    narrativeCarryOvers: [{
      id: 'carry-teammate', kind: 'teammate', title: '未结队友矛盾', choice: 'protect', fromSeason: 5,
      payload: { teammateId: carryNpc.id, teammateName: carryNpc.cname, affinity: 5 },
    }],
  };
  leagueData.TRADED = [leagueData.HOME.splice(leagueData.HOME.findIndex(player => player.id === carryNpc.id), 1)[0]];
  state.career.seasonCount = 6;
  state.season = {
    games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {},
    schedule: [{ opponent: 'TRADED', gameNum: 10 }], events: createEventState(0),
  };
  const migratedSeason = eventModule.initializeSeasonNarrative();
  const migratedCarry = migratedSeason.storyThreads.find(thread => thread.carryOver && thread.payload?.teammateId === carryNpc.id);
  const sameNpcThreads = migratedSeason.storyThreads.filter(thread => thread.payload?.teammateId === carryNpc.id);
  if (!migratedCarry || migratedCarry.kind !== 'former_teammate' || migratedCarry.choice !== 'welcome' || sameNpcThreads.length !== 1) {
    failures.push('休赛期转会后，跨季队友线程没有迁移成唯一的旧友线程');
  } else {
    const activeMateBefore = Number(state.career.flags.storyTeammate?.affinity) || 0;
    const formerBefore = Number(eventModule.getNarrativeFormerTeammates().find(mate => mate.id === carryNpc.id)?.affinity) || 0;
    eventModule.resolveDirectorThread(migratedCarry);
    const formerAfter = Number(eventModule.getNarrativeFormerTeammates().find(mate => mate.id === carryNpc.id)?.affinity) || 0;
    if (formerAfter !== formerBefore + 1 || (Number(state.career.flags.storyTeammate?.affinity) || 0) !== activeMateBefore) {
      failures.push('迁移后的跨季旧友线程结算到了错误的当前队友身上');
    }
  }
  state.career.flags.narrativeCarryOvers = [{
    id: 'retired-carry', kind: 'teammate', title: '退役前的未结关系', choice: 'honest', fromSeason: 6,
    payload: { teammateId: 'retired-carry-mate', teammateName: '已退役队友', affinity: 4 },
  }];
  state.career.seasonCount = 7;
  state.season.events = createEventState(0);
  const retiredCarrySeason = eventModule.initializeSeasonNarrative();
  if (retiredCarrySeason.storyThreads.some(thread => thread.payload?.teammateId === 'retired-carry-mate') ||
      !state.career.flags.storyTeammateHistory?.some(mate => mate.id === 'retired-carry-mate')) {
    failures.push('跨季队友退役后，未结线程没有终止并归档 NPC 关系');
  }

  // 旧友重新加盟但当前关系槽已有其他人时，未结剧情应转成独立重聚线而不是静默丢失。
  const returnedNpc = { id: 'returned-mate', cname: '回归旧友', ovr: 83 };
  const occupiedNpc = { id: 'occupied-mate', cname: '现任搭档', ovr: 85 };
  leagueData.HOME.push(returnedNpc, occupiedNpc);
  state.career.flags = {
    storyTeammate: { id: occupiedNpc.id, cname: occupiedNpc.cname, affinity: 3, sinceSeason: 6 },
    formerStoryTeammates: [{ id: returnedNpc.id, cname: returnedNpc.cname, team: 'OLD_RETURN', active: true, affinity: 5, reunionCount: 1 }],
    narrativeCarryOvers: [{
      id: 'returned-carry', kind: 'former_teammate', title: '未结旧友线', choice: 'welcome', fromSeason: 7,
      payload: { teammateId: returnedNpc.id, teammateName: returnedNpc.cname, affinity: 5, opponent: 'OLD_RETURN' },
    }],
  };
  state.career.seasonCount = 8;
  state.season = { games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {}, schedule: [], events: createEventState(0) };
  const returnedSeason = eventModule.initializeSeasonNarrative();
  const returnedCarry = returnedSeason.storyThreads.find(thread => thread.payload?.teammateId === returnedNpc.id);
  const returnedOpening = returnedCarry && eventModule.getDirectorThreadOpening(returnedCarry);
  if (!returnedCarry || returnedCarry.kind !== 'reunited_teammate' || returnedCarry.state !== 'queued' || returnedCarry.choice != null ||
      returnedCarry.payload?.previousChoice !== 'welcome' || returnedOpening?.choices?.[0]?._directorChoice !== 'welcome' ||
      state.career.flags.storyTeammate.id !== occupiedNpc.id) {
    failures.push('旧友重新加盟时，CarryOver 没有转成独立重聚线或错误抢占当前队友槽');
  } else {
    eventModule.commitDirectorThreadChoice(returnedCarry, 'welcome');
    eventModule.resolveDirectorThread(returnedCarry);
    const reunitedRecord = state.career.flags.reunitedStoryTeammates?.find(mate => mate.id === returnedNpc.id);
    if (!reunitedRecord?.resolvedSeason || state.career.flags.storyTeammate.id !== occupiedNpc.id) {
      failures.push('旧友重聚线没有正确结算并保留当前核心队友关系');
    }
  }

  // 当前关系槽为空时，回归旧友可能同时被选为新故事队友；同一 NPC 仍只能保留优先级更高的重聚线。
  const returnedPrimaryNpc = { id: 'returned-primary', cname: '回归核心', ovr: 99 };
  leagueData.HOME.push(returnedPrimaryNpc);
  state.career.flags = {
    formerStoryTeammates: [{ id: returnedPrimaryNpc.id, cname: returnedPrimaryNpc.cname, team: 'OLD_PRIMARY', active: true, affinity: 6, reunionCount: 1 }],
    narrativeCarryOvers: [{
      id: 'returned-primary-carry', kind: 'former_teammate', title: '核心旧友未结线', choice: 'compete', fromSeason: 8,
      payload: { teammateId: returnedPrimaryNpc.id, teammateName: returnedPrimaryNpc.cname, affinity: 6, opponent: 'OLD_PRIMARY' },
    }],
  };
  state.career.seasonCount = 9;
  state.season = { games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {}, schedule: [], events: createEventState(0) };
  const returnedPrimarySeason = eventModule.initializeSeasonNarrative();
  const returnedPrimaryThreads = returnedPrimarySeason.storyThreads.filter(thread => thread.payload?.teammateId === returnedPrimaryNpc.id);
  if (returnedPrimaryThreads.length !== 1 || returnedPrimaryThreads[0].kind !== 'reunited_teammate') {
    failures.push('回归旧友同时成为当前故事队友时，仍生成同一 NPC 的两条关系剧情');
  }

  // 已经结算过旧友线的球员再次回到名单，也必须由 roster transition 生成重聚剧情。
  const rosterReturnNpc = { id: 'roster-return', cname: '名单回归旧友', ovr: 88 };
  leagueData.HOME.push(rosterReturnNpc);
  state.career.flags = {
    storyTeammate: { id: occupiedNpc.id, cname: occupiedNpc.cname, affinity: 3, sinceSeason: 6 },
    formerStoryTeammates: [{ id: rosterReturnNpc.id, cname: rosterReturnNpc.cname, team: 'OLD_ROSTER', active: true, affinity: 5, reunionCount: 2 }],
  };
  state.career.seasonCount = 10;
  state.season = { games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {}, schedule: [], events: createEventState(0) };
  const rosterReturnSeason = eventModule.initializeSeasonNarrative();
  const rosterReturnThread = rosterReturnSeason.storyThreads.find(thread => thread.kind === 'reunited_teammate' && thread.payload?.teammateId === rosterReturnNpc.id);
  if (!rosterReturnThread || !rosterReturnThread.payload?.rosterDriven || state.career.flags.formerStoryTeammates.some(mate => mate.id === rosterReturnNpc.id)) {
    failures.push('没有 CarryOver 的旧友回归名单后未生成 roster-driven 重聚剧情');
  }

  // 未结重聚线跨休赛期再次离队时，必须迁回旧友对决语境并重新开放选择。
  state.career.flags.narrativeCarryOvers = [{
    id: 'reunion-left-again', kind: 'reunited_teammate', title: '未结重聚线', choice: 'welcome', fromSeason: 11,
    payload: { teammateId: rosterReturnNpc.id, teammateName: rosterReturnNpc.cname, affinity: 5 },
  }];
  leagueData.LEFT_AGAIN = [leagueData.HOME.splice(leagueData.HOME.findIndex(player => player.id === rosterReturnNpc.id), 1)[0]];
  state.career.seasonCount = 11;
  state.season = {
    games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {},
    schedule: [{ opponent: 'LEFT_AGAIN', gameNum: 8 }], events: createEventState(0),
  };
  const leftAgainSeason = eventModule.initializeSeasonNarrative();
  const leftAgainThread = leftAgainSeason.storyThreads.find(thread => thread.payload?.teammateId === rosterReturnNpc.id);
  if (!leftAgainThread || leftAgainThread.kind !== 'former_teammate' || leftAgainThread.state !== 'queued' || leftAgainThread.payload?.previousChoice !== 'welcome') {
    failures.push('未结重聚线中的球员再次离队后，剧情身份没有迁回旧友并重新开放选择');
  }

  // 已结算重聚线没有 CarryOver，也必须继续根据名单同步；再次离队后应重新进入旧友池。
  const resolvedReunionNpc = { id: 'resolved-reunion-left', cname: '再度离队旧友', ovr: 86 };
  leagueData.SECOND_EXIT = [resolvedReunionNpc];
  state.career.flags = {
    storyTeammate: { id: occupiedNpc.id, cname: occupiedNpc.cname, affinity: 3, sinceSeason: 6 },
    reunitedStoryTeammates: [{ id: resolvedReunionNpc.id, cname: resolvedReunionNpc.cname, team: 'HOME', active: true, pendingReunion: false, resolvedSeason: 10, affinity: 5 }],
  };
  state.career.seasonCount = 12;
  state.season = {
    games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {},
    schedule: [{ opponent: 'SECOND_EXIT', gameNum: 12 }], events: createEventState(0),
  };
  eventModule.initializeSeasonNarrative();
  const resolvedFormer = state.career.flags.formerStoryTeammates?.find(mate => mate.id === resolvedReunionNpc.id);
  const resolvedReunionRecord = state.career.flags.reunitedStoryTeammates?.find(mate => mate.id === resolvedReunionNpc.id);
  if (!resolvedFormer || resolvedFormer.team !== 'SECOND_EXIT' || resolvedReunionRecord?.active !== false) {
    failures.push('已结算重聚关系再次离队后没有同步回旧友池');
  }

  // 同一季后赛对手拥有多名旧友时，每个人都要记录这次系列赛。
  leagueData.MULTI_OLD = [
    { id: 'multi-former-a', cname: '同队旧友A', ovr: 83 },
    { id: 'multi-former-b', cname: '同队旧友B', ovr: 82 },
  ];
  state.career.flags = {
    formerStoryTeammates: [
      { id: 'multi-former-a', cname: '同队旧友A', team: 'MULTI_OLD', active: true },
      { id: 'multi-former-b', cname: '同队旧友B', team: 'MULTI_OLD', active: true },
    ],
  };
  eventModule.recordNarrativePlayoffSeries({ isMySeries: true, teamA: 'HOME', teamB: 'MULTI_OLD', aWon: true });
  if (!state.career.flags.formerStoryTeammates.every(mate => mate.playoffMeetings === 1 && mate.lastPlayoffResult === 'won')) {
    failures.push('同一季后赛对手中的多名旧友没有全部记录系列赛结果');
  }

  // 多名旧友同时存在时，首次重逢优先于已经反复出现的旧友，并执行完整赛季冷却。
  leagueData.OLD_A = [{ id: 'former-a', cname: '旧友A', ovr: 82 }];
  leagueData.OLD_B = [{ id: 'former-b', cname: '旧友B', ovr: 81 }];
  state.career.seasonCount = 9;
  state.career.flags = {
    formerStoryTeammates: [
      { id: 'former-a', cname: '旧友A', team: 'OLD_A', active: true, reunionCount: 3, lastReunionSeason: 9, playoffMeetings: 1, affinity: 6 },
      { id: 'former-b', cname: '旧友B', team: 'OLD_B', active: true, reunionCount: 0, affinity: 2 },
    ],
  };
  state.season = {
    games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {},
    schedule: [{ opponent: 'OLD_A', gameNum: 8 }, { opponent: 'OLD_B', gameNum: 12 }], events: createEventState(0),
  };
  if (eventModule.selectNarrativeFormerTeammate()?.id !== 'former-b') {
    failures.push('多个旧队友同时符合条件时，重复旧友仍然霸占首次重逢剧情');
  }

  // 当前队友与离队旧友使用独立关系槽；后续重逢不能永远沿用“第一次”文案。
  const movedMate = leagueData.HOME.shift();
  leagueData.OLD = [movedMate];
  state.career.flags = { storyTeammate: { id: movedMate.id, cname: movedMate.cname, affinity: 5, sinceSeason: 1 } };
  state.career.seasonCount = 5;
  state.season = {
    games: [], wins: 0, losses: 0, isPlayoffs: false, isUserStarter: true, playerStats: {},
    schedule: [{ opponent: 'OLD', gameNum: 9 }], events: createEventState(0),
  };
  const currentMate = eventModule.getSeasonNarrativeTeammate();
  const formerMates = eventModule.getNarrativeFormerTeammates();
  if (!currentMate || currentMate.id === movedMate.id || !formerMates.some(mate => mate.id === movedMate.id)) {
    failures.push('离队故事队友占住当前队友槽，无法同时发展新旧关系线');
  }
  const reunionSeason = eventModule.initializeSeasonNarrative();
  const firstReunion = reunionSeason.storyThreads.find(thread => thread.kind === 'former_teammate');
  if (!firstReunion || !firstReunion.payload.isFirstReunion) {
    failures.push('离队旧友没有生成独立的首次重逢剧情');
  } else {
    eventModule.commitDirectorThreadChoice(firstReunion, 'welcome');
    state.career.seasonCount = 7;
    state.season.events = createEventState(0);
    const laterSeason = eventModule.initializeSeasonNarrative();
    const laterReunion = laterSeason.storyThreads.find(thread => thread.kind === 'former_teammate');
    if (!laterReunion || laterReunion.payload.isFirstReunion || eventModule.getDirectorThreadOpening(laterReunion).body.includes('第一次')) {
      failures.push('同一旧友后续重逢仍重复使用第一次交手文案');
    }
  }

  // 退役的故事队友应归档，并允许生涯后段重新建立新的长期关系。
  state.career.flags = { storyTeammate: { id: 'retired-teammate', cname: '退役队友', affinity: 6, sinceSeason: 1 } };
  const replacementTeammate = eventModule.getSeasonNarrativeTeammate();
  if (!replacementTeammate || replacementTeammate.id === 'retired-teammate' || !state.career.flags.storyTeammateHistory?.length) {
    failures.push('退役故事队友没有归档并重新绑定关系线');
  }

  // 大伤复出按 injury instance 去重，第二次大伤不能遗留永久 pending 标记。
  const majorComeback = registry.find(item => item.id === 'career_major_injury_comeback');
  state.career.flags = { majorInjuryInstance: 1, majorInjuryPendingComeback: { id: 1 } };
  state.season.events = createEventState(0);
  if (majorComeback) {
    eventModule.recordEventLifecycle(majorComeback);
    if (eventModule.canTriggerEventByLifecycle(majorComeback)) failures.push('同一次大伤复出剧情可以重复触发');
    state.career.flags.majorInjuryInstance = 2;
    state.career.flags.majorInjuryPendingComeback = { id: 2 };
    if (!eventModule.canTriggerEventByLifecycle(majorComeback)) failures.push('第二次大伤无法触发新的复出剧情');
  }

  // 三个高频职业事件必须按生涯出现次数推进不同阶段，而不是跨季重播同一弹窗。
  for (const eventId of ['career_trade_deadline_rumor', 'career_playoff_adjustment', 'career_award_race_pressure']) {
    const chainedEvent = registry.find(item => item.id === eventId);
    if (!chainedEvent) continue;
    state.career.flags = {};
    const titles = [];
    const openingChoices = [];
    const effectIds = [];
    for (let stage = 0; stage < 4; stage += 1) {
      state.career.seasonCount = 8 + stage;
      state.season.events = createEventState(0);
      const data = chainedEvent.execute({ result: { won: false }, stats: {} });
      titles.push(data.title);
      openingChoices.push(data.choices?.[0]?.label);
      const resultText = data.choices?.[0]?.apply();
      effectIds.push(state.season.events.activeEffects.at(-1)?.id);
      if (!resultText?.includes(data.choices?.[0]?.label)) failures.push(`${eventId} 第 ${stage + 1} 阶段的选择与实际结算文案不一致`);
      eventModule.recordEventLifecycle(chainedEvent);
      state.career.seasonCount = 9 + stage;
      if (stage < 3 && !eventModule.canTriggerEventByLifecycle(chainedEvent)) {
        failures.push(`${eventId} 的下一阶段在新赛季无法触发`);
        break;
      }
    }
    if (new Set(titles).size !== 4 || new Set(openingChoices).size !== 4 || new Set(effectIds).size !== 4) {
      failures.push(`${eventId} 前四阶段仍会重复相同标题、选择或实际效果`);
    }
    state.career.seasonCount = 12;
    if (eventModule.canTriggerEventByLifecycle(chainedEvent)) failures.push(`${eventId} 进入成熟池后没有执行跨季冷却`);
    state.career.seasonCount = 13;
    if (!eventModule.canTriggerEventByLifecycle(chainedEvent)) {
      failures.push(`${eventId} 成熟池冷却结束后无法继续触发`);
    } else {
      state.season.events = createEventState(0);
      const recurrentData = chainedEvent.execute({ result: { won: false }, stats: {} });
      const recurrentResult = recurrentData.choices?.[0]?.apply();
      if (recurrentData.title === titles[0] || /第一次|第一课/.test(recurrentData.title) || !recurrentResult?.includes(recurrentData.choices?.[0]?.label)) {
        failures.push(`${eventId} 第五次触发回绕到第一次，或成熟阶段后果与选择不一致`);
      }
    }
  }

  // 短期效果按生涯球队比赛统一消费；同一场重复进入赛后流程不能 double tick，缺席场次仍计入寿命与健康窗口。
  state.season = {
    games: [{ game: { opponent: 'AWAY' } }], wins: 1, losses: 0, isPlayoffs: false,
    playerStats: { games: 1 }, playoffStats: { games: 0 }, events: createEventState(0), _careerTeamAvailabilityGame: 101,
  };
  state.season.events.activeEffects = [{ id: 'two-game-effect', label: '两场效果', teamEdge: 1, gamesLeft: 2 }];
  eventModule.consumeActiveEventEffectsForCareerGame({ unavailable: true, absenceType: 'injury' });
  eventModule.consumeActiveEventEffectsForCareerGame({ unavailable: true, absenceType: 'injury' });
  if (state.season.events.activeEffects[0]?.gamesLeft !== 1 || state.season.events.careerTeamGamesPlayed !== 1 ||
      state.season.events.playerUnavailableGames !== 1 || state.season.events.playerInjuryMissedGames !== 1 || state.season.events.playerSuspensionMissedGames !== 0) {
    failures.push('同一场生涯球队比赛重复消费了事件效果，或缺席计数没有写入');
  }
  state.season._careerTeamAvailabilityGame = 102;
  eventModule.consumeActiveEventEffectsForCareerGame();
  if (state.season.events.activeEffects.length || state.season.events.careerTeamGamesPlayed !== 2 || state.season.events.playerUnavailableGames !== 1) {
    failures.push('伤停与正常比赛没有共同按球队场次消耗短期事件效果');
  }

  // 玩家缺席时不弹事件，但球队胜负仍要进入剧情记忆，并能形成连败压力线。
  state.career.flags = {};
  state.season = {
    games: [], wins: 0, losses: 4, isPlayoffs: false, isUserStarter: true, playerStats: { games: 0 },
    events: createEventState(0),
  };
  state.season.events.seasonTheme = { id: 'rise', variantId: 'rise_usage', title: '成长赛季', season: 14 };
  state.season.events.storyThreads = [{ id: 'resolved-memory', kind: 'role', state: 'resolved' }];
  for (let missedGame = 1; missedGame <= 4; missedGame += 1) {
    eventModule.afterCareerTeamGame({
      game: { opponent: 'AWAY' }, result: { won: false, scoreA: 98, scoreB: 108 }, stats: null,
      unavailable: true, absenceType: missedGame === 4 ? 'suspension' : 'injury',
      gameKey: `memory-missed:${missedGame}`, allowPopup: false,
    });
  }
  if (state.season.events.storySignals.lossStreak !== 4 || state.season.events.storySignals.losses !== 4 ||
      !state.season.events.storyThreads.some(thread => thread.kind === 'locker_room') ||
      state.season.events.playerInjuryMissedGames !== 3 || state.season.events.playerSuspensionMissedGames !== 1 ||
      state.season.events.eventCounts['regular:director']) {
    failures.push('伤停比赛没有写入球队剧情信号、拆分缺席原因，或错误弹出了导演事件');
  }

  // 健康主题只读取伤病缺席，纪律禁赛不能被误判为负荷管理失败。
  const suspensionOnlyHealthThread = {
    kind: 'team', choice: 'foundation', payload: { effectProfile: 'health' },
    commitSnapshot: { careerTeamGames: 0, unavailableGames: 0, injuryMissedGames: 0, suspensionMissedGames: 0, wins: 0, losses: 0, storyGames: 0, storyWins: 0, storyLosses: 0, playerGames: 0 },
  };
  state.season.events.careerTeamGamesPlayed = 4;
  state.season.events.playerUnavailableGames = 1;
  state.season.events.playerInjuryMissedGames = 0;
  state.season.events.playerSuspensionMissedGames = 1;
  state.season.events.injuryGamesLeft = 0;
  if (!eventModule.getNarrativeThreadOutcome(suspensionOnlyHealthThread).success) {
    failures.push('健康主题仍把纪律禁赛当作健康管理失败');
  }

  // 赛季导演必须遵守自己的赛季上限与冷却，不能每次都抢在其他事件通道之前弹出。
  state.career.flags = {};
  state.season = {
    games: Array.from({ length: 20 }, () => ({ game: { opponent: 'AWAY' } })), wins: 12, losses: 8,
    isPlayoffs: false, isUserStarter: true, playerStats: { games: 20, pts: 480, ast: 120, reb: 100 }, events: createEventState(0),
  };
  const cappedDirectorThread = { id: 'director-cap-test', kind: 'role', title: '导演限流测试', emoji: '📋', state: 'queued', openingGame: 1, resolutionGame: 40, payload: { level: 2 } };
  state.season.events.seasonTheme = { id: 'rise', variantId: 'rise_usage', title: '成长赛季', season: 10 };
  state.season.events.storyThreads = [cappedDirectorThread];
  state.season.events.eventCounts['regular:director'] = 6;
  if (eventModule.checkSeasonNarrativeDirector({ game: { opponent: 'AWAY' }, result: { won: true }, stats: { pts: 20 } })) {
    failures.push('赛季导演超过通道上限后仍继续弹出');
  }
  state.season.events.eventCounts['regular:director'] = 0;
  state.season.events.lastTriggerByLane['regular:director'] = 18;
  if (eventModule.checkSeasonNarrativeDirector({ game: { opponent: 'AWAY' }, result: { won: true }, stats: { pts: 20 } })) {
    failures.push('赛季导演没有遵守常规赛冷却间隔');
  }
  state.season.events.lastTriggerByLane['regular:director'] = 10;
  const cooledDirectorEvent = eventModule.checkSeasonNarrativeDirector({ game: { opponent: 'AWAY' }, result: { won: true }, stats: { pts: 20 } });
  if (!cooledDirectorEvent || cooledDirectorEvent._eventLane !== 'director') {
    failures.push('赛季导演冷却结束后无法继续推进排队剧情');
  }

  registry.splice(0, registry.length,
    {
      id: 'validation_suspension',
      lane: 'discipline',
      weight: 1,
      condition: () => true,
      execute: () => ({
        emoji: '🧪', title: '测试禁赛', body: '验证调度', desc: '测试原因',
        _consequence: 'suspension', _games: 2,
      }),
    },
    {
      id: 'validation_duplicate_story',
      lane: 'story',
      weight: 1,
      condition: () => true,
      execute: () => ({ emoji: '🧪', title: '重复赛后事件', body: '同场不应触发', desc: '幂等验证' }),
    },
  );
  // 前面的职业剧情条件测试会把比赛数推进到第 20 场；重置为独立的调度器用例，
  // 避免赛季导演按真实赛程优先推进角色线而抢占禁赛验证。
  state.season.games = [{ game: { opponent: 'AWAY' } }];
  state.season.events = createEventState(0);
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const result = eventModule.checkRandomEvents(
      { opponent: 'AWAY' },
      { won: true, scoreA: 110, scoreB: 105 },
      { pts: 20, reb: 5, ast: 5 },
    );
    if (!result || result.title !== '测试禁赛') failures.push('纪律事件无法通过调度器触发');
    if (state.season.events.suspensionGamesLeft !== 2) failures.push('禁赛事件没有正确累计缺席场次');
    if (!state.season.events.triggeredIds.includes('validation_suspension')) failures.push('事件去重记录未写入');
    if (state.season.events.storyTimeline.length !== 1) failures.push('事件生涯时间线未写入');
    const duplicateResult = eventModule.checkRandomEvents(
      { opponent: 'AWAY' },
      { won: true, scoreA: 110, scoreB: 105 },
      { pts: 20, reb: 5, ast: 5 },
    );
    if (duplicateResult || state.season.events.triggeredIds.includes('validation_duplicate_story') || state.season.events.storyTimeline.length !== 1) {
      failures.push('同一场比赛重复进入赛后流程时仍会再次抽取随机事件');
    }
  } finally {
    Math.random = originalRandom;
  }
}

// 玩家附加赛必须复用正式比赛引擎，并把伤停与球队比赛时钟交给统一赛后入口。
const playInMatchStart = playoffsSource.indexOf('function simulatePlayInMatch');
const playInMatchEnd = playoffsSource.indexOf('function simPlayInGame', playInMatchStart);
if (playInMatchStart < 0 || playInMatchEnd < 0) {
  failures.push('无法定位玩家附加赛统一模拟入口');
} else {
  const playInState = {
    careerTeam: 'HOME', career: { seasonCount: 4 },
    season: { events: { suspensionGamesLeft: 0, injuryGamesLeft: 2 } },
  };
  let simulatedOptions = null;
  let afterPlayIn = null;
  const playInFns = new Function(
    'STATE', 'calcTeamPowerWithPlayer', 'ensureSeasonEventState', 'simulateGameNew', 'afterCareerTeamGame',
    `${playoffsSource.slice(playInMatchStart, playInMatchEnd)}\nreturn { simulatePlayInMatch };`,
  )(
    playInState,
    () => ({ offense: 80, defense: 80, depth: 80 }),
    () => playInState.season.events,
    (teamA, teamB, seedBonus, multiplier, options) => {
      simulatedOptions = options;
      return { won: false, scoreA: 101, scoreB: 107 };
    },
    options => { afterPlayIn = options; },
  );
  const careerPlayInResult = playInFns.simulatePlayInMatch('HOME', 'AWAY', 'A');
  if (careerPlayInResult.aWins || careerPlayInResult.absenceType !== 'injury' || playInState.season.events.injuryGamesLeft !== 1 ||
      simulatedOptions?.userAvailable !== false || Object.prototype.hasOwnProperty.call(simulatedOptions || {}, 'availabilityEdge') ||
      afterPlayIn?.absenceType !== 'injury' || afterPlayIn?.gameKey !== 'play-in:4:A' || afterPlayIn?.allowPopup !== false) {
    failures.push('玩家附加赛没有接入正式比赛引擎、伤停扣减或统一球队比赛时钟');
  }
}

// 伤停必须从阵容源头移除用户，而不是在仍计入用户战力与 BoxScore 后再叠加固定分差惩罚。
const lineupStart = indexSource.indexOf('function calcTeamLineup');
const lineupEnd = indexSource.indexOf('/** 比赛引擎使用的中立场阵容战力', lineupStart);
const rotationStart = indexSource.indexOf('function buildLeagueGameRotation');
const rotationEnd = indexSource.indexOf('/** 生成两队全队数据', rotationStart);
if (lineupStart < 0 || lineupEnd < 0 || rotationStart < 0 || rotationEnd < 0) {
  failures.push('无法定位伤停阵容与轮换逻辑');
} else {
  const lineupState = {
    careerTeam: 'HOME', finalOVR: 99, position: 'PG', attrs: {}, season: { isPlayoffs: false }, _lineupCache: {},
  };
  const lineupLeagueData = {
    HOME: Array.from({ length: 9 }, (_, index) => ({ id: `npc-${index}`, cname: `队友${index}`, pos: 'PG', ovr: 70 })),
  };
  const powerConfig = { TEAM_POWER: { offense: { ovr: 1 }, defense: { ovr: 1 }, athletic: { ovr: 1 }, clutch: { ovr: 1 } } };
  const lineupFns = new Function(
    'STATE', 'LEAGUE_PLAYER_DATA', 'SIM_CONFIG', 'canPlayPosition', 'getMyPlayerDisplayName',
    `${indexSource.slice(lineupStart, lineupEnd)}\nreturn { calcTeamLineup, calcTeamPowerWithPlayer };`,
  )(lineupState, lineupLeagueData, powerConfig, () => true, () => '测试用户');
  const availableLineup = lineupFns.calcTeamLineup('HOME');
  const unavailableLineup = lineupFns.calcTeamLineup('HOME', { userAvailable: false });
  const availablePower = lineupFns.calcTeamPowerWithPlayer('HOME');
  const unavailablePower = lineupFns.calcTeamPowerWithPlayer('HOME', { userAvailable: false });
  const unavailablePlayers = Object.values(unavailableLineup.starters).concat(unavailableLineup.bench || []);
  if (!availableLineup.allPlayers.some(player => player._isUser) || unavailablePlayers.some(player => player._isUser) ||
      !(availablePower.depth > unavailablePower.depth)) {
    failures.push('伤停用户仍进入球队阵容或球队战力');
  }

  const rotationState = { careerTeam: 'HOME', season: { schedule: [] } };
  const forcedUser = { _isUser: true, cname: '测试用户' };
  const rotationPlayers = [forcedUser].concat(Array.from({ length: 10 }, (_, index) => ({ id: `rotation-${index}` })));
  const rotationFns = new Function(
    'STATE', 'calcTeamLineup', 'shouldNpcPlayLeagueGame',
    `${indexSource.slice(rotationStart, rotationEnd)}\nreturn { buildLeagueGameRotation };`,
  )(
    rotationState,
    () => ({ starters: { PG: forcedUser, SG: rotationPlayers[1], SF: rotationPlayers[2], PF: rotationPlayers[3], C: rotationPlayers[4] }, bench: rotationPlayers.slice(5) }),
    () => true,
  );
  if (rotationFns.buildLeagueGameRotation('HOME', { userAvailable: false }).players.some(player => player._isUser)) {
    failures.push('伤停用户仍被强制塞回比赛轮换与 BoxScore');
  }
}

if (!/generateBoxScore\(teamA, teamB, scoreA, scoreB, options\)/.test(indexSource) ||
    !/simulateGameNew\(STATE\.careerTeam, g\.opponent, 0, null, \{ userAvailable: false \}\)/.test(indexSource) ||
    !/userAvailable: false/.test(playoffsSource)) {
  failures.push('伤停可用性没有贯通常规赛、季后赛与 BoxScore');
}

if (!/const eventTeamEdge = getActiveEventTeamEdge\(teamA, teamB\)/.test(indexSource)) {
  failures.push('事件短期效果没有接入比赛预期分差');
}
if (!/finalizeRandomEventChoice\(data, choice, resultText\)/.test(indexSource)) {
  failures.push('互动事件选择没有接入弹窗结算');
}
if (!/afterCareerTeamGame\(\{ game: g, result: skipResult,[\s\S]*absenceType: skipReason/.test(indexSource) ||
    !/afterCareerTeamGame\(\{[\s\S]*absenceType: skipReason,[\s\S]*allowPopup: false/.test(playoffsSource)) {
  failures.push('常规赛或季后赛的伤停跳过路径没有消费短期事件效果');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    inlineScripts: inlineScripts.length,
    registryValidated: true,
    legacySaveRepair: true,
    suspensionFlow: true,
    interactiveChoices: true,
    activeEffects: true,
    directorNarrative: true,
    lifecycleAndIdentity: true,
    playoffNarrativeMemory: true,
    carryOverAndOutcomeWindows: true,
    rivalryDebtPlayoffResolution: true,
    activeThreadCapacity: true,
    narrativePrioritySelection: true,
    carryOverRelationshipMigration: true,
    gameSignalAfterResolution: true,
    themeDirectorAndNpcArcs: true,
    themeVariants: true,
    themeVariantChoicesAndEffects: true,
    careerEventChains: true,
    careerEventRecurrentPool: true,
    careerEventVariantConsequences: true,
    formerTeammateScheduling: true,
    currentAndFormerTeammateSlots: true,
    reunitedTeammateCarryOver: true,
    reunitedTeammateChoiceReachability: true,
    rosterDrivenReunion: true,
    reunitedRelationshipTransition: true,
    resolvedReunionRosterSync: true,
    relationshipIdentityDeduplication: true,
    activeEffectCareerGameClock: true,
    unavailableGameNarrativeMemory: true,
    absenceReasonCounters: true,
    playInCareerGameClock: true,
    unavailableUserLineup: true,
    duplicatePostGameEventGuard: true,
    allFormerTeammatePlayoffMemory: true,
    healthThemeAvailabilityOutcome: true,
    themeVariantCursor: true,
    directorLaneThrottle: true,
    injuryInstanceRecovery: true,
  }));
}
