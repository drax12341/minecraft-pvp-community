// Run only after the cloud Worker and its secrets/database are deployed.
import { mkdir, writeFile } from "node:fs/promises";
const endpoint =
  "https://minecraft-pvp-community.draxion0.chatgpt.site/discord/interactions";
if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID)
  throw Error("Configure the local bot environment first.");
const headers = {
  Authorization: "Bot " + process.env.DISCORD_TOKEN,
  "Content-Type": "application/json",
};
const url = "https://discord.com/api/v10/applications/@me";
const read = async () => {
  const response = await fetch(url, { headers });
  if (!response.ok)
    throw Error("Discord application lookup: HTTP " + response.status);
  const app = await response.json();
  if (app.id !== process.env.DISCORD_CLIENT_ID)
    throw Error("Application ID mismatch; no changes applied.");
  return app;
};
const app = await read();
if (process.argv.includes("--activate")) {
  const health = await fetch(
    endpoint.replace("/discord/interactions", "/healthz"),
  );
  const state = await health.json();
  if (
    !health.ok ||
    state.runtime !== "cloud-http" ||
    state.pcRequired !== false
  )
    throw Error(
      "Cloud deployment is not healthy; keeping existing command delivery.",
    );
  await mkdir(".runtime", { recursive: true });
  await writeFile(
    ".runtime/previous-endpoint.json",
    JSON.stringify({ endpoint: app.interactions_endpoint_url || null }),
  );
  const response = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ interactions_endpoint_url: endpoint }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error(
      "Discord activation failed: HTTP " +
        response.status +
        ", code " +
        (error.code || "unknown"),
    );
    process.exitCode = 1;
  } else {
    const current = await read();
    if (current.interactions_endpoint_url !== endpoint)
      throw Error("Discord did not retain the cloud endpoint.");
    console.log(
      "Discord verified and saved the cloud interactions endpoint: " + endpoint,
    );
  }
} else
  console.log(
    "Cloud command delivery configured: " +
      (app.interactions_endpoint_url === endpoint),
  );
