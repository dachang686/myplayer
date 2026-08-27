const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexText = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const offseasonText = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const draftText = fs.existsSync(path.join(root, 'js/draft.js'))
  ? fs.readFileSync(path.join(root, 'js/draft.js'), 'utf8')
  : '';
const offseasonRosterText = `${offseasonText}\n${draftText}`;
const playerText = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const failures = [];
const runtimeLogs = [];
let auditedTradeCount = 0;

const pipelineMatch = indexText.match(/function continueCareerAfterTraining\(\)[\s\S]*?\n\}/);
if (!pipelineMatch || !/clearPreviousOffseasonTransactionFlags\(\);\s*\n\s*evolveLeague\(\);/.test(pipelineMatch[0])) {
  failures.push('休赛期开始时没有在联盟演变前解除上一年的交易保护');
}

const candidateStart = offseasonText.indexOf('function findTradeCandidate');
const candidateEnd = offseasonText.indexOf('function swapRosterPlayers', candidateStart);
const candidateSource = offseasonText.slice(candidateStart, candidateEnd);
if (!/p\._justSigned/.test(candidateSource)) failures.push('当前休赛期的新签球员没有交易保护');
if (/indexOf\(['"]R['"]\)/.test(candidateSource)) failures.push('程序生成新秀仍被按 ID 永久禁止交易');

const rookieProtectionCount = (offseasonRosterText.match(/(?:rookie|rk|player)\._justSigned\s*=\s*true/g) || []).length;
if (rookieProtectionCount < 2) failures.push('选秀新秀和补位新秀没有完整设置当届保护');

const context = {
  console: { log(...args) { runtimeLogs.push(args); } },
  Set,
  Map,
  Object,
  Math,
  JSON,
  String,
  Number,
  Array,
};
vm.createContext(context);
vm.runInContext(
  `${playerText}\n;globalThis.LEAGUE_PLAYER_DATA = LEAGUE_PLAYER_DATA; globalThis.LEAGUE_TEAM_IDS = LEAGUE_TEAM_IDS;`,
  context,
  { filename: 'js/data/league_players.js' },
);

Object.assign(context, {
  STATE: {
    careerTeam: '',
    finalOVR: 0,
    attrs: {},
    season: { isPlayoffs: false },
    _lineupCache: {},
    _leagueChanges: { trades: [] },
  },
  getMyPlayerDisplayName: () => '用户',
});
let seed = 1;
context.rngNext = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const lineupStart = indexText.indexOf('function getPlayerPositions');
const lineupEnd = indexText.indexOf('function getTeamLineupOvr', lineupStart);
const debugStart = offseasonText.indexOf('var OFFSEASON_DEBUG_PAIR_LIMIT');
const debugEnd = offseasonText.indexOf('// ==================== 玩家流动性', debugStart);
const tradeStart = offseasonText.indexOf('function clearPreviousOffseasonTransactionFlags');
const tradeEnd = offseasonText.indexOf('function calcOVR', tradeStart);
if (lineupStart < 0 || lineupEnd < 0 || debugStart < 0 || debugEnd < 0 || tradeStart < 0 || tradeEnd < 0) {
  failures.push('无法提取交易回归测试所需函数');
} else {
  vm.runInContext(indexText.slice(lineupStart, lineupEnd), context, { filename: 'index-lineup.js' });
  vm.runInContext(offseasonText.slice(debugStart, debugEnd), context, { filename: 'offseason-debug.js' });
  vm.runInContext(offseasonText.slice(tradeStart, tradeEnd), context, { filename: 'offseason-trades.js' });

  vm.runInContext(
    'LEAGUE_TEAM_IDS.forEach(team => LEAGUE_PLAYER_DATA[team].forEach(player => { player._justSigned = true; }));',
    context,
  );
  vm.runInContext('processTrades();', context);
  const protectedTradeCount = context.STATE._leagueChanges.trades.length;
  if (protectedTradeCount !== 0) failures.push(`当届保护球员不应被交易，实际发生 ${protectedTradeCount} 笔`);

  context.STATE._lineupCache = {};
  context.STATE._leagueChanges.trades = [];
  const rosterCountsBefore = Object.fromEntries(context.LEAGUE_TEAM_IDS.map(team => [team, context.LEAGUE_PLAYER_DATA[team].length]));
  const playerStateBefore = new Map();
  context.LEAGUE_TEAM_IDS.forEach(team => {
    context.LEAGUE_PLAYER_DATA[team].forEach(player => {
      const id = String(player.id);
      if (playerStateBefore.has(id)) failures.push(`交易前球员ID重复：${id}`);
      playerStateBefore.set(id, { team, contract: player.contract, salary: player.salary, ovr: player.ovr });
    });
  });
  vm.runInContext('clearPreviousOffseasonTransactionFlags(); processTrades();', context);
  const nextOffseasonTradeCount = context.STATE._leagueChanges.trades.length;
  auditedTradeCount = nextOffseasonTradeCount;
  if (nextOffseasonTradeCount <= 0) failures.push('解除上一年保护后仍无法产生交易');
  if (nextOffseasonTradeCount > 16) failures.push(`交易数超过单次休赛期上限：${nextOffseasonTradeCount}`);
  if (runtimeLogs.length !== 0) failures.push(`默认休赛期不应输出调试日志，实际 ${runtimeLogs.length} 条`);

  const ownersAfter = new Map();
  context.LEAGUE_TEAM_IDS.forEach(team => {
    if (context.LEAGUE_PLAYER_DATA[team].length !== rosterCountsBefore[team]) {
      failures.push(`${team} 的一换一交易改变了名单人数：${rosterCountsBefore[team]} -> ${context.LEAGUE_PLAYER_DATA[team].length}`);
    }
    context.LEAGUE_PLAYER_DATA[team].forEach(player => {
      const id = String(player.id);
      if (!ownersAfter.has(id)) ownersAfter.set(id, []);
      ownersAfter.get(id).push(team);
      const beforeState = playerStateBefore.get(id);
      if (!beforeState) failures.push(`交易后出现未知球员：${id}`);
      else if (player.contract !== beforeState.contract || player.salary !== beforeState.salary || player.ovr !== beforeState.ovr) {
        failures.push(`NPC 换队时合同、工资或 OVR 被意外修改：${id}`);
      }
    });
  });
  playerStateBefore.forEach((beforeState, id) => {
    const owners = ownersAfter.get(id) || [];
    if (owners.length !== 1) failures.push(`NPC 交易后球员归属不是唯一球队：${id} -> ${owners.join(',') || 'missing'}`);
  });
  context.STATE._leagueChanges.trades.forEach(trade => {
    const playerABefore = playerStateBefore.get(String(trade.playerA));
    const playerBBefore = playerStateBefore.get(String(trade.playerB));
    const playerAAfter = ownersAfter.get(String(trade.playerA)) || [];
    const playerBAfter = ownersAfter.get(String(trade.playerB)) || [];
    if (!playerABefore || !playerBBefore || playerABefore.team !== trade.to || playerBBefore.team !== trade.from ||
        playerAAfter.length !== 1 || playerAAfter[0] !== trade.from || playerBAfter.length !== 1 || playerBAfter[0] !== trade.to) {
      failures.push(`NPC 交易日志与实际名单流向不一致：${JSON.stringify(trade)}`);
    }
  });

  const remainingFlags = vm.runInContext(
    'LEAGUE_TEAM_IDS.reduce((sum, team) => sum + LEAGUE_PLAYER_DATA[team].filter(player => player._justSigned).length, 0)',
    context,
  );
  if (remainingFlags !== 0) failures.push(`仍有 ${remainingFlags} 名球员残留上一年交易保护`);

  const generatedRookieLifecycle = vm.runInContext(`(() => {
    const rookie = { id: 'R999999', pos: 'PG', ovr: 75, _justSigned: true };
    const protectedCandidate = findTradeCandidate([rookie], 'PG', null, new Set());
    delete rookie._justSigned;
    const veteranCandidate = findTradeCandidate([rookie], 'PG', null, new Set());
    return { protectedCandidate, veteranEligible: veteranCandidate === rookie };
  })()`, context);
  if (generatedRookieLifecycle.protectedCandidate !== null || !generatedRookieLifecycle.veteranEligible) {
    failures.push('程序生成新秀没有在保护期结束后进入交易候选池');
  }

  context.STATE._debugOffseason = true;
  runtimeLogs.length = 0;
  vm.runInContext('processTrades();', context);
  const debugSummary = runtimeLogs.find(args => args[0] === '[Trade] 配对汇总:');
  const debugSamples = debugSummary && debugSummary[1] && Array.isArray(debugSummary[1].samples)
    ? debugSummary[1].samples
    : null;
  if (!debugSummary || !debugSamples) failures.push('调试模式没有输出结构化交易汇总');
  if (debugSamples && debugSamples.length > 24) failures.push(`调试候选样本超过上限：${debugSamples.length}`);
  context.STATE._debugOffseason = false;
}

// NPC 交易数据正确之外，联盟交易弹窗和“我的球队人员变化”也必须把送出/得到方向写对。
let renderedLeagueTrades = '';
const leagueTradeModal = { querySelector() { return {}; }, remove() {} };
const leagueTradeDocument = {
  createElement() {
    return {
      set innerHTML(value) { renderedLeagueTrades = value; },
      get firstElementChild() { return leagueTradeModal; },
    };
  },
  body: { appendChild() {} },
  getElementById() { return leagueTradeModal; },
};
const tradeModalStart = offseasonText.indexOf('function showTradesModal');
const tradeModalEnd = offseasonText.indexOf('function getCareerTeamOffseasonChanges', tradeModalStart);
if (tradeModalStart < 0 || tradeModalEnd < 0) {
  failures.push('无法提取 NPC 联盟交易描述');
} else {
  const tradeTextState = { _leagueChanges: { trades: [{ from: 'AAA', to: 'BBB', playerA: 'BBB-IN', playerB: 'AAA-OUT' }] } };
  const tradeTextNames = { 'BBB-IN': '乙队入队球员', 'AAA-OUT': '甲队离队球员' };
  const tradeModalFns = new Function(
    'STATE', 'getTeamName', 'getPlayerDisplayName', 'document',
    `${offseasonText.slice(tradeModalStart, tradeModalEnd)}\nreturn { showTradesModal };`,
  )(tradeTextState, team => `球队${team}`, id => tradeTextNames[id] || id, leagueTradeDocument);
  tradeModalFns.showTradesModal(() => {});
  if (!renderedLeagueTrades.includes('球队AAA ⇄ 球队BBB') ||
      !renderedLeagueTrades.includes('甲队离队球员 → 球队BBB') ||
      !renderedLeagueTrades.includes('乙队入队球员 → 球队AAA') ||
      /undefined|null|\[object Object\]/.test(renderedLeagueTrades)) {
    failures.push('NPC 联盟交易弹窗把球队或球员流向描述错误');
  }
}

let renderedCareerTeamChanges = '';
const careerContinueButton = {};
const careerChangesDocument = {
  body: { insertAdjacentHTML(position, value) { renderedCareerTeamChanges = value; } },
  getElementById(id) {
    if (id === 'careerTeamOffseasonChangesContinue') return careerContinueButton;
    return null;
  },
};
const careerChangesStart = offseasonText.indexOf('function getCareerTeamOffseasonChanges');
const careerChangesEnd = offseasonText.indexOf('function showRosterReview', careerChangesStart);
if (careerChangesStart < 0 || careerChangesEnd < 0) {
  failures.push('无法提取玩家球队 NPC 变化描述');
} else {
  const careerTextState = {
    careerTeam: 'AAA',
    _leagueChanges: {
      trades: [{ from: 'AAA', to: 'BBB', playerA: 'BBB-IN', playerB: 'AAA-OUT' }],
      freeAgents: [], freeSignings: [], stayed: [], retired: [], rookies: [],
    },
  };
  const careerChangeFns = new Function(
    'STATE', 'getTeamName', 'getPlayerDisplayName', 'escapeSeasonUiText', 'getTeamLogo', 'document', 'isHiddenRetiredPlayer',
    `${offseasonText.slice(careerChangesStart, careerChangesEnd)}\nreturn { getCareerTeamOffseasonChanges, showCareerTeamOffseasonChangesModal };`,
  )(
    careerTextState,
    team => `球队${team}`,
    id => ({ 'BBB-IN': '乙队入队球员', 'AAA-OUT': '甲队离队球员' })[id] || id,
    value => String(value == null ? '' : value),
    () => '',
    careerChangesDocument,
    row => !!(row && row.hidden),
  );
  const careerSummary = careerChangeFns.getCareerTeamOffseasonChanges('AAA');
  careerChangeFns.showCareerTeamOffseasonChangesModal(() => {});
  const tradeSummary = careerSummary.trades[0];
  if (!tradeSummary || tradeSummary.partner !== 'BBB' || tradeSummary.incoming !== 'BBB-IN' || tradeSummary.outgoing !== 'AAA-OUT' ||
      !renderedCareerTeamChanges.includes('与 球队BBB 完成交易') ||
      !renderedCareerTeamChanges.includes('送出：甲队离队球员 · 得到：乙队入队球员') ||
      /undefined|null|\[object Object\]/.test(renderedCareerTeamChanges)) {
    failures.push('玩家球队的 NPC 交易摘要把送出、得到或交易对象描述错误');
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Offseason trade validation passed: ${auditedTradeCount} NPC trades preserved ownership/contracts and both transaction descriptions were directionally correct.`);
