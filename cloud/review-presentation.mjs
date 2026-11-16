import tierNetworkDirectory from "../config/tier-network-directory.json" with { type: "json" };
import { externalBanEmbed } from "./external-bans.mjs";
const networkProfileLabel = {
  "identity-required": "Link a Minecraft account first",
  unavailable: "Profile lookup failed",
  "identity-mismatch": "UUID mismatch · excluded",
  "profile-not-found": "No public profile returned · ban status unknown",
};
function reviewNetworkCard(profiles, external) {
  const installed = new Set(external.installedDiscordGuildIds || []);
  const fields = tierNetworkDirectory.networks.map((network) => {
    const p = profiles.find((p) => p.id === network.id),
      known = new Set(
        network.modes.filter((m) => m.guildId).map((m) => m.guildId),
      ),
      connected = [...known].filter((id) => installed.has(id)).length;
    const profile =
      p?.status === "profile-found"
        ? "**UUID matched** · " +
          p.modeCount +
          " modes · " +
          (p.points ?? "—") +
          " points" +
          (p.overall ? " · #" + p.overall : "") +
          (p.badgeCount ? " · " + p.badgeCount + " badges" : "")
        : (networkProfileLabel[p?.status] || "Not checked") +
          (p?.failure ? " · " + p.failure : "");
    const link =
      p?.identity === "discord-match"
        ? "Linked Discord matches"
        : p?.identity === "different-discord"
          ? "Linked Discord differs: `" +
            p.linkedDiscord +
            "` · may be stale; not proof of an alt"
          : p?.identity === "discord-not-provided"
            ? "Discord link not published by this profile"
            : "Discord link: not checked";
    const access =
      external.discoveredDiscordGuilds == null
        ? "Unknown · server discovery failed"
        : known.size === 0
          ? "Invite directory unresolved"
          : connected + " of " + known.size + " known servers connected";
    return {
      name:
        (p?.status === "profile-found"
          ? "🟢 "
          : p?.status === "unavailable"
            ? "🟠 "
            : "⚪ ") + network.name,
      value:
        "[Website](" +
        network.url +
        ") · " +
        (p?.apiUrl
          ? "[Public API](" + p.apiUrl + ")"
          : "[Directory](" + network.directorySource + ")") +
        "\n" +
        profile +
        "\n" +
        link +
        "\n**Discord access:** " +
        access +
        "\n" +
        network.modes.length +
        " published mode links",
      inline: false,
    };
  });
  return {
    title: "🔎 Tier Network Coverage",
    color: 0x8b70f5,
    description:
      "Identity, ranks and linked accounts. These public APIs do not supply ban history; use **Evidence** for accessible Discord records.",
    fields,
    footer: {
      text:
        "Directory snapshot " +
        tierNetworkDirectory.researchedAt +
        " · Unresolved invites are not counted as readable servers",
    },
    timestamp: external.checkedAt,
  };
}

export function reviewPresentation(
  base,
  external,
  profiles,
  target,
  view = "overview",
) {
  const allowed = ["overview", "stats", "evidence", "networks"];
  if (!allowed.includes(view)) view = "overview";
  const fields = base.embeds.flatMap((e) => e.fields || []),
    pick = (names) =>
      names.map((name) => fields.find((f) => f.name === name)).filter(Boolean);
  let embeds;
  if (view === "stats") embeds = base.embeds;
  else if (view === "evidence") {
    const embed = externalBanEmbed(external),
      reading = external.messageReading;
    if (reading) {
      embed.fields.push({
        name: "Moderation Messages",
        value:
          external.discoveredDiscordGuilds == null
            ? "Not run · server discovery failed. Retry this check."
            : !reading.installedNetworkGuilds && !reading.channelsRead
              ? "Not run · no known network server connected. Partner access is required."
              : reading.channelsRead +
                " channels read · " +
                reading.unavailable +
                " unavailable · " +
                reading.references.length +
                " references\n" +
                (reading.partial ? "Partial scan. " : "") +
                "Up to 20 recent messages in 2 moderation channels per connected network server. References can include appeals and unbans.",
        inline: false,
      });
      for (const ref of reading.references.slice(0, 3))
        embed.fields.push({
          name: "Message Reference · " + ref.network,
          value:
            "[View source message](" +
            ref.url +
            ") · " +
            ref.matchedBy +
            "\n" +
            ref.excerpt,
          inline: false,
        });
    }
    embeds = [embed];
  } else if (view === "networks")
    embeds = [reviewNetworkCard(profiles, external)];
  else {
    const matched = profiles.filter((p) => p.status === "profile-found").length,
      links = profiles.filter((p) => p.identity === "discord-match").length,
      diff = profiles.filter((p) => p.identity === "different-discord").length,
      unlinked = profiles.filter(
        (p) => p.identity === "discord-not-provided",
      ).length,
      checked = external.sources.filter(
        (s) =>
          s.kind === "discord" && ["ban-found", "no-ban"].includes(s.status),
      ).length;
    embeds = [
      {
        title: "🛡 Account Review",
        color: external.findings.length ? 0xe05f74 : 0x8b70f5,
        description: "<@" + target + "> · **Alt relationship: unknown.**",
        ...(base.embeds[0].thumbnail
          ? { thumbnail: base.embeds[0].thumbnail }
          : {}),
        fields: pick([
          "Minecraft IGN",
          "Account Age",
          "Server Tenure",
          "Local Ban",
          "Moderation Cases",
          "Testing Restrictions",
          "Official Tests",
          "Peak Placement",
          "Retest Cooldowns",
        ]),
        footer: {
          text: "Private staff review · Facts and source coverage, no automatic penalties",
        },
        timestamp: external.checkedAt,
      },
      {
        title: "🌐 Evidence Snapshot",
        color: 0x54c8c2,
        fields: [
          {
            name: "External Discord Bans",
            value:
              external.findings.length +
              " confirmed · " +
              (external.discoveredDiscordGuilds == null
                ? "coverage unknown"
                : checked + " servers checked"),
            inline: true,
          },
          {
            name: "Other Bot Servers",
            value:
              external.discoveredDiscordGuilds == null
                ? "Unknown · discovery failed"
                : String(external.discoveredDiscordGuilds),
            inline: true,
          },
          {
            name: "Tier Profiles",
            value:
              matched +
              "/3 UUID matched" +
              (profiles.some((p) => p.status === "unavailable")
                ? " · some lookups failed"
                : ""),
            inline: true,
          },
          {
            name: "Published Discord Links",
            value:
              links +
              " match · " +
              diff +
              " differ · " +
              unlinked +
              " unpublished · " +
              (3 - matched) +
              " not checked",
            inline: false,
          },
        ],
        description:
          "Use **Evidence** for source details or **Networks** for MCTiers, PvPTiers and SubTiers. A missing record does not mean a clean account.",
      },
    ];
  }
  return {
    content: "",
    allowed_mentions: { parse: [] },
    embeds,
    components: [
      {
        type: 1,
        components: allowed.map((key) => ({
          type: 2,
          style: key === view ? 1 : 2,
          label: {
            overview: "Overview",
            stats: "Full Stats",
            evidence: "Evidence",
            networks: "Networks",
          }[key],
          custom_id: "review:view:" + key + ":" + target,
        })),
      },
    ],
  };
}
