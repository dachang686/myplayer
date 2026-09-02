const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const leaguePath = path.join(root, 'js', 'data', 'league_players.js');
const auditPath = path.join(__dirname, 'data', 'player_semantic_calibration_v9.json');

// 仅使用已缓存的 2025-26 高样本数据复核。来源 OVR 不参与这些属性改动。
const reviews = {
  P0005: { original: { MID: 88, FIN: 81, DNK: 85, IDEF: 75, REB: 73 }, attributes: { MID: 82, FIN: 75, DNK: 80, IDEF: 70, REB: 68 }, reason: '74 场、31.0 分钟，15.2 分、7.6 篮板、1.1 盖帽、37.6% 三分；保留投射和盖帽，回调过高的中投、终结、扣篮、内防和篮板画像。' },
  P0099: { original: { MID: 86, BLK: 78 }, attributes: { MID: 82, BLK: 70 }, reason: '64 场、17.9 分钟，4.5 分、35.5% 三分；中投与后卫盖帽画像下调。' },
  P0030: { original: { threePT: 81, FIN: 81, HAN: 79, PAS: 78 }, attributes: { threePT: 78, FIN: 77, HAN: 75, PAS: 74 }, reason: '63 场、24.3 分钟，7.2 分、3.0 助攻；投射、终结与持球画像回调。' },
  P0069: { original: { threePT: 83, MID: 93, FIN: 81, HAN: 83, PAS: 72 }, attributes: { threePT: 78, MID: 84, FIN: 76, HAN: 78, PAS: 68 }, reason: '53 场、12.6 分钟，5.5 分、36.0% 命中、32.3% 三分；高投射和持球画像回调。' },
  P0233: { original: { threePT: 82, MID: 78, FIN: 80 }, attributes: { threePT: 76, MID: 74, FIN: 76 }, reason: '82 场、25.1 分钟，8.2 分、32.1% 三分；得分画像回调。' },
  P0255: { original: { threePT: 80, FIN: 77, REB: 82 }, attributes: { threePT: 77, FIN: 74, REB: 76 }, reason: '59 场、18.9 分钟，7.4 分、3.7 篮板、34.2% 三分；投射、终结和篮板画像回调。' },
  P0394: { original: { threePT: 79, FIN: 74, DNK: 80, HAN: 80, PAS: 74 }, attributes: { threePT: 76, FIN: 71, DNK: 75, HAN: 76, PAS: 70 }, reason: '48 场、11.5 分钟，3.7 分、1.4 助攻；进攻与持球画像回调。' },
  P0046: { original: { threePT: 72, FIN: 77, REB: 64, IDEF: 54, BLK: 49 }, attributes: { threePT: 77, FIN: 80, REB: 67, IDEF: 57, BLK: 52 }, reason: '69 场、16.2 分钟，57.7% 命中、43.3% 三分、4.1 篮板；效率、投射和内线画像上调。' },
  P0317: { original: { threePT: 77, MID: 71, FIN: 77, DNK: 60 }, attributes: { threePT: 80, MID: 75, FIN: 81, DNK: 65 }, reason: '72 场、31.2 分钟，17.7 分、36.7% 三分；得分和终结画像上调。' },
  P0487: { original: { MID: 69, REB: 71 }, attributes: { MID: 74, REB: 74 }, reason: '42 场、34.4 分钟，26.7 分、6.9 篮板；中距离与篮板画像上调。' },
};

function replacePlayerBlock(source, id, attributes) {
  const start = source.indexOf(`    "id": "${id}",`);
  if (start < 0) throw new Error(`找不到球员 ${id}`);
  const nextPlayer = source.indexOf('\n  },{', start);
  const teamEnd = source.indexOf('\n  }]', start);
  const end = Math.min(...[nextPlayer, teamEnd].filter(index => index >= 0));
  let block = source.slice(start, end);
  Object.entries(attributes).forEach(([key, value]) => {
    const pattern = new RegExp(`(^\\s*"${key}":\\s*)\\d+(,?\\s*$)`, 'm');
    if (!pattern.test(block)) throw new Error(`${id} 缺少 ${key}`);
    block = block.replace(pattern, `$1${value}$2`);
  });
  return source.slice(0, start) + block + source.slice(end);
}

function build() {
  let leagueSource = fs.readFileSync(leaguePath, 'utf8');
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const auditById = new Map(audit.players.map(row => [row.id, row]));
  const changes = [];

  Object.entries(reviews).forEach(([id, review]) => {
    const auditRow = auditById.get(id);
    if (!auditRow) throw new Error(`审计缺少 ${id}`);
    const before = {};
    Object.entries(review.attributes).forEach(([key, value]) => {
      before[key] = Number(review.original && review.original[key] != null ? review.original[key] : auditRow.profile[key]);
      if (!Number.isInteger(value) || value < 25 || value > 99) throw new Error(`${id} ${key} 越界`);
      auditRow.profile[key] = value;
    });
    auditRow.formulaResidualReview = {
      season: '2025-26',
      reason: review.reason,
      changes: Object.fromEntries(Object.keys(review.attributes).map(key => [key, [before[key], review.attributes[key]]])),
    };
    leagueSource = replacePlayerBlock(leagueSource, id, review.attributes);
    changes.push({ id, changes: auditRow.formulaResidualReview.changes });
  });
  return { leagueSource, audit, changes };
}

function main() {
  const result = build();
  const apply = process.argv.includes('--apply');
  if (apply) {
    fs.writeFileSync(leaguePath, result.leagueSource);
    fs.writeFileSync(auditPath, `${JSON.stringify(result.audit, null, 2)}\n`);
  }
  console.log(JSON.stringify({ apply, reviewedPlayers: result.changes.length, changes: result.changes }, null, 2));
}

if (require.main === module) main();

module.exports = { build };
