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
  for (const key of ['lastTriggerByLane', 'eventCounts', 'opponentHistory', 'activeEffects']) {
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
    version: 2,
    suspensionGamesLeft: 0, suspensionReason: '', injuryGamesLeft: 0, injuryReason: '',
    triggeredIds: [], storyTimeline: [], lastTriggerGameNum: null, lastTriggerByLane: {}, eventCounts: {},
    playoffEventCount: 0, injuryRiskBonus: Number(injuryRiskBonus) || 0, majorInjuryThisSeason: false,
    playThroughPrompted: {}, regularPlayThroughPromptCount: 0, opponentHistory: {}, activeEffects: [],
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
    'addProfileDelta',
    'getCareerProfile',
    'getBondedTeammateName',
    'ensureSeasonEventState',
    `${indexSource.slice(registryStart, registryEnd)}\nreturn { EVENT_REGISTRY, checkRandomEvents, getRandomEventLane };`,
  )({}, state, addProfileDelta, profile, () => '测试队友', ensureEventState);

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
  }));
}
