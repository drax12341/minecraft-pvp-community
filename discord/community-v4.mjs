import { REST, Routes, PermissionFlagsBits as P } from "discord.js";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  referenceLayout,
  referenceGuides,
} from "../config/discord-reference.mjs";

export function referencePlan() {
  return {
    guild: "1568767259168608267",
    categories: referenceLayout,
    panels: Object.keys(referenceGuides),
    preservesMessages: true,
    preservesRoleAssignments: true,
  };
}
export async function applyCommunityReference(env = process.env) {
  const guild = env.DISCORD_GUILD_ID;
  if (guild !== referencePlan().guild || !env.DISCORD_TOKEN)
    throw Error("Expected own server and dedicated bot environment.");
  const rest = new REST().setToken(env.DISCORD_TOKEN),
    me = await rest.get(Routes.user("@me"));
  let channels = await rest.get(Routes.guildChannels(guild));
  const roles = await rest.get(Routes.guildRoles(guild));
  const report = { channels: [], panels: [], blocked: [], verified: [] };
  await mkdir(".runtime", { recursive: true });
  await writeFile(
    ".runtime/community-reference-before-" + Date.now() + ".json",
    JSON.stringify({ channels, roles }, null, 2),
  );
  const staff = roles.filter((r) =>
    [
      "Community Moderator",
      "Moderator",
      "Testing Manager",
      "Gamemode Manager",
      "Tier Tester",
      "Senior Tester",
    ].includes(r.name),
  );
  const write =
    P.ViewChannel |
    P.SendMessages |
    P.ReadMessageHistory |
    P.EmbedLinks |
    P.AttachFiles;
  const overwrites = (hidden = false, chat = false) => [
    {
      id: guild,
      type: 0,
      allow: String(
        hidden
          ? 0n
          : P.ViewChannel |
              P.ReadMessageHistory |
              (chat ? P.SendMessages | P.SendMessagesInThreads : 0n),
      ),
      deny: String(
        hidden
          ? P.ViewChannel
          : chat
            ? 0n
            : P.SendMessages |
              P.CreatePublicThreads |
              P.CreatePrivateThreads |
              P.SendMessagesInThreads,
      ),
    },
    ...staff.map((r) => ({
      id: r.id,
      type: 0,
      allow: String(write),
      deny: "0",
    })),
    { id: me.id, type: 1, allow: String(write | P.AddReactions), deny: "0" },
  ];
  const bySlug = new Map();
  async function ensure(name, type, parent, aliases = [], hidden = false) {
    let c = channels.find(
      (c) => c.type === type && [name, ...aliases].includes(c.name),
    );
    const body = { name, ...(parent ? { parent_id: parent } : {}) };
    if (c) {
      // Existing privacy overrides and channel IDs are retained, including live tickets.
      if (c.name !== name || (parent && c.parent_id !== parent))
        c = await rest.patch(Routes.channel(c.id), { body });
    } else {
      const chat =
        /general|media|chats|matchmaking$|duel|community-support|polls|events|suggestions|introductions|coaching/.test(
          name,
        );
      c = await rest.post(Routes.guildChannels(guild), {
        body: {
          ...body,
          type,
          permission_overwrites: overwrites(hidden, chat),
        },
      });
      channels.push(c);
    }
    report.channels.push({ id: c.id, name: c.name, type: c.type });
    return c;
  }
  const positions = [];
  for (const [position, group] of referenceLayout.entries()) {
    let parent;
    try {
      parent = await ensure(
        group.name,
        4,
        null,
        group.aliases || [],
        !!group.private,
      );
      positions.push({ id: parent.id, position });
    } catch (e) {
      report.blocked.push({ name: group.name, error: e.message });
      continue;
    }
    for (const [index, [name, ...aliases]] of group.channels.entries()) {
      try {
        const c = await ensure(name, 0, parent.id, aliases, !!group.private);
        bySlug.set(name.split("┃").at(-1), c);
        positions.push({ id: c.id, position: index });
      } catch (e) {
        report.blocked.push({ name, error: e.message });
      }
    }
  }
  await rest.patch(Routes.guildChannels(guild), { body: positions });
  // Keep all voice rooms usable; old archived voice rooms are moved without deleting history.
  const voice = report.channels.find((c) => c.name === "🔊 Voice");
  for (const c of channels.filter((c) => c.type === 2))
    if (voice)
      await rest.patch(Routes.channel(c.id), { body: { parent_id: voice.id } });
  const button = (label, custom_id) => ({
    type: 2,
    style: label === "Verify Account" || label === "Enter Waitlist" ? 1 : 2,
    label,
    custom_id,
  });
  for (const [slug, [title, description, actions = []]] of Object.entries(
    referenceGuides,
  )) {
    const c = bySlug.get(slug);
    if (!c) continue;
    try {
      const marker = "Mace Community · Reference refresh · " + slug;
      const messages = await rest.get(Routes.channelMessages(c.id), {
        query: new URLSearchParams({ limit: "100" }),
      });
      const old =
        messages.find(
          (m) =>
            m.author.id === me.id &&
            m.embeds?.some((e) => e.footer?.text === marker),
        ) ||
        messages.find(
          (m) =>
            m.author.id === me.id &&
            m.embeds?.some((e) =>
              /community-v4|Reference|setup|hub|wizard|Community/i.test(
                e.footer?.text || "",
              ),
            ) &&
            !(m.flags & 32768),
        );
      const components = [];
      for (let j = 0; j < actions.length; j += 2)
        components.push(button(actions[j], actions[j + 1]));
      const body = {
        content: "",
        embeds: [
          {
            title,
            description,
            color: slug === "request-test" ? 0xff087a : 0x7861e8,
            footer: { text: marker },
          },
        ],
        components: components.length ? [{ type: 1, components }] : [],
        allowed_mentions: { parse: [] },
      };
      const message = old
        ? await rest.patch(Routes.channelMessage(c.id, old.id), { body })
        : await rest.post(Routes.channelMessages(c.id), { body });
      await rest.patch(Routes.channel(c.id), {
        body: { topic: description.replaceAll("\n", " ").slice(0, 1000) },
      });
      const check = await rest.get(Routes.channelMessage(c.id, message.id));
      if (check.embeds?.[0]?.title !== title)
        throw Error("Panel read-back mismatch");
      report.panels.push({ slug, channel: c.id, message: message.id });
    } catch (e) {
      report.blocked.push({ name: slug, error: e.message });
    }
  }
  const current = await rest.get(Routes.guildChannels(guild));
  for (const c of report.channels) {
    if (!current.some((x) => x.id === c.id && x.name === c.name))
      throw Error("Channel read-back mismatch: " + c.name);
    report.verified.push(c.name);
  }
  await writeFile(
    ".runtime/community-reference-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        channels: report.channels.length,
        panels: report.panels.length,
        verified: report.verified.length,
        blocked: report.blocked,
      },
      null,
      2,
    ),
  );
  return report;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.includes("--apply")) await applyCommunityReference();
  else console.log(JSON.stringify(referencePlan(), null, 2));
}
