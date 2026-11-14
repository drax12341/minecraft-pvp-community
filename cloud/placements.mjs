import config from "../config/community.json" with { type: "json" };
import { staffAccess } from "../config/community-roles.mjs";
export async function managePlacement(i, env, store) {
  const { actor, mod } = staffAccess(i, env);
  if (!mod)
    throw Error(
      "Only testing managers and administrators may adjust a placement.",
    );
  const sub = i.data.options?.find((o) => o.type === 1),
    opts = sub?.options || i.data.options || [],
    get = (n) => opts.find((o) => o.name === n)?.value,
    action = sub?.name || get("action");
  const user = get("user"),
    mode = get("mode"),
    tier = get("tier");
  if (
    !config.modes.some((m) => m.id === mode) ||
    !/^\d{5,22}$/.test(user || "")
  )
    throw Error("Choose a verified player and an enabled Mace submode.");
  const account = await store.one(
    "SELECT * FROM accounts WHERE discord=?",
    user,
  );
  if (!account)
    throw Error("This competitor has not proved Minecraft ownership.");
  if (action === "history") {
    const rows = await store.all(
      "SELECT id,record_type,tier,pos,tester,adjustment_reason,created FROM results WHERE uuid=? AND mode=? ORDER BY sequence DESC LIMIT 20",
      account.uuid,
      mode,
    );
    return (
      "**AUDITED PLACEMENT HISTORY**\n" +
      rows
        .map(
          (r) =>
            r.id +
            " · " +
            r.record_type +
            " · " +
            (r.record_type === "reset"
              ? "Unranked"
              : (r.pos === 0 ? "HT" : "LT") + r.tier) +
            " · " +
            r.created +
            (r.adjustment_reason ? "\nReason: " + r.adjustment_reason : ""),
        )
        .join("\n\n")
    );
  }
  store.reason(get("reason"));
  if (
    !["set", "reset"].includes(action) ||
    (action === "set" && !/^(HT|LT)[1-5]$/.test(tier || ""))
  )
    throw Error("Choose set/reset and a valid official tier.");
  if (
    i.placementConfirmationId &&
    (await store.one(
      "SELECT 1 FROM results WHERE id=? AND tester=?",
      i.placementConfirmationId,
      actor,
    ))
  )
    return "This staff placement adjustment is already applied.";
  const current = await store.one(
    "SELECT * FROM effective_placements WHERE uuid=? AND mode=?",
    account.uuid,
    mode,
  );
  if (!current && action === "set" && !get("region"))
    throw Error(
      "Select the verified competitor playing region for this initial staff placement.",
    );
  if (action === "reset" && !current)
    throw Error("This player is already unranked in this Mace mode.");
  if (!i.confirmedPlacement) {
    const id = crypto.randomUUID(),
      payload = {
        action,
        user,
        mode,
        tier: tier || null,
        reason: get("reason"),
        expected: current?.id || null,
      };
    await store
      .statement(
        "INSERT INTO staff_action_drafts VALUES(?,?,?,?,?,NULL)",
        id,
        actor,
        "tier",
        JSON.stringify(payload),
        new Date(Date.now() + 600000).toISOString(),
      )
      .run();
    return {
      content:
        "**CONFIRM STAFF PLACEMENT " +
        action.toUpperCase() +
        "**\nPlayer: " +
        account.name +
        "\nMode: " +
        config.modes.find((m) => m.id === mode).name +
        "\nCurrent: " +
        (current
          ? (current.pos === 0 ? "HT" : "LT") + current.tier
          : "Unranked") +
        "\nNew: " +
        (action === "reset" ? "Unranked" : tier) +
        "\nReason: " +
        get("reason") +
        "\n\nThis is an audited staff adjustment. It does not count as an official evaluation, tester completion or quota credit.",
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 4,
              label: "Confirm placement adjustment",
              custom_id: "tier:confirm:" + id,
            },
          ],
        },
      ],
    };
  }
  if ((current?.id || null) !== get("expected"))
    throw Error(
      "The placement changed after this preview. Submit a new reviewed adjustment.",
    );
  const id = i.placementConfirmationId || crypto.randomUUID(),
    now = new Date().toISOString(),
    nextTier = action === "reset" ? current.tier : Number(tier.slice(-1)),
    pos = action === "reset" ? current.pos : tier.startsWith("HT") ? 0 : 1;
  const outcomes = await store.db.batch([
    store.statement(
      `INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created,record_type,adjustment_reason,previous_id)
   SELECT ?,?,?,?,?,?,?,?,'',?,?,?,? WHERE COALESCE((SELECT id FROM effective_placements WHERE uuid=? AND mode=?),'')=?`,
      id,
      account.uuid,
      account.name,
      current?.region || get("region") || "EU",
      mode,
      nextTier,
      pos,
      actor,
      now,
      action === "reset" ? "reset" : "adjustment",
      get("reason"),
      current?.id || null,
      account.uuid,
      mode,
      current?.id || "",
    ),
    store.statement(
      "INSERT OR IGNORE INTO outbox_events(kind,subject,available_at,created) SELECT 'roles',id,created,created FROM results WHERE id=?",
      id,
    ),
    store.audit(actor, "staff-placement-" + action, id + ": " + get("reason")),
  ]);
  if (!outcomes[0].meta.changes)
    throw Error("The placement changed concurrently. No adjustment was saved.");
  return (
    "Placement " +
    action +
    " saved with prior placement " +
    (current?.id || "Unranked") +
    ". Official tests, cooldowns and tester quotas remain unchanged; scoped role synchronization is queued."
  );
}
