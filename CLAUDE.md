# Solfège hero

Offline PWA to learn to read sheet music. Personal project, UI in French and English, played mostly on an Android phone (portrait and landscape). Public repo `ParriauxMaxime/solfege-hero`, deployed to GitHub Pages on every push to `main`.

## Working rules

- Push to `main` without asking. Nothing is live for anyone but the owner.
- `npm test` and `npm run build` must be green before every push. Browser check at 390x844, 360x780 and 844x390 with screenshots in `scratch/` (gitignored).
- Pure logic lives in tested modules; UI is verified in the browser, not unit-tested.
- Every user-visible string goes through `t()` (`src/i18n/`), with the key added to both `messages/fr/<ns>.ts` (source of truth) and `messages/en/<ns>.ts`; whole sentences with `{params}` and `{n, plural, one {…} other {…}}`, never concatenated fragments; numbers, percents and dates via `src/i18n/format.ts`. Call `t()` at render time, never in module-level constants. Write plain spaces in French strings: `t()` adds the narrow no-break spaces before `; : ! ? % »` and after `«`.
- Icons are inline SVG from `src/ui/icons.ts`, never text glyphs in buttons (they sit off-centre).
- No new runtime dependencies, except `pdfjs-dist` (accepted by the owner for PDF import; worker and wasm cached at first PDF import (runtime `pdfjs` cache), not precached). Sounds are synthesized (WebAudio), no audio assets.
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
- Pages under `<route>/` are generated from the built `index.html` (`scripts/pages.mjs`); never add a hand-written page in `public/` for a route. Always build absolute URLs for `pushState`/`replaceState` and for fetching public files (`appBase(location.href)`): a relative URL breaks once the path is `/scores/` (and the generated pages carry `<base href="../">`).
- Hardware back button is intercepted (`popstate`): pause in hero, close overlays, else home.
- Time spent in background is not counted in Séries and the 60 s chrono.

## Core decisions (settled, only the owner reopens them)

- Answers: 12 chromatic keys, enharmonics merged (`Fa#/Solb`), octave ignored. Piano layout; portrait = 1 octave always, landscape = 1 / 1,5 (Sol…Do) / 2 octaves setting.
- Key signatures drawn after the clef (0–7 sharps/flats, 0 most common), notes without inline accidentals; "Armures" off = C major only. Hero adds ~2 % explicit ♮/♯/♭ on single notes.
- Niveau caps what is sampled, never locks anything. Séries are generated at the player's level, carried in the link (`v=4&l=`; Survie and hero challenge links carry `l=` below 100) so a friend plays the identical series; old links decode as before. Défi du jour is identical for everyone at a fixed level 50.
- Hero judgement: Parfait ±80 ms (×2), Bien ±200 ms, Raté outside or wrong pitch, Raté breaks the streak, no lives, endless.

## Current state

- Clefs: sol (default), fa, ut 3, multi-select, random per prompt.
- Modes: **Apprendre** (one note, adaptive sampler weighted by misses and slowness, speed bonus ×2 under 1 s, 60 s chrono option), **Séries** (20 seeded notes, +5 s per error, Wordle-style share and challenge links `#s=&c=&k=&t=`), **Solfège hero** (scrolling staff, real durations + metronome, adaptive tempo +2 per 8 hits, −4 per miss), **Partitions** (MusicXML library).
- Scores: `.musicxml`/`.xml`/`.mxl` parsed in `src/music/musicxml.ts` (first part, voice 1, chord top note, ties merged, dots, tuplets). Stored in IndexedDB. Shared by `#score=<deflate+base64url>` link under ~6 kB, else as a `.musicxml` file. Séries on a score = whole score.
- Instruments: sine / piano / organ / guitar, all synthesized in `src/audio/instruments.ts`, picker modal with a test keyboard.
- **Timeline staff** (`src/ui/timelineStaff.ts`, pure math in `timelineLayout.ts`): Séries, Défi du jour and Dictée keep every answered note on one staff, bar line every 4 notes, inline clef/key change blocks, pinned clef + key header (notes passing under it fade out), auto scroll by `translate3d` 250 ms (instant with reduced motion), current note at 68 % once scrolling starts. Colours: current accent pulse, first try muted grey, missed target red then green fill + red outline (blue/orange in colourblind); the wrong note is never drawn; Dictée shows a dashed slot (red after a miss) until found.
- **Dictée** (`src/dictation/`, `src/ui/dictation.ts`, `dictationStart.ts`): 20 heard notes, hidden slot on the timeline staff revealed when found, +5 s per error, optional Do reference twice (setting `dictationReference`), « Réécouter » (`r`) free and counted in `progress.dictation.replays`. One clef (seed among the selected ones), one key signature; `dictationRange(level, clef)` = octave C4-C5 at 0, ~1.5 octave at 50, whole staff (2 ledger lines) at 100, folded by octaves for fa/ut; keys and accidentals from `capsFor`. Links `#d=<seed>&c=<clef>&l=<level>[&k=0][&t=]` (landing `dictee/`): the parser rejects any link carrying `s`, `h`, `v`, `n`, `score` or `daily`, because Séries links also use `d=` (difficulty). The chrono starts with the first note, after the audio context runs (overlay « Touche l’écran pour activer le son » otherwise).
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
- **Niveau 0–100** (`src/level/`): `capsFor(level)` caps armures (0/1/2/4/6/7 fifths at 0/20/40/60/80/100, keys near the cap weighted up), ledger lines (0/1/2 at 0/35/70), inline accidentals (≥ 30), hero max difficulty and tempo cap, Survie default delay (5 s below 50). Applied in Apprendre (a fixed armure overrides the key cap), Armures (at least ±1), Séries, Survie, hero free play; 100 = uncapped, identical to before. Auto (default on): window of the last 50 Apprendre + Armures answers in `progress.levelWindow`, ≥ 90 % and median < 2 s → +5 with toast, < 60 % → −5 silently, window reset after a step. Settings section « Niveau » on top, level pill on Apprendre/Armures intros, one-time clef suggestions (fa at 50, ut at 80, `settings.levelTips`). First-launch onboarding (0 / 30 / 60, Passer = 30), skipped for players with history (they stay at 100) and for launch links.
- Settings à la Tusmo: Jeu / Affichage (dark/light/system, colourblind blue/orange, reduced motion, key size) / Son / Données (JSON export/import) / À propos (Partager l'app).
- **Routes and SEO**: one URL path per screen (Cloudflare Web Analytics counts `pushState` navigations): `learn/ keys/ series/ dictation/ survival/ hero/ scores/ stats/ settings/ daily/`, plus landing-only `challenge/` (Séries challenge link) and `score/` (score link), listed in `scripts/routes.mjs` (shared by vite config, app and check-og). `app.ts` leaves home with `pushState` to the route URL, every later user-initiated screen change (intro → play, mode → settings) is a `pushState` too (`src/nav/historyPlan.ts`: entries carry `{screen:'inside', depth}`; back/boot/home only `replaceState`; Back lands on the previous screen, result « Accueil » buttons `history.go(-depth)`), boot on a route opens that screen (`pushed = false`; first-time player: onboarding first). Each route is an indexable static page generated at build from the built `index.html` (`scripts/pages.mjs`: own title/description/canonical/OG, pre-rendered h1 + intro, `<base href="../">` so `./assets`, manifest and `./sw.js` resolve from the subfolder under `/solfege-hero/` or `/`). Texts live in `scripts/page-texts.mjs` (`PAGE_TEXTS.fr` and `.en`). Every page exists three times: root `<route>/` (French), `fr/<route>/` and `en/<route>/` (own `<html lang>`, canonical, `<base href>` by depth), all with hreflang fr/en/x-default (→ root); the sitemap lists all with `xhtml:link` alternates. Legacy French paths (`apprendre armures dictee survie partitions reglages jour defi partition`) are generated noindex redirects keeping search and hash, so old shared links still work; old root hash links too. `404.html` is generated too (adds the missing trailing slash on a route, else redirects to the app root) and is the workbox `navigateFallback` (index.html at an unknown nested path would load `./assets` from the wrong folder). Meta/OG/JSON-LD of the home stay in `index.html`. One share helper `shareLink`/`copyLink` in `src/ui/sharing.ts` (url separate from text), URLs from `src/share/links.ts`.
- **i18n FR/EN** (`src/i18n/`): typed dictionary per namespace (`messages/{fr,en}/<ns>.ts`, en typed against fr, parity test), `t(key, params)` with ICU-lite plurals, Intl formatters (`fr-FR`, `en-GB`). Setting `language: 'auto'|'fr'|'en'` (Affichage, « Langue / Language »), auto = `navigator.languages` has an `fr*` entry → fr, else en. A `/fr/` or `/en/` path prefix forces the language for the session (navigation stays under it, toast « Garder » / "Keep" saves the setting); shared links never carry the prefix. Language change re-renders settings/home/onboarding and `document.title`. Note naming `auto` (default) follows the language (C D E in en); English key names always use letters ("C♯ minor"). Built-in melody names are ids, only displayed through `scoreTitle()` (`src/scores/title.ts`). Share texts in the sender's language (snapshots in `src/share/shareTexts.test.ts`, `src/hero/challenge.test.ts`). OMR worker receives the language in its request. Manifest stays French (`lang: 'fr'`).
- **OG images**: `public/og/*.png` (French) and `public/og/en/*.png` (English, used by `en/` pages) committed, rendered by `scripts/og-images.mjs` (`npm run og` to force, the build only renders missing ones); `npm run check:og [baseUrl]` validates tags and image sizes on `dist/` or a server.

## Layout

- `src/music/` note model, key signatures, melodies, MusicXML parse/export, unzip.
- `src/game/` adaptive sampler, scoring. `src/series/` series logic and codec. `src/hero/` clock, rhythm, meter, judgement, tempo, sources.
- `src/scores/` IndexedDB library. `src/storage.ts` settings + progress (localStorage, keys `.v2`).
- `src/ui/` screens and widgets; `staff.ts`/`heroStaff.ts`/`glyphs.ts` draw everything in SVG.
- `src/audio/` sound engine and instruments. `src/platform/` haptics.

## Backlog

**Custom domain + Cloudflare (waiting for the owner to buy a domain, decided 26 Oct 2026).** Code is ready (`scripts/site-url.mjs`, `VITE_SITE_URL`, `CNAME` emitted, Cloudflare beacon via `VITE_CF_BEACON`). When the domain exists: Cloudflare Registrar → DNS `CNAME @` and `www` → `parriauxmaxime.github.io` proxied, SSL mode Full, Always Use HTTPS; GitHub Settings → Pages custom domain + Enforce HTTPS; repository variables `SITE_URL=https://<domain>/` and `CF_BEACON_TOKEN` (Cloudflare Web Analytics, manual snippet); Google Search Console as a Domain property verified by DNS TXT, then submit `sitemap.xml`. Then redeploy and check HTTPS, OG previews (`npm run check:og`), share links on the new host.

OMR phase 2: optional ONNX model (oemer-style segmentation, onnxruntime-web, downloaded on demand) for heads/stems/symbols, keeping the heuristic path as fallback. Phase 1 gaps: triplets (bracket ignored, measure flagged), ties/slurs not merged, chords keep the top note only, PDF page change only before recognition, flats outside the key drawn as sharps (model stores MIDI only), perspective/curled photos untested, 360 px review shows 1-2 measures per line.

Remaining nits: hero portrait staff still smallish (2,75 beats ahead, lots of free vertical space); a hero challenge sent from a free game replays at the sender's final difficulty, so the melody differs from the sender's; strict octave physical keys always answer in the nearest window octave.

Agents never test on a real device: sound, vibration, install and PWA update are verified only by the owner on Android.
