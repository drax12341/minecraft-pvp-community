import test from "node:test";
import assert from "node:assert/strict";
import { tierNetworkChecks } from "../cloud/tier-networks.mjs";
import { reviewPresentation } from "../cloud/review-presentation.mjs";
import { readNetworkReferences } from "../cloud/network-references.mjs";
import { securityDeskOverwrites } from "../discord/community-v4.mjs";
import { componentRoute } from "../cloud/components.mjs";

test("security desk excludes everyone and routes its member picker through the protected review handler", () => {
  const grants = securityDeskOverwrites("20000", "90000", ["70000", "70000"]);
  assert.equal(grants.length, 3);
  assert.equal(grants[0].allow, "0");
  assert.equal(BigInt(grants[0].deny) & 1024n, 1024n);
  assert.equal(grants.find((g) => g.id === "70000").type, 0);
  const routed = componentRoute({
    type: 3,
    data: { custom_id: "review:choose", values: ["519370708107919370"] },
  }).command;
  assert.equal(routed.data.name, "alt-check");
  assert.equal(
    routed.data.options.find((o) => o.name === "view").value,
    "overview",
  );
});

test("authorized moderation messages produce cited references, including reversals, and never a current-ban verdict", async () => {
  const request = async (url) =>
    url.includes("/guilds/")
      ? Response.json([
          { id: "70000", type: 0, name: "punishments" },
          { id: "71000", type: 0, name: "general" },
        ])
      : Response.json([
          {
            id: "80000",
            content: "Unbanned <@519370708107919370> after appeal.",
            mentions: [{ id: target }],
            timestamp: "2026-11-16T12:00:00Z",
          },
          {
            id: "80001",
            content: "Banned <@5193707081079193701>",
            mentions: [],
          },
        ]);
  const result = await readNetworkReferences(
    { DISCORD_TOKEN: "test" },
    target,
    account,
    ["1317975081976332338"],
    request,
  );
  assert.equal(result.channelsRead, 1);
  assert.equal(result.references.length, 1);
  assert.match(result.references[0].excerpt, /Unbanned/);
  assert.match(result.references[0].url, /\/70000\/80000$/);
  assert.equal(result.findings, undefined);
});
test("network message reader never requests a private guild absent from bot membership", async () => {
  let calls = 0;
  const result = await readNetworkReferences(
    { DISCORD_TOKEN: "test" },
    target,
    account,
    [],
    async () => {
      calls++;
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.channelsRead, 0);
  assert.equal(result.references.length, 0);
});

const account = {
    uuid: "06ec3577-3299-45fa-bbdf-613b1f86c8ab",
    name: "ItzRealMe",
  },
  target = "519370708107919370";
test("Workers-compatible requests return UUID-matched profiles, while failed APIs retain useful diagnostics", async () => {
  const result = await tierNetworkChecks(
    account,
    target,
    async (url, options) => {
      if (options.redirect === "error")
        throw new TypeError("Unsupported redirect mode: error");
      if (url.includes("pvptiers"))
        return new Response("Rate limit", { status: 429 });
      if (url.includes("subtiers"))
        throw new DOMException("Secret diagnostic", "TimeoutError");
      return Response.json({
        uuid: account.uuid,
        discord_id: target,
        rankings: {},
      });
    },
  );
  assert.equal(result[0].status, "profile-found");
  assert.match(result[1].failure, /429/);
  assert.match(result[2].failure, /timed out/i);
  assert.doesNotMatch(JSON.stringify(result), /Secret diagnostic/);
});

test("failed source coverage never claims absent Discord links, zero connected guilds or zero successful readings", () => {
  const external = {
    findings: [],
    sources: [],
    discoveryStatus: "unavailable",
    discoveredDiscordGuilds: null,
    installedDiscordGuildIds: [],
    checkedAt: new Date().toISOString(),
    messageReading: { references: [], channelsRead: 0, unavailable: 0 },
  };
  const profiles = ["mctiers", "pvptiers", "subtiers"].map((id) => ({
    id,
    status: "unavailable",
    failure: "HTTP 503",
  }));
  const base = { embeds: [{ fields: [] }] };
  const networks = reviewPresentation(
    base,
    external,
    profiles,
    target,
    "networks",
  );
  assert.match(JSON.stringify(networks), /503/);
  assert.match(JSON.stringify(networks), /not checked/i);
  assert.doesNotMatch(JSON.stringify(networks), /not published|0\/0|0\/6/);
  const evidence = reviewPresentation(
    base,
    external,
    profiles,
    target,
    "evidence",
  );
  assert.match(JSON.stringify(evidence), /not run/i);
  assert.doesNotMatch(JSON.stringify(evidence), /0 channel\(s\) read/);
  const overview = reviewPresentation(base, external, profiles, target);
  assert.equal(
    overview.embeds[1].fields.find((f) => f.name === "Other Bot Servers").value,
    "Unknown · discovery failed",
  );
});

test("network profiles require exact UUID matches and disclose linked Discord differences without inferring bans", async () => {
  const request = async (url, options) => {
    assert.equal(options.headers?.Authorization, undefined);
    return Response.json({
      uuid: account.uuid,
      name: account.name,
      discord_id: url.includes("mctiers.net") ? target : "60000",
      points: 30,
      overall: 4,
      rankings: { mace: { tier: 3, pos: 0 } },
    });
  };
  const result = await tierNetworkChecks(account, target, request);
  assert.equal(result.length, 3);
  assert.equal(
    result.find((r) => r.name === "MCTiers").identity,
    "discord-match",
  );
  assert.equal(
    result.find((r) => r.name === "SubTiers").identity,
    "different-discord",
  );
  assert.ok(result.every((r) => r.banStatus === "not-provided"));
  assert.ok(result.every((r) => r.modeCount === 1));
});
test("same-name profiles with a different UUID are rejected; unlinked subjects trigger no external name guesses", async () => {
  const result = await tierNetworkChecks(account, target, async () =>
    Response.json({
      uuid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      name: account.name,
      rankings: { mace: { tier: 1, pos: 0 } },
    }),
  );
  assert.ok(result.every((r) => r.status === "identity-mismatch"));
  assert.ok(result.every((r) => r.modeCount === undefined));
  let calls = 0;
  const unlinked = await tierNetworkChecks(null, target, async () => {
    calls++;
  });
  assert.equal(calls, 0);
  assert.ok(unlinked.every((r) => r.status === "identity-required"));
});
test("compact review keeps full stats behind authorized view buttons and fits Discord message limits", () => {
  const base = {
    content: "",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "Account Intelligence",
        description: "Subject",
        fields: [
          { name: "Account Age", value: "20 days" },
          { name: "Local Ban", value: "No ban found" },
          { name: "Minecraft IGN", value: "Player" },
        ],
      },
      { title: "Activity", fields: [{ name: "Official Tests", value: "3" }] },
    ],
  };
  const external = {
    findings: [],
    sources: [],
    discoveredDiscordGuilds: 0,
    installedDiscordGuildIds: [],
    checkedAt: new Date().toISOString(),
  };
  const body = reviewPresentation(base, external, [], target, "overview");
  assert.ok(body.embeds.length <= 2);
  assert.equal(body.components[0].components.length, 4);
  assert.ok(
    body.components[0].components.every((b) => b.custom_id.includes(target)),
  );
  const stats = reviewPresentation(base, external, [], target, "stats");
  assert.equal(stats.embeds[1].fields[0].name, "Official Tests");
  assert.deepEqual(stats.allowed_mentions, { parse: [] });
});
