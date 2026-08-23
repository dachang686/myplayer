const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Object, Array, Number, String, Boolean, RegExp, Math, JSON, isFinite });
context.globalThis = context;
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'career_narrative_rules.js'), 'utf8'), context, { filename: 'js/career_narrative_rules.js' });
const rules = context.CareerNarrativeRules;
if (!rules) throw new Error('事实文案规则未加载');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fill(text, facts) {
  return String(text).replace(/\{([^{}]+)\}/g, (match, key) => facts[key] == null ? match : String(facts[key]));
}

function renderPool(section, facts) {
  return rules.getPool(section, facts).map(entry => fill(entry.text, facts)).join('\n');
}

function renderBiography(facts) {
  return Object.keys(rules.copy.biography).map(section => renderPool(section, facts)).join('\n');
}

function fixture(overrides) {
  return Object.assign({
    championships: 0, mvp: 0, fmvp: 0, dpoy: 0, allLeague: 0, allStar: 0,
    teamsPlayed: 1, oneTeamCareer: true, majorInjury: false, wasTraded: false,
    hasRival: false, finalsAppearances: 0, hof: false, top100: false, goat: false,
    seasonsCount: 10, games: 700, points: 12000, longestTeam: '球队A',
    '总冠军': 0, 'MVP': 0, 'FMVP': 0, 'DPOY': 0, '最佳阵容': 0, '全明星': 0,
    '赛季数': 10, '场次': 700, '总得分': 12000, '球队数': 1, '姓名': '测试球员',
    '冠军线': '没有总冠军', '球队列表': '球队A', '首队': '球队A',
  }, overrides || {});
}

const prohibitedNoTitle = /冠军戒指|冠军游行|举起冠军奖杯|卫冕/;
const prohibitedNoInjury = /复健|重伤|被伤病偷走|伤病错过系列赛/;
const prohibitedNoTrade = /被交易|交易电话|被球队送走/;
const prohibitedOneTeam = /辗转多城|很多城市|多支老东家/;

const noRingStar = fixture({ mvp: 5, 'MVP': 5, championships: 0, '总冠军': 0 });
const noRingText = renderPool('retirement', noRingStar) + renderPool('hofFail', noRingStar) + renderPool('top100Fail', noRingStar) + renderBiography(noRingStar);
assert(!prohibitedNoTitle.test(noRingText), '0冠超级巨星出现冠军事实');

const multiRing = fixture({ championships: 5, '总冠军': 5, fmvp: 3, 'FMVP': 3, hof: true, top100: true, teamsPlayed: 2, oneTeamCareer: false, '球队数': 2 });
const multiRingText = renderPool('retirement', multiRing) + renderPool('hof', multiRing) + renderPool('top100', multiRing) + renderBiography(multiRing);
assert(!/终生无冠|从未举起奖杯/.test(multiRingText), '多冠球员出现无冠事实');

const oneTeam = fixture({ teamsPlayed: 1, '球队数': 1, oneTeamCareer: true });
assert(!prohibitedOneTeam.test(renderBiography(oneTeam)), '一人一城出现多队事实');

const noInjury = fixture({ majorInjury: false, hadMajorInjury: false });
assert(!prohibitedNoInjury.test(renderPool('retirement', noInjury) + renderBiography(noInjury)), '无重大伤病出现伤病文案');
const injury = fixture({ majorInjury: true, hadMajorInjury: true });
assert(renderPool('retirement', injury).includes('重大伤病'), '有重大伤病未进入伤病文案池');

const noTrade = fixture({ wasTraded: false });
assert(!prohibitedNoTrade.test(renderPool('retirement', noTrade) + renderBiography(noTrade)), '未交易球员出现交易事实');

const dpoy = fixture({ dpoy: 2, 'DPOY': 2, hof: true, top100: true });
assert(renderPool('hof', dpoy).includes('2次DPOY') && renderBiography(dpoy).includes('2次DPOY'), 'DPOY次数未按事实显示');
const noDpoy = fixture({ dpoy: 0, 'DPOY': 0 });
assert(!/0次DPOY|0次最佳防守球员/.test(renderPool('hof', noDpoy) + renderBiography(noDpoy)), 'DPOY=0出现虚构荣誉');

const noAwards = fixture({ allStar: 0, allLeague: 0, '全明星': 0, '最佳阵容': 0 });
assert(!/一次次入选全明星|多年最佳阵容/.test(renderBiography(noAwards)), '零全明星/零最佳阵容出现荣誉事实');

const multiTeam = fixture({ teamsPlayed: 3, '球队数': 3, oneTeamCareer: false, '球队列表': '球队A、球队B、球队C' });
assert(renderBiography(multiTeam).includes('3支球队'), '多队球队路线没有进入传记事实');

const sections = ['retirement', 'hof', 'hofFail', 'top100', 'top100Fail'];
const generated = sections.reduce((total, section) => total + rules.getPool(section, multiRing).length * 120, 0);
assert(generated >= 100, '终局文案反例生成量不足100条');

console.log(JSON.stringify({ passed: true, generated, checks: ['zero-ring-star', 'multi-champion', 'one-team', 'injury', 'trade', 'dpoy', 'award-zero'] }));
