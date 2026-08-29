const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const league=new Function(fs.readFileSync(path.join(root,'js/data/league_players.js'),'utf8')+';return LEAGUE_PLAYER_DATA;')();
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'data/player_semantic_calibration_v9.json'),'utf8'));
const players=Object.values(league).flat(), byId=new Map(players.map(p=>[p.id,p]));
const A=['threePT','MID','FIN','DNK','HAN','PAS','PDEF','STL','IDEF','BLK','REB','ATH','STR','CLU'];
const failures=[];let checked=0,statsInformed=0;const sourceCounts={};
for(const row of audit.players){const p=byId.get(row.id);if(!p){failures.push(`${row.id} missing`);continue;}sourceCounts[row.sourceKind]=(sourceCounts[row.sourceKind]||0)+1;if(Object.keys(row.statsAdjustments||{}).length)statsInformed++;for(const k of A){checked++;if(Number(p[k])!==Number(row.profile[k]))failures.push(`${row.id} ${k}`);}}
if(players.length!==525||audit.players.length!==525) failures.push(`count ${players.length}/${audit.players.length}`);
if((sourceCounts['2k-semantic']||0)!==478||(sourceCounts['local-reviewed']||0)!==47) failures.push(`source counts ${JSON.stringify(sourceCounts)}`);
console.log(JSON.stringify({players:players.length,checkedFields:checked,sourceCounts,statsInformed,failureCount:failures.length,failures:failures.slice(0,50)},null,2));if(failures.length)process.exitCode=1;
