import { mkdir, writeFile } from "node:fs/promises";
const response = await fetch(
  "https://mctiers.net/api/v2/mode/overall?count=50&from=0",
  {
    signal: AbortSignal.timeout(20000),
    headers: {
      "User-Agent": "MinecraftPvPCommunity/0.1 (public rankings snapshot)",
    },
  },
);
if (!response.ok)
  throw Error(
    `MCTiers returned ${response.status}; previous snapshot preserved`,
  );
const players = await response.json();
if (
  !Array.isArray(players) ||
  players.some((p) => !p.uuid || !p.name || !p.rankings)
)
  throw Error("Unexpected MCTiers response; previous snapshot preserved");
await mkdir("data", { recursive: true });
await writeFile(
  "data/mctiers.json",
  JSON.stringify(
    {
      provider: "mctiers",
      source: "https://mctiers.net/",
      scope: "Top 50 overall players, not the complete ladder",
      updatedAt: new Date().toISOString(),
      players,
    },
    null,
    2,
  ),
);
console.log(`Saved ${players.length} attributed MCTiers profiles`);
