import { REST } from "discord.js";
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { CloudStore } from "../cloud/store.mjs";
import { setupWizard } from "../cloud/setup-wizard.mjs";
const host = "https://minecraft-pvp-community.draxion0.chatgpt.site";
const env = process.env;
if (
  env.DISCORD_GUILD_ID !== "1568767259168608267" ||
  !env.DISCORD_TOKEN ||
  !env.DISCORD_CLIENT_ID
)
  throw Error("Expected community bot environment is required.");
const endpoint = host + "/api/internal/installation";
const control = async (method, body) => {
  const r = await fetch(endpoint, {
    method,
    headers: {
      Authorization: "Bearer " + env.DISCORD_TOKEN,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw Error("Installation API HTTP " + r.status);
  return r.json();
};
const snapshot = await control("GET");
await mkdir(".runtime", { recursive: true });
await writeFile(
  ".runtime/platform-before-" + Date.now() + ".json",
  JSON.stringify(snapshot, null, 2),
);
const sql = new DatabaseSync(":memory:");
for (const file of (await readdir("drizzle"))
  .filter((f) => /^\d+.*\.sql$/.test(f))
  .sort())
  sql.exec(await readFile("drizzle/" + file, "utf8"));
const adapter = {
  prepare(query) {
    const make = (args = []) => ({
      bind: (...values) => make(values),
      first: async () => sql.prepare(query).get(...args) || null,
      all: async () => ({ results: sql.prepare(query).all(...args) }),
      run: async () => ({ meta: sql.prepare(query).run(...args) }),
    });
    return make();
  },
  async batch(statements) {
    sql.exec("BEGIN IMMEDIATE");
    try {
      const out = [];
      for (const s of statements) out.push(await s.run());
      sql.exec("COMMIT");
      return out;
    } catch (e) {
      sql.exec("ROLLBACK");
      throw e;
    }
  },
};
const store = new CloudStore(adapter),
  one = store.one.bind(store);
store.one = async (query, ...args) =>
  query.includes("(SELECT count(*) FROM accounts) verified")
    ? snapshot.statistics
    : one(query, ...args);
for (const r of snapshot.resources)
  await store
    .statement(
      "INSERT INTO guild_resources VALUES(?,?,?,?)",
      r.key,
      r.discord_id,
      r.kind,
      r.updated,
    )
    .run();
for (const r of snapshot.regions)
  await store
    .statement(
      "INSERT INTO region_settings VALUES(?,?,?)",
      r.id,
      r.name,
      r.enabled,
    )
    .run();
for (const r of snapshot.roleMappings)
  await store
    .statement(
      "INSERT INTO tier_role_mappings VALUES(?,?,?)",
      r.mode,
      r.tier,
      r.role,
    )
    .run();
if (snapshot.run)
  await store
    .statement(
      "INSERT INTO setup_runs VALUES(?,?,?,?)",
      snapshot.run.guild,
      snapshot.run.stage,
      snapshot.run.settings,
      snapshot.run.updated,
    )
    .run();
const rest = new REST({ timeout: 30000 }).setToken(env.DISCORD_TOKEN);
const identity = await rest.get("/users/@me");
if (identity.id !== env.DISCORD_CLIENT_ID || !identity.bot)
  throw Error("Dedicated bot identity mismatch.");
const request = async (url, o = {}) => {
  const path = url.replace("https://discord.com/api/v10", "");
  const value = await rest.request({
    method: o.method || "GET",
    fullRoute: path,
    ...(o.body ? { body: JSON.parse(o.body) } : {}),
  });
  return Response.json(value ?? {});
};
const interaction = (action) => ({
  guild_id: env.DISCORD_GUILD_ID,
  application_id: env.DISCORD_CLIENT_ID,
  member: {
    user: { id: env.DISCORD_OWNER_ID || identity.id },
    roles: [],
    permissions: "8",
  },
  data: { name: "setup", options: [{ name: "action", value: action }] },
});
console.log(
  "Installing idempotent Mace server roles, private sections and regional channels.",
);
const structure = await setupWizard(
  interaction("install"),
  env,
  store,
  request,
);
console.log(structure.content);
const panels = await setupWizard(interaction("panels"), env, store, request);
console.log(panels.content);
const run = await store.one(
  "SELECT * FROM setup_runs WHERE guild=?",
  env.DISCORD_GUILD_ID,
);
const payload = {
  resources: await store.all("SELECT * FROM guild_resources"),
  installed: JSON.parse(run.settings).installed,
  roleMappings: await store.all("SELECT * FROM tier_role_mappings"),
};
await writeFile(
  ".runtime/platform-installed.json",
  JSON.stringify(payload, null, 2),
);
console.log(JSON.stringify(await control("POST", payload)));
console.log(await setupWizard(interaction("validate"), env, store, request));
sql.close();
