# CommunityArena 7.0.0 preview

- Added clickable Compact/Standard/Sky map-size buttons, six-biome filtering, biome-preserving changes, random available selection and busy-map feedback. Busy acceptance no longer discards a still-active invitation.
- Improved all eighteen arenas with biome-specific landmark clearings, and expanded the courtyard with a grand arch, arcades, corner towers, paving, inset lights and seats. Fresh v7 worlds keep earlier owned builds available for rollback.
- Preserved v6 geometry for archived-world generation and added explicit v6 journal recovery. Legacy cleanup avoids generating nonexistent chunks. Current v7 journals and temporary-entity hooks use their own namespace.
- Reduced a fixed 1,000-record hologram ranking fixture from 18,204 to 2,000 integer reads without changing results/ties. Same-stat boards share one refresh snapshot and stable text avoids redundant assignment. No runtime dependency added; no network-ping guarantee is made.

Clean verification, regression mutation checks and independent review accompany the release. See INSTALL-V7.md for installation, inherited kit assumptions, profiling and rollback. Native client appearance, real host TPS/RTT and power-loss/load behavior still require staging verification.
