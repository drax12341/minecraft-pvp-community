# IGN-only registration

The server owner explicitly selected IGN-only verification. Enter a Minecraft Java username through the existing Verify Account button or `/verify start name:<IGN>`. A resolved username is immediately linked to its UUID, the bot replies VERIFIED, and the Verified Discord role is queued. There are no skin uploads, game-server challenges or additional confirmation steps.

These registrations use `verified_by='ign-link'`. They establish a validated username link, not proof of Minecraft account control. The public profile API exposes `ownershipVerified=false` for these links; ownership labels are not silently granted. The Verified role must remain a role without Discord permissions.

Existing account links and Minecraft UUID uniqueness are preserved. Duplicate clicks are idempotent. A username already linked to another Discord user requires staff correction. Current tiers and history are not modified by linking.

Old skin-download URLs return 410 and the skin challenge codec is excluded from the production Worker bundle. Old Check buttons recover through the saved IGN rather than requiring a skin. Legacy ownership-proof source tests remain for audit/regression history.

Run `npm.cmd test`, `npm.cmd run build:cloud`, and `node --check dist/server/index.js`; publish the built Worker and update the Discord command with `node --env-file=.env discord/register-verification.mjs`.
