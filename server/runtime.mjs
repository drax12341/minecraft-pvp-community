import http from "node:http";
import { fork } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./index.mjs";
import { Store } from "./store.mjs";

// The administrative API stays on loopback. Only health and public snapshots
// are exposed to the hosting provider's ingress.
export async function startCommunity({
  env = process.env,
  botPath = fileURLToPath(new URL("../discord/bot.mjs", import.meta.url)),
  restartDelay = 2000,
} = {}) {
  for (const key of [
    "DISCORD_TOKEN",
    "DISCORD_CLIENT_ID",
    "DISCORD_GUILD_ID",
    "TESTER_ROLE_ID",
    "MODERATOR_ROLE_ID",
  ])
    if (!env[key]?.trim()) throw Error(`${key} is required`);
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32)
    throw Error("ADMIN_TOKEN must contain at least 32 characters");
  if (env.RAILWAY_ENVIRONMENT_ID && !env.RAILWAY_VOLUME_MOUNT_PATH)
    throw Error("Attach a persistent volume before starting on Railway");
  const databasePath =
    env.DATABASE_PATH ||
    resolve(env.RAILWAY_VOLUME_MOUNT_PATH || "data", "community.sqlite");
  await mkdir(dirname(databasePath), { recursive: true });
  const store = new Store(databasePath);
  const api = createApp({ store, token: env.ADMIN_TOKEN });
  const listen = (server, port, host) =>
    new Promise((done, reject) => {
      server.once("error", reject);
      server.listen(port, host, done);
    });
  await listen(api, Number(env.INTERNAL_API_PORT || 0), "127.0.0.1");
  const apiUrl = `http://127.0.0.1:${api.address().port}`;
  let child,
    stopping = false,
    timer,
    ready = false,
    lastStatus = 0,
    attempts = 0;
  const launch = () => {
    if (stopping) return;
    ready = false;
    child = fork(botPath, [], {
      env: { ...env, API_URL: apiUrl },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      windowsHide: true,
    });
    child.on("message", (message) => {
      if (message?.type !== "bot-status") return;
      ready = message.ready === true;
      lastStatus = Date.now();
      if (ready) attempts = 0;
    });
    child.on("error", () => console.error("Bot process failed to start."));
    child.once("exit", () => {
      ready = false;
      if (!stopping) {
        const delay = Math.min(
          60000,
          restartDelay * 2 ** Math.min(attempts++, 5),
        );
        console.error(`Bot stopped; restarting in ${delay}ms.`);
        timer = setTimeout(launch, delay);
      }
    });
  };
  const health = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    const path = new URL(req.url, "http://localhost").pathname;
    let body;
    if (path === "/healthz") {
      const online = ready && Date.now() - lastStatus < 90000;
      res.statusCode = online ? 200 : 503;
      body = { ok: online, bot: online ? "online" : "connecting" };
    } else if (path === "/data/results.json" || path === "/data/testing.json") {
      // Public snapshots contain neither Discord account IDs nor private appeals.
      fetch(apiUrl + path, { signal: AbortSignal.timeout(5000) })
        .then(async (upstream) => {
          res.statusCode = upstream.status;
          res.end(req.method === "HEAD" ? undefined : await upstream.text());
        })
        .catch(() => {
          res.statusCode = 503;
          res.end('{"error":"Unavailable"}');
        });
      return;
    } else {
      res.statusCode = 404;
      body = { error: "Not found" };
    }
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(body));
  });
  try {
    await listen(
      health,
      Number(env.PORT || 3000),
      env.RUNTIME_HOST ||
        (env.RAILWAY_ENVIRONMENT_ID ? "0.0.0.0" : "127.0.0.1"),
    );
  } catch (error) {
    await new Promise((done) => api.close(done));
    store.close();
    throw error;
  }
  launch();
  console.log(`Community runtime listening on port ${health.address().port}.`);
  return {
    port: health.address().port,
    async close() {
      stopping = true;
      clearTimeout(timer);
      if (child && child.exitCode === null) {
        const exited = new Promise((done) => child.once("exit", done));
        child.kill("SIGTERM");
        const force = setTimeout(() => child.kill("SIGKILL"), 5000);
        await exited;
        clearTimeout(force);
      }
      await Promise.all([
        new Promise((done) => health.close(done)),
        new Promise((done) => api.close(done)),
      ]);
      store.close();
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const runtime = await startCommunity();
  let stopping = false;
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, async () => {
      if (stopping) return;
      stopping = true;
      await runtime.close();
      process.exit(0);
    });
}
