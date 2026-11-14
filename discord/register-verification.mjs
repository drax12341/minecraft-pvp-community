import { REST, Routes } from "discord.js";
import { communityCommands } from "./community-commands.mjs";
const env = process.env;
if (
  env.DISCORD_GUILD_ID !== "1568767259168608267" ||
  !env.DISCORD_TOKEN ||
  !env.DISCORD_CLIENT_ID
)
  throw Error("Expected community bot environment is required.");
const rest = new REST().setToken(env.DISCORD_TOKEN),
  route = Routes.applicationGuildCommands(
    env.DISCORD_CLIENT_ID,
    env.DISCORD_GUILD_ID,
  ),
  commands = await rest.get(route),
  definition = communityCommands.find((c) => c.name === "verify"),
  existing = commands.find((c) => c.name === "verify");
if (!definition) throw Error("Verification command definition missing.");
const saved = existing
  ? await rest.patch(
      Routes.applicationGuildCommand(
        env.DISCORD_CLIENT_ID,
        env.DISCORD_GUILD_ID,
        existing.id,
      ),
      { body: definition },
    )
  : await rest.post(route, { body: definition });
console.log(
  JSON.stringify({
    command: saved.name,
    options: saved.options.map((o) => o.name),
    updated: true,
  }),
);
