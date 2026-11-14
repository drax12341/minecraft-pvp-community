import test from "node:test";
import assert from "node:assert/strict";
import {
  lookupMinecraftAccount,
  minecraftVerificationHealth,
} from "../cloud/minecraft-lookup.mjs";
test("each official provider receives an independent timeout and normalized Java username", async () => {
  const signals = [];
  const result = await lookupMinecraftAccount(
    " PlayerOne ",
    async (url, options) => {
      signals.push(options.signal);
      assert.ok(url.endsWith("/PlayerOne"));
      if (signals.length === 1)
        throw new DOMException("Timed out", "TimeoutError");
      return Response.json({ id: "a".repeat(32), name: "PlayerOne" });
    },
  );
  assert.ok(result.profile);
  assert.notEqual(signals[0], signals[1]);
  assert.equal(result.attempts[0].outcome, "timeout");
});
test("blocked or malformed upstream responses are not presented as a wrong username", async () => {
  const blocked = await lookupMinecraftAccount(
    "PlayerOne",
    async () => new Response("Forbidden", { status: 403 }),
  );
  assert.equal(blocked.reason, "unavailable");
  const missing = await lookupMinecraftAccount(
    "PlayerOne",
    async () => new Response(null, { status: 404 }),
  );
  assert.equal(missing.reason, "not-found");
  const malformed = await lookupMinecraftAccount(
    "PlayerOne",
    async () => new Response("<html>Gateway</html>"),
  );
  assert.equal(malformed.reason, "unavailable");
  assert.equal(malformed.attempts[0].outcome, "invalid-json");
});
test("diagnostic probes the deployed verification dependencies without creating an account", async () => {
  const health = await minecraftVerificationHealth("PlayerOne", async (url) =>
    url.includes("sessionserver")
      ? Response.json({
          id: "a".repeat(32),
          name: "PlayerOne",
          properties: [{ name: "textures" }],
        })
      : Response.json({ id: "a".repeat(32), name: "PlayerOne" }),
  );
  assert.equal(health.profile.name, "PlayerOne");
  assert.equal(health.textureProbe[0].uuidMatches, true);
  assert.equal(health.textureProbe[0].source, "mojang");
});
