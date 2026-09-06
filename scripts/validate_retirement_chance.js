const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const start = offseasonSource.indexOf('function getLeaguePlayerRetirementChance');
const end = offseasonSource.indexOf('function evolveUnsignedFreeAgents', start);
if (start < 0 || end < 0) throw new Error('无法提取退役概率函数');

const context = vm.createContext({});
vm.runInContext(offseasonSource.slice(start, end), context, { filename: 'retirement-chance.js' });
const chance = (age, ovr, options) => context.getLeaguePlayerRetirementChance({ ovr, _age: age }, age, options);

const failures = [];
function expect(cond, msg) {
  if (!cond) failures.push(msg);
}

expect(chance(31, 70) === 0, `31岁不应退役：${chance(31, 70)}`);
expect(chance(32, 67) === 20, `32岁低OVR应为20：${chance(32, 67)}`);
expect(chance(32, 70) === 0, `32岁尚可轮换不应退役：${chance(32, 70)}`);
expect(chance(33, 71) === 30, `33岁边缘人应为30：${chance(33, 71)}`);
expect(chance(34, 74) === 40, `34岁OVR<75应为40：${chance(34, 74)}`);
expect(chance(34, 78) === 18, `34岁中段轮换应有基础概率：${chance(34, 78)}`);
expect(chance(34, 82) === 0, `34岁优质轮换暂不退役：${chance(34, 82)}`);
expect(chance(35, 90) === 16, `35岁球星应有基础概率：${chance(35, 90)}`);
expect(chance(35, 80) === 32, `35岁普通轮换应为32：${chance(35, 80)}`);
expect(chance(35, 70) === 48, `35岁边缘人应为48：${chance(35, 70)}`);
expect(chance(36, 86) === 28, `36岁球星应为28：${chance(36, 86)}`);
expect(chance(38, 80) === 65, `38岁非巨星应为65：${chance(38, 80)}`);
expect(chance(40, 95) === 80, `40岁几乎必退：${chance(40, 95)}`);
expect(chance(35, 74, { unsigned: true }) === Math.min(90, 48 + 18), `无队高龄边缘人应额外清退：${chance(35, 74, { unsigned: true })}`);
expect(
  context.getLeaguePlayerRetirementChance({ ovr: 70, _age: 37, _protectedRetirementAge: 42 }, 37) === 0,
  '受保护退役年龄失效'
);

const report = { failureCount: failures.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
