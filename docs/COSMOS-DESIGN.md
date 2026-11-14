# Cosmos community edition

The supplied community emblem is used unchanged in the header, favicon, homepage orbital crest and login page. Mace submodes and competitive rules are unchanged. The surrounding design uses a deep-space backdrop, bounded procedural stars, nebula layers, a planet silhouette and gold/violet accents drawn from the artwork.

The starfield caps backing resolution to three million pixels, density to 65 stars on narrow screens / 145 on larger screens, and animation to 25fps. It pauses when hidden and becomes static when reduced motion is requested. CSS nebula, emblem and satellite effects follow the same motion controls. The CSS backdrop remains usable if canvas is unavailable.

## Verified appearance

The account overview now shows the linked Minecraft skin, ownership verification time, region, official test count, shared ranking points and per-mode current/peak tiers. These come from the same verified account and CloudStore rankings used by Discord. The navigation uses the linked Minecraft head after login.

`GET /api/v1/appearance/:uuid` accepts only UUIDs already present in the verified account database and rejects private profiles. `GET /api/v1/me/appearance` resolves only the authenticated user's saved UUID; frontend identifiers cannot select another account. Account skins never establish verification themselves.

SkinMC's public UUID profile redirects through search to a canonical profile. The resolver follows at most four hops, only on `https://skinmc.net`, validates the final `data-skin-uuid`, and extracts a strictly formatted SkinMC render ID. It has an eight-second overall timeout and one-megabyte HTML limit. No Discord credentials, cookies or user access tokens are sent to SkinMC.

The public profile markup is an external dependency rather than a documented stable API contract. A valid result is cached for one hour, provider failures for five minutes, and manual refreshes cannot bypass a one-minute minimum age. Previously valid SkinMC renders survive transient provider failures. Standard Minecraft previews remain available when SkinMC cannot resolve a profile or its image fails.

The skin panel supports full-body/head selection, refresh, SkinMC profile navigation and opening the resolved texture. It does not claim unsupported 3D rotation, account import, or ownership verification from SkinMC.

## Activation and validation

Discord website login still requires `DISCORD_CLIENT_SECRET` and the registered `/auth/discord/callback` URL described in WEBSITE-V12.md. Minecraft ownership still requires the server-side proof integration. No fake production player accounts were created for appearance testing.

Tests cover redirect handling, cross-site redirect rejection, UUID mismatch, private account isolation, caching, preview switching, fallback images, connected dashboard markup and bounded star generation. A real public SkinMC profile was resolved to a working PNG during development. Browser screenshots and an authenticated live login require browser access / configured credentials; those are separate from the automated checks.
