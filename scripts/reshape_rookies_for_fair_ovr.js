const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const draftPath = path.join(root, 'js/data/draft_data.js');
const auditPath = path.join(__dirname, 'data', 'fair_ovr_rookie_adjustments.json');
const draftSource = fs.readFileSync(draftPath, 'utf8');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const config = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const draftData = new Function(`${draftSource}\nreturn { DRAFT_CLASS_2026_RATINGS, FUTURE_PROSPECT_RATINGS };`)();
const ATTR_KEYS = config.ATTR_LIST;
const ADJUSTABLE_KEYS = ATTR_KEYS.filter((key) => key !== 'STL');
const context = vm.createContext({
  SIM_CONFIG: config,
  ATTR_KEYS,
  STATE: { position: 'SG' },
  LEAGUE_PLAYER_DATA: {},
  LEAGUE_TEAM_IDS: [],
  clearLineupCache() {},
});
const formulaStart = offseasonSource.indexOf('function getOvrPositions');
const formulaEnd = offseasonSource.indexOf('// ==================== 联盟演变', formulaStart);
vm.runInContext(offseasonSource.slice(formulaStart, formulaEnd), context, { filename: 'fair-rookie-ovr-formula.js' });

function clamp(value) {
  return Math.max(25, Math.min(99, Math.round(value)));
}

function formulaOvr(rating, attributes) {
  context.__probe = { pos: rating.pos, ...attributes };
  return vm.runInContext('calcOVR(__probe, __probe.pos)', context);
}

function reshape(id, cohort, rating) {
  const beforeFormulaOvr = formulaOvr(rating, rating.attributes);
  if (Math.abs(beforeFormulaOvr - rating.ovr) <= 2) return null;
  const candidates = [];
  for (let delta = -20; delta <= 20; delta++) {
    const attributes = { ...rating.attributes };
    ADJUSTABLE_KEYS.forEach((key) => { attributes[key] = clamp(Number(attributes[key]) + delta); });
    const calculated = formulaOvr(rating, attributes);
    const changes = ADJUSTABLE_KEYS.filter((key) => attributes[key] !== rating.attributes[key]);
    const totalChange = changes.reduce((sum, key) => sum + Math.abs(attributes[key] - rating.attributes[key]), 0);
    candidates.push({ attributes, calculated, delta, changes, totalChange });
  }
  candidates.sort((a, b) => Number(Math.abs(a.calculated - rating.ovr) > 2) - Number(Math.abs(b.calculated - rating.ovr) > 2)
    || a.totalChange - b.totalChange
    || Math.abs(a.calculated - rating.ovr) - Math.abs(b.calculated - rating.ovr)
    || Math.abs(a.delta) - Math.abs(b.delta));
  const best = candidates[0];
  if (Math.abs(best.calculated - rating.ovr) > 2) throw new Error(`${id} 无法在统一平移 ±20 内进入目标 OVR ±2`);
  return {
    id,
    cohort,
    pos: rating.pos,
    targetOvr: rating.ovr,
    beforeFormulaOvr,
    afterFormulaOvr: best.calculated,
    uniformDelta: best.delta,
    reason: `公平 OVR 公式下原实算 ${beforeFormulaOvr}，以不改变属性强弱排序的统一平移修正到 ${best.calculated}`,
    changes: Object.fromEntries(best.changes.map((key) => [key, [rating.attributes[key], best.attributes[key]]])),
  };
}

const adjustments = [];
Object.entries(draftData.DRAFT_CLASS_2026_RATINGS).forEach(([id, rating]) => {
  const adjustment = reshape(id, '2026', rating);
  if (adjustment) adjustments.push(adjustment);
});
Object.entries(draftData.FUTURE_PROSPECT_RATINGS).forEach(([id, rating]) => {
  const adjustment = reshape(id, 'future', rating);
  if (adjustment) adjustments.push(adjustment);
});

const summary = {
  version: 1,
  method: '逐人检查；仅当公平公式与目标 OVR 相差超过 2 时，对除 STL 外的 13 项属性做等量平移',
  playersChecked: 160,
  playersAdjusted: adjustments.length,
  maxUniformDelta: Math.max(0, ...adjustments.map((row) => Math.abs(row.uniformDelta))),
  players: adjustments,
};

if (process.argv.includes('--apply')) {
  let updatedSource = draftSource;
  adjustments.forEach((adjustment) => {
    const start = updatedSource.indexOf(`"${adjustment.id}": {`);
    const nextEntry = updatedSource.indexOf('\n  "', start + 1);
    const sectionEnd = updatedSource.indexOf('\n};', start);
    const end = Math.min(...[nextEntry, sectionEnd].filter((index) => index >= 0));
    let block = updatedSource.slice(start, end);
    Object.entries(adjustment.changes).forEach(([key, [before, after]]) => {
      const pattern = new RegExp(`(\\b${key}:\\s*)${before}(?=,|\\s*})`);
      const matches = block.match(new RegExp(pattern.source, 'g')) || [];
      if (matches.length !== 1) throw new Error(`${adjustment.id} 的 ${key}=${before} 匹配 ${matches.length} 次`);
      block = block.replace(pattern, `$1${after}`);
    });
    updatedSource = updatedSource.slice(0, start) + block + updatedSource.slice(end);
  });
  fs.writeFileSync(draftPath, updatedSource, 'utf8');
  fs.writeFileSync(auditPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({
  applied: process.argv.includes('--apply'),
  playersChecked: summary.playersChecked,
  playersAdjusted: summary.playersAdjusted,
  maxUniformDelta: summary.maxUniformDelta,
  deltaDistribution: Object.fromEntries([...new Set(adjustments.map((row) => row.uniformDelta))].sort((a, b) => a - b).map((delta) => [delta, adjustments.filter((row) => row.uniformDelta === delta).length])),
}, null, 2));
