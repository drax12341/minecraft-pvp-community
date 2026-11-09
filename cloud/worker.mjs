import { CloudStore } from "./store.mjs";
import { runCommand } from "./commands.mjs";
import config from "../config/community.json" with { type: "json" };
import { componentRoute } from "./components.mjs";
import { kitManifests } from '../config/kit-manifests.mjs';

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
  const message = typeof content==='object' && content ? {...content,content:String(content.content).slice(0,1900)} : {content:String(content).slice(0,1900),components:[]};
  await store.finishInteraction(interaction.id, JSON.stringify(message));
  await deliverInteraction(interaction,env,store,request,message);
}
async function deliverInteraction(interaction,env,store,request,message){
  const response = await request(
    `https://discord.com/api/v10/webhooks/${env.DISCORD_CLIENT_ID}/${interaction.token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...message, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    console.error("Discord reply delivery failed: HTTP " + response.status);
  else await store.statement('UPDATE interaction_receipts SET delivered=1 WHERE id=?',interaction.id).run();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
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
        ![2,3,5].includes(interaction.type) ||
        interaction.guild_id !== env.DISCORD_GUILD_ID ||
        !/^\d{5,22}$/.test(interaction.id || "") ||
        !interaction.token
      )
        return json({ error: "Unsupported interaction" }, 400);
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
    if(url.pathname==='/data/community.json')return json(config);
    if(url.pathname==='/api/kits')return json(kitManifests);
    if (
      [
        "/healthz",
        "/api/health",
        "/data/results.json",
        "/api/rankings",
        "/data/testing.json",
        "/api/testing",
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
          return json({
            ok: true,
            runtime: "cloud-http",
            pcRequired: false,
            release: "community-v5",
            commands: 22,
          });
        }
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
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    if (path.includes("..") || path.includes("\\"))
      return json({ error: "Not found" }, 404);
    if(typeof siteAssets!=="undefined" && Object.hasOwn(siteAssets,path)){
      const asset=siteAssets[path];
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
