import config from "../config/community.json" with { type: "json" };
import { tokenHash } from "./verification.mjs";
import { staffAccess } from "../config/community-roles.mjs";

export async function platformStatistics(store) {
  return store.one(`SELECT (SELECT count(*) FROM accounts) verified,
 (SELECT count(*) FROM sessions WHERE status='open') openQueues,
 (SELECT count(*) FROM queue WHERE status='waiting') waiting,
 (SELECT count(*) FROM queue WHERE status='claimed') activeTests,
 (SELECT count(DISTINCT tester) FROM queue WHERE status='claimed') busyTesters,
 (SELECT count(*) FROM results r WHERE r.record_type='test' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id)) completedTests`);
}
export async function testingHubPanel(store) {
  const s = await platformStatistics(store);
  const savedBrand=await store.one("SELECT value FROM platform_settings WHERE key='branding'");
  const brand=savedBrand?JSON.parse(savedBrand.value):null;
  const button = (label, custom_id, style = 2) => ({
    type: 2,
    label,
    custom_id,
    style,
  });
  return {
    content: "",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: brand?.name||"\u{1F3C6} MACE COMPETITIVE NETWORK",
        color: brand?parseInt(brand.color.slice(1),16):0x7861e8,
        description:
          "**Verify. Queue. Play.**\nChoose your Mace mode and region below.",
        fields: [
          {
            name: "Open Queues",
            value: String(s.openQueues),inline:true,
          },
          {
            name: "Players Waiting",
            value: String(s.waiting),inline:true,
          },
          {
            name: "Testing Now",
            value: String(s.activeTests),inline:true,
          },
        ],
        footer: { text: `${s.verified} verified competitors · ${s.completedTests} official evaluations` },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          button("Verify account", "verify:start", 3),
          button("Find a test", "community:boards", 1),
          button("My profile", "community:self"),
        ],
      },
      {
        type: 1,
        components: [
          button("My testing desk", "community:desk"),
          button("How testing works", "hub:guide"),
          button("Help center", "hub:ticket"),
        ],
      },
    ],
  };
}
async function panelDiscord(env, request, path, method = "GET", body) {
  const r = await request("https://discord.com/api/v10" + path, {
    method,
    headers: {
      Authorization: "Bot " + env.DISCORD_TOKEN,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok)
    throw Error(
      "Testing hub update failed: Discord HTTP " +
        r.status +
        ". Check channel permissions.",
    );
  return r.status === 204 ? null : r.json();
}
export async function publishTestingHub(i, env, store, request = fetch) {
  const { mod, actor } = staffAccess(i, env);
  if (!mod) throw Error("Only moderators can install the public testing hub.");
  const channel = await panelDiscord(env, request, "/channels/" + i.channel_id);
  if (channel.guild_id !== env.DISCORD_GUILD_ID || channel.type !== 0)
    throw Error("Publish from a text channel in this community.");
  const key = "hub:" + i.channel_id,
    body = await testingHubPanel(store);
  const saved = await store.one(
    "SELECT * FROM platform_panels WHERE key=?",
    key,
  );
  let message = saved?.message;
  if (!message) {
    const recent = await panelDiscord(
      env,
      request,
      "/channels/" + i.channel_id + "/messages?limit=100",
    );
    message = recent.find(
      (m) =>
        m.author?.id === env.DISCORD_CLIENT_ID &&
        m.embeds?.some(
          (e) => e.footer?.text === "Mace platform · official testing hub",
        ),
    )?.id;
  }
  if (message)
    await panelDiscord(
      env,
      request,
      "/channels/" + i.channel_id + "/messages/" + message,
      "PATCH",
      body,
    );
  else
    message = (
      await panelDiscord(
        env,
        request,
        "/channels/" + i.channel_id + "/messages",
        "POST",
        {
          ...body,
          nonce: (await tokenHash(key)).slice(0, 24),
          enforce_nonce: true,
        },
      )
    ).id;
  await store.db.batch([
    store.statement(
      "INSERT INTO platform_panels(key,channel,message,fingerprint,last_edit) VALUES(?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET message=excluded.message,fingerprint=excluded.fingerprint,last_edit=excluded.last_edit",
      key,
      i.channel_id,
      message,
      await tokenHash(JSON.stringify(body)),
      new Date().toISOString(),
    ),
    store.audit(actor, "testing-hub-install", i.channel_id),
  ]);
  return "Persistent testing hub installed: <#" + i.channel_id + ">.";
}
export async function refreshTestingHubs(store, env, request = fetch) {
  const body = await testingHubPanel(store),
    fingerprint = await tokenHash(JSON.stringify(body));
  const panels = await store.all(
    "SELECT * FROM platform_panels WHERE key LIKE 'hub:%' LIMIT 10",
  );
  for (const p of panels) {
    if (p.fingerprint === fingerprint) continue;
    const now = new Date().toISOString();
    const lease = await store
      .statement(
        "UPDATE platform_panels SET lease_until=? WHERE key=? AND (lease_until IS NULL OR lease_until<?) AND (last_edit IS NULL OR last_edit<?)",
        new Date(Date.now() + 30000).toISOString(),
        p.key,
        now,
        new Date(Date.now() - 5000).toISOString(),
      )
      .run();
    if (!lease.meta.changes) continue;
    try {
      await panelDiscord(
        env,
        request,
        "/channels/" + p.channel + "/messages/" + p.message,
        "PATCH",
        body,
      );
      await store
        .statement(
          "UPDATE platform_panels SET fingerprint=?,last_edit=?,lease_until=NULL WHERE key=?",
          fingerprint,
          now,
          p.key,
        )
        .run();
    } catch (e) {
      await store
        .audit("system", "testing-hub-refresh-failed", p.channel)
        .run();
    }
  }
  const board=config.referenceLeaderboard;
  if(board && env.DISCORD_GUILD_ID===board.guild) {
    const body=await referenceLeaderboardPanel(store);
    const fingerprint=await tokenHash(JSON.stringify(body)),key='reference-leaderboard';
    const previous=await store.one('SELECT fingerprint FROM platform_panels WHERE key=?',key);
    if(previous?.fingerprint!==fingerprint){
      try {
        await panelDiscord(env,request,'/channels/'+board.channel+'/messages/'+board.message,'PATCH',body);
        await store.statement('INSERT INTO platform_panels(key,channel,message,fingerprint,last_edit) VALUES(?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET channel=excluded.channel,message=excluded.message,fingerprint=excluded.fingerprint,last_edit=excluded.last_edit',key,board.channel,board.message,fingerprint,new Date().toISOString()).run();
      } catch {
        await store.audit('system','reference-leaderboard-refresh-failed',board.channel+'/'+board.message).run();
      }
    }
  }
}

export async function referenceLeaderboardPanel(store, date=new Date()) {
  const start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1)).toISOString();
  const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)).toISOString();
  const filter="r.record_type='test' AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) AND r.created<?";
  const all=await store.all(`SELECT tester,count(*) n FROM results r WHERE ${filter} GROUP BY tester ORDER BY n DESC,tester LIMIT 10`,end);
  const month=await store.all(`SELECT tester,count(*) n FROM results r WHERE ${filter} AND r.created>=? GROUP BY tester ORDER BY n DESC,tester LIMIT 10`,end,start);
  const total=await store.one(`SELECT count(*) n FROM results r WHERE ${filter} AND r.created>=?`,end,start);
  const monthName=date.toLocaleString('en-US',{month:'long',timeZone:'UTC'});
  const lines=rows=>rows.map((r,n)=>`**${n+1}.** <@${r.tester}> — **${r.n.toLocaleString('en-US')}** tests`).join('\n')||'No completed tests yet.';
  return {content:'',allowed_mentions:{parse:[]},embeds:[{
    title:'🏆 All Time Testing Leaderboard',color:0x7861e8,
    description:lines(all)+'\n\n## 🏅 '+monthName+' Testing Leaderboard\n\n'+lines(month)+'\n\n**Total Tests in '+monthName+' : '+total.n.toLocaleString('en-US')+'**',
    footer:{text:'Mace Community · Completed official tests · UTC'},
  }]};
}
