import { test } from "node:test";
import assert from "node:assert/strict";
import {
  playerIdentity,
  renderPlayerIdentity,
} from "../web/player-identity.js";
test("identity URLs use the permanent UUID rather than a mutable display name", () => {
  const id = playerIdentity({
    uuid: "069A79F444E94726A5BEFCA90E38AAF5",
    name: "SomeoneElse",
  });
  assert.equal(id.uuid, "069a79f4-44e9-4726-a5be-fca90e38aaf5");
  assert.equal(id.nameMC, "https://namemc.com/profile/" + id.uuid);
  assert.equal(id.texture, "https://mc-heads.net/skin/" + id.uuid);
});
test("samples, malformed identifiers and injected URLs never become external profiles", () => {
  for (const p of [
    { uuid: "preview-1", demo: true },
    { uuid: "javascript:alert(1)" },
    { uuid: "https://evil.test" },
    { uuid: "a".repeat(31) },
    { uuid: "00000000-0000-0000-0000-000000000001", demo: true },
    { uuid: "069a-79f444e94726a5befca90e38aaf5" },
  ]) {
    assert.equal(playerIdentity(p), null);
    assert.equal(renderPlayerIdentity(p), "");
  }
});
test("identity panel escapes public names, labels sources and opens NameMC safely", () => {
  const html = renderPlayerIdentity({
    uuid: "069a79f444e94726a5befca90e38aaf5",
    name: '<img onerror="x">',
  });
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes('alt="<img'));
  assert.match(html, /NameMC/);
  assert.match(html, /MCHeads/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /data-skin-view="front"/);
});
