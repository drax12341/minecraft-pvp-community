import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
await mkdir("dist/data", { recursive: true });
const { deskPaths, deskTiers, testingDeskCommands } =
  await import("../config/testing-desk.mjs");
const { communityDeskCommands } = await import("../config/community-desk.mjs");
await mkdir("web/data", { recursive: true });
await writeFile(
  "web/data/testing-desk.json",
  JSON.stringify({
    paths: deskPaths,
    tiers: deskTiers,
    commands: [...testingDeskCommands, ...communityDeskCommands],
  }),
);
await writeFile(
  "dist/data/testing-desk.json",
  JSON.stringify({
    paths: deskPaths,
    tiers: deskTiers,
    commands: [...testingDeskCommands, ...communityDeskCommands],
  }),
);
await cp("web", "dist", { recursive: true });
for (const name of ["community", "results", "testing"])
  await cp(
    name === "community" ? "config/community.json" : `data/${name}.json`,
    `dist/data/${name}.json`,
  );
// Remove retired provider assets and superseded website designs from reused builds.
for (const name of [
  "data/mctiers.json",
  "app.js",
  "style.css",
  "arena.css",
  "impact.css",
  "league.css",
  "nightfall.css",
  "testing-desk.css",
  "tierlist.css",
  "assets/impact-mace.svg",
])
  await rm(`dist/${name}`, { force: true });
console.log("Independent tierlist built in dist/");
