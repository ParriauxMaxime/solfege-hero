import type { KeysMode } from '../game/keysSampler'
import type { Settings } from '../storage'
import { button, el } from './dom'
import { levelPill } from './levelPill'

export interface KeysStartOptions {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onPlay: () => void
  onOpenSettings: () => void
}

const MODE_LABELS: Record<KeysMode, string> = { major: 'Majeur', minor: 'Mineur relatif', both: 'Les deux' }
const MODE_ORDER: readonly KeysMode[] = ['major', 'minor', 'both']

export function createKeysStart({ settings: initial, onChange, onPlay, onOpenSettings }: KeysStartOptions): HTMLElement {
  let mode = initial.keysMode
  const element = el('section', 'screen panel')

  function modeSetting(): HTMLElement {
    const options = MODE_ORDER.map((value) => {
      const option = button('segment', MODE_LABELS[value], () => {
        mode = value
        onChange({ keysMode: value })
        render()
      })
      option.classList.toggle('active', value === mode)
      return option
    })
    return el('div', 'setting', el('h2', '', 'Tonalité à trouver'), el('div', 'segmented', ...options))
  }

  function render(): void {
    element.replaceChildren(
      el('h1', '', 'Armures'),
      levelPill(initial.level, onOpenSettings),
      el('p', 'result-best', 'Lis l’armure et touche la tonique de la gamme.'),
      modeSetting(),
      button('primary', 'Jouer', onPlay),
    )
  }

  render()
  return element
}
