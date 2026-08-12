const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const leaguePath = path.join(root, 'js/data/league_players.js');
const auditPath = path.join(__dirname, 'data', 'fair_ovr_player_adjustments.json');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const config = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const ATTR_KEYS = config.ATTR_LIST;
const ADJUSTABLE_KEYS = ATTR_KEYS.filter((key) => key !== 'STL');
const source = fs.readFileSync(leaguePath, 'utf8');
const league = new Function(`${source}\nreturn LEAGUE_PLAYER_DATA;`)();
const context = vm.createContext({
  SIM_CONFIG: config,
  ATTR_KEYS,
  STATE: { position: 'SG' },
  LEAGUE_PLAYER_DATA: league,
  LEAGUE_TEAM_IDS: Object.keys(league),
  clearLineupCache() {},
});
const formulaStart = offseasonSource.indexOf('function getOvrPositions');
const formulaEnd = offseasonSource.indexOf('// ==================== 联盟演变', formulaStart);
vm.runInContext(offseasonSource.slice(formulaStart, formulaEnd), context, { filename: 'fair-ovr-formula.js' });

function clamp(value) {
  return Math.max(25, Math.min(99, Math.round(value)));
}

function formulaOvr(player) {
  context.__probe = player;
  return vm.runInContext('calcOVR(__probe, __probe.pos)', context);
}

function uniformCandidate(player, delta) {
  const candidate = { ...player };
  ADJUSTABLE_KEYS.forEach((key) => { candidate[key] = clamp(Number(player[key]) + delta); });
  return candidate;
}

function reshape(player) {
  const sourceOvr = Number(player.ovr);
  const beforeFormulaOvr = formulaOvr(player);
  if (Math.abs(beforeFormulaOvr - sourceOvr) <= 2) return null;

  const candidates = [];
  for (let delta = -20; delta <= 20; delta++) {
    const candidate = uniformCandidate(player, delta);
    const calculated = formulaOvr(candidate);
    const changes = ADJUSTABLE_KEYS.filter((key) => candidate[key] !== player[key]);
    const totalChange = changes.reduce((sum, key) => sum + Math.abs(candidate[key] - player[key]), 0);
    candidates.push({ candidate, calculated, delta, changes, totalChange });
  }
  candidates.sort((a, b) => Number(Math.abs(a.calculated - sourceOvr) > 2) - Number(Math.abs(b.calculated - sourceOvr) > 2)
    || a.totalChange - b.totalChange
    || Math.abs(a.calculated - sourceOvr) - Math.abs(b.calculated - sourceOvr)
    || Math.abs(a.delta) - Math.abs(b.delta));
  const best = candidates[0];
  if (Math.abs(best.calculated - sourceOvr) > 2) {
    throw new Error(`${player.id} 无法在统一平移 ±20 内进入来源 OVR ±2`);
  }
  const changes = Object.fromEntries(best.changes.map((key) => [key, [player[key], best.candidate[key]]]));
  return {
    localId: player.id,
    cname: player.cname,
    pos: player.pos,
    sourceOvr,
    beforeFormulaOvr,
    afterFormulaOvr: best.calculated,
    uniformDelta: best.delta,
    reason: `公平 OVR 公式下原实算 ${beforeFormulaOvr}，以不改变属性强弱排序的统一平移修正到 ${best.calculated}`,
    changes,
  };
}

const adjustments = [];
Object.values(league).flat().forEach((player) => {
  const adjustment = reshape(player);
  if (adjustment) adjustments.push(adjustment);
});

const summary = {
  version: 1,
  method: '逐人检查；仅当公平公式与来源 OVR 相差超过 2 时，对除 STL 外的 13 项属性做等量平移，保持球员属性强弱排序',
  playersChecked: Object.values(league).flat().length,
  playersAdjusted: adjustments.length,
  maxUniformDelta: Math.max(0, ...adjustments.map((row) => Math.abs(row.uniformDelta))),
  totalChangedFields: adjustments.reduce((sum, row) => sum + Object.keys(row.changes).length, 0),
  players: adjustments,
};

if (process.argv.includes('--apply')) {
  let updatedSource = source;
  adjustments.forEach((adjustment) => {
    const start = updatedSource.indexOf(`    "id": "${adjustment.localId}",`);
    const nextPlayer = updatedSource.indexOf('\n  },{', start);
    const teamEnd = updatedSource.indexOf('\n  }]', start);
    const end = Math.min(...[nextPlayer, teamEnd].filter((index) => index >= 0));
    let block = updatedSource.slice(start, end);
    Object.entries(adjustment.changes).forEach(([key, [before, after]]) => {
      const pattern = new RegExp(`(^\\s*"${key}":\\s*)${before}(,?\\s*$)`, 'm');
      if (!pattern.test(block)) throw new Error(`${adjustment.localId} 缺少 ${key}=${before}`);
      block = block.replace(pattern, `$1${after}$2`);
    });
    updatedSource = updatedSource.slice(0, start) + block + updatedSource.slice(end);
  });
  fs.writeFileSync(leaguePath, updatedSource, 'utf8');
  fs.writeFileSync(auditPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({
  applied: process.argv.includes('--apply'),
  playersChecked: summary.playersChecked,
  playersAdjusted: summary.playersAdjusted,
  maxUniformDelta: summary.maxUniformDelta,
  totalChangedFields: summary.totalChangedFields,
  deltaDistribution: Object.fromEntries([...new Set(adjustments.map((row) => row.uniformDelta))].sort((a, b) => a - b).map((delta) => [delta, adjustments.filter((row) => row.uniformDelta === delta).length])),
}, null, 2));
