import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
} from "discord.js";
import { readFile } from "node:fs/promises";
const config = JSON.parse(
  await readFile(new URL("../config/community.json", import.meta.url)),
);
for (const key of [
  "DISCORD_TOKEN",
  "DISCORD_GUILD_ID",
  "DISCORD_CLIENT_ID",
  "ADMIN_TOKEN",
  "TESTER_ROLE_ID",
  "MODERATOR_ROLE_ID",
])
  if (!process.env[key]) throw Error(`${key} is required`);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const mode = (o) =>
  o
    .setName("mode")
    .setDescription("Game mode")
    .setRequired(true)
    .addChoices(...config.modes.map((m) => ({ name: m.name, value: m.id })));
const queue = new SlashCommandBuilder()
  .setName("queue")
  .setDescription("Join or leave a testing queue")
  .addSubcommand((s) =>
    s
      .setName("join")
      .setDescription("Join a queue")
      .addStringOption(mode)
      .addStringOption((o) =>
        o
          .setName("region")
          .setDescription("Region")
          .setRequired(true)
          .addChoices(
            ...["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"].map((v) => ({
              name: v,
              value: v,
            })),
          ),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("leave")
      .setDescription("Leave a waiting queue")
      .addStringOption(mode),
  )
  .addSubcommand((s) =>
    s.setName("list").setDescription("List your open entries"),
  );
const claim = new SlashCommandBuilder()
  .setName("claim")
  .setDescription("Tester: claim a queue entry")
  .addStringOption((o) =>
    o.setName("id").setDescription("Queue entry ID").setRequired(true),
  );
const result = new SlashCommandBuilder()
  .setName("result")
  .setDescription("Tester: publish your assigned test result")
  .addStringOption((o) =>
    o.setName("id").setDescription("Claimed queue ID").setRequired(true),
  )
  .addStringOption((o) =>
    o
      .setName("tier")
      .setDescription("Earned tier")
      .setRequired(true)
      .addChoices(
        ...Object.keys(config.points).map((v) => ({ name: v, value: v })),
      ),
  )
  .addStringOption((o) =>
    o
      .setName("evidence")
      .setDescription("HTTPS link to shareable match evidence")
      .setRequired(true),
  );
const verify = new SlashCommandBuilder()
  .setName("verify-account")
  .setDescription("Moderator: record independently verified account ownership")
  .addUserOption((o) =>
    o.setName("user").setDescription("Discord member").setRequired(true),
  )
  .addStringOption((o) =>
    o
      .setName("uuid")
      .setDescription("Verified Minecraft UUID")
      .setRequired(true),
  )
  .addStringOption((o) =>
    o.setName("name").setDescription("Minecraft username").setRequired(true),
  );
const api = async (path, data) => {
  const res = await fetch(
    `${process.env.API_URL || "http://127.0.0.1:8787"}/api/${path}`,
    {
      method: data ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(10000),
    },
  );
  const body = await res.json();
  if (!res.ok) throw Error(body.error || "Service unavailable");
  return body;
};
await new REST()
  .setToken(process.env.DISCORD_TOKEN)
  .put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID,
      process.env.DISCORD_GUILD_ID,
    ),
    { body: [queue, claim, result, verify].map((c) => c.toJSON()) },
  );
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() || i.guildId !== process.env.DISCORD_GUILD_ID)
    return;
  await i.deferReply({ flags: 64 });
  try {
    const roles = i.member.roles;
    const hasRole = (id) =>
      Array.isArray(roles) ? roles.includes(id) : roles.cache.has(id);
    const mod = hasRole(process.env.MODERATOR_ROLE_ID),
      tester = hasRole(process.env.TESTER_ROLE_ID);
    const actor = i.user.id;
    const get = (n) => i.options.getString(n);
    let message;
    if (i.commandName === "queue") {
      const sub = i.options.getSubcommand();
      if (sub === "list") {
        const rows = (await api("queue")).filter(
          (r) => tester || r.user === actor,
        );
        message = rows.length
          ? rows
              .map((r) => `${r.mode} / ${r.region} / ${r.status} / ${r.id}`)
              .join("\n")
          : "You have no open entries.";
      } else if (sub === "join") {
        const b = await api("queue/join", {
          actor,
          mode: get("mode"),
          region: get("region"),
        });
        message = `Queue entry created: ${b.id}. A tester will claim it when available.`;
      } else {
        const b = await api("queue/leave", { actor, mode: get("mode") });
        message = b.cancelled
          ? "You left the queue."
          : "No waiting entry found. For claimed entries, contact your tester.";
      }
    } else if (i.commandName === "verify-account") {
      if (!mod) throw Error("Only Community Moderators can verify accounts.");
      await api("verify", {
        actor,
        user: i.options.getUser("user").id,
        uuid: get("uuid"),
        name: get("name"),
      });
      message =
        "Verified account saved. Staff must confirm ownership before using this command.";
    } else if (i.commandName === "claim") {
      if (!tester) throw Error("Only Tier Testers can claim tests.");
      await api("queue/claim", { actor, id: get("id") });
      message =
        "Test claimed. Agree on the kit, server and rules with the player.";
    } else if (i.commandName === "result") {
      if (!tester) throw Error("Only Tier Testers can record results.");
      const t = get("tier");
      await api("results", {
        actor,
        id: get("id"),
        tier: Number(t.slice(-1)),
        pos: t.startsWith("HT") ? 0 : 1,
        evidence: get("evidence"),
      });
      message =
        "Result saved with evidence and tester attribution. It is available on the local API; publish the static export to update the public site.";
    }
    await i.editReply({
      content: message || "Unknown command.",
      allowedMentions: { parse: [] },
    });
  } catch (e) {
    await i.editReply({
      content: e.message.slice(0, 1800),
      allowedMentions: { parse: [] },
    });
  }
});
await client.login(process.env.DISCORD_TOKEN);
console.log("Community bot connected.");
