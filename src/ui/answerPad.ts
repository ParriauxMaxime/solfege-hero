import { nearestPitchInWindow, windowStartFor, type Answer } from '../game/strictOctave'
import { isNatural, pitchClass, pitchClassLabel, type Clef, type Naming } from '../music/notes'
import { el, trackPressed } from './dom'
import { icon } from './icons'
import { pianoLayout, type KeyboardSpan, type PianoKey } from './keyboardLayout'

const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11]
const KEY_LETTERS = 'cdefgab'
const FLASH_CLASSES = ['correct', 'wrong', 'reveal', 'neutral'] as const
const LANDSCAPE = '(orientation: landscape)'
const PORTRAIT = '(orientation: portrait)'
const STRICT_SPAN: KeyboardSpan = 2
const FIRST_WINDOW_START = 60
const ROTATE_MESSAGE = 'Tourne ton téléphone : l’octave stricte demande le mode paysage.'

export type PadFlash = (typeof FLASH_CLASSES)[number]

export interface PadOptions {
  /** Answers are exact pitches on a two-octave keyboard; portrait shows a rotation notice instead of keys. */
  strictOctave?: boolean
  /** Called when the keyboard becomes unavailable (strict octave in portrait) or available again. */
  onBlockedChange?: (blocked: boolean) => void
}

export interface AnswerPad {
  element: HTMLElement
  /** The pitch to answer, so a strict octave keyboard shows the two octaves that contain it. */
  setTarget: (clef: Clef, pitch: number) => void
  isBlocked: () => boolean
  /** Flashes the key of a MIDI pitch (its exact key in strict octave mode, else every octave of its pitch class). */
  flash: (pitch: number, kind: PadFlash) => void
  clear: () => void
  destroy: () => void
}

function createAnswerButton(name: string, key: PianoKey, answer: Answer, onAnswer: (answer: Answer) => void): HTMLButtonElement {
  const button = el('button', 'answer')
  button.type = 'button'
  trackPressed(button)
  button.addEventListener('pointerdown', () => onAnswer(answer))
  // The answer may open an overlay under the finger; cancelling the touch's synthetic click keeps it off that overlay's buttons.
  button.addEventListener('touchend', (event) => event.preventDefault())
  // A pointer press already answered; only keyboard activation (no pointer detail) reaches here.
  button.addEventListener('click', (event) => {
    if (event.detail === 0) onAnswer(answer)
  })
  button.append(...name.split('/').map((part) => el('span', '', part)))
  button.classList.toggle('altered', !key.natural)
  button.style.setProperty('--piano-row', key.natural ? '2' : '1')
  button.style.setProperty('--piano-column', String(key.column))
  const naturalIndex = NATURAL_PITCH_CLASSES.indexOf(key.natural ? key.pitchClass : key.pitchClass - 1)
  button.dataset.key = `${key.natural ? '' : '⇧'}${KEY_LETTERS.charAt(naturalIndex).toUpperCase()}${key.natural ? ` ${naturalIndex + 1}` : ''}`
  return button
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

function rotateNotice(): HTMLElement {
  return el('p', 'rotate-notice', icon('rotate'), ROTATE_MESSAGE)
}

export function createAnswerPad(
  onAnswer: (answer: Answer) => void,
  naming: Naming,
  span: KeyboardSpan,
  { strictOctave = false, onBlockedChange }: PadOptions = {},
): AnswerPad {
  const element = el('div', 'answers')
  const landscape = matchMedia(LANDSCAPE)
  const portrait = matchMedia(PORTRAIT)
  const flashes = new Map<number, Set<PadFlash>>()
  let keys: { flashKey: number; button: HTMLButtonElement }[] = []
  let windowStart = FIRST_WINDOW_START
  let target: number | null = null
  let blocked = false

  function isBlocked(): boolean {
    return strictOctave && portrait.matches
  }

  function flashKeyOf(pitch: number): number {
    return strictOctave ? pitch : pitchClass(pitch)
  }

  function render(): void {
    blocked = isBlocked()
    element.classList.toggle('blocked', blocked)
    if (blocked) {
      keys = []
      element.classList.remove('wide')
      element.replaceChildren(rotateNotice())
      return
    }
    const layout = pianoLayout(landscape.matches ? (strictOctave ? STRICT_SPAN : span) : 1)
    keys = layout.keys.map((key, index) => {
      const pitch = strictOctave ? windowStart + index : null
      const button = createAnswerButton(pitchClassLabel(key.pitchClass, naming), key, { pitchClass: key.pitchClass, pitch }, onAnswer)
      return { flashKey: pitch ?? key.pitchClass, button }
    })
    for (const { flashKey, button } of keys) button.classList.add(...(flashes.get(flashKey) ?? []))
    element.style.setProperty('--piano-columns', String(layout.columns))
    element.classList.toggle('wide', layout.columns > 14)
    element.replaceChildren(...keys.map((key) => key.button))
  }

  function onOrientationChange(): void {
    const wasBlocked = blocked
    render()
    if (blocked !== wasBlocked) onBlockedChange?.(blocked)
  }

  /** The computer keyboard answers in the octave of the window nearest to the requested note. */
  function onKeyDown(event: KeyboardEvent): void {
    if (blocked || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
    const chosen = pitchClassForKey(event)
    if (chosen === undefined) return
    const pitch = strictOctave ? nearestPitchInWindow(windowStart, chosen, target ?? windowStart) : null
    onAnswer({ pitchClass: chosen, pitch })
  }

  render()
  landscape.addEventListener('change', onOrientationChange)
  portrait.addEventListener('change', onOrientationChange)
  document.addEventListener('keydown', onKeyDown)

  return {
    element,
    setTarget(clef, pitch) {
      target = pitch
      const next = windowStartFor(clef, pitch, windowStart)
      if (next === windowStart) return
      windowStart = next
      if (strictOctave) render()
    },
    isBlocked: () => blocked,
    flash(pitch, kind) {
      const flashKey = flashKeyOf(pitch)
      flashes.set(flashKey, (flashes.get(flashKey) ?? new Set()).add(kind))
      for (const key of keys) if (key.flashKey === flashKey) key.button.classList.add(kind)
    },
    clear() {
      flashes.clear()
      for (const { button } of keys) button.classList.remove(...FLASH_CLASSES)
    },
    destroy() {
      landscape.removeEventListener('change', onOrientationChange)
      portrait.removeEventListener('change', onOrientationChange)
      document.removeEventListener('keydown', onKeyDown)
    },
  }
}
