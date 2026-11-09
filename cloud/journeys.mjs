import config from '../config/community.json' with {type:'json'};
import { staffAccess } from '../config/community-roles.mjs';
import { kitManifests } from '../config/kit-manifests.mjs';
export const journeyNames = new Set(['waitlist','qualification','test-room']);
export async function requireQualification(store,actor,mode,senior=false) {
  const q=await store.one('SELECT senior FROM tester_qualifications WHERE user=? AND mode=?',actor,mode);
  if(!q || (senior&&!q.senior)) throw Error('An authorised human must record your qualification for this mode using /qualification grant. Trainees cannot assess or publish independently.');
}
export async function requireReadyRoom(store,id,actor){
  const room=await store.one("SELECT r.*,q.mode,q.status AS queue_status FROM test_rooms r JOIN queue q ON q.id=r.id WHERE r.id=? AND q.tester=? AND r.tester=q.tester",id,actor);
  if(!room||room.queue_status!=='claimed'||room.state==='archived'||!room.player_ready||!room.tester_ready||room.kit_version!==kitManifests.version||!kitManifests.modes.some(m=>m.id===room.mode))throw Error('Both participants must confirm readiness in the assigned private room using the approved session kit version before assessment or publication.');
  return room;
}
export function roomOverwrites(env,player,tester,archived=false){
  const view=1024n,send=2048n,history=65536n;
  return [{id:env.DISCORD_GUILD_ID,type:0,allow:'0',deny:String(view)},...[...new Set([player,tester,env.DISCORD_CLIENT_ID])].map(id=>({id,type:1,allow:String(view|history|(archived?0n:send)),deny:archived?String(send):'0'}))];
}
export async function runJourney(i,env,store,request=fetch){
  const {actor,mod,tester}=staffAccess(i,env),sub=i.data.options?.find(o=>o.type===1),opts=sub?.options||[];
  const get=n=>opts.find(o=>o.name===n)?.value;
  const mode=()=>{if(!config.modes.some(m=>m.id===get('mode')))throw Error('Choose a valid mode.');return get('mode');};
  const discord=async(path,method,body)=>{
    const r=await request('https://discord.com/api/v10'+path,{method,headers:{Authorization:'Bot '+env.DISCORD_TOKEN,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw Error('Discord could not finish room setup. The durable reservation is retained; use /test-room open with the same ID to recover.');
    return r.status===204?null:r.json();
  };
  if(i.data.name==='qualification'){
    if(!mod)throw Error('Only moderators can maintain mode qualifications.');
    if(sub.name==='list')return (await store.all('SELECT user,mode,senior FROM tester_qualifications ORDER BY mode,user LIMIT 40')).map(q=>`<@${q.user}> / ${q.mode} / ${q.senior?'senior':'qualified'}`).join('\n')||'No recorded mode qualifications. Applications do not grant qualifications.';
    store.reason(get('reason'));const m=mode(),user=get('user');
    if(!/^\d{5,22}$/.test(user||''))throw Error('Choose a member.');
    if(user===actor)throw Error('A different authorised moderator must approve your qualification.');
    await store.db.batch([sub.name==='grant'?store.statement('INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?) ON CONFLICT(user,mode) DO UPDATE SET senior=excluded.senior,actor=excluded.actor,reason=excluded.reason,updated=excluded.updated',user,m,get('senior')?1:0,actor,get('reason'),new Date().toISOString()):store.statement('DELETE FROM tester_qualifications WHERE user=? AND mode=?',user,m),store.audit(actor,'qualification-'+sub.name,user+'/'+m)]);
    return 'Mode qualification updated. Discord staff roles remain a separate manual decision.';
  }
  if(i.data.name==='waitlist'){
    if(sub.name==='status')return (await store.all('SELECT mode,region,created FROM waitlists WHERE user=? ORDER BY created LIMIT 15',actor)).map(w=>`${w.mode} / ${w.region} / interest recorded ${w.created}`).join('\n')||'No waitlist preferences. Waitlists record demand; they reserve no active queue position.';
    const m=mode();
    if(sub.name==='leave'){await store.statement('DELETE FROM waitlists WHERE user=? AND mode=?',actor,m).run();return 'Waitlist preference removed. Active queue entries are unchanged.';}
    if(!['EU','NA','AS','SA','AU','AF','ME','OC'].includes(get('region')))throw Error('Choose a valid region.');
    if(!await store.one('SELECT 1 FROM accounts WHERE discord=?',actor))throw Error('Verify account ownership privately with staff first.');
    await store.statement('INSERT INTO waitlists VALUES(?,?,?,?) ON CONFLICT(user,mode) DO UPDATE SET region=excluded.region',actor,m,get('region'),new Date().toISOString()).run();
    return 'Waitlist preference saved. This is demand for future testing, not an active queue entry or reserved position. /availability shows actual sessions; /queue join enters one. /interests tests opts into session alerts.';
  }
  const q=await store.one('SELECT * FROM queue WHERE id=?',get('id'));
  if(!q || (q.user!==actor&&q.tester!==actor))throw Error('Only the player and assigned tester can coordinate this assessment.');
  let room=await store.one('SELECT * FROM test_rooms WHERE id=?',q.id);
  if(sub.name==='open'){
    if(!tester || actor!==q.tester || q.status!=='claimed')throw Error('Only the assigned qualified tester can open a room for a claimed entry.');
    await requireQualification(store,actor,q.mode);
    const category=env.DISCORD_TICKET_CATEGORY_ID;
    if(!category)throw Error('A private category must be configured first.');
    const now=new Date().toISOString();
    const session=await store.one('SELECT kit_version FROM sessions WHERE mode=? AND region=?',q.mode,q.region);
    if(!room){await store.statement("INSERT OR IGNORE INTO test_rooms(id,assignment,tester,ready_by,kit_version,updated) VALUES(?,?,?,?,?,?)",q.id,crypto.randomUUID(),actor,new Date(Date.now()+5*60000).toISOString(),session?.kit_version||'legacy-unrecorded',now).run();room=await store.one('SELECT * FROM test_rooms WHERE id=?',q.id);}
    if(room.state==='archived'){
      await store.statement("UPDATE test_rooms SET channel=NULL,assignment=?,tester=?,state='creating',ready_by=?,player_ready=0,tester_ready=0,kit_version=?,updated=? WHERE id=? AND state='archived'",crypto.randomUUID(),actor,new Date(Date.now()+5*60000).toISOString(),session?.kit_version||'legacy-unrecorded',now,q.id).run();
      room=await store.one('SELECT * FROM test_rooms WHERE id=?',q.id);
    }
    if(room.tester!==actor)throw Error('An older room must be archived by its participants before reassignment.');
    if(!room.channel){
      // Reconcile by exact durable topic before creating, including an API timeout after creation.
      const channels=await discord(`/guilds/${env.DISCORD_GUILD_ID}/channels`,'GET');
      const topic=`Assessment ${q.id} / assignment ${room.assignment}`;
      let channel=channels.find(c=>c.topic===topic);
      if(!channel){
        const lock=await store.statement("UPDATE test_rooms SET state='provisioning',updated=? WHERE id=? AND (state='creating' OR (state='provisioning' AND updated<?))",now,q.id,new Date(Date.now()-60000).toISOString()).run();
        if(!lock.meta.changes)throw Error('Room creation is already in progress. Check again after one minute; do not open a duplicate.');
        channel=await discord(`/guilds/${env.DISCORD_GUILD_ID}/channels`,'POST',{name:'test-'+q.id.slice(0,8),type:0,parent_id:category,topic,permission_overwrites:roomOverwrites(env,q.user,actor)});
      }
      // Always replace permissions before confirming a recovered channel.
      await discord(`/channels/${channel.id}`,'PATCH',{permission_overwrites:roomOverwrites(env,q.user,actor)});
      await store.statement("UPDATE test_rooms SET channel=?,state='ready-check',updated=? WHERE id=?",channel.id,now,q.id).run();
      await discord(`/channels/${channel.id}/messages`,'POST',{content:`<@${q.user}> <@${actor}> • ${q.mode} / ${q.region}\nAssessment ${q.id}. Confirm readiness with /test-room ready id:${q.id} within five minutes. Missing a call awards no result or cooldown; the tester releases the claim with its original queue order.\nBefore play, write the exact version, versioned kit manifest, location, 2 warmups + first-to-10 format, recording agreement and interruption rules here. Unresolved lag pauses play; replay an interrupted round only by mutual agreement. No credentials or private account details. /test-room archive preserves this room privately.`,allowed_mentions:{parse:[],users:[q.user,actor]}});
    }
    return `Private testing room: <#${room.channel||(await store.one('SELECT channel FROM test_rooms WHERE id=?',q.id)).channel}>. Kit and benchmark approval is still required before official play.`;
  }
  if(!room?.channel)throw Error('The assigned tester must open the private room first.');
  if(sub.name==='ready'){
    if(q.status!=='claimed'||room.tester!==q.tester||room.state==='archived')throw Error('This room is no longer assigned.');
    if(Date.parse(room.ready_by)<Date.now())throw Error('The readiness window expired. Ask your tester to release the claim without a penalty, then arrange a new call.');
    await store.statement(`UPDATE test_rooms SET ${actor===q.user?'player_ready':'tester_ready'}=1 WHERE id=?`,q.id).run();
    return 'Your readiness is recorded. Both participants must agree the written kit, arena and recording terms before play.';
  }
  if(sub.name==='archive'){
    if(actor!==q.tester)throw Error('The assigned tester archives this room after completion, cancellation or release.');
    await discord(`/channels/${room.channel}`,'PATCH',{name:'archived-test-'+q.id.slice(0,8),permission_overwrites:roomOverwrites(env,q.user,room.tester,true)});
    await store.statement("UPDATE test_rooms SET state='archived',updated=? WHERE id=?",new Date().toISOString(),q.id).run();
    return 'Room archived privately. Queue state and results are unchanged; release an unfinished claim separately.';
  }
  return `Assessment ${q.id}: ${room.state}; <#${room.channel}>. Player ready ${!!room.player_ready}; tester ready ${!!room.tester_ready}.`;
}
