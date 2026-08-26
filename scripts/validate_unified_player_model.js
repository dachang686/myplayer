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
const originalScale = config.PLAYER_RATING_MODEL.scale.linear;
config.PLAYER_RATING_MODEL.scale.linear = originalScale - 0.10;
const configuredScaleOvr = config.getUnifiedPlayerRating(positionProbe).overall;
config.PLAYER_RATING_MODEL.scale.linear = originalScale;
assert(Math.abs(configuredScaleOvr - positionOvrs[0]) > 0.1, 'PLAYER_RATING_MODEL.scale 必须真实参与 OVR 计算');

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

console.log(JSON.stringify({
  baseline: baseline.overall,
  hub: { playmaking: hub.skills.playmaking, hubCreator: hub.roles.hubCreator, touchLoad: hub.capacity.touchLoad },
  defense: { athlete: athlete.defense, stopper: stopper.defense },
  lineup: { fitted: fitted.total, unfitted: unfitted.total },
}, null, 2));
