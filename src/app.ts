import { createSound } from './audio/sound'
import type { Melody } from './hero/types'
import { createAppearance, motionReduced } from './platform/appearance'
import { setVibrationEnabled } from './platform/haptics'
import { parseChallenge, type Challenge } from './series/challenge'
import { newSeed, type SeriesConfig } from './series/series'
import { loadProgress, loadSettings, resetProgress, saveProgress, saveSettings, type Progress, type Settings } from './storage'
import { createChallengeIntro } from './ui/challengeIntro'
import { button, el } from './ui/dom'
import { createGame } from './ui/game'
import { createHero } from './ui/hero'
import { createHeroStart } from './ui/heroStart'
import { createHome, type HomeChoice } from './ui/home'
import { createSeries } from './ui/series'
import { createSettingsScreen } from './ui/settings'
import { createStatsScreen } from './ui/stats'

const TRANSITION_MS = 200

interface Destroyable {
  destroy: () => void
}

export function startApp(root: HTMLElement): void {
  let settings = loadSettings()
  let progress = loadProgress()
  let running: Destroyable | null = null
  let leaving: Element[] = []
  let leaveTimeout = 0
  const sound = createSound()
  const appearance = createAppearance()

  const backButton = button('icon-button', '←', showHome)
  backButton.setAttribute('aria-label', 'Accueil')
  const muteButton = button('icon-button', '', toggleMute)
  muteButton.setAttribute('aria-label', 'Son')
  const topBar = el('header', 'top-bar', backButton, el('span', 'spacer'), muteButton)
  const screen = el('main', 'screen-host')
  root.replaceChildren(el('div', 'app', topBar, screen))
  applySettings()

  window.addEventListener('hashchange', openLaunchChallenge)
  if (!openLaunchChallenge()) showHome()

  function openLaunchChallenge(): boolean {
    const received = parseChallenge(location.hash)
    if (!received) return false
    history.replaceState(null, '', location.pathname + location.search)
    showChallengeIntro(received)
    return true
  }

  function applySettings(): void {
    appearance.apply(settings)
    setVibrationEnabled(settings.vibration)
    sound.setMuted(settings.muted)
    sound.setVolume(settings.volume)
    muteButton.textContent = settings.muted ? '🔇' : '🔊'
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
    topBar.hidden = !withTopBar
    swapScreen(content)
  }

  function freshSeriesConfig(): SeriesConfig {
    return { seed: newSeed(), clefs: settings.clefs, armures: settings.accidentals }
  }

  function showHome(): void {
    show(createHome({ onChoose: choose, onSettings: showSettings, onStats: showStats }), false)
  }

  function choose(choice: HomeChoice): void {
    if (choice === 'apprendre') showLearn()
    else if (choice === 'series') showSeries(freshSeriesConfig(), null)
    else showHeroStart()
  }

  function showLearn(): void {
    const game = createGame({ settings, progress, sound, onProgress: changeProgress })
    show(game.element, true, game)
  }

  function showHeroStart(): void {
    show(createHeroStart({ settings, onChange: changeSettings, onPlay: playHero }), true)
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
    })
    show(hero.element, false, hero)
  }

  function showSeries(config: SeriesConfig, against: Challenge | null): void {
    const series = createSeries({
      settings,
      config,
      challenge: against,
      progress,
      sound,
      onProgress: changeProgress,
      onReplay: () => showSeries(freshSeriesConfig(), null),
      onHome: showHome,
    })
    show(series.element, true, series)
  }

  function showChallengeIntro(challenge: Challenge): void {
    show(createChallengeIntro({ challenge, onStart: () => showSeries(challenge.config, challenge) }), true)
  }

  function showSettings(): void {
    const screenElement = createSettingsScreen({
      settings,
      getProgress: () => progress,
      onChange: changeSettings,
      onReset: () => changeProgress(resetProgress()),
      onImport(data) {
        changeSettings(data.settings)
        changeProgress(data.progress)
      },
      onBack: showHome,
    })
    show(screenElement, false)
  }

  function showStats(): void {
    const onReset = () => {
      changeProgress(resetProgress())
      return progress
    }
    show(createStatsScreen({ progress, onReset, onBack: showHome }), false)
  }
}
