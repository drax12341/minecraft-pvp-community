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

test("cloud commands authorize server owner, reject ordinary members and update only zero-permission interest roles", async () => {
  const { sql, store } = await database();
  try {
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
