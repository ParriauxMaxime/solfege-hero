import type { KeysMode } from '../game/keysSampler'
import { t, type MessageKey } from '../i18n'
import type { Settings } from '../storage'
import { button, el } from './dom'
import { levelPill } from './levelPill'

export interface KeysStartOptions {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onPlay: () => void
  onOpenSettings: () => void
}

const MODE_LABEL_KEYS = { major: 'keys.mode.major', minor: 'keys.mode.minor', both: 'keys.mode.both' } satisfies Record<KeysMode, MessageKey>
const MODE_ORDER: readonly KeysMode[] = ['major', 'minor', 'both']

export function createKeysStart({ settings: initial, onChange, onPlay, onOpenSettings }: KeysStartOptions): HTMLElement {
  let mode = initial.keysMode
  const element = el('section', 'screen panel')

  function modeSetting(): HTMLElement {
    const options = MODE_ORDER.map((value) => {
      const option = button('segment', t(MODE_LABEL_KEYS[value]), () => {
        mode = value
        onChange({ keysMode: value })
        render()
      })
      option.classList.toggle('active', value === mode)
      return option
    })
    return el('div', 'setting', el('h2', '', t('keys.target')), el('div', 'segmented', ...options))
  }

  function render(): void {
    element.replaceChildren(
      el('h1', '', t('keys.title')),
      levelPill(initial.level, onOpenSettings),
      el('p', 'result-best', t('keys.intro')),
      modeSetting(),
      button('primary', t('keys.play'), onPlay),
    )
  }

  render()
  return element
}
