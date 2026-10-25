# Solfège

![Solfège hero demo](docs/demo.gif)

Solfège hero mode: notes scroll to a hit zone over a metronome ([MP4 version](docs/demo.mp4)).

<img src="docs/home.png" alt="Home screen" width="260">

A note-reading trainer for phones. French UI, installable, works offline.

- **Une note**: a note appears on the staff, tap its name as fast as you can.
- **Solfège hero**: notes in real rhythms scroll toward a hit zone over a metronome; tap each one on the beat.
  Random bars or built-in tunes, with a tempo that adapts to how well you play.

Treble, bass and alto clefs, sharps and flats, adaptive practice that brings back the notes you miss, streaks and combos.

## Install on a phone

1. Open the GitHub Pages URL of this repository in Chrome (or Safari on iOS).
2. Menu → **Install app** (or **Add to Home screen**).
3. Launch it from the home screen; portrait and landscape both work.

## Development

```sh
npm install
npm run dev        # http://localhost:5173, also served on the LAN
npm test
npm run typecheck
npm run build      # output in dist/
npm run preview    # serve the production build on port 4173
npm run icons      # regenerate the PNG icons from public/favicon.svg (needs Google Chrome)
npm run demo       # node scripts/demo.mjs, regenerate docs/demo.mp4, docs/demo.gif and docs/home.png
```

To regenerate the demo, run `npm run build && npm run preview` first, then `npm run demo` (needs Google Chrome and ffmpeg at `/opt/homebrew/bin/ffmpeg`).
The script drives the game through `window.__solfege`, which is only exposed with `?demo` in the URL (or in `npm run dev`).

On desktop, answer with the keys `c d e f g a b` or `1`–`7`, and `Shift` + letter for the sharp. Installing and offline support need a secure context,
so they only work on the GitHub Pages URL (or `localhost`), not over LAN HTTP.

## Deploy

Every push to `main` runs the tests, builds, and publishes `dist/` to GitHub Pages through
`.github/workflows/deploy.yml`. The repository's Pages source must be set to **GitHub Actions**
(Settings → Pages).
