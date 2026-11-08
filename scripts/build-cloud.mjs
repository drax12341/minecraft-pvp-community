import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
await import("./build.mjs");
const config = JSON.parse(await readFile("config/community.json", "utf8"));
let worker = `const config = ${JSON.stringify(config)};\n`;
for (const file of ["store", "commands", "worker"]) {
  let source = await readFile(`cloud/${file}.mjs`, "utf8");
  source = source.replace(/^import .*;\r?\n/gm, "");
  worker += source + "\n";
}
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await writeFile("dist/server/index.js", worker);
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
console.log("Cloud Discord HTTP worker built; no credentials included.");
