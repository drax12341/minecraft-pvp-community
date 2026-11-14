const pcString = (name, description, required = false, choices) => ({
  type: 3,
  name,
  description,
  required,
  ...(choices
    ? { choices: choices.map((value) => ({ name: value, value })) }
    : {}),
});
const pcMode = (required = true) => ({
  ...pcString("mode", "Mace testing submode", required),
  autocomplete: true,
});
const pcRegion = () =>
  pcString("region", "Testing region", true, [
    "EU",
    "NA",
    "AS",
    "SA",
    "AU",
    "AF",
    "ME",
    "OC",
  ]);
const pcReason = () =>
  pcString("reason", "Audited explanation, 10–2000 characters", true);
const pcUser = () => ({
  type: 6,
  name: "user",
  description: "Discord member",
  required: true,
});
const pcSub = (name, description, options = []) => ({
  type: 1,
  name,
  description,
  options,
});
const pcInt = (name, description, min_value, max_value, required = false) => ({
  type: 4,
  name,
  description,
  min_value,
  max_value,
  required,
});
const pcId = () =>
  pcString("id", "Official test ID; omit to use your active assignment");
export const competitiveCommands = [
 {name:'analytics',description:'Real seasonal Mace participation and rank outcomes',options:[pcString('month','UTC month as YYYY-MM'),pcMode(false),pcString('region','Testing region',false,['EU','NA','AS','SA','AU','AF','ME','OC'])]},
 {name:'tier',description:'Manager: audited placement adjustments and history',options:[pcSub('set','Set a reviewed placement without recording a fake test',[pcUser(),pcMode(),pcString('tier','New placement',true,['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5']),pcReason(),pcString('region','Region when setting an initial placement',false,['EU','NA','AS','SA','AU','AF','ME','OC'])]),pcSub('reset','Reset a current placement while preserving history',[pcUser(),pcMode(),pcReason()]),pcSub('history','View official evaluations and staff changes',[pcUser(),pcMode()])]},
  {
    name: "account",
    description: "Your verified identity, region and profile visibility",
    options: [
      pcSub("status", "View your verified account"),
      pcSub("region", "Select your playing region", [pcRegion()]),
      pcSub("privacy", "Choose profile visibility", [
        pcString("visibility", "Public profile preference", true, [
          "public",
          "private",
        ]),
      ]),
    ],
  },
  {
    name: "setup",
    description: "Persistent guided Mace server installation wizard",
  },
  {
    name: "autosetup",
    description: "Open the persistent Mace server installation wizard",
  },
  ...["start", "pause", "resume", "end"].map((name) => ({
    name,
    description: {
      start: "Open or join a shared Mace testing session",
      pause: "Pause your own tester availability",
      resume: "Resume your tester availability",
      end: "End your availability without interrupting active tests",
    }[name],
    options: [
      pcMode(),
      pcRegion(),
      ...(name === "start"
        ? [
            pcString("kit", "Staff-approved loadout version"),
            pcString("benchmarks", "Consented calibration record"),
            pcInt("capacity", "Shared session capacity", 1, 20),
          ]
        : []),
    ],
  })),
  {
    name: "match",
    description: "Official private test lifecycle and timeline",
    options: [
      ...["status", "start", "rules", "extend", "transcript"].map((name) =>
        pcSub(name, name + " an assigned official test", [pcId()]),
      ),
      pcSub("reassign", "Manager: reassign an unfinished test", [
        pcUser(),
        pcReason(),
        pcId(),
      ]),
      pcSub("finish", "Record a completed test score", [
        pcString("score", "Structured final score, for example 10-6", true),
        pcReason(),
        pcId(),
      ]),
      ...["cancel", "absent", "note", "dispute"].map((name) =>
        pcSub(name, name + " with a private audited reason", [
          pcReason(),
          pcId(),
        ]),
      ),
    ],
  },
  ...["absent", "close", "skip"].map((name) => ({
    name,
    description:
      "Tester: " + name + " an assigned test with a confirmed reason",
    options: [pcReason(), pcId()],
  })),
  {
    name: "mode",
    description: "Manage official Mace submodes without erasing history",
    options: [
      pcSub("list", "List enabled Mace modes"),
      pcSub("create", "Create an administrator-defined Mace submode", [
        pcString("id", "Stable mace_<submode> identifier", true),
        pcString("name", "Official Mace submode display name", true),
        pcString("rules", "Actual testing rules, one per line", true),
        pcString("server", "Real testing server address"),
        pcInt("cooldown", "Retest cooldown in hours", 0, 720),
        pcInt("capacity", "Queue capacity", 1, 20),
      ]),
      pcSub("edit", "Edit rules and testing policy", [
        pcMode(),
        pcString("name", "Display name"),
        pcString("rules", "Testing rules, one per line"),
        pcString("server", "Testing server address"),
        pcInt("cooldown", "Retest cooldown in hours", 0, 720),
        pcInt("capacity", "Queue capacity", 1, 20),
      ]),
      ...["disable", "enable"].map((name) =>
        pcSub(name, name + " an existing mode with confirmation", [
          pcString("mode", "Stable Mace mode ID", true),
          pcReason(),
        ]),
      ),
    ],
  },
  {
    name: "region",
    description: "Manage regional testing availability",
    options: [
      pcSub("list", "List enabled testing regions"),
      ...["enable", "disable"].map((name) =>
        pcSub(name, name + " a region", [
          pcString("region", "Stable region code", true),
          pcString("name", "Region display name"),
        ]),
      ),
    ],
  },
  {
    name: "config",
    description: "Manage network presentation and inspect configuration",
    options: [
      pcSub("show", "Inspect saved configuration"),
      pcSub("branding", "Set the network identity", [
        pcString("name", "Network name", true),
        pcString("color", "Embed accent as #RRGGBB", true),
      ]),
    ],
  },
  {
    name: "quota",
    description: "UTC monthly tester quotas and real completion counts",
    options: [
      pcSub("status", "View your quota", [pcMode(false)]),
      pcSub("set", "Manager: set a tester monthly quota", [
        pcUser(),
        pcMode(),
        pcInt("target", "Monthly completed evaluations", 0, 1000, true),
      ]),
    ],
  },
  {
    name: "health",
    description:
      "Manager: stale tests, queue health and actionable delivery failures",
  },
  { name: "staff-center", description: "Private administration dashboard" },
  {
    name: "progress",
    description: "Your official tier progression and cosmetic milestones",
    options: [pcMode(false)],
  },
];
export const competitiveCooldownOptions = [
  pcSub("status", "Your independent Mace cooldown", [pcMode(), pcRegion()]),
  ...["inspect", "reset", "set", "reduce"].map((name) =>
    pcSub(name, "Manager: " + name + " a recorded test cooldown", [
      pcUser(),
      pcMode(),
      ...(name === "set" || name === "reduce"
        ? [pcInt("hours", "Cooldown hours", 0, 720, true)]
        : []),
      ...(name !== "inspect" ? [pcReason()] : []),
    ]),
  ),
];
export const competitivePlayerOptions = ["restrict", "unrestrict"].map((name) =>
  pcSub(name, "Manager: " + name + " a player for one Mace mode", [
    pcUser(),
    pcMode(),
    pcReason(),
    ...(name === "restrict"
      ? [pcInt("hours", "Restriction duration", 1, 8760)]
      : []),
  ]),
);
export const competitiveQueueOptions = ["forceclose", "clear"].map((name) =>
  pcSub(name, "Manager: " + name + " with confirmation", [
    pcMode(),
    pcRegion(),
    pcReason(),
  ]),
);

export const competitiveTesterOptions=[pcSub('add','Manager: approve a supervised tester',[pcUser(),pcMode(),pcReason(),{type:5,name:'senior',description:'Approved for independent high-tier review'}]),pcSub('remove','Manager: revoke one Mace qualification',[pcUser(),pcMode(),pcReason()]),pcSub('permissions','Manager: inspect approved mode scopes',[{type:6,name:'user',description:'Filter by Discord member'}])];
