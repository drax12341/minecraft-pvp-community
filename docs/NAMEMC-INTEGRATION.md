# NameMC and Minecraft identity

Player profiles and control-room player actions link directly to NameMC using
the permanent Minecraft UUID. No name-based matching, account claims or rank
imports occur. Preview/sample players and malformed UUIDs have no external
profile. Public names are escaped, and external links use fixed HTTPS origins.

The player identity panel displays the published username and UUID, supports
copying the UUID, and offers 3D, front and texture views plus a skin PNG download.
Skin failures leave the NameMC link available and allow retrying another view.

Sources are labelled accurately: community records supply rankings and published
names; [MCHeads](https://mc-heads.net/) renders current Minecraft skins;
[NameMC](https://namemc.com/) opens skin and name history in its own website.
Skin/name history is not mirrored or automatically synchronized from NameMC.

No documented public NameMC skin/profile-history API could be verified.
[NameMC's terms](https://namemc.com/terms) distinguish documented public APIs
from automated extraction. The integration does not scrape pages, use an
unofficial proxy, or bypass access controls. Public APIs for unrelated server
likes/friends are not a skin/profile-data API.

The frontend remains on GitHub Pages. No new secret, paid service, login flow,
backend deployment or database change is required.
