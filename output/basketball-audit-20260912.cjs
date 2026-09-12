// Read-only audit of the shipped runtime. Run: node output/basketball-audit-20260912.cjs
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('index.html');
const config = require('../js/data/simulation_config.js');
const { LEAGUE_PLAYER_DATA: league, LEAGUE_TEAM_IDS: teams } = new Function(read('js/data/league_players.js') + ';return {LEAGUE_PLAYER_DATA,LEAGUE_TEAM_IDS};')();
const state = { careerTeam: null, finalOVR: 0, attrs: {}, season: { schedule: [], isPlayoffs: false, _npcSeasonProfiles: {}, events: { activeEffects: [] } } };
const af = x => Math.pow((Math.max(25, Math.min(99, x || 50)) - 25) / 74, 0.85 * 1.5);
const engine = html.slice(html.indexOf('function getPlayerPositions'), html.indexOf('/** 属性→效率系数：递减曲线'));
// Expose diagnostics only in memory; do not change the application source.
const v2 = read('js/simulation_v2.js').replace('global.SIMULATION_ENGINE_V2 =', 'global.__basketballAudit = { contextForTeam, makeQuarter, freeThrowProbability }; global.SIMULATION_ENGINE_V2 =');
const api = new Function('LEAGUE_PLAYER_DATA', 'SIM_CONFIG', 'STATE', 'getMyPlayerDisplayName', 'getTeamName', 'getLeaguePlayerAge', 'af', 'ensureSeasonEventState', engine + '\n' + v2 + '\nreturn {sim:globalThis.simulateGameAggregateV2, internals:globalThis.__basketballAudit};')(league, config, state, () => 'Audit', t => t, p => Number(p._age) || 27, af, () => state.season.events);
function seed(n) { let x = n >>> 0; Math.random = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
const originalRandom = Math.random;
const round = x => Math.round(x * 10000) / 10000;
const profile = (p, pos) => { const r = config.getUnifiedPlayerRating(p, pos); return { ovr: Math.round(r.overall), offense: round(r.offense), defense: round(r.defense) }; };
const attrs = n => Object.fromEntries(config.ATTR_LIST.map(k => [k, n]));
const report = {};
report.method = {engine:'default V2',rosterPlayers:teams.reduce((s,t)=>s+league[t].length,0),rosterSchedule:'Every unordered team pair, 12 matches, alternating home court',availabilityAgeAssumption:27,pairedGamesPerVariant:2500,pairedRotation:'8 players x 30 minutes; seven unchanged players and one C under test',statSnapshot:'scripts/data/player_semantic_calibration_v9.json; 2025-26 season',scope:'Pure runtime probes; no browser UI or V1 statistical audit'};
const ratingRows = teams.flatMap(team => league[team].map(p => ({ team, ...p, rating: profile(p, p.pos) })));
report.ovrZeroWeights = Object.fromEntries(config.POS_LIST.map(pos => [pos, config.ATTR_LIST.filter(k => !config.OVR_FIT_MODEL.weights[pos][k])]));
report.sameOvrCenter = [25, 99].map(n => ({ HAN: n, PDEF: n, STL: n, ...profile({ ...attrs(75), HAN: n, PDEF: n, STL: n }, 'C') }));
report.topDefense = ratingRows.slice().sort((a,b) => b.rating.defense-a.rating.defense).slice(0,18).map(p => ({team:p.team,name:p.cname,...p.rating}));

seed(20260912);
const totals = new Map();
const teamTotals = { games: 0, pts: 0, fta: 0, ftm: 0, fga: 0, fgm:0, threeA: 0, threeM: 0, orb: 0, pace: 0, reb:0,ast:0,stl:0,blk:0,tov:0 };
let invariantErrors=0;
for (const team of teams) for (const p of league[team]) p.ovr = config.getUnifiedPlayerOvr(p, p.pos);
for (let repeat = 0; repeat < 12; repeat++) for (let a = 0; a < teams.length; a++) for (let b = a + 1; b < teams.length; b++) {
  const game = api.sim(teams[a], teams[b], 0, null, { isHomeA: repeat % 2 === 0 });
  teamTotals.games += 2; teamTotals.pts += game.scoreA + game.scoreB; teamTotals.pace += game.pace * 2;
  for (const team of [teams[a], teams[b]]) for (const line of game.boxScore[team]) {
    if (!(line.mins > 0)) continue;
    const row = totals.get(line.playerId) || { id: line.playerId, games: 0, mins: 0, pts: 0, fta: 0, ftm: 0, fga: 0, fgm: 0, threeA: 0, threeM: 0,reb:0,ast:0,stl:0,blk:0,tov:0, maxPts:0 };
    row.games++;
    row.maxPts=Math.max(row.maxPts,line.pts);
    if(line.pts!==2*line.fgm+line.threeM+line.ftm||line.fgm>line.fga||line.threeM>line.threeA||line.threeA>line.fga||line.ftm>line.fta)invariantErrors++;
    for (const k of ['mins','pts','fta','ftm','fga','fgm','threeA','threeM','reb','ast','stl','blk','tov']) { row[k] += line[k] || 0; if (k in teamTotals && k !== 'pts') teamTotals[k] += line[k] || 0; }
    totals.set(line.playerId, row);
  }
  for (const period of game.engineDiagnostics.periods) teamTotals.orb += (period.offensiveReboundsA || 0) + (period.offensiveReboundsB || 0);
}
report.simulatedGames = teamTotals.games / 2;
report.teamAverages = Object.fromEntries(Object.entries(teamTotals).filter(([k]) => k !== 'games').map(([k,v]) => [k, round(v/teamTotals.games)]));
report.teamAverages.ftPct = round(teamTotals.ftm / teamTotals.fta);
report.teamAverages.fgPct=round(teamTotals.fgm/teamTotals.fga);
report.teamAverages.threePct=round(teamTotals.threeM/teamTotals.threeA);
report.teamAverages.freeThrowRate=round(teamTotals.fta/teamTotals.fga);
report.invariantErrors=invariantErrors;
report.leaders=Object.fromEntries(['pts','reb','ast','stl','blk','tov'].map(key=>[key,[...totals.values()].filter(t=>t.games>=150&&t.mins/t.games>=15).sort((a,b)=>b[key]/b.games-a[key]/a.games).slice(0,10).map(t=>({id:t.id,name:ratingRows.find(p=>p.id===t.id).cname,value:round(t[key]/t.games),mins:round(t.mins/t.games),maxPts:t.maxPts}))]));
const auditData = JSON.parse(read('scripts/data/player_semantic_calibration_v9.json')).players;
report.playerExamples = ratingRows.filter(p => ['戈贝尔','库里','约基奇','德拉蒙德','亚当斯','克拉克斯顿','阿德巴约','西蒙斯','卡佩拉','卡鲁索'].includes(p.cname)).map(p => {
  const t = totals.get(p.id); const source = auditData.find(r => r.id === p.id);
  return { id:p.id,team:p.team,name:p.cname,threePT:p.threePT,MID:p.MID,...p.rating, snapshot:source && source.stats, simulated:t && {games:t.games,mins:round(t.mins/t.games),pts:round(t.pts/t.games),threeA:round(t.threeA/t.games),threePct:round(t.threeM/t.threeA),fta:round(t.fta/t.games),ftPct:round(t.ftm/t.fta),fgPct:round(t.fgm/t.fga)} };
});

function prepared(team, changes = {}) {
  const positions = ['PG','SG','SF','PF','C','SG','PF','C'];
  const players = positions.map((pos,i) => ({ id:team+i,cname:team+i,pos,...attrs(75),...(i===4?changes:{} ) }));
  players.forEach(p => {p.ovr=config.getUnifiedPlayerOvr(p,p.pos);});
  return {players,minutes:players.map(() => 30),roleRanks:players.map((_,i)=>i)};
}
function paired(changes) {
  const rotations = { AA: prepared('AA', changes), BB: prepared('BB') };
  for (const team of ['AA','BB']) for (const p of rotations[team].players) state.season._npcSeasonProfiles[team+':'+p.id] = {scoring:1};
  const opts = { _preparedRotations: rotations };
  let margin=0, expected=0, wins=0, firstThreeQuartersMargin=0;
  for(let i=0;i<2500;i++){seed(990000+i);const g=api.sim('AA','BB',0,null,opts);margin+=g.actualMargin;expected+=g.expectedMargin;wins+=g.won?1:0;firstThreeQuartersMargin+=g.qScoresA.slice(0,3).reduce((s,n)=>s+n,0)-g.qScoresB.slice(0,3).reduce((s,n)=>s+n,0);}
  return {...profile(rotations.AA.players[4],'C'),margin:round(margin/2500),firstThreeQuartersMargin:round(firstThreeQuartersMargin/2500),expectedMargin:round(expected/2500),winPct:round(wins/2500)};
}
report.sameOvrGameImpact = { low:paired({HAN:25,PDEF:25,STL:25}), high:paired({HAN:99,PDEF:99,STL:99}) };
report.clutchGameImpact = {low:paired({CLU:25}),high:paired({CLU:99})};
report.ftFormulaNeutral = [25,50,75,99].map(n => ({threeAndMid:n,freeThrowPct:round(api.internals.freeThrowProbability({three:[(n-25)/74],mid:[(n-25)/74],fatigue:0},0))}));

function extract(name) {
  const start=html.indexOf('function '+name+'(');if(start<0)throw new Error(name);
  let depth=0;const begin=html.indexOf('{',start);
  for(let i=begin;i<html.length;i++){if(html[i]==='{')depth++;if(html[i]==='}'&&--depth===0)return html.slice(start,i+1);}
}
const eventNames=['getAgeBasedInjuryRate','getSeasonInjuryEventRate','getMajorInjuryEventRate','getSeasonEndingInjuryGamesLeft','getInjuryPlaySeverity','shouldOfferPlayThroughInjury'];
const eventApi=new Function('STATE',eventNames.map(extract).join('\n')+'\nreturn {'+eventNames.join(',')+'};')(state);
state.career={currentAge:22};
report.injuryRates=[22,25,26,30,34,38].map(age=>{state.career.currentAge=age;return {age,perGamePct:eventApi.getSeasonInjuryEventRate(),conditionalMajorPct:eventApi.getMajorInjuryEventRate(),majorPerGamePct:round(eventApi.getSeasonInjuryEventRate()*eventApi.getMajorInjuryEventRate()/100)};});
state.season.schedule=Array.from({length:82},(_,i)=>({simulated:i<78}));
const registryStart=html.indexOf('var EVENT_REGISTRY = []');
const registry=new Function('STATE','window',html.slice(registryStart,html.indexOf('</script>',registryStart))+';return EVENT_REGISTRY;')(state,{});
const surgery=registry.find(e=>e.id==='injury_major_meniscus_surgery').execute({});
const seasonEndingGames=surgery._games;
state.season.events={injuryGamesLeft:seasonEndingGames,injuryReason:surgery.desc,majorInjuryThisSeason:surgery._majorInjury,suspensionGamesLeft:0};
report.surgery={remainingRegularGames:4,assignedInjuryGames:seasonEndingGames,severity:eventApi.getInjuryPlaySeverity(state.season.events),canOfferPlayThrough:eventApi.shouldOfferPlayThroughInjury('audit-surgery',true)};
for(let i=0;i<4;i++)state.season.events.injuryGamesLeft--;
state.season.isPlayoffs=true;report.surgery.injuryGamesAtPlayoffStart=state.season.events.injuryGamesLeft;
Math.random=()=>0; // Select the actual concussion event's minimum duration.
const concussion=registry.find(e=>e.id==='injury_concussion').execute({});
state.season.events={injuryGamesLeft:concussion._games,injuryReason:concussion.desc,suspensionGamesLeft:0};
report.concussion={severity:eventApi.getInjuryPlaySeverity(state.season.events),canOfferPlayThrough:eventApi.shouldOfferPlayThroughInjury('audit-concussion',false)};

const trainingSource=read('scripts/validate_player_training_growth.js');
const trainingPrelude=trainingSource.slice(0,trainingSource.indexOf('const failures = []'));
const trainingApi=new Function('require','__dirname',trainingPrelude+'\nreturn {context,run:()=>context.applyAnnualAttributeDrift(),resetState,seededRandom};')(require,path.join(root,'scripts'));
report.annualAttributeDeltas={};
for(const age of [22,28,32,35,38]){
  const sums=Object.fromEntries(config.ATTR_LIST.map(k=>[k,0]));
  for(let i=1;i<=500;i++){trainingApi.resetState({level:75,age,seasonCount:i});trainingApi.seededRandom(i*7919+age);trainingApi.run();for(const k of config.ATTR_LIST)sums[k]+=trainingApi.context.STATE.attrs[k]-75;}
  report.annualAttributeDeltas[age]=Object.fromEntries(Object.entries(sums).map(([k,v])=>[k,round(v/500)]));
}
Math.random=originalRandom;
fs.writeFileSync(path.join(__dirname,'basketball-audit-20260912.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
