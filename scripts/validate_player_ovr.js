const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const SIM_CONFIG = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const LEAGUE_PLAYER_DATA = new Function(`${leagueSource}\nreturn LEAGUE_PLAYER_DATA;`)();
const ATTR_KEYS = SIM_CONFIG.ATTR_LIST;
const start = offseasonSource.indexOf('function getOvrPositions');
const end = offseasonSource.indexOf('// ==================== 联盟演变', start);

if (start < 0 || end < 0) throw new Error('无法提取 OVR 同步函数');

const context = vm.createContext({
  SIM_CONFIG,
  ATTR_KEYS,
  STATE: { career: { seasonCount: 6 } },
  LEAGUE_TEAM_IDS: ['POR'],
  LEAGUE_PLAYER_DATA: {},
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
  IDEF: 90,
  BLK: 91,
  REB: 90,
  ATH: 95,
  STR: 86,
  CLU: 94,
};
const generated = { id: 'R000005', _prospectId: 'S005', pos: 'PF', ovr: 81, _age: 26, ...attributes };
const published = { id: 'P0156', pos: 'PG / SG', ovr: 95, ...attributes };
context.LEAGUE_PLAYER_DATA.POR = [generated, published];

const changed = vm.runInContext('syncGeneratedLeaguePlayerOvrs()', context);
if (changed !== 1) throw new Error(`应只同步 1 名生成球员，实际 ${changed}`);
if (generated.ovr !== 81) throw new Error(`旧存档迁移应保留原 OVR 81，实际 ${generated.ovr}`);
if (generated._rookieGenerationVersion !== 2) throw new Error('旧生成球员未迁移到新版属性模型');
if (generated.type === '新秀') throw new Error('多年球员不应继续显示为新秀');
const migratedValues = ATTR_KEYS.map(key => generated[key]);
if (Math.max(...migratedValues) - Math.min(...migratedValues) < 14) throw new Error('生成球员仍缺少明确强弱项');
if (migratedValues.filter(value => value <= 75).length < 3) throw new Error('81 OVR 球员至少应有 3 项明显短板');
if (published.ovr !== 95) throw new Error(`现实球员人工 OVR 不应改变，实际 ${published.ovr}`);

const publishedFormulaOvr = vm.runInContext('Math.round(calcOvrFormulaScore(LEAGUE_PLAYER_DATA.POR[1], LEAGUE_PLAYER_DATA.POR[1].pos))', context);
vm.runInContext('syncLeaguePlayerOvrs()', context);
if (published._sourceOvr !== 95) throw new Error(`现实球员来源 OVR 应保留 95，实际 ${published._sourceOvr}`);
if (published.ovr !== 95) throw new Error(`现实球员基准 OVR 应保持审核值 95，实际 ${published.ovr}`);
if (publishedFormulaOvr === published.ovr) throw new Error('测试球员未覆盖公式分与审核 OVR 不同的锚定场景');
if (!Number.isFinite(published._ovrAnchorScore)) throw new Error('现实球员未保存初始公式分');
const declinedPublished = { ...published };
ATTR_KEYS.forEach(key => { declinedPublished[key] = Math.max(25, declinedPublished[key] - 8); });
context.declinedPublished = declinedPublished;
const declinedPublishedOvr = vm.runInContext('calcOVR(declinedPublished, declinedPublished.pos)', context);
if (declinedPublishedOvr >= published.ovr) throw new Error('现实球员属性下降后锚定 OVR 没有下降');
const improvedPublished = { ...published, FIN: 99, PAS: 99, PDEF: 99, STR: 99 };
context.improvedPublished = improvedPublished;
const improvedPublishedOvr = vm.runInContext('calcOVR(improvedPublished, improvedPublished.pos)', context);
if (improvedPublishedOvr <= published.ovr) throw new Error('高 OVR 球员属性提升后被内部 99 分平台锁死');

const legacyPublished = { id: 'P9998', pos: 'PG / SG', ovr: 82, _sourceOvr: 88, ...attributes };
context.LEAGUE_PLAYER_DATA.POR.push(legacyPublished);
vm.runInContext('syncLeaguePlayerOvrs()', context);
if (legacyPublished.ovr !== 82 || legacyPublished._ovrAnchorOvr !== 82) {
  throw new Error(`旧长期存档升级公式时应保留当前 OVR 82，实际 ${legacyPublished.ovr}`);
}

vm.runInContext('evolveGeneratedPlayerAttributes(LEAGUE_PLAYER_DATA.POR[0], 81, 85)', context);
if (generated.ovr !== 85) throw new Error(`成长后 OVR 应为 85，实际 ${generated.ovr}`);
const evolvedValues = ATTR_KEYS.map(key => generated[key]);
if (Math.max(...evolvedValues) - Math.min(...evolvedValues) < 12) throw new Error('成长后球员强弱差异被抹平');

const filler = { id: 'R000006', _prospectId: 'S006', pos: 'PF', ovr: 85, _age: 20, type: '新秀' };
context.filler = filler;
vm.runInContext('applyRookieAttributeProfile(filler, 68, () => 0.5)', context);
if (filler.ovr !== 68) throw new Error(`补位新秀应按目标 OVR 68 生成，实际 ${filler.ovr}`);
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
const sourceOvrById = new Map(leaguePlayers.map(player => [player.id, player.ovr]));
const sourceAverage = leaguePlayers.reduce((sum, player) => sum + player.ovr, 0) / leaguePlayers.length;
let monotonicChecks = 0;
let rawAbsoluteError = 0;
let rawLargeErrors = 0;
leaguePlayers.forEach((player) => {
  const rawOvr = formulaContext.calcOVR(player, player.pos);
  const rawError = Math.abs(rawOvr - player.ovr);
  rawAbsoluteError += rawError;
  if (rawError >= 5) rawLargeErrors++;
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
const baselineMismatches = leaguePlayers.filter(player => player.ovr !== sourceOvrById.get(player.id));
if (baselineMismatches.length) throw new Error(`现实球员基准 OVR 与审核值不一致：${baselineMismatches.length} 人`);
if (formulaAverage !== sourceAverage) throw new Error(`锚定后联盟 OVR 均值不一致：${sourceAverage.toFixed(2)} -> ${formulaAverage.toFixed(2)}`);
if (leaguePlayers.some(player => player._sourceOvr == null)) throw new Error('全联盟同步后存在未保留来源 OVR 的球员');
if (leaguePlayers.some(player => !Number.isFinite(player._ovrAnchorScore))) throw new Error('全联盟存在未保存初始公式分的现实球员');

const jalenJohnson = leaguePlayers.find(player => player.id === 'P0001');
const devinCarter = leaguePlayers.find(player => player.id === 'P0008');
if (!jalenJohnson || jalenJohnson.ovr !== 90) throw new Error(`P0001 基准 OVR 应为 90，实际 ${jalenJohnson && jalenJohnson.ovr}`);
if (!devinCarter || devinCarter.ovr !== 77) throw new Error(`P0008 基准 OVR 应为 77，实际 ${devinCarter && devinCarter.ovr}`);

let anchoredMonotonicChecks = 0;
leaguePlayers.forEach((player) => {
  const base = formulaContext.calcOVR(player, player.pos);
  ATTR_KEYS.forEach((key) => {
    if (player[key] >= 99) return;
    const probe = { ...player, [key]: player[key] + 1 };
    const next = formulaContext.calcOVR(probe, probe.pos);
    anchoredMonotonicChecks++;
    if (next < base) throw new Error(`${player.id} 锚定后 ${key} +1，OVR 从 ${base} 降为 ${next}`);
  });
});

const improvedCarter = { ...devinCarter };
ATTR_KEYS.forEach(key => { improvedCarter[key] = Math.min(99, improvedCarter[key] + 8); });
if (formulaContext.calcOVR(improvedCarter, improvedCarter.pos) <= devinCarter.ovr) {
  throw new Error('P0008 属性整体提升后 OVR 没有增长');
}

console.log(`OVR 验证通过：${leaguePlayers.length} 名现实球员基准误差 0；底层公式原始 MAE ${(rawAbsoluteError / leaguePlayers.length).toFixed(2)}、原始误差>=5 共 ${rawLargeErrors} 人；${monotonicChecks + anchoredMonotonicChecks} 次单调性检查无下降；现实球员按属性差值成长，新秀按目标生成`);
