import { Store } from "../server/store.mjs";
import { readFile, writeFile } from "node:fs/promises";
const config = JSON.parse(await readFile("config/community.json"));
const store = new Store();
await writeFile(
  "data/results.json",
  JSON.stringify(store.rankings(config.points), null, 2),
);
store.close();
console.log(
  "Exported public community rankings. Review evidence URLs before publishing.",
);
