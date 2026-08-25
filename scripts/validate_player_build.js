const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'player_build_draft.js'), 'utf8');
const ATTR_KEYS = ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'STL', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'];
const makePlayer = (id, offset) => {
  const player = { id, cname: id, team: 'A', pos: 'SF', ovr: 80 };
  ATTR_KEYS.forEach((key, index) => { player[key] = 60 + offset + index; });
  return player;
};
const league = {
  A: Array.from({ length: 15 }, (_, index) => makePlayer(`A${index + 1}`, index)),
  B: Array.from({ length: 15 }, (_, index) => makePlayer(`B${index + 1}`, index + 15)),
};
let ovrCalls = 0;
const context = vm.createContext({
  console,
  Math,
  JSON,
  Object,
  Array,
  Number,
  String,
  Boolean,
  Set,
  ATTR_KEYS,
  LEAGUE_TEAM_IDS: ['A', 'B'],
  LEAGUE_PLAYER_DATA: league,
  STATE: { mode: 'current', buildStep: 'player-draft', attrs: {}, attrSlots: {}, position: 'SF' },
  window: {},
  calcOVR() { ovrCalls += 1; return 88; },
  attrCN(key) { return key; },
  getTeamName(team) { return team; },
});
vm.runInContext(source, context, { filename: 'js/player_build_draft.js' });
context.renderDraftPlayerBuildUI = () => {};
context.renderBuildUI = () => {};
context.revealPlayer = () => {};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function startBuild() {
  const state = context.STATE;
  state.mode = 'current';
  state.buildStep = 'player-draft';
  state.attrs = {};
  state.attrSlots = {};
  ATTR_KEYS.forEach(key => { state.attrs[key] = null; state.attrSlots[key] = null; });
  state.playerBuild = context.createPlayerBuildState();
  state._rerollsLeft = 5;
  assert(context.drawNextPlayerBuildPlayers(), '无法抽取首轮两名候选');
  return state.playerBuild;
}

const build = startBuild();
const selectedSourceIds = new Set();
const tierPlan = [
  ...Array(4).fill('core'),
  ...Array(4).fill('strong'),
  ...Array(3).fill('normal'),
  ...Array(3).fill('weak'),
];
ATTR_KEYS.forEach((attr, index) => {
  assert(build.currentPlayers.length === 2, `第${index + 1}轮候选人数不是2`);
  assert(new Set(build.currentPlayers.map(item => item.id)).size === 2, `第${index + 1}轮候选串状态`);
  const selectedSourceId = build.selectedSourcePlayerId;
  assert(!selectedSourceIds.has(selectedSourceId), `第${index + 1}轮重复出现已选球员`);
  build.selectedAttr = attr;
  build.selectedTier = tierPlan[index];
  context.confirmPlayerBuildRound();
  selectedSourceIds.add(selectedSourceId);
  if (index < ATTR_KEYS.length - 1) {
    assert(build.currentPlayers.every(item => !selectedSourceIds.has(item.id)), `第${index + 2}轮再次出现已选球员`);
  }
});
assert(build.status === 'complete', '14轮后建人未完成');
assert(build.picks.length === 14, '建人轮数不是14');
assert(new Set(build.usedAttrs).size === 14, '最终属性不唯一');
assert(JSON.stringify(build.tiers) === JSON.stringify({ core: 4, strong: 4, normal: 3, weak: 3 }), '档位不是4433');
assert(Object.keys(context.STATE.attrs).length === 14 && ATTR_KEYS.every(key => Number.isFinite(Number(context.STATE.attrs[key]))), 'STATE.attrs 未完整写入');
assert(ovrCalls === 1 && context.STATE.finalOVR === 88, 'OVR 未使用中央 calcOVR');

const rerollBuild = startBuild();
for (let i = 0; i < 5; i += 1) context.rerollPlayerBuildPlayer();
assert(rerollBuild.rerollsUsed === 5 && context.STATE._rerollsLeft === 0, '5次重抽未跨轮统一计数');
assert(rerollBuild.picks.length === 0 && rerollBuild.round === 1, '重抽错误消耗轮次');

console.log(JSON.stringify({
  passed: true,
  rounds: build.picks.length,
  tiers: build.tiers,
  rerollsUsed: rerollBuild.rerollsUsed,
  checks: ['14-rounds', 'two-candidates', 'unique-source-players', 'unique-attributes', '4433', 'deadlock-safe', 'cross-round-rerolls', 'central-ovr'],
}));
