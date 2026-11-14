import test from "node:test";
test("username resolution recovers from HTML/provider outages using the alternate official endpoint", async () => {
  const { sql, store } = await database();
  try {
    let calls = 0;
    const challenge = await beginVerification(
      store,
      "60000",
      "PlayerOne",
      async () => {
        calls++;
        return calls === 1
          ? new Response("<html>Temporary gateway error</html>", {
              headers: { "Content-Type": "text/html" },
            })
          : Response.json({ id: "a".repeat(32), name: "PlayerOne" });
      },
    );
    assert.equal(challenge.name, "PlayerOne");
    assert.equal(calls, 2);
  } finally {
    sql.close();
  }
});
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import { CloudStore } from "../cloud/store.mjs";
import { beginVerification, tokenHash } from "../cloud/verification.mjs";
import {
  createVerificationSkin,
  matchesVerificationSkin,
  checkSkinVerification,
  verificationDownload,
} from "../cloud/skin-verification.mjs";
import { runCommand } from "../cloud/commands.mjs";
import { componentRoute } from "../cloud/components.mjs";
import { crc32, deflateSync, inflateSync } from "node:zlib";
import { drainOutbox } from "../cloud/delivery.mjs";
test("verification role delivery discovers the installed role even without an environment override", async () => {
  const { sql, store } = await database();
  try {
    await store
      .statement(
        "INSERT INTO guild_resources VALUES(?,?,?,?)",
        "role:verified",
        "70000",
        "role",
        new Date().toISOString(),
      )
      .run();
    await store
      .statement(
        "INSERT INTO outbox_events(kind,subject,available_at,created) VALUES('verified-role','60000',?,?)",
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
    const calls = [];
    const sent = await drainOutbox(
      store,
      env,
      async (url, options) => {
        calls.push({ url, method: options?.method });
        return url.endsWith("/roles")
          ? Response.json([{ id: "70000", permissions: "0", managed: false }])
          : new Response(null, { status: 204 });
      },
      1,
    );
    assert.equal(
      (await store.one("SELECT status FROM outbox_events")).status,
      "done",
    );
    assert.ok(
      calls.some(
        (c) =>
          c.url.endsWith("/members/60000/roles/70000") && c.method === "PUT",
      ),
    );
  } finally {
    sql.close();
  }
});
const env = {
  DISCORD_CLIENT_ID: "10000",
  DISCORD_GUILD_ID: "20000",
  DISCORD_OWNER_ID: "30000",
  DISCORD_TOKEN: "test-only",
};
async function database() {
  const sql = new DatabaseSync(":memory:");
  for (const f of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    sql.exec(await readFile("drizzle/" + f, "utf8"));
  const db = {
    prepare(q) {
      const make = (v = []) => ({
        bind: (...a) => make(a),
        first: async () => sql.prepare(q).get(...v) || null,
        all: async () => ({ results: sql.prepare(q).all(...v) }),
        run: async () => ({ meta: sql.prepare(q).run(...v) }),
      });
      return make();
    },
    async batch(statements) {
      sql.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        sql.exec("COMMIT");
        return results;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { sql, store: new CloudStore(db) };
}
const interaction = (user, sub, values = {}) => ({
  id: crypto.randomUUID(),
  application_id: env.DISCORD_CLIENT_ID,
  guild_id: env.DISCORD_GUILD_ID,
  member: { user: { id: user }, roles: [], permissions: "0" },
  data: {
    name: "verify",
    options: [
      {
        type: 1,
        name: sub,
        options: Object.entries(values).map(([name, value]) => ({
          name,
          value,
        })),
      },
    ],
  },
});
test("verification skins are valid PNGs bound to one unpredictable challenge", async () => {
  const a = await tokenHash("challenge-a"),
    b = await tokenHash("challenge-b"),
    png = await createVerificationSkin(a);
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(await matchesVerificationSkin(png, a), true);
  assert.equal(await matchesVerificationSkin(png, b), false);
  await assert.rejects(matchesVerificationSkin(new Uint8Array(20), a), /PNG/);
});
test("ownership pixels survive PNG recompression and every standard RGB/RGBA scanline filter", async () => {
  const hash = await tokenHash("canonical-png"),
    png = Buffer.from(await createVerificationSkin(hash));
  const idat = [];
  for (let o = 8; o < png.length;) {
    const n = png.readUInt32BE(o),
      type = png.toString("ascii", o + 4, o + 8);
    if (type === "IDAT") idat.push(png.subarray(o + 8, o + 8 + n));
    o += n + 12;
  }
  const original = inflateSync(Buffer.concat(idat));
  const chunk = (type, bytes) => {
    const b = Buffer.alloc(bytes.length + 12);
    b.writeUInt32BE(bytes.length);
    b.write(type, 4);
    bytes.copy(b, 8);
    b.writeUInt32BE(crc32(b.subarray(4, -4)), b.length - 4);
    return b;
  };
  const paeth = (a, b, c) => {
    const p = a + b - c,
      d = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)],
      m = Math.min(...d);
    return d[0] === m ? a : d[1] === m ? b : c;
  };
  for (const channels of [3, 4])
    for (let filter = 0; filter < 5; filter++) {
      const stride = 64 * channels,
        pixels = Buffer.alloc(stride * 64);
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 64; x++)
          for (let c = 0; c < channels; c++)
            pixels[y * stride + x * channels + c] =
              original[y * 257 + 1 + x * 4 + c];
      const raw = Buffer.alloc((stride + 1) * 64);
      for (let y = 0; y < 64; y++) {
        raw[y * (stride + 1)] = filter;
        for (let x = 0; x < stride; x++) {
          const a = x >= channels ? pixels[y * stride + x - channels] : 0,
            b = y ? pixels[(y - 1) * stride + x] : 0,
            c =
              y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0,
            predict =
              filter === 0
                ? 0
                : filter === 1
                  ? a
                  : filter === 2
                    ? b
                    : filter === 3
                      ? Math.floor((a + b) / 2)
                      : paeth(a, b, c);
          raw[y * (stride + 1) + 1 + x] =
            (pixels[y * stride + x] - predict) & 255;
        }
      }
      const header = Buffer.alloc(13);
      header.writeUInt32BE(64);
      header.writeUInt32BE(64, 4);
      header[8] = 8;
      header[9] = channels === 4 ? 6 : 2;
      const transformed = Buffer.concat([
        png.subarray(0, 8),
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0)),
      ]);
      assert.equal(
        await matchesVerificationSkin(transformed, hash),
        true,
        channels + " channels filter " + filter,
      );
    }
});
test("verification starts without any ownership-server configuration and check button routes correctly", async () => {
  const { sql, store } = await database();
  try {
    const message = await runCommand(
      interaction("60000", "start", { name: "PlayerOne" }),
      env,
      store,
      async () => Response.json({ id: "a".repeat(32), name: "PlayerOne" }),
    );
    assert.match(message.content, /temporary skin/i);
    assert.ok(
      message.components[0].components.some(
        (b) => b.label === "Check verification",
      ),
    );
    assert.equal((await store.one("SELECT count(*) n FROM accounts")).n, 0);
    const route = componentRoute({
      type: 3,
      data: { custom_id: "verify:check" },
      member: { user: { id: "60000" } },
    });
    assert.equal(route.command.data.options[0].name, "check");
  } finally {
    sql.close();
  }
});
test("skin proof checks the official UUID texture and finalizes once, including role delivery", async () => {
  const { sql, store } = await database();
  try {
    const challenge = await beginVerification(
      store,
      "60000",
      "PlayerOne",
      async () => Response.json({ id: "a".repeat(32), name: "PlayerOne" }),
    );
    await store
      .statement(
        "UPDATE account_challenges SET method='skin' WHERE user=?",
        "60000",
      )
      .run();
    const png = await createVerificationSkin(await tokenHash(challenge.code));
    const provider = async (url) =>
      url.includes("sessionserver.mojang.com")
        ? Response.json({
            id: "a".repeat(32),
            name: "PlayerOne",
            properties: [
              {
                name: "textures",
                value: btoa(
                  JSON.stringify({
                    profileId: "a".repeat(32),
                    textures: {
                      SKIN: {
                        url:
                          "http://textures.minecraft.net/texture/" +
                          "b".repeat(64),
                      },
                    },
                  }),
                ),
              },
            ],
          })
        : new Response(png, { headers: { "Content-Type": "image/png" } });
    const message = await checkSkinVerification(store, "60000", provider);
    assert.match(message.content, /VERIFIED/);
    assert.equal(
      (await store.one("SELECT verified_by FROM accounts")).verified_by,
      "skin-challenge",
    );
    assert.equal(
      (
        await store.one(
          "SELECT count(*) n FROM outbox_events WHERE kind='verified-role'",
        )
      ).n,
      1,
    );
    const repeated = await checkSkinVerification(store, "60000", provider);
    assert.match(repeated.content, /already verified/i);
    assert.equal((await store.one("SELECT count(*) n FROM accounts")).n, 1);
  } finally {
    sql.close();
  }
});
test("a wrong texture, foreign URL, replaced challenge and expired download never grant ownership", async () => {
  const { sql, store } = await database();
  try {
    const challenge = await beginVerification(
      store,
      "60000",
      "PlayerOne",
      async () => Response.json({ id: "a".repeat(32), name: "PlayerOne" }),
    );
    await store
      .statement(
        "UPDATE account_challenges SET method='skin' WHERE user=?",
        "60000",
      )
      .run();
    const response = () =>
      Response.json({
        id: "a".repeat(32),
        name: "PlayerOne",
        properties: [
          {
            name: "textures",
            value: btoa(
              JSON.stringify({
                profileId: "a".repeat(32),
                textures: { SKIN: { url: "https://evil.test/private" } },
              }),
            ),
          },
        ],
      });
    const denied = await checkSkinVerification(store, "60000", async () =>
      response(),
    );
    assert.match(denied.content, /not confirmed|retry|unavailable/i);
    assert.equal((await store.one("SELECT count(*) n FROM accounts")).n, 0);
    const downloaded = await verificationDownload(
      new Request(
        "https://example.test/verify/skin/" + challenge.code + ".png",
      ),
      store,
    );
    assert.equal(downloaded.status, 200);
    await store
      .statement(
        "UPDATE account_challenges SET expires='2000-01-01T00:00:00.000Z'",
      )
      .run();
    assert.equal(
      (
        await verificationDownload(
          new Request(
            "https://example.test/verify/skin/" + challenge.code + ".png",
          ),
          store,
        )
      ).status,
      410,
    );
  } finally {
    sql.close();
  }
});
