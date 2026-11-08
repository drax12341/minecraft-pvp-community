import { readFile } from "node:fs/promises";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits as P,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
const config = JSON.parse(
  await readFile(new URL("../config/community.json", import.meta.url)),
);
export const plan = {
  roles: [
    "Community Moderator",
    "Tier Tester",
    "Event Host",
    "Creator",
    "Supporter",
    "Member",
    ...Object.keys(config.points),
    ...["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"],
    ...config.modes.map((m) => m.name),
  ],
  categories: {
    "Start here": [
      "welcome",
      "rules",
      "announcements",
      "choose-your-modes",
      "how-to-test",
    ],
    Community: [
      "general",
      "introductions",
      "find-a-duel",
      "clips-and-highlights",
      "guides-and-coaching",
      "tester-recruitment",
    ],
    Competition: ["test-queue", "test-results", "events", "looking-for-team"],
    "Main mode testing": config.modes
      .filter((m) => m.group === "Main modes")
      .map((m) => m.id + "-testing"),
    "Submode testing": config.modes
      .filter((m) => m.group === "Submodes")
      .map((m) => m.id + "-testing"),
    Support: ["help", "appeals", "sponsorships"],
    Staff: ["staff-chat", "test-review", "moderation-log"],
  },
};
if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify(plan, null, 2));
  console.log(
    "Dry run only. To create missing roles/channels: set DISCORD_TOKEN and DISCORD_GUILD_ID in .env, invite the bot, then npm run discord:apply. No existing channels are deleted or renamed.",
  );
} else {
  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_GUILD_ID)
    throw Error("DISCORD_TOKEN and DISCORD_GUILD_ID required");
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  try {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    await guild.roles.fetch();
    await guild.channels.fetch();
    for (const name of plan.roles)
      if (!guild.roles.cache.some((r) => r.name === name))
        await guild.roles.create({
          name,
          permissions: [],
          mentionable: false,
          colors: {
            primaryColor: config.modes.find((m) => m.name === name)?.color
              ? Number.parseInt(
                  config.modes.find((m) => m.name === name).color.slice(1),
                  16,
                )
              : name === "Tier Tester"
                ? 0x69d6ed
                : name === "Community Moderator"
                  ? 0xad91ef
                  : 0x8e9ab0,
          },
          reason: "Community setup",
        });
    const moderator = guild.roles.cache.find(
      (r) => r.name === "Community Moderator",
    );
    const tester = guild.roles.cache.find((r) => r.name === "Tier Tester");
    const me = await guild.members.fetchMe();
    const skipped = [];
    for (const name of [
      "welcome",
      "rules",
      "announcements",
      "how-to-test",
      "test-results",
      "choose-your-modes",
    ]) {
      const channel = guild.channels.cache.find(
        (c) => c.name === name && c.type === ChannelType.GuildText,
      );
      if (channel) {
        try {
          await channel.permissionOverwrites.edit(
            me.id,
            {
              ViewChannel: true,
              SendMessages: true,
              EmbedLinks: true,
              ReadMessageHistory: true,
            },
            {
              reason:
                "Allow community bot to publish onboarding in read-only channels",
            },
          );
        } catch (error) {
          if (error.code !== 50013) throw error;
          console.warn(
            `Existing #${name} permissions need a server administrator to allow this bot to send messages.`,
          );
        }
      }
    }
    for (const [category, names] of Object.entries(plan.categories)) {
      let parent = guild.channels.cache.find(
        (c) => c.name === category && c.type === ChannelType.GuildCategory,
      );
      const permissions =
        category === "Staff"
          ? [
              { id: guild.id, deny: [P.ViewChannel] },
              {
                id: moderator.id,
                allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory],
              },
              {
                id: tester.id,
                allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory],
              },
              {
                id: me.id,
                allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory],
              },
            ]
          : undefined;
      if (!parent)
        parent = await guild.channels.create({
          name: category,
          type: ChannelType.GuildCategory,
          permissionOverwrites: permissions,
        });
      if (
        category === "Staff" &&
        !parent.permissionOverwrites.cache
          .get(guild.id)
          ?.deny.has(P.ViewChannel)
      )
        throw Error(
          "Existing Staff category is not private. Setup stopped; review permissions manually.",
        );
      for (const name of names)
        if (
          !guild.channels.cache.some(
            (c) => c.name === name && c.parentId === parent.id,
          )
        ) {
          const readOnly = [
            "welcome",
            "rules",
            "announcements",
            "how-to-test",
            "test-results",
          ].includes(name);
          const overwrites =
            permissions ??
            (readOnly
              ? [
                  { id: guild.id, deny: [P.SendMessages] },
                  { id: moderator.id, allow: [P.SendMessages] },
                  { id: me.id, allow: [P.SendMessages] },
                ]
              : undefined);
          await guild.channels.create({
            name,
            type: ChannelType.GuildText,
            parent: parent.id,
            permissionOverwrites: overwrites,
            topic: `Minecraft PvP Community • ${name.replaceAll("-", " ")}`,
          });
        }
    }
    const panels = {
      welcome: [
        "Welcome to Minecraft PvP Tierlist",
        "One tierlist. Earned in game.\n\nChoose your modes, meet practice partners and earn a placement through our own testing team. All rankings belong to this community. Start with #rules and #how-to-test.",
      ],
      rules: [
        "Play fair. Treat people well.",
        "No cheating, macros, boosting, account sharing, harassment or doxxing.\n\nNever share passwords or install unknown files for a test. Agree on the kit, version, arena and evidence with your tester. Sponsors cannot buy ranks or testing advantages. Private appeals use /appeal submit.",
      ],
      "how-to-test": [
        "From first match to your next tier",
        "1. Ask staff to verify Minecraft account ownership.\n2. Choose a mode and region.\n3. Join an open session using /queue join.\n4. Wait for a tester to claim your entry.\n5. Play your test and review your evidence-linked result.\n\nDefault retest cooldown: 72 hours. Availability and kit rules must be announced before sessions open.",
      ],
      "test-queue": [
        "Testing desk",
        "Use /queue join to enter an open session, /queue list to check your entries and /queue leave to cancel a waiting entry.\n\nStaff: /session open, /session pause, /session close. Testers: /claim and /result. Never announce testing as open until staff are ready.",
      ],
      appeals: [
        "Need a second review?",
        "Use /appeal submit with your completed test ID and a clear reason. Replies are private. /appeal status shows your decisions.\n\nThe original tester cannot decide their own appeal. Do not post private information or accusations in this channel.",
      ],
      sponsorships: [
        "Support the arena",
        "Support tools, hosting or an agreed community event. Every sponsor placement is disclosed. No payments collected by the website; discuss terms with staff. Sponsors never influence tiers or appeals.",
      ],
      "choose-your-modes": [
        "Choose your playstyle",
        "Use /preferences to toggle a mode interest role or select your region after the bot is running. Mode roles only control interests; they never grant staff permissions.",
      ],
    };
    for (const [name, [title, description]] of Object.entries(panels)) {
      const channel = guild.channels.cache.find(
        (c) => c.name === name && c.type === ChannelType.GuildText,
      );
      if (!channel) continue;
      if (
        !channel
          .permissionsFor(me)
          ?.has([
            P.ViewChannel,
            P.SendMessages,
            P.EmbedLinks,
            P.ReadMessageHistory,
          ])
      ) {
        skipped.push(name);
        continue;
      }
      const existing = await channel.messages.fetch({ limit: 30 });
      const marker = "Minecraft PvP Tierlist · setup-v2 · " + name;
      if (
        existing.some(
          (m) =>
            m.author.id === me.id &&
            m.embeds.some((e) => e.footer?.text === marker),
        )
      )
        continue;
      const embed = new EmbedBuilder()
        .setColor(0x69d6ed)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: marker });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Rankings")
          .setStyle(ButtonStyle.Link)
          .setURL("https://drax12341.github.io/minecraft-pvp-community/"),
        new ButtonBuilder()
          .setLabel("Testing center")
          .setStyle(ButtonStyle.Link)
          .setURL(
            "https://drax12341.github.io/minecraft-pvp-community/#testing",
          ),
      );
      await channel.send({
        embeds: [embed],
        components: [row],
        allowedMentions: { parse: [] },
      });
    }
    console.log(
      `Roles/channels configured in ${guild.name}. Configure TESTER_ROLE_ID=${tester.id} and MODERATOR_ROLE_ID=${moderator.id}.`,
    );
    if (skipped.length)
      console.warn(
        `Onboarding panels still blocked in: ${skipped.join(", ")}. Existing messages were preserved.`,
      );
  } finally {
    client.destroy();
  }
}
