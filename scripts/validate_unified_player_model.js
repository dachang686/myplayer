const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = require(path.join(root, 'js', 'data', 'simulation_config.js'));
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const lineupStart = indexSource.indexOf('function rateRotationComposition');
const lineupEnd = indexSource.indexOf('/**\n * 球队比赛实力由分钟加权基础能力和轮换角色组合共同得出。', lineupStart);
if (lineupStart < 0 || lineupEnd < 0) throw new Error('无法定位阵容组合模型');
const rateRotationComposition = new Function(`${indexSource.slice(lineupStart, lineupEnd)}\nreturn rateRotationComposition;`)();

function player(overrides) {
  return Object.assign({
    pos: 'SF', threePT: 50, MID: 50, FIN: 50, DNK: 50, HAN: 50, PAS: 50,
    ATH: 50, STR: 50, REB: 50, PDEF: 50, IDEF: 50, STL: 50, BLK: 50, CLU: 50,
  }, overrides || {});
}

function impact(overrides) {
  const base = {
    skills: {
      shootingGravity: 50, rimScoring: 50, shotCreation: 50, playmaking: 50, ballSecurity: 50,
      pointOfAttackDefense: 50, interiorDefense: 50, rimProtection: 50, rebounding: 50,
    },
    roles: {
      primaryCreator: 50, secondaryCreator: 50, hubCreator: 50, perimeterStopper: 50,
      switchDefender: 50, defensiveAnchor: 50,
    },
  };
  return {
    skills: Object.assign({}, base.skills, overrides && overrides.skills),
    roles: Object.assign({}, base.roles, overrides && overrides.roles),
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const baseline = config.getUnifiedPlayerRating(player());
assert(baseline.overall === 50 && baseline.offense === 50 && baseline.defense === 50,
  `全 50 属性不应存在隐含偏移：${JSON.stringify(baseline)}`);

const hub = config.getUnifiedPlayerRating(player({
  pos: 'C', threePT: 82, MID: 93, FIN: 95, DNK: 72, HAN: 90, PAS: 97,
  ATH: 66, STR: 92, REB: 93, PDEF: 60, IDEF: 82, STL: 65, BLK: 58,
}));
const isolatedPasser = config.getUnifiedPlayerRating(player({
  pos: 'C', PAS: 97, HAN: 60, threePT: 60, MID: 60, FIN: 60, ATH: 66, STR: 92, REB: 93,
}));
assert(hub.skills.playmaking > isolatedPasser.skills.playmaking + 10
  && hub.roles.hubCreator > isolatedPasser.roles.hubCreator + 12
  && hub.capacity.touchLoad > isolatedPasser.capacity.touchLoad + 8,
`组织中轴必须由传球、控球、得分威胁和篮板共同识别：${JSON.stringify({ hub, isolatedPasser })}`);

const athlete = config.getUnifiedPlayerRating(player({ ATH: 99, STL: 99 }));
const stopper = config.getUnifiedPlayerRating(player({ PDEF: 92, ATH: 90, STL: 72, STR: 80 }));
assert(stopper.skills.pointOfAttackDefense > athlete.skills.pointOfAttackDefense + 8
  && stopper.defense > athlete.defense + 5,
`运动/抢断单项不能高估为完整防守：${JSON.stringify({ athlete, stopper })}`);

const lowClutch = config.getUnifiedPlayerRating(player({ PAS: 84, HAN: 84, threePT: 84, FIN: 84, CLU: 25 }));
const highClutch = config.getUnifiedPlayerRating(player({ PAS: 84, HAN: 84, threePT: 84, FIN: 84, CLU: 99 }));
assert(Math.abs(highClutch.overall - lowClutch.overall) < 0.01,
  `CLU 不应抬高常规 OVR：${JSON.stringify({ low: lowClutch.overall, high: highClutch.overall })}`);

const defenseOnly = { PDEF: 82, IDEF: 86, STL: 78, BLK: 88, REB: 90, ATH: 80, STR: 88 };
const lowOffenseDefender = config.getUnifiedPlayerRating(player(Object.assign({}, defenseOnly, { HAN: 25, PAS: 25 })));
const highOffenseDefender = config.getUnifiedPlayerRating(player(Object.assign({}, defenseOnly, { HAN: 99, PAS: 99 })));
assert(Math.abs(lowOffenseDefender.roles.defensiveAnchor - highOffenseDefender.roles.defensiveAnchor) < 1e-9
  && Math.abs(lowOffenseDefender.skills.disruption - highOffenseDefender.skills.disruption) < 1e-9
  && Math.abs(lowOffenseDefender.defense - highOffenseDefender.defense) < 1e-9,
`进攻持球属性不能污染防守画像：${JSON.stringify({ lowOffenseDefender, highOffenseDefender })}`);

const positionProbe = player({ threePT: 84, MID: 81, FIN: 78, HAN: 88, PAS: 91, PDEF: 76, IDEF: 72 });
const positionOvrs = ['PG', 'SG', 'SF', 'PF', 'C'].map(pos => config.getUnifiedPlayerRating(positionProbe, pos).overall);
assert(positionOvrs.every(value => Math.abs(value - positionOvrs[0]) < 1e-9),
  `角色驱动模型不应保留无效的位置权重：${JSON.stringify(positionOvrs)}`);
assert(config.PLAYER_RATING_MODEL.version === 5
  && config.PLAYER_RATING_MODEL.mode === 'primary-secondary-role-impact',
  `统一评分模型必须使用 V5 主次角色影响公式：${JSON.stringify(config.PLAYER_RATING_MODEL)}`);

const completeCreator = config.getUnifiedPlayerRating(player({
  threePT: 88, MID: 90, FIN: 92, HAN: 94, PAS: 94,
}));
const incompleteCreator = config.getUnifiedPlayerRating(player({
  threePT: 70, MID: 70, FIN: 70, HAN: 70, PAS: 94,
}));
assert(completeCreator.roles.primaryCreator > incompleteCreator.roles.primaryCreator + 15
  && completeCreator.offense > incompleteCreator.offense + 15,
`完整持球技能包必须显著高于单项传球：${JSON.stringify({ completeCreator, incompleteCreator })}`);

const offenseSpecialist = config.getUnifiedPlayerRating(player({
  threePT: 96, MID: 94, FIN: 95, HAN: 96, PAS: 94, ATH: 82,
  PDEF: 45, IDEF: 35, STL: 45, BLK: 30, REB: 45, STR: 55,
}));
assert(offenseSpecialist.offense > offenseSpecialist.defense + 30
  && offenseSpecialist.overall > 90
  && offenseSpecialist.impact.neutralTotal === offenseSpecialist.overall,
`顶级主侧能力不应被另一侧短板线性压低：${JSON.stringify(offenseSpecialist)}`);

const pureAnchor = config.getUnifiedPlayerRating(player({
  FIN: 62, DNK: 72, HAN: 48, PAS: 45, PDEF: 70, IDEF: 97,
  STL: 65, BLK: 97, REB: 97, ATH: 78, STR: 94,
}));
assert(pureAnchor.roles.defensiveAnchor > 95
  && pureAnchor.overall <= 89.01
  && Math.abs(pureAnchor.rotationValue - pureAnchor.overall) > 0.1,
`纯防守支柱必须受角色上限约束，且轮换价值与 OVR 分离：${JSON.stringify(pureAnchor)}`);

const anchorBoundary = player({
  pos: 'C', threePT: 50, MID: 50, FIN: 99, DNK: 99, HAN: 50, PAS: 50,
  ATH: 92, STR: 96, REB: 92, PDEF: 50, IDEF: 90, STL: 50, BLK: 55,
});
const anchorBoundaryBefore = config.getUnifiedPlayerRating(anchorBoundary);
const anchorBoundaryAfter = config.getUnifiedPlayerRating(Object.assign({}, anchorBoundary, { IDEF: 91 }));
assert(anchorBoundaryAfter.offense >= anchorBoundaryBefore.offense
  && anchorBoundaryAfter.defense >= anchorBoundaryBefore.defense
  && anchorBoundaryAfter.rotationValue >= anchorBoundaryBefore.rotationValue
  && anchorBoundaryAfter.overall >= anchorBoundaryBefore.overall,
`防守支柱角色切换时属性提升不得降低 OVR：${JSON.stringify({ before: anchorBoundaryBefore, after: anchorBoundaryAfter })}`);

const minutes = [48, 48, 48, 48, 48];
const skillKeys = ['shootingGravity', 'rimScoring', 'shotCreation', 'playmaking', 'ballSecurity', 'pointOfAttackDefense', 'interiorDefense', 'rimProtection', 'rebounding'];
const roleKeys = ['primaryCreator', 'secondaryCreator', 'hubCreator', 'perimeterStopper', 'switchDefender', 'defensiveAnchor'];
const sharedSkills = Object.fromEntries(skillKeys.map(key => [key, 75]));
const fittedRoles = {
  primaryCreator: [95, 75, 70, 70, 70],
  secondaryCreator: [70, 90, 80, 70, 70],
  hubCreator: [80, 75, 75, 75, 75],
  perimeterStopper: [70, 70, 95, 75, 70],
  switchDefender: [70, 70, 80, 90, 70],
  defensiveAnchor: [70, 70, 70, 80, 90],
};
const fittedImpacts = minutes.map((_, index) => impact({
  skills: sharedSkills,
  roles: Object.fromEntries(roleKeys.map(key => [key, fittedRoles[key][index]])),
}));
const unfittedImpacts = minutes.map(() => impact({
  skills: sharedSkills,
  roles: Object.fromEntries(roleKeys.map(key => [key, 76])),
}));
function totals(rows, group, keys) {
  return Object.fromEntries(keys.map(key => [key, rows.reduce((sum, row) => sum + row[group][key], 0)]));
}
assert(JSON.stringify(totals(fittedImpacts, 'skills', skillKeys)) === JSON.stringify(totals(unfittedImpacts, 'skills', skillKeys))
  && JSON.stringify(totals(fittedImpacts, 'roles', roleKeys)) === JSON.stringify(totals(unfittedImpacts, 'roles', roleKeys)),
  '阵容适配对照组的 skills/roles 总量必须完全相同');
const fitted = rateRotationComposition(minutes, fittedImpacts);
const unfitted = rateRotationComposition(minutes, unfittedImpacts);
assert(fitted.total > unfitted.total + 1.0 && fitted.primaryCreatorCoverage > unfitted.primaryCreatorCoverage,
  `相同平均能力、不同角色结构必须得到不同阵容战力：${JSON.stringify({ fitted, unfitted })}`);

const leagueSource = fs.readFileSync(path.join(root, 'js', 'data', 'league_players.js'), 'utf8');
const league = new Function(`${leagueSource}\nreturn LEAGUE_PLAYER_DATA;`)();
const leaguePlayers = Object.values(league).flat();
const residuals = leaguePlayers.map(row => {
  const sourceOvr = Number(row.ovr);
  const formulaOvr = Math.round(config.getUnifiedPlayerRating(row, row.pos).overall);
  return { row, sourceOvr, formulaOvr, error: formulaOvr - sourceOvr };
});

const monotonicAttributeKeys = [
  'threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'ATH',
  'STR', 'REB', 'PDEF', 'IDEF', 'STL', 'BLK',
];
const monotonicFailures = [];
let monotonicChecks = 0;
leaguePlayers.forEach(row => {
  const before = config.getUnifiedPlayerRating(row, row.pos).overall;
  monotonicAttributeKeys.forEach(key => {
    const value = Number(row[key]);
    if (!Number.isFinite(value) || value >= 99) return;
    monotonicChecks++;
    const after = config.getUnifiedPlayerRating(Object.assign({}, row, { [key]: value + 1 }), row.pos).overall;
    if (after + 1e-9 < before) {
      monotonicFailures.push({ id: row.id, name: row.cname || row.name, key, value, before, after });
    }
  });
});
assert(monotonicFailures.length === 0,
  `真实名单存在属性提升后 OVR 下降：${JSON.stringify(monotonicFailures.slice(0, 10))}`);

function averageRanks(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end++;
    const rank = (start + end + 1) / 2;
    for (let index = start; index < end; index++) ranks[sorted[index].index] = rank;
    start = end;
  }
  return ranks;
}

function pearson(left, right) {
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  left.forEach((value, index) => {
    const leftDelta = value - leftMean;
    const rightDelta = right[index] - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  });
  return covariance / Math.sqrt(leftVariance * rightVariance);
}

const residualMetrics = {
  count: residuals.length,
  meanAbsoluteError: residuals.reduce((sum, row) => sum + Math.abs(row.error), 0) / residuals.length,
  withinThree: residuals.filter(row => Math.abs(row.error) <= 3).length,
  overFive: residuals.filter(row => Math.abs(row.error) > 5).length,
  spearman: pearson(
    averageRanks(residuals.map(row => row.sourceOvr)),
    averageRanks(residuals.map(row => row.formulaOvr))
  ),
};
const residualsByPosition = Object.fromEntries(['PG', 'SG', 'SF', 'PF', 'C'].map(position => {
  const rows = residuals.filter(entry => String(entry.row.pos || '').split('/')[0].trim() === position);
  return [position, rows.reduce((sum, entry) => sum + entry.error, 0) / rows.length];
}));
const specialtyRows = residuals.map(entry => {
  const values = monotonicAttributeKeys.map(key => Number(entry.row[key]) || 50);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const spread = Math.sqrt(values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length);
  return Object.assign({ spread }, entry);
}).sort((left, right) => left.spread - right.spread);
const specialtyGroupSize = Math.floor(specialtyRows.length * 0.20);
const balancedResidual = specialtyRows.slice(0, specialtyGroupSize)
  .reduce((sum, entry) => sum + entry.error, 0) / specialtyGroupSize;
const specialistResidual = specialtyRows.slice(-specialtyGroupSize)
  .reduce((sum, entry) => sum + entry.error, 0) / specialtyGroupSize;
assert(residualMetrics.count === 525
  && residualMetrics.meanAbsoluteError <= 3
  && residualMetrics.withinThree >= 340
  && residualMetrics.overFive <= 70
  && residualMetrics.spearman >= 0.74,
`V5 必须维持 525 人整体校准质量：${JSON.stringify(residualMetrics)}`);
assert(Object.values(residualsByPosition).every(value => Math.abs(value) <= 1.75),
  `V5 不得保留明显位置系统偏差：${JSON.stringify(residualsByPosition)}`);
assert(Math.abs(specialistResidual - balancedResidual) <= 1,
  `V5 不得系统性奖励均衡型或专项型球员：${JSON.stringify({ balancedResidual, specialistResidual })}`);

console.log(JSON.stringify({
  baseline: baseline.overall,
  hub: { playmaking: hub.skills.playmaking, hubCreator: hub.roles.hubCreator, touchLoad: hub.capacity.touchLoad },
  defense: { athlete: athlete.defense, stopper: stopper.defense },
  lineup: { fitted: fitted.total, unfitted: unfitted.total },
  residuals: residualMetrics,
  residualsByPosition,
  specialtyResiduals: { balanced: balancedResidual, specialist: specialistResidual },
  monotonicChecks,
}, null, 2));
