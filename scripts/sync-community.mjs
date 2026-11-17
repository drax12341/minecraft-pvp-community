import { readFile, writeFile } from "node:fs/promises";
import { loadCommunityFeeds } from "../web/community-feed.js";

const config = JSON.parse(await readFile("config/community.json", "utf8"));
let snapshot;
try {
  snapshot = await loadCommunityFeeds({ config, allowSnapshot: false });
} catch {
  if (process.argv.includes("--required"))
    throw Error("The public Discord feed could not be synchronized.");
  console.warn(
    "Discord feed unavailable; retaining the checked-in public snapshot.",
  );
}
if (snapshot) {
  // Validation and field allowlisting finish before either public file is changed.
  await writeFile(
    "data/results.json",
    JSON.stringify(snapshot.data, null, 2) + "\n",
  );
  await writeFile(
    "data/testing.json",
    JSON.stringify(snapshot.testing, null, 2) + "\n",
  );
  console.log(
    `Synced ${snapshot.data.players.length} community players and ${snapshot.testing.sessions.length} testing sessions.`,
  );
}
