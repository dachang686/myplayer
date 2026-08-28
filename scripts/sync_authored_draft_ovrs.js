const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'js', 'data', 'simulation_config.js');
const draftPath = path.join(root, 'js', 'data', 'draft_data.js');
const offseasonPath = path.join(root, 'js', 'offseason.js');

function loadContext() {
  const configSource = fs.readFileSync(configPath, 'utf8');
  const draftSource = fs.readFileSync(draftPath, 'utf8');
  const offseasonSource = fs.readFileSync(offseasonPath, 'utf8');
  const start = offseasonSource.indexOf('function getLeagueAttributeKeys');
  const end = offseasonSource.indexOf('// ==================== 联盟演变', start);
  if (start < 0 || end < 0) throw new Error('无法加载新秀 OVR 计算逻辑');
  const context = vm.createContext({ STATE: { career: { seasonCount: 0 } }, clearLineupCache() {} });
  vm.runInContext(`${configSource}\n${draftSource}`, context);
  context.ATTR_KEYS = vm.runInContext('SIM_CONFIG.ATTR_LIST', context);
  vm.runInContext(offseasonSource.slice(start, end), context);
  return context;
}

function replaceOvr(source, id, value) {
  const start = source.indexOf(`  "${id}": {`);
  if (start < 0) throw new Error(`找不到新秀 ${id}`);
  const nextPlayer = source.indexOf('\n  },', start);
  const cohortEnd = source.indexOf('\n  }\n};', start);
  const next = Math.min(...[nextPlayer, cohortEnd].filter(index => index >= 0));
  if (!Number.isFinite(next)) throw new Error(`${id} 数据块未闭合`);
  const block = source.slice(start, next);
  const updated = block.replace(/(\bovr:\s*)(\d+)/, `$1${value}`);
  if (updated === block) throw new Error(`${id} 缺少 OVR 字段`);
  return source.slice(0, start) + updated + source.slice(next);
}

function buildSync() {
  const context = loadContext();
  const cohorts = [
    vm.runInContext('DRAFT_CLASS_2026_RATINGS', context),
    vm.runInContext('FUTURE_PROSPECT_RATINGS', context),
  ];
  let source = fs.readFileSync(draftPath, 'utf8');
  const changed = [];
  for (const ratings of cohorts) {
    for (const [id, rating] of Object.entries(ratings)) {
      const player = { id, pos: rating.pos, ...rating.attributes };
      context.playerProbe = player;
      const calculated = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
      if (rating.ovr === calculated) continue;
      source = replaceOvr(source, id, calculated);
      changed.push({ id, from: rating.ovr, to: calculated });
    }
  }
  return { source, changed };
}

function main() {
  const apply = process.argv.includes('--apply');
  const result = buildSync();
  if (apply) fs.writeFileSync(draftPath, result.source);
  console.log(JSON.stringify({
    apply,
    changedPlayers: result.changed.length,
    maximumOvrChange: result.changed.reduce((max, row) => Math.max(max, Math.abs(row.to - row.from)), 0),
    changes: result.changed,
  }, null, 2));
}

if (require.main === module) main();

module.exports = { buildSync };
