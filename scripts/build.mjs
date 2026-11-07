import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("dist/data", { recursive: true });
await cp("web", "dist", { recursive: true });
await cp("config/community.json", "dist/data/community.json");
try {
  await cp("data/mctiers.json", "dist/data/mctiers.json");
} catch {
  await writeFile(
    "dist/data/mctiers.json",
    JSON.stringify({
      updatedAt: null,
      players: [],
      error: "Snapshot not downloaded",
    }),
  );
}
await writeFile(
  "dist/data/results.json",
  await readFile("data/results.json", "utf8"),
);
console.log("Static website built in dist/");
