const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const CHECKPOINTS = [10, 15, 20, 25, 30, 35];
const EQUILIBRIUM_CHECKPOINTS = [20, 25, 30, 35];
const SEED_COUNT = Math.max(1, Number(process.env.LONG_TERM_OVR_SEEDS) || 100);
const MAX_SEASONS = Math.max(35, ...CHECKPOINTS);

const configSource = fs.readFileSync(path.join(root, 'js/data/simulation_config.js'), 'utf8');
const leagueSource = fs.readFileSync(path.join(root, 'js/data/league_players.js'), 'utf8');
const offseasonSource = fs.readFileSync(path.join(root, 'js/offseason.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ageStart = html.indexOf('player-age-data');
const ageJsonStart = html.indexOf('>', ageStart) + 1;
const ageJsonEnd = html.indexOf('</script>', ageJsonStart);

function makeSeededRandom(seed) {
  let value = seed >>> 0;
  return function rngNext() {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function cloneLeagueData(source) {
  return JSON.parse(JSON.stringify(source));
}

function collectLeagueSnapshot(context) {
  return vm.runInContext(`(() => {
    const players = LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team] || [])
      .concat(Array.isArray(STATE._freeAgentPool) ? STATE._freeAgentPool : [])
      .filter(player => player && !player._isUser);
    let count90 = 0;
    let count85 = 0;
    let count99 = 0;
    let maxOvr = 0;
    let ovrMismatch = 0;
    players.forEach(player => {
      const ovr = Number(player.ovr) || 0;
      if (ovr >= 90) count90++;
      if (ovr >= 85) count85++;
      if (ovr >= 99) count99++;
      maxOvr = Math.max(maxOvr, ovr);
      const formulaOvr = Math.round(calcOVR(player, player.pos));
      if (isGeneratedLeaguePlayer(player)) {
        if (formulaOvr !== Math.round(ovr)) ovrMismatch++;
      } else if (Number(player._ovrAnchorVersion) < LEAGUE_OVR_ANCHOR_VERSION) {
        ovrMismatch++;
      }
    });
    const top35 = players.slice()
      .sort((left, right) => (Number(right.ovr) || 0) - (Number(left.ovr) || 0))
      .slice(0, 35);
    const top35Ages = top35.map(player => Number(player._age) || 0).filter(age => age > 0);
    const top35Under30 = top35Ages.filter(age => age < 30).length;
    const top35Age30To34 = top35Ages.filter(age => age >= 30 && age <= 34).length;
    const top35Age35Plus = top35Ages.filter(age => age >= 35).length;
    const top35AverageAge = top35Ages.length
      ? top35Ages.reduce((sum, age) => sum + age, 0) / top35Ages.length
      : 0;
    return {
      players: players.length,
      count90,
      count85,
      count99,
      maxOvr,
      ovrMismatch,
      top35Under30,
      top35Age30To34,
      top35Age35Plus,
      top35AverageAge,
    };
  })()`, context);
}

function createContext(seed) {
  const context = {
    console: { log() {}, error() {} },
    window: {},
    document: {
      getElementById(id) {
        return id === 'player-age-data' ? { textContent: html.slice(ageJsonStart, ageJsonEnd) } : null;
      },
    },
    STATE: {
      careerTeam: null,
      career: { seasonCount: 0, currentAge: 18, flags: {}, seasons: [] },
      season: { leaguePlayerSeasonStats: {} },
      _prevStandings: {},
      _teamHistory: {},
      _leagueChanges: {},
      _contractsInited: true,
      _freeAgentPool: [],
    },
    MVP_STAR_PROSPECT_IDS: [],
    clearLineupCache() {},
    getMyPlayerDisplayName: () => '用户',
    isMvpStar: () => false,
    prepareScheduledStarRookiesForDraft: () => {},
    canPlayPosition(playerPos, targetPos) {
      return String(playerPos || '').split('/').map(value => value.trim()).includes(targetPos);
    },
    calcTeamLineup(teamId) {
      const roster = context.LEAGUE_PLAYER_DATA[teamId] || [];
      const starters = {};
      ['PG', 'SG', 'SF', 'PF', 'C'].forEach(position => {
        const candidate = roster
          .filter(player => context.canPlayPosition(player.pos, position))
          .sort((a, b) => (Number(b.ovr) || 0) - (Number(a.ovr) || 0))[0];
        if (candidate) starters[position] = candidate;
      });
      return {
        starters,
        bench: roster.slice().sort((a, b) => (Number(b.ovr) || 0) - (Number(a.ovr) || 0)).slice(5, 10),
      };
    },
  };

  context.rngNext = makeSeededRandom(seed);
  vm.createContext(context);
  vm.runInContext(`${configSource}\nthis.SIM_CONFIG = SIM_CONFIG;`, context);
  vm.runInContext(`${leagueSource}\nthis.LEAGUE_PLAYER_DATA = LEAGUE_PLAYER_DATA; this.LEAGUE_TEAM_IDS = LEAGUE_TEAM_IDS;`, context);
  context.ATTR_KEYS = context.SIM_CONFIG.ATTR_LIST;
  vm.runInContext(offseasonSource, context, { filename: 'offseason-long-term.js' });

  let rookieSeq = 0;
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  context.generateRookie = function generateRookie() {
    rookieSeq += 1;
    return {
      id: `R${String(rookieSeq).padStart(6, '0')}`,
      _prospectId: `LT-${seed}-${rookieSeq}`,
      cname: `新秀${rookieSeq}`,
      pos: positions[rookieSeq % positions.length],
      ovr: 65,
      _age: 19 + (rookieSeq % 2),
      type: '新秀',
    };
  };

  vm.runInContext(`
    calculateContractStayRate = function() { return 1; };
    updatePlayerRoleSatisfactionHistory = function() {};
    isMvpStar = function() { return false; };
    assignFreeAgents = function(options) {
      options = options || {};
      var pool = Array.isArray(STATE._freeAgentPool) ? STATE._freeAgentPool.slice() : [];
      pool.sort(function(a, b) { return (Number(b.ovr) || 0) - (Number(a.ovr) || 0); });
      var remaining = [];
      pool.forEach(function(fa) {
        if (!fa) return;
        var signed = false;
        LEAGUE_TEAM_IDS.forEach(function(teamId) {
          if (signed) return;
          var roster = LEAGUE_PLAYER_DATA[teamId] || (LEAGUE_PLAYER_DATA[teamId] = []);
          if (roster.length < 18) {
            fa.contract = Math.max(1, Number(fa.contract) || 2);
            fa._lastTeam = teamId;
            roster.push(fa);
            signed = true;
            return;
          }
          var cut = getFreeAgentRosterCutCandidate(teamId, false) || getFreeAgentRosterCutCandidate(teamId, true);
          if (!cut || (Number(fa.ovr) || 0) <= (Number(cut.ovr) || 0)) return;
          var cutIndex = roster.indexOf(cut);
          if (cutIndex < 0) return;
          roster.splice(cutIndex, 1);
          cut.contract = 0;
          remaining.push(cut);
          fa.contract = Math.max(1, Number(fa.contract) || 2);
          fa._lastTeam = teamId;
          roster.push(fa);
          signed = true;
        });
        if (!signed) remaining.push(fa);
      });
      STATE._freeAgentPool = remaining;
      enforceLeagueRosterCapacity(null, { reason: 'post_free_agent_capacity' });
    };
  `, context);

  return context;
}

function runSeason(context) {
  vm.runInContext(`
    LEAGUE_TEAM_IDS.forEach(function(team) {
      STATE._prevStandings[team] = { wins: 20 + Math.floor(rngNext() * 42), losses: 20 + Math.floor(rngNext() * 42) };
      if (!STATE._teamHistory[team]) STATE._teamHistory[team] = [0.5];
    });
    evolveLeague();
    processDraft();
    assignFreeAgents();
    syncLeaguePlayerOvrs();
  `, context);
  context.STATE.career.seasonCount += 1;
}

function inRange(value, min, max) {
  return value >= min && value <= max;
}

const failures = [];
const checkpointStats = Object.fromEntries(CHECKPOINTS.map(season => [season, []]));
let seedsWith99Overflow = 0;

for (let seedIndex = 0; seedIndex < SEED_COUNT; seedIndex++) {
  const seed = 20260831 + seedIndex * 7919;
  const context = createContext(seed);
  context.LEAGUE_PLAYER_DATA = cloneLeagueData(context.LEAGUE_PLAYER_DATA);
  context.STATE._freeAgentPool = [];

  const snapshots = {};
  for (let season = 1; season <= MAX_SEASONS; season++) {
    runSeason(context);
    if (CHECKPOINTS.includes(season)) {
      const snapshot = collectLeagueSnapshot(context);
      snapshots[season] = snapshot;
      checkpointStats[season].push(snapshot);
      if (snapshot.ovrMismatch > 0) {
        failures.push(`seed ${seed} 第 ${season} 季有 ${snapshot.ovrMismatch} 名球员 OVR 与属性公式不一致`);
      }
    }
  }

  if (EQUILIBRIUM_CHECKPOINTS.some(season => snapshots[season] && snapshots[season].count99 > 2)) {
    seedsWith99Overflow += 1;
  }

  for (const season of CHECKPOINTS) {
    const snapshot = snapshots[season];
    if (!snapshot) continue;
    if (season <= 15 && !inRange(snapshot.count90, 18, 42)) {
      failures.push(`seed ${seed} 第 ${season} 季 90+ = ${snapshot.count90}，过渡期预期 18–42`);
    }
    if (EQUILIBRIUM_CHECKPOINTS.includes(season)) {
      if (snapshot.top35Under30 < 8) {
        failures.push(`seed ${seed} 第 ${season} 季前35名仅 ${snapshot.top35Under30} 人低于30岁`);
      }
      if (snapshot.top35Age30To34 > 22) {
        failures.push(`seed ${seed} 第 ${season} 季前35名有 ${snapshot.top35Age30To34} 人集中在30–34岁`);
      }
      if (season >= 25 && snapshot.top35Age35Plus > 9) {
        failures.push(`seed ${seed} 第 ${season} 季前35名有 ${snapshot.top35Age35Plus} 人达到35岁以上`);
      }
    }
  }

  for (let index = 1; index < EQUILIBRIUM_CHECKPOINTS.length; index++) {
    const earlier = snapshots[EQUILIBRIUM_CHECKPOINTS[index - 1]];
    const later = snapshots[EQUILIBRIUM_CHECKPOINTS[index]];
    if (!earlier || !later) continue;
    const drop90 = earlier.count90 - later.count90;
    const drop85 = earlier.count85 - later.count85;
    if (drop90 > 8) {
      failures.push(`seed ${seed} 第 ${EQUILIBRIUM_CHECKPOINTS[index - 1]}→${EQUILIBRIUM_CHECKPOINTS[index]} 季 90+ 下滑 ${drop90}，超过允许范围`);
    }
    if (drop85 > 12) {
      failures.push(`seed ${seed} 第 ${EQUILIBRIUM_CHECKPOINTS[index - 1]}→${EQUILIBRIUM_CHECKPOINTS[index]} 季 85+ 下滑 ${drop85}，超过允许范围`);
    }
  }
}

function summarizeCheckpoint(season) {
  const rows = checkpointStats[season];
  if (!rows.length) return null;
  const avg = key => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
  const min = key => Math.min(...rows.map(row => row[key]));
  const max = key => Math.max(...rows.map(row => row[key]));
  return {
    season,
    samples: rows.length,
    count90: { min: min('count90'), max: max('count90'), avg: Number(avg('count90').toFixed(2)) },
    count85: { min: min('count85'), max: max('count85'), avg: Number(avg('count85').toFixed(2)) },
    maxOvr: { min: min('maxOvr'), max: max('maxOvr'), avg: Number(avg('maxOvr').toFixed(2)) },
    count99: { min: min('count99'), max: max('count99'), avg: Number(avg('count99').toFixed(2)) },
    top35Under30: { min: min('top35Under30'), max: max('top35Under30'), avg: Number(avg('top35Under30').toFixed(2)) },
    top35Age30To34: { min: min('top35Age30To34'), max: max('top35Age30To34'), avg: Number(avg('top35Age30To34').toFixed(2)) },
    top35Age35Plus: { min: min('top35Age35Plus'), max: max('top35Age35Plus'), avg: Number(avg('top35Age35Plus').toFixed(2)) },
    top35AverageAge: { min: Number(min('top35AverageAge').toFixed(2)), max: Number(max('top35AverageAge').toFixed(2)), avg: Number(avg('top35AverageAge').toFixed(2)) },
  };
}

function validateEquilibriumSummary(summary, failures) {
  const season = summary.season;
  if (!inRange(summary.count90.avg, 18, 30)) {
    failures.push(`第 ${season} 季 90+ 均值 ${summary.count90.avg}，目标 18–30`);
  }
  if (summary.count90.min < 14) {
    failures.push(`第 ${season} 季 90+ 最低 ${summary.count90.min}，低于允许下限 14`);
  }
  if (!inRange(summary.count85.avg, 50, 82)) {
    failures.push(`第 ${season} 季 85+ 均值 ${summary.count85.avg}，目标 50–82`);
  }
  if (!inRange(summary.maxOvr.avg, 95, 99)) {
    failures.push(`第 ${season} 季最高 OVR 均值 ${summary.maxOvr.avg}，目标 95–99`);
  }
  if (!inRange(summary.top35Under30.avg, 10, 24)) {
    failures.push(`第 ${season} 季前35名30岁以下均值 ${summary.top35Under30.avg}，目标 10–24`);
  }
  if (!inRange(summary.top35Age30To34.avg, 6, 20)) {
    failures.push(`第 ${season} 季前35名30–34岁均值 ${summary.top35Age30To34.avg}，目标 6–20`);
  }
  if (!inRange(summary.top35Age35Plus.avg, 0, 8)) {
    failures.push(`第 ${season} 季前35名35岁以上均值 ${summary.top35Age35Plus.avg}，目标 0–8`);
  }
  if (!inRange(summary.top35AverageAge.avg, 26.5, 31.5)) {
    failures.push(`第 ${season} 季前35名平均年龄 ${summary.top35AverageAge.avg}，目标 26.5–31.5`);
  }
}

function validateEquilibriumTrend(left, right, failures) {
  if (right.count90.avg < left.count90.avg - 4) {
    failures.push(`第 ${left.season}→${right.season} 季 90+ 均值下滑 ${(left.count90.avg - right.count90.avg).toFixed(1)}，超过允许范围`);
  }
  if (right.count85.avg < left.count85.avg - 6) {
    failures.push(`第 ${left.season}→${right.season} 季 85+ 均值下滑 ${(left.count85.avg - right.count85.avg).toFixed(1)}，超过允许范围`);
  }
}

const summaries = CHECKPOINTS.map(summarizeCheckpoint);

for (const season of EQUILIBRIUM_CHECKPOINTS) {
  const summary = summaries.find(row => row && row.season === season);
  if (summary) validateEquilibriumSummary(summary, failures);
}

for (let index = 1; index < EQUILIBRIUM_CHECKPOINTS.length; index++) {
  const left = summaries.find(row => row && row.season === EQUILIBRIUM_CHECKPOINTS[index - 1]);
  const right = summaries.find(row => row && row.season === EQUILIBRIUM_CHECKPOINTS[index]);
  if (left && right) validateEquilibriumTrend(left, right, failures);
}

if (seedsWith99Overflow > Math.max(2, Math.floor(SEED_COUNT * 0.02))) {
  failures.push(`99 OVR 泛滥：${seedsWith99Overflow}/${SEED_COUNT} 个样本在均衡检查点超过 2 人，允许 ${Math.max(2, Math.floor(SEED_COUNT * 0.02))}`);
}

const report = {
  seeds: SEED_COUNT,
  checkpoints: CHECKPOINTS,
  equilibriumCheckpoints: EQUILIBRIUM_CHECKPOINTS,
  summaries,
  seedsWith99Overflow,
  allowed99OverflowSeeds: Math.max(2, Math.floor(SEED_COUNT * 0.02)),
  failureCount: failures.length,
  failures: failures.slice(0, 50),
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
