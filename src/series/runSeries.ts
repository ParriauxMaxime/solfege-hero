import { RUN_LENGTHS, runLength, writeInKey } from '../game/runs'
import { hashText } from '../hash'
import { generateMelody } from '../music/generator'
import { MAX_FIFTHS, spellInKey } from '../music/keySignature'
import { pitchClass, pitchesInRange, spell, type Clef, type Note } from '../music/notes'
import { ALL_KEYS_FIFTHS, MAX_LEVEL, capsFor, signatureWeight, type NoteCaps } from '../level/level'
import { seededRandom } from '../random'
import { SERIES_LENGTH, scoreSeries, type RandomSeriesConfig, type SeriesItem } from './series'

const MELODY_SERIES_BARS = 16
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
const SEMITONES_PER_OCTAVE = 12
const ALL_KEYS = Array.from({ length: 2 * MAX_FIFTHS + 1 }, (_, index) => index - MAX_FIFTHS)

/**
 * Replaces each note that sounds like the one before by the nearest scale degree of the
 * melody's key, going up or down by turns according to the seed. Pure, so everyone gets the same series.
 */
export function withoutRepeatedPitchClasses(
  pitches: readonly number[],
  key: number,
  clef: Clef,
  seed: number,
  ledgerLines = 2,
): number[] {
  const tonic = (((key * 7) % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE
  const inScale = (pitch: number) => MAJOR_SCALE.includes((pitchClass(pitch) - tonic + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE)
  const range = pitchesInRange(clef, true, ledgerLines)
  const lowest = range[0] ?? 0
  const highest = range[range.length - 1] ?? 127

  const result: number[] = []
  for (const [index, pitch] of pitches.entries()) {
    const previous = result[index - 1]
    if (previous === undefined || pitchClass(pitch) !== pitchClass(previous)) {
      result.push(pitch)
      continue
    }
    const direction = (seed + index) % 2 === 0 ? 1 : -1
    let replacement: number | null = null
    for (let distance = 1; distance <= SEMITONES_PER_OCTAVE && replacement === null; distance++) {
      for (const sign of [direction, -direction]) {
        const candidate = pitch + sign * distance
        if (candidate < lowest || candidate > highest) continue
        if (inScale(candidate) && pitchClass(candidate) !== pitchClass(previous)) {
          replacement = candidate
          break
        }
      }
    }
    result.push(replacement ?? pitch)
  }
  return result
}

interface Writing {
  clef: Clef
  fifths: number
  notes: Note[]
}

function writeRun(pitches: readonly number[], clef: Clef, fifths: number, ledgerLines = 2): Writing | null {
  const notes = pitches.map((pitch) => writeInKey(pitch, clef, fifths, ledgerLines))
  return notes.every((note): note is Note => note !== null) ? { clef, fifths, notes } : null
}

const keyWeight = (fifths: number) => 1 / (1 + Math.abs(fifths))

function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, random: () => number): T {
  let threshold = random() * items.reduce((sum, item) => sum + weight(item), 0)
  for (const item of items) {
    threshold -= weight(item)
    if (threshold < 0) return item
  }
  return items[items.length - 1] as T
}

function chooseRunWriting(
  pitches: readonly number[],
  clefs: readonly Clef[],
  armures: boolean,
  previousKey: number | null,
  random: () => number,
  mustChangeKey: boolean,
  caps?: NoteCaps,
): Writing | null {
  const capped = caps !== undefined && caps.maxFifths < ALL_KEYS_FIFTHS
  const reachable = capped ? ALL_KEYS.filter((fifths) => Math.abs(fifths) <= caps.maxFifths) : ALL_KEYS
  const keys = armures ? reachable : [0]
  const writable = keys.flatMap((fifths) => {
    const options = clefs.flatMap((clef) => writeRun(pitches, clef, fifths, caps?.ledgerLines) ?? [])
    return options.length > 0 ? [{ fifths, options }] : []
  })
  const changed = writable.filter(({ fifths }) => fifths !== previousKey)
  const candidates = mustChangeKey || changed.length > 0 ? changed : writable
  if (candidates.length === 0) return null
  const { options } = pickWeighted(
    candidates,
    ({ fifths }) => keyWeight(fifths) * (capped ? signatureWeight(fifths, caps.maxFifths) : 1),
    random,
  )
  return options[Math.floor(random() * options.length)] ?? null
}

/**
 * Version 3: the seeded melody without repeated pitch classes, key signature and clef changing every 4 or 5 notes.
 * Version 4 is the same, limited by the caps of the config's level.
 */
export function generateRunSeries({ seed, clefs, armures, difficulty, version, level }: RandomSeriesConfig): SeriesItem[] {
  const melodyClef = clefs[seed % clefs.length]
  if (!melodyClef) throw new Error('Cannot generate a series without a clef')

  const caps = version === 4 ? capsFor(level ?? MAX_LEVEL) : undefined
  const melody = generateMelody(seed, { clef: melodyClef, armures, difficulty, bars: MELODY_SERIES_BARS, caps })
  const original = scoreSeries(melody).slice(0, SERIES_LENGTH)
  const pitches = withoutRepeatedPitchClasses(
    original.map((item) => item.pitch),
    melody.key,
    melodyClef,
    seed,
    caps?.ledgerLines,
  )

  const random = seededRandom((seed ^ hashText('runs')) >>> 0)
  const items: SeriesItem[] = []
  let previousKey: number | null = null
  let start = 0
  while (start < pitches.length) {
    const preferred = runLength(random)
    const lengths = [preferred, ...RUN_LENGTHS.filter((length) => length !== preferred)].map((length) =>
      Math.min(length, pitches.length - start),
    )
    let run = pitches.slice(start, start + (lengths[0] as number))
    let writing: Writing | null = null
    for (const length of lengths) {
      const candidate = pitches.slice(start, start + length)
      writing = chooseRunWriting(candidate, clefs, armures, previousKey, random, true, caps)
      if (writing) {
        run = candidate
        break
      }
    }
    const chosen: Writing =
      writing ??
      chooseRunWriting(run, clefs, armures, previousKey, random, false, caps) ??
      cappedFallbackWriting(run, melodyClef, melody.key, caps) ??
      fallbackWriting(run, melodyClef, melody.key)
    run.forEach((pitch, offset) =>
      items.push({ clef: chosen.clef, pitch, fifths: chosen.fifths, note: chosen.notes[offset] as Note }),
    )
    previousKey = chosen.fifths
    start += run.length
  }
  return items
}

/** Without caps there is nothing to guard; with caps, a key within the cap that writes the run in range. */
function cappedFallbackWriting(
  pitches: readonly number[],
  clef: Clef,
  melodyKey: number,
  caps: NoteCaps | undefined,
): Writing | null {
  if (!caps) return null
  const keys = [melodyKey, ...ALL_KEYS.filter((fifths) => fifths !== melodyKey && Math.abs(fifths) <= caps.maxFifths)]
  for (const fifths of keys) {
    const writing = writeRun(pitches, clef, fifths, caps.ledgerLines)
    if (writing) return writing
  }
  return null
}

function fallbackWriting(pitches: readonly number[], clef: Clef, fifths: number): Writing {
  return {
    clef,
    fifths,
    notes: pitches.map((pitch) => spellInKey(pitch, fifths) ?? spell(pitch, fifths < 0)),
  }
}
