import { createSound } from './audio/sound'
import { loadProgress, loadSettings, resetProgress, saveProgress, saveSettings, type Progress, type Settings } from './storage'
import { button, el } from './ui/dom'
import { createGame, type Game } from './ui/game'
import { createSettingsScreen } from './ui/settings'
import { createStatsScreen } from './ui/stats'

export function startApp(root: HTMLElement): void {
  let settings = loadSettings()
  let progress = loadProgress()
  let game: Game | null = null
  const sound = createSound()
  sound.setMuted(settings.muted)

  const muteButton = button('icon-button', '', toggleMute)
  const topBar = el(
    'header',
    'top-bar',
    el('span', 'brand', 'Solfège'),
    muteButton,
    button('icon-button', '📊', showStats),
    button('icon-button', '⚙️', showSettings),
  )
  muteButton.setAttribute('aria-label', 'Son')
  const screen = el('main', 'screen-host')
  root.replaceChildren(el('div', 'app', topBar, screen))
  renderMute()
  showGame()

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

  function show(content: HTMLElement, withTopBar: boolean, nextGame: Game | null = null): void {
    game?.destroy()
    game = nextGame
    topBar.hidden = !withTopBar
    screen.replaceChildren(content)
  }

  function showGame(): void {
    const created = createGame({ settings, progress, sound, onProgress: changeProgress })
    show(created.element, true, created)
  }

  function showSettings(): void {
    show(createSettingsScreen({ settings, onChange: changeSettings, onBack: showGame }), false)
  }

  function showStats(): void {
    const onReset = () => {
      changeProgress(resetProgress())
      return progress
    }
    show(createStatsScreen({ progress, onReset, onBack: showGame }), false)
  }
}
