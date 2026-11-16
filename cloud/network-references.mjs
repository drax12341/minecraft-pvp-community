import tierNetworkDirectory from "../config/tier-network-directory.json" with { type: "json" };
import { externalJSON } from "./external-bans.mjs";
const referenceId = /^\d{5,22}$/;
const referenceText = (value) =>
  String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/([\\`*_~<>\[\]])/g, "\\$1")
    .slice(0, 340);
export async function readNetworkReferences(
  env,
  target,
  account,
  installed,
  request = fetch,
) {
  if (!referenceId.test(target)) throw Error("Choose a valid Discord account.");
  const known = new Map(
    tierNetworkDirectory.networks.flatMap((n) =>
      n.modes
        .filter((m) => m.guildId)
        .map((m) => [
          m.guildId,
          { network: n.name, name: m.guildName || m.title },
        ]),
    ),
  );
  const guilds = [...new Set(installed || [])].filter(
      (id) => referenceId.test(id) && known.has(id),
    ),
    references = [];
  let channelsRead = 0,
    unavailable = 0,
    cursor = 0,
    partial = false;
  const deadline = Date.now() + 6000,
    headers = { Authorization: "Bot " + env.DISCORD_TOKEN };
  const call = (url) =>
    externalJSON(
      request,
      "https://discord.com/api/v10" + url,
      headers,
      deadline - Date.now(),
    );
  await Promise.all(
    Array.from({ length: Math.min(3, guilds.length) }, async () => {
      while (cursor < guilds.length) {
        if (Date.now() >= deadline) {
          partial = true;
          break;
        }
        const guild = guilds[cursor++],
          source = known.get(guild);
        try {
          const channels = await call("/guilds/" + guild + "/channels");
          if (channels.status !== 200 || !Array.isArray(channels.body)) {
            unavailable++;
            continue;
          }
          const eligible = channels.body.filter(
            (c) =>
              referenceId.test(c.id) &&
              [0, 5].includes(c.type) &&
              /blacklist|ban[-_┃・ ]?(?:log|list|history)|punishment|restriction/i.test(
                c.name || "",
              ),
          );
          if (eligible.length > 2) partial = true;
          for (const channel of eligible.slice(0, 2)) {
            if (Date.now() >= deadline) {
              partial = true;
              break;
            }
            const messages = await call(
              "/channels/" + channel.id + "/messages?limit=20",
            );
            if (messages.status !== 200 || !Array.isArray(messages.body)) {
              unavailable++;
              continue;
            }
            channelsRead++;
            for (const m of messages.body) {
              if (!referenceId.test(m.id)) continue;
              const text = [
                m.content,
                ...(m.embeds || []).flatMap((e) => [
                  e.title,
                  e.description,
                  ...(e.fields || []).flatMap((f) => [f.name, f.value]),
                ]),
              ]
                .filter((v) => typeof v === "string")
                .join(" ");
              const uuid = String(account?.uuid || "")
                .replaceAll("-", "")
                .toLowerCase();
              const byDiscord =
                (m.mentions || []).some((u) => u.id === target) ||
                text.includes("<@" + target + ">") ||
                text.includes("<@!" + target + ">");
              const byUUID =
                /^[a-f0-9]{32}$/.test(uuid) &&
                new RegExp(
                  "(?:^|[^a-f0-9])" + uuid + "(?:$|[^a-f0-9])",
                  "i",
                ).test(text.replaceAll("-", ""));
              if (!byDiscord && !byUUID) continue;
              if (!text.trim()) {
                unavailable++;
                continue;
              }
              if (references.length >= 5) {
                partial = true;
                continue;
              }
              references.push({
                network: source.network,
                source: referenceText(source.name),
                channel: referenceText(channel.name),
                url:
                  "https://discord.com/channels/" +
                  guild +
                  "/" +
                  channel.id +
                  "/" +
                  m.id,
                excerpt: referenceText(text),
                matchedBy: byDiscord
                  ? "Exact Discord ID"
                  : "Exact Minecraft UUID",
                postedAt: Number.isFinite(Date.parse(m.timestamp))
                  ? m.timestamp
                  : null,
              });
            }
            if (messages.body.length === 20) partial = true;
          }
        } catch {
          unavailable++;
        }
      }
    }),
  );
  return {
    references,
    channelsRead,
    unavailable,
    installedNetworkGuilds: guilds.length,
    partial,
  };
}
