const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const SEED_COUNT = Math.max(1, Number(process.env.PROBE_SEEDS) || 10);
const MAX_SEASONS = 15;
const CHECKPOINTS = [10, 11, 12, 13, 14, 15];

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

function bucketKey(value, edges) {
  for (let i = 0; i < edges.length - 1; i++) {
    if (value >= edges[i] && value < edges[i + 1]) {
      return `${edges[i]}-${edges[i + 1] - 1}`;
    }
  }
  const last = edges[edges.length - 1];
  return `${last}+`;
}

function collectLeagueSnapshot(context) {
  return vm.runInContext(`(() => {
    const players = LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team] || [])
      .concat(Array.isArray(STATE._freeAgentPool) ? STATE._freeAgentPool : [])
      .filter(player => player && !player._isUser);
    const ovrs = players.map(p => Number(p.ovr) || 0);
    const ages = players.map(p => Number(p._age) || getLeaguePlayerAge(p) || 0);
    const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    const sorted = ovrs.slice().sort((a, b) => b - a);
    const top35 = players.slice()
      .sort((a, b) => (Number(b.ovr) || 0) - (Number(a.ovr) || 0))
      .slice(0, 35);
    const top35Ages = top35.map(p => Number(p._age) || getLeaguePlayerAge(p) || 0);
    return {
      players: players.length,
      avgOvr: avg(ovrs),
      medianOvr: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
      maxOvr: sorted[0] || 0,
      count99: ovrs.filter(v => v >= 99).length,
      count95: ovrs.filter(v => v >= 95).length,
      count90: ovrs.filter(v => v >= 90).length,
      count85: ovrs.filter(v => v >= 85).length,
      count80: ovrs.filter(v => v >= 80).length,
      count75: ovrs.filter(v => v >= 75).length,
      avgAge: avg(ages),
      medianAge: ages.slice().sort((a, b) => a - b)[Math.floor(ages.length / 2)] || 0,
      ageUnder25: ages.filter(a => a < 25).length,
      age25to29: ages.filter(a => a >= 25 && a <= 29).length,
      age30to34: ages.filter(a => a >= 30 && a <= 34).length,
      age35plus: ages.filter(a => a >= 35).length,
      top35AvgAge: avg(top35Ages),
      top35Under30: top35Ages.filter(a => a < 30).length,
      top35Age30to34: top35Ages.filter(a => a >= 30 && a <= 34).length,
      top35Age35plus: top35Ages.filter(a => a >= 35).length,
      ovrList: ovrs,
      ageList: ages,
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
  vm.runInContext(offseasonSource, context, { filename: 'offseason-probe.js' });

  let rookieSeq = 0;
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  context.generateRookie = function generateRookie() {
    rookieSeq += 1;
    return {
      id: `R${String(rookieSeq).padStart(6, '0')}`,
      _prospectId: `PROBE-${seed}-${rookieSeq}`,
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

function emptyHist(keys) {
  return Object.fromEntries(keys.map(k => [k, 0]));
}

function accumulateDistribution(target, values, edges, labelFn) {
  values.forEach(value => {
    const key = labelFn ? labelFn(value) : bucketKey(value, edges);
    target[key] = (target[key] || 0) + 1;
  });
}

const OVR_EDGES = [50, 60, 65, 70, 75, 80, 85, 90, 95, 99];
const AGE_EDGES = [18, 22, 25, 28, 30, 33, 35, 38, 42];
const ovrBucketLabels = (() => {
  const labels = [];
  for (let i = 0; i < OVR_EDGES.length - 1; i++) labels.push(`${OVR_EDGES[i]}-${OVR_EDGES[i + 1] - 1}`);
  labels.push(`${OVR_EDGES[OVR_EDGES.length - 1]}+`);
  return labels;
})();
const ageBucketLabels = (() => {
  const labels = [];
  for (let i = 0; i < AGE_EDGES.length - 1; i++) labels.push(`${AGE_EDGES[i]}-${AGE_EDGES[i + 1] - 1}`);
  labels.push(`${AGE_EDGES[AGE_EDGES.length - 1]}+`);
  return labels;
})();

const checkpointStats = Object.fromEntries(CHECKPOINTS.map(season => [season, {
  rows: [],
  ovrHist: emptyHist(ovrBucketLabels),
  ageHist: emptyHist(ageBucketLabels),
}]));

for (let seedIndex = 0; seedIndex < SEED_COUNT; seedIndex++) {
  const seed = 20260906 + seedIndex * 7919;
  const context = createContext(seed);
  context.LEAGUE_PLAYER_DATA = cloneLeagueData(context.LEAGUE_PLAYER_DATA);
  context.STATE._freeAgentPool = [];

  for (let season = 1; season <= MAX_SEASONS; season++) {
    runSeason(context);
    if (!CHECKPOINTS.includes(season)) continue;
    const snapshot = collectLeagueSnapshot(context);
    const bucket = checkpointStats[season];
    bucket.rows.push(snapshot);
    accumulateDistribution(bucket.ovrHist, snapshot.ovrList, OVR_EDGES);
    accumulateDistribution(bucket.ageHist, snapshot.ageList, AGE_EDGES);
  }
}

function avg(rows, key) {
  return rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
}

function histPercents(hist, samplePlayers) {
  const out = {};
  Object.keys(hist).forEach(key => {
    out[key] = {
      countAvg: Number((hist[key] / SEED_COUNT).toFixed(1)),
      pct: Number(((hist[key] / samplePlayers) * 100).toFixed(1)),
    };
  });
  return out;
}

const report = {
  seeds: SEED_COUNT,
  seasons: CHECKPOINTS,
  note: 'evolveLeague + processDraft + assignFreeAgents；含 roster + FA',
  seasonsDetail: CHECKPOINTS.map(season => {
    const { rows, ovrHist, ageHist } = checkpointStats[season];
    const samplePlayers = rows.reduce((sum, row) => sum + row.players, 0);
    return {
      season,
      players: Number(avg(rows, 'players').toFixed(1)),
      ovr: {
        avg: Number(avg(rows, 'avgOvr').toFixed(2)),
        median: Number(avg(rows, 'medianOvr').toFixed(2)),
        max: Number(avg(rows, 'maxOvr').toFixed(2)),
        count99: Number(avg(rows, 'count99').toFixed(2)),
        count95: Number(avg(rows, 'count95').toFixed(2)),
        count90: Number(avg(rows, 'count90').toFixed(2)),
        count85: Number(avg(rows, 'count85').toFixed(2)),
        count80: Number(avg(rows, 'count80').toFixed(2)),
        count75: Number(avg(rows, 'count75').toFixed(2)),
        distribution: histPercents(ovrHist, samplePlayers),
      },
      age: {
        avg: Number(avg(rows, 'avgAge').toFixed(2)),
        median: Number(avg(rows, 'medianAge').toFixed(2)),
        under25: Number(avg(rows, 'ageUnder25').toFixed(1)),
        age25to29: Number(avg(rows, 'age25to29').toFixed(1)),
        age30to34: Number(avg(rows, 'age30to34').toFixed(1)),
        age35plus: Number(avg(rows, 'age35plus').toFixed(1)),
        top35Avg: Number(avg(rows, 'top35AvgAge').toFixed(2)),
        top35Under30: Number(avg(rows, 'top35Under30').toFixed(1)),
        top35Age30to34: Number(avg(rows, 'top35Age30to34').toFixed(1)),
        top35Age35plus: Number(avg(rows, 'top35Age35plus').toFixed(1)),
        distribution: histPercents(ageHist, samplePlayers),
      },
    };
  }),
};

console.log(JSON.stringify(report, null, 2));
