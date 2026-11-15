import test from "node:test";
import assert from "node:assert/strict";
import {
  commandRequirement,
  canUseCommand,
} from "../config/command-policy.mjs";
import { validateRoleChange, accountCreatedAt } from "../cloud/staff-tools.mjs";
import { communityCommands } from "../discord/community-commands.mjs";
import { runStaffTool } from "../cloud/staff-tools.mjs";
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import { CloudStore } from "../cloud/store.mjs";
import config from '../config/community.json' with {type:'json'};
import { testingHubPanel } from '../cloud/platform-panels.mjs';

test('specialist security and role staff do not inherit unrelated moderator powers',()=>{
  const original=config.staffToolRoles;
  try{
    config.staffToolRoles={security:['71000'],roles:['72000']};
    assert.equal(canUseCommand(member('50000',['71000']),env,{name:'alt-check'}),true);
    assert.equal(canUseCommand(member('50000',['71000']),env,{name:'add-role'}),false);
    assert.equal(canUseCommand(member('50000',['72000']),env,{name:'add-role'}),true);
    assert.equal(canUseCommand(member('50000',['72000']),env,{name:'timeout'}),false);
  }finally{config.staffToolRoles=original;}
});

test('public testing hub stays concise and retains its managed panel marker',async()=>{
  const body=await testingHubPanel({one:async query=>query.includes('platform_settings')?null:{verified:4,completedTests:2,openQueues:0,waiting:0,activeTests:0}});
  assert.ok(body.embeds[0].description.length<150);
  assert.match(body.embeds[0].footer.text,/Mace Community/);
});

const env = {
  DISCORD_GUILD_ID: "20000",
  DISCORD_OWNER_ID: "30000",
  MODERATOR_ROLE_ID: "40000",
};
const member = (id = "60000", roles = []) => ({
  member: { user: { id }, roles, permissions: "0" },
});
test("every registered command has an explicit access policy, including its subcommands", () => {
  for (const command of communityCommands) {
    const variants = command.options?.filter((o) => o.type === 1) || [];
    for (const sub of variants.length ? variants : [null])
      assert.notEqual(
        commandRequirement({ name: command.name, options: sub ? [sub] : [] }),
        undefined,
        command.name + "/" + sub?.name,
      );
  }
  assert.equal(canUseCommand(member(), env, { name: "alt-check" }), false);
  assert.equal(
    canUseCommand(member("50000", ["40000"]), env, { name: "alt-check" }),
    true,
  );
  assert.equal(
    canUseCommand(member("50000", ["40000"]), env, {
      name: "staff",
      options: [{ type: 1, name: "assign" }],
    }),
    false,
  );
  assert.equal(
    canUseCommand(member("30000"), env, {
      name: "staff",
      options: [{ type: 1, name: "assign" }],
    }),
    true,
  );
  assert.equal(
    canUseCommand(member(), env, { name: "nonexistent-command" }),
    false,
  );
});
test("role tools refuse privilege escalation, managed roles, earned tiers and hierarchy bypasses", () => {
  const roles = [
    { id: "20000", position: 0, permissions: "0", name: "@everyone" },
    { id: "70000", position: 2, permissions: "0", name: "Test Alerts" },
    { id: "40000", position: 8, permissions: "0", name: "Moderator" },
    {
      id: "90000",
      position: 10,
      permissions: "268435456",
      name: "Bot",
      managed: true,
    },
  ];
  const base = {
    roles,
    role: roles[1],
    actorRoles: ["40000"],
    botRoles: ["90000"],
    targetRoles: [],
    guild: "20000",
    owner: "30000",
    actor: "50000",
    target: "60000",
  };
  assert.doesNotThrow(() => validateRoleChange(base));
  for (const role of [
    { ...roles[1], permissions: "8" },
    { ...roles[1], managed: true },
    { ...roles[1], name: "HT1" },
    { ...roles[1], name: "Security Analyst" },
    { ...roles[1], position: 8 },
  ])
    assert.throws(
      () => validateRoleChange({ ...base, role }),
      /protected|managed|hierarchy|earned/i,
    );
  assert.throws(
    () => validateRoleChange({ ...base, target: "30000" }),
    /owner/i,
  );
  assert.throws(
    () => validateRoleChange({ ...base, targetRoles: ["40000"] }),
    /hierarchy/i,
  );
});
test("Discord account age is derived from the snowflake without guessing account relationships", () => {
  assert.equal(
    accountCreatedAt("175928847299117063"),
    "2016-04-30T11:18:25.796Z",
  );
  assert.throws(() => accountCreatedAt("invalid"), /valid/i);
});

async function staffFixture() {
  const sql = new DatabaseSync(":memory:");
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    sql.exec(await readFile("drizzle/" + file, "utf8"));
  const db = {
    prepare(query) {
      const make = (values = []) => ({
        bind: (...args) => make(args),
        first: async () => sql.prepare(query).get(...values) || null,
        all: async () => ({ results: sql.prepare(query).all(...values) }),
        run: async () => ({ meta: sql.prepare(query).run(...values) }),
      });
      return make();
    },
  };
  return { sql, store: new CloudStore(db) };
}
const staffInteraction = (name, values = {}, actor = "50000") => ({
  ...member(actor, ["40000"]),
  channel_id: "80000",
  data: {
    name,
    options: Object.entries(values).map(([name, value]) => ({ name, value })),
  },
});
test("alt-check distinguishes inaccessible bans from no bans and never reports a proven alt", async () => {
  const { sql, store } = await staffFixture();
  try {
    const request = async (url) =>
      url.includes("/bans/")
        ? Response.json({ message: "Missing Permissions" }, { status: 403 })
        : Response.json({ joined_at: "2025-01-01T00:00:00Z" });
    const body = await runStaffTool(
      staffInteraction("alt-check", { user: "175928847299117063" }),
      { ...env, DISCORD_CLIENT_ID: "90000" },
      store,
      request,
    );
    const text = JSON.stringify(body);
    assert.match(text, /Alt relationship: unknown/);
    assert.match(text, /Unavailable/);
    assert.doesNotMatch(text, /No ban found/);
    assert.deepEqual(body.allowed_mentions, { parse: [] });
    assert.equal(
      (
        await store.one(
          "SELECT count(*) n FROM audit WHERE action='account-signal-check'",
        )
      ).n,
      1,
    );
    let called = false;
    await assert.rejects(
      runStaffTool(
        {
          ...staffInteraction("alt-check", { user: "175928847299117063" }),
          ...member(),
        },
        env,
        store,
        async () => {
          called = true;
        },
      ),
      /security/,
    );
    assert.equal(called, false);
  } finally {
    sql.close();
  }
});
test("role changes verify the actual member after the targeted role endpoint and preserve unrelated roles", async () => {
  const { sql, store } = await staffFixture();
  try {
    let given = false;
    const mutations = [];
    const roles = [
      { id: "20000", position: 0, permissions: "0", name: "@everyone" },
      { id: "70000", position: 2, permissions: "0", name: "Test Alerts" },
      { id: "40000", position: 8, permissions: "0", name: "Moderator" },
      {
        id: "90000",
        position: 10,
        permissions: "268435456",
        name: "Bot",
        managed: true,
      },
    ];
    const request = async (url, o) => {
      if (o.method === "PUT") {
        mutations.push(url);
        given = true;
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/roles")) return Response.json(roles);
      if (url.endsWith("/members/90000"))
        return Response.json({ roles: ["90000"] });
      if (url.endsWith("/members/50000"))
        return Response.json({ roles: ["40000"] });
      if (url.endsWith("/members/60000"))
        return Response.json({ roles: given ? ["65000", "70000"] : ["65000"] });
      if (url.endsWith("/channels")) return Response.json([]);
      return Response.json({ owner_id: "30000" });
    };
    await runStaffTool(
      staffInteraction("add-role", {
        user: "60000",
        role: "70000",
        reason: "Member requested the test alert role",
      }),
      { ...env, DISCORD_CLIENT_ID: "90000" },
      store,
      request,
    );
    assert.deepEqual(mutations, [
      "https://discord.com/api/v10/guilds/20000/members/60000/roles/70000",
    ]);
    assert.equal(
      (
        await store.one(
          "SELECT count(*) n FROM audit WHERE action='role-added'",
        )
      ).n,
      1,
    );
  } finally {
    sql.close();
  }
});
test("channel unlock restores only the saved send bit and preserves permission changes made while locked", async () => {
  const { sql, store } = await staffFixture();
  try {
    const channel = {
      id: "80000",
      guild_id: "20000",
      type: 0,
      permission_overwrites: [{ id: "20000", allow: "1024", deny: "0" }],
    };
    const request = async (url, o) => {
      if (o.method === "GET") return Response.json(channel);
      const body = JSON.parse(o.body);
      channel.permission_overwrites = [{ id: "20000", ...body }];
      return new Response(null, { status: 204 });
    };
    const args = { reason: "Temporarily pause the channel discussion" };
    await runStaffTool(staffInteraction("lock", args), env, store, request);
    assert.ok(BigInt(channel.permission_overwrites[0].deny) & 2048n);
    channel.permission_overwrites[0].deny = String(
      BigInt(channel.permission_overwrites[0].deny) | 32768n,
    );
    await runStaffTool(staffInteraction("unlock", args), env, store, request);
    assert.equal(channel.permission_overwrites[0].allow, "1024");
    assert.equal(channel.permission_overwrites[0].deny, "32768");
    assert.equal(
      await store.one(
        "SELECT * FROM platform_settings WHERE key='channel-lock:80000'",
      ),
      null,
    );
  } finally {
    sql.close();
  }
});
