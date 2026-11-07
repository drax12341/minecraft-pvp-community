import { mkdir, readFile, writeFile } from "node:fs/promises";
const config = JSON.parse(await readFile("config/community.json"));
const snapshot = JSON.parse(await readFile("data/mctiers.json"));
const content = `Find your next rival in Minecraft PvP Community.\n\nExplore ${snapshot.players.length} attributed MCTiers profiles, compare tiers and find communities across ${config.modes.length} modes. Community testing is preparing to launch.\n\nWebsite: https://minecraft-pvp-community.draxion0.chatgpt.site\nJoin: ${config.invite}\n\nIndependent community. External rankings are timestamped snapshots, not our own test results.`;
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
