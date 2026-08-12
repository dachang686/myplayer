const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const config = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const build = config.BUILD;

if (config.ATTR_LIST.length !== build.TOTAL_ATTRS) {
  throw new Error(`属性数与配置不一致：${config.ATTR_LIST.length} !== ${build.TOTAL_ATTRS}`);
}
if (!Number.isInteger(build.POINT_BUILD_MIN_POINTS) || !Number.isInteger(build.POINT_BUILD_MAX_POINTS)) {
  throw new Error('自由建人点数范围必须为整数');
}
if (build.POINT_BUILD_MIN_POINTS !== 300 || build.POINT_BUILD_MAX_POINTS !== 360) {
  throw new Error(`自由建人点数范围应为 300-360，实际为 ${build.POINT_BUILD_MIN_POINTS}-${build.POINT_BUILD_MAX_POINTS}`);
}
if (build.POINT_BUILD_BASE_ATTR < build.ATTR_MIN || build.POINT_BUILD_BASE_ATTR > build.ATTR_MAX) {
  throw new Error('自由建人属性起点超出合法范围');
}

const requiredFragments = [
  'STATE.buildPointsTotal = buildConfig.POINT_BUILD_MIN_POINTS',
  'STATE.buildPointsRemaining = STATE.buildPointsTotal',
  'function changePointBuildAttr(key, delta, event)',
  'function finishPointBuild()',
  'STATE.buildPointsRemaining !== 0',
  'value < maxAttr',
  "id=\"point-build-list\"",
  'window.scrollTo({ top: pageScrollTop',
  'changePointBuildAttr(key, 10)',
  'setInterval(function()',
];
requiredFragments.forEach((fragment) => {
  if (!indexSource.includes(fragment)) throw new Error(`缺少自由建人逻辑：${fragment}`);
});

const totalMinimum = build.TOTAL_ATTRS * build.POINT_BUILD_BASE_ATTR;
console.log(JSON.stringify({
  attributes: build.TOTAL_ATTRS,
  baseAttribute: build.POINT_BUILD_BASE_ATTR,
  pointRange: [build.POINT_BUILD_MIN_POINTS, build.POINT_BUILD_MAX_POINTS],
  totalAttributeRange: [totalMinimum + build.POINT_BUILD_MIN_POINTS, totalMinimum + build.POINT_BUILD_MAX_POINTS],
}, null, 2));
