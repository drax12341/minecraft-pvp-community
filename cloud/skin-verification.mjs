import { minecraftProfileCandidates } from "./minecraft-profile.mjs";
import { tokenHash, consumeOwnershipChallenge } from "./verification.mjs";
const verificationSite =
  "https://minecraft-pvp-community.draxion0.chatgpt.site";
const skinSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const skinU32 = (bytes, n) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(n);
function skinCRC(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function skinChunk(type, bytes) {
  const out = new Uint8Array(bytes.length + 12),
    view = new DataView(out.buffer);
  view.setUint32(0, bytes.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(bytes, 8);
  view.setUint32(out.length - 4, skinCRC(out.subarray(4, out.length - 4)));
  return out;
}
function joinSkinBytes(parts) {
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let offset = 0;
  for (const bytes of parts) {
    out.set(bytes, offset);
    offset += bytes.length;
  }
  return out;
}
async function skinReadLimited(stream, limit) {
  const reader = stream.getReader(),
    parts = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw Error("PNG exceeds the allowed size.");
      parts.push(value);
    }
    return joinSkinBytes(parts);
  } finally {
    await reader.cancel().catch(() => {});
  }
}
function skinProofPixel(hash, x, y) {
  const cell = (y - 20) * 8 + (x - 20),
    index = (cell * 6) % 64;
  return [
    parseInt(hash.slice(index, index + 2), 16),
    parseInt(hash.slice((index + 2) % 64, ((index + 2) % 64) + 2), 16),
    parseInt(hash.slice((index + 4) % 64, ((index + 4) % 64) + 2), 16),
    255,
  ];
}
/** Original, valid 64x64 Java skin. A challenge-specific opaque chest pattern proves control. */
export async function createVerificationSkin(hash) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw Error("Invalid skin challenge.");
  const raw = new Uint8Array(64 * (64 * 4 + 1));
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let color = [34, 28, 58, 255];
      if (y < 16) color = [168, 151, 213, 255];
      if (y >= 16 && y < 32) color = [94, 70, 160, 255];
      if (y >= 32) color = [37, 43, 72, 255];
      if (
        (y < 16 && x >= 32) ||
        (y >= 32 && y < 48) ||
        (y >= 48 && (x < 16 || x >= 48))
      )
        color = [0, 0, 0, 0];
      if (x >= 20 && x < 28 && y >= 20 && y < 28)
        color = skinProofPixel(hash, x, y);
      raw.set(color, y * 257 + 1 + x * 4);
    }
  }
  const header = new Uint8Array(13),
    view = new DataView(header.buffer);
  view.setUint32(0, 64);
  view.setUint32(4, 64);
  header[8] = 8;
  header[9] = 6;
  const compressed = new Uint8Array(
    await new Response(
      new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer(),
  );
  return joinSkinBytes([
    skinSignature,
    skinChunk("IHDR", header),
    skinChunk("IDAT", compressed),
    skinChunk("IEND", new Uint8Array()),
  ]);
}
const skinPaeth = (a, b, c) => {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
export async function matchesVerificationSkin(png, hash) {
  if (
    png.length < 33 ||
    png.length > 131072 ||
    skinSignature.some((v, n) => png[n] !== v)
  )
    throw Error("Invalid PNG skin.");
  let channels = 0,
    ended = false,
    seenHeader = false;
  const chunks = [];
  let length = 0;
  for (let offset = 8; offset + 12 <= png.length;) {
    const size = skinU32(png, offset),
      end = offset + 12 + size;
    if (end > png.length) throw Error("Invalid PNG chunk.");
    const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8)),
      bytes = png.subarray(offset + 8, offset + 8 + size);
    if (
      skinCRC(png.subarray(offset + 4, offset + 8 + size)) !==
      skinU32(png, offset + 8 + size)
    )
      throw Error("Invalid PNG checksum.");
    if (type === "IHDR") {
      if (
        seenHeader ||
        offset !== 8 ||
        size !== 13 ||
        skinU32(bytes, 0) !== 64 ||
        skinU32(bytes, 4) !== 64 ||
        bytes[8] !== 8 ||
        ![2, 6].includes(bytes[9]) ||
        bytes[10] ||
        bytes[11] ||
        bytes[12]
      )
        throw Error("Unsupported PNG skin format.");
      channels = bytes[9] === 6 ? 4 : 3;
      seenHeader = true;
    } else if (type === "IDAT") {
      if (!seenHeader) throw Error("Invalid PNG header.");
      chunks.push(bytes);
      length += bytes.length;
    } else if (type === "IEND") {
      ended = true;
      break;
    }
    offset = end;
  }
  if (!channels || !ended || !length) throw Error("Incomplete PNG skin.");
  const stride = 64 * channels,
    raw = await skinReadLimited(
      new Blob([joinSkinBytes(chunks)])
        .stream()
        .pipeThrough(new DecompressionStream("deflate")),
      (stride + 1) * 64,
    );
  if (raw.length !== (stride + 1) * 64) throw Error("Invalid PNG pixels.");
  const pixels = new Uint8Array(stride * 64);
  for (let y = 0; y < 64; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw Error("Invalid PNG filter.");
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0,
        b = y ? pixels[(y - 1) * stride + x] : 0,
        c = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0,
        add =
          filter === 0
            ? 0
            : filter === 1
              ? a
              : filter === 2
                ? b
                : filter === 3
                  ? Math.floor((a + b) / 2)
                  : skinPaeth(a, b, c);
      pixels[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + add) & 255;
    }
  }
  let mismatch = 0;
  for (let y = 20; y < 28; y++)
    for (let x = 20; x < 28; x++) {
      const expected = skinProofPixel(hash, x, y),
        index = y * stride + x * channels;
      for (let c = 0; c < channels; c++)
        mismatch |= pixels[index + c] ^ expected[c];
    }
  return mismatch === 0;
}
const skinCheckButtons = () => [
  {
    type: 1,
    components: [
      {
        type: 2,
        style: 1,
        label: "Check verification",
        custom_id: "verify:check",
      },
    ],
  },
];
export function skinVerificationInstructions(challenge) {
  return {
    content:
      "**VERIFY YOUR MINECRAFT ACCOUNT**\nMinecraft: **" +
      challenge.name +
      "**\n\n1. Download your temporary skin below.\n2. Open the official Minecraft skin page (or Launcher → Skins) and upload this PNG to **" +
      challenge.name +
      "**. Choose the Classic model. Save your usual skin first.\n3. Click **Check verification** below.\n\nYou can restore your usual skin immediately after verification. No game server is required.\nExpires <t:" +
      Math.floor(Date.parse(challenge.expires) / 1000) +
      ":R>. Keep this challenge private.",
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Download verification skin",
            url: verificationSite + "/verify/skin/" + challenge.code + ".png",
          },
          {
            type: 2,
            style: 5,
            label: "Open Minecraft skins",
            url: "https://www.minecraft.net/en-us/msaprofile/mygames/editskin",
          },
          {
            type: 2,
            style: 1,
            label: "Check verification",
            custom_id: "verify:check",
          },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
export async function verificationDownload(request, store) {
  const code = new URL(request.url).pathname.match(
    /^\/verify\/skin\/([a-f0-9]{32})\.png$/,
  )?.[1];
  if (!code)
    return new Response("Verification skin not found.", { status: 404 });
  const hash = await tokenHash(code),
    challenge = await store.one(
      "SELECT 1 FROM account_challenges WHERE token_hash=? AND method='skin' AND consumed IS NULL AND expires>?",
      hash,
      new Date().toISOString(),
    );
  if (!challenge)
    return new Response(
      "This verification skin expired or was already used. Start verification again in Discord.",
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  return new Response(
    request.method === "HEAD" ? null : await createVerificationSkin(hash),
    {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="mace-verification.png"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}
async function skinDigest(png) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", png)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function skinCandidateMatches(challenge, candidate, provider) {
  try {
    const property = candidate.profile.properties?.find(
      (p) => p.name === "textures",
    );
    if (typeof property?.value !== "string" || property.value.length > 32000)
      return false;
    const textures = JSON.parse(atob(property.value));
    if (
      textures.profileId?.toLowerCase() !==
      challenge.uuid.replaceAll("-", "").toLowerCase()
    )
      return false;
    const url = new URL(textures.textures?.SKIN?.url || "");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.hostname !== "textures.minecraft.net" ||
      url.port ||
      url.username ||
      url.password ||
      !/^\/texture\/[a-f0-9]{32,128}$/i.test(url.pathname)
    )
      return false;
    const textureHash = url.pathname.split("/").at(-1).toLowerCase();
    if (
      textureHash ===
      (await skinDigest(await createVerificationSkin(challenge.token_hash)))
    )
      return true;
    url.protocol = "https:";
    const image = await provider(url.href, {
      redirect: "error",
      signal: AbortSignal.timeout(4500),
    });
    if (
      !image.ok ||
      !image.headers.get("Content-Type")?.startsWith("image/png")
    ) {
      await image.body?.cancel();
      return false;
    }
    const png = await skinReadLimited(image.body, 131072);
    if (candidate.signatureVerified && (await skinDigest(png)) !== textureHash)
      return false;
    return await matchesVerificationSkin(png, challenge.token_hash);
  } catch {
    return false;
  }
}
export async function checkSkinVerification(store, user, provider = fetch) {
  const linked = await store.one(
    "SELECT name FROM accounts WHERE discord=?",
    user,
  );
  if (linked)
    return {
      content:
        "**" +
        linked.name +
        "** is already verified. Your linked account is ready for testing.",
      components: [],
      allowed_mentions: { parse: [] },
    };
  const now = new Date().toISOString(),
    challenge = await store
      .statement(
        "UPDATE account_challenges SET last_checked=? WHERE user=? AND method='skin' AND consumed IS NULL AND expires>? AND (last_checked IS NULL OR last_checked<?) RETURNING *",
        now,
        user,
        now,
        new Date(Date.now() - 15000).toISOString(),
      )
      .first();
  if (!challenge) {
    const saved = await store.one(
      "SELECT method,expires,consumed FROM account_challenges WHERE user=?",
      user,
    );
    return {
      content:
        saved &&
        saved.method === "skin" &&
        !saved.consumed &&
        Date.parse(saved.expires) > Date.now()
          ? "Wait 15 seconds before checking again. Minecraft may take a moment to publish your skin."
          : "Start a new verification with **/verify start** and your Java username.",
      components: skinCheckButtons(),
    };
  }
  try {
    const candidates = await minecraftProfileCandidates(
      challenge.uuid,
      provider,
    );
    let profile = null;
    for (const candidate of candidates) {
      if (await skinCandidateMatches(challenge, candidate, provider)) {
        profile = candidate.profile;
        break;
      }
    }
    if (!profile)
      return {
        content:
          "**Skin not confirmed yet**\nMake sure the downloaded verification PNG is applied to **" +
          challenge.name +
          "** on your Java account. Minecraft profile caches may take time to refresh. Keep the temporary skin applied and check again; your challenge remains active.",
        components: skinCheckButtons(),
      };
    await consumeOwnershipChallenge(
      store,
      challenge.token_hash,
      challenge.uuid,
      profile.name,
      "skin",
    );
    return {
      content:
        "**MINECRAFT ACCOUNT VERIFIED**\n**" +
        profile.name +
        "** is now linked to your Discord account. You can restore your usual skin now.\n\nYour Verified role is synchronizing. Choose your region and Mace mode in the testing dashboard to continue.",
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 2,
              label: "Find a test",
              custom_id: "community:boards",
            },
            {
              type: 2,
              style: 5,
              label: "View my profile",
              url: verificationSite + "/players/" + challenge.uuid,
            },
          ],
        },
      ],
      allowed_mentions: { parse: [] },
    };
  } catch {
    return {
      content:
        "Verification is not confirmed yet. Apply your downloaded temporary skin to your Java account, then click **Check verification** again. Minecraft’s profile service may need a moment to update. Your challenge is preserved.",
      components: skinCheckButtons(),
    };
  }
}
