const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = offseasonSource.indexOf('function getLeagueAttributeKeys');
const end = offseasonSource.indexOf('// ==================== 联盟演变', start);
if (start < 0 || end < 0) throw new Error('无法提取跨赛季属性生命周期逻辑');

const SIM_CONFIG = new Function(`${configSource}\nreturn SIM_CONFIG;`)();
const LEAGUE_PLAYER_DATA = new Function(`${leagueSource}\nreturn LEAGUE_PLAYER_DATA;`)();
const ATTR_KEYS = SIM_CONFIG.ATTR_LIST;
const context = vm.createContext({
  SIM_CONFIG,
  ATTR_KEYS,
  STATE: { career: { seasonCount: 0 } },
  clearLineupCache() {},
});
vm.runInContext(offseasonSource.slice(start, end), context, { filename: 'v2-career-full-chain.js' });

const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
const profiles = {
  PG: ['playmaker', 'scoring_guard'],
  SG: ['perimeter_scorer', 'two_way_slasher'],
  SF: ['two_way_wing', 'point_forward'],
  PF: ['interior_forward', 'stretch_four'],
  C: ['rim_protector', 'skilled_big'],
};
const sourceByPosition = Object.fromEntries(positions.map(pos => [pos, []]));
for (const player of Object.values(LEAGUE_PLAYER_DATA).flat()) {
  const pos = String(player.pos || '').split('/')[0].trim();
  if (sourceByPosition[pos] && sourceByPosition[pos].length < 20) sourceByPosition[pos].push(player);
}
if (positions.some(pos => sourceByPosition[pos].length < 20)) throw new Error('真实名单不足以建立五位置生命周期样本');

const trackedAttributes = ['threePT', 'PAS', 'PDEF', 'IDEF', 'REB', 'ATH'];
const failures = [];
let maximumSeasonAttributeChange = 0;
let maximumMeanDrift = 0;
let serializationChecks = 0;
let ovrConsistencyChecks = 0;
const seedSummaries = [];

function makeRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function buildRoster(seedIndex) {
  const roster = [];
  positions.forEach(pos => {
    sourceByPosition[pos].forEach((source, index) => {
      const player = JSON.parse(JSON.stringify(source));
      player.id = `R-${seedIndex}-${pos}-${index}`;
      player._prospectId = `CHAIN-${pos}-${index}`;
      player._rookieGenerationVersion = 3;
      player._rookieProfile = profiles[pos][index % profiles[pos].length];
      player._age = 18 + (index % 17);
      context.playerProbe = player;
      player.ovr = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
      roster.push(player);
    });
  });
  return roster;
}

function means(roster) {
  const result = {};
  positions.forEach(pos => {
    const group = roster.filter(player => String(player.pos).split('/')[0].trim() === pos);
    result[pos] = {};
    trackedAttributes.forEach(key => {
      result[pos][key] = group.reduce((sum, player) => sum + Number(player[key]), 0) / group.length;
    });
  });
  return result;
}

function profileHistogram(roster) {
  return roster.reduce((result, player) => {
    result[player._rookieProfile] = (result[player._rookieProfile] || 0) + 1;
    return result;
  }, {});
}

for (let seedIndex = 0; seedIndex < 5; seedIndex++) {
  const random = makeRandom(20260827 + seedIndex * 9973);
  const templates = buildRoster(seedIndex);
  let roster = JSON.parse(JSON.stringify(templates));
  const initialMeans = means(roster);
  const initialProfiles = profileHistogram(roster);
  const seasonMeans = [];
  let replacementSequence = 0;

  for (let season = 1; season <= 10; season++) {
    context.STATE.career.seasonCount = season;
    roster.forEach((player, index) => {
      const before = Object.fromEntries(ATTR_KEYS.map(key => [key, Number(player[key])]));
      const beforeOvr = Number(player.ovr);
      let requestedDelta = 0;
      if (player._age <= 23) requestedDelta = random() < 0.22 ? 2 : 1;
      else if (player._age <= 28) requestedDelta = random() < 0.38 ? 1 : (random() < 0.55 ? 0 : -1);
      else if (player._age <= 33) requestedDelta = random() < 0.14 ? 1 : -1;
      else requestedDelta = random() < 0.25 ? -2 : -1;

      if (requestedDelta) {
        context.playerProbe = player;
        vm.runInContext(`applyLeaguePlayerOvrChange(playerProbe, ${beforeOvr}, ${beforeOvr + requestedDelta})`, context);
        ATTR_KEYS.forEach(key => {
          const delta = Number(player[key]) - before[key];
          maximumSeasonAttributeChange = Math.max(maximumSeasonAttributeChange, Math.abs(delta));
          const cap = requestedDelta > 0 && player._age <= 23 && Math.abs(requestedDelta) >= 2 ? 3 : 2;
          if (Math.abs(delta) > cap || (delta && Math.sign(delta) !== Math.sign(requestedDelta))) {
            failures.push(`seed${seedIndex}/s${season}/${player.id}/${key} 属性变化 ${delta} 与方向 ${requestedDelta} 不符`);
          }
        });
      }
      context.playerProbe = player;
      if (player.ovr !== vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context)) {
        failures.push(`seed${seedIndex}/s${season}/${player.id} OVR 与属性不一致`);
      }
      ovrConsistencyChecks++;
      player._age++;

      if (player._age >= 36) {
        const replacement = JSON.parse(JSON.stringify(templates[index]));
        const pos = String(replacement.pos).split('/')[0].trim();
        replacement.id = `R-${seedIndex}-${pos}-replacement-${++replacementSequence}`;
        replacement._prospectId = `CHAIN-REPLACEMENT-${replacementSequence}`;
        replacement._rookieGenerationVersion = 3;
        replacement._age = 20;
        context.playerProbe = replacement;
        replacement.ovr = vm.runInContext('calcOVR(playerProbe, playerProbe.pos)', context);
        roster[index] = replacement;
      }
    });

    const serialized = JSON.stringify(roster);
    const restored = JSON.parse(serialized);
    for (let index = 0; index < roster.length; index++) {
      for (const key of ATTR_KEYS) {
        if (restored[index][key] !== roster[index][key]) failures.push(`seed${seedIndex}/s${season} 保存读取改写 ${roster[index].id}/${key}`);
      }
    }
    serializationChecks += roster.length;
    roster = restored;
    seasonMeans.push(means(roster));
  }

  const finalMeans = seasonMeans[seasonMeans.length - 1];
  positions.forEach(pos => {
    trackedAttributes.forEach(key => {
      const drift = Math.abs(finalMeans[pos][key] - initialMeans[pos][key]);
      maximumMeanDrift = Math.max(maximumMeanDrift, drift);
      if (drift > 8) failures.push(`seed${seedIndex}/${pos}/${key} 十赛季均值漂移 ${drift.toFixed(2)}`);
    });
  });
  if (JSON.stringify(profileHistogram(roster)) !== JSON.stringify(initialProfiles)) failures.push(`seed${seedIndex} 角色分布发生变化`);
  seedSummaries.push({ seedIndex, replacements: replacementSequence, finalMeans });
}

if (!/simulationEngine: 'v2'/.test(indexSource) || !/value="v2" checked/.test(indexSource)) {
  failures.push('V2 尚未成为新生涯正式默认');
}
if (/function normalizeRookieAttributesToOvr|function normalizeLeaguePlayerAttributesToOvr/.test(offseasonSource)) {
  failures.push('跨赛季链路仍存在目标 OVR 反推属性函数');
}

const result = {
  seeds: 5,
  seasonsPerSeed: 10,
  playersPerSeason: 100,
  ovrConsistencyChecks,
  serializationChecks,
  maximumSeasonAttributeChange,
  maximumMeanDrift: Number(maximumMeanDrift.toFixed(3)),
  replacements: seedSummaries.map(row => row.replacements),
  failureCount: failures.length,
  failures: failures.slice(0, 50),
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
