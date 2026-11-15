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
  const testerLines = available.length
    ? available
        .slice(0, 20)
        .map(
          (t, n) =>
            n +
            1 +
            ". <@" +
            t.user +
            "> — " +
            (t.busy
              ? "Testing"
              : t.status === "available"
                ? "Available"
                : "Paused"),
        )
        .join("\n")
    : "No testers have marked themselves available.";
  const queueLines =
    waiting
      .slice(0, 20)
      .map((p, n) => n + 1 + ". " + p.name)
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
        id: queueContainerId(kit.id, region),
        accent_color: paused ? 0xe9b448 : 0x7861e8,
        components: [
          queueText(
            "### " +
              (paused
                ? "Testing Paused"
                : available.some((t) => t.status === "available")
                  ? "Tester(s) Available!"
                  : "TESTING OPEN"),
          ),
          queueText(
            "Use **Leave Queue** or /leave if you wish to be removed from the queue." +
              (paused
                ? "\nYour place is kept while new entries are paused."
                : ""),
          ),
          queueText(
            "**Queue (" +
              counts.occupied +
              "/" +
              capacity +
              "):**\n" +
              queueLines,
          ),
          queueText(
            "**Active Testers:**\n" +
              testerLines +
              (activeLines ? "\n\n**Currently testing:**\n" + activeLines : ""),
          ),
          queueText(
            "-# " +
              region +
              " · " +
              kit.name +
              " · " +
              (counts.waiting || 0) +
              " waiting · " +
              (counts.claimed || 0) +
              " active · " +
              session.cooldown +
              "h retest cooldown. Updates after queue actions; Refresh checks now.",
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
