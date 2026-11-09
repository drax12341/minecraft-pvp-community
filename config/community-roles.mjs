export const extraInterests = {
  survival: "Survival & SMP", bedwars: "Bedwars", skywars: "Skywars", creative: "Creative & Redstone", parkour: "Parkour",
  tests: "Test Alerts", events: "Event Alerts", updates: "Update Alerts",
};
export const staffTracks = ["helper", "moderator", "coach", "event-host"];
export const ticketKinds = ["support", "account", "report", "staff-report"];
export function staffAccess(interaction, env) {
  const actor = interaction.member?.user?.id;
  const roles = interaction.member?.roles || [];
  const has = (value) => String(value || "").split(",").filter(Boolean).some((id) => roles.includes(id));
  const mod = actor === env.DISCORD_OWNER_ID || (BigInt(interaction.member?.permissions || "0") & 8n) !== 0n || has(env.MODERATOR_ROLE_ID) || has(env.DISCORD_MODERATOR_ROLE_IDS);
  return { actor, mod, tester: mod || has(env.TESTER_ROLE_ID) || has(env.DISCORD_TESTER_ROLE_IDS), support: mod || has(env.DISCORD_SUPPORT_ROLE_IDS) };
}
