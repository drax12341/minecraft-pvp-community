const utf8 = new TextEncoder();
export async function tokenHash(value) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", utf8.encode(value))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function beginVerification(store, user, name, request = fetch) {
  if (!/^\w{3,16}$/.test(name || ""))
    throw Error("Enter a Java username of 3 to 16 characters.");
  if (await store.one("SELECT 1 FROM accounts WHERE discord=?", user))
    throw Error(
      "Your account is already linked. Contact account support to recover it.",
    );
  const recent = await store.one(
    "SELECT created FROM account_challenges WHERE user=?",
    user,
  );
  if (recent && Date.now() - Date.parse(recent.created) < 60000)
    throw Error("Wait one minute before replacing your challenge.");
  const response = await request(
    "https://api.mojang.com/users/profiles/minecraft/" +
      encodeURIComponent(name),
    { signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok)
    throw Error(
      "Minecraft profile could not be resolved. Check the username and try again.",
    );
  const profile = await response.json();
  if (
    !/^[a-f0-9]{32}$/i.test(profile.id || "") ||
    !/^\w{3,16}$/.test(profile.name || "")
  )
    throw Error("Invalid Minecraft profile response.");
  const uuid = profile.id
    .toLowerCase()
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  if (await store.one("SELECT 1 FROM accounts WHERE uuid=?", uuid))
    throw Error(
      "This Minecraft account is already linked. Contact account support.",
    );
  const code = crypto.randomUUID().replaceAll("-", ""),
    created = new Date().toISOString(),
    expires = new Date(Date.now() + 10 * 60000).toISOString();
  await store
    .statement(
      "INSERT INTO account_challenges VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(user) DO UPDATE SET uuid=excluded.uuid,name=excluded.name,token_hash=excluded.token_hash,created=excluded.created,expires=excluded.expires,consumed=NULL",
      user,
      uuid,
      profile.name,
      await tokenHash(code),
      created,
      expires,
    )
    .run();
  return { code, expires, name: profile.name };
}
// Called only after the worker authenticates the trusted online-mode server.
export async function finishVerification(store, code, uuid, name) {
  if (!/^[a-f0-9]{32}$/.test(code || "") || !/^\w{3,16}$/.test(name || ""))
    throw Error("Invalid ownership challenge.");
  const hash = await tokenHash(code),
    now = new Date().toISOString();
  const challenge = await store.one(
    "SELECT * FROM account_challenges WHERE token_hash=? AND uuid=? AND consumed IS NULL AND expires>?",
    hash,
    uuid,
    now,
  );
  if (!challenge)
    throw Error("Invalid, expired or consumed ownership challenge.");
  const results = await store.db.batch([
    store.statement(
      `INSERT INTO accounts(discord,uuid,name,verified_by,verified_at)
      SELECT user,uuid,?,'online-server',? FROM account_challenges WHERE token_hash=? AND uuid=? AND consumed IS NULL AND expires>?
      AND NOT EXISTS(SELECT 1 FROM accounts WHERE discord=account_challenges.user OR uuid=account_challenges.uuid)`,
      name,
      now,
      hash,
      uuid,
      now,
    ),
    store.statement(
      `UPDATE account_challenges SET consumed=? WHERE token_hash=? AND consumed IS NULL AND EXISTS(SELECT 1 FROM accounts a WHERE a.discord=account_challenges.user AND a.uuid=account_challenges.uuid AND a.verified_at=?)`,
      now,
      hash,
      now,
    ),
    store.statement(
      "INSERT OR IGNORE INTO outbox_events(kind,subject,available_at,created) SELECT 'verified-role',user,?,? FROM account_challenges WHERE token_hash=? AND consumed=?",
      now,
      now,
      hash,
      now,
    ),
    store.audit("online-server", "ownership-proof-attempt", challenge.user),
  ]);
  if (!results[0].meta.changes)
    throw Error(
      "Ownership challenge was consumed or account is already linked.",
    );
  return { verified: true };
}
