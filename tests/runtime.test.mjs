import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startCommunity } from "../server/runtime.mjs";

test("runtime recovers a crashed bot and keeps its private API off public ingress", async () => {
  const directory = await mkdtemp(join(tmpdir(), "community-runtime-"));
  const marker = join(directory, "starts");
  const options = {
    env: {
      ...process.env,
      RAILWAY_ENVIRONMENT_ID: "",
      PORT: "0",
      RUNTIME_HOST: "127.0.0.1",
      DISCORD_TOKEN: "test-only",
      DISCORD_CLIENT_ID: "12345",
      DISCORD_GUILD_ID: "12345",
      TESTER_ROLE_ID: "12345",
      MODERATOR_ROLE_ID: "12345",
      ADMIN_TOKEN: "x".repeat(64),
      DATABASE_PATH: join(directory, "persistent", "community.sqlite"),
      RUNTIME_TEST_MARKER: marker,
    },
    botPath: fileURLToPath(
      new URL("./fixtures/runtime-bot.mjs", import.meta.url),
    ),
    restartDelay: 30,
  };
  let runtime;
  try {
    await assert.rejects(
      startCommunity({
        ...options,
        env: {
          ...options.env,
          RAILWAY_ENVIRONMENT_ID: "test",
          RAILWAY_VOLUME_MOUNT_PATH: "",
        },
      }),
      /Attach a persistent volume/,
    );
    runtime = await startCommunity(options);
    const url = `http://127.0.0.1:${runtime.port}`;
    const deadline = Date.now() + 10000;
    while (true) {
      const count = Number(await readFile(marker, "utf8").catch(() => "0"));
      const health = await fetch(url + "/healthz");
      if (count >= 2 && health.ok) break;
      assert.ok(Date.now() < deadline, "bot did not recover after crash");
      await new Promise((done) => setTimeout(done, 40));
    }
    assert.equal((await fetch(url + "/api/queue")).status, 404);
    await new Promise((done) => setTimeout(done, 400));
    assert.equal(
      Number(await readFile(marker, "utf8")),
      2,
      "recovered bot should stay running",
    );
    assert.equal(
      (await fetch(url + "/api/verify", { method: "POST" })).status,
      405,
    );
    const feed = await (await fetch(url + "/data/results.json")).json();
    assert.deepEqual(feed.players, []);
    assert.ok((await readFile(options.env.DATABASE_PATH)).length > 0);
    await runtime.close();
    runtime = undefined;
    runtime = await startCommunity(options);
    assert.equal(
      (await fetch(`http://127.0.0.1:${runtime.port}/data/testing.json`))
        .status,
      200,
    );
  } finally {
    await runtime?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
