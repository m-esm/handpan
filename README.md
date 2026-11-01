# Alamut

A handpan practice space. Alamut stays behind the player and moves through day, night and the seasons. The library lists every pattern with search and kind filters. Each row opens one piece workspace without playing audio. On phones, the handpan and library share the screen. A selected piece gives the handpan and active score priority.

Practice patterns for the Gear4music DISC 10-note D Kurd handpan. The ding is D3. The tone fields are A3, B-flat3, C4, D4, E4, F4, G4, A4, and C5, at 440 Hz.

The playable catalog is selected by `library: true` on each definition in `js/pieces.js`. The [generated library](p/index.html) is the current listing and notation source; hidden historical definitions do not become library entries. The three existing arrangements are preserved. The new cover arrangements have complete standalone forms but remain provisional musically: their English and Persian descriptions disclose transposition, range substitutions and verification limits. Source evidence and remaining review are recorded in [arrangement evidence](docs/arrangement-evidence.md).

Live site: https://handpan.moshes.io (the practice app at `/`, features at `/features`, `/app/` redirects to `/`). `alamut.moshes.io` is an alias of the same deployment. The GitHub Pages copy at https://m-esm.github.io/handpan/ serves the repo root as is.

## Deployment

Every push to `main` deploys itself. The `image` workflow builds `Dockerfile` (nginx-unprivileged serving the repo with `deploy/nginx.conf`) for `linux/amd64` and pushes it to `ghcr.io/m-esm/handpan` under two tags: the full commit sha and `main-<run_number>-<sha7>`. On the k3s cluster ha3, Flux image automation in `m-esm/cluster-moshes-lab` (`apps/alamut/images/`) watches that package, picks the highest run number, commits the new tag into `apps/alamut/deployment.yaml` as `fluxcdbot`, and rolls the `alamut` Deployment in namespace `alamut`. Merge to live takes the Actions build plus up to about ten minutes of Flux polling. Check the chain with:

```bash
gh run list --workflow image --limit 3
KUBECONFIG=~/.kube/ha3.yaml flux get images all -n tenant-moshes-lab
KUBECONFIG=~/.kube/ha3.yaml kubectl -n alamut get deploy alamut -o jsonpath='{.spec.template.spec.containers[0].image}'
```

Pin a version by removing the `$imagepolicy` setter marker in the tenant repo in the same PR that sets the tag. Pause the automation with `kubectl -n tenant-moshes-lab patch imageupdateautomation alamut --type merge -p '{"spec":{"suspend":true}}'`. Hosts, certificate, route and rollout settings live only in the tenant repo; this repo owns the image. The infra inventory is `m-esm/infra` `services/README.md`.

Play the handpan from the Library, Play, or Learn with number keys 0–9 (including the numeric keypad); 0 is the ding and T plays tak. Multiple keys can be struck together. Held keys do not repeat, and shortcuts leave search and form inputs alone.

A selected piece has one title, a Library link, and Play / Learn mode links. Play has the full score and transport; Learn practices one phrase at a time. Both keep the same selected piece. The handpan and score highlight current and upcoming notes. The header holds Microphone, motion and the songbook. Phones group them under Tools. Escape closes Tools, then returns to the library with its search and filter intact and focus on the piece row.

Microphone is available in Play. The page shows the note you struck and waits until you strike the lit note. Learn uses screen notes, so its Microphone control is disabled with an explanation. Opening a piece or restoring Learn never starts audio or requests microphone access.

Start learning chooses a simple Hands drill when one is available, otherwise the least complex current piece. Continue learning names the last practiced piece and restores its phrase. Learn divides the existing score into one-bar phrases. Hear phrase plays the selected bar once, including rests; Try notes waits for your taps on the pan or number keys (T for tak); Repeat phrase loops the same bar at the piece's authored tempo. Chords accept each unique note in any order, without a timing score. Screen taps teach note order, not physical handpan accuracy. Rest slots retain their timing in playback and are skipped in Try notes. A fully silent bar explains the rest without starting playback.

Pause and Resume use the existing player's note-based resume: the current note plays again. Restart phrase returns to the bar's start. Next phrase is always a deliberate choice, and completion does not mark anything learned. Mirror preserves the active phrase. Learn's score is a reading surface; score clicks, drags and arrow keys cannot exit Learn or create whole-piece loops. Switching modes or leaving cancels pending practice playback. The legacy step guide is retired; existing `disc-kurd-step` and `disc-kurd-learned` data is preserved, and Play retains optional learned-part checkboxes.

Piece URLs use `#/p/id/play` and `#/p/id/learn`; existing `#/p/id` links still open Play. Direct Learn links restore the saved phrase and tempo for that piece silently. Unknown routes return to the library. Check the pure practice logic and mocked playback with `node scripts/check-practice.mjs`; browser layout, interaction and real-instrument accuracy are separate checks.

On a phone, Enable motion lets you gently tilt and rotate the 3D handpan with the device. Allow motion access when asked, hold the phone comfortably, and use Recenter to reset its neutral position. Tap Motion on to switch it off. Sensor access requires HTTPS or localhost and a browser with device orientation support.

Check motion handling with `node scripts/check-motion.mjs`.

Search engines and AI assistants read static pages, not the hash routes, so every pattern also has a plain HTML page at `p/<id>` (hub at `p/`) with its number notation, tempo, time signature, notes used, the Persian text, and a link into the app. `node scripts/seo.mjs` derives those pages plus `sitemap.xml`, `llms.txt` and `llms-full.txt` from `js/pieces.js`, `js/score.js`, `js/added.js` and `js/content.fa.js`; run it after changing a piece and commit the result. `node scripts/seo.mjs --check` fails when any of them is stale or a page has no pattern. `node scripts/cards.mjs` renders a 1200×630 share card per pattern into `img/cards/` from the cover thumbnail, title, kind and tempo (dwebp, rsvg-convert and sips); the piece pages use it as their Open Graph image and `--check` re-renders and compares bytes. The Share button on a piece shares the `p/<id>` address, because link previews come from those static pages, not from the hash routes. `node scripts/icons.mjs` renders `img/og.png` and the PNG icons from `img/alamut-mark.svg` with rsvg-convert; `--check` only confirms they exist. The three hand-written pages carry canonical, Open Graph and JSON-LD tags; `robots.txt` allows search and AI-search crawlers and names the sitemap. The canonical host is handpan.moshes.io: nginx redirects alamut.moshes.io, `/app/` and the `.html` paths to the canonical URLs, and the GitHub Pages copy points its canonical tags there.

Check the pieces before pushing: `node scripts/check.mjs [candidate-pieces.js]`. It prints every piece and ends with the fault count.

Each library row shows when its piece was added, and pieces from the last seven days carry a New badge. Sort by Newest first lists them in order of addition. The piece header shows the full date. The dates come from git, not from a hand-kept list: `node scripts/added.mjs` finds the commit that last added each id and writes `js/added.js`. For an uncommitted new ID, the first generated timestamp is provisional and reused on subsequent runs. After committing the piece, rerun the generator to replace that provisional date with the introduction commit date. `node scripts/added.mjs --check` fails when the file is stale, and `check.mjs` counts a piece with no date as a fault.

The Alamut landscape follows the rock and castle as Peter Willey surveyed them and as Hamideh Choubak's excavations describe them for 1090 to 1256: a north-west to south-east conglomerate ridge with a bare prow, an upper and a lower castle divided by a walled field, the great east wall with its two stone-faced turrets and the single gate below the east tower, a domed command building with turquoise tile, the rock-cut water channel halfway up the south face, and Gazor Khan and Shotor Khan at the foot. The valley includes poplars, hawthorn, terraced fields and a braided river. The distant mountain range is omitted to leave an open sky. The historical references are listed in [docs/alamut-reference.md](docs/alamut-reference.md). Heights are compressed to fit the camera; the 36 cover illustrations remain artistic interpretations. Reference photographs are not bundled with the app.

The loading screen offers a simple view with the original library and sheet if 3D takes too long. Static scenery is batched by material. Alamut stays as the background and moves through day, night and the seasons. Motes, fireflies, a slow camera drift, the handpan hovering above its pedestal, and the occasional shooting star continue. With `prefers-reduced-motion` the valley holds a still afternoon and redraws only on state changes. Append `?perf=1` to inspect sampled frame timing and renderer counts in the handpan element's `data-profile` attribute.
