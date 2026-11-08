# Eclipse-inspired presentation pass

Reference supplied by the user: https://tatnatyt.github.io/eclipse-website/
Source inspected: https://github.com/tatnatYT/eclipse-website and its deployed index.html, style.css and main.js (8 November 2026).

The browsing service could not open the live page, but direct HTTPS requests returned its HTML/CSS/JS successfully. The analysis below is based on that source. Native browser rendering remains unavailable because the browser host and computer-use pipe do not connect.

## What gives the reference its identity

- Violet night surfaces with lavender highlights, translucent panels and soft ambient illumination.
- A floating, rounded glass navigation bar and a clear active-link treatment.
- A centered, viewport-height hero with an orbital emblem, futuristic Orbitron typography, supporting Inter text and a strong call to action.
- Illustrated category ribbons, a feature grid, sequential walkthrough panels, expandable questions and an oversized outlined footer wordmark.
- Progressive navigation and small user-driven interactions that support exploration.

## Adaptation for this tierlist

New default home route: a centered PvP/Tierlist wordmark, original shield medallion, orbital geometry and star layers. Our existing original voxel-arena artwork supplies the scene; Arena/Night sky controls switch its presentation. The former rankings route remains directly accessible at #rankings and player links still open their profiles.

The home page includes a clickable kit ribbon, a feature grid linked to the actual kits/testing/tagger routes, a three-step interactive testing walkthrough, a native details/summary FAQ, and a founding-community CTA. Displayed numbers come from configuration/public data: 15 modes, ten tier bands, one community and the real published player count.

The same violet palette, translucent panels, button treatment and floating navigation extend across ranking and testing pages. Tier colors retain their separate meanings. Motion consists of a short entry reveal and user-driven hover/state feedback; reduced-motion preferences disable animation and animated transitions. The native pointer remains visible, and no timed intro blocks navigation.

No Eclipse logo, backgrounds, application screenshots, code files, product claims or download links are deployed in this project. All new HTML/CSS/JS is independently implemented. The reference remains credited here; this is not an Eclipse-affiliated product.

## Design tokens and hierarchy

Deep violet background #0d0a16, panel #191423, structure #342a46, text #f1edf9, lavender highlight #c2a7ff, warm semantic tier gold #efc275. Inter carries reading and controls, Orbitron carries the new brand/hero wordmark. The competition pages retain readable data-oriented typography.

```text
Floating glass navigation
Centered orbital identity + PvP wordmark
Testing CTA / Rankings CTA / Scene controls
Clickable kit ribbon
Real structure/data counters
Feature grid: modes / tagger / review process / progression
Interactive testing walkthrough
FAQ
Founding-community CTA
Outlined wordmark footer
```

The homepage deliberately follows the reference’s presentation-led structure. Rankings remain a focused competition workspace so existing players can bypass the introduction.

## Verification

DOM interaction coverage includes the default homepage, scene-toggle pressed states, walkthrough selection, kit-to-ranking navigation and all earlier ranking/testing interactions. CSS formatting/parsing and site build are checked. Actual viewport screenshots, mobile rendering and in-game tagger behavior are not newly verified by these tests. No server/bot functionality was changed in this presentation pass.
