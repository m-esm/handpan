# Alamut

A courtyard for sound. A handpan practice space with six Persian mountain and courtyard settings. The library lists every pattern with search and kind filters. Each row opens one piece workspace without playing audio. On phones, a compact courtyard preview leaves room for browsing; a selected piece gives the handpan and active score priority.

Practice patterns for the Gear4music DISC 10-note D Kurd handpan. The ding is D3. The tone fields are A3, B-flat3, C4, D4, E4, F4, G4, A4, and C5, at 440 Hz.

The Songs filter includes **Nothing Else Matters — Intro** by Metallica: a six-bar opening study transposed to A minor for the available notes, with an added practice ending. The opening is `1–3–5–8–5–3` (A3–C4–E4–A4–E4–C4), in 6/8 at 48 dotted-quarter BPM. It is an intro arrangement, not a full-song transcription. Open it in Play or Learn at `#/p/nothing-else-matters`.

https://m-esm.github.io/handpan/

Play the handpan from the Library, Play, or Learn with number keys 0–9 (including the numeric keypad); 0 is the ding and T plays tak. Multiple keys can be struck together. Held keys do not repeat, and shortcuts leave search, form inputs, and Explore controls alone.

A selected piece has one title, a Library link, and Play / Learn mode links. Play has the full score and transport; Learn practices one phrase at a time. Both keep the same selected piece. The handpan and score highlight current and upcoming notes. The header holds Microphone, Mirror, the landscape picker, and Explore. Phones group them under Tools. Escape closes Tools, then returns to the library with its search and filter intact and focus on the piece row.

Microphone is available in Play. The page shows the note you struck and waits until you strike the lit note. Learn uses screen notes, so its Microphone control is disabled with an explanation. Opening a piece or restoring Learn never starts audio or requests microphone access.

Start learning chooses a simple Hands drill from the catalog. Continue learning names the last practiced piece and restores its phrase and tempo. Learn divides the existing score into one-bar phrases. Hear phrase plays the selected bar once, including rests; Try notes waits for your taps on the pan or number keys (T for tak); Repeat slowly loops the same bar at 70% of the original tempo, within the player's 48–140 BPM limits. The practice tempo slider applies to both listening modes. Chords accept each unique note in any order, without a timing score. Screen taps teach note order, not physical handpan accuracy. Rest slots retain their timing in playback and are skipped in Try notes. A fully silent bar explains the rest without starting playback.

Pause and Resume use the existing player's note-based resume: the current note plays again. Restart phrase returns to the bar's start. Next phrase is always a deliberate choice, and completion does not mark anything learned. Mirror preserves the active phrase. Learn's score is a reading surface; score clicks, drags and arrow keys cannot exit Learn or create whole-piece loops. Switching modes or leaving cancels pending practice playback. The legacy step guide is retired; existing `disc-kurd-step` and `disc-kurd-learned` data is preserved, and Play retains optional learned-part checkboxes.

Piece URLs use `#/p/id/play` and `#/p/id/learn`; existing `#/p/id` links still open Play. Direct Learn links restore the saved phrase and tempo for that piece silently. Unknown routes return to the library. Check the pure practice logic and mocked playback with `node scripts/check-practice.mjs`; browser layout, interaction and real-instrument accuracy are separate checks.

On a phone, Enable motion lets you gently tilt and rotate the 3D handpan with the device. Allow motion access when asked, hold the phone comfortably, and use Recenter to reset its neutral position. Tap Motion on to switch it off. Sensor access requires HTTPS or localhost and a browser with device orientation support.

Check motion handling with `node scripts/check-motion.mjs`.

Check the pieces before pushing: `node scripts/check.mjs [candidate-pieces.js]`. It prints every piece and ends with the fault count.

The landscapes and 36 cover illustrations are original artistic interpretations inspired by the [Institute of Ismaili Studies Alamut Valley photographic collection](https://www.iis.ac.uk/multimedia/sites-alamut-valley/), including the narrow fortress ridge, winter mountains, cultivated terraces, and poplar-lined valley. They are not historical reconstructions. Reference photographs are not bundled with the app.

The loading screen offers a simple view with the original library and sheet if 3D takes too long. Static scenery is batched by material, and rendering settles when the instrument is idle. The scene controls redraw on state changes and retain unchanged objects. Append `?perf=1` to inspect sampled frame timing and renderer counts in the handpan element's `data-profile` attribute.
