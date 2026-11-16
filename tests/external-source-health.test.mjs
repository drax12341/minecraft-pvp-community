import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloud/worker.mjs";

test("source diagnostics require service authentication and expose no private guild data or credentials", async () => {
  const token = "diagnostic-test-secret-".repeat(3);
  const env = { DISCORD_TOKEN: token, DISCORD_GUILD_ID: "20000" };
  const url = "https://community.example/api/internal/account-review-health";
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, "manual");
    if (url.includes("discord.com"))
      return Response.json([
        { id: "20000", name: "Local", permissions: "8" },
        {
          id: "123456789123456789",
          name: "Private partner name",
          permissions: "0",
        },
      ]);
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({
      uuid: "06ec3577-3299-45fa-bbdf-613b1f86c8ab",
      rankings: {},
    });
  };
  try {
    const denied = await worker.fetch(new Request(url), env, {});
    assert.equal(denied.status, 401);
    const method = await worker.fetch(
      new Request(url, { method: "POST" }),
      env,
      {},
    );
    assert.equal(method.status, 405);
    assert.equal(calls.length, 0);
    const response = await worker.fetch(
      new Request(url, { headers: { Authorization: "Bearer " + token } }),
      env,
      {},
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.equal(body.discord.status, "ok");
    assert.equal(body.discord.otherServers, 1);
    assert.equal(body.profiles.length, 3);
    assert.ok(body.profiles.every((p) => p.status === "profile-found"));
    assert.equal(calls.length, 5);
    assert.doesNotMatch(
      JSON.stringify(body),
      /Private partner name|123456789123456789|diagnostic-test-secret/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
