import config from './community.json' with {type:'json'};
export const extraInterests = {
  tests: "Test Alerts", events: "Event Alerts", updates: "Update Alerts", results: "Result Alerts",
  violet: "Color · Violet", blue: "Color · Blue", cyan: "Color · Cyan", green: "Color · Green", gold: "Color · Gold", pink: "Color · Pink", red: "Color · Red",
};
export const staffTracks = ["helper", "moderator", "coach", "event-host"];
export const ticketKinds = ['support','account','tier-appeal','tester-report','testing-dispute','bug-report','report','staff-report','technical'];
export const sensitiveSupportKinds=new Set(['staff-report','tester-report']);
export const supportKindLabels={'support':'General Support','account':'Account Support','tier-appeal':'Tier Appeal','tester-report':'Tester Report','testing-dispute':'Testing Dispute','bug-report':'Bug Report','report':'Player Report','staff-report':'Confidential Staff Report','technical':'Technical Support'};
export function staffAccess(interaction, env) {
  const actor = interaction.member?.user?.id;
  const roles = interaction.member?.roles || [];
  const has = (value) => String(value || "").split(",").filter(Boolean).some((id) => roles.includes(id));
  const custom=cap=>(config.staffToolRoles?.[cap]||[]).some(id=>roles.includes(id));
  const mod = custom('moderation') || actor === env.DISCORD_OWNER_ID || (BigInt(interaction.member?.permissions || "0") & 8n) !== 0n || has(env.MODERATOR_ROLE_ID) || has(env.DISCORD_MODERATOR_ROLE_IDS);
  const reportReviewer = custom('reports') || actor === env.DISCORD_OWNER_ID || (BigInt(interaction.member?.permissions || '0') & 8n)!==0n || has(env.DISCORD_REPORT_REVIEWER_ROLE_IDS);
  return { actor, mod, reportReviewer, tester: mod || has(env.TESTER_ROLE_ID) || has(env.DISCORD_TESTER_ROLE_IDS), support: mod || custom('support') || has(env.DISCORD_SUPPORT_ROLE_IDS) };
}
