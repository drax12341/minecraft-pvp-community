import { platformStatistics } from "./platform-panels.mjs";
import { competitionDiscord } from "./competition.mjs";
export async function installationBridge(
  request,
  env,
  store,
  provider = fetch,
) {
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  if (request.method === "GET")
    return json({
      resources: await store.all("SELECT * FROM guild_resources"),
      run: await store.one(
        "SELECT * FROM setup_runs WHERE guild=?",
        env.DISCORD_GUILD_ID,
      ),
      statistics: await platformStatistics(store),
      regions: await store.all("SELECT * FROM region_settings"),
      roleMappings: await store.all("SELECT * FROM tier_role_mappings"),
    });
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  const raw = await request.text();
  if (raw.length > 120000)
    return json({ error: "Installation payload too large" }, 413);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid installation JSON" }, 400);
  }
  if (
    !Array.isArray(data.resources) ||
    data.resources.length > 400 ||
    !Array.isArray(data.installed) ||
    data.installed.length > 60
  )
    return json({ error: "Invalid resource snapshot" }, 400);
  const channels = await competitionDiscord(
      env,
      provider,
      "/guilds/" + env.DISCORD_GUILD_ID + "/channels",
    ),
    roles = await competitionDiscord(
      env,
      provider,
      "/guilds/" + env.DISCORD_GUILD_ID + "/roles",
    );
  for (const r of data.resources) {
    if (
      !/^(role|category|channel|panel):[a-zA-Z0-9:_-]{1,100}$/.test(r.key) ||
      !/^\d{5,22}$/.test(r.discord_id)
    )
      return json({ error: "Invalid resource identifier" }, 400);
    if (r.kind === "channel" && !channels.some((c) => c.id === r.discord_id))
      return json({ error: "Channel does not belong to this guild" }, 400);
    if (
      r.kind === "role" &&
      !roles.some((role) => role.id === r.discord_id && !role.managed)
    )
      return json({ error: "Role does not belong to this guild" }, 400);
    if (!["channel", "role", "message"].includes(r.kind))
      return json({ error: "Invalid resource kind" }, 400);
  }
  if (data.installed.some((t) => !channels.some((c) => c.id === t.channel)))
    return json(
      { error: "Installed channel does not belong to this guild" },
      400,
    );
  const mappings = data.roleMappings || [];
  if (!Array.isArray(mappings) || mappings.length > 250)
    return json({ error: "Invalid role mappings" }, 400);
  for (const m of mappings) {
    const r = roles.find((r) => r.id === m.role);
    if (
      !/^mace(?:_[a-z0-9]+)*$/.test(m.mode) ||
      !/^(HT|LT)[1-5]$/.test(m.tier) ||
      !r ||
      r.managed ||
      BigInt(r.permissions) !== 0n
    )
      return json({ error: "Tier mapping is unsafe" }, 400);
  }
  const now = new Date().toISOString(),
    statements = data.resources.map((r) =>
      store.statement(
        "INSERT INTO guild_resources VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET discord_id=excluded.discord_id,kind=excluded.kind,updated=excluded.updated",
        r.key,
        r.discord_id,
        r.kind,
        now,
      ),
    );
  statements.push(
    store.statement(
      "INSERT INTO setup_runs VALUES(?,8,?,?) ON CONFLICT(guild) DO UPDATE SET stage=8,settings=excluded.settings,updated=excluded.updated",
      env.DISCORD_GUILD_ID,
      JSON.stringify({ installed: data.installed }),
      now,
    ),
  );
  for (const m of mappings)
    statements.push(
      store.statement(
        "INSERT INTO tier_role_mappings VALUES(?,?,?) ON CONFLICT(mode,tier) DO UPDATE SET role=excluded.role",
        m.mode,
        m.tier,
        m.role,
      ),
    );
  const tickets = data.resources.find((r) => r.key === "category:tickets");
  if (tickets)
    statements.push(
      store.statement(
        "INSERT INTO platform_settings VALUES('ticket-category',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated",
        tickets.discord_id,
        "system-install",
        now,
      ),
    );
  for (const target of data.installed.filter((t) => t.panel === "hub")) {
    const message = data.resources.find(
      (r) => r.key === "panel:" + target.key,
    )?.discord_id;
    if (message)
      statements.push(
        store.statement(
          "INSERT INTO platform_panels(key,channel,message) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET message=excluded.message,channel=excluded.channel",
          "hub:" + target.channel,
          target.channel,
          message,
        ),
      );
  }
  statements.push(
    store.audit(
      "system-install",
      "discord-installation-synchronized",
      String(data.resources.length),
    ),
  );
  // Bounded batches accommodate D1 statement parameter limits. Stable keys make retries safe.
  for (let n = 0; n < statements.length; n += 40)
    await store.db.batch(statements.slice(n, n + 40));
  return json({
    saved: data.resources.length,
    panels: data.installed.length,
    roleMappings: mappings.length,
  });
}
