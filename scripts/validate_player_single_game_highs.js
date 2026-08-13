const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const helperStart = source.indexOf("const SINGLE_GAME_HIGH_FIELDS = Object.freeze");
const helperEnd = source.indexOf('function renderSeasonInsights()', helperStart);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(helperStart >= 0 && helperEnd > helperStart, '无法定位单场最高纪录计算逻辑');

const context = vm.createContext({
  console, Array, Boolean, Math, Number, Object,
  STATE: {
    season: {
      games: [
        { stats: { pts: 31, reb: 5, ast: 4, stl: 3, blk: 0 } },
        { stats: { pts: 24, reb: 13, ast: 11, stl: 1, blk: 4 } },
        { stats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 } },
        { stats: null, suspended: true },
      ],
    },
    career: { seasons: [] },
  },
});

vm.runInContext(source.slice(helperStart, helperEnd), context, { filename: 'index.html#single-game-highs' });

const seasonHighs = context.getCurrentSeasonSingleGameHighs();
assert(seasonHighs.games === 3, '伤停缺席场次被错误计入单场纪录样本');
assert(seasonHighs.pts === 31, '赛季单场最高得分计算错误');
assert(seasonHighs.reb === 13, '赛季单场最高篮板计算错误');
assert(seasonHighs.ast === 11, '赛季单场最高助攻计算错误');
assert(seasonHighs.stl === 3, '赛季单场最高抢断计算错误');
assert(seasonHighs.blk === 4, '赛季单场最高盖帽计算错误');

context.STATE.career.seasons = [
  { singleGameHighs: { games: 82, pts: 58, reb: 9, ast: 7, stl: 5, blk: 2 } },
  { playerStats: { games: 82, pts: 2000 } },
];
const careerHighs = context.getCareerSingleGameHighs();
assert(careerHighs.pts === 58, '生涯最高得分没有合并已归档赛季');
assert(careerHighs.reb === 13 && careerHighs.ast === 11, '生涯纪录没有逐项合并当前赛季');
assert(careerHighs.stl === 5 && careerHighs.blk === 4, '生涯防守纪录合并错误');

context.STATE._careerSaved = true;
context.STATE.career.seasons.push({ singleGameHighs: seasonHighs });
const savedCareerHighs = context.getCareerSingleGameHighs();
assert(savedCareerHighs.games === 85, '已归档当前赛季被重复计入生涯纪录样本');

assert(source.includes('singleGameHighs: getCurrentSeasonSingleGameHighs()'), '赛季归档没有保存单场最高纪录');
assert(source.includes('本赛季单场最高') && source.includes('职业生涯单场最高'), '赛季页或我的球员页缺少单场最高展示');

console.log(JSON.stringify({ seasonHighs, careerHighs }, null, 2));
