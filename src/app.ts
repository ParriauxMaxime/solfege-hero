import { createSound } from './audio/sound'
import type { Melody, Score } from './hero/types'
import { createAppearance, motionReduced } from './platform/appearance'
import { setVibrationEnabled } from './platform/haptics'
import { parseChallenge, type Challenge } from './series/challenge'
import {
  generateSeries,
  newSeed,
  scoreSeries,
  type RandomSeriesConfig,
  type SeriesConfig,
  type SeriesItem,
} from './series/series'
import { loadProgress, loadSettings, resetProgress, saveProgress, saveSettings, type Progress, type Settings } from './storage'
import { BUILTIN_SCORES, createScoreLibrary, indexedDbBackend, type NewScore } from './storage/scores'
import { decodeScoreBlob, parseScoreHash } from './scores/link'
import { createChallengeIntro } from './ui/challengeIntro'
import { createScoreChallengeIntro, createScoreReceived } from './ui/scoreReceived'
import { confirmOverlay } from './ui/confirm'
import { el, iconButton, setIcon } from './ui/dom'
import { createGame } from './ui/game'
import { createHero, type Hero } from './ui/hero'
import { createHeroStart } from './ui/heroStart'
import { createHome, type HomeChoice } from './ui/home'
import { createLibrary } from './ui/library'
import { createSurvival, type Survival, type SurvivalTarget } from './ui/survival'
import { createSurvivalIntro } from './ui/survivalIntro'
import { parseSurvivalChallenge, type SurvivalChallenge, type SurvivalConfig } from './survival/challenge'
import { createSeries,type ChallengeTarget, type DailyRun, type Series } from './ui/series'
import { createDailyIntro } from './ui/dailyIntro'
import { dailyConfig, dailyKey, dailyLabel, parseDailyHash, type DailyKey } from './series/daily'
import { isInstrumentPickerOpen } from './ui/instrumentPicker'
import { createSettingsScreen } from './ui/settings'
import { createStatsScreen } from './ui/stats'
import { showToast } from './ui/toast'

const TRANSITION_MS = 200
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const
const SOUND_BLOCKED_TOAST_GAP_MS = 4000

interface Destroyable {
  destroy: () => void
}

export function startApp(root: HTMLElement): void {
  let settings = loadSettings()
  let progress = loadProgress()
  let running: Destroyable | null = null
  let pushed = false
  let activeHero: Hero | null = null
  let activeSeries: Series | null = null
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

  window.addEventListener('hashchange', openLaunchChallenge)
  window.addEventListener('popstate', onPopState)
  if (!openLaunchChallenge()) renderHome()

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

  function onPopState(): void {
    if (isInstrumentPickerOpen()) return
    if (isLaunchLink(location.hash)) return
    pushed = false
    if (activeSurvival?.pause()) {
      history.pushState({ screen: 'inside' }, '')
      pushed = true
      return
    }
    if (activeHero) {
      activeHero.pause()
      history.pushState({ screen: 'inside' }, '')
      pushed = true
      return
    }
    renderHome()
  }

  function isLaunchLink(hash: string): boolean {
    return Boolean(parseChallenge(hash) || parseScoreHash(hash) || parseDailyHash(hash) || parseSurvivalChallenge(hash))
  }

  function openLaunchChallenge(): boolean {
    const challenge = parseChallenge(location.hash)
    const scoreLink = challenge ? null : parseScoreHash(location.hash)
    const dailyLink = challenge || scoreLink ? null : parseDailyHash(location.hash)
    const survivalLink = challenge || scoreLink || dailyLink ? null : parseSurvivalChallenge(location.hash)
    if (!challenge && !scoreLink && !dailyLink && !survivalLink) return false
    history.replaceState(null, '', location.pathname + location.search)
    const open = () =>
      enterFromHome(() => {
        if (challenge) showChallengeIntro(challenge)
        else if (scoreLink) void openScoreLink(scoreLink)
        else if (dailyLink) showDailyIntro(dailyLink)
        else if (survivalLink) showSurvivalIntro(survivalLink)
      })
    if (!running) {
      open()
      return true
    }
    activeHero?.pause()
    const releaseClock = (activeSeries ?? activeSurvival)?.hold()
    void confirmOverlay(root, 'Abandonner la partie en cours ?', 'Abandonner', 'Continuer').then((abandon) => {
      if (abandon) open()
      else releaseClock?.()
    })
    return true
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
    activeSurvival = null
    topBar.hidden = !withTopBar
    swapScreen(content)
  }

  function freshSeriesConfig(): RandomSeriesConfig {
    return { kind: 'random', version: 2, seed: newSeed(), clefs: settings.clefs, armures: settings.accidentals }
  }

  function freshSurvivalConfig(): SurvivalConfig {
    return { seed: newSeed(), clefs: settings.clefs, armures: settings.accidentals, delayS: settings.survivalDelayS }
  }

  function renderHome(): void {
    const today = dailyKey(new Date())
    const home = createHome({
      daily: { label: dailyLabel(today), attemptMs: progress.daily.attempts[today]?.totalMs ?? null },
      onChoose: (choice) => enterFromHome(() => choose(choice)),
      onSettings: () => enterFromHome(showSettings),
      onStats: () => enterFromHome(showStats),
    })
    show(home, false)
  }

  function choose(choice: HomeChoice): void {
    if (choice === 'apprendre') showLearn()
    else if (choice === 'series') void showSeries(freshSeriesConfig(), null)
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

  function showLearn(): void {
    const game = createGame({ settings, progress, sound, onProgress: changeProgress })
    show(game.element, true, game)
  }

  function showHeroStart(): void {
    show(createHeroStart({ settings, library: scoreLibrary, onChange: changeSettings, onPlay: (melody) => playHero(melody) }), true)
  }

  function playHero(melody: Melody | null, fromLibrary = false): void {
    const hero = createHero({
      settings,
      progress,
      sound,
      melody,
      isMuted: () => settings.muted,
      onToggleMute: toggleMute,
      onProgress: changeProgress,
      onQuit: fromLibrary ? showLibrary : showHeroStart,
      onReplay: () => playHero(melody, fromLibrary),
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
      onProgress: changeProgress,
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

  function showSurvival(config: SurvivalConfig, against: SurvivalTarget | null): void {
    const survival = createSurvival({
      settings,
      config,
      challenge: against,
      progress,
      sound,
      onProgress: changeProgress,
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
