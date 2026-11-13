# Eclipse reference and GitHub Pages redesign

Reference: https://tatnatyt.github.io/eclipse-website/ and its public repository,
inspected again on 13 November 2026. The repository was downloaded for reference
only under ignored `.runtime/eclipse-reference`; its code and branded assets are
not copied into the community site.

## Direction

The rejected Impact homepage was a dense steel-blue dashboard with a large hammer
illustration. Replace it with the supplied reference's centered presentation:
floating navigation, a restrained violet night scene, a small orbital community
emblem, a Mace wordmark, two primary actions, feature panels, a tabbed showcase,
testing walkthrough and FAQ. Keep data-heavy interfaces behind their own routes.

Use one new stylesheet rather than layering another visual override onto three
older designs. Inter handles reading and controls; Orbitron is reserved for the
brand. Backgrounds are `#0b0a10`/`#14111d`, text `#efecf8`, secondary text
`#b2a9c5`, and lavender `#b49cff`. Tier colours keep their semantic meanings.

Feature adaptation: seven real Mace modes, tier-based rankings, live sessions,
player profiles, tier tagger, command search, watchlists and insights. The hero
scene, feature showcase and testing guide respond to user input. Native FAQ
disclosures, keyboard tab controls, Calm view and device reduced motion remain.
No blocking intro, replacement cursor, fake FPS/players or irrelevant client
downloads are introduced.

## Hosting contract

Primary public website: https://drax12341.github.io/minecraft-pvp-community/

The source is the existing public GitHub repository. Its existing Pages Actions
workflow tests the source, builds `dist`, and deploys to GitHub Pages on `main`.
Do not deploy this redesign to Sites. The established cloud HTTP service remains
the backend for Discord and public ranking/session/loadout feeds.

Project-relative links must work below `/minecraft-pvp-community/`. Production
API requests from GitHub Pages use the existing backend, not GitHub's static
origin. No `.env` content is published. Canonical metadata and the delivered link
must point to GitHub Pages.

## Validation

Retain all existing behavioural coverage, replace checks tied to the rejected
hero with scene/showcase/guide checks, and exercise reduced motion and GitHub
project-path data requests. Run tests and the static Pages build before pushing.
Verify the GitHub Pages workflow and the deployed assets after publication.

The native browser host is still unavailable, and the alternate connected
browser tool requires authentication. Reference inspection is based on its
actual HTML/CSS/JS and image assets. Do not claim full-page browser screenshots
or viewport/animation verification without a working browser.
