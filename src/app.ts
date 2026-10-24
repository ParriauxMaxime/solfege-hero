import { createSound } from './audio/sound'
import type { Melody } from './hero/types'
import { loadProgress, loadSettings, resetProgress, saveProgress, saveSettings, type Progress, type Settings } from './storage'
import { button, el } from './ui/dom'
import { createGame } from './ui/game'
import { createHero } from './ui/hero'
import { createHeroStart } from './ui/heroStart'
import { createSettingsScreen } from './ui/settings'
import { createStatsScreen } from './ui/stats'

type Mode = 'single' | 'hero'

const MODE_LABELS: Record<Mode, string> = { single: 'Une note', hero: 'Solfège hero' }

export function startApp(root: HTMLElement): void {
  let settings = loadSettings()
  let progress = loadProgress()
  let mode: Mode = 'single'
  let running: { destroy: () => void } | null = null
  const sound = createSound()
  sound.setMuted(settings.muted)

  const modeButtons = (Object.keys(MODE_LABELS) as Mode[]).map((candidate) => {
    const modeButton = button('segment', MODE_LABELS[candidate], () => {
      mode = candidate
      showMode()
    })
    modeButton.dataset['mode'] = candidate
    return modeButton
  })
  const muteButton = button('icon-button', '', toggleMute)
  const topBar = el(
    'header',
    'top-bar',
    el('div', 'segmented mode-switch', ...modeButtons),
    el('span', 'spacer'),
    muteButton,
    button('icon-button', '📊', showStats),
    button('icon-button', '⚙️', showSettings),
  )
  muteButton.setAttribute('aria-label', 'Son')
  const screen = el('main', 'screen-host')
  root.replaceChildren(el('div', 'app', topBar, screen))
  renderMute()
  showMode()

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

  function show(content: HTMLElement, withTopBar: boolean, next: { destroy: () => void } | null = null): void {
    running?.destroy()
    running = next
    topBar.hidden = !withTopBar
    for (const modeButton of modeButtons) modeButton.classList.toggle('active', modeButton.dataset['mode'] === mode)
    screen.replaceChildren(content)
  }

  function showMode(): void {
    if (mode === 'single') showGame()
    else showHeroStart()
  }

  function showGame(): void {
    const created = createGame({ settings, progress, sound, onProgress: changeProgress })
    show(created.element, true, created)
  }

  function showHeroStart(): void {
    show(createHeroStart({ settings, onChange: changeSettings, onPlay: playHero }), true)
  }

  function playHero(melody: Melody | null): void {
    const created = createHero({ settings, progress, sound, melody, onProgress: changeProgress, onQuit: showHeroStart })
    show(created.element, false, created)
  }

  function showSettings(): void {
    show(createSettingsScreen({ settings, onChange: changeSettings, onBack: showMode }), false)
  }

  function showStats(): void {
    const onReset = () => {
      changeProgress(resetProgress())
      return progress
    }
    show(createStatsScreen({ progress, onReset, onBack: showMode }), false)
  }
}
