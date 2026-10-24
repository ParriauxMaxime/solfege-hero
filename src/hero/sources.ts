import { pickPrompt, promptId, type NoteStats, type Prompt } from '../game/sampler'
import { spell } from '../music/notes'
import { randomBarRhythm } from './rhythm'
import { BEATS_PER_BAR, DURATION_BEATS, type HeroNote, type Melody, type NoteSpec } from './types'

export interface NoteSource {
  nextBar(): NoteSpec[]
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

function splitIntoBars(specs: NoteSpec[]): NoteSpec[][] {
  const bars: NoteSpec[][] = []
  let bar: NoteSpec[] = []
  let beats = 0
  for (const spec of specs) {
    bar.push(spec)
    beats += DURATION_BEATS[spec.duration]
    if (beats >= BEATS_PER_BAR) {
      bars.push(bar)
      bar = []
      beats = 0
    }
  }
  return bars
}

export function melodySource(melody: Melody): NoteSource {
  const bars = splitIntoBars(melody.notes)
  let index = 0
  return {
    nextBar() {
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
  preferFlat: () => boolean,
): HeroNote[] {
  let beat = startBeat
  return specs.map((spec, index) => {
    const placed: HeroNote = {
      id: firstId + index,
      beat,
      duration: spec.duration,
      pitch: spec.pitch,
      note: spec.pitch === null ? null : spell(spec.pitch, preferFlat()),
    }
    beat += DURATION_BEATS[spec.duration]
    return placed
  })
}
