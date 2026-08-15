const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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
  const state = { season: { events: { injuryGamesLeft: 3, storyTimeline: [{ id: 'legacy' }] } } };
  const stateFns = new Function(
    'STATE',
    `${indexSource.slice(stateStart, stateEnd)}\nreturn { createSeasonEventState, ensureSeasonEventState };`,
  )(state);
  const repaired = stateFns.ensureSeasonEventState();
  if (repaired.injuryGamesLeft !== 3 || repaired.storyTimeline.length !== 1) {
    failures.push('旧存档事件数据在兼容修复时被覆盖');
  }
  for (const key of ['lastTriggerByLane', 'eventCounts', 'opponentHistory', 'activeEffects', 'storyThreads', 'storySignals', 'directorEvents']) {
    if (repaired[key] == null) failures.push(`旧存档没有补齐事件字段 ${key}`);
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
    career: { seasonCount: 1, currentAge: 28, contract: 2, profile: {}, flags: {} },
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
    version: 3,
    suspensionGamesLeft: 0, suspensionReason: '', injuryGamesLeft: 0, injuryReason: '',
    triggeredIds: [], storyTimeline: [], lastTriggerGameNum: null, lastTriggerByLane: {}, eventCounts: {},
    playoffEventCount: 0, injuryRiskBonus: Number(injuryRiskBonus) || 0, majorInjuryThisSeason: false,
    playThroughPrompted: {}, regularPlayThroughPromptCount: 0, opponentHistory: {}, activeEffects: [],
    seasonTheme: null, storyThreads: [],
    storySignals: { games: 0, winStreak: 0, lossStreak: 0, standoutStreak: 0, closeGames: 0, lastOpponent: null },
    directorEvents: [],
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
  const eventModule = new Function(
    'window',
    'STATE',
    'LEAGUE_PLAYER_DATA',
    'addProfileDelta',
    'getCareerProfile',
    'getBondedTeammateName',
    'ensureSeasonEventState',
    `${indexSource.slice(registryStart, registryEnd)}\nreturn { EVENT_REGISTRY, checkRandomEvents, getRandomEventLane, initializeSeasonNarrative };`,
  )({}, state, {
    HOME: [{ id: 'home-star', cname: '故事队友', ovr: 87 }, { id: 'home-wing', cname: '轮换队友', ovr: 82 }],
    AWAY: [{ id: 'active-rival', cname: '现役宿敌', ovr: 90 }],
  }, addProfileDelta, profile, () => '测试队友', ensureEventState);

  const registry = eventModule.EVENT_REGISTRY;
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

  registry.splice(0, registry.length, {
    id: 'validation_suspension',
    lane: 'discipline',
    weight: 1,
    condition: () => true,
    execute: () => ({
      emoji: '🧪', title: '测试禁赛', body: '验证调度', desc: '测试原因',
      _consequence: 'suspension', _games: 2,
    }),
  });
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
  } finally {
    Math.random = originalRandom;
  }
}

if (!/const eventTeamEdge = getActiveEventTeamEdge\(teamA, teamB\)/.test(indexSource)) {
  failures.push('事件短期效果没有接入比赛预期分差');
}
if (!/finalizeRandomEventChoice\(data, choice, resultText\)/.test(indexSource)) {
  failures.push('互动事件选择没有接入弹窗结算');
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
  }));
}
