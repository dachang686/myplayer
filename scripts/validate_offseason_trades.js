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

const contractOffersStart = offseasonText.indexOf('function showContractOffers');
const contractOffersEnd = offseasonText.indexOf('function showContractRetirementChoice', contractOffersStart);
const contractOffersSource = offseasonText.slice(contractOffersStart, contractOffersEnd);
const freeAgencyChangeStart = offseasonText.indexOf('function showFreeAgencyTeamChangeModal');
const freeAgencyChangeEnd = offseasonText.indexOf('function selectContractOption', freeAgencyChangeStart);
const freeAgencyChangeSource = offseasonText.slice(freeAgencyChangeStart, freeAgencyChangeEnd);

function createModalDocument() {
  const nodes = [];
  function createNode(id, markup) {
    const button = { disabled: false, onclick: null };
    return {
      id,
      markup,
      removed: false,
      button,
      querySelector(selector) {
        if (selector.indexOf('data-action') >= 0 || selector === '.btn-primary') return button;
        return null;
      },
      remove() { this.removed = true; },
    };
  }
  function appendMarkup(markup) {
    const match = markup.match(/id=["']([^"']+)["']/);
    const node = createNode(match ? match[1] : '', markup);
    nodes.push(node);
    return node;
  }
  return {
    nodes,
    getElementById(id) { return nodes.find(node => !node.removed && node.id === id) || null; },
    createElement() {
      return {
        firstElementChild: null,
        set innerHTML(markup) { this.firstElementChild = appendMarkup(markup); },
      };
    },
    body: {
      appendChild(node) { return node; },
      insertAdjacentHTML(position, markup) { return appendMarkup(markup); },
    },
  };
}

if (contractOffersStart < 0 || contractOffersEnd < 0 || freeAgencyChangeStart < 0 || freeAgencyChangeEnd < 0) {
  failures.push('无法提取自由球员市场弹窗回归测试所需函数');
} else {
  const contractDocument = createModalDocument();
  const contractContext = {
    STATE: {
      career: { retired: false, currentAge: 27, flags: { nonRenewed: true } },
      finalOVR: 84,
      finalPosition: 'PG',
      careerTeam: 'A',
    },
    document: contractDocument,
    showMyCard() {},
    generateContractOffers() { return []; },
    getTeamName(team) { return team; },
    getTeamRenewalWillingness() { return false; },
  };
  vm.createContext(contractContext);
  vm.runInContext(contractOffersSource, contractContext, { filename: 'contract-offers-ui.js' });
  vm.runInContext('showContractOffers(); showContractOffers();', contractContext);
  const activeContractModals = contractDocument.nodes.filter(node => !node.removed && node.id === 'contract-modal');
  if (activeContractModals.length !== 1) {
    failures.push(`自由球员市场重复进入后残留 ${activeContractModals.length} 个合同弹窗`);
  }

  const changeDocument = createModalDocument();
  const changeContext = {
    document: changeDocument,
    getTeamName(team) { return team; },
    buildTeamCareerReviewData() {
      return { seasons: [], totals: { pts: 0, reb: 0, ast: 0, games: 0 }, honors: [] };
    },
    getTeamLogo() { return ''; },
    getSeasonLabel(seasonNum) { return String(seasonNum); },
    renderHonorBadge(label) { return label; },
  };
  vm.createContext(changeContext);
  vm.runInContext(freeAgencyChangeSource, changeContext, { filename: 'free-agency-change-ui.js' });
  let continueCount = 0;
  changeContext.onContinue = () => { continueCount += 1; };
  vm.runInContext("showFreeAgencyTeamChangeModal('A', 'B', onContinue); showFreeAgencyTeamChangeModal('A', 'B', onContinue);", changeContext);
  const activeChangeModals = changeDocument.nodes.filter(node => !node.removed && node.id === 'fa-team-change-modal');
  if (activeChangeModals.length !== 1) failures.push(`换队确认弹窗重入后残留 ${activeChangeModals.length} 个节点`);
  if (activeChangeModals.length === 1) {
    activeChangeModals[0].button.onclick();
    activeChangeModals[0].button.onclick();
    if (continueCount !== 1) failures.push(`自由球员市场继续回调执行了 ${continueCount} 次`);
    if (!activeChangeModals[0].removed) failures.push('自由球员市场继续后没有移除当前弹窗');
  }
}

const context = {
  console: { log() {} },
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
const tradeStart = offseasonText.indexOf('function clearPreviousOffseasonTransactionFlags');
const tradeEnd = offseasonText.indexOf('function calcOVR', tradeStart);
if (lineupStart < 0 || lineupEnd < 0 || tradeStart < 0 || tradeEnd < 0) {
  failures.push('无法提取交易回归测试所需函数');
} else {
  vm.runInContext(indexText.slice(lineupStart, lineupEnd), context, { filename: 'index-lineup.js' });
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
  vm.runInContext('clearPreviousOffseasonTransactionFlags(); processTrades();', context);
  const nextOffseasonTradeCount = context.STATE._leagueChanges.trades.length;
  if (nextOffseasonTradeCount <= 0) failures.push('解除上一年保护后仍无法产生交易');
  if (nextOffseasonTradeCount > 16) failures.push(`交易数超过单次休赛期上限：${nextOffseasonTradeCount}`);

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
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Offseason trade validation passed: current signings protected, next offseason produced ${context.STATE._leagueChanges.trades.length} trades.`);
