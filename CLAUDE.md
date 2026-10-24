# Solfège hero

Offline PWA to learn to read sheet music. Personal project, French UI, played mostly on an Android phone (portrait and landscape). Public repo `ParriauxMaxime/solfege-hero`, deployed to GitHub Pages on every push to `main`.

## Working rules

- Push to `main` without asking. Nothing is live for anyone but the owner.
- Fable plans and dispatches; code goes to an Opus agent that delegates to Sonnet subagents and reviews. One commit per feature, pushed. A Sonnet "tester" agent plays the game on `npm run preview` and ranks bugs/feel issues; fix the top items, retest.
- `npm test` and `npm run build` must be green before every push. Browser check at 390x844, 360x780 and 844x390.
- Pure logic lives in tested modules; UI is verified with screenshots in `scratch/` (gitignored).
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

## Product decisions (settled, do not reopen)

- Clefs: sol (default), fa, ut 3. Multi-select, random per prompt.
- Answers: 12 chromatic keys, enharmonics merged (`Fa#/Solb`), octave ignored. Piano layout; portrait = 1 octave always, landscape = 1 / 1,5 (Sol…Do) / 2 octaves setting.
- Key signatures drawn after the clef (0–7 sharps/flats, 0 most common), notes without inline accidentals; "Armures" off = C major only. Hero adds ~2 % explicit ♮/♯/♭ on single notes.
- Modes: **Apprendre** (one note, adaptive sampler weighted by misses and slowness, speed bonus ×2 < 1 s, 60 s chrono option), **Séries** (20 notes seeded, +5 s per error, Wordle-style share and challenge links `#s=&c=&k=&t=`), **Solfège hero** (scrolling staff, real durations + metronome, Parfait ±80 ms ×2, Bien ±200 ms, Raté breaks streak, no lives, adaptive tempo +2/8 hits −4/miss), **Partitions** (MusicXML library).
- Scores: MusicXML `.musicxml`/`.xml`/`.mxl` parsed in `src/music/musicxml.ts` (first part, voice 1, chord top note, ties merged, dots, tuplets). Stored in IndexedDB. Shared by `#score=<deflate+base64url>` link when < ~6 kB, else `.musicxml` file. Séries on a score = whole score.
- Instruments: sine / piano / organ / guitar, all synthesized in `src/audio/instruments.ts`, picker modal with test keyboard.
- Settings à la Tusmo: Jeu / Affichage (dark/light/system, colourblind blue/orange, reduced motion, key size) / Son / Données (JSON export/import).

## Layout

- `src/music/` note model, key signatures, melodies, MusicXML parse/export, unzip.
- `src/game/` adaptive sampler, scoring. `src/series/` series logic and codec. `src/hero/` clock, rhythm, meter, judgement, tempo, sources.
- `src/scores/` IndexedDB library. `src/storage.ts` settings + progress (localStorage, keys `.v2`).
- `src/ui/` screens and widgets; `staff.ts`/`heroStaff.ts`/`glyphs.ts` draw everything in SVG.
- `src/audio/` sound engine and instruments. `src/platform/` haptics.

## In flight / next

- Opus agent queued: tonal seeded melody generator (motifs, sequences, scale runs, calibrated against a hand-transcribed public-domain corpus), hero difficulty ramp 1–5 with stars in the HUD, **Défi du jour** (seed `YYYYMMDD` Europe/Paris, first attempt counts, `#daily=` share, daily streak). Check `git log` to see whether `feat: tonal seeded melody generator` and `feat: défi du jour` landed.
- Known gaps: no real-device test by agents (sound, vibration, install verified only by the owner); hero portrait staff still small (3 beats ahead); Apprendre 60 s chrono keeps running during the "Abandonner ?" prompt; challenge links leave an extra history entry.
- Ideas not started: Séries difficulty setting, melody catalogue curated in the repo, octave-strict mode.
