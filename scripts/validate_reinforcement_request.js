const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const offseasonText = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const tradeStart = offseasonText.indexOf('// ==================== 交易系统 ====================');
const tradeEnd = offseasonText.indexOf('function getOvrPositions', tradeStart);
if (tradeStart < 0 || tradeEnd < 0) throw new Error('无法提取交易系统函数');

function player(id, pos, ovr) {
  return { id, cname: id, pos, ovr };
}

const state = {
  careerTeam: 'AAA',
  career: {
    seasonCount: 1,
    flags: {},
    mobility: {
      reinforcementRequest: { season: 1, priority: 'PG', status: 'approved' },
    },
  },
  _leagueChanges: { trades: [] },
  _prevStandings: {},
};

const rosters = {
  AAA: [player('a-pg', 'PG', 70), player('a-sg', 'SG', 82), player('a-sf', 'SF', 82), player('a-pf', 'PF', 80), player('a-c', 'C', 78)],
  BBB: [player('b-pg', 'PG', 86), player('b-sg', 'SG', 82), player('b-sf', 'SF', 82), player('b-pf', 'PF', 82), player('b-c', 'C', 72)],
  CCC: [player('c-pg', 'PG', 80), player('c-sg', 'SG', 80), player('c-sf', 'SF', 80), player('c-pf', 'PF', 80), player('c-c', 'C', 80)],
};

const context = {
  console: { log() {}, error() {} },
  Math,
  Set,
  Map,
  Object,
  JSON,
  Number,
  String,
  Array,
  LEAGUE_TEAM_IDS: ['AAA', 'BBB', 'CCC'],
  LEAGUE_PLAYER_DATA: rosters,
  STATE: state,
  REINFORCEMENT_POSITION_META: { PG: {}, SG: {}, SF: {}, PF: {}, C: {} },
  canPlayPosition: (a, b) => a === b,
  rngNext: () => 0.3,
  getPlayerReinforcementRequest: () => state.career.mobility.reinforcementRequest,
  getReinforcementPositionLabel: (position) => position,
  recordPlayerReinforcementOutcome: () => {},
  addNextSeasonMod: (key, amount) => {
    state.career.nextSeasonMods = state.career.nextSeasonMods || {};
    state.career.nextSeasonMods[key] = (state.career.nextSeasonMods[key] || 0) + amount;
  },
  queueSeasonAutoSave: () => {},
  calcTeamLineup: (team) => {
    const roster = rosters[team] || [];
    const starters = {};
    ['PG', 'SG', 'SF', 'PF', 'C'].forEach((pos) => {
      starters[pos] = roster.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0] || null;
    });
    return { starters };
  },
};

vm.createContext(context);
vm.runInContext(offseasonText.slice(tradeStart, tradeEnd), context, { filename: 'offseason-trades.js' });
context.processTrades();

const request = state.career.mobility.reinforcementRequest;
if (request.status !== 'fulfilled') throw new Error('获批补强要求没有进入已落实状态');
if (!rosters.AAA.some((p) => p.id === 'b-pg')) throw new Error('补强交易没有把目标位置球员带到玩家球队');
if (!state._leagueChanges.trades.some((trade) => trade.requestedReinforcement && trade.reinforcementPosition === 'PG')) {
  throw new Error('补强交易没有写入可追踪的交易记录');
}
if (state.career.nextSeasonMods.teamChemistry !== 1 || state.career.nextSeasonMods.moraleBonus !== 1) {
  throw new Error('补强落实后没有写入下一赛季团队效果');
}

console.log('Reinforcement request validation passed: approved request prioritizes a target-position trade and records next-season effects.');
