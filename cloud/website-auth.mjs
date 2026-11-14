import {tokenHash} from './verification.mjs';
import {staffAccess} from '../config/community-roles.mjs';
export const webSessionCookie='__Host-mace_session';
const webCookie=(name,value,age)=>name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
export function webJson(value,status=200,headers={}){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});}
function webCookies(request){return Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(c=>c.trim().split('=')));}
const webRandom=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
export async function websiteRateLimit(request,env,store,bucket,limit=120){
 const ip=request.headers.get('CF-Connecting-IP')||'local',key=await tokenHash((env.DISCORD_TOKEN||'test')+'/'+bucket+'/'+ip),window=Math.floor(Date.now()/60000);
 const outcome=await store.statement('INSERT INTO web_rate_limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,hits=CASE WHEN web_rate_limits.window=excluded.window THEN web_rate_limits.hits+1 ELSE 1 END WHERE web_rate_limits.window<>excluded.window OR web_rate_limits.hits<? RETURNING hits',key,window,limit).first();
 return !!outcome;
}
export async function websiteIdentity(request,env,store,provider=fetch){
 const token=webCookies(request)[webSessionCookie];if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const session=await store.one('SELECT user,username,avatar,expires,csrf_hash FROM web_sessions WHERE token_hash=? AND expires>?',await tokenHash(token),new Date().toISOString());if(!session)return null;
 const r=await provider('https://discord.com/api/v10/guilds/'+env.DISCORD_GUILD_ID+'/members/'+session.user,{headers:{Authorization:'Bot '+env.DISCORD_TOKEN},signal:AbortSignal.timeout(8000)});
 let member={user:{id:session.user},roles:[],permissions:'0'};
 if(r.ok){const m=await r.json();member={...m,user:{...m.user,id:session.user},permissions:'0'};
  const rolesResponse=await provider('https://discord.com/api/v10/guilds/'+env.DISCORD_GUILD_ID+'/roles',{headers:{Authorization:'Bot '+env.DISCORD_TOKEN},signal:AbortSignal.timeout(8000)});
  if(!rolesResponse.ok)throw Error('Could not validate current Discord permissions.');const roles=await rolesResponse.json();member.permissions=String(roles.filter(role=>member.roles.includes(role.id)||role.id===env.DISCORD_GUILD_ID).reduce((n,role)=>n|BigInt(role.permissions),0n));
 }else if(r.status!==404)throw Error('Discord membership could not be validated.');
 const resources=await store.all("SELECT key,discord_id FROM guild_resources WHERE key IN ('role:manager','role:tester','role:high-tester')");
 const extended={...env,DISCORD_MODERATOR_ROLE_IDS:[env.DISCORD_MODERATOR_ROLE_IDS||env.MODERATOR_ROLE_ID,resources.find(r=>r.key==='role:manager')?.discord_id].filter(Boolean).join(','),DISCORD_TESTER_ROLE_IDS:[env.DISCORD_TESTER_ROLE_IDS||env.TESTER_ROLE_ID,...resources.filter(r=>r.key!=='role:manager').map(r=>r.discord_id)].filter(Boolean).join(',')};
 return {...session,member,permissions:staffAccess({member},extended)};
}
export async function requireWebsiteMutation(request,identity){
 if(!identity)throw Object.assign(Error('Sign in with Discord to continue.'),{status:401});
 const origin=request.headers.get('Origin'),url=new URL(request.url),csrf=request.headers.get('X-CSRF-Token');
 if(origin!==url.origin||!csrf||await tokenHash(csrf)!==identity.csrf_hash)throw Object.assign(Error('Your security token expired. Refresh the page and try again.'),{status:403});
}
export async function websiteAuth(request,env,store,provider=fetch){
 const url=new URL(request.url),cookies=webCookies(request),callback=url.origin+'/auth/discord/callback';
 if(!await websiteRateLimit(request,env,store,'auth',10))return webJson({error:'Too many sign-in attempts. Try again shortly.'},429,{'Retry-After':'60'});
 if(url.pathname==='/auth/discord/start'){
  if(!env.DISCORD_CLIENT_SECRET)return Response.redirect(url.origin+'/login?setup=required',303);
  const state=webRandom(),verifier=webRandom(),challenge=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)),b64=btoa(String.fromCharCode(...new Uint8Array(challenge))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  let returnTo=url.searchParams.get('return')||'/account';if(!/^\/(account|staff|admin|queues)(\/[^?#]*)?$/.test(returnTo))returnTo='/account';
  await store.statement('INSERT INTO web_oauth_states VALUES(?,?,?,?)',await tokenHash(state),verifier,new Date(Date.now()+600000).toISOString(),returnTo).run();
  const target=new URL('https://discord.com/oauth2/authorize');target.search=new URLSearchParams({response_type:'code',client_id:env.DISCORD_CLIENT_ID,redirect_uri:callback,scope:'identify',state,code_challenge:b64,code_challenge_method:'S256'});
  return new Response(null,{status:303,headers:{Location:target.href,'Set-Cookie':webCookie('__Host-mace_oauth',state,600),'Cache-Control':'no-store'}});
 }
 if(url.pathname==='/auth/discord/callback'){
  const state=url.searchParams.get('state'),code=url.searchParams.get('code');if(!state||state!==cookies['__Host-mace_oauth']||!code||url.searchParams.has('iss')&&url.searchParams.get('iss')!=='https://discord.com')return webJson({error:'Discord sign-in could not be verified. Start again.'},400);
  const saved=await store.statement('DELETE FROM web_oauth_states WHERE state_hash=? AND expires>? RETURNING *',await tokenHash(state),new Date().toISOString()).first();if(!saved)return webJson({error:'Sign-in expired or was already used.'},400);
  if(!env.DISCORD_CLIENT_SECRET)return webJson({error:'Discord login is not configured.'},503);
  const tokenResponse=await provider('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,client_secret:env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:callback,code_verifier:saved.verifier}),signal:AbortSignal.timeout(10000)});
  if(!tokenResponse.ok)return webJson({error:'Discord authorization failed. Please start sign-in again.'},401);const oauth=await tokenResponse.json();
  const me=await provider('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+oauth.access_token},signal:AbortSignal.timeout(8000)});if(!me.ok)return webJson({error:'Discord identity could not be verified.'},401);
  const user=await me.json();if(!/^\d{5,22}$/.test(user.id||'')||typeof user.username!=='string')return webJson({error:'Invalid Discord identity.'},401);
  const token=webRandom(),csrf=webRandom();await store.statement('INSERT INTO web_sessions VALUES(?,?,?,?,?,?,?)',await tokenHash(token),user.id,user.global_name||user.username,user.avatar||null,await tokenHash(csrf),new Date(Date.now()+7*86400000).toISOString(),new Date().toISOString()).run();
  const response=new Response(null,{status:303,headers:{Location:url.origin+saved.return_to,'Cache-Control':'no-store'}});response.headers.append('Set-Cookie',webCookie(webSessionCookie,token,604800));response.headers.append('Set-Cookie',webCookie('__Host-mace_oauth','',0));
  response.headers.append('Set-Cookie','__Host-mace_csrf='+csrf+'; Path=/; Secure; SameSite=Lax; Max-Age=604800');return response;
 }
 return webJson({error:'Authentication route not found'},404);
}
export async function logoutWebsite(request,store,identity){
 await requireWebsiteMutation(request,identity);const token=webCookies(request)[webSessionCookie];await store.statement('DELETE FROM web_sessions WHERE token_hash=?',await tokenHash(token)).run();
 const r=webJson({signedOut:true});r.headers.append('Set-Cookie',webCookie(webSessionCookie,'',0));r.headers.append('Set-Cookie','__Host-mace_csrf=; Path=/; Secure; SameSite=Lax; Max-Age=0');return r;
}
