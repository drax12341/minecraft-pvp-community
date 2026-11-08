import { mkdir, readFile, writeFile } from "node:fs/promises";
const config = JSON.parse(await readFile("config/community.json"));

const content = `Minecraft PvP Tierlist — one tierlist, earned in game.\n\nExplore our independent tier board, kit guides and testing center across ${config.modes.length} modes. Testing availability is announced by staff.\n\nWebsite: https://drax12341.github.io/minecraft-pvp-community/\nJoin: ${config.invite}\n\nNo imported ranks. No paid tiers.`;
await mkdir("promotion", { recursive: true });
await writeFile("promotion/weekly-draft.txt", content);
if (process.argv.includes("--send")) {
  const endpoint = process.env.DISCORD_ANNOUNCEMENT_WEBHOOK;
  if (!endpoint)
    throw Error("Configure an announcement webhook for a channel you own.");
  const u = new URL(endpoint);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "discord.com" ||
    !/^\/api\/webhooks\/\d+\/[\w-]+$/.test(u.pathname)
  )
    throw Error("Only Discord announcement webhooks are supported");
  const r = await fetch(u, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  if (!r.ok) throw Error(`Discord rejected announcement (${r.status})`);
  console.log("Posted one announcement to the configured community channel.");
} else console.log("Weekly promotion draft generated. Nothing was posted.");
