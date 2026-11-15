import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import { CloudStore } from "../cloud/store.mjs";
import { drainOutbox } from "../cloud/delivery.mjs";
import {
  refreshPublishedResults,
  resultAnnouncement,
} from "../cloud/result-presentation.mjs";
import worker from "../cloud/worker.mjs";

async function fixture() {
  const sql = new DatabaseSync(":memory:");
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    sql.exec(await readFile("drizzle/" + file, "utf8"));
  const db = {
    prepare(query) {
      const make = (values = []) => ({
        bind: (...v) => make(v),
        first: async () => sql.prepare(query).get(...values) || null,
        all: async () => ({ results: sql.prepare(query).all(...values) }),
        run: async () => ({ meta: sql.prepare(query).run(...values) }),
      });
      return make();
    },
    async batch(items) {
      sql.exec("BEGIN");
      try {
        const r = [];
        for (const i of items) r.push(await i.run());
        sql.exec("COMMIT");
        return r;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const store = new CloudStore(db),
    stamp = new Date().toISOString();
  await store.verify(
    "60000",
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "PlayerOne",
    "30000",
  );
  await store
    .statement(
      "INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created,record_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      "result-1",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "PlayerOne",
      "EU",
      "mace",
      3,
      0,
      "50001",
      "Private evidence must stay private",
      stamp,
      "adjustment",
    )
    .run();
  await store
    .statement(
      "INSERT INTO outbox_events(kind,subject,available_at,created) VALUES(?,?,?,?)",
      "staff-result",
      "result-1",
      stamp,
      stamp,
    )
    .run();
  return { sql, store };
}
const env = {
  DISCORD_TOKEN: "test",
  DISCORD_CLIENT_ID: "90000",
  DISCORD_RESULTS_CHANNEL_ID: "70000",
  DISCORD_RESULT_PING_ROLE_ID: "71000",
};

test("compact result posts show the skin, mention only the linked player and configured role, credit staff and add reactions", async () => {
  const { sql, store } = await fixture();
  try {
    const calls = [];
    const request = async (url, o) => {
      calls.push({ url, ...o, body: o.body ? JSON.parse(o.body) : null });
      return o.method === "PUT"
        ? new Response(null, { status: 204 })
        : Response.json({ id: "80000" });
    };
    assert.equal((await drainOutbox(store, env, request)).failed, 0);
    const messages = calls.filter((c) => c.method === "POST"),
      p = messages[0].body;
    assert.equal(messages.length, 1);
    assert.match(p.content, /<@60000>/);
    assert.match(p.content, /<@&71000>/);
    assert.deepEqual(p.allowed_mentions, {
      parse: [],
      users: ["60000"],
      roles: ["71000"],
    });
    assert.match(p.embeds[0].thumbnail.url, /aaaaaaaa/);
    assert.match(p.embeds[0].description, /STAFF TIER AWARD/);
    assert.ok(p.embeds[0].fields.some((f) => f.value === "<@50001>"));
    assert.ok(
      p.components[0].components.some((b) =>
        b.url.includes("/players/aaaaaaaa"),
      ),
    );
    assert.doesNotMatch(
      JSON.stringify(p),
      /Private evidence|Match evidence|Final score/,
    );
    assert.equal(calls.filter((c) => c.method === "PUT").length, 2);
    assert.equal(
      (await store.one("SELECT count(*) n FROM result_publications")).n,
      1,
    );
  } finally {
    sql.close();
  }
});

test("reaction outages retry separately across restarts without posting or pinging the player twice", async () => {
  const { sql, store } = await fixture();
  try {
    let posts = 0,
      fail = true;
    const request = async (url, o) => {
      if (o.method === "POST") {
        posts++;
        return Response.json({ id: "80000" });
      }
      if (o.method === "PUT" && fail)
        return Response.json(
          { message: "Missing permissions" },
          { status: 403 },
        );
      return new Response(null, { status: 204 });
    };
    await drainOutbox(store, env, request);
    assert.equal(
      (
        await store.one(
          "SELECT status FROM outbox_events WHERE kind='staff-result'",
        )
      ).status,
      "done",
    );
    assert.equal(
      (
        await store.one(
          "SELECT count(*) n FROM outbox_events WHERE kind='result-reaction' AND status='pending'",
        )
      ).n,
      2,
    );
    fail = false;
    await store
      .statement(
        "UPDATE outbox_events SET available_at='2000-01-01' WHERE kind='result-reaction'",
      )
      .run();
    await drainOutbox(new CloudStore(store.db), env, request);
    assert.equal(posts, 1);
    assert.equal(
      (
        await store.one(
          "SELECT count(*) n FROM outbox_events WHERE status='pending'",
        )
      ).n,
      0,
    );
    // Even if the announcement lease is recovered after a crash, its durable message ID wins.
    await store
      .statement(
        "UPDATE outbox_events SET status='pending',available_at='2000-01-01' WHERE kind='staff-result'",
      )
      .run();
    await drainOutbox(new CloudStore(store.db), env, request);
    assert.equal(posts, 1);
  } finally {
    sql.close();
  }
});

test("revoked awards never publish or react", async () => {
  const { sql, store } = await fixture();
  try {
    await store
      .statement(
        "INSERT INTO revoked VALUES(?,?,?,?)",
        "result-1",
        "30000",
        "Corrected",
        new Date().toISOString(),
      )
      .run();
    let calls = 0;
    await drainOutbox(store, env, async () => {
      calls++;
      throw Error("Unexpected Discord call");
    });
    assert.equal(calls, 0);
  } finally {
    sql.close();
  }
});

test("restyling old bot results edits only the matching official post, suppresses all pings and never posts samples", async () => {
  const { sql, store } = await fixture();
  try {
    await store.statement("UPDATE outbox_events SET status='done'").run();
    const calls = [];
    const api = async (path, method = "GET", body) => {
      calls.push({ path, method, body });
      if (method === "GET")
        return [
          {
            id: "80000",
            author: { id: env.DISCORD_CLIENT_ID },
            embeds: [{ footer: { text: "Official test result-1" } }],
          },
          {
            id: "80001",
            author: { id: "77777" },
            embeds: [{ footer: { text: "Official test result-1" } }],
          },
        ];
      return { id: "80000" };
    };
    assert.equal((await refreshPublishedResults(store, env, api)).updated, 1);
    assert.equal(calls.filter((c) => c.method === "POST").length, 0);
    const patch = calls.find((c) => c.method === "PATCH");
    assert.match(patch.path, /80000$/);
    assert.deepEqual(patch.body.allowed_mentions, {
      parse: [],
      users: [],
      roles: [],
    });
    assert.equal(calls.filter((c) => c.method === "PUT").length, 2);
  } finally {
    sql.close();
  }
});

test("maintenance restyling endpoint rejects unauthenticated requests and GET mutations", async () => {
  assert.equal(
    (
      await worker.fetch(
        new Request("https://example.test/api/internal/result-posts", {
          method: "POST",
        }),
        env,
        {},
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request("https://example.test/api/internal/result-posts"),
        env,
        {},
      )
    ).status,
    405,
  );
});

test("presentations correctly distinguish demotions, retention, reset, public score and unlinked identities", () => {
  const r = {
    id: "r",
    uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    name: "Player",
    tier: 3,
    pos: 0,
    record_type: "test",
    mode: "mace",
    region: "EU",
    tester: "50001",
    created: new Date().toISOString(),
  };
  const demotion = resultAnnouncement(
    r,
    { previous: { tier: 2, pos: 0 }, peak: { tier: 2, pos: 0 }, score: "10-6" },
    { DISCORD_RESULT_PING_ROLE_ID: "@everyone" },
  );
  assert.match(demotion.embeds[0].description, /DEMOTED/);
  assert.doesNotMatch(demotion.embeds[0].description, /PROMOTED/);
  assert.equal(
    demotion.embeds[0].fields.find((f) => f.name === "Final score").value,
    "10-6",
  );
  assert.deepEqual(demotion.allowed_mentions, {
    parse: [],
    users: [],
    roles: [],
  });
  assert.match(
    resultAnnouncement(r, { previous: r }).embeds[0].description,
    /RANK RETAINED/,
  );
  assert.match(
    resultAnnouncement({ ...r, record_type: "reset" }, { previous: r })
      .embeds[0].description,
    /PLACEMENT RESET/,
  );
});
