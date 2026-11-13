import config from './community.json' with { type: 'json' };

const cdString = (name, description, required = false, choices) => ({
  type: 3, name, description, required,
  ...(choices ? { choices: choices.map(value => typeof value === 'string' ? { name: value, value } : value) } : {}),
});
const cdMode = (required = true) => cdString('mode', 'Community testing mode', required, config.modes.map(m => ({ name: m.name, value: m.id })));
const cdRegion = () => cdString('region', 'Playing region', true, ['EU','NA','AS','SA','AU','AF','ME','OC']);
const cdSub = (name, description, options = []) => ({ type: 1, name, description, options });
const cdReason = () => cdString('reason', 'Explain your request or decision in 10–1000 characters', true);
const cdUser = () => ({ type: 6, name: 'user', description: 'Community member' });

export const communityDeskCommands = [
  {name:'loadout',description:'Versioned community loadouts and documented staff calibration',options:[
    cdSub('show','Read a staff-approved loadout',[cdMode(),cdString('version','Exact version; omit for latest approved')]),
    cdSub('approve','Moderator: record a complete, calibrated loadout',[cdMode(),cdString('version','New version, for example mace-2026-11-v1',true),cdString('loadout','Exact version, equipment, enchantments, inventory, arena and reset rules (80–1500 chars)',true),cdString('benchmarks','Consented calibration evidence and benchmark opponents (30–1000 chars)',true),{type:5,name:'calibrated',description:'Confirm real staff calibration has been completed',required:true}]),
    cdSub('revoke','Moderator: stop using an unsafe or superseded version',[cdMode(),cdString('version','Exact approved version',true),cdReason()]),
  ]},
  { name: 'desk', description: 'Your community profile, tests, support and next steps' },
  { name: 'queue-board', description: 'Live testing availability and private queue controls', options: [cdMode(), cdRegion(), {type:5,name:'publish',description:'Moderator: publish or recover this board in the current channel'}] },
  { name: 'pull', description: 'Qualified tester: pull the next player into a private room', options: [cdMode(), cdRegion()] },
  { name: 'player', description: 'Verified profiles and documented placement history', options: [
    cdSub('self', 'Your verified profile and current placements'),
    cdSub('view', 'Look up a published Minecraft player', [cdString('name', 'Minecraft username', true)]),
    cdSub('history', 'Your history, or the public history of a Minecraft player', [cdString('name', 'Minecraft username'), cdMode(false)]),
  ] },
  { name: 'leaderboard', description: 'Real active placements for a community testing mode', options: [cdMode()] },
  { name: 'tester', description: 'Tester activity and your staff workspace', options: [
    cdSub('desk', 'Your assigned test, waiting demand and staff actions'),
    cdSub('stats', 'Documented tester results and current assignments', [cdUser()]),
    cdSub('leaderboard', 'Completed tests this UTC month or overall', [cdString('period', 'Counting period', false, ['month','overall']), cdMode(false)]),
  ] },
  { name: 'retire', description: 'Reviewed retirement while preserving your peak and history', options: [
    cdSub('request', 'Ask to retire a current LT2-or-higher placement', [cdMode(), cdReason()]),
    cdSub('status', 'Your retirement requests and decisions'),
    cdSub('cancel', 'Cancel your pending request or return from retirement', [cdMode()]),
    cdSub('review', 'Moderator: list pending requests or decide one', [cdString('id', 'Request ID; omit to list pending requests'), cdString('decision', 'Independent decision', false, ['approved','declined']), cdString('reason', 'Decision explanation, 10–1000 characters')]),
  ] },
];
