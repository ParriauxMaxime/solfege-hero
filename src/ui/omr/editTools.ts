import type { Duration } from '../../hero/types'
import { t, type MessageKey } from '../../i18n'
import type { Accidental } from '../../music/keySignature'
import { button, el, setIcon } from '../dom'
import type { IconName } from '../icons'

export interface ToolState {
  pitched: boolean
  duration: Duration
  dotted: boolean
  accidental: Accidental | null
}

export interface ToolActions {
  move: (delta: number) => void
  duration: (duration: Duration) => void
  dot: () => void
  accidental: (accidental: Accidental) => void
  rest: () => void
  insert: () => void
  remove: () => void
}

export interface EditTools {
  element: HTMLElement
  /** Enables the buttons for the selected note; null disables them all. */
  refresh: (state: ToolState | null) => void
}

const DURATIONS: { duration: Duration; icon: IconName; label: MessageKey }[] = [
  { duration: 'whole', icon: 'note-whole', label: 'omr.tools.whole' },
  { duration: 'half', icon: 'note-half', label: 'omr.tools.half' },
  { duration: 'quarter', icon: 'note-quarter', label: 'omr.tools.quarter' },
  { duration: 'eighth', icon: 'note-eighth', label: 'omr.tools.eighth' },
  { duration: 'sixteenth', icon: 'note-sixteenth', label: 'omr.tools.sixteenth' },
]

const ACCIDENTALS: { accidental: Accidental; icon: IconName; label: MessageKey }[] = [
  { accidental: 'sharp', icon: 'sharp', label: 'omr.tools.sharp' },
  { accidental: 'natural', icon: 'natural', label: 'omr.tools.natural' },
  { accidental: 'flat', icon: 'flat', label: 'omr.tools.flat' },
]

export function createEditTools(actions: ToolActions): EditTools {
  const tools: { button: HTMLButtonElement; active: (state: ToolState) => boolean; needsPitch: boolean }[] = []

  function tool(name: IconName, labelKey: MessageKey, onClick: () => void, active: (state: ToolState) => boolean = () => false, needsPitch = false): HTMLButtonElement {
    const element = button('omr-tool', '', onClick)
    const label = t(labelKey)
    element.setAttribute('aria-label', label)
    element.title = label
    setIcon(element, name)
    tools.push({ button: element, active, needsPitch })
    return element
  }

  const group = (...children: HTMLElement[]) => el('div', 'omr-tool-group', ...children)
  const hint = el('p', 'omr-tools-hint', t('omr.tools.hint'))
  const buttons = el(
    'div',
    'omr-tools',
    group(
      ...DURATIONS.map(({ duration, icon, label }) => tool(icon, label, () => actions.duration(duration), (state) => state.duration === duration)),
      tool('dot', 'omr.tools.dot', actions.dot, (state) => state.dotted),
      tool('rest', 'omr.tools.rest', actions.rest, (state) => !state.pitched),
    ),
    group(
      tool('arrow-up', 'omr.tools.up', () => actions.move(1), undefined, true),
      tool('arrow-down', 'omr.tools.down', () => actions.move(-1), undefined, true),
      ...ACCIDENTALS.map(({ accidental, icon, label }) => tool(icon, label, () => actions.accidental(accidental), (state) => state.accidental === accidental, true)),
      tool('plus', 'omr.tools.insert', actions.insert),
      tool('trash', 'omr.tools.remove', actions.remove),
    ),
  )
  const element = el('div', 'omr-tools-box', hint, buttons)

  function refresh(state: ToolState | null): void {
    hint.style.visibility = state ? 'hidden' : 'visible'
    for (const { button: element, active, needsPitch } of tools) {
      element.disabled = !state || (needsPitch && !state.pitched)
      element.classList.toggle('active', Boolean(state) && active(state as ToolState))
    }
  }

  refresh(null)
  return { element, refresh }
}
