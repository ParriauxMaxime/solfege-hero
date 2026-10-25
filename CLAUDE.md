# Solfège hero

Offline PWA to learn to read sheet music. Personal project, French UI, played mostly on an Android phone (portrait and landscape). Public repo `ParriauxMaxime/solfege-hero`, deployed to GitHub Pages on every push to `main`.

## Working rules

- Push to `main` without asking. Nothing is live for anyone but the owner.
- `npm test` and `npm run build` must be green before every push. Browser check at 390x844, 360x780 and 844x390 with screenshots in `scratch/` (gitignored).
- Pure logic lives in tested modules; UI is verified in the browser, not unit-tested.
- Icons are inline SVG from `src/ui/icons.ts`, never text glyphs in buttons (they sit off-centre).
- No new runtime dependencies, except `pdfjs-dist` (accepted by the owner for PDF import; worker and wasm precached). Sounds are synthesized (WebAudio), no audio assets.
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
- **Survie**: 3 lives, 3 s or 5 s per note with a draining bar, difficulty rising every 20 hits, challenge links `#v=`.
- **Hero challenges**: fixed-length (16 bars) shared runs `#h=`, adaptive tempo off, compare success % then points. Hero difficulty 1-5 shown as stars; **Séries difficulty** 1-5 in settings and carried in links. **Défi du jour** (`#daily=`), retries labelled "Entraînement".
- **Catalogue**: `public/scores/` (community PRs, see CONTRIBUTING), `index.json` generated at build by `scripts/build-score-index.mjs`, listed as built-in; metadata parsed when the library opens.
- **Octave stricte** setting (`src/game/strictOctave.ts`): landscape forces 2 octaves, portrait shows a rotation notice; exact-pitch stats in `progress.pitches`.
- **Demo video**: `npm run demo` (`scripts/demo.mjs`, `?demo` hook in `src/ui/demoHook.ts`) records `docs/demo.gif`/`demo.mp4` for the README.
- **Armures** mode: key signature only, answer the major tonic (or relative minor / both, `keysMode` setting) on the 12-key pad; adaptive sampler `src/game/keysSampler.ts`, stats `progress.keys`, shared game loop `src/ui/drillGame.ts` (Apprendre = `game.ts`, Armures = `keysGame.ts`); home is 2x3 portrait / 5 columns landscape.
- Learn 60 s chrono is the Jeu setting "Apprendre : chrono 60 s".
- **Import PDF / photo (OMR phase 1, heuristic, no ML)**: `src/omr/` pure pipeline (Sauvola binarisation, deskew, staves/systems, heads/stems/beams, clef/key/time header, pitch, rhythm, per-note confidence, uncertain measures) run in `src/omr/worker.ts`; PDF pages rendered by `src/omr/pdf.ts` (pdfjs, wasm emitted to `dist/pdfjs-wasm/` by a vite plugin). Systems of several staves keep staff N (default top = vocal line of piano/voice scores). UI in `src/ui/omr/`: page and staff picker, progress, mandatory review screen (source crop, confidence colours, edits in `src/omr/edit.ts`, playback) saving as source `'omr'`. Static page renderer `src/ui/sheet.ts`. Fixtures `src/omr/fixtures/` regenerated by `node scripts/omr-fixtures.mjs`; real-PDF eval `node scripts/omr-eval-pdf.mjs <pdf> [pages] [--staff N] [--truth json]` (overlays in `scratch/`). Accuracy: 8 clean fixtures 100 % except Lettre à Élise 97,5 %, degraded 100 %; real scanned piano/voice PDF ~85-90 % pitch+duration on the vocal line, ~1 s per page in desktop Chrome.
- **Daily history**: `progress.history[YYYY-MM-DD][mode]` (`{answered, correct, totalMs, timed, games, best}`, 400 days) and weekly `progress.noteHistory[YYYY-Www][clef:midi|keys:n]` (52 weeks), pure logic in `src/stats/`, one `recordHistory()` call per answer and game end in each mode.
- **Stats screen**: totals, 16-week activity heatmap, per-mode progression charts (7/30/90 j, one y-axis each: precision and mean time are two stacked charts), notes/armures with weekly trend arrows, défis; inline SVG in `src/ui/charts/`. Dev/`?demo` only: `?seed-stats` seeds 60 days in memory, `?stats` opens the screen.
- Settings à la Tusmo: Jeu / Affichage (dark/light/system, colourblind blue/orange, reduced motion, key size) / Son / Données (JSON export/import) / À propos (Partager l'app).
- **SEO and share previews**: meta/OG/JSON-LD in `index.html` with a pre-rendered home inside `#app`; static landing pages `public/{defi,survie,hero,jour,partition}/index.html` with their own OG tags forward to `../#hash` (share links point there, old root hash links still work), `404.html` redirects to the app root. One share helper `shareLink`/`copyLink` in `src/ui/sharing.ts` (url separate from text), URLs from `src/share/links.ts`.
- **OG images**: `public/og/*.png` committed, rendered by `scripts/og-images.mjs` (`npm run og` to force, the build only renders missing ones); `npm run check:og [baseUrl]` validates tags and image sizes on `dist/` or a server.

## Layout

- `src/music/` note model, key signatures, melodies, MusicXML parse/export, unzip.
- `src/game/` adaptive sampler, scoring. `src/series/` series logic and codec. `src/hero/` clock, rhythm, meter, judgement, tempo, sources.
- `src/scores/` IndexedDB library. `src/storage.ts` settings + progress (localStorage, keys `.v2`).
- `src/ui/` screens and widgets; `staff.ts`/`heroStaff.ts`/`glyphs.ts` draw everything in SVG.
- `src/audio/` sound engine and instruments. `src/platform/` haptics.

## Backlog

OMR phase 2: optional ONNX model (oemer-style segmentation, onnxruntime-web, downloaded on demand) for heads/stems/symbols, keeping the heuristic path as fallback. Phase 1 gaps: triplets (bracket ignored, measure flagged), ties/slurs not merged, chords keep the top note only, PDF page change only before recognition, flats outside the key drawn as sharps (model stores MIDI only), perspective/curled photos untested, 360 px review shows 1-2 measures per line.

Remaining nits: hero portrait staff still smallish (2,75 beats ahead, lots of free vertical space); a hero challenge sent from a free game replays at the sender's final difficulty, so the melody differs from the sender's; strict octave physical keys always answer in the nearest window octave.

Agents never test on a real device: sound, vibration, install and PWA update are verified only by the owner on Android.
