import config from '../config/community.json' with {type:'json'};
import { deskTiers,deskRegions,deskPaths,testingDeskCommands } from '../config/testing-desk.mjs';
import { staffAccess } from '../config/community-roles.mjs';
import { requireQualification } from './journeys.mjs';
import { approvedCommunityLoadout } from './loadouts.mjs';
import {checkTierPhase} from '../config/phase-checks.mjs';
export const testingDeskNames=new Set(testingDeskCommands.map(c=>c.name));
const deskRank=r=>`${r.pos===0?'HT':'LT'}${r.tier}`;
export async function deskPublic(store){
 const leaderboard=await store.all(`SELECT a.name,count(*) AS tests FROM results r JOIN accounts a ON a.discord=r.tester WHERE NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) GROUP BY r.tester ORDER BY tests DESC,a.name LIMIT 10`);
 const demand=await store.all("SELECT mode,region,target,count(*) AS waiting FROM high_tests WHERE kind='player' AND status IN ('pending','claimed') GROUP BY mode,region,target");
 return {updatedAt:new Date().toISOString(),paths:deskPaths,tiers:deskTiers,demand,leaderboard};
}
export async function runTestingDesk(i,env,store,request=fetch,dispatch){
 const {actor,mod,tester}=staffAccess(i,env),sub=i.data.options?.find(o=>o.type===1),opts=sub?.options||i.data.options||[];
 let contextId;
 const get=n=>opts.find(o=>o.name===n)?.value??(n==='id'?contextId:undefined);
 const now=()=>new Date().toISOString();
 const checkMode=()=>{if(!config.modes.some(m=>m.id===get('mode')))throw Error('Choose a valid gamemode.');return get('mode');};
 const note=()=>{const n=get('reason');if(typeof n!=='string'||n.trim().length<10||n.length>1000)throw Error('Include a reason of 10–1000 characters.');return n.trim();};
 const event=(id,action,text)=>store.statement('INSERT INTO high_test_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,actor,action,text,now());
 const discord=async(path,method,body)=>{const r=await request('https://discord.com/api/v10'+path,{method,headers:{Authorization:'Bot '+env.DISCORD_TOKEN,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Discord could not finish this action. The application is saved; use the room command with its ID to recover.');return r.status===204?null:r.json();};
 const action=(label,custom_id,style=2)=>({type:2,label,custom_id,style});
 const invoke=(name,subcommand,values)=>{const options=Object.entries(values).map(([name,value])=>({name,value}));return dispatch({...i,type:2,...(name==='result'?{testingDeskPublish:get('id')}:{}),data:{name,options:subcommand?[{type:1,name:subcommand,options}]:options}});};
 if(i.data.name==='roster'){
  const m=checkMode(),region=get('region'),tier=get('tier'),page=get('page')||1;
  if(region&&!deskRegions.includes(region))throw Error('Choose a valid region.');if(tier&&!/^(HT|LT)[1-5]$/.test(tier))throw Error('Choose a valid tier.');if(!Number.isInteger(page)||page<1||page>1000)throw Error('Choose a valid page.');
  const players=(await store.rankings(config.points)).players.filter(p=>p.rankings[m]&&!p.rankings[m].retired&&(!region||(p.rankings[m].region||p.region)===region)&&(!tier||deskRank(p.rankings[m])===tier)).sort((a,b)=>config.points[deskRank(b.rankings[m])]-config.points[deskRank(a.rankings[m])]||a.name.localeCompare(b.name));
  const pages=Math.max(1,Math.ceil(players.length/15)),p=Math.min(page,pages),rows=players.slice((p-1)*15,p*15);
  const pageId=n=>`roster:page:${m}:${region||'all'}:${tier||'all'}:${n}`;
  return {content:`**${config.modes.find(x=>x.id===m).name} · ${region||'All regions'} · ${tier||'All tiers'}**\n${rows.map(x=>`**${deskRank(x.rankings[m])}** · ${x.name} · ${x.region}`).join('\n')||'No published players match. Complete an evaluation to earn a placement.'}\n\n${players.length} players · page ${p}/${pages}`,components:[{type:1,components:[...(p>1?[action('Previous',pageId(p-1))]:[]),...(p<pages?[action('Next',pageId(p+1))]:[]),{type:2,style:5,label:'Open player board',url:`https://minecraft-pvp-community.draxion0.chatgpt.site/#rankings?mode=${m}${region?'&region='+region:''}`}]}]};
 }
 if(i.data.name==='test-hub'){
  const m=checkMode(),region=get('region');if(!deskRegions.includes(region))throw Error('Choose a valid region.');const s=await store.status(actor,m,region),application=await store.one("SELECT * FROM high_tests WHERE user=? AND mode=? AND kind='player' AND status IN ('pending','claimed')",actor,m),restriction=await store.one('SELECT until_at FROM test_restrictions WHERE user=? AND mode=? AND until_at>?',actor,m,now());
  const order=['LT5','HT5','LT4','HT4','LT3','HT3','LT2','HT2','LT1','HT1'],current=s.latest?deskRank(s.latest):null,target=current?order[order.indexOf(current)+1]:null;
  let next,buttons;
  if(!s.account){next='Verify account ownership with staff before entering a queue.';buttons=[action('Verify account','hub:ticket',1)];}
  else if(restriction){next=`Your failed-test restriction ends <t:${Math.ceil(Date.parse(restriction.until_at)/1000)}:F>.`;buttons=[action('Check restrictions','desk:cooldown')];}
  else if(application){next=`Your ${application.target} application is ${application.status}, phase ${application.phase}.`;buttons=[action('Open test dashboard','flow:status:'+application.id,1)];}
  else if(target&&deskTiers.includes(target)){next=`Your next promotion is ${target}. Prepare a private application.`;buttons=[action('Apply for '+target,`flow:apply:${m}:${target}:${region}`,1)];}
  else{next=s.entry?`Your evaluation is ${s.entry.status}.`:'Join an open evaluation session, or save a waitlist preference.';buttons=[action('Request evaluation','test:mode:'+m,1),action('Session availability','hub:availability')];}
  return {content:`**Your testing hub · ${config.modes.find(x=>x.id===m).name} / ${region}**\nAccount: ${s.account?.name||'Not verified'}\nCurrent tier: ${current||'Unranked'}\nSession: ${s.session?.status||'Not scheduled'}\n\n**Next step**\n${next}`,components:[{type:1,components:buttons}]};
 }
 if(i.data.name==='tier-path'){if(!deskPaths[get('tier')])throw Error('Choose a target tier.');return `**Testing for ${get('tier')}**\n`+deskPaths[get('tier')].map((s,n)=>`**Phase ${n+1}:** ${s}`).join('\n')+'\n\nFailed tests: 30-day cooldown. Staff adjudicate replacements, forfeits and demotions using the ranked rubric.';}
 if(i.data.name==='tier-list'){
  const m=checkMode();if(!/^(HT|LT)[1-5]$/.test(get('tier')||''))throw Error('Choose a target tier.');if(get('region')&&!deskRegions.includes(get('region')))throw Error('Choose a region.');
  const players=(await store.rankings(config.points)).players.filter(p=>p.rankings[m]&&!p.rankings[m].retired&&deskRank(p.rankings[m])===get('tier')&&(!get('region')||(p.rankings[m].region||p.region)===get('region')));
  return `**${config.modes.find(x=>x.id===m).name} · ${get('tier')}**\n`+(players.slice(0,40).map(p=>`${p.name} · ${p.region}`).join('\n')||'No published players in this tier yet.')+`\n${players.length} total. Full roster: https://minecraft-pvp-community.draxion0.chatgpt.site/#high-tiers`;
 }
 if(i.data.name==='tester-roster'){
  const rows=await store.all('SELECT user,senior FROM tester_qualifications WHERE mode=? ORDER BY senior DESC,user LIMIT 30',checkMode());
  return rows.map(r=>`<@${r.user}> — ${r.senior?'senior review':'qualified tester'}`).join('\n')||'No qualified testers recorded for this gamemode. Apply through /tester-desk apply; staff review is required.';
 }
 if(i.data.name==='test-stats'){
  if(get('mode'))checkMode();const m=get('mode')||'';
  const rows=await store.all(`SELECT r.tester,a.name,count(*) n FROM results r LEFT JOIN accounts a ON a.discord=r.tester WHERE NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) AND (?='' OR r.mode=?) GROUP BY r.tester ORDER BY n DESC,r.tester LIMIT 10`,m,m);
  const total=await store.one("SELECT count(*) n FROM results r WHERE NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) AND (?='' OR r.mode=?)",m,m);
  return `**Completed tests: ${total.n}**\n`+(rows.map((r,n)=>`${n+1}. ${r.name||'<@'+r.tester+'>'} — ${r.n}`).join('\n')||'No completed tests yet.');
 }
 if(i.data.name==='cooldown'){
  const m=checkMode();if(!deskRegions.includes(get('region')))throw Error('Choose a valid region.');
  const restriction=await store.one('SELECT until_at FROM test_restrictions WHERE user=? AND mode=? AND until_at>?',actor,m,now()),s=await store.status(actor,m,get('region'));
  return `${restriction?'Failed-test restriction ends <t:'+Math.ceil(Date.parse(restriction.until_at)/1000)+':F>.':'No active failed-test restriction.'}\n${s.eligibleAt&&s.eligibleAt>now()?'Session retest cooldown ends <t:'+Math.ceil(Date.parse(s.eligibleAt)/1000)+':F>.':'No active session retest cooldown.'}\n${s.session?'Session: '+s.session.status+'.':'No session configured.'}`;
 }
 const kind=i.data.name==='tester-desk'?'tester':'player';
 if(!get('id')&&i.channel_id)contextId=(await store.one('SELECT id FROM high_tests WHERE channel=? AND kind=?',i.channel_id,kind))?.id;
 const show=r=>`**${r.kind==='tester'?'Tester application':'High-tier test'} ${r.id}**\n${r.mode} / ${r.region} / ${r.target} · ${r.status} · phase ${r.phase}\nApplicant: <@${r.user}>\nTester: ${r.tester?'<@'+r.tester+'>':'unassigned'}\nAvailability: ${r.availability}${r.reason?'\nDecision: '+r.reason:''}${r.channel?'\nTicket: <#'+r.channel+'>':''}`;
 async function room(r){
  if(r.channel){if(r.tester)await discord(`/channels/${r.channel}/permissions/${r.tester}`,'PUT',{type:1,allow:String(1024n|2048n|65536n|16384n|32768n),deny:'0'});return `Private ticket: <#${r.channel}>\n${show(r)}`;}
  if(!env.DISCORD_TICKET_CATEGORY_ID)throw Error('Private testing tickets are not configured. Application saved: '+r.id);
  const lock=now();
  const reserved=await store.statement("UPDATE high_tests SET room_lock=? WHERE id=? AND channel IS NULL AND (room_lock IS NULL OR room_lock<?)",lock,r.id,new Date(Date.now()-120000).toISOString()).run();
  if(!reserved.meta.changes)throw Error('Ticket creation is already running. Check status, then retry room in two minutes if needed. Application: '+r.id);
  try{
  // Recover a previous Discord success if the database update timed out.
  const channels=await discord(`/guilds/${env.DISCORD_GUILD_ID}/channels`,'GET');
  let c=channels.find(c=>c.topic===`Testing desk ${r.id}`);
  if(!c){
   const staff=String(env.DISCORD_MODERATOR_ROLE_IDS||env.MODERATOR_ROLE_ID||'').split(',').filter(x=>/^\d{5,22}$/.test(x));
   const access=String(1024n|2048n|65536n|16384n|32768n);
   c=await discord(`/guilds/${env.DISCORD_GUILD_ID}/channels`,'POST',{name:`${r.kind==='tester'?'tester':'test'}-${r.target.toLowerCase()}-${r.id.slice(0,8)}`,type:0,parent_id:env.DISCORD_TICKET_CATEGORY_ID,topic:`Testing desk ${r.id}`,permission_overwrites:[{id:env.DISCORD_GUILD_ID,type:0,allow:'0',deny:'1024'},...staff.map(id=>({id,type:0,allow:access,deny:'0'})),...[...new Set([r.user,env.DISCORD_CLIENT_ID,env.DISCORD_OWNER_ID,r.tester].filter(Boolean))].map(id=>({id,type:1,allow:access,deny:'0'}))]});
  }
  const permitted=new Set([env.DISCORD_GUILD_ID,r.user,env.DISCORD_CLIENT_ID,env.DISCORD_OWNER_ID,r.tester,...String(env.DISCORD_MODERATOR_ROLE_IDS||env.MODERATOR_ROLE_ID||'').split(',')].filter(Boolean));
  if(c.guild_id!==env.DISCORD_GUILD_ID||!c.permission_overwrites?.some(o=>o.id===env.DISCORD_GUILD_ID&&(BigInt(o.deny)&1024n)&&!(BigInt(o.allow)&1024n))||c.permission_overwrites.some(o=>!permitted.has(o.id)&&(BigInt(o.allow)&1024n)))throw Error('Ticket privacy could not be verified. Ask management to inspect the application '+r.id);
  await store.statement('UPDATE high_tests SET channel=?,room_lock=NULL,updated=? WHERE id=? AND room_lock=?',c.id,now(),r.id,lock).run();
  await discord(`/channels/${c.id}/messages`,'POST',{embeds:[{title:`${r.target} ${r.kind==='tester'?'Tester Application':'Tier Test'}`,description:show(r),color:r.kind==='tester'?0x9c82ee:0xff087a,fields:[{name:'Gamemode',value:config.modes.find(m=>m.id===r.mode).name,inline:true},{name:'Region',value:r.region,inline:true},...(r.experience?[{name:'Experience',value:r.experience}]:[]),{name:'Next step',value:r.kind==='tester'?'Management reviews this application, interviews and supervises training. Acceptance does not grant a qualification.':'Qualified staff use /high-test claim, then prepare the linked assessment in this same ticket. Open the dashboard below for your next actions.'}]}],components:[{type:1,components:[action('Open dashboard',r.kind==='tester'?'desk:tester-status':'flow:status:'+r.id,1)]}],allowed_mentions:{parse:[]}});
  return `Private application saved: ${r.id}\nTicket: <#${c.id}>`;
  }catch(error){await store.statement('UPDATE high_tests SET room_lock=NULL WHERE id=? AND room_lock=?',r.id,lock).run();throw error;}
 }
 if(sub?.name==='apply'){
  const m=checkMode(),target=get('tier'),region=get('region'),availability=get('availability'),experience=kind==='tester'?get('experience'):'';
  if(!deskTiers.includes(target)||!deskRegions.includes(region))throw Error('Choose a valid target tier and region.');
  if(typeof availability!=='string'||availability.trim().length<5||availability.length>100)throw Error('Include UTC availability in 5–100 characters.');
  if(kind==='tester'&&(typeof experience!=='string'||experience.trim().length<30||experience.length>800))throw Error('Include testing experience in 30–800 characters.');
  const account=await store.one('SELECT * FROM accounts WHERE discord=?',actor);if(!account)throw Error('Verify Minecraft account ownership with staff before applying.');
  if(kind==='player'){
   const restriction=await store.one('SELECT until_at FROM test_restrictions WHERE user=? AND mode=? AND until_at>?',actor,m,now());if(restriction)throw Error('Failed-test cooldown ends '+restriction.until_at);
   const current=await store.one('SELECT tier,pos FROM results r WHERE uuid=? AND mode=? AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) ORDER BY sequence DESC LIMIT 1',account.uuid,m);
   if(!current)throw Error('Complete an initial evaluation in this gamemode before applying for HT3+. Use /request-test.');
   const order=['LT5','HT5','LT4','HT4','LT3','HT3','LT2','HT2','LT1','HT1'];
   if(order.indexOf(target)!==order.indexOf(deskRank(current))+1)throw Error('Apply for the next tier above your published placement. Current rank: '+deskRank(current));
  }
  const id=crypto.randomUUID();
  const saved=await store.statement("INSERT INTO high_tests(id,user,kind,mode,region,target,availability,experience,created,updated) SELECT ?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM high_tests WHERE user=? AND mode=? AND kind=? AND status IN ('pending','claimed'))",id,actor,kind,m,region,target,availability.trim(),experience.trim(),now(),now(),actor,m,kind).run();
  if(!saved.meta.changes)throw Error('An active application already exists for this gamemode. Use the status command.');
  return room(await store.one('SELECT * FROM high_tests WHERE id=?',id));
 }
 if(sub?.name==='status'&&!get('id'))return (await store.all('SELECT * FROM high_tests WHERE user=? AND kind=? ORDER BY created DESC LIMIT 8',actor,kind)).map(show).join('\n\n')||'No applications yet. Choose a gamemode, region and target tier with the apply command.';
 if(sub?.name==='list'){
  if(kind==='tester'?!mod:!tester)throw Error('Only authorized staff can list applications.');
  if(get('mode')){checkMode();if(kind==='player'&&!mod)await requireQualification(store,actor,get('mode'));}
  if(kind==='player'&&!mod&&!get('mode'))throw Error('Select a gamemode you are qualified to test.');
  const rows=await store.all("SELECT * FROM high_tests WHERE kind=? AND status IN ('pending','claimed') AND (?='' OR mode=?) AND (?='' OR target=?) AND (?='' OR region=?) ORDER BY created LIMIT 10",kind,get('mode')||'',get('mode')||'',get('tier')||'',get('tier')||'',get('region')||'',get('region')||'');
  return rows.map(show).join('\n\n')||'No active applications match these filters.';
 }
 const r=await store.one('SELECT * FROM high_tests WHERE id=? AND kind=?',get('id'),kind);if(!r)throw Error('Application not found.');
 if(actor!==r.user&&!mod&&actor!==r.tester&&!(kind==='player'&&['claim','review'].includes(sub?.name)&&tester))throw Error('Only the applicant, assigned tester or management can access this application.');
 if(sub?.name==='withdraw'){
  if(actor!==r.user||r.status!=='pending')throw Error('Only the applicant can withdraw an unclaimed application. Claimed tests require staff adjudication under the forfeit rules.');
  const reason=note(),changes=await store.db.batch([store.statement("UPDATE high_tests SET status='withdrawn',reason=?,updated=?,version=version+1 WHERE id=? AND status='pending' AND version=?",reason,now(),r.id,r.version),event(r.id,'withdraw',reason)]);if(!changes[0].meta.changes)throw Error('The application changed; check status.');return 'Unclaimed application withdrawn. Its private history is retained; no failed-test cooldown was applied.';
 }
 if(sub?.name==='status'){
  const sets=await store.all('SELECT phase,opponent,opponent_tier,wins,losses,evidence FROM high_test_sets WHERE test_id=? ORDER BY phase,updated',r.id);
  const check=checkTierPhase(r.target,r.phase,sets.filter(s=>s.phase===r.phase));
  const components=[{type:1,components:[action('Refresh dashboard','flow:status:'+r.id),...(r.status==='claimed'?[action('Confirm readiness','flow:ready:'+r.id,1)]:[]),...(r.status==='pending'&&tester?[action('Claim test','flow:claim:'+r.id,1)]:[])]}];
  if(actor===r.tester&&r.status==='claimed'){
   components.push({type:1,components:[action('Prepare assessment','flow:prepare:'+r.id),action('Add opponent',`testform:opponent:${r.id}:${r.phase}`),action('Record rubric','testform:assess:'+r.id),action(r.phase<deskPaths[r.target].length?'Advance phase':'Publish result',`testform:${r.phase<deskPaths[r.target].length?'advance':'publish'}:${r.id}`,1)]});
   const current=sets.filter(s=>s.phase===r.phase);if(current.length)components.push({type:1,components:[{type:3,custom_id:`testform:score-pick:${r.id}:${r.phase}`,placeholder:'Record a score for an assigned opponent',min_values:1,max_values:1,options:current.slice(0,25).map(s=>({label:`Opponent ${s.opponent} (${s.opponent_tier})`,value:s.opponent,description:s.wins===null?'No score recorded':`${s.wins}–${s.losses} recorded`}))}]});
  }
  return {content:show(r)+(r.scheduled_at?'\nAppointment: <t:'+Math.floor(Date.parse(r.scheduled_at)/1000)+':F>':'')+'\n\n'+sets.map(s=>`Phase ${s.phase}: <@${s.opponent}> (${s.opponent_tier}) · ${s.wins===null?'assigned':s.wins+'–'+s.losses}`).join('\n')+'\n\n**Current phase:** '+check.summary,components};
 }
 if(sub?.name==='history')return show(r)+'\n\n'+((await store.all('SELECT action,note,created FROM high_test_events WHERE test_id=? ORDER BY created DESC LIMIT 10',r.id)).map(e=>`${e.created.slice(0,16)} · **${e.action}**\n${e.note}`).join('\n\n')||'No staff decisions recorded yet.');
 if(sub?.name==='ready'){
  if(!r.queue_id)throw Error('Your tester must run /high-test prepare to connect the assessment first.');
  return invoke('test-room','ready',{id:r.queue_id});
 }
 if(kind==='player'&&sub?.name==='review'){
  if(!tester||actor===r.user||actor===r.tester)throw Error('A different qualified senior tester must review this assessment.');
  await requireQualification(store,actor,r.mode,true);if(!r.queue_id)throw Error('Prepare the linked assessment first.');
  return invoke('assessment','review',{id:r.queue_id,tier:r.target,evidence:get('evidence'),reason:note()});
 }
 if(sub?.name==='room'){if(!['pending','claimed'].includes(r.status))throw Error('This application is closed.');return room(r);}
 if(kind==='tester'&&sub?.name==='review'){
  if(!mod||actor===r.user)throw Error('An independent moderator must review tester applications.');const reason=note(),decision=get('decision');if(!['interview','training','declined'].includes(decision))throw Error('Choose a valid decision.');
  const change=await store.db.batch([store.statement("UPDATE high_tests SET status=?,reason=?,updated=? WHERE id=? AND status='pending'",decision,reason,now(),r.id),event(r.id,'review',decision+': '+reason)]);if(!change[0].meta.changes)throw Error('Application is no longer pending.');
  return 'Review saved. No role or tester qualification was granted. Use /qualification grant only after supervised approval.';
 }
 if(actor===r.user||!tester)throw Error('A qualified independent tester is required.');
 await requireQualification(store,actor,r.mode,r.target!=='HT3');
 if(sub?.name==='claim'){
  const change=await store.statement("UPDATE high_tests SET tester=?,status='claimed',updated=? WHERE id=? AND status='pending' AND user<>?",actor,now(),r.id,actor).run();if(!change.meta.changes)throw Error('Application is already claimed or closed.');
  if(r.channel)await discord(`/channels/${r.channel}/permissions/${actor}`,'PUT',{type:1,allow:String(1024n|2048n|65536n|16384n|32768n),deny:'0'});
  return 'Application claimed. '+(r.channel?'Private ticket: <#'+r.channel+'>':'Use /high-test room to open its ticket.');
 }
 if(r.tester!==actor||r.status!=='claimed')throw Error('Only the assigned tester can update an active claimed test.');
 if(sub?.name==='prepare'){
  if(!r.channel)throw Error('Open the application ticket first with /high-test room.');
  const session=await store.one('SELECT * FROM sessions WHERE mode=? AND region=?',r.mode,r.region);
  if(!session||session.status!=='open'||!await approvedCommunityLoadout(store,r.mode,session.kit_version))throw Error('An open session with an approved kit version is required. Ask qualified staff to approve the gamemode loadout and open its session.');
  const restriction=await store.one('SELECT 1 FROM test_restrictions WHERE user=? AND mode=? AND until_at>?',r.user,r.mode,now());if(restriction)throw Error('This player has an active failed-test restriction.');
  if(!r.queue_id){
   await store.statement("UPDATE queue SET status='waiting',tester=NULL WHERE id=? AND status='cancelled' AND NOT EXISTS(SELECT 1 FROM results WHERE id=?) AND NOT EXISTS(SELECT 1 FROM queue active WHERE active.user=? AND active.mode=? AND active.status IN ('waiting','claimed'))",r.id,r.id,r.user,r.mode).run();
   await store.statement(`INSERT OR IGNORE INTO queue(id,user,mode,region,created) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM queue WHERE user=? AND mode=? AND status IN ('waiting','claimed')) AND (SELECT count(*) FROM queue WHERE mode=? AND region=? AND status IN ('waiting','claimed'))<?`,r.id,r.user,r.mode,r.region,now(),r.user,r.mode,r.mode,r.region,Math.min(session.capacity,20)).run();
   const q=await store.one('SELECT * FROM queue WHERE id=?',r.id);if(!q)throw Error('Another queue entry or session capacity blocks preparation. Resolve it before preparing this test.');
   await store.statement('UPDATE high_tests SET queue_id=? WHERE id=? AND queue_id IS NULL',q.id,r.id).run();r.queue_id=q.id;
  }
  const q=await store.one('SELECT * FROM queue WHERE id=?',r.queue_id);if(q.status==='waiting')await store.claim(q.id,actor);else if(q.status!=='claimed'||q.tester!==actor)throw Error('The linked queue assignment has changed. Ask management to review it.');
  const room=await store.one('SELECT * FROM test_rooms WHERE id=?',r.queue_id);if(room&&room.tester!==actor&&room.state!=='archived')throw Error('The previous tester must release or archive the old assignment first.');
  if(!room)await store.statement('INSERT INTO test_rooms(id,channel,assignment,tester,state,ready_by,kit_version,updated) VALUES(?,?,?,?,?,?,?,?)',r.queue_id,r.channel,crypto.randomUUID(),actor,'ready-check',new Date(Date.now()+15*60000).toISOString(),session.kit_version,now()).run();
  else if(room.state==='archived'||Date.parse(room.ready_by)<Date.now()||room.kit_version!==session.kit_version)await store.statement("UPDATE test_rooms SET state='ready-check',tester=?,player_ready=0,tester_ready=0,kit_version=?,ready_by=?,updated=? WHERE id=?",actor,session.kit_version,new Date(Date.now()+15*60000).toISOString(),now(),r.queue_id).run();
  await event(r.id,'prepare','Linked official assessment '+r.queue_id+' in the existing application ticket').run();
  return {content:'The assessment is connected to this same ticket. Both participants must confirm readiness within 15 minutes. Record the agreed kit, arena and recording terms here before playing.',components:[{type:1,components:[action('Confirm readiness','flow:ready:'+r.id,1),action('Test dashboard','flow:status:'+r.id)]}]};
 }
 if(sub?.name==='assess'){
  if(!r.queue_id)throw Error('Run /high-test prepare first.');
  return invoke('assessment','record',{id:r.queue_id,scores:get('scores'),reason:note()});
 }
 if(sub?.name==='publish'){
  const reason=note();if(!r.queue_id)throw Error('Run /high-test prepare and complete the linked assessment first.');
  if(r.phase!==deskPaths[r.target].length)throw Error('Complete all test phases before publishing.');
  const sets=await store.all('SELECT * FROM high_test_sets WHERE test_id=? AND phase=?',r.id,r.phase),check=checkTierPhase(r.target,r.phase,sets);
  if(check.complete<check.expected||sets.some(s=>s.wins===null))throw Error('Record every required final opponent set before publishing.');
  if(!check.passed&&!get('exception'))throw Error(check.summary+' Use exception:true only for a documented staff-adjudicated rubric exception.');
  const existing=await store.one('SELECT * FROM results WHERE id=?',r.queue_id);
  if(existing&&(existing.evidence!==get('evidence')||deskRank(existing)!==r.target))throw Error('The linked result already has a different tier or evidence. Ask management to review it.');
  if(!existing)await invoke('result',null,{id:r.queue_id,tier:r.target,evidence:get('evidence')});
  return invoke('high-test','close',{id:r.id,decision:'passed',reason:(get('exception')?'Rubric exception: ':'')+reason,result:r.queue_id});
 }
 if(sub?.name==='schedule'){
  const time=get('time'),reason=note(),stamp=Date.parse(time);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(time||'')||!Number.isFinite(stamp)||stamp<Date.now()||stamp>Date.now()+90*86400000)throw Error('Choose a valid UTC appointment within the next 90 days.');
  await store.db.batch([store.statement('UPDATE high_tests SET scheduled_at=?,updated=?,version=version+1 WHERE id=? AND version=?',new Date(stamp).toISOString(),now(),r.id,r.version),event(r.id,'schedule',new Date(stamp).toISOString()+': '+reason)]);return 'Agreed appointment recorded for <t:'+Math.floor(stamp/1000)+':F>. Both participants should confirm the time in this ticket.';
 }
 if(sub?.name==='release'){
  const reason=note();if(r.queue_id){const q=await store.one('SELECT status FROM queue WHERE id=?',r.queue_id);if(q?.status==='claimed')await store.release(r.queue_id,actor);await store.statement("UPDATE queue SET status='cancelled' WHERE id=? AND status='waiting'",r.queue_id).run();await store.statement("UPDATE test_rooms SET state='archived',updated=? WHERE id=?",now(),r.queue_id).run();}
  await store.db.batch([store.statement("UPDATE high_tests SET status='pending',tester=NULL,queue_id=NULL,updated=?,version=version+1 WHERE id=? AND version=?",now(),r.id,r.version),event(r.id,'release',reason)]);
  if(r.channel)await discord(`/channels/${r.channel}/permissions/${actor}`,'DELETE');return 'Application returned to the waiting staff list. Scores, evidence and decision history are retained. No failed-test cooldown was applied.';
 }
 if(sub?.name==='opponent'){
  if(get('opponent')===r.user||(get('opponent')===actor&&!(r.target==='HT3'&&r.phase===1)))throw Error('Choose an independent opponent.');
  if(get('phase')!==r.phase)throw Error('Assign opponents for the current phase.');
  const opponent=await store.one('SELECT * FROM accounts WHERE discord=?',get('opponent'));if(!opponent)throw Error('The opponent must have verified account ownership.');
  const placement=await store.one('SELECT tier,pos FROM results r WHERE uuid=? AND mode=? AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) ORDER BY sequence DESC LIMIT 1',opponent.uuid,r.mode);if(!placement)throw Error('The opponent needs a published placement in this gamemode.');
  const changed=await store.statement('INSERT OR IGNORE INTO high_test_sets(id,test_id,phase,opponent,opponent_tier,actor,updated) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),r.id,r.phase,get('opponent'),deskRank(placement),actor,now()).run();
  if(!changed.meta.changes)throw Error('This opponent is already assigned in this phase.');return `Opponent assigned as ${deskRank(placement)}. Record the set with /high-test score. Staff must check tier and replacement eligibility against the rubric.`;
 }
 if(sub?.name==='score'){
  const evidence=get('evidence'),wins=get('wins'),losses=get('losses');if(!URL.canParse(evidence)||new URL(evidence).protocol!=='https:'||evidence.length>1000)throw Error('Include a shareable HTTPS evidence URL.');
  if(!Number.isInteger(wins)||!Number.isInteger(losses)||wins<0||losses<0||wins>30||losses>30||wins+losses===0)throw Error('Enter valid round scores.');if(get('phase')!==r.phase)throw Error('Record scores for the current phase.');
  const changed=await store.db.batch([store.statement('UPDATE high_test_sets SET wins=?,losses=?,evidence=?,updated=? WHERE test_id=? AND phase=? AND opponent=?',wins,losses,evidence,now(),r.id,r.phase,get('opponent')),event(r.id,'score',`Phase ${r.phase}: ${get('opponent')} ${wins}-${losses} ${evidence}`)]);
  if(!changed[0].meta.changes)throw Error('Assign this opponent before recording a score.');return 'Score and evidence saved. Phase completion requires staff adjudication.';
 }
 if(sub?.name==='advance'){
  const reason=note();if(r.phase>=deskPaths[r.target].length)throw Error('This is the final phase. Publish the reviewed result, then close the test.');
  const sets=await store.all('SELECT * FROM high_test_sets WHERE test_id=? AND phase=?',r.id,r.phase),check=checkTierPhase(r.target,r.phase,sets);if(!sets.length||sets.some(s=>s.wins===null))throw Error('Record every assigned opponent set before advancing.');
  if(check.complete<check.expected)throw Error(check.summary);
  if(!check.passed&&!get('exception'))throw Error(check.summary+' Use exception:true only for a documented staff-adjudicated rubric exception.');
  const change=await store.db.batch([store.statement("UPDATE high_tests SET phase=phase+1,updated=? WHERE id=? AND phase=? AND status='claimed'",now(),r.id,r.phase),event(r.id,'advance',reason)]);if(!change[0].meta.changes)throw Error('Phase changed; check status.');return `Phase ${r.phase} adjudicated. Next: ${deskPaths[r.target][r.phase]}`;
 }
 if(sub?.name==='close'){
  const decision=get('decision'),reason=note();if(!['passed','failed','cancelled'].includes(decision))throw Error('Choose a valid outcome.');
  if(decision==='passed'){
   const result=await store.one('SELECT r.* FROM results r JOIN accounts a ON a.uuid=r.uuid WHERE r.id=? AND a.discord=? AND r.mode=? AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id)',get('result')||'',r.user,r.mode);
   const sets=await store.all('SELECT wins FROM high_test_sets WHERE test_id=? AND phase=?',r.id,r.phase);
   if(r.phase!==deskPaths[r.target].length||!sets.length||sets.some(s=>s.wins===null)||!result||deskRank(result)!==r.target||result.created<r.created)throw Error('A pass requires all phases recorded and a new published result matching this player, mode and target tier. Use the official assessment and result workflow.');
  }
  const statements=[store.statement("UPDATE high_tests SET status=?,reason=?,result_id=?,updated=?,version=version+1 WHERE id=? AND status='claimed' AND version=?",decision,reason,get('result')||null,now(),r.id,r.version),event(r.id,'close',decision+': '+reason)];
  if(decision==='failed')statements.push(store.statement("INSERT INTO test_restrictions SELECT user,mode,?,?,id FROM high_tests WHERE id=? AND status='failed' AND version=? ON CONFLICT(user,mode) DO UPDATE SET until_at=MAX(test_restrictions.until_at,excluded.until_at),reason=excluded.reason,test_id=excluded.test_id",new Date(Date.now()+30*86400000).toISOString(),reason,r.id,r.version+1));
  const changes=await store.db.batch(statements);if(!changes[0].meta.changes)throw Error('This test changed while you were closing it. Check its dashboard.');
  if(r.queue_id&&decision!=='passed'){const q=await store.one('SELECT status FROM queue WHERE id=?',r.queue_id);if(q?.status==='claimed')await store.release(r.queue_id,actor);await store.statement("UPDATE queue SET status='cancelled' WHERE id=? AND status='waiting'",r.queue_id).run();await store.statement("UPDATE test_rooms SET state='archived' WHERE id=?",r.queue_id).run();}
  return `Test ${decision}. ${decision==='failed'?'A 30-day mode cooldown is now enforced.':'History retained in the private ticket.'}`;
 }
 throw Error('Choose a supported testing command.');
}
