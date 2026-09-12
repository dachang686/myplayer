const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(__dirname, 'validate_basketball_realism.js'), 'utf8');
const harness = new Function('require', '__dirname', source.slice(0, source.indexOf('const ratingRows'))
  .replace('makeQuarter, freeThrowProbability, fieldGoalProbabilities', 'makeQuarter, freeThrowProbability, fieldGoalProbabilities, addTurnovers')
  + ';return {api,league,state,config,seed,originalRandom};')(require, __dirname);
const {api,league,state,config,seed,originalRandom} = harness;
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/player_offensive_roles.json'), 'utf8'));
const players = Object.values(league).flat();
assert(data.rows.length >= 400);
for (const row of data.rows) {
  const player = players.find(p => p.id === row.id);
  assert(player && player._offensiveRole.playerId === player.id);
  for (const key of ['fgm','fga','fta','ast']) {
    assert(Math.abs(row[key + '36'] - row[key] * 36 / row.minutes) < 0.000051);
    assert.equal(player._offensiveRole[key + '36'], row[key + '36']);
  }
  assert(row.gp >= 10 && row.minutes >= 8 && row.sourceUrl.startsWith('https://www.espn.com/nba/player/stats/'));
}
const subject = players.find(p => p.id === 'P0350');
function probe(patch = {}, rolePatch = {}) {
  const p = {...subject, ...patch, _offensiveRole:{...subject._offensiveRole,...rolePatch}};
  const rotation = {players:[p,...players.filter(x => x.id !== p.id).slice(0,7)],minutes:Array(8).fill(30),roleRanks:[0,1,2,3,4,5,6,7]};
  state.season._npcSeasonProfiles = {};
  for(const player of rotation.players)state.season._npcSeasonProfiles['ROLE:'+player.id]={scoring:1};
  seed(51000);
  return api.internals.contextForTeam('ROLE',{_preparedRotations:{ROLE:rotation}});
}
const base = probe();
assert(base.offensiveRoles[0]);
assert(Math.abs(base.offensiveRoles[0].scoringGrowth-1)<0.0001);
assert.equal(base.offensiveRoles[0].passingGrowth,1);
assert.equal(probe({id:'generated-rookie'}).offensiveRoles[0],null, 'Cloning a player must not inherit the source identity role');
assert.equal(probe({_isUser:true}).offensiveRoles[0],null, 'Custom players must not receive a source identity role');
assert.equal(probe({}, {fga36:Infinity}).offensiveRoles[0],null);
assert.equal(probe({}, {fgm36:100}).offensiveRoles[0],null);
assert(probe({PAS:90}).offensiveRoles[0].passingGrowth > base.offensiveRoles[0].passingGrowth);
assert(probe({HAN:90}).ballSecurity[0] > base.ballSecurity[0]);
assert(probe({FIN:99,MID:99}).offensiveRoles[0].scoringGrowth > base.offensiveRoles[0].scoringGrowth);
assert.equal(probe({cname:'Renamed player'}).opportunity[0],base.opportunity[0]);
assert(probe({}, {fga36:30,confidence:1}).opportunity[0] > probe({}, {fga36:10,confidence:1}).opportunity[0] * 2.9);
assert.deepEqual(probe({}, {tov36:9}).offensiveRoles,base.offensiveRoles,'Historical turnover counts must not enter the runtime role');

function turnoverProbe(handle, fga) {
  const context=probe({HAN:handle});
  context.volumeThree=base.volumeThree.slice();context.volumeMid=base.volumeMid.slice();context.volumeRim=base.volumeRim.slice();
  let total=0;
  for(let trial=0;trial<2000;trial++) {
    seed(70000+trial);
    const lines=context.players.map((_,i)=>({fga:i===0?fga:4,fta:2,ast:i===0?5:1,tov:0}));
    api.internals.addTurnovers(context,{lines,turnovers:10});
    assert.equal(lines.reduce((s,p)=>s+p.tov,0),10);
    total+=lines[0].tov;
  }
  return total/2000;
}
const turnoverControls={lowHandle:turnoverProbe(40,10),highHandle:turnoverProbe(90,10),highWorkload:turnoverProbe(90,25)};
assert(turnoverControls.highHandle<turnoverControls.lowHandle,'Higher handling must lower risk for identical decisions');
assert(turnoverControls.highWorkload>turnoverControls.highHandle,'More decisions must create more turnover exposure');

function teammateProbe(weakerTeammates) {
  seed(80000);
  const context=api.internals.contextForTeam('PHI',{ignoreNpcAvailability:true});
  const opponent=api.internals.contextForTeam('BOS',{ignoreNpcAvailability:true});
  const replacementIds=data.rows.filter(r=>['Jaylen Brown','LeBron James'].includes(r.name)).map(r=>r.id);
  const roster=context.players.map(p=>{
    if(!weakerTeammates||!replacementIds.includes(p.id))return {...p};
    const copy={...p,id:'role-player-'+p.id,cname:'Role player'};
    for(const key of config.ATTR_LIST)copy[key]=65;
    copy.ovr=config.getUnifiedPlayerOvr(copy,copy.pos);
    return copy;
  });
  let pts=0,fga=0;
  for(let trial=0;trial<700;trial++) {
    state.season._npcSeasonProfiles={};seed(81000+trial);
    const result=api.sim('PHI','BOS',0,null,{ignoreNpcAvailability:true,_preparedRotations:{
      PHI:{players:roster,minutes:context.minutes,roleRanks:context.roleRanks},
      BOS:{players:opponent.players,minutes:opponent.minutes,roleRanks:opponent.roleRanks},
    }});
    const line=result.boxScore.PHI.find(p=>p.playerId==='P0382');pts+=line.pts;fga+=line.fga;
  }
  return {minutes:context.minutes[roster.findIndex(p=>p.id==='P0382')],pts:pts/700,fga:fga/700};
}
const teammateControls={current:teammateProbe(false),fewerCreators:teammateProbe(true)};
assert(teammateControls.fewerCreators.fga>teammateControls.current.fga+2,'Fewer competing creators must give Embiid more shots');
assert(teammateControls.fewerCreators.pts>teammateControls.current.pts+3,'Scoring must adapt to teammates, not be locked to historical points');
Math.random = originalRandom;

// Exercise actual old-save hydration and its idempotency, not just data lookup.
const migrationSource = fs.readFileSync(path.join(__dirname, 'validate_league_ovr_anchor.js'), 'utf8');
const migration = new Function('require','__dirname',migrationSource.slice(0,migrationSource.indexOf('const sourceOvrs'))
  + ';return {context,runtimeLeague};')(require,__dirname);
const saved = Object.values(migration.runtimeLeague).flat().find(p=>p.id===subject.id);
delete saved._offensiveRole;
const attrsBefore = config.ATTR_LIST.map(k=>saved[k]);
vm.runInContext('syncLeaguePlayerOvrs()',migration.context);
assert(saved._offensiveRole && saved._offensiveRole.playerId===saved.id);
assert.deepEqual(config.ATTR_LIST.map(k=>saved[k]),attrsBefore);
assert.equal(vm.runInContext('syncLeaguePlayerOvrs()',migration.context),0);
console.log(JSON.stringify({profiles:data.rows.length,rateProvenance:true,identityIsolation:true,skillAdaptation:true,oldSaveHydration:true,idempotent:true,turnoverControls,teammateControls}));
