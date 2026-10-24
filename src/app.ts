import { createSound } from './audio/sound'
import type { Melody } from './hero/types'
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

interface Destroyable {
  destroy: () => void
}

export function startApp(root: HTMLElement): void {
  let settings = loadSettings()
  let progress = loadProgress()
  let running: Destroyable | null = null
  const sound = createSound()
  sound.setMuted(settings.muted)

  const backButton = button('icon-button', '←', showHome)
  backButton.setAttribute('aria-label', 'Accueil')
  const muteButton = button('icon-button', '', toggleMute)
  muteButton.setAttribute('aria-label', 'Son')
  const topBar = el('header', 'top-bar', backButton, el('span', 'spacer'), muteButton)
  const screen = el('main', 'screen-host')
  root.replaceChildren(el('div', 'app', topBar, screen))
  renderMute()

  const received = parseChallenge(location.hash)
  if (received) {
    history.replaceState(null, '', location.pathname + location.search)
    showChallengeIntro(received)
  } else {
    showHome()
  }

  function renderMute(): void {
    muteButton.textContent = settings.muted ? '🔇' : '🔊'
  }

  function toggleMute(): void {
    settings = { ...settings, muted: !settings.muted }
    saveSettings(settings)
    sound.setMuted(settings.muted)
    renderMute()
  }

  function changeSettings(patch: Partial<Settings>): void {
    settings = { ...settings, ...patch }
    saveSettings(settings)
  }

  function changeProgress(next: Progress): void {
    progress = next
    saveProgress(progress)
  }

  function show(content: HTMLElement, withTopBar: boolean, next: Destroyable | null = null): void {
    running?.destroy()
    running = next
    topBar.hidden = !withTopBar
    screen.replaceChildren(content)
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
    const hero = createHero({ settings, progress, sound, melody, onProgress: changeProgress, onQuit: showHeroStart })
    show(hero.element, false, hero)
  }

  function showSeries(config: SeriesConfig, against: Challenge | null): void {
    const series = createSeries({
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
    show(createSettingsScreen({ settings, onChange: changeSettings, onBack: showHome }), false)
  }

  function showStats(): void {
    const onReset = () => {
      changeProgress(resetProgress())
      return progress
    }
    show(createStatsScreen({ progress, onReset, onBack: showHome }), false)
  }
}
