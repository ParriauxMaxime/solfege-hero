import { createSound } from './audio/sound'
import { clefTipAfterLevelChange, survivalDelayAfterLevelChange, type ClefTip } from './level/transition'
import { CLEFS, type Clef } from './music/notes'
import { createOnboarding } from './ui/onboarding'
import { CHALLENGE_BARS, parseHeroChallenge, type HeroChallenge, type HeroChallengeConfig } from './hero/challenge'
import { INITIAL_DIFFICULTY } from './hero/difficulty'
import { createHeroChallengeIntro } from './ui/heroChallengeIntro'
import type { Melody, Score } from './hero/types'
import { createAppearance, motionReduced } from './platform/appearance'
import { setVibrationEnabled } from './platform/haptics'
import { parseChallenge, type Challenge } from './series/challenge'
import { parseDictationChallenge, type DictationChallenge } from './dictation/challenge'
import { dictationClef, generateDictation, type DictationConfig } from './dictation/sequence'
import {
  generateSeries,
  newSeed,
  scoreSeries,
  type RandomSeriesConfig,
  type SeriesConfig,
  type SeriesItem,
} from './series/series'
import {
  loadProgress,
  loadSettings,
  recordPlayDay,
  resetProgress,
  saveProgress,
  saveSettings,
  type PlayMode,
  type Progress,
  type Settings,
} from './storage'
import { BUILTIN_SCORES, createScoreLibrary, indexedDbBackend, type NewScore } from './storage/scores'
import { decodeScoreBlob, parseScoreHash } from './scores/link'
import { createChallengeIntro } from './ui/challengeIntro'
import { createScoreChallengeIntro, createScoreReceived } from './ui/scoreReceived'
import { confirmOverlay } from './ui/confirm'
import { el, iconButton, setIcon } from './ui/dom'
import { createGame, type Game } from './ui/game'
import { createHero, type Hero, type HeroOptions } from './ui/hero'
import { createHeroStart } from './ui/heroStart'
import { createHome, type HomeChoice } from './ui/home'
import { createKeysGame } from './ui/keysGame'
import { createKeysStart } from './ui/keysStart'
import { createLearnStart } from './ui/learnStart'
import { createLibrary } from './ui/library'
import { createSurvival, type Survival, type SurvivalTarget } from './ui/survival'
import { createSurvivalIntro } from './ui/survivalIntro'
import { parseSurvivalChallenge, type SurvivalChallenge, type SurvivalConfig } from './survival/challenge'
import { createSeries,type ChallengeTarget, type DailyRun, type Series } from './ui/series'
import { createDictation, type Dictation } from './ui/dictation'
import { createDictationChallengeIntro, createDictationStart } from './ui/dictationStart'
import { createDailyIntro } from './ui/dailyIntro'
import { dailyConfig, dailyKey, parseDailyHash, type DailyKey } from './series/daily'
import { isInstrumentPickerOpen } from './ui/instrumentPicker'
import { isOmrImportOpen } from './ui/omr/openState'
import { createSettingsScreen } from './ui/settings'
import { createStatsScreen } from './ui/stats'
import { dayKeyOf } from './stats/dates'
import { showToast } from './ui/toast'

const TRANSITION_MS = 200
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const
const SOUND_BLOCKED_TOAST_GAP_MS = 4000

const CLEF_TIP_DELAY_MS = 2000
const CLEF_TIP_TEXT: Record<ClefTip, { message: string; clef: Clef }> = {
  bass: { message: 'Prêt pour la clé de fa ?', clef: 'bass' },
  alto: { message: 'Et la clé d’ut ?', clef: 'alto' },
}

type HeroRun = NonNullable<HeroOptions['challenge']>

interface Destroyable {
  destroy: () => void
}

export function startApp(root: HTMLElement): void {
  let settings = loadSettings()
  let progress = loadProgress()
  let running: Destroyable | null = null
  let pushed = false
  let collapsingLinkEntry = false
  let activeGame: Game | null = null
  let activeHero: Hero | null = null
  let activeSeries: Series | null = null
  let activeDictation: Dictation | null = null
  let activeSurvival: Survival | null = null
  let leaving: Element[] = []
  let leaveTimeout = 0
  let lastBlockedToast = -Infinity
  const sound = createSound({ onBlocked: warnSoundBlocked })
  const appearance = createAppearance()
  const scoreLibrary = createScoreLibrary(indexedDbBackend(), BUILTIN_SCORES)
  unlockSoundOnGesture()

  const backButton = iconButton('back', goHome, 'Accueil')
  const muteButton = iconButton('sound-on', toggleMute, 'Son')
  const topBar = el('header', 'top-bar', backButton, el('span', 'spacer'), muteButton)
  const screen = el('main', 'screen-host')
  root.replaceChildren(el('div', 'app', topBar, screen))
  applySettings()

  window.addEventListener('hashchange', () => openLaunchChallenge(true))
  window.addEventListener('popstate', onPopState)
  markExistingPlayerOnboarded()
  if (!openLaunchChallenge(false)) {
    if (settings.onboarded || new URLSearchParams(location.search).has('demo')) renderHome()
    else showOnboarding()
  }
  void openDemoStats()

  function markExistingPlayerOnboarded(): void {
    const hasPlayed = progress.totalAnswered > 0 || Object.values(progress.playDays).some((days) => days.length > 0)
    if (!settings.onboarded && hasPlayed) changeSettings({ onboarded: true })
  }

  async function openDemoStats(): Promise<void> {
    const query = new URLSearchParams(location.search)
    if (!(import.meta.env.DEV || query.has('demo'))) return
    if (query.has('seed-stats')) {
      const { seedProgress } = await import('./stats/seed')
      progress = seedProgress(progress, dayKeyOf(new Date()))
    }
    if (query.has('stats')) showStats()
  }

  function enterFromHome(open: () => void): void {
    if (!pushed) {
      history.pushState({ screen: 'inside' }, '')
      pushed = true
    }
    open()
  }

  function goHome(): void {
    if (pushed) history.back()
    else renderHome()
  }

  function dropLinkEntry(): Promise<void> {
    if (!pushed) {
      history.replaceState({ screen: 'inside' }, '', location.pathname + location.search)
      pushed = true
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      collapsingLinkEntry = true
      window.addEventListener(
        'popstate',
        () => {
          collapsingLinkEntry = false
          resolve()
        },
        { once: true },
      )
      history.back()
    })
  }

  function onPopState(): void {
    if (collapsingLinkEntry) return
    if (isInstrumentPickerOpen() || isOmrImportOpen()) return
    if (isLaunchLink(location.hash)) return
    pushed = false
    if (activeSurvival?.pause()) {
      history.pushState({ screen: 'inside' }, '')
      pushed = true
      return
    }
    if (activeHero && !activeHero.isOver()) {
      activeHero.pause()
      history.pushState({ screen: 'inside' }, '')
      pushed = true
      return
    }
    renderHome()
  }

  function isLaunchLink(hash: string): boolean {
    return Boolean(
      parseHeroChallenge(hash) ||
        parseChallenge(hash) ||
        parseScoreHash(hash) ||
        parseDailyHash(hash) ||
        parseSurvivalChallenge(hash) ||
        parseDictationChallenge(hash),
    )
  }

  function openLaunchChallenge(fromHashChange: boolean): boolean {
    const heroLink = parseHeroChallenge(location.hash)
    const challenge = heroLink ? null : parseChallenge(location.hash)
    const scoreLink = heroLink || challenge ? null : parseScoreHash(location.hash)
    const dailyLink = heroLink || challenge || scoreLink ? null : parseDailyHash(location.hash)
    const survivalLink = heroLink || challenge || scoreLink || dailyLink ? null : parseSurvivalChallenge(location.hash)
    const dictationLink =
      heroLink || challenge || scoreLink || dailyLink || survivalLink ? null : parseDictationChallenge(location.hash)
    if (!heroLink && !challenge && !scoreLink && !dailyLink && !survivalLink && !dictationLink) return false
    const open = () =>
      enterFromHome(() => {
        if (heroLink) showHeroChallengeIntro(heroLink)
        else if (challenge) showChallengeIntro(challenge)
        else if (scoreLink) void openScoreLink(scoreLink)
        else if (dailyLink) showDailyIntro(dailyLink)
        else if (survivalLink) showSurvivalIntro(survivalLink)
        else if (dictationLink) showDictationChallengeIntro(dictationLink)
      })
    const ready = fromHashChange ? dropLinkEntry() : Promise.resolve(clearLaunchHash())
    void ready.then(() => confirmAbandonOrOpen(open))
    return true
  }

  function clearLaunchHash(): void {
    history.replaceState(null, '', location.pathname + location.search)
  }

  function confirmAbandonOrOpen(open: () => void): void {
    if (!running) {
      open()
      return
    }
    activeHero?.pause()
    const releaseClock = (activeSeries ?? activeDictation ?? activeSurvival ?? activeGame)?.hold()
    void confirmOverlay(root, 'Abandonner la partie en cours ?', 'Abandonner', 'Continuer').then((abandon) => {
      if (abandon) open()
      else releaseClock?.()
    })
  }

  function unlockSoundOnGesture(): void {
    const unlock = () => {
      sound.unlock()
      if (!sound.isRunning()) return
      for (const type of UNLOCK_EVENTS) document.removeEventListener(type, unlock)
    }
    for (const type of UNLOCK_EVENTS) document.addEventListener(type, unlock)
  }

  function warnSoundBlocked(): void {
    const now = performance.now()
    if (now - lastBlockedToast < SOUND_BLOCKED_TOAST_GAP_MS) return
    lastBlockedToast = now
    showToast('Son bloqué, touche l’écran')
  }

  function applySettings(): void {
    appearance.apply(settings)
    setVibrationEnabled(settings.vibration)
    sound.setMuted(settings.muted)
    sound.setVolume(settings.volume)
    sound.setInstrument(settings.instrument)
    setIcon(muteButton, settings.muted ? 'sound-off' : 'sound-on')
  }

  function toggleMute(): void {
    changeSettings({ muted: !settings.muted })
  }

  function changeSettings(patch: Partial<Settings>): void {
    settings = { ...settings, ...patch }
    saveSettings(settings)
    applySettings()
  }

  function changeProgress(next: Progress): void {
    progress = next
    saveProgress(progress)
  }

  function progressFor(mode: PlayMode): (next: Progress) => void {
    return (next) => changeProgress(recordPlayDay(next, mode, dailyKey(new Date())))
  }

  function swapScreen(content: HTMLElement): void {
    window.clearTimeout(leaveTimeout)
    for (const old of leaving) old.remove()
    leaving = Array.from(screen.children)
    if (leaving.length === 0 || motionReduced()) {
      for (const old of leaving) old.remove()
      leaving = []
      screen.append(content)
      return
    }
    for (const old of leaving) old.classList.add('screen-leave')
    content.classList.add('screen-enter')
    screen.append(content)
    leaveTimeout = window.setTimeout(() => {
      for (const old of leaving) old.remove()
      leaving = []
      content.classList.remove('screen-enter')
    }, TRANSITION_MS)
  }

  function show(content: HTMLElement, withTopBar: boolean, next: Destroyable | null = null): void {
    running?.destroy()
    running = next
    activeHero = null
    activeSeries = null
    activeDictation = null
    activeSurvival = null
    activeGame = null
    topBar.hidden = !withTopBar
    swapScreen(content)
  }

  function freshSeriesConfig(): RandomSeriesConfig {
    return {
      kind: 'random',
      version: 4,
      seed: newSeed(),
      clefs: settings.clefs,
      armures: settings.accidentals,
      difficulty: settings.seriesDifficulty,
      level: settings.level,
    }
  }

  function freshDictationConfig(): DictationConfig {
    const seed = newSeed()
    return { seed, clef: dictationClef(seed, settings.clefs), level: settings.level, armures: settings.accidentals }
  }

  function freshSurvivalConfig(): SurvivalConfig {
    return {
      seed: newSeed(),
      clefs: settings.clefs,
      armures: settings.accidentals,
      delayS: settings.survivalDelayS,
      level: settings.level,
    }
  }

  /** Saves the level with the survival delay that goes with it; returns the settings changed. */
  function applyLevel(level: number): Partial<Settings> {
    const patch: Partial<Settings> = {
      level,
      survivalDelayS: survivalDelayAfterLevelChange(settings.level, level, settings.survivalDelayS),
    }
    changeSettings(patch)
    return patch
  }

  function changeLevel(level: number): Partial<Settings> {
    const from = settings.level
    const patch = applyLevel(level)
    offerClefTip(from, level)
    return patch
  }

  function onAutoLevelChange(from: number, to: number): void {
    applyLevel(to)
    if (to > from) showToast(`Niveau ${from} → ${to}`, { className: 'toast-level' })
    window.setTimeout(() => offerClefTip(from, to), to > from ? CLEF_TIP_DELAY_MS : 0)
  }

  function offerClefTip(from: number, to: number): void {
    const tip = clefTipAfterLevelChange(from, to, settings.clefs, settings.levelTips)
    if (!tip) return
    changeSettings({ levelTips: [...settings.levelTips, tip] })
    const text = CLEF_TIP_TEXT[tip]
    showToast(text.message, {
      action: { label: 'Ajouter', onClick: () => changeSettings({ clefs: CLEFS.filter((clef) => clef === text.clef || settings.clefs.includes(clef)) }) },
    })
  }

  function chooseStartingLevel(level: number): void {
    applyLevel(level)
    changeSettings({ onboarded: true })
    renderHome()
  }

  function showOnboarding(): void {
    show(createOnboarding({ onChoose: chooseStartingLevel }), false)
  }

  function renderHome(): void {
    const today = dailyKey(new Date())
    const home = createHome({
      progress,
      today,
      scores: scoreLibrary.list(),
      onChoose: (choice) => enterFromHome(() => choose(choice)),
      onSettings: () => enterFromHome(showSettings),
      onStats: () => enterFromHome(showStats),
    })
    show(home, false)
  }

  function choose(choice: HomeChoice): void {
    if (choice === 'apprendre') showLearnStart()
    else if (choice === 'series') void showSeries(freshSeriesConfig(), null)
    else if (choice === 'dictation') showDictationStart()
    else if (choice === 'keys') showKeysStart()
    else if (choice === 'survival') showSurvival(freshSurvivalConfig(), null)
    else if (choice === 'partitions') showLibrary()
    else if (choice === 'daily') {
      const today = dailyKey(new Date())
      playDaily(today, true)
    }
    else showHeroStart()
  }

  function showLibrary(): void {
    show(
      createLibrary({
        library: scoreLibrary,
        sound,
        onPlayHero: playScore,
        onPlaySeries: (score) => void showSeries({ kind: 'score', scoreId: score.id }, null, true),
      }),
      true,
    )
  }

  function playScore(score: Score, fromLibrary = true): void {
    changeSettings({ heroMelody: score.name, heroTempo: score.tempo })
    playHero(score, fromLibrary)
  }

  function showLearnStart(): void {
    show(createLearnStart({ settings, onChange: changeSettings, onPlay: showLearn, onOpenSettings: () => showSettings() }), true)
  }

  function showLearn(): void {
    const game = createGame({
      settings,
      progress,
      sound,
      onProgress: progressFor('learn'),
      onLevelChange: onAutoLevelChange,
      onEditKey: (chronoRunning) => (chronoRunning ? confirmAbandonOrOpen(showLearnStart) : showLearnStart()),
    })
    show(game.element, true, game)
    activeGame = game
  }

  function showKeysStart(): void {
    show(createKeysStart({ settings, onChange: changeSettings, onPlay: showKeys, onOpenSettings: () => showSettings() }), true)
  }

  function showKeys(): void {
    const game = createKeysGame({
      settings,
      progress,
      sound,
      onProgress: progressFor('keys'),
      onLevelChange: onAutoLevelChange,
    })
    show(game.element, true, game)
    activeGame = game
  }

  function showHeroStart(): void {
    show(
      createHeroStart({
        settings,
        library: scoreLibrary,
        onChange: changeSettings,
        onPlay: (melody) => playHero(melody),
        onPlayChallenge: () => playHero(null, false, { config: freshHeroChallengeConfig(), against: null }),
      }),
      true,
    )
  }

  function freshHeroChallengeConfig(): HeroChallengeConfig {
    return {
      seed: newSeed(),
      clefs: settings.clefs,
      armures: settings.accidentals,
      bpm: settings.heroTempo,
      difficulty: INITIAL_DIFFICULTY.level,
      bars: CHALLENGE_BARS,
      level: settings.level,
    }
  }

  function showHeroChallengeIntro(challenge: HeroChallenge): void {
    show(
      createHeroChallengeIntro({
        challenge,
        onStart: () => playHero(null, false, { config: challenge.config, against: challenge.target }),
      }),
      true,
    )
  }

  function playHero(melody: Melody | null, fromLibrary = false, challenge: HeroRun | null = null): void {
    const hero = createHero({
      settings,
      progress,
      sound,
      melody,
      challenge,
      isMuted: () => settings.muted,
      onToggleMute: toggleMute,
      onProgress: progressFor('hero'),
      onQuit: fromLibrary ? showLibrary : showHeroStart,
      onReplay: () => playHero(melody, fromLibrary),
      onRetry: () => playHero(melody, fromLibrary, challenge),
      onHome: fromLibrary ? showLibrary : goHome,
      homeLabel: fromLibrary ? 'Partitions' : 'Accueil',
    })
    show(hero.element, false, hero)
    activeHero = hero
  }

  function playDaily(key: DailyKey, ranked: boolean): void {
    void showSeries(dailyConfig(key), null, false, { key, ranked })
  }

  function showDailyIntro(key: DailyKey): void {
    const ranked = key === dailyKey(new Date())
    const attemptMs = progress.daily.attempts[key]?.totalMs ?? null
    show(createDailyIntro({ key, ranked, attemptMs, onStart: () => playDaily(key, ranked) }), true)
  }

  async function showSeries(
    config: SeriesConfig,
    against: ChallengeTarget | null,
    fromLibrary = false,
    daily: DailyRun | null = null,
  ): Promise<void> {
    let items: SeriesItem[]
    let score: Score | null = null
    if (config.kind === 'score') {
      score = (await scoreLibrary.get(config.scoreId)) ?? null
      if (!score) {
        showToast('Partition introuvable')
        return
      }
      items = scoreSeries(score)
    } else {
      items = generateSeries(config)
    }
    const series = createSeries({
      settings,
      config,
      items,
      score,
      daily,
      challenge: against,
      progress,
      sound,
      onProgress: progressFor('series'),
      onReplay: () =>
        daily
          ? playDaily(daily.key, daily.ranked)
          : void showSeries(config.kind === 'score' ? config : freshSeriesConfig(), null, fromLibrary),
      onRetry: () => void showSeries(config, against, fromLibrary),
      onHome: fromLibrary ? showLibrary : goHome,
      homeLabel: fromLibrary ? 'Partitions' : 'Accueil',
    })
    show(series.element, true, series)
    activeSeries = series
  }

  function showDictationStart(): void {
    show(
      createDictationStart({
        settings,
        onChange: changeSettings,
        onPlay: () => showDictation(freshDictationConfig(), null),
        onOpenSettings: () => showSettings(),
      }),
      true,
    )
  }

  function showDictationChallengeIntro(challenge: DictationChallenge): void {
    show(
      createDictationChallengeIntro({
        challenge,
        settings,
        onChange: changeSettings,
        onStart: () => showDictation(challenge.config, challenge),
      }),
      true,
    )
  }

  function showDictation(config: DictationConfig, against: ChallengeTarget | null): void {
    if (settings.muted) {
      changeSettings({ muted: false })
      showToast('Son réactivé pour la dictée')
    }
    const dictation = createDictation({
      settings,
      config,
      items: generateDictation(config),
      challenge: against,
      progress,
      sound,
      onProgress: progressFor('dictation'),
      onReplay: () => showDictation(freshDictationConfig(), null),
      onRetry: () => showDictation(config, against),
      onHome: goHome,
    })
    show(dictation.element, true, dictation)
    activeDictation = dictation
  }

  function showSurvival(config: SurvivalConfig, against: SurvivalTarget | null): void {
    const survival = createSurvival({
      settings,
      config,
      challenge: against,
      progress,
      sound,
      onProgress: progressFor('survival'),
      onReplay: () => showSurvival(freshSurvivalConfig(), null),
      onRetry: () => showSurvival(config, against),
      onHome: goHome,
      onQuit: renderHome,
    })
    show(survival.element, false, survival)
    activeSurvival = survival
  }

  function showSurvivalIntro(challenge: SurvivalChallenge): void {
    show(
      createSurvivalIntro({ challenge, onStart: () => showSurvival(challenge.config, { score: challenge.score }) }),
      true,
    )
  }

  function showChallengeIntro(challenge: Challenge): void {
    show(createChallengeIntro({ challenge, onStart: () => void showSeries(challenge.config, challenge) }), true)
  }

  /** Adds a score to the library unless it is already there; returns whether it was new. */
  async function addScoreIfNew(score: NewScore): Promise<{ stored: Score; added: boolean }> {
    const existing = (await scoreLibrary.list()).find((candidate) => candidate.id === score.id)
    if (existing) return { stored: existing, added: false }
    return { stored: await scoreLibrary.add(score, 'link'), added: true }
  }

  async function openScoreLink(link: { blob: string; timeS: number | null }): Promise<void> {
    const score = await decodeScoreBlob(link.blob)
    if (!score) {
      showToast('Lien de partition invalide')
      renderHome()
      return
    }
    const { timeS } = link
    if (timeS === null) {
      const play = async () => playScore((await addScoreIfNew(score)).stored, false)
      const add = async () => showToast((await addScoreIfNew(score)).added ? 'Ajoutée à ta bibliothèque' : 'Déjà dans ta bibliothèque')
      show(createScoreReceived({ score, onAdd: () => void add(), onPlay: () => void play() }), true)
      return
    }
    const start = async () => {
      await addScoreIfNew(score)
      await showSeries({ kind: 'score', scoreId: score.id }, { timeS })
    }
    show(createScoreChallengeIntro({ score, timeS, onStart: () => void start() }), true)
  }

  function showSettings(): void {
    const screenElement = createSettingsScreen({
      settings,
      sound,
      getProgress: () => progress,
      onChange: changeSettings,
      onLevelChange: changeLevel,
      onReset: () => changeProgress(resetProgress()),
      onImport(data) {
        changeSettings(data.settings)
        changeProgress(data.progress)
      },
      onBack: goHome,
    })
    show(screenElement, false)
  }

  function showStats(): void {
    const onReset = () => {
      changeProgress(resetProgress())
      return progress
    }
    show(createStatsScreen({ progress, onReset, onBack: goHome }), false)
  }
}
