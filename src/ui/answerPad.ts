import { PITCH_CLASS_NAMES, isNatural } from '../music/notes'
import { button, el } from './dom'

const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11]
const KEY_LETTERS = 'cdefgab'
const FLASH_CLASSES = ['correct', 'wrong', 'reveal'] as const

export type PadFlash = (typeof FLASH_CLASSES)[number]

export interface AnswerPad {
  element: HTMLElement
  flash: (pitchClass: number, kind: PadFlash) => void
  clear: () => void
  destroy: () => void
}

function createAnswerButton(name: string, pitchClassIndex: number, onAnswer: (pitchClass: number) => void): HTMLButtonElement {
  const answer = button('answer', '', () => onAnswer(pitchClassIndex))
  answer.append(...name.split('/').map((part) => el('span', '', part)))
  const naturalIndex = NATURAL_PITCH_CLASSES.indexOf(pitchClassIndex)
  if (naturalIndex >= 0) {
    answer.style.setProperty('--piano-row', '2')
    answer.style.setProperty('--piano-column', String(1 + naturalIndex * 2))
  } else {
    const lowerNaturalIndex = NATURAL_PITCH_CLASSES.indexOf(pitchClassIndex - 1)
    answer.classList.add('altered')
    answer.style.setProperty('--piano-row', '1')
    answer.style.setProperty('--piano-column', String(2 + lowerNaturalIndex * 2))
  }
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

export function createAnswerPad(onAnswer: (pitchClass: number) => void): AnswerPad {
  const answers = PITCH_CLASS_NAMES.map((name, index) => createAnswerButton(name, index, onAnswer))
  const element = el('div', 'answers', ...answers)

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
    const chosen = pitchClassForKey(event)
    if (chosen !== undefined) onAnswer(chosen)
  }

  document.addEventListener('keydown', onKeyDown)

  return {
    element,
    flash: (pitchClass, kind) => answers[pitchClass]?.classList.add(kind),
    clear() {
      for (const answer of answers) answer.classList.remove(...FLASH_CLASSES)
    },
    destroy: () => document.removeEventListener('keydown', onKeyDown),
  }
}
