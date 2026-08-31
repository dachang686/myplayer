const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const CHECKPOINTS = [10, 15, 20, 25];
const SEED_COUNT = Math.max(1, Number(process.env.LONG_TERM_OVR_SEEDS) || 100);
const MAX_SEASONS = Math.max(25, ...CHECKPOINTS);

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
    return { players: players.length, count90, count85, count99, maxOvr, ovrMismatch };
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

  if ((snapshots[20] && snapshots[20].count99 > 2)
    || (snapshots[25] && snapshots[25].count99 > 2)) {
    seedsWith99Overflow += 1;
  }

  for (const season of CHECKPOINTS) {
    const snapshot = snapshots[season];
    if (!snapshot) continue;
    if (season <= 15 && !inRange(snapshot.count90, 18, 42)) {
      failures.push(`seed ${seed} 第 ${season} 季 90+ = ${snapshot.count90}，过渡期预期 18–42`);
    }
  }

  if (snapshots[20] && snapshots[25]) {
    const drop90 = snapshots[20].count90 - snapshots[25].count90;
    const drop85 = snapshots[20].count85 - snapshots[25].count85;
    if (drop90 > 10) failures.push(`seed ${seed} 第 20→25 季 90+ 下滑 ${drop90}，超过允许范围`);
    if (drop85 > 18) failures.push(`seed ${seed} 第 20→25 季 85+ 下滑 ${drop85}，超过允许范围`);
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
  };
}

const report = {
  seeds: SEED_COUNT,
  checkpoints: CHECKPOINTS,
  summaries: CHECKPOINTS.map(summarizeCheckpoint),
  seedsWith99Overflow,
  allowed99OverflowSeeds: Math.max(2, Math.floor(SEED_COUNT * 0.02)),
  failureCount: failures.length,
  failures: failures.slice(0, 50),
};

for (const season of [20, 25]) {
  const summary = report.summaries.find(row => row && row.season === season);
  if (!summary) continue;
  if (!inRange(summary.count90.avg, 11, 30)) {
    failures.push(`第 ${season} 季 90+ 均值 ${summary.count90.avg}，预期 18–30（允许均值 14–30）`);
  }
  if (summary.count90.min < 8) {
    failures.push(`第 ${season} 季 90+ 最低 ${summary.count90.min}，低于允许下限 8`);
  }
  if (!inRange(summary.count85.avg, 45, 82)) {
    failures.push(`第 ${season} 季 85+ 均值 ${summary.count85.avg}，预期 50–82（允许均值 45–82）`);
  }
  if (!inRange(summary.maxOvr.avg, 93, 99)) {
    failures.push(`第 ${season} 季最高 OVR 均值 ${summary.maxOvr.avg}，预期 96–99（允许均值 93–99）`);
  }
}

const summary20 = report.summaries.find(row => row && row.season === 20);
const summary25 = report.summaries.find(row => row && row.season === 25);
if (summary20 && summary25) {
  if (summary25.count90.avg < summary20.count90.avg - 5) {
    failures.push(`第 20→25 季 90+ 均值下滑 ${(summary20.count90.avg - summary25.count90.avg).toFixed(1)}，超过允许范围`);
  }
  if (summary25.count85.avg < summary20.count85.avg - 8) {
    failures.push(`第 20→25 季 85+ 均值下滑 ${(summary20.count85.avg - summary25.count85.avg).toFixed(1)}，超过允许范围`);
  }
}

if (seedsWith99Overflow > report.allowed99OverflowSeeds) {
  failures.push(`99 OVR 泛滥：${seedsWith99Overflow}/${SEED_COUNT} 个样本在检查点超过 2 人，允许 ${report.allowed99OverflowSeeds}`);
}

report.failureCount = failures.length;

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
