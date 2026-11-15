import config from "./community.json" with { type: "json" };
import { staffAccess } from "./community-roles.mjs";
import { referenceCommandData } from "./reference-commands.mjs";

export const staffRoleDefinitions = [
  {
    name: "Community Manager",
    color: 0xf0b35b,
    capabilities: [
      "moderation",
      "support",
      "security",
      "roles",
      "channels",
      "inspection",
      "reports",
    ],
  },
  {
    name: "Senior Moderator",
    color: 0xe85b77,
    capabilities: [
      "moderation",
      "support",
      "security",
      "roles",
      "channels",
      "inspection",
      "reports",
    ],
  },
  {
    name: "Trial Moderator",
    color: 0xe996a5,
    capabilities: ["support", "inspection"],
  },
  {
    name: "Security Analyst",
    color: 0x54c8c2,
    capabilities: ["security", "inspection"],
  },
  {
    name: "Role Manager",
    color: 0xaa8aef,
    capabilities: ["roles", "inspection"],
  },
  {
    name: "Event Manager",
    color: 0xefc461,
    capabilities: ["channels", "inspection"],
  },
];
const commandGroups = {
  public:
    "account analytics profile progress desk guide availability preferences practice tester-apply verify notifications player leaderboard retire roster tier-list tier-path tester-roster test-stats test-hub waitlist request-test rubric interests staff-help server-info role-info permissions",
  tester:
    "claim result session start end pause resume pull tester-desk-internal absent close skip tester-center",
  moderation:
    "queue-admin cooldown-admin player-admin verify-account tier tier-confirm setup autosetup tier-role system resync logs delivery staff-center health moderation",
  security: "alt-check security",
  roles: "add-role remove-role",
  inspection: "member-info",
  channels: "slowmode lock unlock",
  moderationAction: "timeout untimeout",
};
const basePolicies = Object.fromEntries(
  Object.entries(commandGroups).flatMap(([key, names]) =>
    names
      .split(" ")
      .map((name) => [name, key === "moderationAction" ? "moderation" : key]),
  ),
);
export function commandRequirement(data) {
  const alias = referenceCommandData(data);
  if (alias) return commandRequirement(alias);
  const sub = data.options?.find((o) => o.type === 1)?.name;
  const value = (name) => data.options?.find((o) => o.name === name)?.value;
  switch (data.name) {
    case "staff":
      return ["assign", "remove"].includes(sub) ? "owner" : "inspection";
    case "queue":
      return ["forceclose", "clear"].includes(sub) ? "moderation" : "public";
    case "appeal":
    case "staff-apply":
    case "tester-apply":
      return sub === "review" ? "moderation" : "public";
    case "tester":
      return ["add", "remove", "permissions"].includes(sub)
        ? "moderation"
        : sub === "desk"
          ? "tester"
          : "public";
    case "player":
      return ["restrict", "unrestrict"].includes(sub) ? "moderation" : "public";
    case "retire":
      return sub === "review" ? "moderation" : "public";
    case "cooldown":
      return !sub || sub === "status" ? "public" : "moderation";
    case "loadout":
      return sub === "show" ? "public" : "moderation";
    case "mode":
    case "region":
      return sub === "list" ? "public" : "moderation";
    case "config":
      return "moderation";
    case "qualification":
      return sub === "list" ? "public" : "moderation";
    case "quota":
      return sub === "set" ? "moderation" : "tester";
    case "queue-board":
    case "testing-hub":
      return value("publish") === true ? "moderation" : "public";
    case "ticket":
      return [
        "claim",
        "recover",
        "state",
        "assign",
        "note",
        "notes",
        "reopen",
        "transcript",
      ].includes(sub)
        ? "support"
        : "public";
    case "assessment":
      return "tester";
    case "high-test":
      return [
        "apply",
        "status",
        "ready",
        "history",
        "withdraw",
        "room",
      ].includes(sub)
        ? "public"
        : "tester";
    case "tester-desk":
      return ["list", "review"].includes(sub) ? "moderation" : "public";
    case "match":
      return ["status", "rules", "dispute"].includes(sub)
        ? "public"
        : sub === "reassign"
          ? "moderation"
          : "tester";
    case "test-room":
      return "public"; // Participant and assignment checks remain in the handler.
    case "result-confirm":
      return "public"; // Actor-bound confirmation rechecks the canonical result command.
    case "confirm-action":
      return "public"; // Actor-bound draft and canonical command recheck permissions.
    default:
      return basePolicies[data.name];
  }
}
export function hasStaffCapability(i, env, capability) {
  const a = staffAccess(i, env);
  if (capability === "owner") return a.actor === env.DISCORD_OWNER_ID;
  if (capability === "public") return true;
  if (!capability) return false;
  if (a.mod) return true;
  if (capability === "inspection" && (a.tester || a.support)) return true;
  if (capability === "tester") return a.tester;
  if (capability === "support" && a.support) return true;
  const roles = i.member?.roles || [];
  return (config.staffToolRoles?.[capability] || []).some((id) =>
    roles.includes(id),
  );
}
export function canUseCommand(i, env, data = i.data) {
  return hasStaffCapability(i, env, commandRequirement(data));
}
export function enforceCommandPolicy(i, env) {
  const capability = commandRequirement(i.data);
  const allowed = canUseCommand(i, env);
  if (!allowed && ["setup", "autosetup"].includes(i.data.name))
    throw Error(
      "Only administrators and testing managers can run server setup.",
    );
  if (!allowed && i.data.name === "tester-desk")
    throw Error("Only authorized staff can review recruitment.");
  if (!allowed && capability === "support")
    throw Error("Only independent support staff can perform this action.");
  if (!allowed)
    throw Error(
      "Only " +
        ({
          tester: "testers",
          moderation: "moderators and testing managers",
          support: "support staff",
          security: "security staff",
          roles: "role managers",
          channels: "channel managers",
          inspection: "staff",
          owner: "the server owner",
        }[capability] || "authorized staff") +
        " can use this command.",
    );
}
