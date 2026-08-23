const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'awards.js'), 'utf8');
const start = source.indexOf('function calcMVPScore');
const end = source.indexOf('function calcDefenseScore', start);
if (start < 0 || end < 0) throw new Error('无法定位 MVP 评分函数');

const calcMVPScore = new Function(
  'getTeamWins',
  'getSeedBonus',
  `${source.slice(start, end)}\nreturn calcMVPScore;`,
)(() => 52, () => 4);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const base = {
  stats: { gp: 82, pts: 30, reb: 8, ast: 7, stl: 1.5, blk: 0.8 },
  ovr: 95,
  age: 33,
  raw: { _awardStreak: { mvp: 0 } },
  isUser: false,
};
const older = Object.assign({}, base, { age: 35, raw: { _awardStreak: { mvp: 4 } } });
assert(calcMVPScore(base) === calcMVPScore(older), '相同当季表现不应因年龄/历史MVP次数改变评分');
assert(!/score\s*\*=\s*0\.92|score\s*\*=\s*0\.82|score\s*\*=\s*0\.88/.test(source.slice(start, end)), 'MVP 隐藏年龄/连庄惩罚仍存在');

console.log(JSON.stringify({ passed: true, score: calcMVPScore(base), checks: ['age-independent', 'history-independent'] }));
