export function queueContainerId(mode, region) {
  let hash = 0;
  for (const c of mode + "/" + region)
    hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return (hash % 2000000000) + 1000;
}
export const queueV2Flag = 1 << 15;
const queueText = (content) => ({ type: 10, content });
const queueSeparator = () => ({ type: 14, divider: true, spacing: 1 });
export function nativeQueuePanel({
  kit,
  region,
  session,
  closure,
  counts,
  active,
  waiting,
  available,
  capacity,
  page,
  controls,
}) {
  const state = session?.status || "closed",
    closed = state === "closed",
    paused = state === "paused";
  if (closed) {
    const ended =
      closure?.ended_at ||
      (session?.status === "closed" ? session.updated : null);
    const reason =
      closure?.reason ||
      (session
        ? "Queue manually ended by command"
        : "No testing session is currently scheduled for this Mace mode and region.");
    return {
      flags: queueV2Flag,
      allowed_mentions: { parse: [] },
      components: [
        {
          type: 17,
          id: queueContainerId(kit.id, region),
          accent_color: 0xed1029,
          components: [
            queueText("# 🔒 " + kit.name + " Queue Closed"),
            queueSeparator(),
            queueText(
              session
                ? "This testing session has ended. The live queue will return here when testing reopens."
                : "Testing has not opened yet. The live queue will appear here when an approved tester opens a session.",
            ),
            queueSeparator(),
            queueText("### 📋 Reason\n" + reason),
            queueText(
              ended
                ? "### ⏰ Session Ended\n<t:" +
                    Math.floor(Date.parse(ended) / 1000) +
                    ":F>"
                : "### ⏰ Session Status\nNot started · " + region,
            ),
            queueSeparator(),
            queueText("*Thank you for testing!*"),
          ],
        },
      ],
    };
  }
  const full = counts.occupied >= capacity;
  const stateTitle = paused
    ? "🟡 QUEUE PAUSED"
    : full
      ? "🟠 QUEUE FULL"
      : "🟢 TESTING OPEN";
  const testerLines = available.length
    ? available
        .slice(0, 12)
        .map(
          (t) =>
            "<@" +
            t.user +
            "> — " +
            (t.busy
              ? "Testing"
              : t.status === "available"
                ? "Available"
                : "Paused"),
        )
        .join("\n")
    : "No availability sessions recorded.";
  const queueLines =
    waiting
      .slice((page - 1) * 10, page * 10)
      .map(
        (p, n) =>
          "`" +
          String((page - 1) * 10 + n + 1).padStart(2, "0") +
          "` " +
          p.name,
      )
      .join("\n") || "No players are waiting.";
  const activeLines = active
    .map((t) => "<@" + t.tester + "> → **" + t.name + "**")
    .join("\n");
  return {
    flags: queueV2Flag,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17,
        accent_color: paused ? 0xe9b448 : 0x35c895,
        components: [
          queueText("# ⚔️ " + region + " " + kit.name + " Queue"),
          queueSeparator(),
          queueText(
            "## " +
              stateTitle +
              "\n" +
              (paused
                ? "Players already queued retain their positions. New entries are temporarily paused."
                : "Official Mace testing is accepting eligible players."),
          ),
          queueText(
            "### SESSION OVERVIEW\n**" +
              counts.occupied +
              "/" +
              capacity +
              "** slots · **" +
              (counts.waiting || 0) +
              " waiting** · **" +
              (counts.claimed || 0) +
              "** active tests",
          ),
          queueSeparator(),
          queueText(
            "### AVAILABLE TESTERS\n" +
              testerLines +
              (activeLines ? "\n\n**Currently testing**\n" + activeLines : ""),
          ),
          queueSeparator(),
          queueText("### LIVE QUEUE · PAGE " + page + "\n" + queueLines),
          queueSeparator(),
          queueText(
            "**Region:** " +
              region +
              " · **Mace mode:** " +
              kit.name +
              "\n**Retest policy:** " +
              session.cooldown +
              " hours\nWaitlist interest never reserves a live queue position.",
          ),
        ],
      },
      ...controls,
    ],
  };
}
export function queuePanelEdit(body) {
  return body.flags & queueV2Flag
    ? { ...body, content: null, embeds: [], attachments: [] }
    : body;
}
