# antislop audit 001, follow-up, 2026-11-02

All 22 numbers from `audit-001-2026-11-01.md` were approved and fixed on `main`.

| # | Fix | Where |
|---|-----|-------|
| 1 | Rise and Sink hold on Enter and Space, release on key up or blur; the touch pads drop the slider role and are `aria-hidden` | `js/explore.js` |
| 2 | Microphone errors say "press Microphone" | `js/i18n.js` |
| 3 | Motion denied, motion failed, insecure microphone and the printed hand letters go through `t()` with Persian strings | `js/motion.js`, `js/main.js`, `js/print.js`, `js/i18n.js` |
| 4 | Reduced motion freezes particles, sky, aurora and runes; the media query is live | `js/scene.js` |
| 5 | Bars need 40 px per slot before sharing a row; phones give the bar number 36 px. Slots measure 43 px at 390 px wide and 33 px at 320 px, the floor for a 7-slot bar | `css/app.css` |
| 6 | The notation legend is a visible line above the sheet in Play | `js/main.js`, `css/app.css` |
| 7 | `llms.txt` says substitution notes appear where a note was substituted | `scripts/seo.mjs` |
| 8 | One glow left, the medallion ring; streak, lanterns, pop and tier names stay brass; `--teal` and `--violet` deleted; the heard note in 3D is brass | `css/app.css`, `js/main.js`, `js/scene.js` |
| 9 | No backdrop blur anywhere | `css/app.css` |
| 10 | Explore eyebrow removed; stage kicker is a plain fact line | `js/explore.js`, `index.html`, `css/app.css` |
| 11 | Tracking capped at 0.08em | `css/app.css` |
| 12 | "More <kind>" only renders with a sibling | `scripts/seo.mjs`, `p/*.html` |
| 13 | Google Fonts swap on `features.html` and the generated pages | `features.html`, `scripts/seo.mjs` |
| 14 | Cover count and change-log sentence removed, duplicate valley sentence removed, "set of forty" removed | `README.md`, `scripts/thumbs.mjs` |
| 15 | Kicker, library intro, meta description and site kicker rewritten in English and Persian; og.png regenerated | `js/i18n.js`, `index.html`, `scripts/icons.mjs`, `img/og.png` |
| 16 | Instrument Serif and Pinyon Script dropped from the CSS and the font URLs | `css/app.css`, `index.html`, `features.html` |
| 17 | Noise overlay, loader glow, breathe keyframes and the unused variables deleted | `css/app.css`, `index.html` |
| 18 | "9 songs, 1 piece", "Kind: Piece", "About this piece" | `scripts/seo.mjs` |
| 19 | Piece-page h2 at 18 px above the 15 px h3 | `css/site.css` |
| 20 | Disabled controls show `not-allowed` | `css/app.css` |
| 21 | "All pieces" carries `aria-current="page"` on the hub | `scripts/seo.mjs` |
| 22 | First six hub thumbnails load eagerly | `scripts/seo.mjs` |

Checks on Node 22: `check` 0 faults, `check-motion`, `check-practice`, `check-interactions`, `check-audio`, `check-textures`, `seo --check`, `added --check` all pass. `check-interactions` lost its assertions on the removed eyebrow and pad labels and gained one for the pads' `aria-hidden`.

Browser: 127.0.0.1:8767, zero console errors. Desktop 1024 x 768: library, Play with playback, Learn, Explore (Enter and Space hold Rise), Features, piece page. Phone 320 x 740 and 390 x 844: no horizontal overflow on library, Play and the piece page; Persian renders the new kicker, intro and legend.

Not verified: a real microphone (the game panel was forced visible with a tier set by script to check its styling), a real phone, and reduced motion on a device.
