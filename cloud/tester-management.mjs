import { staffAccess } from "../config/community-roles.mjs";
import config from "../config/community.json" with { type: "json" };
export async function manageTesters(i, env, store) {
  const { actor, mod } = staffAccess(i, env);
  if (!mod) throw Error("Only testing managers can approve or remove testers.");
  const sub = i.data.options?.find((o) => o.type === 1),
    get = (n) => sub?.options?.find((o) => o.name === n)?.value;
  if (sub.name === "permissions")
    return (
      (
        await store.all(
          "SELECT user,mode,senior,updated FROM tester_qualifications WHERE (? IS NULL OR user=?) ORDER BY mode,user LIMIT 30",
          get("user") || null,
          get("user") || null,
        )
      )
        .map(
          (q) =>
            "<@" +
            q.user +
            "> · " +
            q.mode +
            " · " +
            (q.senior
              ? "Senior / independent high-tier review"
              : "Standard tester") +
            " · " +
            q.updated,
        )
        .join("\n") || "No mode qualifications found."
    );
  const user = get("user"),
    mode = get("mode");
  store.reason(get("reason"));
  if (
    !/^\d{5,22}$/.test(user || "") ||
    !config.modes.some((m) => m.id === mode)
  )
    throw Error("Choose a valid member and configured Mace mode.");
  if (user === actor)
    throw Error(
      "A different testing manager must approve your tester qualification.",
    );
  const now = new Date().toISOString(),
    subject = user + "/" + mode + "/" + crypto.randomUUID();
  await store.db.batch([
    sub.name === "add"
      ? store.statement(
          "INSERT INTO tester_qualifications VALUES(?,?,?,?,?,?) ON CONFLICT(user,mode) DO UPDATE SET senior=excluded.senior,actor=excluded.actor,reason=excluded.reason,updated=excluded.updated",
          user,
          mode,
          get("senior") ? 1 : 0,
          actor,
          get("reason"),
          now,
        )
      : store.statement(
          "DELETE FROM tester_qualifications WHERE user=? AND mode=?",
          user,
          mode,
        ),
    store.statement(
      "INSERT INTO outbox_events(kind,subject,payload,available_at,created) VALUES('tester-roles',?,?,?,?)",
      subject,
      JSON.stringify({ user, mode }),
      now,
      now,
    ),
    store.audit(
      actor,
      "tester-" + sub.name,
      user + "/" + mode + ": " + get("reason"),
    ),
  ]);
  return (
    "Tester qualification " +
    (sub.name === "add" ? "approved" : "removed") +
    " for " +
    mode +
    ". Safe Discord role synchronization is queued and tracked in /delivery status. Other Mace qualifications are preserved."
  );
}
export async function synchronizeTesterRoles(job, store, env, api) {
  const { user, mode } = JSON.parse(job.payload),
    approved = await store.one(
      "SELECT senior FROM tester_qualifications WHERE user=? AND mode=?",
      user,
      mode,
    ),
    totals = await store.one(
      "SELECT count(*) n,COALESCE(max(senior),0) senior FROM tester_qualifications WHERE user=?",
      user,
    );
  const keys = ["role:tester:" + mode, "role:tester", "role:high-tester"],
    resources = await store.all(
      "SELECT key,discord_id FROM guild_resources WHERE key IN (?,?,?)",
      ...keys,
    );
  const roles = await api("/guilds/" + env.DISCORD_GUILD_ID + "/roles"),
    member = await api("/guilds/" + env.DISCORD_GUILD_ID + "/members/" + user);
  for (const key of keys) {
    const id = resources.find((r) => r.key === key)?.discord_id;
    if (!id) continue;
    const role = roles.find((r) => r.id === id);
    if (!role || role.managed || BigInt(role.permissions) !== 0n)
      throw Error(
        "Tester role mapping is missing or privileged; manager review required.",
      );
    const wanted =
      key === keys[0]
        ? !!approved
        : key === keys[1]
          ? totals.n > 0
          : totals.senior > 0;
    if (wanted && !member.roles.includes(id))
      await api(
        "/guilds/" + env.DISCORD_GUILD_ID + "/members/" + user + "/roles/" + id,
        "PUT",
      );
    if (!wanted && member.roles.includes(id))
      await api(
        "/guilds/" + env.DISCORD_GUILD_ID + "/members/" + user + "/roles/" + id,
        "DELETE",
      );
  }
}
