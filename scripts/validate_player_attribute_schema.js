const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const schema=require(path.join(root,'js/data/player_attribute_schema.js'));
const failures=[];
if(schema.version!==3) failures.push(`schema version ${schema.version}`);
if(!schema.fields||schema.fields.HAN.label!=='控球') failures.push('HAN label must be 控球');
if(schema.fields.HAN.nba2kAttribute!=='Ball Handle'||schema.fields.HAN.excludedNba2kAttribute!=='Hands') failures.push('HAN semantics invalid');
if(!schema.calibration||schema.calibration.ovrUsedForAttributeFitting!==false||schema.calibration.uniformShiftForbidden!==true) failures.push('V9 calibration contract missing');
const league=new Function(fs.readFileSync(path.join(root,'js/data/league_players.js'),'utf8')+';return LEAGUE_PLAYER_DATA;')();
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'data/player_semantic_calibration_v9.json'),'utf8'));
const byId=new Map(Object.values(league).flat().map(player=>[player.id,player]));
const fields=['threePT','MID','FIN','DNK','HAN','PAS','PDEF','STL','IDEF','BLK','REB','ATH','STR','CLU'];
const semanticFailures=[];
for(const row of audit.players){
  const player=byId.get(row.id);
  if(!player){semanticFailures.push(`${row.id} missing`);continue;}
  for(const key of fields) if(Number(player[key])!==Number(row.profile[key])) semanticFailures.push(`${row.id} ${key}`);
  if(row.sourceKind==='2k-semantic'&&Number(player.HAN)!==Number(row.profile.HAN)) semanticFailures.push(`${row.id} HAN semantics`);
}
if(semanticFailures.length) failures.push(`semantic calibration failed: ${semanticFailures.slice(0,10).join(', ')}`);
console.log(JSON.stringify({schemaVersion:schema.version,HAN:schema.fields.HAN,semanticValidator:semanticFailures.length?'FAIL':'PASS',failures},null,2));
if(failures.length) process.exitCode=1;
