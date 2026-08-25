const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(__dirname, 'data');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const ratingsPath = path.join(dataDir, 'nba2k26_player_ratings.json');
const mappingPath = path.join(dataDir, 'nba2k26_player_mapping.json');
const statsPath = path.join(dataDir, 'nba_2025_26_player_stats.json');
const reviewPath = path.join(dataDir, 'player_rating_reviews.json');
const ovrAdjustmentPath = path.join(dataDir, 'player_ovr_adjustments.json');
const fairAdjustmentPath = path.join(dataDir, 'fair_ovr_player_adjustments.json');
const stealOverridesPath = path.join(dataDir, 'player_steal_overrides.json');
const auditPath = path.join(dataDir, 'nba2k26_ovr_attribute_audit.json');

const config = new Function(
  `${fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8')}\nreturn SIM_CONFIG;`,
)();
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const formulaStart = offseasonSource.indexOf('function getOvrPositions');
const formulaEnd = offseasonSource.indexOf('// ==================== 联盟演变', formulaStart);
if (formulaStart < 0 || formulaEnd < 0) throw new Error('无法提取 OVR 公式');

const ATTR_KEYS = config.ATTR_LIST.slice();
const REVIEW_FIELDS = ['ovr', ...ATTR_KEYS.filter((key) => key !== 'STL')];
const ATTRIBUTE_MAP = {
  threePT: 'Three-Point', MID: 'Mid-Range', FIN: 'Close Shot', DNK: 'Driving Dunk',
  HAN: 'Hands', PAS: 'Pass Accuracy', PDEF: 'Perimeter D', STL: 'Steal',
  IDEF: 'Interior D', BLK: 'Block', REB: 'Def. Rebound', ATH: 'Agility', STR: 'Strength',
};
const STAT_MODELS = {
  threePT: { maxDelta: 1, metrics: [['FG3_PCT', 1]] },
  MID: { maxDelta: 1, metrics: [['PTS', 0.65], ['FG_PCT', 0.35]] },
  FIN: { maxDelta: 2, metrics: [['FG_PCT', 0.7], ['PTS', 0.3]] },
  HAN: { maxDelta: 1, metrics: [['AST', 0.55], ['TOV', -0.45]] },
  PAS: { maxDelta: 2, metrics: [['AST', 0.8], ['TOV', -0.2]] },
  PDEF: { maxDelta: 1, metrics: [['STL', 1]] },
  STL: { maxDelta: 2, metrics: [['STL', 1]] },
  IDEF: { maxDelta: 2, metrics: [['BLK', 0.65], ['REB', 0.35]] },
  BLK: { maxDelta: 2, metrics: [['BLK', 1]] },
  REB: { maxDelta: 2, metrics: [['REB', 1]] },
  ATH: { maxDelta: 1, metrics: [['MIN', 1]] },
  STR: { maxDelta: 1, metrics: [['REB', 1]] },
  CLU: { maxDelta: 1, metrics: [['EFF', 0.6], ['PTS', 0.4]] },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const source = fs.readFileSync(leaguePath, 'utf8');
const league = new Function(`${source}\nreturn LEAGUE_PLAYER_DATA;`)();
const ratings = readJson(ratingsPath);
const mapping = readJson(mappingPath);
const statsCache = readJson(statsPath);
const reviews = readJson(reviewPath).players || [];
const ovrAdjustments = readJson(ovrAdjustmentPath).players || [];
const fairAdjustments = readJson(fairAdjustmentPath).players || [];
const stealOverrides = readJson(stealOverridesPath).players || {};

const formulaContext = vm.createContext({
  SIM_CONFIG: config,
  ATTR_KEYS,
  STATE: { position: 'SG' },
  clearLineupCache() {},
});
vm.runInContext(offseasonSource.slice(formulaStart, formulaEnd), formulaContext, {
  filename: 'nba2k26-ovr-formula.js',
});

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function finite(value) {
  return value !== null && value !== '' && Number.isFinite(Number(value));
}

function clamp(value) {
  return Math.max(25, Math.min(99, Math.round(Number(value) || 50)));
}

function primaryPosition(player) {
  return String(player.pos || '').split('/')[0].trim() || 'SF';
}

function formulaOvr(player) {
  formulaContext.__probe = player;
  return Number(vm.runInContext('calcOVR(__probe, __probe.pos)', formulaContext));
}

function copyStats(stats) {
  if (!stats) return null;
  const fields = [
    'PLAYER_ID', 'PLAYER', 'TEAM', 'GP', 'MIN', 'FG_PCT', 'FG3_PCT', 'FT_PCT',
    'REB', 'AST', 'STL', 'BLK', 'TOV', 'PTS', 'EFF', 'SOURCE', 'SOURCE_URL',
  ];
  return Object.fromEntries(fields
    .filter((field) => stats[field] !== undefined)
    .map((field) => [field, stats[field]]));
}

const ratingByUrl = new Map(ratings.players.map((player) => [player.url, player]));
const mappingById = new Map(mapping.players.map((player) => [player.localId, player]));
const statsById = new Map(statsCache.players
  .filter((player) => player.PLAYER_ID != null)
  .map((player) => [String(player.PLAYER_ID), player]));
const statsByName = new Map(statsCache.players
  .map((player) => [normalizeName(player.PLAYER), player]));
const reviewById = new Map(reviews.map((item) => [item.localId, item]));
const ovrAdjustmentById = new Map(ovrAdjustments.map((item) => [item.localId, item]));
const fairAdjustmentById = new Map(fairAdjustments.map((item) => [item.localId, item]));

function locateStats(external, local) {
  return (external?.nbaId && statsById.get(String(external.nbaId)))
    || statsByName.get(normalizeName(external?.name || local.name))
    || null;
}

function reviewedBaseline(local) {
  const review = reviewById.get(local.id);
  if (!review) return Object.fromEntries(['ovr', ...ATTR_KEYS].map((key) => [key, Number(local[key])]));
  const profile = {};
  for (const key of REVIEW_FIELDS) {
    const value = Object.hasOwn(review.changes || {}, key)
      ? review.changes[key][1]
      : review.unchanged?.[key];
    if (!finite(value)) throw new Error(`${local.id} 缺少审核基准属性 ${key}`);
    profile[key] = Number(value);
    for (const layer of [ovrAdjustmentById.get(local.id), fairAdjustmentById.get(local.id)]) {
      const tuple = layer?.changes?.[key];
      if (tuple) profile[key] = Number(tuple[1]);
    }
  }
  const map = mappingById.get(local.id);
  const external = map?.accepted && map.url ? ratingByUrl.get(map.url) : null;
  const sourceSteal = external?.attributes?.Steal;
  profile.STL = Number.isInteger(sourceSteal) ? sourceSteal : Number(stealOverrides[local.id]?.value);
  if (!finite(profile.STL)) profile.STL = Number(local.STL);
  return profile;
}

function sourceProfile(local, external, baseline) {
  const profile = { ...local };
  ATTR_KEYS.forEach((key) => {
    // 采用已逐人审核的 2K 属性作为稳定基准。直接重放 2K 的 35 项原始明细会因
    // 本项目 14 项 OVR 公式不同而让部分球员全属性漂移 10 点以上。
    profile[key] = clamp(baseline[key]);
  });
  profile.ovr = Number(external.ovr);
  return profile;
}

function percentile(values, value) {
  const valid = values.filter(finite).map(Number).sort((a, b) => a - b);
  if (!valid.length || !finite(value)) return null;
  let lower = 0;
  let equal = 0;
  valid.forEach((candidate) => {
    if (candidate < Number(value)) lower++;
    else if (candidate === Number(value)) equal++;
  });
  return (lower + Math.max(0, equal - 1) / 2) / Math.max(1, valid.length - 1);
}

function weightedPercentile(row, model, cohort) {
  let weighted = 0;
  let weightTotal = 0;
  for (const [field, signedWeight] of model.metrics) {
    if (!finite(row.stats?.[field])) continue;
    const values = cohort.map((candidate) => candidate.stats?.[field]).filter(finite);
    let rank = percentile(values, row.stats[field]);
    if (rank == null) continue;
    if (signedWeight < 0) rank = 1 - rank;
    weighted += rank * Math.abs(signedWeight);
    weightTotal += Math.abs(signedWeight);
  }
  return weightTotal ? weighted / weightTotal : null;
}

function statsReliability(stats) {
  if (!stats || Number(stats.GP) < 10 || Number(stats.MIN) < 8) return 0;
  return Math.min(1, Number(stats.GP) / 40) * Math.min(1, Number(stats.MIN) / 24);
}

function applyStatsProfile(row, rows) {
  const profile = { ...row.sourceProfile };
  const changes = {};
  const reliability = statsReliability(row.stats);
  if (!reliability) return { profile, changes, reliability };
  const cohort = rows.filter((candidate) => candidate.position === row.position
    && statsReliability(candidate.stats) > 0);
  for (const [key, model] of Object.entries(STAT_MODELS)) {
    const statRank = weightedPercentile(row, model, cohort);
    const attrRank = percentile(cohort.map((candidate) => candidate.sourceProfile[key]), row.sourceProfile[key]);
    if (statRank == null || attrRank == null) continue;
    const delta = Math.max(-model.maxDelta, Math.min(
      model.maxDelta,
      Math.round((statRank - attrRank) * 5 * reliability),
    ));
    const next = clamp(profile[key] + delta);
    if (next !== profile[key]) changes[key] = [profile[key], next];
    profile[key] = next;
  }
  return { profile, changes, reliability: Number(reliability.toFixed(3)) };
}

function normalizeToTarget(profile, targetOvr) {
  const candidates = [];
  for (let delta = -12; delta <= 12; delta++) {
    const candidate = { ...profile };
    ATTR_KEYS.forEach((key) => { candidate[key] = clamp(profile[key] + delta); });
    const calculated = formulaOvr(candidate);
    const totalChange = ATTR_KEYS.reduce(
      (sum, key) => sum + Math.abs(candidate[key] - profile[key]), 0,
    );
    candidates.push({ candidate, calculated, delta, totalChange });
  }
  candidates.sort((a, b) => Math.abs(a.calculated - targetOvr) - Math.abs(b.calculated - targetOvr)
    || a.totalChange - b.totalChange
    || Math.abs(a.delta) - Math.abs(b.delta));
  let best = candidates[0];
  if (best.calculated !== targetOvr) {
    const exactTweaks = [];
    for (const [keyIndex, key] of ATTR_KEYS.entries()) {
      for (let amount = -8; amount <= 8; amount++) {
        if (!amount) continue;
        const candidate = { ...best.candidate, [key]: clamp(best.candidate[key] + amount) };
        if (candidate[key] === best.candidate[key]) continue;
        const calculated = formulaOvr(candidate);
        if (calculated !== targetOvr) continue;
        const totalChange = ATTR_KEYS.reduce(
          (sum, attr) => sum + Math.abs(candidate[attr] - profile[attr]), 0,
        );
        exactTweaks.push({ candidate, calculated, delta: best.delta, totalChange, keyIndex });
      }
    }
    exactTweaks.sort((a, b) => a.totalChange - b.totalChange || a.keyIndex - b.keyIndex);
    if (exactTweaks.length) best = exactTweaks[0];
  }
  if (Math.abs(best.calculated - targetOvr) > 2) {
    throw new Error(`无法把属性公式校准至目标 OVR ${targetOvr}±2`);
  }
  return best;
}

function differences(from, to, keys) {
  const result = {};
  keys.forEach((key) => {
    if (Number(from[key]) !== Number(to[key])) result[key] = [Number(from[key]), Number(to[key])];
  });
  return result;
}

function buildRows() {
  const rows = [];
  for (const [team, players] of Object.entries(league)) {
    for (const local of players) {
      const map = mappingById.get(local.id);
      const external = map?.accepted && map.url ? ratingByUrl.get(map.url) : null;
      const baseline = reviewedBaseline(local);
      const stats = locateStats(external, local);
      const row = {
        localId: local.id,
        name: map?.identityName || local.name || null,
        cname: local.cname,
        team,
        position: primaryPosition(local),
        local,
        baseline,
        external,
        stats,
        status: external && finite(external.ovr) ? 'matched' : 'unmatched',
        flags: [],
      };
      if (row.status === 'matched') row.sourceProfile = sourceProfile(local, external, baseline);
      else row.flags.push('2k_mapping_missing');
      if (!stats) row.flags.push('nba_stats_missing');
      rows.push(row);
    }
  }

  for (const row of rows) {
    if (row.status !== 'matched') continue;
    const statsResult = applyStatsProfile(row, rows);
    const normalized = normalizeToTarget(statsResult.profile, Number(row.external.ovr));
    row.statsProfile = statsResult.profile;
    row.statsAdjustments = statsResult.changes;
    row.statsReliability = statsResult.reliability;
    row.finalProfile = { ...normalized.candidate, ovr: Number(row.external.ovr) };
    row.afterFormulaOvr = normalized.calculated;
    row.uniformDelta = normalized.delta;
    row.changes = differences(row.baseline, row.finalProfile, ['ovr', ...ATTR_KEYS]);
    row.applyChanges = differences(row.local, row.finalProfile, ['ovr', ...ATTR_KEYS]);
    row.sourceAdjustments = differences(row.baseline, row.sourceProfile, ATTR_KEYS);
    row.normalizationAdjustments = differences(row.statsProfile, row.finalProfile, ATTR_KEYS);
  }
  return rows;
}

function replacePlayerBlock(sourceText, localId, changes) {
  const start = sourceText.indexOf(`    "id": "${localId}",`);
  if (start < 0) throw new Error(`missing league source block: ${localId}`);
  const nextPlayer = sourceText.indexOf('\n  },{', start);
  const teamEnd = sourceText.indexOf('\n  }]', start);
  const endCandidates = [nextPlayer, teamEnd].filter((index) => index >= 0);
  if (!endCandidates.length) throw new Error(`unterminated league source block: ${localId}`);
  const end = Math.min(...endCandidates);
  let block = sourceText.slice(start, end);
  for (const [field, [from, to]] of Object.entries(changes)) {
    const pattern = new RegExp(`(^\\s*"${field}":\\s*)${from}(,?\\s*$)`, 'm');
    const matches = block.match(new RegExp(pattern.source, 'gm')) || [];
    if (matches.length !== 1) throw new Error(`${localId} expected one ${field}=${from}, found ${matches.length}`);
    block = block.replace(pattern, (match, prefix, suffix) => `${prefix}${to}${suffix}`);
  }
  return sourceText.slice(0, start) + block + sourceText.slice(end);
}

function applyRows(rows) {
  let updatedSource = source;
  rows.filter((row) => row.status === 'matched' && Object.keys(row.applyChanges).length)
    .forEach((row) => { updatedSource = replacePlayerBlock(updatedSource, row.localId, row.applyChanges); });
  fs.writeFileSync(leaguePath, updatedSource);
}

function serializeRow(row) {
  return {
    localId: row.localId,
    name: row.name,
    cname: row.cname,
    team: row.team,
    position: row.position,
    status: row.status,
    sourceUrl: row.external?.url || null,
    targetOvr: row.external?.ovr ?? null,
    beforeOvr: Number(row.local.ovr),
    beforeFormulaOvr: row.status === 'matched' ? formulaOvr(row.local) : null,
    afterOvr: row.finalProfile?.ovr ?? null,
    afterFormulaOvr: row.afterFormulaOvr ?? null,
    uniformDelta: row.uniformDelta ?? null,
    changes: row.changes || {},
    sourceAdjustments: row.sourceAdjustments || {},
    statsAdjustments: row.statsAdjustments || {},
    normalizationAdjustments: row.normalizationAdjustments || {},
    statsReliability: row.statsReliability || 0,
    stats: copyStats(row.stats),
    flags: row.flags,
  };
}

function buildAudit(rows) {
  const matched = rows.filter((row) => row.status === 'matched');
  const serialized = rows.map(serializeRow);
  const residuals = matched.map((row) => Math.abs(row.afterFormulaOvr - Number(row.external.ovr)));
  const deltaDistribution = {};
  matched.forEach((row) => { deltaDistribution[row.uniformDelta] = (deltaDistribution[row.uniformDelta] || 0) + 1; });
  return {
    generatedAt: new Date().toISOString(),
    applied: process.argv.includes('--apply'),
    method: 'Latest NBA 2K26 OVR is authoritative. The reviewed 2K attribute profile forms the baseline; 2025-26 regular-season per-game statistics make conservative position-percentile adjustments (maximum 1-2 points per supported attribute), then all 14 visible attributes are normalized to the target OVR. Driving dunk remains 2K-sourced because the stats feed has no dunk data.',
    sources: {
      ratings: ratings.source || null,
      ratingsRetrievedAt: ratings.retrievedAt,
      stats: statsCache.sources,
      statsSeason: statsCache.season,
      statsRetrievedAt: statsCache.retrievedAt,
    },
    summary: {
      playersChecked: rows.length,
      matched: matched.length,
      unmatched: rows.length - matched.length,
      ovrChangesApplied: matched.filter((row) => row.applyChanges.ovr).length,
      attributeCellsApplied: matched.reduce((sum, row) => sum
        + Object.keys(row.applyChanges).filter((key) => key !== 'ovr').length, 0),
      playersApplied: matched.filter((row) => Object.keys(row.applyChanges).length).length,
      ovrChangesFromReviewedBaseline: matched.filter((row) => row.changes.ovr).length,
      attributeCellsFromReviewedBaseline: matched.reduce((sum, row) => sum
        + Object.keys(row.changes).filter((key) => key !== 'ovr').length, 0),
      playersChangedFromReviewedBaseline: matched.filter((row) => Object.keys(row.changes).length).length,
      statsCompared: rows.filter((row) => row.stats).length,
      statsInformedPlayers: matched.filter((row) => Object.keys(row.statsAdjustments).length).length,
      statsAttributeAdjustments: matched.reduce((sum, row) => sum + Object.keys(row.statsAdjustments).length, 0),
      maxStatsAdjustment: Math.max(0, ...matched.flatMap((row) => Object.values(row.statsAdjustments)
        .map(([from, to]) => Math.abs(to - from)))),
      maxUniformDelta: Math.max(0, ...matched.map((row) => Math.abs(row.uniformDelta))),
      meanAbsoluteFormulaResidualAfter: Number((residuals.reduce((sum, value) => sum + value, 0) / residuals.length).toFixed(3)),
      maxFormulaResidualAfter: Math.max(...residuals),
      runtimeMaxOvr: Math.max(...matched.map((row) => Number(row.finalProfile.ovr))),
      largestUniformDeltas: matched
        .slice()
        .sort((a, b) => Math.abs(b.uniformDelta) - Math.abs(a.uniformDelta))
        .slice(0, 12)
        .map((row) => ({
          localId: row.localId,
          cname: row.cname,
          targetOvr: row.external.ovr,
          sourceFormulaOvr: formulaOvr(row.sourceProfile),
          statsFormulaOvr: formulaOvr(row.statsProfile),
          uniformDelta: row.uniformDelta,
          hasDetailed2k: Object.keys(row.external.attributes || {}).length > 0,
        })),
      deltaDistribution,
    },
    players: serialized,
  };
}

function main() {
  const rows = buildRows();
  const audit = buildAudit(rows);
  if (process.argv.includes('--apply')) {
    applyRows(rows);
    fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify({ applied: audit.applied, ...audit.summary }, null, 2)}\n`);
}

main();
