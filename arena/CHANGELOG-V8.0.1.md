# 8.0.1

Woodland Court, Sky Blossom and Grand Colosseum could ignore map-selection clicks because the browser required an already prepared, free copy before saving the choice. These designs appear late in initial preparation, making the rejection especially visible.

- Save compatible map choices independently of preparation and occupancy. Keep selected cards green even while waiting.
- Display available/preparing counts on both the selection marker and theme icon.
- Prioritize one unused copy of the selected design in the existing asynchronous preparation queue. Preserve its chunk order and any request already in flight; selection performs no chunk generation or arena reservation.
- Explain preparation versus busy copies when the player tries to start. Keep the prepared-copy allocation guard and kit size restrictions.
- Reuse the existing v8 worlds, bundled builds, kits and player data.

Validation: regression tests first reproduced both silent rejection cases; focused and full suites cover the named designs, selection status, busy copies, preparation ordering and safe allocation. The previous 8.0.0 native geometry checks still apply to the unchanged builds. A connected Minecraft client's GUI was not exercised for this patch.
