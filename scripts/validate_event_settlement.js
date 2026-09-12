const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const offseasonSource = fs.readFileSync(path.join(root, 'js', 'offseason.js'), 'utf8');
const start = offseasonSource.indexOf('function getMobility()');
const end = offseasonSource.indexOf('function recordTeamNonRenewal()', start);
const tradeStart = offseasonSource.indexOf('function getTradeRequestApprovalChance(preferredTeam)');
const tradeEnd = offseasonSource.indexOf('function getTradeRequestCandidates()', tradeStart);
if (start < 0 || end < 0 || tradeStart < 0 || tradeEnd < 0) throw new Error('无法提取玩家续约与交易意愿逻辑');

function makeState(loyalty) {
  return {
    finalOVR: 86,
    careerTeam: 'HOME',
    position: 'PG',
    _prevStandings: { HOME: { wins: 41, losses: 41 } },
    career: { seasonCount: 4, currentAge: 27, flags: {}, mobility: {}, profile: { loyalty: loyalty || 0, controversy: 0 } },
    season: { wins: 20, losses: 20, isUserStarter: true, schedule: Array.from({ length: 20 }, () => ({ simulated: true })) },
  };
}

function makeRuntime(state) {
  return new Function(
    'STATE',
    'getCareerProfile',
    'calcTeamLineup',
    `${offseasonSource.slice(start, end)}\n${offseasonSource.slice(tradeStart, tradeEnd)}\nreturn { getTeamRenewalWillingness, getTradeRequestApprovalChance };`,
  )(
    state,
    () => state.career.profile,
    () => ({ starters: {} }),
  );
}

function withRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = original; }
}

const neutralState = makeState(0);
const loyalState = makeState(4);
const unsettledState = makeState(-3);
const neutral = makeRuntime(neutralState);
const loyal = makeRuntime(loyalState);
const unsettled = makeRuntime(unsettledState);

const renewalNeutral = withRandom(0.95, () => neutral.getTeamRenewalWillingness());
const renewalLoyal = withRandom(0.95, () => loyal.getTeamRenewalWillingness());
if (renewalNeutral || !renewalLoyal) throw new Error('公开留队承诺没有提高同条件续约意愿');

const neutralTradeChance = neutral.getTradeRequestApprovalChance('AWAY');
const loyalTradeChance = loyal.getTradeRequestApprovalChance('AWAY');
const unsettledTradeChance = unsettled.getTradeRequestApprovalChance('AWAY');
if (!(loyalTradeChance < neutralTradeChance && unsettledTradeChance > neutralTradeChance)) {
  throw new Error(`剧情忠诚度没有影响交易申请：${JSON.stringify({ neutralTradeChance, loyalTradeChance, unsettledTradeChance })}`);
}

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!indexSource.includes('var forcedMainCount = queue.length;')
  || !indexSource.includes("queue.length < OFFSEASON_MAX_MAIN_EVENTS && getBranchNode('relationship')")) {
  throw new Error('休赛期强制主线没有计入主线事件上限');
}

console.log(JSON.stringify({
  renewal: { neutralAt095: renewalNeutral, loyalAt095: renewalLoyal },
  tradeRequestApproval: { neutral: neutralTradeChance, loyal: loyalTradeChance, unsettled: unsettledTradeChance },
  offseasonMainQueueCap: true,
}));
