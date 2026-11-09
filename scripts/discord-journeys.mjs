// Repeatable updates to known existing panels. Never deletes messages/channels.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const guild=process.env.DISCORD_GUILD_ID;
const headers={Authorization:'Bot '+process.env.DISCORD_TOKEN,'Content-Type':'application/json'};
async function api(path,method='GET',body){
 const r=await fetch('https://discord.com/api/v10'+path,{method,headers,body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw Error(`Discord ${method} ${path}: HTTP ${r.status}`);
 return r.status===204?null:r.json();
}
const me=await api('/users/@me'),channels=await api(`/guilds/${guild}/channels`);
const url='https://minecraft-pvp-community.draxion0.chatgpt.site';
const updates={
 'request-test':['Your testing journey','Verify ownership privately → select mode/region → read approved kit → join a future waitlist or an open queue → assigned qualified tester → private readiness room → assessment → independent review where required → published result.\n\n/waitlist join records demand, not an active place. /queue status shows your private progress. /test-room ready has a five-minute response window; missed calls award no result or cooldown. Sessions stay closed until real staff, kits and benchmarks are approved.'],
 'testing-faq':['Waitlists are not queues','Interest roles choose preferences. /waitlist join records future testing demand. /queue join enters an available, capacity-limited session after verification and cooldown checks. Only assigned tests get private testing rooms. Support cases use their own workflow.\n\nA missed call has no automatic tier or cooldown penalty: the tester archives the room and releases the claim with original queue order. No waiting-time estimates or staffing promises are made.'],
 'open-a-ticket':['Private support desk','Choose a category, answer the short questions, review your private draft, then submit. General support, account verification/recovery, player reports, confidential staff reports and website/bot problems are supported.\n\nTwo active cases per member; one per category. Drafts expire after 15 minutes. Staff reports go to the owner or explicitly appointed independent reviewers; administrators inherently retain access. Never send passwords, authentication tokens or backup codes. Use /appeal submit for placement disputes.'],
 'staff-handbook':['Staff operations · v5','Human appointments only. /qualification records mode-specific approval after supervised calibration; it grants no Discord roles. Trainees do not publish independently. Moderators also need mode qualifications for testing.\n\n/session open requires the reviewed kit version and real benchmark references. Pilot manifests: Sword, Axe, Bow; other modes remain closed. /claim → /test-room open → both /test-room ready → assessment → exact-revision/evidence senior sign-off for HT1/LT1/HT2/LT2 → /result → archive. Archive before release/handoff.\n\nSupport: claim, assign, state, staff-only notes, resolution summary, close. /ticket recover reconciles uncertain channel creation. Recuse conflicts. Full editable handbook: docs/STAFF-OPERATIONS-V5.md in the project.'],
 'testing-rubrics':['Versioned standards · original pilot kits','Read the original pilot loadouts and inventory diagrams at '+url+'/standards.html. Version pilot-1-candidate covers Sword, Axe and Bow; these specifications require real staff calibration and benchmark approval. Other modes do not yet have complete manifests.\n\nSix dimensions provide actionable feedback, not an automatic tier formula. High-tier review binds the current assessment revision, exact proposed tier and exact evidence. Changing the assessment or evidence requires fresh approval.'],
};
const report={updated:[],blocked:[]};
for(const[name,[title,description]]of Object.entries(updates)){
 const c=channels.find(c=>c.name===name);if(!c){report.blocked.push(name);continue;}
 const messages=await api(`/channels/${c.id}/messages?limit=100`);
 const suffix=` · ${name} · main`;
 const previous=messages.find(m=>m.author.id===me.id&&m.embeds?.some(e=>e.footer?.text?.endsWith(suffix)));
 const marker=previous?.embeds?.find(e=>e.footer?.text?.endsWith(suffix))?.footer.text||`Minecraft PvP Tierlist · community-v5${suffix}`;
 const buttons=name==='open-a-ticket'?[{type:2,style:1,label:'Open private case',custom_id:'hub:ticket'}]:name==='request-test'?[{type:2,style:1,label:'Find testing',custom_id:'hub:test'},{type:2,style:2,label:'Availability',custom_id:'hub:availability'}]:[];
 const body={embeds:[{title,description,color:0xa995ff,footer:{text:marker},image:{url:url+'/brand/panel-'+(name==='open-a-ticket'?'support':name==='testing-rubrics'?'standards':'testing')+'.png'}}],components:[{type:1,components:[...buttons,{type:2,style:5,label:'Player hub',url}]}],allowed_mentions:{parse:[]}};
 const message=await api(`/channels/${c.id}/messages${previous?'/'+previous.id:''}`,previous?'PATCH':'POST',body);
 await api(`/channels/${c.id}`,'PATCH',{topic:description.replaceAll('\n',' ').slice(0,990)});
 report.updated.push({channel:name,id:c.id,message:message.id,edited:!!previous});
}
// Move clearly misplaced community channels while preserving every message.
const community=channels.find(c=>c.id==='1568975808838635611');
if(community)for(const id of ['1568975817583763568','1568975818648985761'])if(channels.some(c=>c.id===id))await api(`/channels/${id}`,'PATCH',{parent_id:community.id});
const icon='data:image/png;base64,'+(await readFile('web/brand/discord-icon.png')).toString('base64');
try{await api(`/guilds/${guild}`,'PATCH',{icon});report.guildIcon='applied';}catch(e){report.blocked.push('Guild icon: '+e.message);}
await mkdir('.runtime',{recursive:true});await writeFile('.runtime/journeys-discord.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
