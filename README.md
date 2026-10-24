# Solfège

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
```

On desktop, answer with the keys `c d e f g a b` or `1`–`7`, and `Shift` + letter for the sharp. Installing and offline support need a secure context,
so they only work on the GitHub Pages URL (or `localhost`), not over LAN HTTP.

## Deploy

Every push to `main` runs the tests, builds, and publishes `dist/` to GitHub Pages through
`.github/workflows/deploy.yml`. The repository's Pages source must be set to **GitHub Actions**
(Settings → Pages).
