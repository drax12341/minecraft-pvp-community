import { spawnSync } from "node:child_process";
function run(args, allow = false) {
  const r = spawnSync("git", args, { encoding: "utf8", windowsHide: true });
  if (r.status !== 0 && !allow) throw Error(r.stderr || "Git command failed");
  return r;
}
await import("./export-results.mjs");
run(["add", "--", "data/results.json", "data/testing.json"]);
const changed = run(
  [
    "diff",
    "--cached",
    "--quiet",
    "--",
    "data/results.json",
    "data/testing.json",
  ],
  true,
);
if (changed.status === 0) {
  console.log("No public testing changes to publish.");
} else {
  run([
    "commit",
    "--only",
    "-m",
    "Publish independent tierlist testing results",
    "--",
    "data/results.json",
    "data/testing.json",
  ]);
  run(["push", "origin", "HEAD:main"]);
  console.log("Public testing export pushed. GitHub Pages will deploy it.");
}
