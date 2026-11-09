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
import config from "../config/community.json" with { type: "json" };
import { OperationsStore } from "../cloud/operations-store.mjs";
import { ticketOverwrites, assertPrivateTicket } from "../cloud/operations.mjs";
import { componentRoute } from "../cloud/components.mjs";

test('waitlists are private preferences and never create or reserve queue places',async()=>{
  const {sql,store}=await database();try{
    const join=interaction('60000','waitlist','join',{mode:'sword',region:'EU',kit:'pilot-1-candidate',benchmarks:'Consented calibration evidence and benchmark opponents'});
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
    const open=interaction('30000','session','open',{mode:'sword',region:'EU',kit:'pilot-1-candidate',benchmarks:'Consented calibration evidence and benchmark opponents'});
    await assert.rejects(runCommand(open,env,store),/qualification/);
    await assert.rejects(runCommand(interaction('30000','qualification','grant',{user:'30000',mode:'sword',reason:'Self approval is not permitted'}),env,store),/different/);
    await runCommand(interaction('30000','qualification','grant',{user:'50001',mode:'sword',reason:'Supervised calibration completed'}),env,store);
    await assert.rejects(runCommand(interaction('50001','session','open',{mode:'axe',region:'EU'},['50000']),env,store),/qualification/);
    await runCommand(interaction('50001','session','open',{mode:'sword',region:'EU',kit:'pilot-1-candidate',benchmarks:'Consented calibration evidence and benchmark opponents'},['50000']),env,store);
    for(const [user,uuid] of [['60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],['60001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']])await store.verify(user,uuid,'Player'+user,'30000');
    const a=await store.join('60000','sword','EU'),b=await store.join('60001','sword','EU');
    const outcomes=await Promise.allSettled([store.claim(a,'50001'),store.claim(b,'50001')]);
    assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  }finally{sql.close();}
});

test('evidence substitution cannot reuse high-tier sign-off',async()=>{
  const {sql,store}=await database();try{
    await store.verify('60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','PlayerOne','30000');
    await store.session('sword','EU','open','30000');const id=await store.join('60000','sword','EU');await store.claim(id,'50001');
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
    await store.session('sword','EU','open','30000');
    for(const [user,uuid]of[['60000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],['60001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']])await store.verify(user,uuid,'Player'+user,'30000');
    const first=await store.join('60000','sword','EU'),second=await store.join('60001','sword','EU');
    await store.statement('UPDATE queue SET created=? WHERE id=?','2026-01-01T00:00:00Z',first).run();
    assert.equal(await store.claimNext('sword','EU','60000'),second);
    await assert.rejects(store.claimNext('sword','EU','60000'),/already hold/);
    assert.equal(await store.claimNext('sword','EU','50001'),first);
  }finally{sql.close();}
});

test('a repeated interaction recovers a failed private reply without repeating the operation',async()=>{
  const{sql,store}=await database();try{
    const command=interaction('60000','practice','create',{mode:'sword',region:'EU',note:'Saturday 16 UTC, spacing practice'});
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
    await store.statement('INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?)','50001','sword',0,'30000','Supervised calibration',new Date().toISOString()).run();
    await store.session('sword','EU','open','50001');const id=await store.join('60000','sword','EU');await store.claim(id,'50001');
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
  const configured={...env,DISCORD_SUPPORT_ROLE_IDS:"70000",DISCORD_MODERATOR_ROLE_IDS:"40000",DISCORD_TICKET_CATEGORY_ID:"80000"};
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
    assert.deepEqual(calls[1].body.allowed_mentions,{parse:[],roles:["70000"],users:[]});
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
    await store.session("sword","EU","open","30000",10,72);
    const id=await store.join("60000","sword","EU");await store.claim(id,"50001");
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
    await assert.rejects(store.join("60000", "sword", "EU"), /ownership/);
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
    await store.session("sword", "EU", "open", "30000", 1, 72);
    const entry = await store.join("60000", "sword", "EU");
    await assert.rejects(store.join("60001", "sword", "EU"), /unavailable/);
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
    await assert.rejects(store.join("60000", "sword", "EU"), /unavailable/);
    const reopened = new CloudStore(adapter);
    assert.equal(
      (await reopened.rankings(config.points)).players[0].rankings.sword.tier,
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
      ["sword", "axe", "bow", "mace"].map((m) =>
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
        "sword",
        "EU",
        "Another active sword post for Saturday.",
      ),
      /active post/,
    );
    const posts = await store.practiceList("sword", "EU");
    assert.equal(posts.length, 1);
    await assert.rejects(
      store.practiceClose(posts[0].id, "60001"),
      /post owner/,
    );
    assert.equal((await store.practiceList("bow", "NA")).length, 0);
    await store.practiceClose(posts[0].id, "80000", true);
    const id = await store.practiceCreate(
      "60000",
      "sword",
      "EU",
      "Reopened availability after closing old post.",
    );
    sql
      .prepare("UPDATE practice_posts SET expires=? WHERE id=?")
      .run("2020-01-01T00:00:00Z", id);
    assert.equal((await store.practiceList("sword", "EU")).length, 0);
    const newId = await store.practiceCreate(
      "60000",
      "sword",
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
      mode: "sword",
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
        "sword",
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
    await store.session("sword", "EU", "open", "30000", 2, 72);
    const id = await store.join("60000", "sword", "EU");
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
    assert.match(profile, /Sword: HT3/);
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
    await store.statement('INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?)','30000','sword',0,'40000','Supervised calibration completed',new Date().toISOString()).run();
    await assert.rejects(
      runCommand(
        interaction("60000", "session", "open", {
          mode: "sword",
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
          mode: "sword",
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
        { id: "12345", name: "Sword", managed: false, permissions: "8" },
      ]);
    await assert.rejects(
      runCommand(
        interaction("60000", "preferences", null, { mode: "sword" }),
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
            { id: "12345", name: "Sword", managed: false, permissions: "0" },
          ])
        : new Response(null, { status: 204 });
    };
    assert.match(
      await runCommand(
        interaction("60000", "preferences", null, { mode: "sword" }),
        env,
        store,
        safe,
      ),
      /Sword added/,
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
    await store.session("sword", "EU", "open", "30000", 3, 72);
    const first = await store.join("60001", "sword", "EU");
    // Equal timestamps exercise the same deterministic created/id ordering as list().
    const own = await store.join("60000", "sword", "EU");
    sql
      .prepare("UPDATE queue SET created=? WHERE id=?")
      .run("2026-01-01T00:00:00.000Z", first);
    assert.equal((await store.status("60000", "sword", "EU")).position, 2);
    await store.claim(first, "70000");
    assert.equal((await store.status("60000", "sword", "EU")).position, 1);
    const command = interaction("60000", "queue", "status", {
      mode: "sword",
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
    assert.equal((await store.status("60000", "sword", "EU")).latest, null);
    const other = await store.status("60002", "sword", "EU");
    assert.equal(other.account, null);
    assert.equal(other.entry, null);
    assert.equal(other.latest, null);
    const listings = await runCommand(
      interaction("60002", "availability", null, {
        mode: "sword",
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
