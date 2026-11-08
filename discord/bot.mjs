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
const session = new SlashCommandBuilder()
  .setName("session")
  .setDescription("Tester: manage testing availability");
const preferences = new SlashCommandBuilder()
  .setName("preferences")
  .setDescription("Choose your own mode interests and region")
  .addStringOption((o) => mode(o).setRequired(false))
  .addStringOption((o) =>
    o
      .setName("region")
      .setDescription("Set your region interest role")
      .addChoices(
        ...["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"].map((v) => ({
          name: v,
          value: v,
        })),
      ),
  );
for (const action of ["open", "pause", "close"])
  session.addSubcommand((s) =>
    s
      .setName(action)
      .setDescription(`${action} a testing session`)
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
      )
      .addIntegerOption((o) =>
        o
          .setName("capacity")
          .setDescription("Maximum open entries, 1–200")
          .setMinValue(1)
          .setMaxValue(200),
      )
      .addIntegerOption((o) =>
        o
          .setName("cooldown")
          .setDescription("Retest cooldown in hours, 0–720")
          .setMinValue(0)
          .setMaxValue(720),
      ),
  );
const appeal = new SlashCommandBuilder()
  .setName("appeal")
  .setDescription("Private test appeals")
  .addSubcommand((s) =>
    s
      .setName("submit")
      .setDescription("Appeal your test result privately")
      .addStringOption((o) =>
        o
          .setName("id")
          .setDescription("Your completed test ID")
          .setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("reason")
          .setDescription(
            "Explain the appeal without private personal information",
          )
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(2000),
      ),
  )
  .addSubcommand((s) =>
    s.setName("status").setDescription("View your own appeal status"),
  )
  .addSubcommand((s) =>
    s
      .setName("review")
      .setDescription("Moderator: review pending appeals or decide one")
      .addStringOption((o) =>
        o.setName("id").setDescription("Appeal ID; omit to list pending"),
      )
      .addStringOption((o) =>
        o
          .setName("decision")
          .setDescription("Review outcome")
          .addChoices(
            { name: "Uphold result", value: "uphold" },
            { name: "Revoke result", value: "revoke" },
          ),
      )
      .addStringOption((o) =>
        o
          .setName("reason")
          .setDescription("Explain your decision")
          .setMinLength(10)
          .setMaxLength(2000),
      ),
  );
await new REST()
  .setToken(process.env.DISCORD_TOKEN)
  .put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID,
      process.env.DISCORD_GUILD_ID,
    ),
    {
      body: [queue, claim, result, verify, session, appeal, preferences].map(
        (c) => c.toJSON(),
      ),
    },
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
    if (i.commandName === "preferences") {
      const member = await i.guild.members.fetch(actor);
      await i.guild.roles.fetch();
      const changes = [];
      if (get("mode")) {
        const name = config.modes.find((m) => m.id === get("mode")).name;
        const role = i.guild.roles.cache.find((r) => r.name === name);
        if (!role || role.permissions.bitfield !== 0n)
          throw Error(
            "The interest role is missing or has unsafe permissions. Ask staff to review setup.",
          );
        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          changes.push(name + " removed");
        } else {
          await member.roles.add(role);
          changes.push(name + " added");
        }
      }
      if (get("region")) {
        const all = ["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"];
        const target = i.guild.roles.cache.find(
          (r) => r.name === get("region"),
        );
        if (!target || target.permissions.bitfield !== 0n)
          throw Error("The region role is missing or has unsafe permissions.");
        for (const r of member.roles.cache.values())
          if (all.includes(r.name) && r.id !== target.id)
            await member.roles.remove(r);
        await member.roles.add(target);
        changes.push("Region " + get("region"));
      }
      message = changes.join(" · ") || "Choose a mode or region.";
    } else if (i.commandName === "session") {
      if (!tester && !mod)
        throw Error("Only testers and moderators can manage sessions.");
      const status = { open: "open", pause: "paused", close: "closed" }[
        i.options.getSubcommand()
      ];
      await api("session", {
        actor,
        mode: get("mode"),
        region: get("region"),
        status,
        capacity: i.options.getInteger("capacity") ?? 30,
        cooldown: i.options.getInteger("cooldown") ?? 72,
      });
      message = `${get("mode")} / ${get("region")} session ${status}.`;
    } else if (i.commandName === "appeal") {
      const sub = i.options.getSubcommand();
      if (sub === "submit") {
        const r = await api("appeals/submit", {
          actor,
          id: get("id"),
          reason: get("reason"),
        });
        message = `Private appeal recorded: ${r.id}. An independent moderator must review it.`;
      } else if (sub === "status") {
        const rows = await api("appeals?user=" + actor);
        message = rows.length
          ? rows
              .map(
                (r) =>
                  `${r.id} · ${r.status}${r.decision ? " · " + r.decision : ""}`,
              )
              .join("\n")
          : "You have no appeals.";
      } else {
        if (!mod) throw Error("Only moderators can review appeals.");
        if (!get("id")) {
          const rows = await api("appeals");
          message = rows.length
            ? rows
                .slice(0, 10)
                .map((r) => `${r.id} · result ${r.result_id} · ${r.reason}`)
                .join("\n")
            : "No pending appeals.";
        } else {
          await api("appeals/review", {
            actor,
            id: get("id"),
            decision: get("decision"),
            reason: get("reason"),
          });
          message =
            "Appeal decision saved. Revoked results are excluded from current rankings.";
        }
      }
    } else if (i.commandName === "queue") {
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
    if (
      ["session", "result", "appeal", "queue", "claim"].includes(i.commandName)
    ) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        new URL("../data/results.json", import.meta.url),
        JSON.stringify(await api("rankings"), null, 2),
      );
      await writeFile(
        new URL("../data/testing.json", import.meta.url),
        JSON.stringify(await api("testing"), null, 2),
      );
    }
    await i.editReply({
      content: (message || "Unknown command.").slice(0, 1900),
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
