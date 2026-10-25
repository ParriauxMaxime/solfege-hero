# Solfège hero

Offline PWA to learn to read sheet music. Personal project, French UI, played mostly on an Android phone (portrait and landscape). Public repo `ParriauxMaxime/solfege-hero`, deployed to GitHub Pages on every push to `main`.

## Working rules

- Push to `main` without asking. Nothing is live for anyone but the owner.
- `npm test` and `npm run build` must be green before every push. Browser check at 390x844, 360x780 and 844x390 with screenshots in `scratch/` (gitignored).
- Pure logic lives in tested modules; UI is verified in the browser, not unit-tested.
- Icons are inline SVG from `src/ui/icons.ts`, never text glyphs in buttons (they sit off-centre).
- No new runtime dependencies. Sounds are synthesized (WebAudio), no audio assets.
- Self-descriptive code, no verbose comments, boy-scout but no drive-by refactors.

## Run

```sh
npm install
npm run dev        # 5173, LAN http://192.168.1.112:5173/
npm run preview    # 4173, production build, use for browser checks
npm test
npm run build
docker compose up -d   # Tailscale node (personal tailnet): https://solfege.tail02b5a0.ts.net -> 5173
```

The Tailscale node needs `.env` with `TS_AUTHKEY` (copied from the `maisons` repo). `.env` and `tailscale/state/` are gitignored.

## Mobile pitfalls

- On touch screens `pointerdown` is not a user activation: WebAudio and `navigator.vibrate` stay blocked until a `pointerup`/`touchend`/`click`. `sound.unlock()` is registered on those in `src/app.ts`; every sound awaits `whenRunning()`.
- Keys answer on `pointerdown` for speed and cancel the follow-up `click`, otherwise the tap lands on whatever screen opened underneath.
- Hardware back button is intercepted (`popstate`): pause in hero, close overlays, else home.
- Time spent in background is not counted in Séries and the 60 s chrono.

## Core decisions (settled, only the owner reopens them)

- Answers: 12 chromatic keys, enharmonics merged (`Fa#/Solb`), octave ignored. Piano layout; portrait = 1 octave always, landscape = 1 / 1,5 (Sol…Do) / 2 octaves setting.
- Key signatures drawn after the clef (0–7 sharps/flats, 0 most common), notes without inline accidentals; "Armures" off = C major only. Hero adds ~2 % explicit ♮/♯/♭ on single notes.
- Hero judgement: Parfait ±80 ms (×2), Bien ±200 ms, Raté outside or wrong pitch, Raté breaks the streak, no lives, endless.

## Current state

- Clefs: sol (default), fa, ut 3, multi-select, random per prompt.
- Modes: **Apprendre** (one note, adaptive sampler weighted by misses and slowness, speed bonus ×2 under 1 s, 60 s chrono option), **Séries** (20 seeded notes, +5 s per error, Wordle-style share and challenge links `#s=&c=&k=&t=`), **Solfège hero** (scrolling staff, real durations + metronome, adaptive tempo +2 per 8 hits, −4 per miss), **Partitions** (MusicXML library).
- Scores: `.musicxml`/`.xml`/`.mxl` parsed in `src/music/musicxml.ts` (first part, voice 1, chord top note, ties merged, dots, tuplets). Stored in IndexedDB. Shared by `#score=<deflate+base64url>` link under ~6 kB, else as a `.musicxml` file. Séries on a score = whole score.
- Instruments: sine / piano / organ / guitar, all synthesized in `src/audio/instruments.ts`, picker modal with a test keyboard.
- Settings à la Tusmo: Jeu / Affichage (dark/light/system, colourblind blue/orange, reduced motion, key size) / Son / Données (JSON export/import).

## Layout

- `src/music/` note model, key signatures, melodies, MusicXML parse/export, unzip.
- `src/game/` adaptive sampler, scoring. `src/series/` series logic and codec. `src/hero/` clock, rhythm, meter, judgement, tempo, sources.
- `src/scores/` IndexedDB library. `src/storage.ts` settings + progress (localStorage, keys `.v2`).
- `src/ui/` screens and widgets; `staff.ts`/`heroStaff.ts`/`glyphs.ts` draw everything in SVG.
- `src/audio/` sound engine and instruments. `src/platform/` haptics.

## Backlog, in order

1. **Hero more musical + difficulty ramp** (may already be in flight, check `git log` for `feat: tonal seeded melody generator`): seeded generator with motifs, sequences, scale runs, calibrated against a hand-transcribed public-domain corpus in `src/music/melodies.ts`; hero difficulty 1–5 (range, intervals, rhythm, accidentals, tempo cap) shown as stars in the HUD; Séries and daily use difficulty 2.
2. **Défi du jour** (check `git log` for `feat: défi du jour`): seed `YYYYMMDD` Europe/Paris, forced settings, first attempt of the day counts, retries labelled "Entraînement", share `#daily=YYYYMMDD`, daily streak and best daily time in stats.
3. **Survie mode**: endless, 3 lives (hearts in the HUD, one breaks per error, game over on the third), 3 s or 5 s per note (setting, default 5 s) with a draining bar, timeout = error. Notes from the tonal generator, difficulty rising every 20 hits. Challenge link `#v=<seed>&c=&k=&d=<delay>&n=<score>`, Wordle-style share text, friend plays the same sequence, end screen compares scores. Stats: best score, challenges won/lost.
4. **Hero challenges**: from the hero result screen (or "Terminer" in pause), share a link with generation seed, clef, armures, start tempo, fixed difficulty, length in bars (e.g. 16) and the sender's stats (`&p=<success %>&s=<score>`). A hero challenge lasts exactly those bars with adaptive tempo off; end screen compares success percentage, then points.
5. **Séries difficulty setting** 1–5, carried in the challenge link.
6. **Score catalogue in the repo**: `public/scores/` with community PRs, index generated at build, shown in the library as built-in.
7. ~~Octave-strict mode~~ done: setting `strictOctave`, pure logic in `src/game/strictOctave.ts`. Landscape forces 2 octaves, the window (Do4, Do2, Do3 per clef) follows the note and shifts by octaves when needed; portrait shows a rotation notice and freezes the game. Computer keys answer in the window octave nearest the note. Exact-pitch stats in `progress.pitches`.
8. **Demo video in the README**: `scripts/demo.mjs` records a ~20 s hero session at 844x390 with playwright (correct answers driven from the seed), ffmpeg makes `docs/demo.gif` (< 8 MB) and `docs/demo.mp4`, GIF at the top of the README with a home screenshot `docs/home.png`.
9. **Known small fixes**: Apprendre 60 s chrono keeps running during the "Abandonner ?" prompt; challenge links leave an extra history entry; Volume and Données rows stack oddly in portrait settings; hero portrait staff still small (3 beats ahead).

Agents never test on a real device: sound, vibration, install and PWA update are verified only by the owner on Android.
