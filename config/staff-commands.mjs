const stUser = () => ({
  type: 6,
  name: "user",
  description: "Server member",
  required: true,
});
const stRole = () => ({
  type: 8,
  name: "role",
  description: "Server role",
  required: true,
});
const stReason = () => ({
  type: 3,
  name: "reason",
  description: "Audit reason, 10–500 characters",
  required: true,
  min_length: 10,
  max_length: 500,
});
const stSub = (name, description, options = []) => ({
  type: 1,
  name,
  description,
  options,
});
export const staffCommands = [
  {
    name: "alt-check",
    description:
      "Security: sourced account signals and local ban check; never proof of an alt",
    options: [stUser()],
  },
  ...["add-role", "remove-role"].map((name) => ({
    name,
    description:
      "Role staff: " +
      name.replace("-", " ") +
      " with hierarchy and protected-role checks",
    options: [stUser(), stRole(), stReason()],
  })),
  {
    name: "role-info",
    description:
      "Role details and whether it is protected from staff role tools",
    options: [stRole()],
  },
  {
    name: "member-info",
    description: "Staff: member age, join time and linked Minecraft account",
    options: [stUser()],
  },
  {
    name: "server-info",
    description: "Live server overview and testing activity",
  },
  {
    name: "staff-help",
    description: "Your available staff tools and command categories",
  },
  {
    name: "permissions",
    description: "Check command access for your roles",
    options: [
      {
        type: 3,
        name: "command",
        description: "Command name without /",
        max_length: 32,
      },
    ],
  },
  {
    name: "staff",
    description: "Staff roster and owner-controlled staff role assignments",
    options: [
      stSub("roster", "List members holding a specific staff role", [stRole()]),
      ...["assign", "remove"].map((name) =>
        stSub(name, "Owner: " + name + " an approved staff role", [
          stUser(),
          stRole(),
          stReason(),
        ]),
      ),
    ],
  },
  {
    name: "security",
    description:
      "Security staff: review role exposure and investigation sources",
    options: [
      stSub("sources", "List exactly what alt-check can inspect"),
      stSub("audit", "Inspect permissions on server roles"),
    ],
  },
  {
    name: "slowmode",
    description: "Channel staff: set slowmode in this text channel",
    options: [
      {
        type: 4,
        name: "seconds",
        description: "0 disables; maximum 21600 seconds",
        required: true,
        min_value: 0,
        max_value: 21600,
      },
      stReason(),
    ],
  },
  ...["lock", "unlock"].map((name) => ({
    name,
    description:
      "Channel staff: " +
      name +
      " this channel while preserving other permissions",
    options: [stReason()],
  })),
  {
    name: "timeout",
    description: "Moderator: temporarily prevent a member from communicating",
    options: [
      stUser(),
      {
        type: 4,
        name: "minutes",
        description: "1 minute to 28 days",
        required: true,
        min_value: 1,
        max_value: 40320,
      },
      stReason(),
    ],
  },
  {
    name: "untimeout",
    description: "Moderator: remove a member communication timeout",
    options: [stUser(), stReason()],
  },
];
