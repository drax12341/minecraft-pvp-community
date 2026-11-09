import config from './community.json' with {type:'json'};
export const deskTiers = ['HT3','LT2','HT2','LT1','HT1'];
export const deskRegions = ['EU','NA','AS','SA','AU','AF','ME','OC'];
export const deskPaths = {
 HT3:['Win the initial tester set 3–1 or better (3–2 at tester discretion).','Beat an HT3 opponent in a first to 4.'],
 LT2:['Beat two opponents in your tier with an 8–5 or better combined score.','Score at least 7–7 overall against two LT2 opponents, with at least 3 rounds on each.'],
 HT2:['Beat two opponents in your tier with an 8–5 or better combined score.','Score at least 7–7 overall against two HT2 opponents, with at least 3 rounds on each.'],
 LT1:['Beat one opponent in the tier below you 4–2 or better.','Beat two opponents in your tier with an 8–5 or better combined score.','Score at least 7–7 overall against two LT1 opponents, with at least 3 rounds on each.'],
 HT1:['Beat one opponent in the tier below you 4–2 or better.','Beat two opponents in your tier with an 8–5 or better combined score.','Defeat the current HT1 holder.'],
};
const ds=(name,description,required=false,choices)=>({type:3,name,description,required,...(choices?{choices:choices.map(v=>typeof v==='string'?{name:v,value:v}:v)}:{})});
const dm=(required=true)=>ds('mode','Testing gamemode',required,config.modes.map(m=>({name:m.name,value:m.id})));
const dt=(required=true)=>ds('tier','Target tier',required,deskTiers);
const dr=(required=true)=>ds('region','Testing region',required,deskRegions);
const di=()=>ds('id','Application ID; omit inside its private ticket');
const dn=()=>ds('reason','Decision or progress notes, 10–1000 characters',true);
const du=()=>({type:6,name:'opponent',description:'Verified opponent',required:true});
const de=()=>ds('evidence','Shareable HTTPS match evidence',true);
const sub=(name,description,options=[])=>({type:1,name,description,options});
export const testingDeskCommands=[
 {name:'high-test',description:'HT3 through HT1 applications, private tickets and phase tracking',options:[
  sub('apply','Request a private promotion test',[dm(),dr(),dt(),ds('availability','Your UTC availability, 5–100 characters',true)]),
  sub('status','View your applications or an accessible test',[ds('id','Optional application ID')]),
  sub('list','Qualified staff: filter active testing applications',[dm(false),dt(false),dr(false)]),
  sub('claim','Qualified tester: claim an application',[di()]),
  sub('room','Open or recover a private application ticket',[di()]),
  sub('prepare','Connect the approved assessment to this same private ticket',[di()]),
  sub('ready','Player or tester: confirm readiness in this private ticket',[di()]),
  sub('assess','Assigned tester: record the linked rubric assessment',[ds('scores','Six rubric scores, 0–4 separated by commas',true),dn(),di()]),
  sub('review','Independent senior: approve the linked high-tier assessment',[de(),dn(),di()]),
  sub('publish','Assigned tester: publish the reviewed result and finish the test',[de(),dn(),di(),{type:5,name:'exception',description:'Record a staff-adjudicated rubric exception'}]),
  sub('schedule','Assigned tester: set an agreed UTC appointment',[ds('time','ISO UTC time, e.g. 2026-11-15T16:00:00Z',true),dn(),di()]),
  sub('release','Assigned tester: hand a test back without losing its records',[dn(),di()]),
  sub('history','Applicant or staff: view the private decision timeline',[di()]),
  sub('withdraw','Applicant: withdraw an unclaimed application before play',[dn(),di()]),
  sub('opponent','Assigned tester: assign a verified opponent',[di(),du(),{type:4,name:'phase',description:'Testing phase',required:true,min_value:1,max_value:3}]),
  sub('score','Assigned tester: record an assigned opponent set',[di(),du(),{type:4,name:'phase',description:'Testing phase',required:true,min_value:1,max_value:3},{type:4,name:'wins',description:'Applicant rounds won',required:true,min_value:0,max_value:30},{type:4,name:'losses',description:'Applicant rounds lost',required:true,min_value:0,max_value:30},de()]),
  sub('advance','Assigned tester: adjudicate and advance one phase',[di(),dn(),{type:5,name:'exception',description:'Record a staff-adjudicated rubric exception'}]),
  sub('close','Assigned tester: close with reviewed outcome',[di(),ds('decision','Outcome',true,['passed','failed','cancelled']),dn(),ds('result','Required published result ID for a pass')]),
 ]},
 {name:'tester-desk',description:'Apply to test a specific gamemode and tier range',options:[
  sub('apply','Open a private tester recruitment application',[dm(),dr(),dt(),ds('experience','Testing experience, 30–800 characters',true),ds('availability','UTC availability, 5–100 characters',true)]),
  sub('status','View your private tester applications'),
  sub('list','Moderators: list pending tester applications',[dm(false)]),
  sub('room','Open or recover an application ticket',[di()]),
  sub('withdraw','Withdraw your pending tester application',[dn(),di()]),
  sub('review','Moderator: interview, decline or accept for training',[di(),ds('decision','Review outcome',true,['interview','training','declined']),dn()]),
 ]},
 {name:'tier-list',description:'Current placements for one gamemode and tier',options:[dm(),ds('tier','Tier to list',true,['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5']),dr(false)]},
 {name:'tier-path',description:'Read the phases and rules for your target tier',options:[dt()]},
 {name:'tester-roster',description:'Find qualified testers by gamemode',options:[dm()]},
 {name:'test-stats',description:'Real testing totals and completed-test leaderboard',options:[dm(false)]},
 {name:'cooldown',description:'Your failed-test and session retest restrictions',options:[dm(),dr()]},
 {name:'roster',description:'One player list, filterable by gamemode, region and tier',options:[dm(),dr(false),ds('tier','Optional tier filter',false,['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5']),{type:4,name:'page',description:'Roster page',min_value:1,max_value:1000}]},
 {name:'test-hub',description:'Your account, eligibility, current test and next action in one place',options:[dm(),dr()]},
];
for(const c of testingDeskCommands)for(const s of c.options||[])if(s.type===1)s.options?.sort((a,b)=>Number(!!b.required)-Number(!!a.required));
