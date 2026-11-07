// Optional release/Pages setup using the user's existing Git credential helper.
// Credentials stay in process memory and are never logged or persisted.
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
if (!process.argv.includes("--pages") && !process.argv.includes("--release"))
  throw Error("Choose --pages or --release explicitly.");
const credential = spawnSync("git", ["credential", "fill"], {
  input: "protocol=https\nhost=github.com\n\n",
  encoding: "utf8",
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
  windowsHide: true,
});
if (credential.status !== 0)
  throw Error("GitHub Git authentication is unavailable.");
const fields = Object.fromEntries(
  credential.stdout
    .trim()
    .split("\n")
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const headers = {
  Authorization: `Bearer ${fields.password}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};
const repo = "drax12341/minecraft-pvp-community",
  base = `https://api.github.com/repos/${repo}`;
const request = async (path, method = "GET", body) => {
  const r = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const b = await r.json().catch(() => ({}));
  return { status: r.status, body: b };
};
if (process.argv.includes("--pages")) {
  let r = await request("/pages");
  if (r.status === 404)
    r = await request("/pages", "POST", { build_type: "workflow" });
  if (r.status >= 400)
    throw Error(`Pages setup returned ${r.status}: ${r.body.message}`);
  console.log(`GitHub Pages configured: ${r.body.html_url}`);
  const run = await request("/actions/workflows/pages.yml/dispatches", "POST", {
    ref: "main",
  });
  console.log(`Pages workflow dispatch status: ${run.status}`);
}
if (process.argv.includes("--release")) {
  let r = await request("/releases/tags/v0.1.0-experimental");
  if (r.status === 404)
    r = await request("/releases", "POST", {
      tag_name: "v0.1.0-experimental",
      target_commitish: "main",
      name: "Community Tier Tagger 0.1.0 — experimental Fabric 1.21.1",
      prerelease: true,
      body: "Original community tagger for Minecraft Java 1.21.1, Fabric Loader 0.16.14+ and Fabric API 0.116.6+1.21.1. Java 21+. Nametag/tablist source-aware tier labels, asynchronous snapshots, mode/source commands and opt-in highest-active fallback.\n\nBuild and platform tests passed locally. In-game rendering and mixin compatibility have NOT been smoke-tested. Only the top-50 MCTiers snapshot and published community results are available; absent profiles are unknown in this feed. Snapshots expire. This is not a tested stable release and does not implement every feature of the reference mods. See README and docs/STATUS.md for setup and limitations.",
    });
  if (r.status >= 400)
    throw Error(`Release returned ${r.status}: ${r.body.message}`);
  for (const name of [
    "community-tagger-0.1.0.jar",
    "community-tagger-0.1.0-sources.jar",
  ]) {
    if (r.body.assets?.some((a) => a.name === name)) continue;
    const bytes = await readFile(`tagger/build/libs/${name}`);
    const u =
      r.body.upload_url.split("{")[0] + `?name=${encodeURIComponent(name)}`;
    const asset = await fetch(u, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/java-archive" },
      body: bytes,
    });
    if (!asset.ok) throw Error(`Asset upload failed (${asset.status})`);
  }
  console.log(`Experimental release: ${r.body.html_url}`);
}
