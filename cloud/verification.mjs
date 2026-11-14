import { lookupMinecraftAccount } from "./minecraft-lookup.mjs";
const utf8 = new TextEncoder();
export async function linkMinecraftIGN(store,user,input,provider=fetch){
 const existing=await store.one('SELECT name,uuid,verified_by,verified_at FROM accounts WHERE discord=?',user);if(existing)return existing;
 const name=typeof input==='string'?input.trim():'';if(!/^[A-Za-z0-9_]{3,16}$/.test(name))throw Error('Enter your Minecraft Java IGN (3–16 letters, numbers or underscores).');
 const lookup=await lookupMinecraftAccount(name,provider);if(!lookup.profile)throw Error(lookup.reason==='not-found'?'That Java IGN was not found. Check your in-game username.':'Minecraft username lookup is temporarily unavailable. Try again shortly.');
 const uuid=lookup.profile.id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5'),now=new Date().toISOString();
 await store.db.batch([
  store.statement("INSERT OR IGNORE INTO accounts(discord,uuid,name,verified_by,verified_at) VALUES(?,?,?,'ign-link',?)",user,uuid,lookup.profile.name,now),
  store.statement("INSERT INTO outbox_events(kind,subject,available_at,created) SELECT 'verified-role',discord,?,? FROM accounts WHERE discord=? AND uuid=? ON CONFLICT(kind,subject) DO UPDATE SET status='pending',available_at=excluded.available_at,last_error=NULL",now,now,user,uuid),
  store.statement('DELETE FROM account_challenges WHERE user=? AND EXISTS(SELECT 1 FROM accounts WHERE discord=? AND uuid=?)',user,user,uuid),
  store.audit(user,'ign-link-attempt',uuid)
 ]);
 const linked=await store.one('SELECT name,uuid,verified_by,verified_at FROM accounts WHERE discord=?',user);
 if(!linked||linked.uuid!==uuid)throw Error('This IGN is already linked to another Discord account. Staff can correct the existing link.');
 return linked;
}
export async function tokenHash(value) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", utf8.encode(value))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function beginVerification(
  store,
  user,
  name,
  request = fetch,
  method = "online-server",
) {
  name = typeof name === "string" ? name.trim() : name;
  if (!["online-server", "skin"].includes(method))
    throw Error("Invalid verification method.");
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
  const lookup = await lookupMinecraftAccount(name, request),
    profile = lookup.profile;
  if (!profile) {
    console.warn(
      "Minecraft identity lookup failed",
      JSON.stringify(lookup.attempts),
    );
    throw Error(
      lookup.reason === "not-found"
        ? "No Minecraft Java account was found with the name " +
            name +
            ". Enter your in-game Java username."
        : "Minecraft’s account lookup service is not responding correctly. Your account has not been changed. Try verification again shortly.",
    );
  }
  const uuid = profile.id
    .toLowerCase()
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  if (await store.one("SELECT 1 FROM accounts WHERE uuid=?", uuid))
    throw Error(
      "This Minecraft account is already linked. Contact account support.",
    );
  const code = crypto.randomUUID().replaceAll("-", ""),
    created = new Date().toISOString(),
    expires = new Date(
      Date.now() + (method === "skin" ? 45 : 10) * 60000,
    ).toISOString();
  await store
    .statement(
      "INSERT INTO account_challenges(user,uuid,name,token_hash,created,expires,consumed,method,last_checked) VALUES(?,?,?,?,?,?,NULL,?,NULL) ON CONFLICT(user) DO UPDATE SET uuid=excluded.uuid,name=excluded.name,token_hash=excluded.token_hash,created=excluded.created,expires=excluded.expires,consumed=NULL,method=excluded.method,last_checked=NULL",
      user,
      uuid,
      profile.name,
      await tokenHash(code),
      created,
      expires,
      method,
    )
    .run();
  return { code, expires, name: profile.name };
}
// Called only after the worker authenticates the trusted online-mode server.
export async function finishVerification(store, code, uuid, name) {
  if (!/^[a-f0-9]{32}$/.test(code || "") || !/^\w{3,16}$/.test(name || ""))
    throw Error("Invalid ownership challenge.");
  return consumeOwnershipChallenge(
    store,
    await tokenHash(code),
    uuid,
    name,
    "online-server",
  );
}
export async function consumeOwnershipChallenge(
  store,
  hash,
  uuid,
  name,
  method,
) {
  if (
    !/^[a-f0-9]{64}$/.test(hash) ||
    !/^\w{3,16}$/.test(name || "") ||
    !["online-server", "skin"].includes(method)
  )
    throw Error("Invalid ownership challenge.");
  const now = new Date().toISOString(),
    verifiedBy = method === "skin" ? "skin-challenge" : "online-server";
  const challenge = await store.one(
    "SELECT * FROM account_challenges WHERE token_hash=? AND uuid=? AND consumed IS NULL AND expires>? AND method=?",
    hash,
    uuid,
    now,
    method,
  );
  if (!challenge)
    throw Error("Invalid, expired or consumed ownership challenge.");
  const results = await store.db.batch([
    store.statement(
      `INSERT INTO accounts(discord,uuid,name,verified_by,verified_at)
      SELECT user,uuid,?,?,? FROM account_challenges WHERE token_hash=? AND uuid=? AND consumed IS NULL AND expires>? AND method=?
      AND NOT EXISTS(SELECT 1 FROM accounts WHERE discord=account_challenges.user OR uuid=account_challenges.uuid)`,
      name,
      verifiedBy,
      now,
      hash,
      uuid,
      now,
      method,
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
    store.audit(verifiedBy, "ownership-proof-attempt", challenge.user),
  ]);
  if (!results[0].meta.changes)
    throw Error(
      "Ownership challenge was consumed or account is already linked.",
    );
  return { verified: true };
}
