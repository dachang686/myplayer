const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const league=new Function(fs.readFileSync(path.join(root,'js/data/league_players.js'),'utf8')+';return LEAGUE_PLAYER_DATA;')();
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'data/player_semantic_calibration_v9.json'),'utf8'));
const ext=JSON.parse(fs.readFileSync(path.join(__dirname,'data/nba2k26_player_ratings.json'),'utf8')).players;
const players=Object.values(league).flat();
const byId=new Map(players.map(p=>[p.id,p]));
const byUrl=new Map(ext.map(p=>[p.url,p]));
const ATTR=['threePT','MID','FIN','DNK','HAN','PAS','PDEF','STL','IDEF','BLK','REB','ATH','STR','CLU'];
const failures=[];
let checkedFields=0,detailed2k=0,localReviewed=0,statsEligible=0;
const metricRows={STL:[],BLK:[],REB:[],PAS:[]};
function finite(x){return Number.isFinite(Number(x));}
function rank(values){const s=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),r=new Array(values.length); for(let i=0;i<s.length;){let j=i+1;while(j<s.length&&s[j].v===s[i].v)j++;const z=(i+j+1)/2;for(let k=i;k<j;k++)r[s[k].i]=z;i=j;}return r;}
function pearson(a,b){const am=a.reduce((x,y)=>x+y,0)/a.length,bm=b.reduce((x,y)=>x+y,0)/b.length;let c=0,av=0,bv=0;for(let i=0;i<a.length;i++){const x=a[i]-am,y=b[i]-bm;c+=x*y;av+=x*x;bv+=y*y;}return c/Math.sqrt(av*bv);}
function spearman(rows){if(rows.length<5)return 1;return pearson(rank(rows.map(x=>x[0])),rank(rows.map(x=>x[1])));}
function primary(pos){return String(pos||'SF').split('/')[0].trim();}
if(players.length!==525||audit.players.length!==525) failures.push(`player_count ${players.length}/${audit.players.length}`);
if(audit.rules && audit.rules.ovrUsedForAttributeFitting!==false) failures.push('OVR must not fit attributes');
for(const row of audit.players){
 const p=byId.get(row.id); if(!p){failures.push(`${row.id} missing`);continue;}
 if(Number(p.ovr)!==Number(row.targetOvr)) failures.push(`${row.id} OVR changed ${p.ovr}/${row.targetOvr}`);
 if(!row.reviewEvidence||!row.reviewEvidence.performance) failures.push(`${row.id} missing individual review evidence`);
 for(const k of ATTR){checkedFields++; if(Number(p[k])!==Number(row.profile[k])) failures.push(`${row.id} ${k} ${p[k]}/${row.profile[k]}`); if(p[k]<25||p[k]>99) failures.push(`${row.id} ${k} range ${p[k]}`);}
 if(row.sourceKind==='2k-semantic'){
  detailed2k++;
  const src=byUrl.get(row.sourceUrl); const bh=src&&src.attributes&&Number(src.attributes['Ball Handle']);
  if(!Number.isFinite(bh)) failures.push(`${row.id} missing 2K Ball Handle`);
  else if(Number(p.HAN)!==Math.round(Math.max(25,Math.min(99,bh)))) failures.push(`${row.id} HAN not Ball Handle ${p.HAN}/${bh}`);
 } else if(row.sourceKind==='local-reviewed'){
  localReviewed++;
  const pos=primary(p.pos), caps={PG:94,SG:90,SF:86,PF:86,C:72};
  if(Number(p.HAN)>caps[pos]) failures.push(`${row.id} local HAN implausible ${pos} ${p.HAN}`);
 }
 // Reject the exact V8 failure mode: most visible skills receiving the same non-zero OVR-fitting shift.
 const ds=Object.entries(row.changes||{}).filter(([k])=>k!=='HAN').map(([,v])=>Number(v[1])-Number(v[0]));
 const counts=new Map(); for(const d of ds) if(d) counts.set(d,(counts.get(d)||0)+1);
 if([...counts.values()].some(n=>n>=9)) failures.push(`${row.id} uniform normalization pattern`);
 const s=row.stats;
 if(s&&Number(s.GP)>=20&&Number(s.MIN)>=24){
  statsEligible++;
  if(Number(s.STL)>=1.4&&p.STL<70) failures.push(`${row.id} STL floor ${s.STL}->${p.STL}`);
  if(Number(s.BLK)>=1.0&&p.BLK<68) failures.push(`${row.id} BLK floor ${s.BLK}->${p.BLK}`);
  if(Number(s.REB)>=7.5&&p.REB<70) failures.push(`${row.id} REB floor ${s.REB}->${p.REB}`);
  if(Number(s.AST)>=7&&p.PAS<82) failures.push(`${row.id} PAS floor ${s.AST}->${p.PAS}`);
 }
 if(s&&Number(s.GP)>=15&&Number(s.MIN)>=15){
  if(finite(s.STL)) metricRows.STL.push([Number(s.STL)*36/Number(s.MIN),Number(p.STL)]);
  if(finite(s.BLK)) metricRows.BLK.push([Number(s.BLK)*36/Number(s.MIN),Number(p.BLK)]);
  if(finite(s.REB)) metricRows.REB.push([Number(s.REB)*36/Number(s.MIN),Number(p.REB)]);
  if(finite(s.AST)) metricRows.PAS.push([Number(s.AST)*36/Number(s.MIN),Number(p.PAS)]);
 }
}
const correlations=Object.fromEntries(Object.entries(metricRows).map(([k,v])=>[k,spearman(v)]));
for(const [k,v] of Object.entries(correlations)) if(v<0.55) failures.push(`${k} stats correlation ${v}`);
const focus={};
for(const [key,name,min] of [['ant','爱德华兹',90],['sga','亚历山大',90],['luka','东契奇',90],['flagg','弗拉格',80]]){
 const p=players.find(x=>x.cname===name&&x.ovr>=min); if(p) focus[key]=Object.fromEntries(['id','cname','pos','ovr',...ATTR].map(k=>[k,p[k]])); else failures.push(`${name} missing`);
}
if(focus.ant&&focus.sga&&focus.luka&&focus.flagg){
 if(!(focus.ant.STL>=68&&focus.ant.STL<=82)) failures.push(`Edwards STL ${focus.ant.STL}`);
 if(!(focus.sga.STL>focus.ant.STL&&focus.sga.PDEF>=focus.ant.PDEF)) failures.push('SGA/Edwards defensive hierarchy');
 if(!(focus.luka.PDEF<=68&&focus.luka.REB>focus.ant.REB&&focus.luka.PAS>focus.ant.PAS)) failures.push('Luka role hierarchy');
 if(!(focus.flagg.PDEF>=80&&focus.flagg.IDEF>=76&&focus.flagg.STL>=68&&focus.flagg.REB>=70)) failures.push('Flagg two-way profile');
}
const report={players:players.length,checkedFields,detailed2k,localReviewed,statsEligible,correlations,focus,failureCount:failures.length,failures:failures.slice(0,100)};
console.log(JSON.stringify(report,null,2)); if(failures.length) process.exitCode=1;
