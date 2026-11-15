import {
  competitiveCommands,
  competitiveCooldownOptions,
  competitivePlayerOptions,
} from "./competitive-commands.mjs";

const referenceMode = {
  type: 3,
  name: "mode",
  description: "Mace testing mode",
  autocomplete: true,
};
const referenceUser = { type: 6, name: "user", description: "Discord member" };
const referenceTargets = {
  next: ["pull", null],
  leave: ["queue", "leave"],
  testerlb: ["tester", "leaderboard", { period: "month" }],
  testerlbtotal: ["tester", "leaderboard", { period: "overall" }],
  testerlbuser: ["tester", "stats"],
  hightesterlb: ["tester", "leaderboard", { period: "month", high_only: true }],
  hightesterlbtotal: [
    "tester",
    "leaderboard",
    { period: "overall", high_only: true },
  ],
  hightesterlbuser: [
    "tester",
    "leaderboard",
    { period: "overall", high_only: true },
  ],
  htlb: ["tester", "leaderboard", { period: "month", high_only: true }],
  htqueue: ["high-test", "list"],
  check_verification: ["verify", "status"],
  cdreset: ["cooldown", "reset"],
  restrict: ["player", "restrict"],
  unrestrict: ["player", "unrestrict"],
  forcetier: ["tier", "set"],
  request_test_panel: ["testing-hub", null, { publish: true }],
  verification_panel: ["testing-hub", null, { publish: true }],
};
const refDefinition = (name, description, options = []) => ({
  name,
  description,
  options,
});
export const referenceCommands = [
  refDefinition("next", "Pull the next player into a private test room", [
    ...competitiveCommands.find((c) => c.name === "start").options.slice(0, 2),
  ]),
  refDefinition("leave", "Leave your waiting test queue", [
    { ...referenceMode, required: true },
  ]),
  ...[
    "testerlb",
    "testerlbtotal",
    "htlb",
    "hightesterlb",
    "hightesterlbtotal",
  ].map((name) =>
    refDefinition(
      name,
      "Real completed tests: " +
        (name.endsWith("total") ? "all time" : "this UTC month"),
      [referenceMode],
    ),
  ),
  ...["testerlbuser", "hightesterlbuser"].map((name) =>
    refDefinition(name, "Show documented tests completed by a tester", [
      referenceUser,
    ]),
  ),
  refDefinition("htqueue", "Show current high-tier testing requests"),
  refDefinition("check_verification", "Check your linked Minecraft account"),
  refDefinition(
    "cdreset",
    "Manager: reset a player cooldown with audit and confirmation",
    competitiveCooldownOptions.find((s) => s.name === "reset").options,
  ),
  refDefinition(
    "forcetier",
    "Manager: reviewed tier adjustment with confirmation",
    [
      { ...referenceUser, required: true },
      { ...referenceMode, required: true },
      {
        type: 3,
        name: "tier",
        description: "Reviewed placement",
        required: true,
        choices: [
          "HT1",
          "LT1",
          "HT2",
          "LT2",
          "HT3",
          "LT3",
          "HT4",
          "LT4",
          "HT5",
          "LT5",
        ].map((value) => ({ name: value, value })),
      },
      {
        type: 3,
        name: "reason",
        description: "Audited reason, at least 10 characters",
        required: true,
      },
      {
        type: 3,
        name: "region",
        description: "Required for a first placement",
        choices: ["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"].map(
          (value) => ({ name: value, value }),
        ),
      },
    ],
  ),
  ...["restrict", "unrestrict"].map((name) =>
    refDefinition(
      name,
      "Manager: " + name + " a player for one mode",
      competitivePlayerOptions.find((s) => s.name === name).options,
    ),
  ),
  refDefinition(
    "request_test_panel",
    "Moderator: install or update the testing request panel",
  ),
  refDefinition(
    "verification_panel",
    "Moderator: install or update account verification controls",
  ),
];

export function referenceCommandData(data) {
  const target = referenceTargets[data.name];
  if (!target) return null;
  const [name, sub, defaults = {}] = target;
  const values = new Map((data.options || []).map((o) => [o.name, o]));
  for (const [key, value] of Object.entries(defaults))
    values.set(key, { name: key, value });
  const options = [...values.values()];
  return { name, options: sub ? [{ type: 1, name: sub, options }] : options };
}
