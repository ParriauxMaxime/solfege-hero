import { pickPrompt, promptId, type NoteStats, type Prompt } from '../game/sampler'
import type { NoteCaps } from '../level/level'
import { generateMelodyWithPlan, type Difficulty } from '../music/generator'
import { spellInKey, withInlineAccidental } from '../music/keySignature'
import { midi, spell, type Clef, type Note } from '../music/notes'
import { randomBarRhythm } from './rhythm'
import { barLength, specBeats } from './meter'
import { COMMON_TIME, type HeroNote, type Melody, type NoteSpec, type TimeSignature } from './types'

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

const GENERATED_CHUNK_BARS = 8

/**
 * An endless generated melody in 8-bar chunks. The first chunk fixes key, mode and time signature;
 * each later chunk is composed from `seed + chunkIndex` at the difficulty read when it starts.
 */
export function generatedSource(
  seed: number,
  { clef, armures, caps }: { clef: Clef; armures: boolean; caps?: NoteCaps },
  getDifficulty: () => Difficulty,
): { key: number; time: TimeSignature; source: NoteSource } {
  const first = generateMelodyWithPlan(seed, {
    clef,
    armures,
    difficulty: getDifficulty(),
    bars: GENERATED_CHUNK_BARS,
    caps,
  })
  const { key, timeSignature: time } = first.melody

  let chunkIndex = 0
  let chunk = melodySource(first.melody)
  const source: NoteSource = {
    nextBar() {
      let bar = chunk.nextBar()
      while (bar === null) {
        chunkIndex++
        const next = generateMelodyWithPlan(seed + chunkIndex, {
          clef,
          armures,
          difficulty: getDifficulty(),
          bars: GENERATED_CHUNK_BARS,
          key,
          time,
          mode: first.mode,
          caps,
        })
        chunk = melodySource(next.melody)
        bar = chunk.nextBar()
      }
      return bar
    },
  }
  return { key, time, source }
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
