import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
await mkdir("dist/data", { recursive: true });
const {deskPaths,deskTiers,testingDeskCommands}=await import('../config/testing-desk.mjs');
const {communityDeskCommands}=await import('../config/community-desk.mjs');
await mkdir('web/data',{recursive:true});
await writeFile('web/data/testing-desk.json',JSON.stringify({paths:deskPaths,tiers:deskTiers,commands:[...testingDeskCommands,...communityDeskCommands]}));
await writeFile('dist/data/testing-desk.json',JSON.stringify({paths:deskPaths,tiers:deskTiers,commands:[...testingDeskCommands,...communityDeskCommands]}));
await cp("web", "dist", { recursive: true });
for (const name of ["community", "results", "testing"])
  await cp(
    name === "community" ? "config/community.json" : `data/${name}.json`,
    `dist/data/${name}.json`,
  );
// Remove obsolete external-provider artifacts from previous builds.
for (const name of ["data/mctiers.json", "app.js", "style.css"])
  await rm(`dist/${name}`, { force: true });
console.log("Independent tierlist built in dist/");
