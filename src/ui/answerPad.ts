import { isNatural, pitchClassLabel } from '../music/notes'
import type { Settings } from '../storage'
import { el, trackPressed } from './dom'
import { pianoLayout, type KeyboardSpan, type PianoKey } from './keyboardLayout'

const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11]
const KEY_LETTERS = 'cdefgab'
const FLASH_CLASSES = ['correct', 'wrong', 'reveal', 'neutral'] as const
const LANDSCAPE = '(orientation: landscape)'

export type PadFlash = (typeof FLASH_CLASSES)[number]

export interface AnswerPad {
  element: HTMLElement
  flash: (pitchClass: number, kind: PadFlash) => void
  clear: () => void
  destroy: () => void
}

function createAnswerButton(name: string, key: PianoKey, onAnswer: (pitchClass: number) => void): HTMLButtonElement {
  const answer = el('button', 'answer')
  answer.type = 'button'
  trackPressed(answer)
  answer.addEventListener('pointerdown', () => onAnswer(key.pitchClass))
  // The answer may open an overlay under the finger; cancelling the touch's synthetic click keeps it off that overlay's buttons.
  answer.addEventListener('touchend', (event) => event.preventDefault())
  // A pointer press already answered; only keyboard activation (no pointer detail) reaches here.
  answer.addEventListener('click', (event) => {
    if (event.detail === 0) onAnswer(key.pitchClass)
  })
  answer.append(...name.split('/').map((part) => el('span', '', part)))
  answer.classList.toggle('altered', !key.natural)
  answer.style.setProperty('--piano-row', key.natural ? '2' : '1')
  answer.style.setProperty('--piano-column', String(key.column))
  return answer
}

function pitchClassForKey(event: KeyboardEvent): number | undefined {
  const key = event.key.toLowerCase()
  const letterIndex = KEY_LETTERS.indexOf(key)
  if (letterIndex < 0) {
    const digit = Number(key)
    return digit >= 1 && digit <= 7 ? NATURAL_PITCH_CLASSES[digit - 1] : undefined
  }
  const natural = NATURAL_PITCH_CLASSES[letterIndex] as number
  if (!event.shiftKey) return natural
  return isNatural(natural + 1) ? undefined : natural + 1
}

export function createAnswerPad(
  onAnswer: (pitchClass: number) => void,
  naming: Settings['naming'],
  span: KeyboardSpan,
): AnswerPad {
  const element = el('div', 'answers')
  const landscape = matchMedia(LANDSCAPE)
  const flashes = new Map<number, Set<PadFlash>>()
  let keys: { pitchClass: number; button: HTMLButtonElement }[] = []

  function render(): void {
    const layout = pianoLayout(landscape.matches ? span : 1)
    keys = layout.keys.map((key) => ({
      pitchClass: key.pitchClass,
      button: createAnswerButton(pitchClassLabel(key.pitchClass, naming), key, onAnswer),
    }))
    for (const { pitchClass, button } of keys) button.classList.add(...(flashes.get(pitchClass) ?? []))
    element.style.setProperty('--piano-columns', String(layout.columns))
    element.classList.toggle('wide', layout.columns > 14)
    element.replaceChildren(...keys.map((key) => key.button))
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
    const chosen = pitchClassForKey(event)
    if (chosen !== undefined) onAnswer(chosen)
  }

  render()
  landscape.addEventListener('change', render)
  document.addEventListener('keydown', onKeyDown)

  return {
    element,
    flash(pitchClass, kind) {
      flashes.set(pitchClass, (flashes.get(pitchClass) ?? new Set()).add(kind))
      for (const key of keys) if (key.pitchClass === pitchClass) key.button.classList.add(kind)
    },
    clear() {
      flashes.clear()
      for (const { button } of keys) button.classList.remove(...FLASH_CLASSES)
    },
    destroy() {
      landscape.removeEventListener('change', render)
      document.removeEventListener('keydown', onKeyDown)
    },
  }
}
