import { mkdir, readFile, writeFile, cp, readdir } from "node:fs/promises";
await import("./build.mjs");
const config = JSON.parse(await readFile("config/community.json", "utf8"));
let worker = `const config = ${JSON.stringify(config)};\n`;
const siteAssets={};
async function collect(dir,prefix=""){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=prefix+"/"+entry.name;
    if(entry.isDirectory())await collect(dir+"/"+entry.name,path);
    else{
      const extension=entry.name.split(".").at(-1),type={html:"text/html; charset=utf-8",css:"text/css; charset=utf-8",js:"text/javascript; charset=utf-8",json:"application/json; charset=utf-8",svg:"image/svg+xml",png:"image/png"}[extension];
      // The large existing arena scene remains on its retained origin.
      if(type && entry.name!=='arena-v2.png')siteAssets[path]={body:await readFile(dir+"/"+entry.name,extension==='png'?'base64':'utf8'),type,binary:extension==='png'};
    }
  }
}
await collect("web");
worker+=`const siteAssets = ${JSON.stringify(siteAssets)};\n`;
for (const path of ["config/kit-manifests.mjs","config/community-roles.mjs","config/rubrics.mjs","config/testing-desk.mjs","config/community-desk.mjs","config/phase-checks.mjs","cloud/store.mjs","cloud/loadouts.mjs","cloud/operations-store.mjs","cloud/operations.mjs","cloud/journeys.mjs","cloud/testing-desk.mjs","cloud/community-desk.mjs","cloud/commands.mjs","cloud/components.mjs","cloud/worker.mjs"]) {
  let source = await readFile(path, "utf8");
  source = source.replace(/^import[\s\S]*?;\r?\n/gm, "");
  worker += source + "\n";
}
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await writeFile("dist/server/index.js", worker);
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
console.log("Cloud Discord HTTP worker built; no credentials included.");
