export const rubricVersion = "community-1";
export const rubricDimensions = ["Control", "Spacing", "Timing", "Defense", "Resources", "Adaptation"];
export const modeRubrics = {
  sword: ["Aim and hit selection", "Reach discipline and spacing", "Sprint resets and trades", "Avoiding predictable damage", "Hotbar and item discipline", "Reading and adapting to an opponent"],
  axe: ["Axe/sword accuracy", "Shield-range control", "Shield baiting and punish timing", "Shield use and safe retreats", "Weapon swaps and equipment", "Adapting to shield habits"],
  vanilla: ["Crystal/anchor placement", "Position and terrain control", "Placement/detonation timing", "Totem and damage management", "Refills and hotbar management", "Reading setups and changing pressure"],
  uhc: ["Melee and ranged accuracy", "Range and terrain choices", "Trades and ranged follow-ups", "Damage avoidance and healing windows", "Healing and projectile economy", "Changing plans as resources change"],
  pot: ["Aim through sustained exchanges", "Strafe and distance control", "Sprint resets and re-engagement", "Safe healing and escape routes", "Potion accuracy and refills", "Reading pressure and recovery"],
  nethop: ["Aim at the agreed movement speed", "Spacing under speed pressure", "Trades and chase timing", "Healing under pressure", "Refills and hotbar consistency", "Adjusting tempo against different styles"],
  smp: ["Weapon and projectile control", "Terrain and engagement distance", "Shield disables and weapon swaps", "Shielding, movement and disengages", "Approved kit consumables", "Switching plans without unsafe resets"],
  mace: ["Mace and secondary-weapon accuracy", "Vertical and horizontal positioning", "Launch and smash timing", "Fall safety and counterplay", "Approved charges and loadout economy", "Reading airborne/grounded opponents"],
  mace_spear: ["Approved mace/spear control", "Vertical and spear-range spacing", "Weapon transitions and commits", "Counterplay and safe recovery", "Approved loadout resources", "Selecting the right engagement tool"],
  mace_breach: ["Breach-kit attack accuracy", "Armor-pressure positioning", "Damage-window timing", "Counterattacks and recovery", "Approved charges and item use", "Adapting breach pressure"],
  mace_density: ["Density-kit attack accuracy", "Height and landing control", "Smash timing and commit choices", "Fall safety and counterplay", "Approved launch resources", "Adapting height and engagement plans"],
  cart: ["Approved cart placement/control", "Terrain and blast-range control", "Setup and detonation timing", "Blast avoidance and safe disengages", "Approved carts and materials", "Changing setups against counterplay"],
  bow: ["Projectile accuracy", "Range and cover control", "Shot selection and movement reads", "Projectile dodging and safe peeks", "Approved arrows and healing", "Adapting to opponent movement"],
  diasmp: ["Diamond-kit weapon control", "Terrain and engagement distance", "Shield disables and trades", "Shielding and damage avoidance", "Approved consumables and equipment", "Adapting to the diamond loadout matchup"],
  creeper: ["Approved kit attack/setup control", "Terrain and blast-range spacing", "Setup/attack timing", "Blast safety and recovery", "Approved kit resource use", "Responding to counterplay"],
};
export const rubricWeights = [20, 20, 20, 15, 15, 10];
export const rubricProtocol = "Before opening a session, staff must publish a kit manifest: exact Minecraft version, items/amounts, enchantments, allowed mods, arena, reset rules and disconnect policy. Default assessment: 2 unscored warmups then first to 10 scored rounds, alternating sides; no mid-set kit changes. Both sides agree recording and shareable evidence. An unsafe arena or unresolved disconnect pauses the assessment. These are our community's rules, not another tierlist's standard.";
export const rubricPlacement = "Score each dimension 0–4: 0 not demonstrated, 1 inconsistent fundamentals, 2 reliable basics, 3 advanced execution, 4 consistently demonstrated against calibrated opposition. Weighted score is feedback, not an automatic HT/LT conversion. A trained tester selects a provisional placement using documented benchmark opponents; HT1/LT1/HT2/LT2 require an independent senior review before publication. Never promise a rank from a score alone.";
export function calculateAssessment(mode, input) {
  if (!modeRubrics[mode]) throw Error("Unknown rubric mode.");
  const scores = typeof input === "string" ? input.split(",").map((s) => s.trim()).map((s) => s === "" ? NaN : Number(s)) : input;
  if (!Array.isArray(scores) || scores.length !== 6 || scores.some((n) => !Number.isInteger(n) || n < 0 || n > 4)) throw Error("Enter six whole scores from 0 to 4, separated by commas, in the rubric's dimension order.");
  return { version: rubricVersion, scores, total: scores.reduce((sum, value, index) => sum + value / 4 * rubricWeights[index], 0) };
}
export function rubricText(mode, name = mode) {
  if (!modeRubrics[mode]) throw Error("Choose a valid rubric mode.");
  return `**${name} · ${rubricVersion}**\n` + modeRubrics[mode].map((text, i) => `${i+1}. ${rubricDimensions[i]} (${rubricWeights[i]}%): ${text}`).join("\n") + "\n\n" + rubricProtocol + "\n\n" + rubricPlacement;
}
