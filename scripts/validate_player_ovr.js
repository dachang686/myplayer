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

const expectedPublishedOvr = vm.runInContext('calcOVR(LEAGUE_PLAYER_DATA.POR[1], LEAGUE_PLAYER_DATA.POR[1].pos)', context);
vm.runInContext('syncLeaguePlayerOvrs()', context);
if (published._sourceOvr !== 95) throw new Error(`现实球员来源 OVR 应保留 95，实际 ${published._sourceOvr}`);
if (published.ovr !== expectedPublishedOvr) throw new Error(`现实球员运行 OVR 应按新公式同步为 ${expectedPublishedOvr}，实际 ${published.ovr}`);

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
const sourceAverage = leaguePlayers.reduce((sum, player) => sum + player.ovr, 0) / leaguePlayers.length;
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
if (Math.abs(formulaAverage - sourceAverage) > 0.5) {
  throw new Error(`公式导致联盟 OVR 均值漂移过大：${sourceAverage.toFixed(2)} -> ${formulaAverage.toFixed(2)}`);
}
if (leaguePlayers.some(player => player._sourceOvr == null)) throw new Error('全联盟同步后存在未保留来源 OVR 的球员');

console.log(`OVR 验证通过：${leaguePlayers.length} 人公式均值 ${formulaAverage.toFixed(2)}，${monotonicChecks} 次单调性检查无下降；来源 OVR 可追溯，新秀按目标生成`);
