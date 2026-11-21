# 8.0.0

- Bundle nine supplied builds plus the supplied colorful lobby; read palette/column resources directly into native chunk generation, without runtime schematic dependencies.
- Add three isolated copies of each design. Preserve template selection while reserving physical instances independently for duels, queues, parties and bots.
- Add Small/Bigger/Massive browsing with gray/green selection. Hide unavailable size categories for compact modes and enforce restrictions outside the GUI too.
- Add protected matching entry rooms, per-round countdown gates, safe gate closure and sealed-room pearl prevention.
- Add invisible containment, ceilings and fall recovery over pure void. Preserve the separate FFA platform.
- Prepare individual copies asynchronously before allocation to avoid generating cold arenas at the start of a match.
- Preserve v7/v6/v4/v3 world and journal recovery without changing their generators.
- Strip imported entities, inventories, commands, portals and active redstone mechanisms; translate legacy blocks and wall states for modern Paper.
