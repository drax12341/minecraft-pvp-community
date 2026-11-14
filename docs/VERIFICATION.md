# Minecraft ownership verification

`/verify start name:<Java username>` and the existing Verify Account button now work without a configured Minecraft ownership server. When `MINECRAFT_VERIFICATION_SERVER` and `MINECRAFT_PROOF_SECRET` are both present, the original online-mode server challenge remains available. Otherwise the bot provides a temporary skin challenge.

## Player flow

1. Enter the Minecraft Java username in Discord.
2. Save the usual skin, download the challenge PNG, and apply it through the official Minecraft skin page or launcher. Use the Classic model for the temporary skin.
3. Click **Check verification**, or use `/verify check`.
4. After confirmation, restore the usual skin. The Minecraft UUID stays linked to the Discord identity and the Verified role is synchronized through the existing delivery outbox.

The same actions are supported from the website account verification dialog when Discord website sign-in has been configured.

## Ownership proof

The PNG is an original 64×64 Java skin. Its chest pixels contain a challenge-specific pattern derived from the random, expiring ownership challenge. Verification resolves the saved UUID through Mojang's official session server and fetches only a strictly validated `textures.minecraft.net` URL. It compares decoded pixels, so PNG recompression and scanline filters do not break proof. The bot never asks for Microsoft passwords, Minecraft access tokens or a downloaded executable.

Challenges are bound to the Discord user and verified UUID, expire after 45 minutes for skin proof (ten minutes for online-server proof), can be replaced no more than once per minute and can be checked no more than once per fifteen seconds. Finalization uses the same transactional account linking constraints and outbox as server-based proof. Duplicate account links, consumed challenges and expired proof cannot finalize again.

The PNG decoder accepts only bounded 64×64, eight-bit RGB/RGBA images, verifies PNG chunk checksums, supports all five standard scanline filters and bounds compressed and decompressed sizes. Texture redirects and arbitrary external URLs are rejected. Only a matching official UUID texture can confirm ownership.

The Verified role now falls back to the role installed by `/setup` when no explicit environment override exists. Missing mappings or failed Discord role updates stay retryable rather than being silently marked delivered.

## Checks and deployment

Run `npm.cmd test`, `npm.cmd audit --omit=dev --audit-level=high`, `npm.cmd run build:cloud`, and `node --check dist/server/index.js`. Tests cover the no-server path, pixel proof, RGB/RGBA recompression, expiry, UUID isolation, repeat confirmation, official endpoint fallback and installed-role discovery.

After deploying the Worker and migration 0018, update only the verification command with:

`node --env-file=.env discord/register-verification.mjs`

The server proof integration remains optional. Website OAuth credentials are unrelated to Discord's verification command. Actual verification still requires the player to apply the skin on their own Minecraft account; development tests do not create production competitors.

## Hosted network compatibility

Production probes confirmed HTTP 403 responses from both official account lookup endpoints and the session-profile endpoint on the hosted network. Lookup now falls back to MineTools and PlayerDB. Relayed profile properties are accepted only after RSA verification against Mojang?s official profile-property public keys pinned in config/mojang-texture-keys.mjs. Unsigned relay names never grant ownership. The final verified name and UUID come from the signed property.

Skin proof first compares the signed texture content hash to the exact generated challenge PNG hash. If they differ, the official texture is fetched and its pixels checked; relayed profiles also require the PNG?s SHA-256 to match the signed texture URL. Arbitrary relay images are never accepted. Cached profiles cannot match a fresh challenge until the provider updates. The longer skin challenge window accommodates relay caches.

The authenticated GET /api/internal/verification-health endpoint probes actual production name lookup, signature verification and texture access without creating or linking accounts. HTTP errors, invalid JSON and missing usernames have separate diagnostic outcomes.
