const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inlineScripts = [...indexSource.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
inlineScripts.forEach((match, index) => {
  const attributes = match[1] || '';
  const source = match[2] || '';
  if (/\bsrc\s*=/.test(attributes) || /application\/json/.test(attributes) || !source.trim()) return;
  try {
    parser.parse(source, { sourceType: 'script', plugins: ['optionalChaining', 'objectRestSpread'] });
  } catch (error) {
    throw new Error(`index.html 第 ${index + 1} 个内联脚本语法错误：${error.message}`);
  }
});

function validateHistoricCelebrationUi(source) {
  const start = source.indexOf('/** 70+、80+、四双、五双等历史级比赛按顺序庆祝');
  const end = source.indexOf('/** 将一场联盟比赛的 Box Score 累计到球员赛季统计。', start);
  if (start < 0 || end < 0) throw new Error('无法定位历史级单场庆祝逻辑');

  const elements = {};
  let focusCount = 0;
  const fakeDocument = {
    body: {
      appendChild(element) { elements[element.id] = element; },
    },
    getElementById(id) { return elements[id] || null; },
    createElement() {
      return {
        id: '', className: '', innerHTML: '', attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener() {},
        querySelector(selector) { return selector === '.historic-stat-action' ? { focus() { focusCount++; } } : null; },
        remove() { delete elements[this.id]; },
      };
    },
  };
  const testState = { season: {} };
  const harness = new Function(
    'document', 'STATE', 'getTeamName', 'getMyPlayerDisplayName', 'setTimeout',
    `${source.slice(start, end)}\nreturn { getHistoricStatAchievement, queueHistoricStatCelebrations, closeHistoricStatCelebration };`,
  )(fakeDocument, testState, team => `球队-${team}`, () => '我的球员', callback => callback());

  const quadrupleRow = { name: '<四双球员>', playerId: 'quad', pts: 24, reb: 12, ast: 11, stl: 10, blk: 3 };
  const quadrupleQueued = harness.queueHistoricStatCelebrations({ AAA: [quadrupleRow] }, 'quad-game', { includeUser: false });
  const quadrupleOverlay = elements['historic-stat-celebration'];
  if (quadrupleQueued !== 1 || !quadrupleOverlay || quadrupleOverlay.className.includes('is-quintuple')) {
    throw new Error('四双庆祝画面未正确生成');
  }
  if (!quadrupleOverlay.innerHTML.includes('历史级四双') || !quadrupleOverlay.innerHTML.includes('&lt;四双球员&gt;') || !quadrupleOverlay.innerHTML.includes('24')) {
    throw new Error('四双庆祝画面缺少标题、球员或数据');
  }
  const duplicateQueued = harness.queueHistoricStatCelebrations({ AAA: [quadrupleRow] }, 'quad-game', { includeUser: false });
  if (duplicateQueued !== 0) throw new Error('同一场四双被重复加入庆祝队列');
  harness.closeHistoricStatCelebration();

  const quintupleRow = { name: '五双球员', playerId: 'quint', _isUser: true, pts: 20, reb: 10, ast: 10, stl: 10, blk: 10 };
  const quintupleQueued = harness.queueHistoricStatCelebrations({ BBB: [quintupleRow] }, 'quint-game', { userOnly: true });
  const quintupleOverlay = elements['historic-stat-celebration'];
  if (quintupleQueued !== 1 || !quintupleOverlay || !quintupleOverlay.className.includes('is-quintuple')) {
    throw new Error('五双庆祝主题未正确生成');
  }
  if (!quintupleOverlay.innerHTML.includes('极限五双') || !quintupleOverlay.innerHTML.includes('5×10') || !quintupleOverlay.innerHTML.includes('铭记这一夜')) {
    throw new Error('五双庆祝画面缺少标题、标记或关闭操作');
  }
  harness.closeHistoricStatCelebration();

  const seventyRow = { name: '七十分球员', playerId: 'seventy', pts: 70, reb: 8, ast: 6, stl: 2, blk: 1 };
  const seventyQueued = harness.queueHistoricStatCelebrations({ CCC: [seventyRow] }, 'seventy-game', { includeUser: false });
  const seventyOverlay = elements['historic-stat-celebration'];
  if (seventyQueued !== 1 || !seventyOverlay || !seventyOverlay.className.includes('is-seventy')) {
    throw new Error('70+ 得分庆祝主题未正确生成');
  }
  if (!seventyOverlay.innerHTML.includes('传奇得分之夜') || !seventyOverlay.innerHTML.includes('70+')) {
    throw new Error('70+ 得分庆祝画面缺少标题或标记');
  }
  harness.closeHistoricStatCelebration();

  const eightyRow = { name: '八十分球员', playerId: 'eighty', pts: 84, reb: 7, ast: 5, stl: 1, blk: 0 };
  const eightyQueued = harness.queueHistoricStatCelebrations({ DDD: [eightyRow] }, 'eighty-game', { includeUser: false });
  const eightyOverlay = elements['historic-stat-celebration'];
  if (eightyQueued !== 1 || !eightyOverlay || !eightyOverlay.className.includes('is-eighty')) {
    throw new Error('80+ 得分庆祝主题未正确生成');
  }
  if (!eightyOverlay.innerHTML.includes('史诗得分之夜') || !eightyOverlay.innerHTML.includes('80+')) {
    throw new Error('80+ 得分庆祝画面缺少标题或标记');
  }
  harness.closeHistoricStatCelebration();

  if (harness.getHistoricStatAchievement({ pts: 69, reb: 9, ast: 9, stl: 2, blk: 1 }) !== null) {
    throw new Error('69 分普通比赛不应触发历史级庆祝');
  }
  if (focusCount !== 4) throw new Error('庆祝画面的主要操作未自动获得焦点');
}

validateHistoricCelebrationUi(indexSource);

function assertInvariant(condition, message) {
  if (!condition) throw new Error(message);
}

function validateLineupFallbackAndStatRecording(source) {
  const lineupStart = source.indexOf('function getPlayerPositions');
  const lineupEnd = source.indexOf('function getTeamLineupOvr', lineupStart);
  const statStart = source.indexOf('function normalizeLeaguePlayerSeasonStats');
  const statEnd = source.indexOf('/** 模拟到目前为止所有未处理的比赛日', statStart);
  if (lineupStart < 0 || lineupEnd < 0 || statStart < 0 || statEnd < 0) {
    throw new Error('无法定位首发补位或联盟统计累计逻辑');
  }

  const lineupState = { careerTeam: null, position: null, finalOVR: 0, season: { isPlayoffs: false } };
  const lineupData = {
    TEST: [
      { id: 'pg', cname: '控卫', pos: 'PG', ovr: 80 },
      { id: 'sg', cname: '分卫', pos: 'SG', ovr: 79 },
      { id: 'pf1', cname: '大前锋一号', pos: 'PF', ovr: 78 },
      { id: 'c', cname: '中锋', pos: 'C', ovr: 77 },
      { id: 'pf2', cname: '大前锋二号', pos: 'PF', ovr: 76 },
    ],
  };
  const calcLineup = new Function(
    'STATE', 'LEAGUE_PLAYER_DATA', 'getMyPlayerDisplayName',
    `${source.slice(lineupStart, lineupEnd)}\nreturn calcTeamLineup;`,
  )(lineupState, lineupData, () => '验证球员');
  const fallbackLineup = calcLineup('TEST');
  const starterIds = Object.values(fallbackLineup.starters).map(player => player.id);
  assertInvariant(starterIds.length === 5, '缺少位置时没有补足五名首发');
  assertInvariant(new Set(starterIds).size === 5, '补位首发重复使用了同一名球员');
  assertInvariant(fallbackLineup.starters.SF && fallbackLineup.starters.SF.id === 'pf2', '缺位没有由剩余最高总评球员补上');

  const duplicateIdData = {
    TEST: lineupData.TEST.concat([{ id: 'pg', cname: '控卫重复项', pos: 'PG', ovr: 99 }]),
  };
  const calcDuplicateLineup = new Function(
    'STATE', 'LEAGUE_PLAYER_DATA', 'getMyPlayerDisplayName',
    `${source.slice(lineupStart, lineupEnd)}\nreturn calcTeamLineup;`,
  )(lineupState, duplicateIdData, () => '验证球员');
  const duplicateIdLineup = calcDuplicateLineup('TEST');
  assertInvariant(
    duplicateIdLineup.allPlayers.filter(player => player.id === 'pg').length === 1,
    '重复写入同一球员 ID 时，阵容没有去重',
  );

  const statState = {
    career: { seasonCount: 1 },
    season: { leaguePlayerSeasonStats: {}, _recordedLeagueGameIds: {} },
  };
  const statData = { TEST: lineupData.TEST };
  const statRecorder = new Function(
    'STATE', 'LEAGUE_PLAYER_DATA',
    `${source.slice(statStart, statEnd)}\nreturn { normalizeLeaguePlayerSeasonStats, recordLeagueBoxScore };`,
  )(statState, statData);
  const boxScore = {
    TEST: starterIds.map((playerId, index) => ({
      playerId, name: statData.TEST.find(player => player.id === playerId).cname,
      mins: 30, pts: 10 + index, reb: 4, ast: 3, stl: 1, blk: 1, tov: 2,
      fgm: 4, fga: 9, threeM: 1, threeA: 3, ftm: 1, fta: 2,
    })),
  };
  statRecorder.recordLeagueBoxScore(boxScore, 'regular:1');
  statRecorder.recordLeagueBoxScore(boxScore, 'regular:1');
  starterIds.forEach(playerId => {
    const row = statState.season.leaguePlayerSeasonStats[`TEST:${playerId}`];
    assertInvariant(row && row.gp === 1 && row.pts > 0, `首发 ${playerId} 没有正确累计单场 NPC 数据`);
  });

  for (let game = 2; game <= 90; game++) statRecorder.recordLeagueBoxScore(boxScore, `regular:${game}`);
  starterIds.forEach(playerId => {
    const row = statState.season.leaguePlayerSeasonStats[`TEST:${playerId}`];
    assertInvariant(row.gp === 82, `首发 ${playerId} 的常规赛出场数没有限制在 82 场`);
  });

  const sameNameState = {
    career: { seasonCount: 1 },
    season: { leaguePlayerSeasonStats: {}, _recordedLeagueGameIds: {} },
  };
  const sameNameData = {
    TEST: [
      { id: 'haggerty-starter', cname: '哈格蒂', pos: 'SG', ovr: 88 },
      { id: 'haggerty-bench', cname: '哈格蒂', pos: 'SG', ovr: 89 },
    ],
  };
  const sameNameRecorder = new Function(
    'STATE', 'LEAGUE_PLAYER_DATA',
    `${source.slice(statStart, statEnd)}\nreturn { recordLeagueBoxScore };`,
  )(sameNameState, sameNameData);
  sameNameRecorder.recordLeagueBoxScore({
    TEST: [{ playerId: 'haggerty-bench', name: '哈格蒂', mins: 28, pts: 21 }],
  }, 'same-name:1');
  assertInvariant(
    !sameNameState.season.leaguePlayerSeasonStats['TEST:haggerty-starter']
      && sameNameState.season.leaguePlayerSeasonStats['TEST:haggerty-bench']?.pts === 21,
    '同名球员的统计没有按 playerId 归属',
  );
  sameNameRecorder.recordLeagueBoxScore({
    TEST: [{ playerId: 'stale-player-id', name: '哈格蒂', mins: 28, pts: 21 }],
  }, 'same-name:2');
  assertInvariant(
    sameNameState.season.leaguePlayerSeasonStats['TEST:haggerty-bench'].gp === 1,
    '失效 playerId 的同名旧数据被错误归属',
  );

  const corrupted = statState.season.leaguePlayerSeasonStats['TEST:pg'];
  corrupted.gp = 101;
  corrupted.pts = 2020;
  corrupted.min = 3030;
  statRecorder.normalizeLeaguePlayerSeasonStats();
  assertInvariant(corrupted.gp === 82 && corrupted.pts === 1640 && corrupted.min === 2460, '旧存档的重复 NPC 统计没有按场均修复');
}

validateLineupFallbackAndStatRecording(indexSource);

function validateGeneratedRookieCandidateMigration(source) {
  const migrationStart = source.indexOf('function normalizeLegacyGeneratedRookieLabels');
  const migrationEnd = source.indexOf('function rngReset', migrationStart);
  if (migrationStart < 0 || migrationEnd < 0) {
    throw new Error('无法定位新秀候选人存档迁移逻辑');
  }
  const state = {
    season: {
      leaguePlayerSeasonStats: {
        'TEST:r-2': { playerId: 'r-2', playerName: '哈格蒂', gp: 1, pts: 12 },
      },
    },
  };
  const data = {
    TEST: [
      { id: 'r-1', cname: '哈格蒂', _prospectId: 'D084' },
      { id: 'r-2', cname: '哈格蒂（2）', _prospectId: 'D084', _rookieBaseName: '哈格蒂' },
    ],
  };
  const migration = new Function(
    'STATE', 'LEAGUE_PLAYER_DATA', 'LEAGUE_TEAM_IDS',
    `var _usedRookieCandidateNames = {};\n${source.slice(migrationStart, migrationEnd)}\nreturn { normalizeLegacyGeneratedRookieLabels, restoreUsedRookieCandidatesFromLeague, used: function() { return _usedRookieCandidateNames; } };`,
  )(state, data, ['TEST']);
  migration.normalizeLegacyGeneratedRookieLabels();
  migration.restoreUsedRookieCandidatesFromLeague();
  assertInvariant(
    migration.used().D084 && data.TEST[0].cname === '哈格蒂' && data.TEST[1].cname === '哈格蒂' && !data.TEST[1]._rookieBaseName,
    '旧存档没有回填新秀候选池，或未清理错误的新秀显示名',
  );
}

validateGeneratedRookieCandidateMigration(indexSource);

const dataSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const leagueData = new Function(`${dataSource}\nreturn { LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS };`)();
const blockStart = indexSource.indexOf('function leagueStatClamp');
const blockEnd = indexSource.indexOf('/** 属性→效率系数：递减曲线', blockStart);

if (blockStart < 0 || blockEnd < 0) throw new Error('无法定位联盟球员统计模拟代码');

function loadUserStatsReader(source) {
  const start = source.indexOf('function generatePlayerStatsNew');
  const end = source.indexOf('function calcShotPct', start);
  if (start < 0 || end < 0) throw new Error('无法定位用户球员统计读取代码');
  return new Function(`${source.slice(start, end)}\nreturn generatePlayerStatsNew;`)();
}

const userStatsReaders = [loadUserStatsReader(indexSource)];
const sharedBoxScoreSample = {
  boxScore: {
    WAS: [{ _isUser: true, pts: 27, reb: 4, ast: 9, stl: 2, blk: 1, tov: 3, fgm: 10, fga: 19, ftm: 3, fta: 4, threeM: 4, threeA: 9, mins: 36 }],
  },
};
userStatsReaders.forEach(reader => {
  const stats = reader({}, sharedBoxScoreSample, false);
  if (stats.pts !== 27 || stats.ast !== 9 || stats.mins !== 36 || stats.threeM !== 4) {
    throw new Error('用户赛季统计没有直接读取整队 Box Score');
  }
});

const state = { season: { isPlayoffs: false } };
const attrFactor = value => {
  const bounded = Math.max(25, Math.min(99, value || 50));
  return Math.pow((bounded - 25) / 74, 0.85);
};
const af = value => Math.pow(attrFactor(value), 1.5);
const canPlay = (rawPosition, position) => String(rawPosition || '')
  .split('/')
  .map(value => value.trim())
  .includes(position);

function calcTeamLineup(team) {
  const allPlayers = (leagueData.LEAGUE_PLAYER_DATA[team] || []).slice();
  const starters = {};
  const assigned = new Set();

  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(position => {
    let bestIndex = -1;
    let bestOvr = -1;
    allPlayers.forEach((player, index) => {
      const ovr = parseInt(player.ovr, 10) || 0;
      if (!assigned.has(index) && canPlay(player.pos, position) && ovr > bestOvr) {
        bestIndex = index;
        bestOvr = ovr;
      }
    });
    if (bestIndex < 0) {
      allPlayers.forEach((player, index) => {
        const ovr = parseInt(player.ovr, 10) || 0;
        if (!assigned.has(index) && ovr > bestOvr) {
          bestIndex = index;
          bestOvr = ovr;
        }
      });
    }
    if (bestIndex >= 0) {
      starters[position] = allPlayers[bestIndex];
      assigned.add(bestIndex);
    }
  });

  const bench = allPlayers
    .filter((player, index) => !assigned.has(index))
    .sort((a, b) => (parseInt(b.ovr, 10) || 0) - (parseInt(a.ovr, 10) || 0));
  return { starters, bench, allPlayers };
}

const simulationSource = indexSource.slice(blockStart, blockEnd);
const simulation = new Function(
  'STATE',
  'af',
  'calcTeamLineup',
  'getLeaguePlayerAge',
  `${simulationSource}\nreturn { generateBoxScore, syncUserStatsToBoxScore, allocateLeagueCountingTotal, allocateLeagueRotationMinutes, buildLeagueGameRotation, buildExpectedLeagueGameRotation, getLeagueScoringBurst, LEAGUE_SCORING_BURST_RATES, getLeagueVersatilityBurst, applyLeagueVersatilityBurst, LEAGUE_VERSATILITY_BURST_RATES };`,
)(state, af, calcTeamLineup, player => Number(player._age) || 27);

const exactCapAllocation = simulation.allocateLeagueCountingTotal(3, [3, 2, 1], [1, 1, 1]);
assertInvariant(exactCapAllocation.reduce((sum, value) => sum + value, 0) === 3 && exactCapAllocation.every(value => value === 1), '合法硬 cap 分配错误');
let insufficientCapRejected = false;
try {
  simulation.allocateLeagueCountingTotal(4, [3, 2, 1], [1, 1, 1]);
} catch (error) {
  insufficientCapRejected = /\u786c\u4e0a\u9650\u5bb9\u91cf/.test(error.message);
}
assertInvariant(insufficientCapRejected, 'caps 容量不足时仍突破球员硬上限');

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function inspectBoxScore(boxScore, teamA, scoreA, teamB, scoreB) {
  let errors = 0;
  const summaries = {};
  [[teamA, scoreA], [teamB, scoreB]].forEach(([team, score]) => {
    const rows = boxScore[team] || [];
    const sum = field => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
    summaries[team] = {
      pts: sum('pts'), mins: sum('mins'), fgm: sum('fgm'), fga: sum('fga'),
      threeM: sum('threeM'), threeA: sum('threeA'), ftm: sum('ftm'), fta: sum('fta'),
      reb: sum('reb'), ast: sum('ast'), stl: sum('stl'), blk: sum('blk'), tov: sum('tov'),
    };
    if (summaries[team].pts !== score || summaries[team].mins !== 240 || summaries[team].ast > summaries[team].fgm) errors++;
    rows.forEach(row => {
      const fields = ['pts','mins','fgm','fga','threeM','threeA','ftm','fta','reb','ast','stl','blk','tov'];
      if (fields.some(field => !Number.isFinite(Number(row[field])) || Number(row[field]) < 0)) errors++;
      if (row.fgm > row.fga || row.threeM > row.threeA || row.ftm > row.fta || row.threeA > row.fga || row.threeM > row.fgm) errors++;
      if (row.pts !== 2 * (row.fgm - row.threeM) + 3 * row.threeM + row.ftm) errors++;
    });
  });
  if (summaries[teamA].stl > summaries[teamB].tov || summaries[teamB].stl > summaries[teamA].tov) errors++;
  const totalMisses = (summaries[teamA].fga - summaries[teamA].fgm) + (summaries[teamB].fga - summaries[teamB].fgm);
  if (summaries[teamA].reb + summaries[teamB].reb > totalMisses) errors++;
  return { errors, summaries };
}

function percentile(sortedValues, ratio) {
  if (!sortedValues.length) return 0;
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * ratio))];
}

function summarizeReconciliation(deltas, budgetRebalances, actionTotals) {
  const absolute = deltas.map(value => Math.abs(value)).sort((a, b) => a - b);
  const count = Math.max(1, absolute.length);
  const within = (min, max) => absolute.filter(value => value >= min && value <= max).length / count;
  return {
    samples: absolute.length,
    meanSigned: deltas.reduce((sum, value) => sum + value, 0) / count,
    meanAbs: absolute.reduce((sum, value) => sum + value, 0) / count,
    p50: percentile(absolute, 0.50), p90: percentile(absolute, 0.90),
    p95: percentile(absolute, 0.95), p99: percentile(absolute, 0.99),
    max: absolute[absolute.length - 1] || 0,
    zeroRate: within(0, 0), oneToTwoRate: within(1, 2), threeToFiveRate: within(3, 5),
    sixToTenRate: within(6, 10), overTenRate: absolute.filter(value => value > 10).length / count,
    budgetRebalances,
    actionTotals,
  };
}

function runSeason(seed) {
  const originalRandom = Math.random;
  Math.random = seededRandom(seed);
  state.season = { isPlayoffs: false };
  const totals = {};
  const teamAssistTotals = [];
  const scoringBursts = { fiftyPlus: 0, sixtyPlus: 0, seventyPlus: 0, eightyPlus: 0, max: 0 };
  const versatilityBursts = { quadruple: 0, quintuple: 0 };
  const shootingTotals = { fgm: 0, fga: 0, threeM: 0, threeA: 0, ftm: 0, fta: 0 };
  const signatureCounts = {};
  const reconciliationDeltas = [];
  const reconciliationActions = {};
  let budgetRebalances = 0;
  let gamesValidated = 0;
  let invariantErrors = 0;

  try {
    const teams = leagueData.LEAGUE_TEAM_IDS;
    for (let round = 0; round < 82; round++) {
      for (let pair = 0; pair < teams.length; pair += 2) {
        const teamA = teams[(pair + round) % teams.length];
        const teamB = teams[(pair + round + 1) % teams.length];
        const scoreA = 102 + Math.floor(Math.random() * 21);
        const scoreB = 102 + Math.floor(Math.random() * 21);
        const boxScore = simulation.generateBoxScore(teamA, teamB, scoreA, scoreB);
        const inspection = inspectBoxScore(boxScore, teamA, scoreA, teamB, scoreB);
        invariantErrors += inspection.errors;
        gamesValidated++;
        [teamA, teamB].forEach(team => {
          const diagnostics = boxScore._diagnostics && boxScore._diagnostics[team];
          if (!diagnostics) { invariantErrors++; return; }
          reconciliationDeltas.push(diagnostics.reconcileDelta);
          if (diagnostics.budgetRebalanced) budgetRebalances++;
          Object.entries(diagnostics.actions || {}).forEach(([action, count]) => {
            reconciliationActions[action] = (reconciliationActions[action] || 0) + count;
          });
        });

        [[teamA, scoreA], [teamB, scoreB]].forEach(([team, score]) => {
          const rows = boxScore[team] || [];
          const sum = field => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
          if (sum('pts') !== score || sum('mins') !== 240) invariantErrors++;
          teamAssistTotals.push(sum('ast'));
          rows.forEach(row => {
            const points = Number(row.pts) || 0;
            scoringBursts.max = Math.max(scoringBursts.max, points);
            if (points >= 50) scoringBursts.fiftyPlus++;
            if (points >= 60) scoringBursts.sixtyPlus++;
            if (points >= 70) scoringBursts.seventyPlus++;
            if (points >= 80) scoringBursts.eightyPlus++;
            const doubleDigitCategories = ['pts', 'reb', 'ast', 'stl', 'blk']
              .filter(field => (Number(row[field]) || 0) >= 10).length;
            if (doubleDigitCategories >= 4) versatilityBursts.quadruple++;
            if (doubleDigitCategories >= 5) versatilityBursts.quintuple++;
            if (row._isUser) return;
            const key = `${team}:${row.playerId}`;
            const record = totals[key] || (totals[key] = {
              id: row.playerId, name: row.name, team, gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0,
              fgm: 0, fga: 0, threeM: 0, threeA: 0, ftm: 0, fta: 0,
            });
            record.gp++;
            ['pts', 'reb', 'ast', 'stl', 'blk'].forEach(field => { record[field] += row[field] || 0; });
            ['fgm','fga','threeM','threeA','ftm','fta'].forEach(field => {
              record[field] += row[field] || 0;
              shootingTotals[field] += row[field] || 0;
            });
            if (team === 'WAS' && row.playerId === 'P0510') {
              const signature = ['pts','reb','ast','stl','blk','fgm','fga','threeM','threeA','ftm','fta'].map(field => row[field]).join(':');
              signatureCounts[signature] = (signatureCounts[signature] || 0) + 1;
            }
          });
        });
      }
    }
  } finally {
    Math.random = originalRandom;
  }

  const rows = Object.values(totals).map(record => {
    const result = { ...record };
    ['pts', 'reb', 'ast', 'stl', 'blk'].forEach(field => {
      result[field] = Math.round(record[field] / record.gp * 10) / 10;
    });
    result.fgaPerGame = record.fga / record.gp;
    result.ftaPerGame = record.fta / record.gp;
    return result;
  });
  const qualified = rows.filter(row => row.gp >= 58);
  const leaders = {};
  ['pts', 'reb', 'ast', 'stl', 'blk'].forEach(field => {
    leaders[field] = qualified.slice().sort((a, b) => b[field] - a[field]).slice(0, 10);
  });

  return {
    rows,
    qualified,
    leaders,
    invariantErrors,
    full82: rows.filter(row => row.gp === 82).length,
    averageTeamAssists: teamAssistTotals.reduce((sum, value) => sum + value, 0) / teamAssistTotals.length,
    gamesValidated,
    shootingPct: {
      fg: shootingTotals.fgm / Math.max(1, shootingTotals.fga),
      three: shootingTotals.threeM / Math.max(1, shootingTotals.threeA),
      ft: shootingTotals.ftm / Math.max(1, shootingTotals.fta),
    },
    maxDuplicateSignature: Math.max(0, ...Object.values(signatureCounts)),
    reconciliation: summarizeReconciliation(reconciliationDeltas, budgetRebalances, reconciliationActions),
    scoringBursts,
    versatilityBursts,
  };
}

function topTenOverlap(first, second) {
  const ids = new Set(first.map(row => row.id));
  return second.filter(row => ids.has(row.id)).length;
}

function runUserSeason(seed) {
  const originalRandom = Math.random;
  const originalRoster = leagueData.LEAGUE_PLAYER_DATA.WAS;
  Math.random = seededRandom(seed);
  state.season = { isPlayoffs: false };
  const user = {
    id: '__validation_user__', cname: '验证球员', pos: 'PG', ovr: 91, _isUser: true,
    threePT: 95, MID: 90, FIN: 88, DNK: 82, HAN: 94, PAS: 90,
    PDEF: 85, STL: 88, IDEF: 55, BLK: 45, REB: 55, ATH: 90, STR: 65, CLU: 90,
  };
  leagueData.LEAGUE_PLAYER_DATA.WAS = originalRoster.concat(user);
  const totals = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, mins: 0, bestPts: 0 };
  let invariantErrors = 0;
  let injuryRedistributionErrors = 0;

  try {
    for (let game = 0; game < 82; game++) {
      const opponent = leagueData.LEAGUE_TEAM_IDS[(game + 1) % leagueData.LEAGUE_TEAM_IDS.length] === 'WAS'
        ? 'ATL'
        : leagueData.LEAGUE_TEAM_IDS[(game + 1) % leagueData.LEAGUE_TEAM_IDS.length];
      const teamScore = 102 + Math.floor(Math.random() * 21);
      const opponentScore = 102 + Math.floor(Math.random() * 21);
      const boxScore = simulation.generateBoxScore('WAS', opponent, teamScore, opponentScore);
      const rows = boxScore.WAS || [];
      const userRow = rows.find(row => row._isUser);
      const sum = field => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
      if (!userRow || sum('pts') !== teamScore || sum('mins') !== 240) invariantErrors++;
      if (!userRow) continue;
      totals.gp++;
      ['pts', 'reb', 'ast', 'stl', 'blk', 'mins'].forEach(field => { totals[field] += userRow[field] || 0; });
      totals.bestPts = Math.max(totals.bestPts, userRow.pts || 0);

      if (game === 0) {
        const conservedFields = ['pts','reb','ast','stl','blk','tov','mins','fgm','fga','threeM','threeA','ftm','fta'];
        const before = Object.fromEntries(conservedFields.map(field => [field, sum(field)]));
        const reduced = { ...userRow };
        ['reb','ast','stl','blk','tov','fgm','fga','threeM','threeA','ftm','fta'].forEach(field => { reduced[field] = Math.round((reduced[field] || 0) * 0.65); });
        reduced.fgm = Math.min(reduced.fgm, reduced.fga);
        reduced.threeA = Math.min(reduced.threeA, reduced.fga);
        reduced.threeM = Math.min(reduced.threeM, reduced.threeA, reduced.fgm);
        reduced.ftm = Math.min(reduced.ftm, reduced.fta);
        reduced.pts = 2 * (reduced.fgm - reduced.threeM) + 3 * reduced.threeM + reduced.ftm;
        reduced.mins = Math.max(8, Math.round((reduced.mins || 0) * 0.7));
        simulation.syncUserStatsToBoxScore({ boxScore }, reduced);
        conservedFields.forEach(field => {
          if (sum(field) !== before[field]) injuryRedistributionErrors++;
        });
        rows.forEach(row => {
          if (row.pts !== 2 * (row.fgm - row.threeM) + 3 * row.threeM + row.ftm || row.fgm > row.fga || row.threeM > row.threeA || row.threeM > row.fgm || row.ftm > row.fta) {
            injuryRedistributionErrors++;
          }
        });
      }
    }
  } finally {
    leagueData.LEAGUE_PLAYER_DATA.WAS = originalRoster;
    Math.random = originalRandom;
  }

  const averages = { gp: totals.gp, bestPts: totals.bestPts };
  ['pts', 'reb', 'ast', 'stl', 'blk', 'mins'].forEach(field => {
    averages[field] = Number((totals[field] / Math.max(1, totals.gp)).toFixed(1));
  });
  averages.invariantErrors = invariantErrors;
  averages.injuryRedistributionErrors = injuryRedistributionErrors;
  return averages;
}

function validationPlayer(id, position, overrides) {
  return Object.assign({
    id, cname: id, pos: position, ovr: 78,
    threePT: 70, MID: 70, FIN: 70, DNK: 70, HAN: 70, PAS: 70,
    PDEF: 70, STL: 70, IDEF: 70, BLK: 70, REB: 70, ATH: 70, STR: 70, CLU: 70,
  }, overrides || {});
}

function exactRotation(players, minutes) {
  return { players, roleRanks: players.map((player, index) => index), minutes };
}

function runIsolationPair(seed, label, highOverrides, lowOverrides) {
  const originalRandom = Math.random;
  const totals = {
    high: { gp: 0, pts: 0, ast: 0, tov: 0, fgm: 0, fga: 0, threeM: 0, threeA: 0 },
    low: { gp: 0, pts: 0, ast: 0, tov: 0, fgm: 0, fga: 0, threeM: 0, threeA: 0 },
  };
  const minutes = Array(10).fill(24);
  try {
    for (let orientation = 0; orientation < 2; orientation++) {
      Math.random = seededRandom(seed + orientation * 7919);
      state.season = { isPlayoffs: false };
      const high = validationPlayer(`${label}-high-${orientation}`, 'PG', highOverrides);
      const low = validationPlayer(`${label}-low-${orientation}`, 'PG', lowOverrides);
      const subjects = orientation === 0 ? [high, low] : [low, high];
      const team = subjects.concat(Array.from({ length: 8 }, (_, index) => validationPlayer(`${label}-mate-${orientation}-${index}`, ['SG','SF','PF','C'][index % 4], {})));
      const opponent = Array.from({ length: 10 }, (_, index) => validationPlayer(`${label}-opp-${orientation}-${index}`, ['PG','SG','SF','PF','C'][index % 5], {}));
      for (let game = 0; game < 300; game++) {
        const boxScore = simulation.generateBoxScore(`__${label}_TEAM__`, `__${label}_OPP__`, 110, 108, {
          _preparedRotations: {
            [`__${label}_TEAM__`]: exactRotation(team, minutes),
            [`__${label}_OPP__`]: exactRotation(opponent, minutes),
          },
        });
        (boxScore[`__${label}_TEAM__`] || []).slice(0, 2).forEach(row => {
          const bucket = row.playerId.includes('-high-') ? totals.high : totals.low;
          bucket.gp++;
          ['pts','ast','tov','fgm','fga','threeM','threeA'].forEach(field => { bucket[field] += row[field] || 0; });
        });
      }
    }
  } finally {
    Math.random = originalRandom;
  }
  function summarize(record) {
    return {
      ppg: record.pts / record.gp, apg: record.ast / record.gp, tov: record.tov / record.gp,
      fga: record.fga / record.gp, fgPct: record.fgm / Math.max(1, record.fga),
      threeA: record.threeA / record.gp, threePct: record.threeM / Math.max(1, record.threeA),
    };
  }
  return { high: summarize(totals.high), low: summarize(totals.low) };
}

function runPlaymakingIsolationValidation() {
  return {
    pass: runIsolationPair(12101, 'PASS_ISOLATION', { PAS: 95 }, { PAS: 50 }),
    handle: runIsolationPair(13101, 'HANDLE_ISOLATION', { HAN: 95 }, { HAN: 50 }),
    clutch: runIsolationPair(14101, 'CLUTCH_ISOLATION', { CLU: 95 }, { CLU: 50 }),
    organizerVsScorer: runIsolationPair(15101, 'ROLE_ISOLATION', {
      threePT: 68, MID: 68, FIN: 70, DNK: 60, HAN: 95, PAS: 95, ATH: 75, STR: 65, CLU: 70,
    }, {
      threePT: 94, MID: 92, FIN: 90, DNK: 85, HAN: 82, PAS: 65, ATH: 88, STR: 75, CLU: 70,
    }),
  };
}

function runControlledProfileValidation(seed) {
  const originalRandom = Math.random;
  const trendTeam = [
    validationPlayer('high-three', 'SG', { threePT: 95 }),
    validationPlayer('low-three', 'SG', { threePT: 55 }),
    validationPlayer('high-rebound', 'C', { REB: 95 }),
    validationPlayer('low-rebound', 'C', { REB: 50 }),
    validationPlayer('high-pass', 'PG', { PAS: 95, HAN: 90 }),
    validationPlayer('low-pass', 'PG', { PAS: 50, HAN: 50 }),
    validationPlayer('high-steal', 'SF', { STL: 95, PDEF: 90 }),
    validationPlayer('low-steal', 'SF', { STL: 50, PDEF: 50 }),
    validationPlayer('high-block', 'PF', { BLK: 95, IDEF: 90 }),
    validationPlayer('low-block', 'PF', { BLK: 50, IDEF: 50 }),
  ];
  const opponent = Array.from({ length: 10 }, (_, index) => validationPlayer(`trend-opp-${index}`, ['PG','SG','SF','PF','C'][index % 5], {}));
  const roleTeam = [
    validationPlayer('defensive-center', 'C', {
      ovr: 95, threePT: 45, MID: 50, FIN: 58, DNK: 62, HAN: 48, PAS: 55,
      PDEF: 92, STL: 82, IDEF: 97, BLK: 97, REB: 96, ATH: 82, STR: 94, CLU: 72,
    }),
    validationPlayer('offensive-guard', 'PG', {
      ovr: 88, threePT: 94, MID: 92, FIN: 91, DNK: 72, HAN: 96, PAS: 88,
      PDEF: 65, STL: 68, IDEF: 45, BLK: 40, REB: 48, ATH: 90, STR: 60, CLU: 92,
    }),
  ].concat(Array.from({ length: 8 }, (_, index) => validationPlayer(`role-mate-${index}`, ['SG','SF','PF','C'][index % 4], { ovr: 76 })));
  const trendMinutes = Array(10).fill(24);
  const roleMinutes = [36, 36].concat(Array(8).fill(21));
  const totals = {};
  [...trendTeam, ...roleTeam].forEach(player => {
    totals[player.id] = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fga: 0, threeA: 0, threeM: 0 };
  });
  leagueData.LEAGUE_PLAYER_DATA.__TREND__ = trendTeam;
  leagueData.LEAGUE_PLAYER_DATA.__ROLE__ = roleTeam;
  leagueData.LEAGUE_PLAYER_DATA.__CONTROL__ = opponent;
  Math.random = seededRandom(seed);
  state.season = { isPlayoffs: false };
  try {
    for (let game = 0; game < 600; game++) {
      const preparedTrend = {
        __TREND__: exactRotation(trendTeam, trendMinutes),
        __CONTROL__: exactRotation(opponent, trendMinutes),
      };
      const trendBox = simulation.generateBoxScore('__TREND__', '__CONTROL__', 112, 108, { _preparedRotations: preparedTrend });
      trendBox.__TREND__.forEach(row => {
        const record = totals[row.playerId];
        record.gp++;
        ['pts','reb','ast','stl','blk','fga','threeA','threeM'].forEach(field => { record[field] += row[field] || 0; });
      });
      const preparedRole = {
        __ROLE__: exactRotation(roleTeam, roleMinutes),
        __CONTROL__: exactRotation(opponent, trendMinutes),
      };
      const roleBox = simulation.generateBoxScore('__ROLE__', '__CONTROL__', 112, 108, { _preparedRotations: preparedRole });
      roleBox.__ROLE__.slice(0, 2).forEach(row => {
        const record = totals[row.playerId];
        record.gp++;
        ['pts','reb','ast','stl','blk','fga','threeA','threeM'].forEach(field => { record[field] += row[field] || 0; });
      });
    }
  } finally {
    Math.random = originalRandom;
    delete leagueData.LEAGUE_PLAYER_DATA.__TREND__;
    delete leagueData.LEAGUE_PLAYER_DATA.__ROLE__;
    delete leagueData.LEAGUE_PLAYER_DATA.__CONTROL__;
  }
  const perGame = id => Object.fromEntries(Object.entries(totals[id]).map(([field, value]) => [field, field === 'gp' ? value : value / Math.max(1, totals[id].gp)]));
  const highThree = perGame('high-three');
  const lowThree = perGame('low-three');
  const defensiveCenter = perGame('defensive-center');
  const offensiveGuard = perGame('offensive-guard');
  return {
    games: 600,
    three: {
      highAttempts: highThree.threeA, lowAttempts: lowThree.threeA,
      highPct: totals['high-three'].threeM / Math.max(1, totals['high-three'].threeA),
      lowPct: totals['low-three'].threeM / Math.max(1, totals['low-three'].threeA),
    },
    rebound: { high: perGame('high-rebound').reb, low: perGame('low-rebound').reb },
    assist: { high: perGame('high-pass').ast, low: perGame('low-pass').ast },
    steal: { high: perGame('high-steal').stl, low: perGame('low-steal').stl },
    block: { high: perGame('high-block').blk, low: perGame('low-block').blk },
    role: {
      defensiveCenter: { ovr: 95, fga: defensiveCenter.fga, pts: defensiveCenter.pts },
      offensiveGuard: { ovr: 88, fga: offensiveGuard.fga, pts: offensiveGuard.pts },
    },
  };
}

function validateDeterministicBoxScore(seed) {
  const originalRandom = Math.random;
  const teamA = Array.from({ length: 10 }, (_, index) => validationPlayer(`seed-a-${index}`, ['PG','SG','SF','PF','C'][index % 5], { ovr: 76 + index }));
  const teamB = Array.from({ length: 10 }, (_, index) => validationPlayer(`seed-b-${index}`, ['PG','SG','SF','PF','C'][index % 5], { ovr: 85 - index }));
  const minutes = Array(10).fill(24);
  const generate = () => {
    Math.random = seededRandom(seed);
    state.season = { isPlayoffs: false };
    return simulation.generateBoxScore('__SEED_A__', '__SEED_B__', 113, 109, {
      _preparedRotations: {
        __SEED_A__: exactRotation(teamA, minutes),
        __SEED_B__: exactRotation(teamB, minutes),
      },
    });
  };
  let first;
  let second;
  try {
    first = generate();
    second = generate();
  } finally {
    Math.random = originalRandom;
  }
  return JSON.stringify(first) === JSON.stringify(second);
}

function validateExplicitBudgetRebalance(seed) {
  const originalRandom = Math.random;
  const teamA = Array.from({ length: 10 }, (_, index) => validationPlayer(`budget-a-${index}`, ['PG','SG','SF','PF','C'][index % 5], {}));
  const teamB = Array.from({ length: 10 }, (_, index) => validationPlayer(`budget-b-${index}`, ['PG','SG','SF','PF','C'][index % 5], {}));
  const minutes = Array(10).fill(24);
  Math.random = seededRandom(seed);
  state.season = { isPlayoffs: false };
  try {
    const boxScore = simulation.generateBoxScore('__BUDGET_A__', '__BUDGET_B__', 300, 300, {
      _preparedRotations: {
        __BUDGET_A__: exactRotation(teamA, minutes),
        __BUDGET_B__: exactRotation(teamB, minutes),
      },
    });
    const diagnostics = boxScore._diagnostics && boxScore._diagnostics.__BUDGET_A__;
    const totalPoints = boxScore.__BUDGET_A__.reduce((sum, row) => sum + row.pts, 0);
    return {
      totalPoints,
      hiddenMetadata: !Object.keys(boxScore).includes('_diagnostics'),
      budgetRebalanced: !!(diagnostics && diagnostics.budgetRebalanced),
      budgetActions: diagnostics && diagnostics.budgetActions || {},
      finalPts: diagnostics && diagnostics.finalPts,
    };
  } finally {
    Math.random = originalRandom;
  }
}

function validateSixthManMinutes() {
  const players = [
    validationPlayer('starter-94-a', 'PG', { ovr: 94 }),
    validationPlayer('starter-84', 'SG', { ovr: 84 }),
    validationPlayer('starter-94-b', 'SF', { ovr: 94 }),
    validationPlayer('starter-94-c', 'PF', { ovr: 94 }),
    validationPlayer('starter-95', 'C', { ovr: 95 }),
    validationPlayer('sixth-91', 'SG', { ovr: 91 }),
    validationPlayer('bench-78', 'PG', { ovr: 78 }),
    validationPlayer('bench-77', 'SF', { ovr: 77 }),
    validationPlayer('bench-76', 'PF', { ovr: 76 }),
    validationPlayer('bench-75', 'C', { ovr: 75 }),
  ];
  const roleRanks = players.map((_, index) => index);
  const regular = simulation.allocateLeagueRotationMinutes(players, roleRanks, { isPlayoffs: false, randomize: false });
  const playoffs = simulation.allocateLeagueRotationMinutes(players, roleRanks, { isPlayoffs: true, randomize: false });
  const capPlayers = players.map((player, index) => Object.assign({}, player, { ovr: index === 5 ? 99 : 60 }));
  const capped = simulation.allocateLeagueRotationMinutes(capPlayers, roleRanks, { isPlayoffs: false, randomize: false });
  const cappedPlayoffs = simulation.allocateLeagueRotationMinutes(capPlayers, roleRanks, { isPlayoffs: true, randomize: false });
  const activePlayers = [
    validationPlayer('active-starter-pg', 'PG', { ovr: 94 }),
    validationPlayer('active-starter-sg', 'SG', { ovr: 94 }),
    validationPlayer('active-starter-sf', 'SF', { ovr: 94 }),
    validationPlayer('active-starter-pf', 'PF', { ovr: 94 }),
    validationPlayer('active-starter-c', 'C', { ovr: 84 }),
    validationPlayer('active-sixth-91', 'PG', { ovr: 91 }),
    validationPlayer('active-bench-78', 'SG', { ovr: 78 }),
    validationPlayer('active-bench-77', 'SF', { ovr: 77 }),
    validationPlayer('active-bench-76', 'PF', { ovr: 76 }),
    validationPlayer('active-bench-75', 'C', { ovr: 75 }),
  ];
  const originalRandom = Math.random;
  leagueData.LEAGUE_PLAYER_DATA.__SIXTH_ACTIVE__ = activePlayers;
  let expectedRotation;
  let activeRotation;
  let activeMinutes;
  let expectedSixthIndex;
  let activeSixthIndex;
  let sixthFga = 0;
  let weakStarterFga = 0;
  try {
    state.season = { isPlayoffs: false, _npcSeasonProfiles: {} };
    expectedRotation = simulation.buildExpectedLeagueGameRotation('__SIXTH_ACTIVE__', { isPlayoffs: false });
    expectedSixthIndex = expectedRotation.players.findIndex(player => player.id === 'active-sixth-91');
    // 使用正式伤停档案让指定首发缺阵；其余球员在固定随机数下保持可出场。
    state.season._npcSeasonProfiles['__SIXTH_ACTIVE__:active-starter-pg'] = {
      scoring: 1, rebounding: 1, playmaking: 1, defense: 1, formGamesLeft: 1,
      injuryGamesLeft: 1, gamesMissed: 0, restChance: 0, injuryRisk: 0,
    };
    Math.random = () => 0.2;
    activeRotation = simulation.buildLeagueGameRotation('__SIXTH_ACTIVE__');
    activeMinutes = simulation.allocateLeagueRotationMinutes(activeRotation.players, activeRotation.roleRanks, { isPlayoffs: false, randomize: false });
    activeSixthIndex = activeRotation.players.findIndex(player => player.id === 'active-sixth-91');

    Math.random = seededRandom(16401);
    for (let game = 0; game < 400; game++) {
      const boxScore = simulation.generateBoxScore('__SIXTH_USAGE__', '__SIXTH_OPP__', 112, 108, {
        _preparedRotations: {
          __SIXTH_USAGE__: exactRotation(players, regular),
          __SIXTH_OPP__: exactRotation(players, regular),
        },
      });
      const rows = boxScore.__SIXTH_USAGE__;
      sixthFga += rows.find(row => row.playerId === 'sixth-91').fga;
      weakStarterFga += rows.find(row => row.playerId === 'starter-84').fga;
    }
  } finally {
    Math.random = originalRandom;
    delete leagueData.LEAGUE_PLAYER_DATA.__SIXTH_ACTIVE__;
  }
  return {
    regular: { total: regular.reduce((sum, minutes) => sum + minutes, 0), weakStarter: regular[1], sixth: regular[5] },
    playoffs: { total: playoffs.reduce((sum, minutes) => sum + minutes, 0), weakStarter: playoffs[1], sixth: playoffs[5] },
    cap: { total: capped.reduce((sum, minutes) => sum + minutes, 0), sixth: capped[5] },
    playoffCap: { total: cappedPlayoffs.reduce((sum, minutes) => sum + minutes, 0), sixth: cappedPlayoffs[5] },
    activeReplacement: {
      expectedSixthIndex,
      expectedSixthRole: expectedRotation.roleRanks[expectedSixthIndex],
      activeSixthIndex,
      activeSixthRole: activeRotation.roleRanks[activeSixthIndex],
      activeSixthMinutes: activeMinutes[activeSixthIndex],
      starterAbsent: !activeRotation.players.some(player => player.id === 'active-starter-pg'),
      total: activeMinutes.reduce((sum, minutes) => sum + minutes, 0),
    },
    usage: { sixthFga: sixthFga / 400, weakStarterFga: weakStarterFga / 400 },
  };
}

const seasons = [1701, 2702, 3703, 4704, 5705, 6706].map(runSeason);
const userSeason = runUserSeason(7707);
const controlledProfiles = runControlledProfileValidation(8808);
const playmakingIsolation = runPlaymakingIsolationValidation();
const deterministicBoxScore = validateDeterministicBoxScore(9909);
const explicitBudgetRebalance = validateExplicitBudgetRebalance(10101);
const sixthManMinutes = validateSixthManMinutes();
const fields = ['pts', 'reb', 'ast', 'stl', 'blk'];
const roundIsolationPair = pair => Object.fromEntries(Object.entries(pair).map(([side, metrics]) => [
  side,
  Object.fromEntries(Object.entries(metrics).map(([field, value]) => [field, Number(value.toFixed(3))])),
]));
const averageScoringBursts = key => seasons.reduce((sum, season) => sum + season.scoringBursts[key], 0) / seasons.length;
const scoringLeaderDistribution = seasons.map((season, index) => {
  const leaders = season.leaders.pts;
  return {
    season: index + 1,
    first: leaders[0].pts,
    third: leaders[2].pts,
    tenth: leaders[9].pts,
    spread: Number((leaders[0].pts - leaders[9].pts).toFixed(1)),
    firstFga: Number(leaders[0].fgaPerGame.toFixed(1)),
    firstFta: Number(leaders[0].ftaPerGame.toFixed(1)),
  };
});
const report = {
  seasons: seasons.map((season, index) => ({
    season: index + 1,
    full82: season.full82,
    qualified: season.qualified.length,
    gamesValidated: season.gamesValidated,
    averageTeamAssists: Number(season.averageTeamAssists.toFixed(1)),
    invariantErrors: season.invariantErrors,
    shootingPct: Object.fromEntries(Object.entries(season.shootingPct).map(([key, value]) => [key, Number(value.toFixed(3))])),
    maxDuplicateSignature: season.maxDuplicateSignature,
    reconciliation: {
      samples: season.reconciliation.samples,
      meanSigned: Number(season.reconciliation.meanSigned.toFixed(2)),
      meanAbs: Number(season.reconciliation.meanAbs.toFixed(2)),
      p50: season.reconciliation.p50, p90: season.reconciliation.p90,
      p95: season.reconciliation.p95, p99: season.reconciliation.p99, max: season.reconciliation.max,
      zeroRate: Number(season.reconciliation.zeroRate.toFixed(3)),
      oneToTwoRate: Number(season.reconciliation.oneToTwoRate.toFixed(3)),
      threeToFiveRate: Number(season.reconciliation.threeToFiveRate.toFixed(3)),
      sixToTenRate: Number(season.reconciliation.sixToTenRate.toFixed(3)),
      overTenRate: Number(season.reconciliation.overTenRate.toFixed(3)),
      budgetRebalances: season.reconciliation.budgetRebalances,
      actions: season.reconciliation.actionTotals,
    },
    scoringBursts: season.scoringBursts,
    versatilityBursts: season.versatilityBursts,
    leaderRanges: Object.fromEntries(fields.map(field => [
      field,
      [season.leaders[field][0][field], season.leaders[field][9][field]],
    ])),
    leaderFull82Count: Object.fromEntries(fields.map(field => [
      field,
      season.leaders[field].filter(row => row.gp === 82).length,
    ])),
  })),
  adjacentTopTenOverlap: Object.fromEntries(fields.map(field => [
    field,
    seasons.slice(1).map((season, index) => topTenOverlap(seasons[index].leaders[field], season.leaders[field])),
  ])),
  scoringLeaderDistribution,
  sampleTeam: seasons[0].rows
    .filter(row => row.team === 'WAS')
    .sort((a, b) => b.gp - a.gp)
    .slice(0, 12)
    .map(row => ({ id: row.id, name: row.name, gp: row.gp, ppg: row.pts, rpg: row.reb, apg: row.ast })),
  userSeason,
  controlledProfiles: {
    games: controlledProfiles.games,
    three: Object.fromEntries(Object.entries(controlledProfiles.three).map(([key, value]) => [key, Number(value.toFixed(3))])),
    rebound: Object.fromEntries(Object.entries(controlledProfiles.rebound).map(([key, value]) => [key, Number(value.toFixed(2))])),
    assist: Object.fromEntries(Object.entries(controlledProfiles.assist).map(([key, value]) => [key, Number(value.toFixed(2))])),
    steal: Object.fromEntries(Object.entries(controlledProfiles.steal).map(([key, value]) => [key, Number(value.toFixed(2))])),
    block: Object.fromEntries(Object.entries(controlledProfiles.block).map(([key, value]) => [key, Number(value.toFixed(2))])),
    role: controlledProfiles.role,
  },
  playmakingIsolation: Object.fromEntries(Object.entries(playmakingIsolation).map(([name, pair]) => [name, roundIsolationPair(pair)])),
  deterministicBoxScore,
  explicitBudgetRebalance,
  sixthManMinutes,
};

console.log(JSON.stringify(report, null, 2));

const limits = {
  pts: { first: 34, tenth: 28 },
  reb: { first: 16, tenth: 13 },
  ast: { first: 12.5, tenth: 10 },
  stl: { first: 2.8, tenth: 2.2 },
  blk: { first: 4, tenth: 2.3 },
};
// 允许伤病和出场资格造成的赛季波动；2.5+ 仍代表联盟级护框榜首，不为过测试抬高球员属性。
// 26 是单季异常硬下限；头部得分的多数赛季水平与梯度由 scoringLeaderDistribution 单独验证。
const minimums = { pts: 26, ast: 10, blk: 2.5 };
const failures = [];
seasons.forEach((season, index) => {
  if (season.invariantErrors > 0) failures.push(`赛季 ${index + 1} 存在 ${season.invariantErrors} 个总量守恒错误`);
  if (season.gamesValidated < 500) failures.push(`赛季 ${index + 1} 守恒验证场次不足：${season.gamesValidated}`);
  if (season.full82 < 5 || season.full82 > 50) failures.push(`赛季 ${index + 1} 打满 82 场人数异常：${season.full82}`);
  if (season.averageTeamAssists < 23 || season.averageTeamAssists > 29) failures.push(`赛季 ${index + 1} 球队场均助攻异常：${season.averageTeamAssists}`);
  if (season.shootingPct.fg < 0.43 || season.shootingPct.fg > 0.52 || season.shootingPct.three < 0.31 || season.shootingPct.three > 0.41 || season.shootingPct.ft < 0.70 || season.shootingPct.ft > 0.86) {
    failures.push(`赛季 ${index + 1} 联盟命中率异常：${JSON.stringify(season.shootingPct)}`);
  }
  if (season.maxDuplicateSignature > 3) failures.push(`赛季 ${index + 1} 同一球员大量重复完全相同 Box Score：${season.maxDuplicateSignature}`);
  if (season.reconciliation.meanAbs >= 4 || season.reconciliation.p90 > 8 || season.reconciliation.p95 > 10 || season.reconciliation.overTenRate > 0.031) {
    failures.push(`赛季 ${index + 1} reconciliation 对原始投篮得分修正过强：${JSON.stringify(season.reconciliation)}`);
  }
  if (season.reconciliation.budgetRebalances !== 0) failures.push(`赛季 ${index + 1} 正常比分频繁触发投篮预算重平衡`);
  fields.forEach(field => {
    if (minimums[field] && season.leaders[field][0][field] < minimums[field]) failures.push(`赛季 ${index + 1} ${field} 榜首过低`);
    if (season.leaders[field][0][field] > limits[field].first) failures.push(`赛季 ${index + 1} ${field} 榜首过高`);
    if (season.leaders[field][9][field] > limits[field].tenth) failures.push(`赛季 ${index + 1} ${field} 第十名过高`);
    if (season.leaders[field].filter(row => row.gp === 82).length > 4) failures.push(`赛季 ${index + 1} ${field} 前十中打满 82 场的人数过多`);
  });
  const sampleTeamHighAssistCount = season.rows.filter(row => row.team === 'WAS' && row.gp >= 20 && row.ast >= 5).length;
  if (sampleTeamHighAssistCount > 2) failures.push(`赛季 ${index + 1} 样本球队有 ${sampleTeamHighAssistCount} 人场均至少 5 助攻`);
});

const scoringLeaderAtLeast27 = scoringLeaderDistribution.filter(season => season.first >= 27).length;
const scoringLeaderAtLeast29 = scoringLeaderDistribution.filter(season => season.first >= 29).length;
const scoringTopThreeAtLeast26 = scoringLeaderDistribution.filter(season => season.third >= 26).length;
const narrowScoringSeason = scoringLeaderDistribution.find(season => season.spread < 3);
if (scoringLeaderAtLeast27 < 4 || scoringLeaderAtLeast29 < 2 || scoringTopThreeAtLeast26 < 2 || narrowScoringSeason) {
  console.error(`联盟头部得分集中度不足：${JSON.stringify({
    scoringLeaderAtLeast27, scoringLeaderAtLeast29, scoringTopThreeAtLeast26, narrowScoringSeason, scoringLeaderDistribution,
  })}`);
  process.exitCode = 1;
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}

if (userSeason.invariantErrors || userSeason.injuryRedistributionErrors) {
  console.error(`用户数据整队模拟守恒失败：${JSON.stringify(userSeason)}`);
  process.exitCode = 1;
}
if (userSeason.pts < 16 || userSeason.pts > 31 || userSeason.ast > 11 || userSeason.bestPts > 94) {
  console.error(`用户赛季分布超出合理范围：${JSON.stringify(userSeason)}`);
  process.exitCode = 1;
}

if (controlledProfiles.three.highAttempts <= controlledProfiles.three.lowAttempts * 1.15 || controlledProfiles.three.highPct <= controlledProfiles.three.lowPct + 0.035) {
  console.error(`三分属性趋势不成立：${JSON.stringify(controlledProfiles.three)}`);
  process.exitCode = 1;
}
[
  ['篮板', controlledProfiles.rebound],
  ['助攻', controlledProfiles.assist],
  ['抢断', controlledProfiles.steal],
  ['盖帽', controlledProfiles.block],
].forEach(([label, trend]) => {
  if (trend.high <= trend.low * 1.20) {
    console.error(`${label}属性趋势不成立：${JSON.stringify(trend)}`);
    process.exitCode = 1;
  }
});
if (controlledProfiles.role.offensiveGuard.fga <= controlledProfiles.role.defensiveCenter.fga || controlledProfiles.role.offensiveGuard.pts <= controlledProfiles.role.defensiveCenter.pts) {
  console.error(`OVR 错误主导 Usage/得分：${JSON.stringify(controlledProfiles.role)}`);
  process.exitCode = 1;
}
if (!deterministicBoxScore) {
  console.error('相同 seed、阵容与输入未生成相同 Box Score');
  process.exitCode = 1;
}
if (sixthManMinutes.regular.total !== 240 || sixthManMinutes.playoffs.total !== 240
  || sixthManMinutes.regular.sixth < 28 || sixthManMinutes.regular.sixth < sixthManMinutes.regular.weakStarter
  || sixthManMinutes.playoffs.sixth < 28 || sixthManMinutes.cap.total !== 240 || sixthManMinutes.cap.sixth > 33
  || sixthManMinutes.playoffCap.total !== 240 || sixthManMinutes.playoffCap.sixth > 34
  || sixthManMinutes.activeReplacement.expectedSixthIndex < 0 || sixthManMinutes.activeReplacement.expectedSixthRole !== 5
  || sixthManMinutes.activeReplacement.activeSixthIndex < 0 || !sixthManMinutes.activeReplacement.starterAbsent
  || sixthManMinutes.activeReplacement.activeSixthRole !== 4
  || sixthManMinutes.activeReplacement.activeSixthMinutes < 28 || sixthManMinutes.activeReplacement.total !== 240
  || sixthManMinutes.usage.sixthFga < sixthManMinutes.usage.weakStarterFga * 0.90) {
  console.error(`高总评第六人分钟分配异常：${JSON.stringify(sixthManMinutes)}`);
  process.exitCode = 1;
}
const passIsolation = playmakingIsolation.pass;
const passFgaGap = Math.abs(passIsolation.high.fga - passIsolation.low.fga) / Math.max(0.01, passIsolation.low.fga);
const passPpgGap = Math.abs(passIsolation.high.ppg - passIsolation.low.ppg) / Math.max(0.01, passIsolation.low.ppg);
if (passIsolation.high.apg <= passIsolation.low.apg * 4 || passFgaGap >= 0.05 || passPpgGap >= 0.05
  || Math.abs(passIsolation.high.fgPct - passIsolation.low.fgPct) >= 0.02
  || Math.abs(passIsolation.high.threePct - passIsolation.low.threePct) >= 0.025) {
  console.error(`PAS 仍越界主导个人得分：${JSON.stringify({ passIsolation, passFgaGap, passPpgGap })}`);
  process.exitCode = 1;
}
const handleIsolation = playmakingIsolation.handle;
const handleFgaRatio = handleIsolation.high.fga / Math.max(0.01, handleIsolation.low.fga);
if (handleFgaRatio < 1.045 || handleFgaRatio > 1.12 || handleIsolation.high.apg <= handleIsolation.low.apg * 1.5
  || handleIsolation.high.tov >= handleIsolation.low.tov
  || Math.abs(handleIsolation.high.fgPct - handleIsolation.low.fgPct) >= 0.02) {
  console.error(`HAN 的自主进攻/组织职责越界：${JSON.stringify({ handleIsolation, handleFgaRatio })}`);
  process.exitCode = 1;
}
const clutchIsolation = playmakingIsolation.clutch;
if (Math.abs(clutchIsolation.high.fga - clutchIsolation.low.fga) / Math.max(0.01, clutchIsolation.low.fga) >= 0.05
  || Math.abs(clutchIsolation.high.ppg - clutchIsolation.low.ppg) / Math.max(0.01, clutchIsolation.low.ppg) >= 0.05
  || Math.abs(clutchIsolation.high.fgPct - clutchIsolation.low.fgPct) >= 0.02
  || Math.abs(clutchIsolation.high.threePct - clutchIsolation.low.threePct) >= 0.02) {
  console.error(`CLU 仍在全场基础投篮中持续加成：${JSON.stringify(clutchIsolation)}`);
  process.exitCode = 1;
}
const roleIsolation = playmakingIsolation.organizerVsScorer;
if (roleIsolation.high.apg <= roleIsolation.low.apg * 2
  || roleIsolation.low.fga <= roleIsolation.high.fga * 1.25
  || roleIsolation.low.ppg <= roleIsolation.high.ppg * 1.40) {
  console.error(`组织核心仍压过真实得分核心：${JSON.stringify(roleIsolation)}`);
  process.exitCode = 1;
}
if (explicitBudgetRebalance.totalPoints !== 300 || explicitBudgetRebalance.finalPts !== 300
  || !explicitBudgetRebalance.hiddenMetadata || !explicitBudgetRebalance.budgetRebalanced
  || !Object.keys(explicitBudgetRebalance.budgetActions).length) {
  console.error(`极端比分未通过显式投篮预算重平衡：${JSON.stringify(explicitBudgetRebalance)}`);
  process.exitCode = 1;
}

const averageFiftyPlus = averageScoringBursts('fiftyPlus');
const averageSixtyPlus = averageScoringBursts('sixtyPlus');
const totalSeventyPlus = seasons.reduce((sum, season) => sum + season.scoringBursts.seventyPlus, 0);
if (averageFiftyPlus < 10 || averageFiftyPlus > 35) {
  console.error(`联盟 50+ 单场频率偏离现代 NBA：每季 ${averageFiftyPlus.toFixed(1)} 场`);
  process.exitCode = 1;
}
if (averageSixtyPlus > 2) {
  console.error(`联盟 60+ 单场频率异常：每季 ${averageSixtyPlus.toFixed(1)} 场`);
  process.exitCode = 1;
}
if (totalSeventyPlus > 1) {
  console.error(`联盟 70+ 单场频率异常：${seasons.length} 季共 ${totalSeventyPlus} 场`);
  process.exitCode = 1;
}

const originalRandomForBurst = Math.random;
try {
  let eightyCalls = 0;
  const eightyRolls = [0, 0.5];
  Math.random = () => eightyCalls < eightyRolls.length ? eightyRolls[eightyCalls++] : 0.5;
  const eightyBurst = simulation.getLeagueScoringBurst(1, 1);
  let calls = 0;
  const seventyRolls = [0.00004, 0.5];
  Math.random = () => calls < seventyRolls.length ? seventyRolls[calls++] : 0.5;
  const seventyBurst = simulation.getLeagueScoringBurst(1, 1);
  let sixtyCalls = 0;
  const sixtyRolls = [0.0002, 0.5];
  Math.random = () => sixtyCalls < sixtyRolls.length ? sixtyRolls[sixtyCalls++] : 0.5;
  const sixtyBurst = simulation.getLeagueScoringBurst(1, 1);
  let hotCalls = 0;
  const hotRolls = [0.001, 0.5];
  Math.random = () => hotCalls < hotRolls.length ? hotRolls[hotCalls++] : 0.5;
  const hotBurst = simulation.getLeagueScoringBurst(1, 1);
  if (eightyBurst.tier !== 'eightyPlus' || eightyBurst.hardCap !== 100 || eightyBurst.shareCap < 0.8) {
    console.error(`80+ 历史级爆发通道无效：${JSON.stringify(eightyBurst)}`);
    process.exitCode = 1;
  }
  if (seventyBurst.tier !== 'seventyPlus' || seventyBurst.hardCap < 70 || seventyBurst.hardCap >= 80) {
    console.error(`70+ 爆发通道无效：${JSON.stringify(seventyBurst)}`);
    process.exitCode = 1;
  }
  if (sixtyBurst.tier !== 'sixtyPlus' || sixtyBurst.hardCap < 60 || sixtyBurst.hardCap >= 70) {
    console.error(`60+ 历史级爆发通道无效：${JSON.stringify(sixtyBurst)}`);
    process.exitCode = 1;
  }
  if (hotBurst.tier !== 'hot' || hotBurst.hardCap !== 100 || hotBurst.shareCap >= 0.55) {
    console.error(`普通火热状态不应以 59 分封顶，且高分球权上限应受控：${JSON.stringify(hotBurst)}`);
    process.exitCode = 1;
  }

  Math.random = () => 0;
  const quintupleBurst = simulation.getLeagueVersatilityBurst([{}], {
    minutes: [36], offSkill: [1], rebSkill: [1], passSkill: [1], stealSkill: [1], blockSkill: [1],
  });
  Math.random = () => simulation.LEAGUE_VERSATILITY_BURST_RATES.quintuple + simulation.LEAGUE_VERSATILITY_BURST_RATES.quadruple / 2;
  const quadrupleBurst = simulation.getLeagueVersatilityBurst([{}], {
    minutes: [36], offSkill: [1], rebSkill: [1], passSkill: [1], stealSkill: [1], blockSkill: [0.5],
  });
  const forcedStats = {
    pts: [5, 95], reb: [4, 38], ast: [3, 22], stl: [2, 8], blk: [1, 5],
  };
  const totalsBefore = Object.fromEntries(Object.entries(forcedStats).map(([field, values]) => [field, values.reduce((sum, value) => sum + value, 0)]));
  const applied = simulation.applyLeagueVersatilityBurst(quadrupleBurst, forcedStats);
  const quadCategories = Object.values(forcedStats).filter(values => values[0] >= 10).length;
  const totalsPreserved = Object.entries(forcedStats).every(([field, values]) => values.reduce((sum, value) => sum + value, 0) === totalsBefore[field]);
  if (!quintupleBurst || quintupleBurst.tier !== 'quintuple') {
    console.error(`五双彩蛋级通道无效：${JSON.stringify(quintupleBurst)}`);
    process.exitCode = 1;
  }
  if (!quadrupleBurst || quadrupleBurst.tier !== 'quadruple' || !applied || quadCategories !== 4 || !totalsPreserved) {
    console.error(`四双通道或球队总量守恒无效：${JSON.stringify({ quadrupleBurst, forcedStats, totalsPreserved })}`);
    process.exitCode = 1;
  }

  const expectedQuadruplesPerSeason = 1230 * 2 * simulation.LEAGUE_VERSATILITY_BURST_RATES.quadruple;
  const expectedQuintuplesPerSeason = 1230 * 2 * simulation.LEAGUE_VERSATILITY_BURST_RATES.quintuple;
  if (expectedQuadruplesPerSeason < 0.02 || expectedQuadruplesPerSeason > 0.03) {
    console.error(`四双赛季期望频率异常：${expectedQuadruplesPerSeason}`);
    process.exitCode = 1;
  }
  if (expectedQuintuplesPerSeason >= 0.001) {
    console.error(`五双概率不够低：${expectedQuintuplesPerSeason}`);
    process.exitCode = 1;
  }
} finally {
  Math.random = originalRandomForBurst;
}
