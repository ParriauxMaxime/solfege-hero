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
import { BUILTIN_SCORES, createScoreLibrary, indexedDbBackend } from './storage/scores'
import { createChallengeIntro } from './ui/challengeIntro'
import { confirmOverlay } from './ui/confirm'
import { el, iconButton, setIcon } from './ui/dom'
import { createGame } from './ui/game'
import { createHero, type Hero } from './ui/hero'
import { createHeroStart } from './ui/heroStart'
import { createHome, type HomeChoice } from './ui/home'
import { createLibrary } from './ui/library'
import { createSeries, type Series } from './ui/series'
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
    if (parseChallenge(location.hash)) return
    pushed = false
    if (activeHero) {
      activeHero.pause()
      history.pushState({ screen: 'inside' }, '')
      pushed = true
      return
    }
    renderHome()
  }

  function openLaunchChallenge(): boolean {
    const received = parseChallenge(location.hash)
    if (!received) return false
    history.replaceState(null, '', location.pathname + location.search)
    if (!running) {
      showChallengeIntro(received)
      return true
    }
    activeHero?.pause()
    const releaseClock = activeSeries?.hold()
    void confirmOverlay(root, 'Abandonner la partie en cours ?', 'Abandonner', 'Continuer').then((abandon) => {
      if (abandon) showChallengeIntro(received)
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
    topBar.hidden = !withTopBar
    swapScreen(content)
  }

  function freshSeriesConfig(): RandomSeriesConfig {
    return { kind: 'random', seed: newSeed(), clefs: settings.clefs, armures: settings.accidentals }
  }

  function renderHome(): void {
    const home = createHome({
      onChoose: (choice) => enterFromHome(() => choose(choice)),
      onSettings: () => enterFromHome(showSettings),
      onStats: () => enterFromHome(showStats),
    })
    show(home, false)
  }

  function choose(choice: HomeChoice): void {
    if (choice === 'apprendre') showLearn()
    else if (choice === 'series') void showSeries(freshSeriesConfig(), null)
    else if (choice === 'partitions') showLibrary()
    else showHeroStart()
  }

  function showLibrary(): void {
    show(
      createLibrary({
        library: scoreLibrary,
        onPlayHero: playScore,
        onPlaySeries: (score) => void showSeries({ kind: 'score', scoreId: score.id }, null),
      }),
      true,
    )
  }

  function playScore(score: Score): void {
    changeSettings({ heroMelody: score.name, heroTempo: score.tempo })
    playHero(score)
  }

  function showLearn(): void {
    const game = createGame({ settings, progress, sound, onProgress: changeProgress })
    show(game.element, true, game)
  }

  function showHeroStart(): void {
    show(createHeroStart({ settings, library: scoreLibrary, onChange: changeSettings, onPlay: playHero }), true)
  }

  function playHero(melody: Melody | null): void {
    const hero = createHero({
      settings,
      progress,
      sound,
      melody,
      isMuted: () => settings.muted,
      onToggleMute: toggleMute,
      onProgress: changeProgress,
      onQuit: showHeroStart,
      onReplay: () => playHero(melody),
      onHome: goHome,
    })
    show(hero.element, false, hero)
    activeHero = hero
  }

  async function showSeries(config: SeriesConfig, against: Challenge | null): Promise<void> {
    let items: SeriesItem[]
    let title: string | null = null
    if (config.kind === 'score') {
      const score = await scoreLibrary.get(config.scoreId)
      if (!score) {
        showToast('Partition introuvable')
        return
      }
      items = scoreSeries(score)
      title = score.name
    } else {
      items = generateSeries(config)
    }
    const series = createSeries({
      settings,
      config,
      items,
      title,
      challenge: against,
      progress,
      sound,
      onProgress: changeProgress,
      onReplay: () => void showSeries(config.kind === 'score' ? config : freshSeriesConfig(), null),
      onRetry: () => void showSeries(config, against),
      onHome: goHome,
    })
    show(series.element, true, series)
    activeSeries = series
  }

  function showChallengeIntro(challenge: Challenge): void {
    show(createChallengeIntro({ challenge, onStart: () => void showSeries(challenge.config, challenge) }), true)
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
