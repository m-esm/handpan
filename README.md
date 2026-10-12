# Alamut

A courtyard for sound. A handpan practice space with six Persian mountain and courtyard settings. The library lists every pattern with search and kind filters. Wide screens show the library on the left and the handpan on the right. Phones show the handpan on top and the library below it.

Practice patterns for the Gear4music DISC 10-note D Kurd handpan. The ding is D3. The tone fields are A3, B-flat3, C4, D4, E4, F4, G4, A4, and C5, at 440 Hz.

https://m-esm.github.io/handpan/

A piece opens with the player under the handpan and the bar-grid note sheet under the player. The handpan and the sheet highlight the current and upcoming notes. The header holds Listen, Mirror, the landscape picker, and Explore. Phones group them under Tools. Learn in steps takes a full piece one part at a time, then joins the parts. Escape closes Tools, then returns to the library.

Listen uses the microphone. The page shows the note you struck, and on a piece it waits until you strike the lit note.

Start beginner practice chooses a simple Hands drill from the catalog. Every pattern also has a Practice button. Practice divides the existing score into one-bar phrases without changing saved Learn in steps progress. Hear phrase plays the selected bar once, including rests; Try notes waits for your taps on the pan or number keys (T for tak); Repeat slowly loops the same bar at 70% of the original tempo, within the player's 48–140 BPM limits. The practice tempo slider applies to both listening modes. Chords accept each unique note in any order, without a timing score. Screen taps teach note order, not physical handpan accuracy. Rest slots retain their timing in playback and are skipped in Try notes. A fully silent bar explains the rest without starting playback.

Pause and Resume use the existing player's note-based resume: the current note plays again. Restart phrase returns to the bar's start. Next phrase is always a deliberate choice, and completion does not mark anything learned. Continue practice restores the last pattern, bar and tempo without playing audio or requesting the microphone. Mirror preserves the active phrase; using Listen or a legacy sheet/step control exits practice. Check the pure practice logic and mocked playback with `node scripts/check-practice.mjs`; browser interaction and real-instrument accuracy are separate checks.

On a phone, Enable motion lets you gently tilt and rotate the 3D handpan with the device. Allow motion access when asked, hold the phone comfortably, and use Recenter to reset its neutral position. Tap Motion on to switch it off. Sensor access requires HTTPS or localhost and a browser with device orientation support.

Check motion handling with `node scripts/check-motion.mjs`.

Check the pieces before pushing: `node scripts/check.mjs [candidate-pieces.js]`. It prints every piece and ends with the fault count.

The landscapes and 36 cover illustrations are original artistic interpretations inspired by the [Institute of Ismaili Studies Alamut Valley photographic collection](https://www.iis.ac.uk/multimedia/sites-alamut-valley/), including the narrow fortress ridge, winter mountains, cultivated terraces, and poplar-lined valley. They are not historical reconstructions. Reference photographs are not bundled with the app.

The loading screen offers a simple view with the original library and sheet if 3D takes too long. Static scenery is batched by material, and rendering settles when the instrument is idle. The scene controls redraw on state changes and retain unchanged objects. Append `?perf=1` to inspect sampled frame timing and renderer counts in the handpan element's `data-profile` attribute.
