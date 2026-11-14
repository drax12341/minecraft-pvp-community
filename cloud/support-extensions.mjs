import { staffAccess } from "../config/community-roles.mjs";
import { ticketOverwrites, assertPrivateTicket } from "./operations.mjs";
import { competitionDiscord } from "./competition.mjs";
export const supportExtensionActions = new Set([
  "reopen",
  "transcript",
  "evidence",
  "link-test",
]);
export async function supportExtension(i, env, store, request = fetch) {
  const { actor, support, reportReviewer, mod } = staffAccess(i, env),
    sub = i.data.options?.find((o) => o.type === 1),
    opts = sub?.options || [],
    get = (n) => opts.find((o) => o.name === n)?.value;
  const t = await store.one(
    "SELECT * FROM support_tickets WHERE id=?",
    get("id"),
  );
  const sensitive = ["staff-report", "tester-report"].includes(t?.kind);
  if (!t || (actor !== t.user && (!support || (sensitive && !reportReviewer))))
    throw Error("Support case not found or you do not have access.");
  const now = () => new Date().toISOString(),
    api = (path, method, body) =>
      competitionDiscord(env, request, path, method, body);
  if (sub.name === "evidence") {
    const ref = get("reference");
    store.reason(get("reason"));
    if (
      typeof ref !== "string" ||
      ref.length > 1500 ||
      !URL.canParse(ref) ||
      new URL(ref).protocol !== "https:"
    )
      throw Error(
        "Provide a shareable HTTPS evidence or Discord attachment reference.",
      );
    await store.db.batch([
      store.statement(
        "INSERT INTO support_evidence VALUES(?,?,?,?,?,?)",
        crypto.randomUUID(),
        t.id,
        actor,
        ref,
        get("reason"),
        now(),
      ),
      store.audit(actor, "support-evidence-added", t.id),
    ]);
    return "Evidence reference saved privately to this support case. No remote attachment was fetched or published.";
  }
  if (sub.name === "link-test") {
    store.reason(get("reason"));
    const result = await store.one(
      "SELECT r.id,a.discord FROM results r JOIN accounts a ON a.uuid=r.uuid WHERE r.id=?",
      get("result"),
    );
    if (!result || (!mod && result.discord !== t.user))
      throw Error(
        "Link this case owner’s official test, or ask a testing manager to review the cross-account reference.",
      );
    await store.db.batch([
      store.statement(
        "UPDATE support_tickets SET test_id=? WHERE id=?",
        result.id,
        t.id,
      ),
      store.audit(
        actor,
        "support-linked-test",
        t.id + ": " + result.id + ": " + get("reason"),
      ),
    ]);
    return (
      "Support case linked to official record " +
      result.id +
      ". Result changes still require independent review."
    );
  }
  if (!support || actor === t.user || (sensitive && !reportReviewer))
    throw Error(
      "Only independent authorized support staff can reopen or export this case.",
    );
  if (sub.name === "transcript") {
    if (!t.channel) throw Error("This case has no private channel.");
    const channel = await api("/channels/" + t.channel);
    assertPrivateTicket(channel, env, t.user, t.kind);
    const messages = await api(
        "/channels/" + t.channel + "/messages?limit=100",
      ),
      notes = await store.all(
        "SELECT actor,note,created FROM ticket_notes WHERE ticket=? ORDER BY created LIMIT 100",
        t.id,
      ),
      evidence = await store.all(
        "SELECT actor,url,note,created FROM support_evidence WHERE ticket=? ORDER BY created LIMIT 100",
        t.id,
      );
    const text =
      "PRIVATE SUPPORT TRANSCRIPT\nCase " +
      t.id +
      "\nCategory " +
      t.kind +
      "\nStatus " +
      t.status +
      "\nOfficial record " +
      (t.test_id || "Not linked") +
      "\nSubject " +
      t.subject +
      "\n" +
      t.detail +
      "\n\nLATEST 100 CHANNEL MESSAGES\n" +
      messages
        .reverse()
        .map(
          (m) =>
            m.timestamp +
            " " +
            m.author?.id +
            ": " +
            (m.content || "[embed]") +
            (m.attachments?.length
              ? "\n" + m.attachments.map((a) => a.url).join("\n")
              : ""),
        )
        .join("\n") +
      "\n\nSTAFF-ONLY NOTES\n" +
      notes.map((n) => n.created + " " + n.actor + ": " + n.note).join("\n") +
      "\n\nEVIDENCE REFERENCES\n" +
      evidence.map((e) => e.created + " " + e.url + " " + e.note).join("\n");
    await store.audit(actor, "support-transcript-export", t.id).run();
    return {
      content:
        "Private support transcript. Includes internal staff notes; do not share publicly.",
      artifact: { name: "support-" + t.id + ".txt", text },
      components: [],
    };
  }
  if (sub.name === "reopen") {
    store.reason(get("reason"));
    if (!["closed", "reopening"].includes(t.status) || !t.channel)
      throw Error(
        "Only an archived case with an existing private channel may be reopened.",
      );
    const active = await store.one(
      "SELECT count(*) n FROM support_tickets WHERE user=? AND status IN ('creating','open','closing','reopening') AND id<>?",
      t.user,
      t.id,
    );
    if (active.n >= 2)
      throw Error(
        "This player already has two active support cases. Resolve one before reopening this case.",
      );
    const reserved = await store
      .statement(
        "UPDATE support_tickets SET status='reopening' WHERE id=? AND status='closed' AND (SELECT count(*) FROM support_tickets active WHERE active.user=support_tickets.user AND active.status IN ('creating','open','closing','reopening') AND active.id<>support_tickets.id)<2",
        t.id,
      )
      .run();
    if (!reserved.meta.changes && t.status !== "reopening")
      throw Error("This case changed or the active support limit was reached.");
    const channel = await api("/channels/" + t.channel);
    assertPrivateTicket(channel, env, t.user, t.kind);
    const updated = await api("/channels/" + t.channel, "PATCH", {
      name: "support-" + t.id.slice(0, 8),
      parent_id: env.DISCORD_TICKET_CATEGORY_ID || channel.parent_id,
      permission_overwrites: ticketOverwrites(env, t.user, t.kind),
    });
    assertPrivateTicket(updated, env, t.user, t.kind);
    await store.db.batch([
      store.statement(
        "UPDATE support_tickets SET status='open',workflow='waiting-staff' WHERE id=? AND status='reopening'",
        t.id,
      ),
      store.statement(
        "INSERT INTO ticket_notes VALUES(?,?,?,?,?)",
        crypto.randomUUID(),
        t.id,
        actor,
        "Reopened: " + get("reason"),
        now(),
      ),
      store.audit(actor, "support-reopened", t.id),
    ]);
    return (
      "Support case reopened: <#" +
      t.channel +
      ">. Previous notes, evidence, assignee and resolution history are retained."
    );
  }
  throw Error("Choose a supported support action.");
}
