// Original pilot specifications. No reference kit images or textures are reused.
export const kitManifests = {
  version:'pilot-1-candidate',
  status:'Awaiting staff calibration; not approved for official placements',
  common:{
    minecraft:'Java 1.21.1',
    inventoryConvention:'Slots 0–8: hotbar left to right. Slots 9–35: main inventory, row by row. Empty slots contain nothing. Offhand and armour are separate.',
    initialState:'20 health, 20 food, 5 saturation, zero absorption and no active effects. Full item durability. No external effects or items.',
    mods:'Vanilla client or performance/accessibility changes that do not reveal hidden information or automate actions. No macros, aim assistance, freecam, reach changes, automated refills or opponent cooldown overlays. Ask staff about unlisted modifications before play.',
    arena:'An agreed existing arena, identical conditions for both players, level 64×64 solid floor, no hazards or outside interference, minimum 8-block vertical clearance, visible boundary. No server/plugin changes are required by this document.',
    format:'Two unscored warmups, then first to 10 scored round wins; alternate starting sides each round. Both players start 20 blocks apart. A round ends on a death or explicit concession. A draw is replayed without a point.',
    reset:'Restore the exact loadout, durability, health, food, saturation and effects before every round. Remove dropped items and arrows. No mid-set equipment or rule changes.',
    interruptions:'Pause for unresolved lag, unsafe conditions or interference. Stop scoring while disconnected. Replay an interrupted round only by agreement; otherwise suspend for staff review. A disconnect does not establish a tier or impose an automatic loss.',
    evidence:'Agree recording and publication before play. Capture loadout inspection, complete scored rounds, score sheet and relevant interruption decisions. Retain only match evidence. Assessment records need kit version, rubric version, benchmark opponents, consented evidence and actionable feedback.',
    placement:'Competitive placement requires calibrated benchmark opponents and documented sets, not a six-score threshold. Independent senior review is required for HT1/LT1/HT2/LT2. Benchmarks are not appointed in this draft.',
  },
  modes:[
    {id:'sword',name:'Sword',armour:['Diamond helmet · Protection III','Diamond chestplate · Protection III','Diamond leggings · Protection III','Diamond boots · Protection III'],offhand:'Empty',slots:[{slot:0,item:'Diamond sword',quantity:1,enchantments:'Sharpness V'}],effects:[],mechanics:'Melee sword combat. Sprint resets, strafes, critical hits and trades allowed. No projectiles, blocks, consumables or disengagement beyond the arena boundary.'},
    {id:'axe',name:'Axe',armour:['Diamond helmet · no enchantments','Diamond chestplate · no enchantments','Diamond leggings · no enchantments','Diamond boots · no enchantments'],offhand:'Shield · no enchantments',slots:[{slot:0,item:'Diamond axe',quantity:1,enchantments:'None'},{slot:1,item:'Diamond sword',quantity:1,enchantments:'None'}],effects:[],mechanics:'Shield blocking, axe disables, weapon swaps and critical hits allowed. No bows, blocks, consumables or equipment replacement during a round.'},
    {id:'bow',name:'Bow',armour:['Iron helmet · no enchantments','Iron chestplate · no enchantments','Iron leggings · no enchantments','Iron boots · no enchantments'],offhand:'Empty',slots:[{slot:0,item:'Bow',quantity:1,enchantments:'Power II'},{slot:8,item:'Arrow',quantity:64,enchantments:'None'}],effects:[],mechanics:'Bow damage only. No melee damage, shields, blocks, tipped/spectral arrows or consumables. If arrows run out without a winner, replay the round; log the draw. No additional equipment enchantments.'},
  ],
  pendingModes:['vanilla','uhc','pot','nethop','smp','mace','mace_spear','mace_breach','mace_density','cart','diasmp','creeper'],
};
