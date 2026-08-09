const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8') + ';this.DATA=LEAGUE_PLAYER_DATA;',
  context
);

const indexText = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ageMatch = indexText.match(/<script id='player-age-data' type='application\/json'>([\s\S]*?)<\/script>/);
if (!ageMatch) throw new Error('player-age-data not found');
const ages = Object.fromEntries(JSON.parse(ageMatch[1]).map((row) => [row.id, row.a]));

const scores = {};
const basis = {};

for (const roster of Object.values(context.DATA)) {
  if (!Array.isArray(roster)) continue;
  for (const player of roster) {
    const rookie = Number(ages[player.id]) <= 20;
    scores[player.id] = rookie ? 60 : 50;
    if (rookie) basis[player.id] = '新秀合同·中性偏稳';
  }
}

for (let pick = 1; pick <= 60; pick++) {
  const id = `D26-${String(pick).padStart(2, '0')}`;
  scores[id] = pick <= 14 ? 66 : pick <= 30 ? 63 : 60;
  basis[id] = '2026选秀·新秀合同';
}

function set(ids, score, reason) {
  for (const id of ids) {
    if (!(id in scores)) throw new Error(`Unknown player id: ${id}`);
    scores[id] = score;
    basis[id] = reason;
  }
}

// 长期效力、球队核心，以及此前已公开的长期续约信号。
set(['P0040', 'P0120', 'P0156', 'P0161', 'P0347'], 96, '长期效力·球队核心');
set(['P0092', 'P0138', 'P0189', 'P0265', 'P0296', 'P0330', 'P0362', 'P0398'], 90, '长期合同·球队核心');
set(['P0173', 'P0382', 'P0472'], 88, '长期合同·球队核心');
set(['P0434', 'P0487'], 82, '长期合同·稳定核心');
set(['P0003', 'P0076', 'P0109', 'P0196', 'P0333', 'P0476'], 84, '已续约·长期合同');
set(['P0105'], 80, '已续约·多年合同');
set(['P0124', 'P0175', 'P0348', 'P0349', 'P0439'], 90, '已续约·长期合同');
set(['P0177'], 72, '已续约·多年合同');
set(['P0181'], 80, '已续约·多年合同');
set(['P0225'], 86, '已续约·长期合同');

// 2026 休赛期续约、回签及延长合同。
set(['P0091', 'P0179'], 92, '2026续约·长期合同');
set(['P0226', 'P0452'], 94, '2026续约·长期合同');
set(['P0510'], 88, '2026续约·长期合同');
set(['P0044', 'P0188', 'P0218', 'P0289', 'P0300', 'P0337', 'P0403'], 84, '2026续约·长期合同');
set(['P0049', 'P0060', 'P0107', 'P0148', 'P0214', 'P0266', 'P0286', 'P0336', 'P0350', 'P0399', 'P0401', 'P0405', 'P0425', 'P0457'], 80, '2026续约·多年合同');
set(['P0022', 'P0024', 'P0081', 'P0117', 'P0135', 'P0158', 'P0162', 'P0163', 'P0441', 'P0446', 'P0484', 'P0491', 'P0504'], 72, '2026续约·多年合同');
set(['P0004', 'P0006', 'P0098', 'P0131', 'P0146', 'P0164', 'P0170', 'P0184', 'P0270', 'P0322', 'P0338', 'P0357', 'P0371', 'P0375', 'P0461', 'P0466'], 64, '2026回签·短期合同');
set(['P0303', 'P0306'], 68, '2026回签·合同年限未明');
set(['P0342'], 76, '2026回签·多年合同');

// 近期交易/加盟只说明当前合同关系，不能当成已经建立长期归属感。
set(['P0008', 'P0010', 'P0020', 'P0042', 'P0061', 'P0064', 'P0078', 'P0108', 'P0141', 'P0145', 'P0150', 'P0178', 'P0191', 'P0232', 'P0244', 'P0249', 'P0253', 'P0258', 'P0260', 'P0264', 'P0267', 'P0278', 'P0282', 'P0283', 'P0284', 'P0288', 'P0297', 'P0304', 'P0312', 'P0380', 'P0402', 'P0419', 'P0514', 'P0522'], 40, '2026近期交易·尚待建立归属');
set(['P0207', 'P0217', 'P0471'], 40, '2026交易报道·尚待确认');
set(['P0025', 'P0027', 'P0075', 'P0197', 'P0210', 'P0228', 'P0379', 'P0384', 'P0404', 'P0456', 'P0495', 'P0500'], 52, '2026新签约·短期观察');
set(['P0048', 'P0127', 'P0183', 'P0203', 'P0236', 'P0305', 'P0339', 'P0368', 'P0392', 'P0430', 'P0480'], 48, '2026新签约·一年合同');
set(['P0045', 'P0254'], 55, '2026新签约·多年合同');
set(['P0227', 'P0229', 'P0230', 'P0385'], 60, '2026新签约·长期合同');

// 名单快照仍保留、但最新交易信息显示已离开该队的球员。
set(['P0007', 'P0115', 'P0149', 'P0151', 'P0257', 'P0340', 'P0354', 'P0358', 'P0394', 'P0396'], 28, '最新交易后·原队关联较低');

const orderedScores = Object.fromEntries(Object.entries(scores).sort(([a], [b]) => a.localeCompare(b)));
const orderedBasis = Object.fromEntries(Object.entries(basis).sort(([a], [b]) => a.localeCompare(b)));
const output = [
  '// 研究快照：2026-08-06。运行时仅保留内部球员 ID、数值和通用依据标签。',
  '// 50 表示公开信息不足时的中性值；新秀不根据臆测性格评分。',
  `const PLAYER_LOYALTY_DATA = Object.freeze(${JSON.stringify(orderedScores, null, 2)});`,
  `const PLAYER_LOYALTY_BASIS = Object.freeze(${JSON.stringify(orderedBasis, null, 2)});`,
  "const PLAYER_LOYALTY_SOURCE_DATE = '2026-08-06';",
  ''
].join('\n');

fs.writeFileSync(path.join(root, 'js/data/player_loyalty.js'), output, 'utf8');
console.log(`Generated ${Object.keys(orderedScores).length} loyalty scores (${Object.keys(orderedBasis).length} basis labels).`);
