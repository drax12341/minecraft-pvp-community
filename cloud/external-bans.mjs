const externalSnowflake = /^\d{5,22}$/;
const externalUuid = (value) =>
  String(value || "")
    .replaceAll("-", "")
    .toLowerCase();
const externalText = (value, max = 300) =>
  String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/([\\`*_~<>\[\]])/g, "\\$1")
    .slice(0, max);
async function externalJSON(request, url, headers = {}) {
  const response = await request(url, {
    headers,
    redirect: "error",
    credentials: "omit",
    signal: AbortSignal.timeout(5000),
  });
  if (Number(response.headers.get("content-length") || 0) > 131072)
    throw Error("Source response too large");
  const reader = response.body?.getReader();
  let bytes = 0,
    text = "";
  if (reader) {
    const decoder = new TextDecoder();
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > 131072) {
        await reader.cancel();
        throw Error("Source response too large");
      }
      text += decoder.decode(item.value, { stream: true });
    }
    text += decoder.decode();
  }
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

export async function externalBanChecks(env, target, account, request = fetch) {
  if (!externalSnowflake.test(target))
    throw Error("Choose a valid Discord account.");
  const sources = [],
    findings = [],
    checkedAt = new Date().toISOString();
  let discovered = 0,
    truncated = false;
  try {
    const list = await externalJSON(
      request,
      "https://discord.com/api/v10/users/@me/guilds?limit=100",
      { Authorization: "Bot " + env.DISCORD_TOKEN },
    );
    if (list.status !== 200 || !Array.isArray(list.body))
      throw Error("Guild discovery unavailable");
    const guilds = list.body.filter(
      (g) => externalSnowflake.test(g.id) && g.id !== env.DISCORD_GUILD_ID,
    );
    discovered = guilds.length;
    truncated = list.body.length === 100 || guilds.length > 10;
    let cursor = 0;
    const rows = guilds.slice(0, 10),
      results = new Array(rows.length);
    await Promise.all(
      Array.from({ length: Math.min(3, rows.length) }, async () => {
        while (cursor < rows.length) {
          const index = cursor++,
            g = rows[index],
            source = {
              name: externalText(g.name, 80),
              kind: "discord",
              guild: g.id,
              status: "unavailable",
              checkedAt,
            };
          const permissions = /^\d{1,24}$/.test(String(g.permissions))
            ? BigInt(g.permissions)
            : 0n;
          if (!(permissions & (8n | 4n | 128n))) source.status = "no-access";
          else
            try {
              const result = await externalJSON(
                request,
                "https://discord.com/api/v10/guilds/" +
                  g.id +
                  "/bans/" +
                  target,
                { Authorization: "Bot " + env.DISCORD_TOKEN },
              );
              if (result.status === 200 && result.body?.user?.id === target) {
                source.status = "ban-found";
                findings.push({
                  source: source.name,
                  guild: g.id,
                  subject: target,
                  kind: "discord-ban",
                  reason:
                    externalText(result.body.reason) ||
                    "No reason supplied by the source",
                  checkedAt,
                });
              } else if (result.status === 404 && result.body?.code === 10026)
                source.status = "no-ban";
              else if (result.status === 403) source.status = "no-access";
              else source.status = "unavailable";
            } catch {
              source.status = "unavailable";
            }
          results[index] = source;
        }
      }),
    );
    sources.push(...results);
  } catch {
    sources.push({
      name: "Discord server discovery",
      kind: "discord",
      status: "unavailable",
      checkedAt,
    });
  }

  const identity =
    account &&
    /^[a-f0-9]{32}$/.test(externalUuid(account.uuid)) &&
    /^[A-Za-z0-9_]{3,16}$/.test(account.name);
  const hq = {
    name: "PvPHQ",
    kind: "minecraft",
    url: "https://pvphq.com",
    status: identity ? "unavailable" : "identity-required",
    checkedAt,
  };
  if (identity)
    try {
      const result = await externalJSON(
        request,
        "https://pvphq.com/api/v1/players/" + encodeURIComponent(account.uuid),
      );
      if (result.status === 404) {
        hq.status = "profile-not-found";
      } else if (
        result.status === 200 &&
        externalUuid(result.body?.uuid) === externalUuid(account.uuid)
      ) {
        hq.status = "ban-data-unavailable";
        hq.profileUrl =
          "https://pvphq.com/player/" + encodeURIComponent(account.uuid);
        hq.detail =
          "UUID-matched public profile. This endpoint does not provide ban history.";
      } else if (result.status === 200) {
        hq.status = "identity-mismatch";
      }
    } catch {
      hq.status = "unavailable";
    }
  sources.push(
    hq,
    {
      name: "CatPvP",
      kind: "minecraft",
      url: identity
        ? "https://catpvp.xyz/player/" + encodeURIComponent(account.name)
        : "https://catpvp.xyz",
      status: "no-supported-ban-endpoint",
      detail:
        "Public player pages found; no supported ban-history API verified.",
      checkedAt,
    },
    {
      name: "PvP Club",
      kind: "minecraft",
      url: "https://mcpvp.club",
      status: "no-supported-ban-endpoint",
      detail: "No public ban-history endpoint verified on the official site.",
      checkedAt,
    },
  );
  return {
    sources,
    findings,
    discoveredDiscordGuilds: discovered,
    truncated,
    checkedAt,
  };
}

export function externalBanEmbed(report) {
  const labels = {
    "ban-found": "Ban found",
    "no-ban": "No current ban returned",
    "no-access": "Bot lacks access",
    unavailable: "Source unavailable",
    "identity-required": "Linked Minecraft UUID required",
    "identity-mismatch": "Profile UUID mismatch",
    "profile-not-found": "Profile not found; ban status unknown",
    "ban-data-unavailable": "Profile found; ban data not provided",
    "no-supported-ban-endpoint": "Ban feed not verified",
  };
  const fields = [];
  for (const record of report.findings)
    fields.push({
      name: "Ban Evidence · " + record.source,
      value:
        "**Discord account ID:** `" +
        record.subject +
        "`\n**Reason:** " +
        record.reason +
        "\n**Checked:** <t:" +
        Math.floor(Date.parse(record.checkedAt) / 1000) +
        ":F>\nThe ban API does not supply the original ban date.",
      inline: false,
    });
  fields.push(
    ...report.sources.map((s) => ({
      name: (s.kind === "discord" ? "Discord · " : "Minecraft · ") + s.name,
      value:
        (s.profileUrl
          ? "[Public profile](" + s.profileUrl + ") · "
          : s.url
            ? "[Source](" + s.url + ") · "
            : "") + labels[s.status],
      inline: false,
    })),
  );
  const embed = {
    title: "🌐 External Ban Evidence",
    color: report.findings.length ? 0xe05f74 : 0x8b70f5,
    description:
      "**" +
      report.findings.length +
      " external Discord ban(s) returned** · " +
      report.discoveredDiscordGuilds +
      " other bot server(s) discovered\n" +
      (report.discoveredDiscordGuilds === 0
        ? "The bot is currently installed only in this community. Partner admins must install it and grant ban-read access.\n"
        : "") +
      "Minecraft profiles and missing feeds do not establish a clean ban history.",
    fields: [],
    footer: {
      text:
        "Exact Discord IDs / Minecraft UUIDs · No inferred alt matches" +
        (report.truncated ? " · Discord scan limited to 10 other servers" : ""),
    },
    timestamp: report.checkedAt,
  };
  let used =
    embed.title.length + embed.description.length + embed.footer.text.length;
  for (const field of fields) {
    const length = field.name.length + field.value.length;
    if (used + length > 2400 || embed.fields.length === 23) break;
    embed.fields.push(field);
    used += length;
  }
  if (embed.fields.length < fields.length)
    embed.footer.text +=
      " · " +
      (fields.length - embed.fields.length) +
      " entries omitted for message length";
  return embed;
}
