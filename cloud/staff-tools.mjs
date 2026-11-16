import { readNetworkReferences } from "./network-references.mjs";
import { tierNetworkChecks } from "./tier-networks.mjs";
import { reviewPresentation } from "./review-presentation.mjs";
import { externalBanChecks, externalBanEmbed } from "./external-bans.mjs";
import { buildAccountReview } from "./account-review.mjs";
import config from "../config/community.json" with { type: "json" };
import { staffAccess } from "../config/community-roles.mjs";
import {
  commandRequirement,
  canUseCommand,
  enforceCommandPolicy,
  staffRoleDefinitions,
} from "../config/command-policy.mjs";
import { staffCommands } from "../config/staff-commands.mjs";

export const staffToolNames = new Set(staffCommands.map((c) => c.name));
const staffId = /^\d{5,22}$/;
const staffCard = (title, description, fields = [], color = 0x8b70f5) => ({
  content: "",
  embeds: [{ title, description, color, ...(fields.length ? { fields } : {}) }],
  allowed_mentions: { parse: [] },
});
const staffField = (name, value, inline = true) => ({
  name,
  value: String(value).slice(0, 1024),
  inline,
});
const staffProtectedNames = new Set([
  "Community Moderator",
  "Moderator",
  "Testing Manager",
  "Gamemode Manager",
  "Tier Tester",
  "Senior Tester",
  "Trainee Tester",
  "Support Team",
  "Helper",
  "Verified Player",
  ...staffRoleDefinitions.map((r) => r.name),
]);
export function accountCreatedAt(id) {
  if (!staffId.test(id)) throw Error("Choose a valid Discord account.");
  const time = Number((BigInt(id) >> 22n) + 1420070400000n);
  if (!Number.isSafeInteger(time) || time > Date.now())
    throw Error("Choose a valid Discord account.");
  return new Date(time).toISOString();
}
export function validateRoleChange({
  roles,
  role,
  actorRoles,
  botRoles,
  targetRoles,
  guild,
  owner,
  actor,
  target,
  sensitiveRoles = [],
  staffAssignment = false,
}) {
  if (!role || role.id === guild || role.managed)
    throw Error("This is a managed or protected role.");
  if (BigInt(role.permissions || "0") !== 0n)
    throw Error(
      "This role has protected Discord permissions. Use Discord server settings.",
    );
  if (
    /(?:^|\W)(HT|LT)[1-5](?:$|\W)/i.test(role.name) ||
    role.name === "Verified Player"
  )
    throw Error(
      "Earned tiers and verification roles are protected; use their official workflows.",
    );
  if (staffAssignment) {
    if (actor !== owner || !staffProtectedNames.has(role.name))
      throw Error("Only the owner can assign approved staff roles.");
  } else if (
    staffProtectedNames.has(role.name) ||
    sensitiveRoles.includes(role.id) ||
    Object.values(config.staffToolRoles || {}).some((ids) =>
      ids.includes(role.id),
    )
  )
    throw Error("This is a protected staff or private-access role.");
  if (target === owner)
    throw Error("The server owner cannot be changed through this tool.");
  const highest = (ids) =>
    Math.max(
      0,
      ...roles.filter((r) => ids.includes(r.id)).map((r) => r.position),
    );
  const botTop = highest(botRoles),
    actorTop = highest(actorRoles),
    targetTop = highest(targetRoles);
  if (
    role.position >= botTop ||
    targetTop >= botTop ||
    (actor !== owner && (role.position >= actorTop || targetTop >= actorTop))
  )
    throw Error(
      "Role or member is outside your role hierarchy or the bot hierarchy.",
    );
}
export async function runStaffTool(i, env, store, request = fetch) {
  enforceCommandPolicy(i, env);
  const { actor } = staffAccess(i, env),
    sub = i.data.options?.find((o) => o.type === 1),
    opts = sub?.options || i.data.options || [],
    get = (name) => opts.find((o) => o.name === name)?.value;
  const guild = env.DISCORD_GUILD_ID,
    base = "/guilds/" + guild,
    stamp = () => new Date().toISOString();
  const reason = () => {
    const text = get("reason");
    if (
      typeof text !== "string" ||
      text.trim().length < 10 ||
      text.length > 500
    )
      throw Error("Include an audit reason of 10–500 characters.");
    return text.trim();
  };
  const user = () => {
    if (!staffId.test(get("user")))
      throw Error("Choose a valid server member.");
    return get("user");
  };
  const api = async (path, method = "GET", body, optional = false) => {
    const response = await request("https://discord.com/api/v10" + path, {
      method,
      headers: {
        Authorization: "Bot " + env.DISCORD_TOKEN,
        "Content-Type": "application/json",
        ...(method !== "GET"
          ? {
              "X-Audit-Log-Reason": encodeURIComponent(
                ("Staff " + actor + ": " + reason()).slice(0, 450),
              ),
            }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (optional && [403, 404].includes(response.status))
      return { unavailable: response.status };
    if (!response.ok)
      throw Error(
        "Discord could not complete this action (HTTP " +
          response.status +
          "). Check bot permissions and role hierarchy.",
      );
    return response.status === 204 ? null : response.json();
  };
  const audit = (action, subject) => store.audit(actor, action, subject).run();
  const roleData = async (target) => {
    const [roles, bot, member, server] = await Promise.all([
      api(base + "/roles"),
      api(base + "/members/" + env.DISCORD_CLIENT_ID),
      api(base + "/members/" + target),
      api(base),
    ]);
    return { roles, bot, member, server };
  };
  switch (i.data.name) {
    case "alt-check": {
      const target = user();
      const [member, ban] = await Promise.all([
        api(base + "/members/" + target, "GET", undefined, true),
        api(base + "/bans/" + target, "GET", undefined, true),
      ]);
      const report = await buildAccountReview(store, target, member, ban);
      const identity = await store.one(
        "SELECT uuid,name FROM accounts WHERE discord=?",
        target,
      );
      const [external, networks] = await Promise.all([
        externalBanChecks(env, target, identity, request),
        tierNetworkChecks(identity, target, request),
      ]);
      external.messageReading = await readNetworkReferences(
        env,
        target,
        identity,
        external.installedDiscordGuildIds,
        request,
      );
      await audit("account-signal-check", target);
      return reviewPresentation(
        report,
        external,
        networks,
        target,
        get("view") || "overview",
      );
    }
    case "add-role":
    case "remove-role":
    case "staff": {
      if (i.data.name === "staff" && sub?.name === "roster") {
        const role = get("role");
        if (!staffId.test(role)) throw Error("Choose a staff role.");
        const roles = await api(base + "/roles"),
          chosen = roles.find((r) => r.id === role);
        if (!chosen || !staffProtectedNames.has(chosen.name))
          throw Error("Choose an approved staff role.");
        const members = await api(base + "/members?limit=1000");
        return staffCard(
          "👥 " + chosen.name,
          members
            .filter((m) => m.roles.includes(role))
            .slice(0, 30)
            .map((m) => "<@" + m.user.id + ">")
            .join("\n") || "No holders in the first 1,000 members.",
          [
            staffField(
              "Scope",
              "First 1,000 server members; unavailable if the bot lacks member-list access.",
              false,
            ),
          ],
        );
      }
      const target = user(),
        roleId = get("role");
      if (!staffId.test(roleId)) throw Error("Choose a valid role.");
      const { roles, bot, member, server } = await roleData(target),
        role = roles.find((r) => r.id === roleId),
        channels = await api(base + "/channels");
      const sensitiveRoles = [
        ...new Set(
          channels
            .filter((c) =>
              c.permission_overwrites?.some(
                (o) => o.id === guild && BigInt(o.deny) & 1024n,
              ),
            )
            .flatMap((c) =>
              c.permission_overwrites
                .filter((o) => o.type === 0 && BigInt(o.allow) & 1024n)
                .map((o) => o.id),
            ),
        ),
      ];
      const actorMember =
        actor === server.owner_id
          ? null
          : await api(base + "/members/" + actor);
      const staffAssignment = i.data.name === "staff";
      validateRoleChange({
        roles,
        role,
        actorRoles: actorMember?.roles || [],
        botRoles: bot.roles,
        targetRoles: member.roles,
        guild,
        owner: server.owner_id,
        actor,
        target,
        sensitiveRoles,
        staffAssignment,
      });
      if (staffAssignment && actor !== env.DISCORD_OWNER_ID)
        throw Error("Only the configured server owner can manage staff roles.");
      const remove = i.data.name === "remove-role" || sub?.name === "remove",
        has = member.roles.includes(roleId);
      if (has !== remove)
        return staffCard(
          "✓ No change needed",
          "<@" +
            target +
            "> " +
            (has ? "already has" : "does not have") +
            " <@&" +
            roleId +
            ">.",
        );
      const detail = target + "/" + roleId + ": " + reason();
      await audit("role-change-requested", detail);
      await api(
        base + "/members/" + target + "/roles/" + roleId,
        remove ? "DELETE" : "PUT",
      );
      const check = await api(base + "/members/" + target);
      if (check.roles.includes(roleId) === remove)
        throw Error(
          "Role read-back did not match. Ask staff to check the member before retrying.",
        );
      await audit(remove ? "role-removed" : "role-added", detail);
      return staffCard(
        remove ? "− Role Removed" : "✓ Role Added",
        "<@" + target + "> · <@&" + roleId + ">",
      );
    }
    case "role-info": {
      const roles = await api(base + "/roles"),
        r = roles.find((r) => r.id === get("role"));
      if (!r) throw Error("Role not found.");
      return staffCard("🎨 " + r.name, "<@&" + r.id + ">", [
        staffField("Position", r.position),
        staffField("Managed", r.managed ? "Yes" : "No"),
        staffField(
          "Protected",
          r.managed ||
            BigInt(r.permissions) !== 0n ||
            staffProtectedNames.has(r.name) ||
            /^(HT|LT)[1-5]$/.test(r.name)
            ? "Yes"
            : "Hierarchy and channel access checks apply",
        ),
      ]);
    }
    case "member-info": {
      const target = user(),
        m = await api(base + "/members/" + target),
        a = await store.one(
          "SELECT name FROM accounts WHERE discord=?",
          target,
        );
      await audit("member-inspection", target);
      return staffCard("👤 Member Overview", "<@" + target + ">", [
        staffField(
          "Created",
          "<t:" +
            Math.floor(Date.parse(accountCreatedAt(target)) / 1000) +
            ":D>",
        ),
        staffField(
          "Joined",
          m.joined_at
            ? "<t:" + Math.floor(Date.parse(m.joined_at) / 1000) + ":D>"
            : "Unknown",
        ),
        staffField("Minecraft", a?.name || "Not linked"),
        staffField(
          "Roles",
          m.roles
            .slice(0, 15)
            .map((r) => "<@&" + r + ">")
            .join(" ") || "None",
          false,
        ),
      ]);
    }
    case "server-info": {
      const [s, roles, channels, stats] = await Promise.all([
        api(base + "?with_counts=true"),
        api(base + "/roles"),
        api(base + "/channels"),
        store.one(
          "SELECT (SELECT count(*) FROM sessions WHERE status='open') queues,(SELECT count(*) FROM queue WHERE status='waiting') waiting,(SELECT count(*) FROM queue WHERE status='claimed') active,(SELECT count(*) FROM accounts) verified,(SELECT count(*) FROM results r WHERE record_type='test' AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id)) tests,(SELECT count(*) FROM tester_sessions WHERE ended IS NULL AND status='available') available",
        ),
      ]);
      const card = staffCard(
        "🌐 " + s.name,
        "**Community Snapshot** · Live Discord + testing records",
        [
          staffField("Members", s.approximate_member_count ?? "Unavailable"),
          staffField("Online", s.approximate_presence_count ?? "Unavailable"),
          staffField("Server Boosts", s.premium_subscription_count ?? 0),
          staffField("Channels", channels.filter((c) => c.type !== 4).length),
          staffField("Roles", roles.length - 1),
          staffField("Verified Players", stats.verified),
          staffField("Open Queues", stats.queues),
          staffField("Waiting / Testing", stats.waiting + " / " + stats.active),
          staffField("Available Tester Sessions", stats.available),
          staffField("Official Tests", stats.tests),
        ],
      );
      card.embeds[0].timestamp = stamp();
      if (s.icon && /^[a-zA-Z0-9_]+$/.test(s.icon))
        card.embeds[0].thumbnail = {
          url:
            "https://cdn.discordapp.com/icons/" +
            guild +
            "/" +
            s.icon +
            ".png?size=128",
        };
      return card;
    }
    case "staff-help":
    case "permissions": {
      const requested = get("command")?.replace(/^\//, "");
      if (requested) {
        const requirement = commandRequirement({ name: requested });
        if (!requirement)
          throw Error(
            "Unknown command, or a command that requires a subcommand.",
          );
        return staffCard(
          "🔑 /" + requested,
          canUseCommand(i, env, { name: requested })
            ? "Available to your roles."
            : "Requires **" + requirement + "** access.",
        );
      }
      const allowed = staffCommands.filter((c) =>
        canUseCommand(i, env, {
          name: c.name,
          options: c.options?.[0]?.type === 1 ? [c.options[0]] : [],
        }),
      );
      return staffCard(
        "🔑 Your Command Desk",
        allowed.map((c) => "`/" + c.name + "`").join(" · "),
        [
          staffField(
            "Testing",
            "`/start` · `/next` · `/match` · `/result`",
            false,
          ),
          staffField(
            "Access",
            "Actions are checked again when used. Staff roles never bypass assigned-test or independent-review checks.",
            false,
          ),
        ],
      );
    }
    case "security": {
      if (sub?.name === "status") {
        const [roles, bot, guilds] = await Promise.all([
          api(base + "/roles"),
          api(base + "/members/" + env.DISCORD_CLIENT_ID),
          api("/users/@me/guilds?limit=100").catch(() => null),
        ]);
        const bits = roles
          .filter((r) => r.id === guild || bot.roles.includes(r.id))
          .reduce((p, r) => p | BigInt(r.permissions), 0n);
        const can = (p) => !!(bits & 8n) || !!(bits & p);
        const card = staffCard(
          "🛡 Security Coverage",
          "**Local records + Discord checks**\nAlt relationships remain unproven.",
          [
            staffField(
              "Local Ban Lookup",
              can(4n) || can(128n)
                ? "Ready"
                : "Missing Ban Members / View Audit Log",
            ),
            staffField(
              "Timeout Controls",
              can(1099511627776n) ? "Ready" : "Missing Moderate Members",
            ),
            staffField(
              "Role Tools",
              can(268435456n)
                ? "Ready · hierarchy applies"
                : "Missing Manage Roles",
            ),
            staffField(
              "Channel Tools",
              can(16n) ? "Ready" : "Missing Manage Channels",
            ),
            staffField(
              "Other Discord Servers",
              Array.isArray(guilds)
                ? guilds.filter((g) => g.id !== guild).length +
                    " installed · scan limit 10"
                : "Discovery unavailable",
            ),
            staffField("Privacy", "Private replies · no IP/device collection"),
            staffField(
              "Administrator",
              bits & 8n
                ? "Enabled · broader than these tools require"
                : "Disabled",
            ),
          ],
        );
        card.embeds[0].timestamp = stamp();
        return card;
      }
      if (sub?.name === "sources")
        return staffCard(
          "🛡 Investigation Sources",
          "**Discord:** local + other bot servers with ban-read access (up to 10).\n**Minecraft:** UUID-matched PvPHQ profile; CatPvP/PvP Club ban feeds unverified.\n**Unavailable:** IPs, devices and universal ban lists.",
        );
      if (sub?.name !== "audit")
        throw Error("Choose status, sources or audit.");
      const roles = await api(base + "/roles");
      const risky = roles.filter(
        (r) =>
          !r.managed &&
          BigInt(r.permissions) & (8n | 32n | 268435456n | 4n | 1099511627776n),
      );
      await audit("role-permission-audit", guild);
      return staffCard(
        "🛡 Role Exposure",
        risky
          .slice(0, 20)
          .map(
            (r) =>
              "<@&" +
              r.id +
              "> · " +
              (BigInt(r.permissions) & 8n
                ? "Administrator"
                : "Sensitive native permissions"),
          )
          .join("\n") ||
          "No unmanaged roles have the checked sensitive permissions.",
        [staffField("Review only", "No permissions were changed.", false)],
      );
    }
    case "timeout":
    case "untimeout": {
      const target = user();
      if (target === actor || target === env.DISCORD_CLIENT_ID)
        throw Error("Choose another member.");
      const { roles, bot, member, server } = await roleData(target),
        actorMember =
          actor === server.owner_id
            ? null
            : await api(base + "/members/" + actor);
      const top = (ids) =>
        Math.max(
          0,
          ...roles.filter((r) => ids.includes(r.id)).map((r) => r.position),
        );
      if (
        target === server.owner_id ||
        top(member.roles) >= top(bot.roles) ||
        (actor !== server.owner_id &&
          top(member.roles) >= top(actorMember.roles))
      )
        throw Error("Member is outside your moderation hierarchy.");
      if (
        roles.some(
          (r) => member.roles.includes(r.id) && BigInt(r.permissions) & 8n,
        )
      )
        throw Error("Administrators cannot be timed out.");
      const minutes = get("minutes");
      if (
        i.data.name === "timeout" &&
        (!Number.isInteger(minutes) || minutes < 1 || minutes > 40320)
      )
        throw Error("Choose 1–40320 minutes.");
      const until =
        i.data.name === "timeout"
          ? new Date(Date.now() + minutes * 60000).toISOString()
          : null;
      await audit(i.data.name + "-requested", target + ": " + reason());
      await api(base + "/members/" + target, "PATCH", {
        communication_disabled_until: until,
      });
      await audit(i.data.name + "-applied", target + ": " + reason());
      return staffCard(
        until ? "⏳ Member Timed Out" : "✓ Timeout Removed",
        "<@" +
          target +
          ">" +
          (until
            ? " · until <t:" + Math.floor(Date.parse(until) / 1000) + ":F>"
            : ""),
      );
    }
    case "slowmode":
    case "lock":
    case "unlock": {
      const c = await api("/channels/" + i.channel_id);
      if (c.guild_id !== guild || ![0, 5].includes(c.type))
        throw Error("Use this in a server text channel.");
      const detail = c.id + ": " + reason();
      await audit(i.data.name + "-requested", detail);
      if (i.data.name === "slowmode") {
        const seconds = get("seconds");
        if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21600)
          throw Error("Choose 0–21600 seconds.");
        await api("/channels/" + c.id, "PATCH", {
          rate_limit_per_user: seconds,
        });
        await audit("slowmode-applied", detail);
        return staffCard(
          "⏱ Slowmode Updated",
          seconds
            ? seconds + " seconds between messages."
            : "Slowmode disabled.",
        );
      }
      const key = "channel-lock:" + c.id,
        saved = await store.one(
          "SELECT value FROM platform_settings WHERE key=?",
          key,
        ),
        o = c.permission_overwrites?.find((o) => o.id === guild),
        prior = { allow: o?.allow || "0", deny: o?.deny || "0" };
      if (i.data.name === "lock") {
        if (!saved)
          await store
            .statement(
              "INSERT OR IGNORE INTO platform_settings VALUES(?,?,?,?)",
              key,
              JSON.stringify(prior),
              actor,
              stamp(),
            )
            .run();
        await api("/channels/" + c.id + "/permissions/" + guild, "PUT", {
          type: 0,
          allow: String(BigInt(prior.allow) & ~2048n),
          deny: String(BigInt(prior.deny) | 2048n),
        });
      } else {
        if (!saved)
          throw Error(
            "No saved lock state for this channel. Nothing was changed.",
          );
        const original = JSON.parse(saved.value);
        await api("/channels/" + c.id + "/permissions/" + guild, "PUT", {
          type: 0,
          allow: String(
            (BigInt(prior.allow) & ~2048n) | (BigInt(original.allow) & 2048n),
          ),
          deny: String(
            (BigInt(prior.deny) & ~2048n) | (BigInt(original.deny) & 2048n),
          ),
        });
        await store
          .statement("DELETE FROM platform_settings WHERE key=?", key)
          .run();
      }
      await audit(i.data.name + "-applied", detail);
      return staffCard(
        i.data.name === "lock" ? "🔒 Channel Locked" : "🔓 Channel Restored",
        "Everyone’s Send Messages permission " +
          (i.data.name === "lock"
            ? "is denied."
            : "was restored to its previous value.") +
          " Other overrides are retained.",
      );
    }
    default:
      throw Error("Unknown staff tool.");
  }
}
