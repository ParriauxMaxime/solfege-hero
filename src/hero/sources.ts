import { pickPrompt, promptId, type NoteStats, type Prompt } from '../game/sampler'
import { spellInKey, withInlineAccidental } from '../music/keySignature'
import { midi, spell, type Note } from '../music/notes'
import { randomBarRhythm } from './rhythm'
import { barLength, specBeats } from './meter'
import { COMMON_TIME, type HeroNote, type Melody, type NoteSpec } from './types'

export interface NoteSource {
  /** Null once the source is exhausted. */
  nextBar(): NoteSpec[] | null
}

export function randomSource(
  pool: Prompt[],
  stats: () => NoteStats,
  random: () => number = Math.random,
): NoteSource {
  let previousId: string | null = null
  return {
    nextBar() {
      return randomBarRhythm(random).map(({ duration, rest }) => {
        if (rest) return { pitch: null, duration }
        const prompt = pickPrompt(pool, stats(), previousId, random)
        previousId = promptId(prompt)
        return { pitch: prompt.pitch, duration }
      })
    },
  }
}

const BAR_TOLERANCE = 1e-6

function splitIntoBars(specs: NoteSpec[], length: number): NoteSpec[][] {
  const bars: NoteSpec[][] = []
  let bar: NoteSpec[] = []
  let position = 0
  let barEnd = length
  for (const spec of specs) {
    bar.push(spec)
    position += specBeats(spec)
    if (position >= barEnd - BAR_TOLERANCE) {
      bars.push(bar)
      bar = []
      barEnd = (Math.floor((position + BAR_TOLERANCE) / length) + 1) * length
    }
  }
  if (bar.length > 0) bars.push(bar)
  return bars
}

export function melodySource(melody: Melody, { loop = false } = {}): NoteSource {
  const bars = splitIntoBars(melody.notes, barLength(melody.timeSignature ?? COMMON_TIME))
  let index = 0
  return {
    nextBar() {
      if (!loop && index >= bars.length) return null
      const bar = bars[index % bars.length] ?? []
      index++
      return bar.map((spec) => ({ ...spec }))
    },
  }
}

export function placeNotes(
  specs: NoteSpec[],
  startBeat: number,
  firstId: number,
  fifths: number,
  inlineChance: number,
  random: () => number = Math.random,
): HeroNote[] {
  let beat = startBeat
  return specs.map((spec, index) => {
    const note = spec.pitch === null ? null : writeNote(spec.pitch, fifths, inlineChance, random)
    const placed: HeroNote = {
      id: firstId + index,
      beat,
      duration: spec.duration,
      dots: spec.dots ?? 0,
      pitch: note && midi(note),
      note,
    }
    beat += specBeats(spec)
    return placed
  })
}

function writeNote(pitch: number, fifths: number, inlineChance: number, random: () => number): Note {
  const inKey = spellInKey(pitch, fifths) ?? spell(pitch, fifths < 0)
  return random() < inlineChance ? withInlineAccidental(inKey, fifths, random) : inKey
}
