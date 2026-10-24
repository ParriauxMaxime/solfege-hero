export const KEYBOARD_SPANS = [1, 1.5, 2] as const
export type KeyboardSpan = (typeof KEYBOARD_SPANS)[number]

export interface PianoKey {
  pitchClass: number
  natural: boolean
  /** 1-based grid column where the key starts; each natural spans two columns. */
  column: number
}

export interface PianoLayout {
  keys: PianoKey[]
  columns: number
}

const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11]
const SPAN_RANGES: Record<KeyboardSpan, { first: number; count: number }> = {
  1: { first: 0, count: 12 },
  1.5: { first: 7, count: 18 },
  2: { first: 0, count: 24 },
}

export function pianoLayout(span: KeyboardSpan): PianoLayout {
  const { first, count } = SPAN_RANGES[span]
  let naturals = 0
  const keys = Array.from({ length: count }, (_, offset): PianoKey => {
    const pitchClass = (first + offset) % 12
    const natural = NATURAL_PITCH_CLASSES.includes(pitchClass)
    const column = natural ? 1 + naturals * 2 : naturals * 2
    if (natural) naturals++
    return { pitchClass, natural, column }
  })
  return { keys, columns: naturals * 2 }
}
