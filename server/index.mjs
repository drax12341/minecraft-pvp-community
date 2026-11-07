import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { Store } from "./store.mjs";
const config = JSON.parse(
  await readFile(new URL("../config/community.json", import.meta.url)),
);
export function createApp({
  store = new Store(),
  token = process.env.ADMIN_TOKEN,
  root = resolve("dist"),
} = {}) {
  const modes = new Set(config.modes.map((m) => m.id)),
    regions = new Set(["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"]);
  const json = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  const authorized = (req) => {
    const supplied = Buffer.from(req.headers.authorization || ""),
      expected = Buffer.from(`Bearer ${token}`);
    return (
      token?.length >= 32 &&
      supplied.length === expected.length &&
      timingSafeEqual(supplied, expected)
    );
  };
  const validId = (s) => typeof s === "string" && /^\d{5,22}$/.test(s);
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/health")
        return json(res, 200, { ok: true });
      if (
        req.method === "GET" &&
        (url.pathname === "/api/rankings" ||
          url.pathname === "/data/results.json")
      )
        return json(res, 200, store.rankings(config.points));
      if (req.method === "GET" && url.pathname.startsWith("/api/profile/")) {
        const uuid = url.pathname.split("/").pop();
        const p = store
          .rankings(config.points)
          .players.find((p) => p.uuid === uuid);
        return json(res, p ? 200 : 404, p || { error: "Player not found" });
      }
      if (url.pathname.startsWith("/api/")) {
        if (!authorized(req))
          return json(res, 401, { error: "Authentication required" });
        if (req.method === "GET" && url.pathname === "/api/queue")
          return json(res, 200, store.list(url.searchParams.get("mode")));
        if (req.method !== "POST")
          return json(res, 405, { error: "Method not allowed" });
        let body = "",
          size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 8192) return json(res, 413, { error: "Body too large" });
          body += chunk;
        }
        let b;
        try {
          b = JSON.parse(body);
        } catch {
          return json(res, 400, { error: "Invalid JSON" });
        }
        if (!validId(b.actor))
          return json(res, 400, { error: "A Discord actor ID is required" });
        if (url.pathname === "/api/verify") {
          if (
            !validId(b.user) ||
            !/^([a-f0-9]{32}|[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(
              b.uuid || "",
            ) ||
            !/^\w{3,16}$/.test(b.name || "")
          )
            return json(res, 400, { error: "Invalid verified account" });
          const compact = b.uuid.replaceAll("-", "").toLowerCase();
          const uuid = compact.replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5",
          );
          store.verify(b.user, uuid, b.name, b.actor);
          return json(res, 200, { ok: true });
        }
        if (url.pathname === "/api/queue/join") {
          if (!modes.has(b.mode) || !regions.has(b.region))
            return json(res, 400, { error: "Invalid mode or region" });
          return json(res, 201, { id: store.join(b.actor, b.mode, b.region) });
        }
        if (url.pathname === "/api/queue/leave") {
          if (!modes.has(b.mode))
            return json(res, 400, { error: "Invalid mode" });
          return json(res, 200, { cancelled: store.leave(b.actor, b.mode) });
        }
        if (url.pathname === "/api/queue/claim") {
          store.claim(b.id, b.actor);
          return json(res, 200, { ok: true });
        }
        if (url.pathname === "/api/results") {
          if (
            !Number.isInteger(b.tier) ||
            b.tier < 1 ||
            b.tier > 5 ||
            ![0, 1].includes(b.pos) ||
            typeof b.evidence !== "string" ||
            b.evidence.length > 1000 ||
            !URL.canParse(b.evidence) ||
            new URL(b.evidence).protocol !== "https:"
          )
            return json(res, 400, {
              error: "A valid tier and HTTPS evidence link are required",
            });
          return json(res, 201, { player: store.result(b, b.actor) });
        }
        return json(res, 404, { error: "Unknown route" });
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        return json(res, 405, { error: "Method not allowed" });
      let pathname = decodeURIComponent(url.pathname);
      const path = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!path.startsWith(root + sep))
        return json(res, 403, { error: "Forbidden" });
      if (!(await stat(path)).isFile())
        return json(res, 404, { error: "Not found" });
      const data = await readFile(path);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".json": "application/json",
            ".svg": "image/svg+xml",
          }[extname(path)] || "application/octet-stream",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch (e) {
      if (e.code === "ENOENT") return json(res, 404, { error: "Not found" });
      if (/already|claimed|verify|verification|assigned/.test(e.message))
        return json(res, 409, { error: e.message });
      console.error(e.message);
      json(res, 500, { error: "Request failed" });
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createApp();
  app.listen(Number(process.env.PORT || 8787), "127.0.0.1", () =>
    console.log(
      `Community running at http://127.0.0.1:${process.env.PORT || 8787}`,
    ),
  );
}
