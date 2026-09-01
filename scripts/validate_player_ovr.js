const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SIM_CONFIG = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const LEAGUE_PLAYER_DATA = new Function(`${leagueSource}\nreturn LEAGUE_PLAYER_DATA;`)();
const ATTR_KEYS = SIM_CONFIG.ATTR_LIST;
const start = offseasonSource.indexOf('function getLeagueAttributeKeys');
const end = offseasonSource.indexOf('// ==================== 联盟演变', start);

if (start < 0 || end < 0) throw new Error('无法提取 OVR 同步函数');

const previewStart = indexSource.indexOf('function renderLeftAttrs');
const previewEnd = indexSource.indexOf('/** Render position select */', previewStart);
const previewSource = indexSource.slice(previewStart, previewEnd);
if (!/calcOVR\(previewAttrs, STATE\.position\)/.test(previewSource)) {
  throw new Error('建人临时总评未使用正式 calcOVR 公式');
}
if (/OVR_WEIGHTS/.test(previewSource)) {
  throw new Error('建人临时总评仍残留旧 OVR_WEIGHTS 公式');
}

const context = vm.createContext({
  SIM_CONFIG,
  ATTR_KEYS,
  STATE: { career: { seasonCount: 6 } },
  LEAGUE_TEAM_IDS: ['POR'],
  LEAGUE_PLAYER_DATA: {},
  getLeaguePlayerAge(player) { return Number(player && player._age) || 27; },
  clearLineupCache() {},
});
vm.runInContext(offseasonSource.slice(start, end), context, { filename: 'player-ovr-sync.js' });

const attributes = {
  threePT: 99,
  MID: 99,
  FIN: 86,
  DNK: 95,
  HAN: 99,
  PAS: 87,
  PDEF: 84,
  STL: 88,
  IDEF: 90,
  BLK: 91,
  REB: 90,
  ATH: 95,
  STR: 86,
  CLU: 94,
};
const generated = { id: 'R000005', _prospectId: 'S005', pos: 'PF', ovr: 81, _age: 26, ...attributes };
const published = { id: 'P0156', pos: 'PG / SG', ovr: 95, ...attributes };
delete published.STL;
context.LEAGUE_PLAYER_DATA.POR = [generated, published];
const generatedAttributesBefore = Object.fromEntries(ATTR_KEYS.map(key => [key, generated[key]]));
const expectedMigratedOvr = vm.runInContext('calcOVR(LEAGUE_PLAYER_DATA.POR[0], LEAGUE_PLAYER_DATA.POR[0].pos)', context);

const changed = vm.runInContext('syncGeneratedLeaguePlayerOvrs()', context);
if (changed !== 1) throw new Error(`应只同步 1 名生成球员，实际 ${changed}`);
if (generated.ovr !== expectedMigratedOvr) throw new Error(`旧存档应由原属性重算 OVR，实际 ${generated.ovr} / ${expectedMigratedOvr}`);
if (generated._rookieGenerationVersion !== 3) throw new Error('旧生成球员未迁移到属性保真模型');
if (generated.type === '新秀') throw new Error('多年球员不应继续显示为新秀');
if (ATTR_KEYS.some(key => generated[key] !== generatedAttributesBefore[key])) throw new Error('旧存档完整属性在迁移时被改写');
if (published.ovr !== 95) throw new Error(`现实球员人工 OVR 不应改变，实际 ${published.ovr}`);

const expectedPublishedOvr = vm.runInContext('calcOVR(LEAGUE_PLAYER_DATA.POR[1], LEAGUE_PLAYER_DATA.POR[1].pos)', context);
vm.runInContext('syncLeaguePlayerOvrs()', context);
if (published.STL !== published.PDEF) throw new Error(`旧存档 STL 应由 PDEF 一次性迁移，实际 ${published.STL}`);
if (published._sourceOvr !== 95) throw new Error(`现实球员来源 OVR 应保留 95，实际 ${published._sourceOvr}`);
if (published.ovr !== expectedPublishedOvr || published._ovrAnchorVersion !== 1) {
  throw new Error(`现实球员没有同步为唯一 OVR，实际 ${published.ovr}/${expectedPublishedOvr}`);
}

const growthPlayer = { id: 'R000007', _prospectId: 'S007', _rookieGenerationVersion: 3, _rookieProfile: 'interior_forward', pos: 'PF', ovr: 75, _age: 22 };
ATTR_KEYS.forEach(key => { growthPlayer[key] = key === 'FIN' || key === 'IDEF' || key === 'REB' || key === 'STR' ? 80 : 68; });
context.growthPlayer = growthPlayer;
const growthBefore = Object.fromEntries(ATTR_KEYS.map(key => [key, growthPlayer[key]]));
vm.runInContext('evolveGeneratedPlayerAttributes(growthPlayer, 75, 76)', context);
if (growthPlayer.ovr !== vm.runInContext('calcOVR(growthPlayer, growthPlayer.pos)', context)) throw new Error('成长后 OVR 未由属性重算');
ATTR_KEYS.forEach(key => {
  const delta = growthPlayer[key] - growthBefore[key];
  if (delta < 0 || delta > 2) throw new Error(`普通成长 ${key} 出现反向或越界变化：${delta}`);
});

const filler = { id: 'R000006', _prospectId: 'S006', pos: 'PF', ovr: 85, _age: 20, type: '新秀' };
context.filler = filler;
vm.runInContext('applyRookieAttributeProfile(filler, 68, () => 0.5)', context);
if (Math.abs(filler.ovr - 68) > 3) throw new Error(`补位新秀偏离生成区间过大：目标 68，实际 ${filler.ovr}`);
const fillerValues = ATTR_KEYS.map(key => filler[key]);
if (Math.max(...fillerValues) - Math.min(...fillerValues) < 14) throw new Error('补位新秀没有形成位置相关强弱项');
if (Math.max(...fillerValues) >= 85) throw new Error('补位新秀错误继承了明星新秀的 85 级属性');

const formulaContext = vm.createContext({
  SIM_CONFIG,
  ATTR_KEYS,
  STATE: { position: 'SG' },
  LEAGUE_PLAYER_DATA,
  LEAGUE_TEAM_IDS: Object.keys(LEAGUE_PLAYER_DATA),
  clearLineupCache() {},
});
vm.runInContext(offseasonSource.slice(start, end), formulaContext, { filename: 'league-ovr-formula.js' });
const leaguePlayers = Object.values(LEAGUE_PLAYER_DATA).flat();
const sourceAverage = leaguePlayers.reduce((sum, player) => sum + player.ovr, 0) / leaguePlayers.length;
const formulaResiduals = leaguePlayers.map(player => {
  const formulaOvr = formulaContext.calcOVR(player, player.pos);
  return {
    id: player.id,
    name: player.cname,
    sourceOvr: player.ovr,
    formulaOvr,
    error: formulaOvr - player.ovr,
  };
});
const ratingModel = SIM_CONFIG.OVR_MODEL;
const baselineAttrs = Object.fromEntries(ATTR_KEYS.map(key => [key, 50]));
const baselineOvrs = {};
Object.keys(ratingModel.positionWeights).forEach(pos => {
  baselineOvrs[pos] = formulaContext.calcOVR(baselineAttrs, pos);
});
if (Object.values(baselineOvrs).some(value => value !== 50)) {
  throw new Error(`全 50 属性的各位置 OVR 不一致：${JSON.stringify(baselineOvrs)}`);
}
const meanAbsoluteError = formulaResiduals.reduce((sum, item) => sum + Math.abs(item.error), 0) / formulaResiduals.length;
const withinThree = formulaResiduals.filter(item => Math.abs(item.error) <= 3).length;
const largeResiduals = formulaResiduals
  .filter(item => Math.abs(item.error) >= 5)
  .sort((a, b) => Math.abs(b.error) - Math.abs(a.error) || a.id.localeCompare(b.id));
const validationErrors = [];
const clutchOnly = { ...baselineAttrs, CLU: 99 };
const scorer = { ...baselineAttrs, threePT: 99, MID: 90, FIN: 92, HAN: 88 };
const defender = { ...baselineAttrs, PDEF: 94, IDEF: 94, BLK: 92, REB: 90, STR: 88 };
const clutchGain = formulaContext.calcOVR(clutchOnly, 'PF') - formulaContext.calcOVR(baselineAttrs, 'PF');
if (clutchGain > 2) validationErrors.push(`CLU 对 PF OVR 的影响过大：+${clutchGain}`);
if (formulaContext.calcOVR(scorer, 'SG') <= formulaContext.calcOVR(baselineAttrs, 'SG') + 12) validationErrors.push('得分核心没有显著提高 SG OVR');
if (formulaContext.calcOVR(defender, 'C') <= formulaContext.calcOVR(baselineAttrs, 'C') + 12) validationErrors.push('防守核心没有显著提高 C OVR');
let monotonicChecks = 0;
leaguePlayers.forEach((player) => {
  const base = formulaContext.calcOVR(player, player.pos);
  ATTR_KEYS.forEach((key) => {
    if (player[key] >= 99) return;
    const probe = { ...player, [key]: player[key] + 1 };
    const next = formulaContext.calcOVR(probe, probe.pos);
    monotonicChecks++;
    if (next < base) throw new Error(`${player.id} ${key} +1 后 OVR 从 ${base} 降为 ${next}`);
  });
});
formulaContext.syncLeaguePlayerOvrs();
const formulaAverage = leaguePlayers.reduce((sum, player) => sum + player.ovr, 0) / leaguePlayers.length;
if (leaguePlayers.some(player => player._sourceOvr == null)) throw new Error('全联盟同步后存在未保留来源 OVR 的球员');

console.log(JSON.stringify({
  players: leaguePlayers.length,
  sourceAverage: Number(sourceAverage.toFixed(2)),
  formulaAverage: Number(formulaAverage.toFixed(2)),
  meanAbsoluteError: Number(meanAbsoluteError.toFixed(3)),
  withinThree: `${withinThree}/${leaguePlayers.length}`,
  withinThreeRate: `${(withinThree / leaguePlayers.length * 100).toFixed(2)}%`,
  largeResidualCount: largeResiduals.length,
  largestResiduals: largeResiduals.slice(0, 10),
  monotonicChecks,
  validationErrors,
  unifiedModel: { baselineOvrs, clutchGain },
}, null, 2));
if (validationErrors.length) process.exitCode = 1;
