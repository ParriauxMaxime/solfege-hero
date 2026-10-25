import type { Duration } from '../../hero/types'
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

const DURATIONS: { duration: Duration; icon: IconName; label: string }[] = [
  { duration: 'whole', icon: 'note-whole', label: 'Ronde' },
  { duration: 'half', icon: 'note-half', label: 'Blanche' },
  { duration: 'quarter', icon: 'note-quarter', label: 'Noire' },
  { duration: 'eighth', icon: 'note-eighth', label: 'Croche' },
  { duration: 'sixteenth', icon: 'note-sixteenth', label: 'Double croche' },
]

const ACCIDENTALS: { accidental: Accidental; icon: IconName; label: string }[] = [
  { accidental: 'sharp', icon: 'sharp', label: 'Dièse' },
  { accidental: 'natural', icon: 'natural', label: 'Bécarre' },
  { accidental: 'flat', icon: 'flat', label: 'Bémol' },
]

export function createEditTools(actions: ToolActions): EditTools {
  const tools: { button: HTMLButtonElement; active: (state: ToolState) => boolean; needsPitch: boolean }[] = []

  function tool(name: IconName, label: string, onClick: () => void, active: (state: ToolState) => boolean = () => false, needsPitch = false): HTMLButtonElement {
    const element = button('omr-tool', '', onClick)
    element.setAttribute('aria-label', label)
    element.title = label
    setIcon(element, name)
    tools.push({ button: element, active, needsPitch })
    return element
  }

  const group = (...children: HTMLElement[]) => el('div', 'omr-tool-group', ...children)
  const hint = el('p', 'omr-tools-hint', 'Touche une note pour la modifier')
  const buttons = el(
    'div',
    'omr-tools',
    group(
      ...DURATIONS.map(({ duration, icon, label }) => tool(icon, label, () => actions.duration(duration), (state) => state.duration === duration)),
      tool('dot', 'Point', actions.dot, (state) => state.dotted),
      tool('rest', 'Note ou silence', actions.rest, (state) => !state.pitched),
    ),
    group(
      tool('arrow-up', 'Monter d’un cran', () => actions.move(1), undefined, true),
      tool('arrow-down', 'Descendre d’un cran', () => actions.move(-1), undefined, true),
      ...ACCIDENTALS.map(({ accidental, icon, label }) => tool(icon, label, () => actions.accidental(accidental), (state) => state.accidental === accidental, true)),
      tool('plus', 'Insérer après', actions.insert),
      tool('trash', 'Supprimer', actions.remove),
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
