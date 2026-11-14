import {enqueuePlatformNotifications} from './notification-maintenance.mjs';
import {installationBridge} from './installation.mjs';
import {loadCompetitionConfig} from './competition-config.mjs';
import { refreshTestingHubs, platformStatistics } from './platform-panels.mjs';
import { CloudStore } from "./store.mjs";
import { runCommand } from "./commands.mjs";
import config from "../config/community.json" with { type: "json" };
import { componentRoute } from "./components.mjs";
import { kitManifests } from '../config/kit-manifests.mjs';
import { deskPublic } from './testing-desk.mjs';
import { refreshCommunityBoards } from './community-desk.mjs';
import { finishVerification, tokenHash } from './verification.mjs';
import { drainOutbox } from './delivery.mjs';
import {websiteApi} from './website-api.mjs';
import {websiteAuth} from './website-auth.mjs';
import {websiteShell,websiteDiscovery} from './website-shell.mjs';
import {verificationDownload} from './skin-verification.mjs';
import {minecraftVerificationHealth} from './minecraft-lookup.mjs';

async function privateServiceAuth(request, secret) {
  if(typeof secret!=='string'||secret.length<32)return false;
  const supplied=request.headers.get('Authorization')||'';
  if(!supplied.startsWith('Bearer ')||supplied.length>512)return false;
  const [a,b]=await Promise.all([tokenHash(supplied.slice(7)),tokenHash(secret)]);
  let different=0;for(let n=0;n<a.length;n++)different|=a.charCodeAt(n)^b.charCodeAt(n);
  return different===0;
}

const website = "https://drax12341.github.io/minecraft-pvp-community";
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
export async function validSignature(request, body, key, now = Date.now()) {
  const signature = request.headers.get("X-Signature-Ed25519"),
    timestamp = request.headers.get("X-Signature-Timestamp");
  if (
    !/^[a-f0-9]{128}$/i.test(signature || "") ||
    !/^[a-f0-9]{64}$/i.test(key || "") ||
    !/^\d{10}$/.test(timestamp || "") ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  )
    return false;
  const hex = (s) => Uint8Array.from(s.match(/../g), (x) => parseInt(x, 16));
  try {
    const publicKey = await crypto.subtle.importKey(
      "raw",
      hex(key),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      publicKey,
      hex(signature),
      new TextEncoder().encode(timestamp + body),
    );
  } catch {
    return false;
  }
}

export async function completeInteraction(
  interaction,
  env,
  store,
  request = fetch,
) {
  if (!(await store.beginInteraction(interaction.id))) {
    const saved=await store.one('SELECT status,response,delivered FROM interaction_receipts WHERE id=?',interaction.id);
    if(saved?.status==='complete'&&!saved.delivered){
      let message;try{message=JSON.parse(saved.response);}catch{message={content:saved.response,components:[]};}
      await deliverInteraction(interaction,env,store,request,message);
    }
    return;
  }
  let content;
  try {
    content = await runCommand(interaction, env, store, request);
  } catch (error) {
    // Database/provider errors must not expose SQL, account IDs or credentials.
    content = /SQLITE|D1_|constraint|UNIQUE|database|fetch failed/i.test(
      error.message,
    )
      ? "The request could not be saved. Check for an existing entry or account, then try again or contact staff."
      : error.message;
  }
  const message = typeof content==='object' && content ? (content.flags&32768?{...content}:{...content,content:String(content.content||'').slice(0,1900)}) : {content:String(content).slice(0,1900),components:[]};
  await store.finishInteraction(interaction.id, JSON.stringify(message));
  await deliverInteraction(interaction,env,store,request,message);
  try { await enqueuePlatformNotifications(store); await drainOutbox(store,env,request,3); } catch { console.error('Outbox unavailable; inspect /delivery status.'); }
  try { await refreshTestingHubs(store,env,request); } catch { console.error('Testing hub refresh unavailable.'); }
  if(['queue','queue-board','session','claim','result','pull','high-test','loadout','start','pause','resume','end','match','result-confirm','confirm-action','mode','region'].includes(interaction.data.name)){
    try{
      const sub=interaction.data.options?.find(o=>o.type===1),opts=sub?.options||interaction.data.options||[];
      const get=name=>opts.find(o=>o.name===name)?.value;
      let mode=get('mode'),region=get('region');
      if(!mode||!region){
        const scope=interaction.data.name==='high-test'
          ? await store.one('SELECT mode,region FROM high_tests WHERE id=? OR channel=?',get('id')||'',interaction.channel_id||'')
          : get('id') ? await store.one('SELECT mode,region FROM queue WHERE id=?',get('id'))
          : mode ? await store.one('SELECT mode,region FROM queue WHERE user=? AND mode=? ORDER BY created DESC,id DESC LIMIT 1',interaction.member.user.id,mode) : null;
        mode=scope?.mode||mode;region=scope?.region||region;
      }
      if(['mode','region'].includes(interaction.data.name)){const result=await refreshCommunityBoards(store,env,request,mode||'',region||'');if(result.failed)console.error('Configuration changed; some queue panels need recovery.');}
      else if(mode&&(region||interaction.data.name==='loadout')){const result=await refreshCommunityBoards(store,env,request,mode,region||'');if(result.failed)console.error('Waitlist board refresh failed; members can use Refresh.');}
    }catch{console.error('Waitlist board refresh failed; the command response was delivered.');}
  }
}
async function deliverInteraction(interaction,env,store,request,message){
  const payload={...message,allowed_mentions:{parse:[]}};delete payload.artifact;if(payload.flags&32768){payload.flags|=64;payload.content=null;payload.embeds=[];}
  let body=JSON.stringify(payload),headers={'Content-Type':'application/json'};
  if(message.artifact){const form=new FormData();payload.attachments=[{id:0,filename:message.artifact.name}];form.set('payload_json',JSON.stringify(payload));form.set('files[0]',new Blob([message.artifact.text],{type:'text/plain;charset=utf-8'}),message.artifact.name);body=form;headers={};}
  const response = await request(
    `https://discord.com/api/v10/webhooks/${env.DISCORD_CLIENT_ID}/${interaction.token}/messages/@original`,
    {
      method: "PATCH",
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    console.error("Discord reply delivery failed: HTTP " + response.status);
  else await store.statement('UPDATE interaction_receipts SET delivered=1 WHERE id=?',interaction.id).run();
}

export default {
  async scheduled(_event,env,ctx) {
    if(env.DB){const store=new CloudStore(env.DB.withSession?.('first-primary')||env.DB);ctx.waitUntil((async()=>{await enqueuePlatformNotifications(store);await drainOutbox(store,env);await refreshTestingHubs(store,env);await refreshCommunityBoards(store,env);})());}
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const discovery=websiteDiscovery(url);if(discovery)return discovery;
    if(url.pathname==='/api/internal/verification-health'){if(request.method!=='GET')return json({error:'Method not allowed'},405);if(!await privateServiceAuth(request,env.DISCORD_TOKEN))return json({error:'Unauthorized'},401);const name=url.searchParams.get('name')||'Notch';if(!/^[A-Za-z0-9_]{3,16}$/.test(name))return json({error:'Enter a Java username'},422);return json(await minecraftVerificationHealth(name));}
    if(url.pathname.startsWith('/verify/skin/')){if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);if(!env.DB)return json({error:'Storage unavailable'},503);try{return await verificationDownload(request,new CloudStore(env.DB.withSession?.('first-primary')||env.DB));}catch{return json({error:'Verification skin unavailable. Please retry.'},503);}}
    if(url.pathname.startsWith('/api/v1/')||url.pathname.startsWith('/auth/discord/')){
      if(!env.DB)return json({error:'Storage unavailable'},503);
      const store=new CloudStore(env.DB.withSession?.('first-primary')||env.DB);
      try{return url.pathname.startsWith('/auth/')?await websiteAuth(request,env,store):await websiteApi(request,env,store);}catch{return json({error:'Service temporarily unavailable. Please retry.'},503);}
    }
    if(url.pathname==='/api/internal/queue-panels'){
      if(request.method!=='POST')return json({error:'Method not allowed'},405);
      if(!await privateServiceAuth(request,env.DISCORD_TOKEN))return json({error:'Unauthorized'},401);
      if(!env.DB)return json({error:'Storage unavailable'},503);
      try{const store=new CloudStore(env.DB.withSession?.('first-primary')||env.DB);await loadCompetitionConfig(store);return json(await refreshCommunityBoards(store,env));}catch{return json({error:'Queue panel update failed'},503);}
    }
    if(url.pathname==='/api/internal/installation'){
      if(!await privateServiceAuth(request,env.DISCORD_TOKEN))return json({error:'Unauthorized'},401);
      if(!env.DB)return json({error:'Storage unavailable'},503);
      try{return await installationBridge(request,env,new CloudStore(env.DB.withSession?.('first-primary')||env.DB));}catch{return json({error:'Installation synchronization failed. Inspect guild permissions and retry.'},503);}
    }
    if(url.pathname==='/api/platform'){if(!env.DB)return json({error:'Storage unavailable'},503);try{return json(await platformStatistics(new CloudStore(env.DB.withSession?.('first-primary')||env.DB)));}catch{return json({error:'Statistics unavailable'},503);}}
    if(['/api/internal/ownership-proof','/api/internal/reconcile'].includes(url.pathname)){
      if(request.method!=='POST')return json({error:'Method not allowed'},405);
      const proof=url.pathname.endsWith('ownership-proof');
      if(!await privateServiceAuth(request,proof?env.MINECRAFT_PROOF_SECRET:env.MAINTENANCE_SECRET))return json({error:'Unauthorized'},401);
      if(!env.DB)return json({error:'Storage unavailable'},503);
      const store=new CloudStore(env.DB.withSession?.('first-primary')||env.DB);
      if(!proof){try{await enqueuePlatformNotifications(store);const result=await drainOutbox(store,env);await refreshTestingHubs(store,env);return json(result);}catch{return json({error:'Reconciliation unavailable'},503);}}
      if(Number(request.headers.get('Content-Length')||0)>4096)return json({error:'Request too large'},413);
      const raw=await request.text();if(new TextEncoder().encode(raw).length>4096)return json({error:'Request too large'},413);
      let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
      try{return json(await finishVerification(store,body.code,body.uuid,body.name));}
      catch{return json({error:'Proof could not be accepted. Check challenge expiry and account linking.'},409);}
    }
    if (url.pathname === "/discord/interactions") {
      if (request.method !== "POST")
        return json({ error: "Method not allowed" }, 405);
      if (Number(request.headers.get("Content-Length") || 0) > 65536)
        return json({ error: "Request too large" }, 413);
      const body = await request.text();
      if (new TextEncoder().encode(body).length > 65536)
        return json({ error: "Request too large" }, 413);
      if (!(await validSignature(request, body, env.DISCORD_PUBLIC_KEY)))
        return json({ error: "Invalid signature" }, 401);
      let interaction;
      try {
        interaction = JSON.parse(body);
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      if (interaction.application_id !== env.DISCORD_CLIENT_ID)
        return json({ error: "Wrong application" }, 403);
      if (interaction.type === 1) return json({ type: 1 });
      if (
        ![2,3,4,5].includes(interaction.type) ||
        interaction.guild_id !== env.DISCORD_GUILD_ID ||
        !/^\d{5,22}$/.test(interaction.id || "") ||
        !interaction.token
      )
        return json({ error: "Unsupported interaction" }, 400);
      if(env.DB)await loadCompetitionConfig(new CloudStore(env.DB.withSession?.('first-primary')||env.DB));
      if(interaction.type===4){const sub=interaction.data.options?.find(o=>o.type===1),focused=(sub?.options||interaction.data.options||[]).find(o=>o.focused);return json({type:8,data:{choices:config.modes.filter(m=>(m.name+' '+m.id).toLowerCase().includes(String(focused?.value||'').toLowerCase())).slice(0,25).map(m=>({name:m.name,value:m.id}))}});}
      if(interaction.type===3 || interaction.type===5){
        try{
          const route=componentRoute(interaction);
          if(route.response)return json(route.response);
          interaction=route.command;
        }catch(error){return json({type:4,data:{content:error.message,flags:64,allowed_mentions:{parse:[]}}});}
      }
      if (!env.DB) return json({ error: "Cloud storage unavailable" }, 503);
      const db = env.DB.withSession?.("first-primary") || env.DB;
      ctx.waitUntil(
        completeInteraction(interaction, env, new CloudStore(db)).catch(() =>
          console.error("Cloud command processing failed."),
        ),
      );
      return json({ type: 5, data: { flags: 64 } });
    }
    if (!["GET", "HEAD"].includes(request.method))
      return json({ error: "Method not allowed" }, 405);
    if(['/data/community.json','/api/modes'].includes(url.pathname)){if(env.DB){try{await loadCompetitionConfig(new CloudStore(env.DB.withSession?.('first-primary')||env.DB));}catch{return json({error:'Mode configuration unavailable'},503);}}return json(url.pathname==='/api/modes'?{modes:config.modes}:config);}
    if(url.pathname==='/api/kits')return json(kitManifests);
    if(url.pathname==='/api/loadouts'){
      if(!env.DB)return json({error:'Cloud storage unavailable'},503);
      try{
        const store=new CloudStore(env.DB.withSession?.('first-primary')||env.DB);
        const loadouts=await store.all('SELECT mode,version,loadout,created FROM (SELECT mode,version,loadout,created,ROW_NUMBER() OVER(PARTITION BY mode ORDER BY created DESC,version DESC) AS position FROM mode_loadouts WHERE revoked=0) WHERE position<=8 ORDER BY mode,created DESC,version DESC LIMIT 56');
        return json({loadouts});
      }catch{return json({error:'Approved loadouts unavailable'},503);}
    }
    if (
      [
        "/healthz",
        "/api/health",
        "/data/results.json",
        "/api/rankings",
        "/data/testing.json",
        "/api/testing",
        "/api/testing-desk",
      ].includes(url.pathname)
    ) {
      if (!env.DB) return json({ error: "Cloud storage unavailable" }, 503);
      const store = new CloudStore(
        env.DB.withSession?.("first-primary") || env.DB,
      );
      try {
        if (["/healthz", "/api/health"].includes(url.pathname)) {
          await store.one("SELECT count(*) AS n FROM sessions");
          await store.one("SELECT 1 FROM tester_applications LIMIT 1");
          await store.one("SELECT 1 FROM practice_posts LIMIT 1");
          await store.one("SELECT 1 FROM support_tickets LIMIT 1");
          await store.one("SELECT 1 FROM assessments LIMIT 1");
          await store.one('SELECT 1 FROM tester_qualifications LIMIT 1');
          await store.one('SELECT 1 FROM test_rooms LIMIT 1');
          await store.one('SELECT 1 FROM ticket_drafts LIMIT 1');
          await store.one('SELECT 1 FROM high_tests LIMIT 1');
          await store.one('SELECT 1 FROM retirements LIMIT 1');
          await store.one('SELECT 1 FROM queue_boards LIMIT 1');
          await store.one('SELECT 1 FROM mode_loadouts LIMIT 1');
          await store.one('SELECT 1 FROM queue_closures LIMIT 1');
          await store.one('SELECT 1 FROM effective_placements LIMIT 1');
          await store.one('SELECT 1 FROM support_evidence LIMIT 1');
          await store.one('SELECT 1 FROM maintenance_locks LIMIT 1');
          return json({
            ok: true,
            runtime: "cloud-http",
            pcRequired: false,
            release: "mace-network-v15-verification",
            queueCapacity: 20,
          });
        }
        if(url.pathname==='/api/testing-desk')return json(await deskPublic(store));
        return json(
          url.pathname.includes("testing")
            ? await store.testing()
            : await store.rankings(config.points),
        );
      } catch {
        return json({ error: "Cloud storage unavailable" }, 503);
      }
    }
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/discord/")
    )
      return json({ error: "Not found" }, 404);
    // Preserve the existing site and assets, served from its public Pages build.
    // Neither visitor cookies nor Discord/hosting secrets are forwarded.
    const isPage=/^\/(?:$|rankings(?:\/[^/]+)?|players(?:\/[^/]+)?|tests(?:\/[^/]+)?|testers(?:\/[^/]+)?|modes(?:\/[^/]+)?|account(?:\/(?:settings|testing|history))?|staff(?:\/(?:queues|tests|players|testers|appeals|audit))?|admin(?:\/(?:modes|roles|results|settings|analytics|system))?|high-tiers|queues|leaderboards|hall-of-fame|how-to-test|rules|points|faq|changelog|mod|discord|support|login|privacy|terms|api-docs)\/?$/.test(url.pathname);
    const path = isPage ? "/index.html" : url.pathname;
    if (path.includes("..") || path.includes("\\"))
      return json({ error: "Not found" }, 404);
    if(typeof siteAssets!=="undefined" && Object.hasOwn(siteAssets,path)){
      const asset=siteAssets[path];
      if(isPage)return websiteShell(asset,url,env.DB?new CloudStore(env.DB.withSession?.('first-primary')||env.DB):null,request.method==='HEAD');
      return new Response(request.method==="HEAD"?null:asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body,{headers:{"Content-Type":asset.type,"X-Content-Type-Options":"nosniff","Cache-Control":"public, max-age=60","Referrer-Policy":"strict-origin-when-cross-origin"}});
    }
    const upstream = await fetch(website + path, {
      method: request.method,
      redirect: "manual",
    });
    if (upstream.status >= 300 && upstream.status < 400)
      return json({ error: "Website temporarily unavailable" }, 502);
    const headers = new Headers(upstream.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
