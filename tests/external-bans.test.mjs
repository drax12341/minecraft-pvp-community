import test from "node:test";
import assert from "node:assert/strict";
import {
  externalBanChecks,
  externalBanEmbed,
  externalJSON,
} from "../cloud/external-bans.mjs";

const env = { DISCORD_GUILD_ID: "20000", DISCORD_TOKEN: "test-token" };
const target = "175928847299117063",
  account = {
    name: "TestPlayer",
    uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  };
test("external requests run on Workers and block redirects without forwarding bot credentials", async () => {
  const calls = [];
  const request = async (url, options) => {
    if (options.redirect === "error")
      throw new TypeError("Unsupported redirect mode: error");
    calls.push({ url, options });
    return new Response("<html>Redirecting</html>", {
      status: 302,
      headers: { Location: "https://other.example" },
    });
  };
  const result = await externalJSON(
    request,
    "https://discord.com/api/v10/users/@me/guilds?limit=100",
    { Authorization: "Bot secret" },
  );
  assert.equal(result.status, 302);
  assert.equal(result.body, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.redirect, "manual");
});

test("failed discovery is unknown, never evidence that the bot is installed in only one server", async () => {
  const report = await externalBanChecks(
    env,
    target,
    account,
    async () => new Response("Upstream error", { status: 503 }),
  );
  assert.equal(report.discoveryStatus, "unavailable");
  assert.equal(report.discoveredDiscordGuilds, null);
  assert.match(report.sources[0].failure, /503/);
  const embed = externalBanEmbed(report);
  assert.match(embed.description, /discovery failed/i);
  assert.doesNotMatch(
    embed.description,
    /only in this community|0 other bot server/,
  );
  assert.match(embed.fields[0].value, /503/);
});

test("external JSON distinguishes HTML failures, invalid JSON, timeouts and oversized responses", async () => {
  assert.equal(
    (
      await externalJSON(
        async () => new Response("Denied", { status: 403 }),
        "https://source.example",
      )
    ).status,
    403,
  );
  await assert.rejects(
    externalJSON(
      async () => new Response("<html>Blocked</html>"),
      "https://source.example",
    ),
    SyntaxError,
  );
  await assert.rejects(
    externalJSON(
      async () => new Response("x".repeat(131073)),
      "https://source.example",
    ),
    /too large/,
  );
  const report = await externalBanChecks(env, target, account, async () => {
    throw new DOMException("private request information", "TimeoutError");
  });
  assert.match(report.sources[0].failure, /timed out/i);
  assert.doesNotMatch(JSON.stringify(report), /private request information/);
});

test("cross-server checks preserve source evidence and distinguish no ban, no access and API failures", async () => {
  const request = async (url, options) => {
    if (url.endsWith("/users/@me/guilds?limit=100"))
      return Response.json([
        { id: "20000", name: "Local", permissions: "8" },
        { id: "30000", name: "Partner", permissions: "128" },
        { id: "40000", name: "Private", permissions: "0" },
      ]);
    if (url.includes("/guilds/30000/bans/"))
      return Response.json({
        user: { id: target },
        reason: "Cheating review · case 42",
      });
    if (url.includes("pvphq.com")) {
      assert.equal(options.headers?.Authorization, undefined);
      return Response.json({
        uuid: account.uuid,
        name: "TestPlayer",
        stats: { wins: 12 },
        ranked: [],
      });
    }
    throw Error("Unexpected request " + url);
  };
  const report = await externalBanChecks(env, target, account, request);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].source, "Partner");
  assert.equal(report.findings[0].reason, "Cheating review · case 42");
  assert.equal(
    report.sources.find((s) => s.name === "Private").status,
    "no-access",
  );
  assert.equal(
    report.sources.find((s) => s.name === "PvPHQ").status,
    "ban-data-unavailable",
  );
  assert.ok(!report.sources.some((s) => s.status === "clean"));
});
test("HTTP 403 and unrelated 404 errors never become clean ban checks; UUID mismatches never attach profile data", async () => {
  const request = async (url) => {
    if (url.endsWith("/users/@me/guilds?limit=100"))
      return Response.json([
        { id: "30000", name: "Partner", permissions: "4" },
        { id: "40000", name: "Gone", permissions: "4" },
      ]);
    if (url.includes("/guilds/30000/"))
      return Response.json({ code: 50013 }, { status: 403 });
    if (url.includes("/guilds/40000/"))
      return Response.json({ code: 10004 }, { status: 404 });
    return Response.json({
      uuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name: account.name,
      stats: { wins: 999 },
    });
  };
  const report = await externalBanChecks(env, target, account, request);
  assert.equal(report.findings.length, 0);
  assert.equal(
    report.sources.find((s) => s.name === "PvPHQ").status,
    "identity-mismatch",
  );
  assert.equal(
    report.sources.find((s) => s.name === "Partner").status,
    "no-access",
  );
  assert.notEqual(
    report.sources.find((s) => s.name === "Gone").status,
    "no-ban",
  );
});
test("only Discord Unknown Ban counts as no current ban, and unlinked users never send guessed usernames to external services", async () => {
  const calls = [];
  const request = async (url) => {
    calls.push(url);
    return url.endsWith("/users/@me/guilds?limit=100")
      ? Response.json([{ id: "30000", name: "Partner", permissions: "4" }])
      : Response.json({ code: 10026 }, { status: 404 });
  };
  const report = await externalBanChecks(env, target, null, request);
  assert.equal(
    report.sources.find((s) => s.name === "Partner").status,
    "no-ban",
  );
  assert.equal(calls.length, 2);
  assert.equal(
    report.sources.find((s) => s.name === "PvPHQ").status,
    "identity-required",
  );
});

test("large source evidence stays inside the shared Discord embed text budget", () => {
  const now = new Date().toISOString(),
    report = {
      findings: Array.from({ length: 10 }, (_, n) => ({
        source: "Source " + n,
        subject: target,
        reason: "x".repeat(300),
        checkedAt: now,
      })),
      sources: Array.from({ length: 13 }, (_, n) => ({
        name: "Source " + n,
        kind: "discord",
        status: "ban-found",
      })),
      discoveredDiscordGuilds: 10,
      truncated: true,
      checkedAt: now,
    };
  const embed = externalBanEmbed(report);
  const size =
    embed.title.length +
    embed.description.length +
    embed.footer.text.length +
    embed.fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0);
  assert.ok(size < 2600);
  assert.match(embed.footer.text, /omitted/);
  assert.match(embed.fields[0].name, /Ban Evidence/);
});
