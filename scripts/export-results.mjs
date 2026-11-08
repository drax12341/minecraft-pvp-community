import { Store } from "../server/store.mjs";
import { readFile, writeFile } from "node:fs/promises";
const config = JSON.parse(await readFile("config/community.json"));
const store = new Store();
await writeFile(
  "data/results.json",
  JSON.stringify(store.rankings(config.points), null, 2),
);
await writeFile("data/testing.json", JSON.stringify(store.testing(), null, 2));
store.close();
console.log(
  "Exported this tierlist’s rankings and anonymous session availability.",
);
