import config from '../config/community.json' with {type:'json'};
import {webJson,websiteAuth,websiteIdentity,requireWebsiteMutation,websiteRateLimit,logoutWebsite} from './website-auth.mjs';
import {loadCompetitionConfig} from './competition-config.mjs';
import {platformStatistics} from './platform-panels.mjs';
import {runCommand} from './commands.mjs';
import {tokenHash} from './verification.mjs';
import {drainOutbox} from './delivery.mjs';
import {resolveSkinAppearance} from './appearance.mjs';
export const websiteTierOrder=['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];
const webRank=r=>r?`${r.pos===0?'HT':'LT'}${r.tier}`:null;
export function websiteTitle(points,modes=7){const max=modes*60,ratio=points/Math.max(1,max);return ratio>=.75?'Legend':ratio>=.5?'Grandmaster':ratio>=.3?'Master':ratio>=.15?'Elite':ratio>=.05?'Contender':points>0?'Challenger':'Unranked';}
async function webRankings(store,params){
 const data=await store.rankings(config.points,config.scoring),mode=params.get('mode')||'',region=params.get('region')||'',tier=params.get('tier')||'',status=params.get('status')||'all',q=(params.get('q')||'').toLowerCase(),sort=params.get('sort')||'points';
 let players=data.players.map((p,n)=>({...p,rank:n+1,title:websiteTitle(p.points,config.modes.length)}));
 players=players.filter(p=>(!q||p.name.toLowerCase().includes(q)||p.uuid.replaceAll('-','').includes(q.replaceAll('-','')))&&(!region||(mode?p.rankings[mode]?.region:p.region)===region)&&(!mode||p.rankings[mode])&&(!tier||Object.values(mode?{[mode]:p.rankings[mode]}:p.rankings).some(r=>webRank(r)===tier))&&(status!=='active'||Object.values(mode?{[mode]:p.rankings[mode]}:p.rankings).some(r=>!r.retired))&&(status!=='retired'||Object.values(mode?{[mode]:p.rankings[mode]}:p.rankings).some(r=>r.retired)));
 const points=p=>mode?config.points[(p.rankings[mode].peak_pos===0?'HT':'LT')+p.rankings[mode].peak_tier]:p.points;
 players.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):points(b)-points(a)||a.uuid.localeCompare(b.uuid));
 if(mode)players=players.map((p,n)=>({...p,modeRank:n+1}));
 const page=Math.max(1,Math.min(10000,Number(params.get('page'))||1)),limit=Math.max(1,Math.min(50,Number(params.get('limit'))||20));return {players:players.slice((page-1)*limit,page*limit),total:players.length,page,pages:Math.max(1,Math.ceil(players.length/limit)),limit,updatedAt:data.updatedAt};
}
async function webAccountByIdentifier(store,id){
 if(typeof id!=='string'||id.length>100)throw Object.assign(Error('Player not found.'),{status:404});
 const compact=id.replaceAll('-','').toLowerCase();
 return store.one("SELECT a.discord,a.uuid,a.name,a.verified_at,p.public_profile,p.region FROM accounts a LEFT JOIN player_settings p ON p.user=a.discord WHERE lower(a.name)=lower(?) OR replace(lower(a.uuid),'-','')=? OR a.uuid IN (SELECT uuid FROM account_aliases WHERE lower(name)=lower(?)) LIMIT 1",id,compact,id);
}
export async function publicResultRecords(store,params=new URLSearchParams(),id=null){
 const mode=params.get('mode')||'',region=params.get('region')||'',uuid=params.get('player')||'',kind=params.get('kind')||'',page=Math.max(1,Number(params.get('page'))||1),limit=Math.min(50,Math.max(1,Number(params.get('limit'))||18));
 const clauses=["NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id)"],args=[];
 for(const [column,value]of [['r.mode',mode],['r.region',region],['r.uuid',uuid],['r.id',id]])if(value){clauses.push(column+'=?');args.push(value);}
 const rows=await store.all(`SELECT r.id,r.uuid,r.name,r.region,r.mode,r.tier,r.pos,r.created,r.record_type,r.evidence,l.score,p.display_name tester_name,p.public_id tester_id,p.avatar tester_avatar,a.name tester_mc,a.uuid tester_uuid,
 (SELECT CASE WHEN prev.record_type='reset' THEN NULL ELSE (CASE WHEN prev.pos=0 THEN 'HT' ELSE 'LT' END)||prev.tier END FROM results prev WHERE prev.uuid=r.uuid AND prev.mode=r.mode AND prev.sequence<r.sequence AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=prev.id) ORDER BY prev.sequence DESC LIMIT 1) previous,
 (SELECT min(tier*2+pos) FROM results peak WHERE peak.uuid=r.uuid AND peak.mode=r.mode AND peak.sequence<r.sequence AND peak.record_type<>'reset' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=peak.id)) old_peak
 FROM results r LEFT JOIN test_lifecycle l ON l.test_id=r.id LEFT JOIN staff_public_profiles p ON p.user=r.tester LEFT JOIN accounts a ON a.discord=r.tester WHERE ${clauses.join(' AND ')} ORDER BY r.sequence DESC LIMIT 1000`,...args);
 let results=rows.map(r=>{const tier=webRank(r),change=r.record_type==='reset'?'Reset':!r.previous?'First tier':tier===r.previous?'Maintained':websiteTierOrder.indexOf(tier)<websiteTierOrder.indexOf(r.previous)?'Promoted':'Demoted';return {id:r.id,uuid:r.uuid,name:r.name,region:r.region,mode:r.mode,tier:r.record_type==='reset'?null:tier,previous:r.previous,recordType:r.record_type,classification:change,newPeak:r.record_type!=='reset'&&(r.old_peak===null||r.tier*2+r.pos<r.old_peak),created:r.created,score:r.record_type==='test'?r.score:null,evidence:r.evidence||null,tester:{id:r.tester_uuid||r.tester_id||null,name:r.tester_mc||r.tester_name||'Official staff',avatar:r.tester_avatar||null}};});
 if(kind==='elite')results=results.filter(r=>r.tier&&websiteTierOrder.indexOf(r.tier)<=4);if(kind==='promotions')results=results.filter(r=>r.classification==='Promoted');if(kind==='first')results=results.filter(r=>r.classification==='First tier');if(kind==='awards')results=results.filter(r=>r.recordType==='adjustment');
 if(params.get('from'))results=results.filter(r=>r.created>=params.get('from'));if(params.get('to'))results=results.filter(r=>r.created<params.get('to')+'T23:59:59.999Z');
 return {results:results.slice((page-1)*limit,page*limit),total:results.length,page,pages:Math.max(1,Math.ceil(results.length/limit)),updatedAt:new Date().toISOString()};
}
async function webTesters(store){
 const month=new Date(),start=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1)).toISOString();
 const rows=await store.all(`SELECT q.user,max(q.senior) senior,group_concat(DISTINCT q.mode) modes,a.name,a.uuid,p.public_id,p.display_name,p.avatar,
 (SELECT count(*) FROM results r WHERE r.tester=q.user AND r.record_type='test' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id)) completed,
 (SELECT count(*) FROM results r WHERE r.tester=q.user AND r.record_type='test' AND r.created>=? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id)) monthly,
 (SELECT group_concat(DISTINCT region) FROM tester_sessions s WHERE s.user=q.user AND s.ended IS NULL) regions,
 EXISTS(SELECT 1 FROM tester_sessions s WHERE s.user=q.user AND s.ended IS NULL AND s.status='available') available,
 EXISTS(SELECT 1 FROM queue WHERE tester=q.user AND status='claimed') busy
 FROM tester_qualifications q LEFT JOIN accounts a ON a.discord=q.user LEFT JOIN staff_public_profiles p ON p.user=q.user GROUP BY q.user ORDER BY completed DESC,q.user`,start);
 const out=[];for(const r of rows)out.push({id:r.uuid||r.public_id||(await tokenHash('mace-public-staff/'+r.user)).slice(0,24),name:r.name||r.display_name||'Qualified tester',uuid:r.uuid||null,avatar:r.avatar||null,senior:!!r.senior,modes:r.modes.split(','),regions:r.regions?.split(',')||[],completed:r.completed,monthly:r.monthly,status:r.busy?'testing':r.available?'available':'offline'});return out;
}
async function webQueues(store){
 const sessions=(await store.testing()).sessions;
 const queue=await store.all("SELECT q.id,q.mode,q.region,q.status,q.created,a.uuid,CASE WHEN p.public_profile=0 THEN 'Private competitor' ELSE a.name END name,p.public_profile FROM queue q JOIN accounts a ON a.discord=q.user LEFT JOIN player_settings p ON p.user=q.user WHERE q.status IN ('waiting','claimed') ORDER BY q.created,q.id LIMIT 1000");
 const testers=await webTesters(store);
 return {sessions:sessions.map(s=>({...s,active:s.claimed,testers:testers.filter(t=>t.modes.includes(s.mode)&&t.regions.includes(s.region)&&t.status!=='offline'),queue:queue.filter(q=>q.mode===s.mode&&q.region===s.region).map((q,n)=>({id:q.id,name:q.name,uuid:q.public_profile===0?null:q.uuid,status:q.status,position:q.status==='waiting'?queue.filter(x=>x.mode===q.mode&&x.region===q.region&&x.status==='waiting'&&(x.created<q.created||x.created===q.created&&x.id<=q.id)).length:null}))})),updatedAt:new Date().toISOString()};
}
export async function websiteApi(request,env,store,provider=fetch){
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\/v1/,'');
 try{
  if(!await websiteRateLimit(request,env,store,path.startsWith('/staff')?'staff':'public',path.startsWith('/staff')?40:180))return webJson({error:'Too many requests. Please retry shortly.'},429,{'Retry-After':'60'});
  await loadCompetitionConfig(store);
  if(request.method==='GET'){
   if(path.startsWith('/appearance/')){const uuid=decodeURIComponent(path.slice(12));const account=await store.one('SELECT a.uuid,p.public_profile FROM accounts a LEFT JOIN player_settings p ON p.user=a.discord WHERE a.uuid=?',uuid);if(!account)return webJson({error:'Verified competitor not found.'},404);if(account.public_profile===0)return webJson({error:'This profile is private.'},403);return webJson(await resolveSkinAppearance(store,account.uuid,provider));}
   if(path==='/bootstrap'){const [statistics,updates]=await Promise.all([platformStatistics(store),store.all('SELECT id,title,category,summary,version,published FROM published_updates ORDER BY published DESC LIMIT 3')]);const testers=await webTesters(store);return webJson({config:{name:'Mace Network',invite:config.invite,modes:config.modes,points:config.points,scoring:config.scoring||{basis:'peak',includeRetired:true},testing:config.testing,titles:['Challenger','Contender','Elite','Master','Grandmaster','Legend']},statistics:{...statistics,activeTesters:testers.filter(t=>t.status!=='offline').length},updates,loginConfigured:!!env.DISCORD_CLIENT_SECRET});}
   if(path==='/rankings')return webJson(await webRankings(store,url.searchParams));
   if(path==='/search'){
    const q=(url.searchParams.get('q')||'').trim();if(q.length<2||q.length>80)return webJson({players:[]});
    const matches=await store.all("SELECT DISTINCT a.uuid,a.name FROM accounts a LEFT JOIN player_settings p ON p.user=a.discord WHERE COALESCE(p.public_profile,1)=1 AND (lower(a.name) LIKE ? ESCAPE '\\' OR replace(a.uuid,'-','')=? OR a.uuid IN (SELECT uuid FROM account_aliases WHERE lower(name) LIKE ? ESCAPE '\\')) ORDER BY lower(a.name) LIMIT 12",q.toLowerCase().replace(/[\\%_]/g,'\\$&')+'%',q.replaceAll('-',''),q.toLowerCase().replace(/[\\%_]/g,'\\$&')+'%');
    const ranks=await store.rankings(config.points,config.scoring);return webJson({players:matches.map(a=>{const p=ranks.players.find(p=>p.uuid===a.uuid);return {uuid:a.uuid,name:a.name,region:p?.region||null,points:p?.points||0,rankings:p?.rankings||{}};})});
   }
   if(path.startsWith('/players/')){
    const account=await webAccountByIdentifier(store,decodeURIComponent(path.slice(9)));if(!account)return webJson({error:'Player not found.'},404);
    if(account.public_profile===0)return webJson({error:'This competitor has a private profile. Public placements remain visible in rankings.'},403);
    const data=await store.rankings(config.points,config.scoring),index=data.players.findIndex(p=>p.uuid===account.uuid),player=data.players[index]||data.unrankedPlayers?.find(p=>p.uuid===account.uuid)||{uuid:account.uuid,name:account.name,region:account.region,points:0,rankings:{},peaks:{}};
    const history=await publicResultRecords(store,new URLSearchParams({player:account.uuid,limit:'50'}));return webJson({...player,rank:index>=0?index+1:null,title:websiteTitle(player.points,config.modes.length),verified:!!account.verified_at,history:history.results,aliases:(await store.all('SELECT name FROM account_aliases WHERE uuid=? ORDER BY last_seen DESC',account.uuid)).map(a=>a.name)});
   }
   if(path==='/results')return webJson(await publicResultRecords(store,url.searchParams));
   if(path.startsWith('/results/')){const out=await publicResultRecords(store,new URLSearchParams(),decodeURIComponent(path.slice(9)));return out.results[0]?webJson(out.results[0]):webJson({error:'Result not found.'},404);}
   if(path==='/queues')return webJson(await webQueues(store));
   if(path==='/testers')return webJson({testers:await webTesters(store)});
   if(path.startsWith('/testers/')){const tester=(await webTesters(store)).find(t=>t.id===path.slice(9));return tester?webJson(tester):webJson({error:'Tester not found.'},404);}
   if(path==='/hall-of-fame'){const ranks=await store.rankings(config.points,config.scoring);return webJson({players:ranks.players.filter(p=>Object.values(p.rankings).some(r=>r.peak_tier===1)).map(p=>({...p,title:websiteTitle(p.points,config.modes.length)})),snapshots:[]});}
   if(path==='/updates')return webJson({updates:await store.all('SELECT id,title,category,summary,body,version,published FROM published_updates ORDER BY published DESC LIMIT 100')});
   if(path==='/me'||path.startsWith('/me/')||path.startsWith('/staff')||path.startsWith('/admin')){
    const identity=await websiteIdentity(request,env,store,provider);if(!identity)return webJson({error:'Sign in with Discord to continue.'},401);
    if(path==='/me/appearance'){const account=await store.one('SELECT uuid FROM accounts WHERE discord=?',identity.user);return account?webJson(await resolveSkinAppearance(store,account.uuid,provider,url.searchParams.get('refresh')==='1')):webJson({error:'Verify your Minecraft account to display its skin.'},409);}
    if(path==='/me'){const account=await store.one('SELECT name,uuid,verified_at FROM accounts WHERE discord=?',identity.user);const ranks=account?await store.rankings(config.points,config.scoring):null;const index=ranks?.players.findIndex(p=>p.uuid===account.uuid)??-1;const competitive=index>=0?{...ranks.players[index],rank:index+1}:null;const officialTests=account?(await store.one("SELECT count(*) n FROM results WHERE uuid=? AND record_type='test' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=results.id)",account.uuid)).n:0;return webJson({competitive,totals:{officialTests},user:{id:identity.user,name:identity.username,avatar:identity.avatar},permissions:{staff:identity.permissions.tester||identity.permissions.support,admin:identity.permissions.mod},account,settings:await store.one('SELECT region,public_profile FROM player_settings WHERE user=?',identity.user),notifications:await store.one('SELECT delivery FROM notification_preferences WHERE user=?',identity.user),queue:await store.list(identity.user),cooldowns:await store.all('SELECT mode,until_at FROM cooldowns WHERE user=?',identity.user),history:account?(await publicResultRecords(store,new URLSearchParams({player:account.uuid,limit:'50'}))).results:[]});}
    if(!(identity.permissions.tester||identity.permissions.support))return webJson({error:'Staff access required.'},403);if(path.startsWith('/admin')&&!identity.permissions.mod)return webJson({error:'Administrator access required.'},403);
    if(path==='/staff/overview'||path==='/admin/overview')return webJson({statistics:await platformStatistics(store),appeals:(await store.one("SELECT count(*) n FROM appeals WHERE status='pending'")).n,deliveries:await store.all("SELECT id,kind,attempts,last_error FROM outbox_events WHERE status<>'done' ORDER BY id LIMIT 20")});
    if(path==='/staff/queues')return webJson(await webQueues(store));
    if(path==='/staff/tests')return webJson({tests:await store.all('SELECT q.id,q.mode,q.region,q.status,l.state,l.score FROM queue q LEFT JOIN test_lifecycle l ON l.test_id=q.id ORDER BY q.created DESC LIMIT 50')});
    if(path==='/staff/testers')return webJson({testers:await webTesters(store)});
    if(path==='/staff/players'){if(!identity.permissions.mod)return webJson({error:'Manager access required.'},403);return webJson({players:await store.all('SELECT discord,uuid,name,verified_at FROM accounts WHERE lower(name) LIKE ? ORDER BY name LIMIT 30',(url.searchParams.get('q')||'').toLowerCase()+'%')});}
    if(path==='/staff/appeals'){if(!identity.permissions.mod)return webJson({error:'Manager access required.'},403);return webJson({appeals:await store.appeals()});}
    if(path==='/staff/audit'||path==='/admin/audit'){if(!identity.permissions.mod)return webJson({error:'Manager access required.'},403);return webJson({events:await store.all('SELECT id,actor,action,subject,created FROM audit ORDER BY id DESC LIMIT 50')});}
    if(path==='/admin/modes')return webJson({modes:config.modes});
    if(path==='/admin/roles')return webJson({roles:await store.all('SELECT mode,tier,role FROM tier_role_mappings ORDER BY mode,tier')});
    if(path==='/admin/results')return webJson(await publicResultRecords(store,url.searchParams));
    if(path==='/admin/settings')return webJson({settings:await store.all("SELECT key,value FROM platform_settings WHERE key IN ('branding','points','scoring')")});
    if(path==='/admin/analytics')return webJson({modes:await store.all("SELECT mode,count(*) tests FROM results WHERE record_type='test' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=results.id) GROUP BY mode"),regions:await store.all("SELECT region,count(*) tests FROM results WHERE record_type='test' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=results.id) GROUP BY region")});
    if(path==='/admin/system')return webJson({database:'connected',runtime:'cloud-http',deliveries:await store.all("SELECT kind,status,count(*) count FROM outbox_events GROUP BY kind,status")});
   }
   return webJson({error:'API resource not found.'},404);
  }
  const identity=await websiteIdentity(request,env,store,provider);await requireWebsiteMutation(request,identity);
  if(path==='/logout')return logoutWebsite(request,store,identity);
  if(request.method!=='POST')return webJson({error:'Method not allowed.'},405);
  const text=await request.text();if(text.length>16000)return webJson({error:'Request too large.'},413);let body;try{body=JSON.parse(text);}catch{return webJson({error:'Invalid JSON.'},400);}
  if(path==='/settings'){
   if(body.region&&!['EU','NA','AS','AU','OC','SA','ME','AF'].includes(body.region)||body.delivery&&!['dm','none'].includes(body.delivery)||body.privacy&&!['public','private'].includes(body.privacy))return webJson({error:'Invalid account settings.'},422);
   const tasks=[store.audit(identity.user,'website-account-settings','Own account')];if(body.region||body.privacy)tasks.push(store.statement('INSERT INTO player_settings(user,region,public_profile) VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET region=COALESCE(excluded.region,player_settings.region),public_profile=CASE WHEN ? IS NULL THEN player_settings.public_profile ELSE excluded.public_profile END',identity.user,body.region||null,body.privacy==='private'?0:1,body.privacy||null));if(body.delivery)tasks.push(store.statement('INSERT INTO notification_preferences(user,delivery) VALUES(?,?) ON CONFLICT(user) DO UPDATE SET delivery=excluded.delivery',identity.user,body.delivery));await store.db.batch(tasks);return webJson({saved:true});
  }
  if(path==='/ranking-policy'){
   if(!identity.permissions.mod)return webJson({error:'Administrator access required.'},403);
   if(!['peak','current'].includes(body.basis)||typeof body.includeRetired!=='boolean')return webJson({error:'Choose a valid scoring policy.'},422);
   const value=JSON.stringify({basis:body.basis,includeRetired:body.includeRetired}),previous=await store.one("SELECT value FROM platform_settings WHERE key='scoring'");
   await store.db.batch([store.statement("INSERT INTO platform_settings VALUES('scoring',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,actor=excluded.actor,updated=excluded.updated",value,identity.user,new Date().toISOString()),store.audit(identity.user,'ranking-policy',JSON.stringify({previous:previous?.value||config.scoring,next:JSON.parse(value)}))]);return webJson({saved:true});
  }
  const actions={'queue.join':['queue','join'],'queue.leave':['queue','leave'],'waitlist.join':['waitlist','join'],'waitlist.leave':['waitlist','leave'],'verify.start':['verify','start'],'verify.check':['verify','check'],'tier.set':['tier','set'],'tier.reset':['tier','reset'],'tier.confirm':['tier-confirm',null],'tester.add':['tester','add'],'tester.remove':['tester','remove'],'queue.open':['start',null],'queue.pause':['pause',null],'queue.close':['end',null],'queue.forceclose':['queue','forceclose'],'queue.clear':['queue','clear'],'staff.confirm':['confirm-action',null],'appeal.submit':['appeal','submit'],'appeal.review':['appeal','review'],'mode.create':['mode','create'],'mode.edit':['mode','edit'],'mode.disable':['mode','disable'],'resync':['system','resync']};
  if(path==='/action'){
   const route=actions[body.action];if(!route)return webJson({error:'Unsupported platform action.'},422);
   if(!body.values||typeof body.values!=='object'||Array.isArray(body.values)||Object.keys(body.values).length>12||Object.values(body.values).some(v=>!['string','number','boolean'].includes(typeof v)||typeof v==='string'&&v.length>2000))return webJson({error:'Invalid action values.'},422);
   const options=Object.entries(body.values).filter(([key])=>/^[a-z_]{1,30}$/.test(key)).map(([name,value])=>({name,value}));
   const interaction={id:crypto.randomUUID(),application_id:env.DISCORD_CLIENT_ID,guild_id:env.DISCORD_GUILD_ID,member:identity.member,data:{name:route[0],options:route[1]?[{type:1,name:route[1],options}]:options}};
   const response=await runCommand(interaction,env,store,provider);await drainOutbox(store,env,provider,3);return webJson({response});
  }
  if(path==='/updates/publish'){
   if(!identity.permissions.mod)return webJson({error:'Administrator access required.'},403);for(const key of ['title','category','summary','body','version'])if(typeof body[key]!=='string'||!body[key].trim()||body[key].length>(key==='body'?8000:key==='summary'?500:120))return webJson({error:'Complete every changelog field within its length limit.'},422);
   const id=crypto.randomUUID();await store.db.batch([store.statement('INSERT INTO published_updates VALUES(?,?,?,?,?,?,?,?)',id,body.title,body.category,body.summary,body.body,body.version,identity.user,new Date().toISOString()),store.audit(identity.user,'website-update-published',id)]);return webJson({id,published:true});
  }
  return webJson({error:'API resource not found.'},404);
 }catch(error){return webJson({error:error.status?error.message:/database|SQLITE|constraint|D1_|fetch failed/i.test(error.message)?'This request could not be saved. Check the existing state and try again.':error.message},error.status||400);}
}
