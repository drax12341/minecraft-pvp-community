# Supplied builds

Dimensions are the imported build footprint, including architecture and scenery. The enclosed fighting floor is smaller on spectator-ring maps. Each arena has three instances, separated by 1,024 blocks. Entrances use matching materials and are integrated at verified floor height.

| Category | Menu name | Footprint | Source |
|---|---|---|---|
| Small | Frost Ring | 75 x 75 | arena.schem |
| Small | Fighter Circle | 104 x 104 | fighter map small world; circular arena extracted, unrelated testing structures removed |
| Small | Royal Bridges | 88 x 132 | clash royale arena.litematic |
| Bigger | Castle Gardens | 125 x 136 | 1-1 castle.schem |
| Bigger | Sandstone Hall | 123 x 127 | small arena.schematic |
| Bigger | Woodland Court | 96 x 200 | pvp-arena medium world; surrounding flat world removed |
| Bigger | Sky Blossom | 156 x 156 | c6100af5-9b06-4a9f-8ec6-8854f91b3cf9.schem |
| Massive | Sunstone Sanctuary | 191 x 191 | medium arena.schem |
| Massive | Grand Colosseum | 294 x 325 | coloseum.schematic |
| Lobby | Colorful Citadel | 288 x 272 extraction | colorful-lobby-100x100-by-kubj world (Kubj; source folder label preserved) |

Builds were provided by the server owner. This document records their supplied filenames, not a claim that CommunityArena authored those structures. Palette SHA-256 values, dimensions and entry coordinates are included in `builds/catalogue.json` inside the JAR.

The converter in `tools/import-builds.py` reads Sponge v2/v3, classic MCEdit schematics, the supplied single-region Litematica build, and legacy/modern Anvil sections. It imports blocks only. World metadata, player data, entities, block-entity inventories and command text are excluded. Decorative signs therefore have no imported text. Functional blocks may lose behavior deliberately; fighting terrain, colors, stairs, walls and scenery retain translated native states. Entry rooms and their cleared exit landings are intentional gameplay changes.

Offline conversion uses Python, NumPy and Pillow. `--preview path name` decodes a schematic into a bounded NPZ intermediate; `--crop world name xmin xmax ymin ymax zmin zmax` extracts a world region; `--compile` builds the sanitized shipped resources. Intermediates and previews are ignored by Git. The chosen source extractions are described in the converter and catalogue. No Python dependency runs on the Minecraft server.

Legacy numeric mappings come from [PrismarineJS minecraft-data](https://github.com/PrismarineJS/minecraft-data/blob/master/data/pc/common/legacy.json), MIT licensed; see `tools/legacy-blocks-LICENSE`.
