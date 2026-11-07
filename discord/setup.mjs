import { readFile } from "node:fs/promises";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits as P,
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
    ],
    Competition: ["test-queue", "test-results", "events", "looking-for-team"],
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
          reason: "Community setup",
        });
    const moderator = guild.roles.cache.find(
      (r) => r.name === "Community Moderator",
    );
    const tester = guild.roles.cache.find((r) => r.name === "Tier Tester");
    const me = await guild.members.fetchMe();
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
    console.log(
      `Verified setup in ${guild.name}. Configure TESTER_ROLE_ID=${tester.id} and MODERATOR_ROLE_ID=${moderator.id}. No messages were posted.`,
    );
  } finally {
    client.destroy();
  }
}
