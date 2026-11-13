import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { CloudStore } from "../cloud/store.mjs";
import { runCommand } from "../cloud/commands.mjs";
import worker, {
  validSignature,
  completeInteraction,
} from "../cloud/worker.mjs";
// Synthetic approved kit for workflow tests only; production Mace kits stay pending.
import { kitManifests } from "../config/kit-manifests.mjs";
kitManifests.modes.push({id:"mace",name:"Test-only Mace"});
import config from "../config/community.json" with { type: "json" };
import { OperationsStore } from "../cloud/operations-store.mjs";
import { ticketOverwrites, assertPrivateTicket } from "../cloud/operations.mjs";
import { componentRoute } from "../cloud/components.mjs";
import {deskPublic} from '../cloud/testing-desk.mjs';
import {checkTierPhase} from '../config/phase-checks.mjs';
import { communityQueueBoard, refreshCommunityBoards } from '../cloud/community-desk.mjs';

test('community desk and queue board show real tester/player activity and enforce 20 slots without exposing waiting players', async () => {
 const {sql,store}=await database();try{
  const call=(actor,name,sub,values={},roles=[])=>runCommand(interaction(actor,name,sub,values,roles),env,store);
  assert.match((await call('60000','desk')).content,/Minecraft PvP Tierlist/);
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  await store.verify('60001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','WaitingPlayer','30000');
  await store.session('mace','EU','open','50001');
  const entry=await store.join('60000','mace','EU');await store.claim(entry,'50001');
  await store.join('60001','mace','EU');
  const board=await communityQueueBoard(store,'mace','EU');
  assert.match(board.embeds[0].description,/2\/20/);assert.match(board.embeds[0].description,/1 waiting/);
  assert.match(JSON.stringify(board),/50001/);assert.match(JSON.stringify(board),/PlayerOne/);
  assert.doesNotMatch(JSON.stringify(board),/WaitingPlayer|60001/);
  assert.equal(board.components[0].components.length,5);
  assert.deepEqual(board.allowed_mentions,{parse:[]});
  assert.equal((await store.one('SELECT capacity FROM sessions')).capacity,20);
  await assert.rejects(store.session('mace','EU','open','50001',21),/20/);
  const other=await communityQueueBoard(store,'mace','NA');assert.match(JSON.stringify(other),/NOT SCHEDULED/);
  await assert.rejects(communityQueueBoard(store,'sword','EU'),/valid/);
 }finally{sql.close();}
});

test('pull checks qualifications, creates a private room and retries the same claim after Discord fails',async()=>{
 const {sql,store}=await database();try{
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  await store.session('mace','EU','open','50001');const id=await store.join('60000','mace','EU');
  const call=()=>runCommand(interaction('50001','pull',null,{mode:'mace',region:'EU'},['50000']),{...env,DISCORD_TICKET_CATEGORY_ID:'80000'},store,request);
  let fail=true,created,posts=0;
  const request=async(url,o)=>{
   if(o.method==='GET')return Response.json(created?[created]:[]);
   if(url.endsWith('/channels')&&o.method==='POST'){posts++;created={...JSON.parse(o.body),id:'81000',guild_id:'20000'};if(fail)throw Error('Simulated room response timeout');return Response.json(created);}
   return Response.json({id:'82000'});
  };
  await assert.rejects(call(),/qualification/);assert.equal((await store.one('SELECT status FROM queue')).status,'waiting');
  await store.statement('INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?)','50001','mace',0,'30000','Approved supervised tester',new Date().toISOString()).run();
  await assert.rejects(call(),/timeout/);assert.equal((await store.one('SELECT id FROM queue WHERE status=\'claimed\'')).id,id);
  fail=false;assert.match((await call()).content,/81000/);assert.equal(posts,1);
  assert.ok(created.permission_overwrites.some(o=>o.id==='60000'&&o.type===1&&(BigInt(o.allow)&1024n)));
 }finally{sql.close();}
});

test('tester statistics use UTC month boundaries and exclude revoked results and do not expose evidence or appeal text',async()=>{
 const {sql,store}=await database();try{
  const stamp=new Date(),old=new Date(Date.UTC(stamp.getUTCFullYear(),stamp.getUTCMonth()-1,15)).toISOString();
  for(const [id,date] of [['old',old],['current',stamp.toISOString()],['revoked',stamp.toISOString()]])await store.statement('INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created) VALUES(?,?,?,?,?,?,?,?,?,?)',id,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','EU','mace',3,0,'50001','https://example.com/private-recording',date).run();
  await store.statement('INSERT INTO revoked VALUES(?,?,?,?)','revoked','30000','Confidential appeal text',stamp.toISOString()).run();
  const month=await runCommand(interaction('60000','tester','leaderboard',{period:'month'}),env,store);
  assert.match(month.content,/1 documented test/);assert.doesNotMatch(JSON.stringify(month),/private-recording|Confidential/);
  const overall=await runCommand(interaction('60000','tester','leaderboard',{period:'overall'}),env,store);assert.match(overall.content,/2 documented tests/);
  await assert.rejects(runCommand(interaction('60000','tester','desk'),env,store),/Only testers/);
 }finally{sql.close();}
});

test('retirement requires independent review of the exact placement, retains peak/history and reactivates on a new result',async()=>{
 const {sql,store}=await database();try{
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  const seed=(id,tier,pos)=>store.statement('INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created) VALUES(?,?,?,?,?,?,?,?,?,?)',id,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','EU','mace',tier,pos,'50001','https://example.com/match',new Date(Date.now()-36*86400000).toISOString()).run();
  const call=(actor,sub,values={},roles=[])=>runCommand(interaction(actor,'retire',sub,values,roles),env,store);
  await seed('initial',2,1);await call('60000','request',{mode:'mace',reason:'Taking a break from competitive play'});
  const {id}=await store.one('SELECT id FROM retirements');
  await assert.rejects(call('60001','review',{id,decision:'approved',reason:'Reviewed the current placement'}),/moderator/);
  await assert.rejects(call('60000','review',{id,decision:'approved',reason:'Reviewed my current placement'},['40000']),/independent/);
  await call('30000','review',{id,decision:'approved',reason:'Confirmed the player retirement request'});
  let p=(await store.rankings(config.points)).players[0];assert.equal(p.rankings.mace.retired,true);assert.equal(p.points,20);assert.equal(p.activePoints,0);assert.equal(p.rankings.mace.peak_tier,2);
  await seed('return-result',2,0);p=(await store.rankings(config.points)).players[0];assert.equal(p.rankings.mace.retired,false);assert.equal(p.points,30);
  await call('60000','request',{mode:'mace',reason:'Request retirement for the new placement'});const pending=await store.one("SELECT id FROM retirements WHERE status='pending'");
  await seed('newer',1,1);await assert.rejects(call('30000','review',{id:pending.id,decision:'approved',reason:'A newer result invalidates this request'}),/changed/);
  await call('60000','cancel',{mode:'mace'});
  const history=await runCommand(interaction('60001','player','history',{name:'PlayerOne'}),env,store);assert.match(history.content,/return-result/);assert.doesNotMatch(history.content,/Taking a break/);
 }finally{sql.close();}
});

test('Mace loadout approval is explicit, versioned and revocable throughout session, room and assessment checks',async()=>{
 const {sql,store}=await database();try{
  const mode='mace_rod',version='rod-2026-v1';
  const loadout='Java 1.21.1; approved diamond armour and mace with listed enchantments, fishing rod in slot 1; full reset after each first-to-10 round in the agreed arena.';
  const benchmarks='Consented benchmark players and calibration recording: https://example.com/calibration';
  const call=(actor,name,sub,values={},roles=[])=>runCommand(interaction(actor,name,sub,values,roles),env,store);
  const values={mode,version,loadout,benchmarks,calibrated:true};
  await assert.rejects(call('60000','loadout','approve',values),/moderator/);
  await assert.rejects(call('30000','loadout','approve',{...values,calibrated:false}),/calibration/);
  await call('30000','loadout','approve',values);await assert.rejects(call('30000','loadout','approve',values),/new version/);
  await store.statement('INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?)','50001',mode,0,'30000','Supervised mode qualification',new Date().toISOString()).run();
  const open={mode,region:'EU',kit:version,benchmarks};
  await assert.rejects(call('50001','session','open',{...open,kit:'missing'},['50000']),/approved/);
  await call('50001','session','open',open,['50000']);
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  const id=await store.join('60000',mode,'EU');await store.claim(id,'50001');
  await store.statement('INSERT INTO test_rooms(id,channel,assignment,tester,state,ready_by,player_ready,tester_ready,kit_version,updated) VALUES(?,?,?,?,?,?,?,?,?,?)',id,'81000','assignment','50001','ready-check',new Date(Date.now()+60000).toISOString(),1,1,version,new Date().toISOString()).run();
  assert.match(await call('50001','assessment','record',{id,scores:'3,3,3,3,3,3',reason:'Complete reviewed recording and calibrated benchmark sets'},['50000']),/saved/);
  await call('30000','loadout','revoke',{mode,version,reason:'Equipment details need a corrected calibrated version'});
  assert.equal((await store.one('SELECT status FROM sessions')).status,'paused');
  await assert.rejects(call('50001','assessment','record',{id,scores:'3,3,3,3,3,3',reason:'Complete reviewed recording and calibrated benchmark sets'},['50000']),/approved session kit/);
 }finally{sql.close();}
});

test('retirement enforces 35 days of inactivity before a request can be accepted',async()=>{
 const {sql,store}=await database();try{
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  await store.statement('INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created) VALUES(?,?,?,?,?,?,?,?,?,?)','recent','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','EU','mace',2,1,'50001','https://example.com/match',new Date().toISOString()).run();
  await assert.rejects(runCommand(interaction('60000','retire','request',{mode:'mace',reason:'Taking a break from competitive play'}),env,store),/35 days/);
 }finally{sql.close();}
});

test('public loadout catalogue exposes approved equipment without staff calibration evidence or reviewer identities',async()=>{
 const {sql,adapter,store}=await database();try{
  for(const [version,revoked] of [['mace-v1',1],['mace-v2',0]])await store.statement('INSERT INTO mode_loadouts VALUES(?,?,?,?,?,?,?)','mace',version,'Approved equipment and reset rules','Private benchmark recording and opponent IDs','30000',new Date().toISOString(),revoked).run();
  const response=await worker.fetch(new Request('https://example.com/api/loadouts'),{DB:adapter},{});assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.loadouts.length,1);assert.equal(body.loadouts[0].version,'mace-v2');assert.equal(body.loadouts[0].loadout,'Approved equipment and reset rules');
  assert.doesNotMatch(JSON.stringify(body),/Private benchmark|30000|approver|benchmarks/);
  for(let n=3;n<12;n++)await store.statement('INSERT INTO mode_loadouts VALUES(?,?,?,?,?,?,?)','mace','mace-v'+n,'Equipment version '+n,'Private calibration','30000',new Date().toISOString(),0).run();
  await store.statement('INSERT INTO mode_loadouts VALUES(?,?,?,?,?,?,?)','mace_rod','rod-v1','Rod equipment','Private calibration','30000',new Date().toISOString(),0).run();
  const bounded=await (await worker.fetch(new Request('https://example.com/api/loadouts'),{DB:adapter},{})).json();
  assert.equal(bounded.loadouts.filter(l=>l.mode==='mace').length,8);assert.equal(bounded.loadouts.filter(l=>l.mode==='mace_rod').length,1);
 }finally{sql.close();}
});

test('queue buttons route through authorised commands and board refresh failures preserve completed queue operations',async()=>{
 const route=id=>componentRoute({type:3,data:{custom_id:id}}).command;
 assert.equal(route('board:join:mace:EU').data.name,'queue');
 assert.equal(route('board:leave:mace:EU').data.options[0].name,'leave');
 assert.equal(route('board:status:mace:EU').data.options[0].name,'status');
 assert.equal(route('board:refresh:mace:EU').data.name,'queue-board');
 assert.throws(()=>route('board:join:sword:EU'),/valid/);
 const {sql,store}=await database();try{
  await store.statement('INSERT INTO queue_boards VALUES(?,?,?,?)','mace','EU','81000','82000').run();
  const result=await refreshCommunityBoards(store,env,async()=>new Response(null,{status:403}),'mace','EU');
  assert.equal(result.failed,1);assert.equal((await store.one('SELECT count(*) n FROM queue_boards')).n,1);
 }finally{sql.close();}
});

test('public board publishing is moderator-only, reuses its message and reconciles a Discord success before database save',async()=>{
 const {sql,store}=await database();try{
  let posts=0,patches=0,saved;
  const request=async(url,o)=>{
   if(url.endsWith('/channels/81000'))return Response.json({id:'81000',type:0,guild_id:'20000'});
   if(o.method==='GET')return Response.json(saved?[saved]:[]);
   if(o.method==='POST'){posts++;const body=JSON.parse(o.body);assert.equal(body.enforce_nonce,true);assert.ok(body.nonce.length<=25);saved={...body,id:'82000',author:{id:'10000'}};return Response.json(saved);}
   patches++;return Response.json(saved);
  };
  const call=actor=>runCommand({...interaction(actor,'queue-board',null,{mode:'mace',region:'EU',publish:true}),channel_id:'81000'},env,store,request);
  await assert.rejects(call('60000'),/Only moderators/);assert.equal(posts,0);
  await call('30000');await call('30000');assert.equal(posts,1);assert.equal(patches,1);
  await store.statement('DELETE FROM queue_boards').run();await call('30000');assert.equal(posts,1);assert.equal(patches,2);
  const different={...interaction('30000','queue-board',null,{mode:'mace',region:'EU',publish:true}),channel_id:'83000'};
  await assert.rejects(runCommand(different,env,store,async()=>Response.json({id:'83000',type:0,guild_id:'20000'})),/already published/);
 }finally{sql.close();}
});

test('legacy session settings cannot exceed the new 20-slot limit under simultaneous join requests',async()=>{
 const {sql,store}=await database();try{
  await store.session('mace','EU','open','50001');await store.statement('UPDATE sessions SET capacity=30').run();
  for(let n=0;n<21;n++)await store.verify(String(60000+n),n.toString(16).padStart(8,'0')+'-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Player'+n,'30000');
  const outcomes=await Promise.allSettled(Array.from({length:21},(_,n)=>store.join(String(60000+n),'mace','EU')));
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,20);assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);
  assert.equal((await store.testing()).sessions[0].capacity,20);
  assert.equal((await store.status('60000','mace','EU')).session.capacity,20);
 }finally{sql.close();}
});

test('a real deferred queue interaction refreshes its public board once and room forms cannot elevate the player',async()=>{
 const {sql,store}=await database();try{
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  await store.session('mace','EU','open','50001');
  await store.statement('INSERT INTO queue_boards VALUES(?,?,?,?)','mace','EU','81000','82000').run();
  const calls=[],request=async(url,o)=>{calls.push({url,body:JSON.parse(o.body)});return Response.json({id:'82000'});};
  const join=interaction('60000','queue','join',{mode:'mace',region:'EU'});
  await completeInteraction(join,env,store,request);await completeInteraction(join,env,store,request);
  const updates=calls.filter(c=>c.url.endsWith('/channels/81000/messages/82000'));
  assert.equal(updates.length,1);assert.match(updates[0].body.embeds[0].description,/1\/20/);
  assert.equal((await store.one('SELECT count(*) n FROM queue')).n,1);
  const id=(await store.one('SELECT id FROM queue')).id;
  const form=componentRoute({...interaction('60000','unused'),type:5,data:{custom_id:'room:submit:result:'+id,components:[{components:[{custom_id:'tier',value:'HT1'},{custom_id:'evidence',value:'https://example.com/match'}]}]}}).command;
  await assert.rejects(runCommand(form,env,store,request),/Only testers/);
  const region=componentRoute({type:3,data:{custom_id:'board:region:mace',values:['NA']}}).command;
  assert.equal(region.data.options.find(o=>o.name==='region').value,'NA');
  const picker=componentRoute({type:3,data:{custom_id:'community:board-region:mace',values:['EU']}}).command;
  assert.equal(picker.data.options.find(o=>o.name==='mode').value,'mace');
 }finally{sql.close();}
});

test('connected promotion prepares, readies, scores, independently reviews and publishes within one existing ticket',async()=>{
 const {sql,store}=await database();try{
  const names=['Applicant','OpponentOne','OpponentTwo','TargetOne','TargetTwo'];
  for(let n=0;n<5;n++){const user=String(60000+n),uuid=String(n+1).repeat(8)+'-aaaa-aaaa-aaaa-aaaaaaaaaaaa';await store.verify(user,uuid,names[n],'30000');await store.statement('INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created) VALUES(?,?,?,?,?,?,?,?,?,?)','seed-'+n,uuid,names[n],'EU','mace',n<3?3:2,n<3?0:1,'50001','https://example.com/seed',new Date(Date.now()-10000).toISOString()).run();}
  for(const actor of ['50001','50002','50003'])await store.statement('INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?)',actor,'mace',1,'30000','Supervised senior approval',new Date().toISOString()).run();
  await store.session('mace','EU','open','30000');await store.statement('UPDATE sessions SET kit_version=?',kitManifests.version).run();
  await store.statement("INSERT INTO high_tests(id,user,mode,region,target,availability,status,tester,channel,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)",'connected','60000','mace','EU','LT2','Saturday 16 UTC','claimed','50001','81000',new Date().toISOString(),new Date().toISOString()).run();
  const calls=[],request=async(url,o)=>{calls.push({url,method:o.method});return o.method==='DELETE'?new Response(null,{status:204}):Response.json({id:'82000'});};
  const testingEnv={...env,DISCORD_SENIOR_TESTER_ROLE_IDS:'51000',DISCORD_RESULTS_CHANNEL_ID:'80000'};
  const call=(actor,action,values={},roles=['50000'])=>runCommand({...interaction(actor,'high-test',action,values,roles),channel_id:'81000'},testingEnv,store,request);
  await call('50001','prepare');assert.equal((await store.one('SELECT queue_id FROM high_tests')).queue_id,'connected');assert.equal((await store.one('SELECT channel FROM test_rooms')).channel,'81000');
  await call('50001','release',{reason:'Availability changed; reassign without losing the test'});
  assert.equal((await store.one('SELECT status FROM high_tests')).status,'pending');
  await call('50003','claim');await call('50003','prepare');assert.equal((await store.one('SELECT tester FROM test_rooms')).tester,'50003');
  await call('50003','release',{reason:'Hand back to the originally scheduled tester'});await call('50001','claim');await call('50001','prepare');
  await assert.rejects(call('50001','assess',{scores:'3,3,3,3,3,3',reason:'Reviewed complete opponent recordings'}),/Both participants/);
  await call('60000','ready',{},[]);await call('50001','ready');
  for(const [phase,user,wins,losses] of [[1,'60001',4,2],[1,'60002',4,3],[2,'60003',4,3],[2,'60004',3,4]]){
   if(phase===2&&(await store.one('SELECT phase FROM high_tests')).phase===1)await call('50001','advance',{reason:'Both same-tier opponents beaten with 8–5 overall'});
   await call('50001','opponent',{phase,opponent:user});await call('50001','score',{phase,opponent:user,wins,losses,evidence:'https://example.com/set-'+user});
  }
  await call('50001','assess',{scores:'3,3,3,3,3,3',reason:'Complete reviewed phase evidence and calibrated sets'});
  await assert.rejects(runCommand(interaction('50001','result',null,{id:'connected',tier:'LT2',evidence:'https://example.com/final'},['50000']),testingEnv,store,request),/high-test publish/);
  await assert.rejects(call('50001','publish',{evidence:'https://example.com/final',reason:'Final sets and full assessment checked'}),/independent|assessment review/);
  await assert.rejects(call('50001','review',{evidence:'https://example.com/final',reason:'Review the final match recordings'},['50000','51000']),/different qualified senior/);
  await call('50002','review',{evidence:'https://example.com/final',reason:'Independent exact evidence and rubric review'},['50000','51000']);
  assert.match(await call('50001','publish',{evidence:'https://example.com/final',reason:'All required sets and senior review completed'}),/Test passed/);
  assert.equal((await store.one("SELECT status FROM high_tests WHERE id='connected'")).status,'passed');assert.equal((await store.one("SELECT status FROM queue WHERE id='connected'")).status,'complete');
  assert.equal(calls.filter(c=>c.url.endsWith('/channels')&&c.method==='POST').length,0);
 }finally{sql.close();}
});

test('phase guidance detects missing opponents, failed margins, final minimum rounds and tier replacements',()=>{
 const set=(wins,losses,opponent_tier)=>({wins,losses,opponent_tier});
 assert.equal(checkTierPhase('HT3',1,[set(3,2,'HT3')]).passed,false);
 assert.equal(checkTierPhase('HT3',2,[set(4,3,'HT3')]).passed,true);
 assert.equal(checkTierPhase('LT2',1,[set(4,2,'HT3')]).passed,false);
 assert.equal(checkTierPhase('LT2',1,[set(4,2,'HT3'),set(4,3,'HT3')]).passed,true);
 assert.equal(checkTierPhase('LT2',2,[set(5,0,'LT2'),set(2,0,'LT2')]).passed,false);
 assert.equal(checkTierPhase('LT2',2,[set(4,3,'LT2'),set(3,4,'LT2')]).passed,true);
 assert.equal(checkTierPhase('HT2',2,[set(4,0,'LT2'),set(4,0,'HT2')]).replacements,1);
});

test('pending applications may be withdrawn by their owner, while active claims cannot bypass forfeit adjudication',async()=>{
 const {sql,store}=await database();try{
  const stamp=new Date().toISOString();await store.statement('INSERT INTO high_tests(id,user,mode,region,target,availability,created,updated) VALUES(?,?,?,?,?,?,?,?)','withdraw-test','60000','mace','EU','HT3','Saturday 16 UTC',stamp,stamp).run();
  await assert.rejects(runCommand(interaction('60001','high-test','withdraw',{id:'withdraw-test',reason:'Changed my planned testing availability'}),env,store),/Only the applicant/);
  await store.statement("UPDATE high_tests SET status='claimed',tester='50001' WHERE id='withdraw-test'").run();
  await assert.rejects(runCommand(interaction('60000','high-test','withdraw',{id:'withdraw-test',reason:'Changed my planned testing availability'}),env,store),/forfeit/);
  await store.statement("UPDATE high_tests SET status='pending',tester=NULL WHERE id='withdraw-test'").run();
  assert.match(await runCommand(interaction('60000','high-test','withdraw',{id:'withdraw-test',reason:'Changed my planned testing availability'}),env,store),/withdrawn/);assert.equal((await store.one('SELECT count(*) n FROM test_restrictions')).n,0);
 }finally{sql.close();}
});

test('one roster paginates real players and test-hub chooses the verified next action without leaking other applications',async()=>{
 const {sql,store}=await database();try{
  const unverified=await runCommand(interaction('60000','test-hub',null,{mode:'mace',region:'EU'}),env,store);assert.match(unverified.content,/Not verified/);assert.equal(unverified.components[0].components[0].custom_id,'hub:ticket');
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  const roster=await runCommand(interaction('60000','roster',null,{mode:'mace'}),env,store);assert.match(roster.content,/No published players/);assert.match(roster.components[0].components[0].url,/#rankings/);
  const region=componentRoute({type:3,data:{custom_id:'desk:hub-region:mace',values:['EU']}}).command;assert.equal(region.data.options.find(o=>o.name==='mode').value,'mace');
 }finally{sql.close();}
});

test('high-tier applications persist privately, enforce next tier, prevent duplicates and recover timed-out rooms',async()=>{
 const {sql,store}=await database();try{
  const apply=interaction('60000','high-test','apply',{mode:'mace',region:'EU',tier:'HT3',availability:'Saturday 16–18 UTC'});
  await assert.rejects(runCommand(apply,env,store),/ownership/);
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  await assert.rejects(runCommand(apply,env,store),/initial evaluation/);
  await store.statement('INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created) VALUES(?,?,?,?,?,?,?,?,?,?)','initial','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','EU','mace',3,1,'50001','https://example.com/initial',new Date(Date.now()-1000).toISOString()).run();
  let created,fail=true,posts=0;
  const request=async(url,o)=>{
   if(o.method==='GET')return Response.json(created?[created]:[]);
   if(url.endsWith('/channels')){posts++;created={...JSON.parse(o.body),id:'81000',guild_id:'20000'};if(fail)throw Error('Simulated response timeout');return Response.json(created);}
   return Response.json({id:'82000'});
  };
  const privateEnv={...env,DISCORD_TICKET_CATEGORY_ID:'80000'};
  await assert.rejects(runCommand(apply,privateEnv,store,request),/timeout/);
  const row=await store.one('SELECT * FROM high_tests');assert.equal(row.target,'HT3');assert.equal(row.room_lock,null);
  await assert.rejects(runCommand(apply,privateEnv,store,request),/active application/);
  await assert.rejects(runCommand(interaction('60001','high-test','status',{id:row.id}),privateEnv,store,request),/Only the applicant/);
  fail=false;assert.match(await runCommand(interaction('60000','high-test','room',{id:row.id}),privateEnv,store,request),/81000/);assert.equal(posts,1);
  const everyone=created.permission_overwrites.find(o=>o.id==='20000');assert.equal(everyone.deny,'1024');
  const publicData=JSON.stringify(await deskPublic(store));assert.ok(!publicData.includes('60000'));assert.ok(!publicData.includes('Saturday'));assert.ok(!publicData.includes(row.id));
 }finally{sql.close();}
});

test('only qualified independent assignees track phases, and failed tests block both high applications and normal queues',async()=>{
 const {sql,store}=await database();try{
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  await store.statement("INSERT INTO high_tests(id,user,mode,region,target,availability,created,updated) VALUES(?,?,?,?,?,?,?,?)",'high-one','60000','mace','EU','HT3','Saturday 16 UTC',new Date().toISOString(),new Date().toISOString()).run();
  const claim=interaction('50001','high-test','claim',{id:'high-one'},['50000']);
  await assert.rejects(runCommand(claim,env,store),/qualification/);
  await store.statement('INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?)','50001','mace',0,'30000','Approved training',new Date().toISOString()).run();
  assert.match(await runCommand(claim,env,store),/claimed/);
  await assert.rejects(runCommand(interaction('50001','high-test','advance',{id:'high-one',reason:'Reviewed the score evidence'},['50000']),env,store),/every assigned/);
  await assert.rejects(runCommand(interaction('50001','high-test','close',{id:'high-one',decision:'passed',reason:'Approved reviewed outcome'},['50000']),env,store),/all phases/);
  await runCommand(interaction('50001','high-test','close',{id:'high-one',decision:'failed',reason:'Lost the required opponent sets'},['50000']),env,store);
  await store.session('mace','EU','open','30000',20,0);
  await assert.rejects(store.join('60000','mace','EU'),/cooldown/);
  assert.match(await runCommand(interaction('60000','cooldown',null,{mode:'mace',region:'EU'}),env,store),/Failed-test restriction ends/);
  await assert.rejects(runCommand(interaction('60000','high-test','apply',{mode:'mace',region:'EU',tier:'HT3',availability:'Saturday 16 UTC'}),env,store),/cooldown/);
 }finally{sql.close();}
});

test('tester recruitment records gamemode and target scope, stays private and requires independent review without granting qualifications',async()=>{
 const {sql,store}=await database();try{
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  const apply=interaction('60000','tester-desk','apply',{mode:'mace_spear',region:'EU',tier:'HT3',availability:'Saturday 16 UTC',experience:'I can independently record scores and explain fair match decisions.'});
  await assert.rejects(runCommand(apply,env,store),/not configured/);
  const r=await store.one('SELECT * FROM high_tests');assert.equal(r.kind,'tester');assert.equal(r.mode,'mace_spear');assert.equal(r.target,'HT3');
  await assert.rejects(runCommand(interaction('60001','tester-desk','list'),env,store),/authorized/);
  await runCommand(interaction('30000','tester-desk','review',{id:r.id,decision:'training',reason:'Proceed with supervised testing training'}),env,store);
  assert.equal((await store.one('SELECT count(*) n FROM tester_qualifications')).n,0);
  assert.match(await runCommand(interaction('60000','tester-desk','status'),env,store),/training/);
 }finally{sql.close();}
});

test('testing application menus preserve kind, gamemode, target and region through modal submission',()=>{
 const route=(id,value)=>componentRoute({type:3,data:{custom_id:id,values:value?[value]:[]}});
 const first=route('desk:fixed:tester:mace_spear').response.data.components[0].components[0];assert.equal(first.custom_id,'desk:tier:tester:mace_spear');
 const second=route(first.custom_id,'HT3').response.data.components[0].components[0];assert.equal(second.custom_id,'desk:region:tester:mace_spear:HT3');
 const modal=route(second.custom_id,'EU').response;assert.equal(modal.data.custom_id,'desk:apply:tester:mace_spear:HT3:EU');
 const submitted=componentRoute({type:5,data:{custom_id:modal.data.custom_id,components:[{components:[{custom_id:'availability',value:'Saturday 16 UTC'},{custom_id:'experience',value:'Independent scoring and testing experience'}]}]}}).command;
 assert.equal(submitted.data.name,'tester-desk');assert.equal(submitted.data.options[0].options.find(o=>o.name==='mode').value,'mace_spear');
 const cooldown=route('desk:cooldown-region:mace','EU').command;assert.equal(cooldown.data.options.find(o=>o.name==='mode').value,'mace');
});

test('waitlists are private preferences and never create or reserve queue places',async()=>{
  const {sql,store}=await database();try{
    const join=interaction('60000','waitlist','join',{mode:'mace',region:'EU',kit:'pilot-1-candidate',benchmarks:'Consented calibration evidence and benchmark opponents'});
    await assert.rejects(runCommand(join,env,store),/ownership/);
    await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
    await Promise.all([runCommand(join,env,store),runCommand(join,env,store)]);
    assert.equal((await store.one('SELECT count(*) n FROM waitlists')).n,1);
    assert.equal((await store.list()).length,0);
    assert.match(await runCommand(interaction('60001','waitlist','status'),env,store),/No waitlist/);
    assert.ok(!JSON.stringify(await store.testing()).includes('60000'));
  }finally{sql.close();}
});

test('mode qualification and one active tester claim are mandatory even for moderators',async()=>{
  const {sql,store}=await database();try{
    const open=interaction('30000','session','open',{mode:'mace',region:'EU',kit:'pilot-1-candidate',benchmarks:'Consented calibration evidence and benchmark opponents'});
    await assert.rejects(runCommand(open,env,store),/qualification/);
    await assert.rejects(runCommand(interaction('30000','qualification','grant',{user:'30000',mode:'mace',reason:'Self approval is not permitted'}),env,store),/different/);
    await runCommand(interaction('30000','qualification','grant',{user:'50001',mode:'mace',reason:'Supervised calibration completed'}),env,store);
    await assert.rejects(runCommand(interaction('50001','session','open',{mode:'mace_spear',region:'EU'},['50000']),env,store),/qualification/);
    await runCommand(interaction('50001','session','open',{mode:'mace',region:'EU',kit:'pilot-1-candidate',benchmarks:'Consented calibration evidence and benchmark opponents'},['50000']),env,store);
    for(const [user,uuid] of [['60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],['60001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']])await store.verify(user,uuid,'Player'+user,'30000');
    const a=await store.join('60000','mace','EU'),b=await store.join('60001','mace','EU');
    const outcomes=await Promise.allSettled([store.claim(a,'50001'),store.claim(b,'50001')]);
    assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  }finally{sql.close();}
});

test('result announcements include earned rank and ping only the optional result role',async()=>{
  const {sql,store}=await database();try{
    await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
    await store.session('mace','EU','open','30000');const id=await store.join('60000','mace','EU');await store.claim(id,'50001');
    await store.statement('INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?)','50001','mace',0,'30000','Supervised calibration',new Date().toISOString()).run();
    await store.statement("INSERT INTO test_rooms VALUES(?,?,?,?,?,?,?,?,?,?)",id,'81000','assignment','50001','ready-check',new Date(Date.now()+60000).toISOString(),1,1,'pilot-1-candidate',new Date().toISOString()).run();
    await new OperationsStore(store).assess(id,'50001','3,3,3,3,3,3','Benchmark comparison and feedback');
    const calls=[];const request=async(url,o)=>{calls.push(JSON.parse(o.body));return Response.json({id:'82000'});};
    await runCommand(interaction('50001','result',null,{id,tier:'HT3',evidence:'https://example.com/match'},['50000']),{...env,DISCORD_RESULTS_CHANNEL_ID:'80000',DISCORD_RESULT_PING_ROLE_ID:'70000'},store,request);
    assert.deepEqual(calls[0].allowed_mentions,{parse:[],roles:['70000']});
    assert.equal(calls[0].embeds[0].fields.find(f=>f.name==='Rank Earned').value,'HT3');
    assert.equal(calls[0].embeds[0].fields.find(f=>f.name==='Previous Rank').value,'Unranked');
  }finally{sql.close();}
});

test('evidence substitution cannot reuse high-tier sign-off',async()=>{
  const {sql,store}=await database();try{
    await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
    await store.session('mace','EU','open','30000');const id=await store.join('60000','mace','EU');await store.claim(id,'50001');
    const op=new OperationsStore(store);await op.assess(id,'50001','3,3,3,3,3,3','Benchmark comparison and feedback');
    await op.reviewPlacement(id,'50002','HT2','Independent review of exact evidence','https://example.com/original');
    await assert.rejects(store.result(id,2,0,'https://example.com/substituted','50001',true),/assessment/);
    await store.result(id,2,0,'https://example.com/original','50001',true);
    const appeal=await store.appeal(id,'60000','Please independently review the placement evidence');
    await assert.rejects(store.review(appeal,'50002','uphold','Original sign-off reviewer cannot decide this appeal'),/independent/);
  }finally{sql.close();}
});

test('claim-next follows deterministic order, excludes self and rejects simultaneous second assignments',async()=>{
  const {sql,store}=await database();try{
    await store.session('mace','EU','open','30000');
    for(const [user,uuid]of[['60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],['60001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']])await store.verify(user,uuid,'Player'+user,'30000');
    const first=await store.join('60000','mace','EU'),second=await store.join('60001','mace','EU');
    await store.statement('UPDATE queue SET created=? WHERE id=?','2026-01-01T00:00:00Z',first).run();
    assert.equal(await store.claimNext('mace','EU','60000'),second);
    await assert.rejects(store.claimNext('mace','EU','60000'),/already hold/);
    assert.equal(await store.claimNext('mace','EU','50001'),first);
  }finally{sql.close();}
});

test('the same player cannot receive simultaneous assignments in different modes, and paused sessions do not assign',async()=>{
 const{sql,store}=await database();try{
  await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
  await store.session('mace','EU','open','30000');await store.session('axe','EU','open','30000');
  const mace=await store.join('60000','mace','EU'),axe=await store.join('60000','axe','EU');
  const outcomes=await Promise.allSettled([store.claim(mace,'50001'),store.claim(axe,'50002')]);
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  const current=await store.one("SELECT id,tester FROM queue WHERE status='claimed'");await store.release(current.id,current.tester);
  await store.session('axe','EU','paused','30000');await assert.rejects(store.claim(axe,'50002'),/already claimed/);
 }finally{sql.close();}
});

test('a repeated interaction recovers a failed private reply without repeating the operation',async()=>{
  const{sql,store}=await database();try{
    const command=interaction('60000','practice','create',{mode:'mace',region:'EU',note:'Saturday 16 UTC, spacing practice'});
    let calls=0;
    const request=async()=>{calls++;if(calls===1)throw Error('Simulated reply timeout');return Response.json({});};
    await assert.rejects(completeInteraction(command,env,store,request),/timeout/);
    assert.equal((await store.one('SELECT count(*) n FROM practice_posts')).n,1);
    await completeInteraction(command,env,store,request);
    await completeInteraction(command,env,store,request);
    assert.equal(calls,2);
    assert.equal((await store.one('SELECT count(*) n FROM practice_posts')).n,1);
    assert.equal((await store.one('SELECT delivered FROM interaction_receipts')).delivered,1);
  }finally{sql.close();}
});

test('verified identity retains timestamps, accepts username changes and refuses silent UUID replacement',async()=>{
  const {sql,store}=await database();try{
    const uuid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';await store.verify('60000',uuid,'OldName','30000');
    await store.verify('60000',uuid,'NewName','40000');
    const a=await store.one('SELECT * FROM accounts WHERE discord=?','60000');assert.equal(a.name,'NewName');assert.equal(a.verified_by,'40000');assert.ok(Date.parse(a.verified_at));
    await assert.rejects(store.verify('60000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','OtherName','30000'),/recovery/);
    assert.equal((await store.one('SELECT uuid FROM accounts WHERE discord=?','60000')).uuid,uuid);
  }finally{sql.close();}
});

test('ticket draft review is owner-scoped and internal notes never reach the player or public feeds',async()=>{
  const {sql,store}=await database();try{
    const configured={...env,DISCORD_SUPPORT_ROLE_IDS:'70000'};
    const draft=await runCommand(interaction('60000','ticket','prepare',{kind:'technical',subject:'Website issue',detail:'The ranking filter does not load on my phone.'}),configured,store);
    const id=draft.components[0].components[0].custom_id.slice(14);
    await assert.rejects(runCommand(interaction('60001','ticket','submit',{id}),configured,store),/belongs/);
    const op=new OperationsStore(store);const ticket=await op.reserveTicket('60000','technical','Website issue','The filter failed to refresh.');await op.ticketOpened(ticket,'81000');
    await runCommand(interaction('70001','ticket','note',{id:ticket,reason:'Internal triage detail restricted to staff'},['70000']),configured,store);
    await assert.rejects(runCommand(interaction('60000','ticket','notes',{id:ticket}),configured,store),/independent/);
    const report=await op.reserveTicket('60002','staff-report','Staff concern','Please independently review this case.');await op.ticketOpened(report,'81001');
    await assert.rejects(runCommand(interaction('40001','ticket','status',{id:report},['40000']),configured,store),/access/);
    assert.ok(!JSON.stringify([await store.rankings(config.points),await store.testing()]).includes('Internal triage'));
  }finally{sql.close();}
});

test('room provisioning reconciles an API timeout without creating a duplicate, and readiness expires fairly',async()=>{
  const {sql,store}=await database();try{
    const configured={...env,DISCORD_TICKET_CATEGORY_ID:'80000'};
    await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
    await store.statement('INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?)','50001','mace',0,'30000','Supervised calibration',new Date().toISOString()).run();
    await store.session('mace','EU','open','50001',20,72,'pilot-1-candidate','Consented benchmark calibration');const id=await store.join('60000','mace','EU');await store.claim(id,'50001');
    const channels=[];let creates=0;
    const request=async(url,opts)=>{
      if(opts.method==='GET')return Response.json(channels);
      const body=JSON.parse(opts.body);
      if(url.endsWith('/guilds/20000/channels')){creates++;channels.push({id:'81000',...body});throw Error('Simulated network timeout after remote creation');}
      return Response.json({id:'81000',...body});
    };
    const open=interaction('50001','test-room','open',{id},['50000']);
    await assert.rejects(runCommand(open,configured,store,request),/timeout/);
    assert.match(await runCommand(open,configured,store,request),/81000/);assert.equal(creates,1);
    await runCommand(interaction('60000','test-room','ready',{id}),configured,store);
    const assessment=interaction('50001','assessment','record',{id,scores:'3,3,3,3,3,3',reason:'Strength: spacing. Practise hit selection and recovery.'},['50000']);
    await assert.rejects(runCommand(assessment,configured,store),/Both participants/);
    await runCommand(interaction('50001','test-room','ready',{id},['50000']),configured,store);
    await runCommand(assessment,configured,store);
    assert.equal((await store.one('SELECT kit_version FROM assessments WHERE id=?',id)).kit_version,'pilot-1-candidate');
    await assert.rejects(runCommand(interaction('60001','test-room','status',{id}),configured,store),/Only the player/);
    await assert.rejects(runCommand(interaction('50001','claim',null,{id,action:'release'},['50000']),configured,store),/Archive/);
    await store.statement('UPDATE test_rooms SET ready_by=? WHERE id=?','2020-01-01T00:00:00Z',id).run();
    await assert.rejects(runCommand(interaction('60000','test-room','ready',{id}),configured,store),/without a penalty/);
    await runCommand(interaction('50001','test-room','archive',{id},['50000']),configured,store,request);
    await runCommand(interaction('50001','claim',null,{id,action:'release'},['50000']),configured,store);
    assert.equal((await store.one('SELECT status FROM queue WHERE id=?',id)).status,'waiting');
  }finally{sql.close();}
});

test("ticket forms route privately, enforce limits, isolate staff reports and ping only configured staff", async () => {
  const {sql,store}=await database();
  const configured={...env,DISCORD_SUPPORT_ROLE_IDS:"70000",DISCORD_SUPPORT_PING_ROLE_ID:"70002",DISCORD_MODERATOR_ROLE_IDS:"40000",DISCORD_TICKET_CATEGORY_ID:"80000"};
  const calls=[];
  const request=async(url,options)=>{
    const body=options.body?JSON.parse(options.body):null;calls.push({url,body});
    if(url.endsWith("/channels"))return Response.json({id:"81000",guild_id:env.DISCORD_GUILD_ID,...body});
    return Response.json({id:"82000"});
  };
  try {
    const route=componentRoute({...interaction("60000","unused"),type:3,data:{custom_id:"ticket:kind",values:["support"]}});
    assert.equal(route.response.type,9);
    assert.equal(route.response.data.components.length,2);
    const response=await runCommand(interaction("60000","ticket","open",{kind:"support",subject:"Help with a test",detail:"Please help me understand the queue."}),configured,store,request);
    assert.match(response,/81000/);
    assert.deepEqual(calls[1].body.allowed_mentions,{parse:[],roles:["70002"],users:[]});
    assert.deepEqual(calls[2].body.allowed_mentions,{parse:[]});
    await assert.rejects(runCommand(interaction("60000","ticket","open",{kind:"support",subject:"Duplicate ticket",detail:"This is a duplicate request."}),configured,store,request),/active ticket/);
    const perms=ticketOverwrites(configured,"60000","staff-report");
    assert.equal(perms.some(p=>p.id==="70000"),false);
    const channel={guild_id:env.DISCORD_GUILD_ID,permission_overwrites:perms};
    assert.doesNotThrow(()=>assertPrivateTicket(channel,configured,"60000","staff-report"));
    channel.permission_overwrites.push({id:"99999",type:0,allow:"1024",deny:"0"});
    assert.throws(()=>assertPrivateTicket(channel,configured,"60000","staff-report"),/unexpected/);
    const op=new OperationsStore(store);const own=await op.tickets("60000",false);
    await op.claimTicket(own[0].id,"70001");
    await assert.rejects(op.claimTicket(own[0].id,"70002"),/already claimed/);
    await assert.rejects(runCommand(interaction("60001","ticket","status",{id:own[0].id}),configured,store,request),/access/);
  } finally {sql.close();}
});

test("high-tier sign-off is independent and invalidated when assessment scores change",async()=>{
  const {sql,store}=await database();const op=new OperationsStore(store);
  try {
    await store.verify("60000","aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","PlayerOne","30000");
    await store.session("mace","EU","open","30000",10,72);
    const id=await store.join("60000","mace","EU");await store.claim(id,"50001");
    await assert.rejects(store.result(id,2,0,"https://example.com/evidence","50001",true),/assessment/);
    await op.assess(id,"50001","3,3,3,3,3,3","Consistent benchmark performance.");
    await assert.rejects(op.reviewPlacement(id,"50001","HT2","I reviewed my own assessment.","https://example.com/evidence"),/independent/);
    await assert.rejects(op.reviewPlacement(id,"60000","HT2","I reviewed my own placement.","https://example.com/evidence"),/independent/);
    await op.reviewPlacement(id,"50002","HT2","Independent benchmark review.","https://example.com/evidence");
    await op.assess(id,"50001","4,3,3,3,3,3","Corrected first score after review.");
    await assert.rejects(store.result(id,2,0,"https://example.com/evidence","50001",true),/assessment/);
    await op.reviewPlacement(id,"50002","HT2","Independent corrected assessment review.","https://example.com/evidence");
    await store.result(id,2,0,"https://example.com/evidence","50001",true);
    assert.equal((await store.one("SELECT count(*) n FROM assessment_history")).n,2);
  } finally {sql.close();}
});

// Exercise the real migration and SQL against SQLite, preserving D1's batch
// transaction and prepared-statement result contracts.
async function database() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    await readFile(
      new URL("../drizzle/0000_discord_cloud.sql", import.meta.url),
      "utf8",
    ),
  );
  sql.exec(
    await readFile(
      new URL("../drizzle/0001_player_workflows.sql", import.meta.url),
      "utf8",
    ),
  );
  sql.exec(await readFile(new URL("../drizzle/0002_community_operations.sql",import.meta.url),"utf8"));
  sql.exec(await readFile(new URL('../drizzle/0003_journey_safety.sql',import.meta.url),'utf8'));
  sql.exec(await readFile(new URL('../drizzle/0004_interaction_delivery.sql',import.meta.url),'utf8'));
  sql.exec(await readFile(new URL('../drizzle/0005_testing_desk.sql',import.meta.url),'utf8'));
  sql.exec(await readFile(new URL('../drizzle/0006_connected_tests.sql',import.meta.url),'utf8'));
  sql.exec(await readFile(new URL('../drizzle/0007_community_desk.sql',import.meta.url),'utf8'));
  sql.exec(await readFile(new URL('../drizzle/0008_staff_loadouts.sql',import.meta.url),'utf8'));
  const adapter = {
    prepare(query) {
      const make = (values = []) => ({
        bind: (...args) => make(args),
        first: async () => sql.prepare(query).get(...values) || null,
        all: async () => ({ results: sql.prepare(query).all(...values) }),
        run: async () => ({ meta: sql.prepare(query).run(...values) }),
      });
      return make();
    },
    async batch(statements) {
      sql.exec("BEGIN IMMEDIATE");
      try {
        const values = [];
        for (const statement of statements) values.push(await statement.run());
        sql.exec("COMMIT");
        return values;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { sql, adapter, store: new CloudStore(adapter) };
}
const env = {
  DISCORD_CLIENT_ID: "10000",
  DISCORD_GUILD_ID: "20000",
  DISCORD_OWNER_ID: "30000",
  MODERATOR_ROLE_ID: "40000",
  TESTER_ROLE_ID: "50000",
  DISCORD_TOKEN: "test-only",
};
function interaction(actor, command, sub, values = {}, roles = []) {
  const options = Object.entries(values).map(([name, value]) => ({
    name,
    value,
  }));
  return {
    id: "90000",
    token: "test-response-only",
    type: 2,
    application_id: env.DISCORD_CLIENT_ID,
    guild_id: env.DISCORD_GUILD_ID,
    member: { user: { id: actor }, roles, permissions: "0" },
    data: {
      name: command,
      options: sub ? [{ name: sub, type: 1, options }] : options,
    },
  };
}

test("cloud SQL enforces ownership, capacity, atomic claims/results, cooldown, independent appeals and public privacy", async () => {
  const { sql, store, adapter } = await database();
  try {
    await assert.rejects(store.join("60000", "mace", "EU"), /ownership/);
    await store.verify(
      "60000",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "PlayerOne",
      "30000",
    );
    await store.verify(
      "60001",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "PlayerTwo",
      "30000",
    );
    await store.session("mace", "EU", "open", "30000", 1, 72);
    const entry = await store.join("60000", "mace", "EU");
    await assert.rejects(store.join("60001", "mace", "EU"), /unavailable/);
    await assert.rejects(store.claim(entry, "60000"), /belongs/);
    await store.claim(entry, "70000");
    await assert.rejects(store.claim(entry, "70001"), /already/);
    await assert.rejects(
      store.result(entry, 2, 0, "https://example.com/evidence", "70001"),
      /assigned/,
    );
    await store.result(entry, 2, 0, "https://example.com/evidence", "70000");
    await assert.rejects(
      store.result(entry, 1, 0, "https://example.com/evidence", "70000"),
      /assigned/,
    );
    await assert.rejects(store.join("60000", "mace", "EU"), /unavailable/);
    const reopened = new CloudStore(adapter);
    assert.equal(
      (await reopened.rankings(config.points)).players[0].rankings.mace.tier,
      2,
    );
    const appeal = await store.appeal(
      entry,
      "60000",
      "The evidence needs another review.",
    );
    await assert.rejects(
      store.appeal(entry, "60001", "Not my own result but trying it."),
      /own/,
    );
    await assert.rejects(
      store.review(
        appeal,
        "70000",
        "revoke",
        "I was the original tester here.",
      ),
      /independent/,
    );
    await assert.rejects(
      store.review(
        appeal,
        "60000",
        "revoke",
        "I was the original player here.",
      ),
      /independent/,
    );
    const publicFeed = JSON.stringify(await store.rankings(config.points));
    for (const privateValue of ["60000", "70000", "another review"])
      assert.ok(!publicFeed.includes(privateValue));
    assert.equal((await store.appeals("60001")).length, 0);
    await store.review(
      appeal,
      "80000",
      "revoke",
      "Evidence confirms the result was invalid.",
    );
    assert.equal((await store.rankings(config.points)).players.length, 0);
    assert.equal(
      sql.prepare("SELECT count(*) AS n FROM results").get().n,
      1,
      "revocation retains original audit data",
    );
    assert.equal(await store.beginInteraction("123456"), true);
    assert.equal(await store.beginInteraction("123456"), false);
  } finally {
    sql.close();
  }
});

test("practice posts enforce expiry, concurrent limits and owner/moderator closure without public identity exports", async () => {
  const { sql, store } = await database();
  try {
    const attempts = await Promise.allSettled(
      ["mace", "mace_spear", "mace_rod", "mace_rocket"].map((m) =>
        store.practiceCreate(
          "60000",
          m,
          "EU",
          "Saturday 16 UTC, agreed kit and spacing practice.",
        ),
      ),
    );
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 3);
    await assert.rejects(
      store.practiceCreate(
        "60000",
        "mace",
        "EU",
        "Another active mace post for Saturday.",
      ),
      /active post/,
    );
    const posts = await store.practiceList("mace", "EU");
    assert.equal(posts.length, 1);
    await assert.rejects(
      store.practiceClose(posts[0].id, "60001"),
      /post owner/,
    );
    assert.equal((await store.practiceList("bow", "NA")).length, 0);
    await store.practiceClose(posts[0].id, "80000", true);
    const id = await store.practiceCreate(
      "60000",
      "mace",
      "EU",
      "Reopened availability after closing old post.",
    );
    sql
      .prepare("UPDATE practice_posts SET expires=? WHERE id=?")
      .run("2020-01-01T00:00:00Z", id);
    assert.equal((await store.practiceList("mace", "EU")).length, 0);
    const newId = await store.practiceCreate(
      "60000",
      "mace",
      "EU",
      "New session after the old listing expired.",
    );
    await store.practiceClose(newId, "60000");
    const feed = JSON.stringify([
      await store.testing(),
      await store.rankings(config.points),
    ]);
    assert.ok(!feed.includes("60000"));
    assert.ok(!feed.includes("Saturday"));
    await assert.rejects(
      runCommand(
        interaction("60001", "practice", "close", {
          id: attempts.find((r) => r.status === "fulfilled").value,
        }),
        env,
        store,
      ),
      /owner/,
    );
    await assert.rejects(
      runCommand(
        interaction("60000", "practice", "create", {
          mode: "fake",
          region: "EU",
          note: "Testing invalid mode safely.",
        }),
        env,
        store,
      ),
      /valid mode/,
    );
    assert.ok(
      sql.prepare("SELECT count(*) AS n FROM practice_posts").get().n >= 4,
      "closed/expired records retained",
    );
  } finally {
    sql.close();
  }
});

test("tester applications are verified, private, bounded, independently reviewed and never grant roles", async () => {
  const { sql, store } = await database();
  try {
    const values = {
      mode: "mace",
      region: "EU",
      experience:
        "I explain spacing, fair scoring and evidence to every player.",
      availability: "Saturday 16–18 UTC",
    };
    await assert.rejects(
      runCommand(
        interaction("60000", "tester-apply", "submit", values),
        env,
        store,
      ),
      /ownership/,
    );
    await store.verify(
      "60000",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "PlayerOne",
      "30000",
    );
    await runCommand(
      interaction("60000", "tester-apply", "submit", values),
      env,
      store,
    );
    const rows = await store.testerApplications("60000");
    assert.equal(rows.length, 1);
    await assert.rejects(
      store.applyTester(
        "60000",
        "mace",
        "EU",
        values.experience,
        values.availability,
      ),
      /pending/,
    );
    assert.equal((await store.testerApplications("60001")).length, 0);
    await assert.rejects(
      runCommand(interaction("60001", "tester-apply", "review"), env, store),
      /moderators/,
    );
    await assert.rejects(
      store.reviewTester(
        rows[0].id,
        "60000",
        "interview",
        "I should not review my own application.",
      ),
      /independent/,
    );
    let requests = 0;
    await runCommand(
      interaction("30000", "tester-apply", "review", {
        id: rows[0].id,
        decision: "interview",
        reason: "Please arrange a supervised scoring exercise.",
      }),
      env,
      store,
      () => {
        requests++;
        throw Error("No role API should be called");
      },
    );
    assert.equal(requests, 0);
    assert.equal(
      (await store.testerApplications("60000"))[0].status,
      "interview",
    );
    assert.equal((await store.testerApplications()).length, 0);
    const feed = JSON.stringify([
      await store.testing(),
      await store.rankings(config.points),
    ]);
    assert.ok(!feed.includes("supervised"));
    assert.ok(!feed.includes(values.experience));
    await assert.rejects(
      store.reviewTester(
        rows[0].id,
        "30000",
        "declined",
        "Trying to change an already decided application.",
      ),
      /pending/,
    );
  } finally {
    sql.close();
  }
});

test("claim handoff only releases the assigned unfinished entry and retains queue order", async () => {
  const { sql, store } = await database();
  try {
    await store.verify(
      "60000",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "PlayerOne",
      "30000",
    );
    await store.session("mace", "EU", "open", "30000", 2, 72);
    const id = await store.join("60000", "mace", "EU");
    const created = (await store.list())[0].created;
    await store.claim(id, "70000");
    await assert.rejects(store.release(id, "70001"), /assigned/);
    await runCommand(
      interaction("70000", "claim", null, { id, action: "release" }, ["50000"]),
      env,
      store,
    );
    const row = (await store.list())[0];
    assert.equal(row.status, "waiting");
    assert.equal(row.created, created);
    await store.claim(id, "70001");
    await store.result(id, 3, 0, "https://example.com/evidence", "70001");
    await assert.rejects(store.release(id, "70001"), /unfinished/);
    const profile = await runCommand(
      interaction("60001", "profile", null, { name: "PlayerOne" }),
      env,
      store,
    );
    assert.match(profile, /Mace: HT3/);
    assert.ok(!profile.includes("60000"));
    assert.ok(!profile.includes("70001"));
    await assert.rejects(
      runCommand(
        interaction("60001", "profile", null, { name: "<bad>" }),
        env,
        store,
      ),
      /username/,
    );
  } finally {
    sql.close();
  }
});

test("cloud commands authorize server owner, reject ordinary members and update only zero-permission interest roles", async () => {
  const { sql, store } = await database();
  try {
    await store.statement('INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?)','30000','mace',0,'40000','Supervised calibration completed',new Date().toISOString()).run();
    await assert.rejects(
      runCommand(
        interaction("60000", "session", "open", {
          mode: "mace",
          region: "EU",
        }),
        env,
        store,
      ),
      /Only testers/,
    );
    assert.match(
      await runCommand(
        interaction("30000", "session", "open", {
          mode: "mace",
          region: "EU",
          kit:"pilot-1-candidate",benchmarks:"Consented benchmark opponents and evidence",
        }),
        env,
        store,
      ),
      /session open/,
    );
    const wrongGuild = interaction("30000", "queue", "list");
    wrongGuild.guild_id = "99999";
    await assert.rejects(
      runCommand(wrongGuild, env, store),
      /community server/,
    );
    const unsafe = async () =>
      Response.json([
        { id: "12345", name: "Mace", managed: false, permissions: "8" },
      ]);
    await assert.rejects(
      runCommand(
        interaction("60000", "preferences", null, { mode: "mace" }),
        env,
        store,
        unsafe,
      ),
      /unsafe permissions/,
    );
    const paths = [];
    const safe = async (url, options) => {
      paths.push([url, options.method]);
      return options.method === "GET"
        ? Response.json([
            { id: "12345", name: "Mace", managed: false, permissions: "0" },
          ])
        : new Response(null, { status: 204 });
    };
    assert.match(
      await runCommand(
        interaction("60000", "preferences", null, { mode: "mace" }),
        env,
        store,
        safe,
      ),
      /Mace added/,
    );
    assert.equal(paths[1][1], "PUT");
    assert.ok(paths[1][0].endsWith("/members/60000/roles/12345"));
  } finally {
    sql.close();
  }
});

test("private status scopes account, entry, position, latest evidence and cooldown to the actor", async () => {
  const { sql, store } = await database();
  try {
    await store.verify(
      "60000",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "PlayerOne",
      "30000",
    );
    await store.verify(
      "60001",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "PlayerTwo",
      "30000",
    );
    await store.session("mace", "EU", "open", "30000", 3, 72);
    const first = await store.join("60001", "mace", "EU");
    // Equal timestamps exercise the same deterministic created/id ordering as list().
    const own = await store.join("60000", "mace", "EU");
    sql
      .prepare("UPDATE queue SET created=? WHERE id=?")
      .run("2026-01-01T00:00:00.000Z", first);
    assert.equal((await store.status("60000", "mace", "EU")).position, 2);
    await store.claim(first, "70000");
    assert.equal((await store.status("60000", "mace", "EU")).position, 1);
    const command = interaction("60000", "queue", "status", {
      mode: "mace",
      region: "EU",
    });
    const reply = await runCommand(command, env, store);
    assert.ok(reply.includes(own));
    assert.ok(!reply.includes(first));
    assert.ok(!reply.includes("PlayerTwo"));
    assert.ok(!reply.includes("60001"));
    await store.release(first,'70000');
    await store.claim(own, "70000");
    await store.result(own, 3, 0, "https://example.com/own-evidence", "70000");
    const completed = await runCommand(command, env, store);
    assert.match(completed, /Latest valid result/);
    assert.match(completed, /https:\/\/example.com\/own-evidence/);
    assert.match(completed, /cooldown ends/);
    const appeal = await store.appeal(
      own,
      "60000",
      "Please review this evidence.",
    );
    await store.review(
      appeal,
      "80000",
      "revoke",
      "Evidence does not support the result.",
    );
    assert.equal((await store.status("60000", "mace", "EU")).latest, null);
    const other = await store.status("60002", "mace", "EU");
    assert.equal(other.account, null);
    assert.equal(other.entry, null);
    assert.equal(other.latest, null);
    const listings = await runCommand(
      interaction("60002", "availability", null, {
        mode: "mace",
        region: "EU",
      }),
      env,
      store,
    );
    assert.match(listings, /capacity 3/);
    assert.ok(!listings.includes("60001"));
    await assert.rejects(
      runCommand(
        interaction("60002", "availability", null, { region: "invalid" }),
        env,
        store,
      ),
      /valid region/,
    );
    assert.match(
      await runCommand(
        interaction("60002", "guide", null, { topic: "appeals" }),
        env,
        store,
      ),
      /independent moderator/,
    );
    await assert.rejects(
      runCommand(
        interaction("60002", "guide", null, { topic: "__proto__" }),
        env,
        store,
      ),
      /valid guide/,
    );
  } finally {
    sql.close();
  }
});

test("cloud endpoint verifies Ed25519 signatures, rejects replay/tampering and duplicate commands produce one private response", async () => {
  const { sql, store, adapter } = await database();
  try {
    const key = await crypto.subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ]);
    const hex = (bytes) => Buffer.from(bytes).toString("hex");
    const publicKey = hex(await crypto.subtle.exportKey("raw", key.publicKey));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      type: 1,
      application_id: env.DISCORD_CLIENT_ID,
    });
    const signature = hex(
      await crypto.subtle.sign(
        "Ed25519",
        key.privateKey,
        new TextEncoder().encode(timestamp + body),
      ),
    );
    const make = () =>
      new Request("https://example.com/discord/interactions", {
        method: "POST",
        body,
        headers: {
          "X-Signature-Ed25519": signature,
          "X-Signature-Timestamp": timestamp,
        },
      });
    assert.equal(await validSignature(make(), body, publicKey), true);
    assert.equal(await validSignature(make(), body + " ", publicKey), false);
    assert.equal(
      await validSignature(make(), body, publicKey, Date.now() + 600000),
      false,
    );
    assert.deepEqual(
      await (
        await worker.fetch(
          make(),
          { ...env, DISCORD_PUBLIC_KEY: publicKey },
          {},
        )
      ).json(),
      { type: 1 },
    );
    assert.equal(
      (
        await worker.fetch(
          new Request("https://example.com/discord/interactions", {
            method: "POST",
            body,
          }),
          { ...env, DISCORD_PUBLIC_KEY: publicKey },
          {},
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await worker.fetch(
          new Request("https://example.com/api/queue"),
          { ...env, DB: adapter },
          {},
        )
      ).status,
      404,
    );
    const command = interaction("60000", "queue", "list");
    const replies = [];
    const request = async (url, options) => {
      replies.push(JSON.parse(options.body));
      return Response.json({});
    };
    await completeInteraction(command, env, store, request);
    await completeInteraction(command, env, store, request);
    assert.equal(replies.length, 1);
    assert.deepEqual(replies[0].allowed_mentions, { parse: [] });
    assert.equal(
      sql.prepare("SELECT status FROM interaction_receipts").get().status,
      "complete",
    );
  } finally {
    sql.close();
  }
});

test("cloud site proxy preserves pages without forwarding credentials and uses edge-compatible redirects", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(
        url,
        "https://drax12341.github.io/minecraft-pvp-community/index.html",
      );
      assert.equal(options.redirect, "manual");
      assert.equal(options.headers, undefined);
      return new Response("<html>Minecraft community</html>", {
        headers: { "Content-Type": "text/html" },
      });
    };
    const response = await worker.fetch(
      new Request("https://example.com/", {
        headers: {
          Cookie: "private=do-not-forward",
          Authorization: "Bearer do-not-forward",
        },
      }),
      {},
      {},
    );
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Minecraft community/);
    globalThis.fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://unrelated.example/" },
      });
    assert.equal(
      (await worker.fetch(new Request("https://example.com/"), {}, {})).status,
      502,
    );
  } finally {
    globalThis.fetch = original;
  }
});
