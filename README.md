# Alamut

A courtyard for sound. A handpan practice space with six Persian mountain and courtyard settings, brass and ivory note cues, and a compact music library. Hide the library to focus on the instrument, or open a piece to learn it one part at a time. Landscapes follow the selected piece; the landscape menu also lets you choose a setting yourself.

Practice patterns for the Gear4music DISC 10-note D Kurd handpan. The ding is D3. The tone fields are A3, B-flat3, C4, D4, E4, F4, G4, A4, and C5, at 440 Hz.

https://m-esm.github.io/handpan/

The list holds drills and full pieces written for these ten notes. Play one from the list. Open it to follow the same note on the pan and on the sheet. Loop a part or a range of bars, and tick a part when you have learned it. Learn in steps takes a piece one part at a time: each new part alone, then a join from bar 1 to the end of that part, then the whole piece.

Listen uses the microphone. The page shows the note you struck, and on a piece it waits until you strike the lit note.

Check the pieces before pushing: `node scripts/check.mjs [candidate-pieces.js]`. It prints every piece and ends with the fault count.

The landscapes and 36 cover illustrations are original artistic interpretations inspired by the [Institute of Ismaili Studies Alamut Valley photographic collection](https://www.iis.ac.uk/multimedia/sites-alamut-valley/), including the narrow fortress ridge, winter mountains, cultivated terraces, and poplar-lined valley. They are not historical reconstructions. Reference photographs are not bundled with the app.

The loading screen offers a simple view if 3D takes too long. Static scenery is batched by material, and rendering settles when the instrument is idle. Append `?perf=1` to inspect sampled frame timing and renderer counts in the handpan element's `data-profile` attribute.

Explore Alamut opens a world view with glowing 3D landmarks. Drag to turn the camera, select a landmark or use the place buttons, then choose music to open its lesson. Escape returns to the instrument. The location collections are derived from the music catalogue at runtime.
