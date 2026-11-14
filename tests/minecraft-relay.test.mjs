import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  verifyMojangTextureProperty,
  minecraftProfileCandidates,
} from "../cloud/minecraft-profile.mjs";
import { lookupMinecraftAccount } from "../cloud/minecraft-lookup.mjs";
const fixture = JSON.parse(
  await readFile(
    new URL("./fixtures/mojang-signed-profile.json", import.meta.url),
    "utf8",
  ),
);
test('profile fallback is compatible with Workers, which rejects redirect error before sending requests',async()=>{const candidates=await minecraftProfileCandidates(fixture.id,async(url,init)=>{if(init.redirect==='error')throw new TypeError('Workers does not support redirect error');return url.includes('sessionserver')?new Response('Forbidden',{status:403}):url.includes('minetools')?Response.json({raw:fixture}):new Response('Unavailable',{status:503});});assert.equal(candidates.length,1);assert.equal(candidates[0].signatureVerified,true);});
test("real Mojang texture signatures verify against official public trust anchors", async () => {
  const property = fixture.properties.find((p) => p.name === "textures");
  const data = await verifyMojangTextureProperty(property, fixture.id);
  assert.equal(data.profileId, fixture.id);
  assert.equal(data.profileName, fixture.name);
  assert.equal(
    await verifyMojangTextureProperty(
      {
        ...property,
        value: btoa(JSON.stringify({ ...data, profileName: "Impersonator" })),
      },
      fixture.id,
    ),
    null,
  );
  assert.equal(
    await verifyMojangTextureProperty(property, "a".repeat(32)),
    null,
  );
  assert.equal(
    await verifyMojangTextureProperty(
      { ...property, signature: "" },
      fixture.id,
    ),
    null,
  );
});
test("blocked Microsoft endpoints can resolve a challenge name through a relay without granting verification", async () => {
  const result = await lookupMinecraftAccount("Notch", async (url) =>
    url.includes("api.minetools.eu/uuid/")
      ? Response.json({ id: fixture.id, name: fixture.name, status: "OK" })
      : new Response("Forbidden", { status: 403 }),
  );
  assert.equal(result.profile.id, fixture.id);
  assert.equal(result.attempts.at(-1).service, "minetools");
  assert.equal(result.attempts.at(-1).outcome, "resolved");
});
test("relayed profile identity comes from the signed property, and forged relay responses are rejected", async () => {
  const valid = await minecraftProfileCandidates(fixture.id, async (url) =>
    url.includes("sessionserver")
      ? new Response("Forbidden", { status: 403 })
      : url.includes("minetools")
        ? Response.json({ raw: { ...fixture, name: "Spoofed outer name" } })
        : new Response("Unavailable", { status: 503 }),
  );
  assert.equal(valid.length, 1);
  assert.equal(valid[0].profile.name, fixture.name);
  assert.equal(valid[0].signatureVerified, true);
  const forged = await minecraftProfileCandidates(fixture.id, async (url) =>
    url.includes("sessionserver")
      ? new Response("Forbidden", { status: 403 })
      : Response.json({
          raw: {
            ...fixture,
            properties: [
              { name: "textures", value: btoa("{}"), signature: "fake" },
            ],
          },
        }),
  );
  assert.deepEqual(forged, []);
});
