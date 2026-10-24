import { buildPool, type Prompt } from '../game/sampler'
import { hashText } from '../hash'
import type { Melody } from '../hero/types'
import { generateMelody } from '../music/generator'
import { chooseKey, spellInKey } from '../music/keySignature'
import { pitchClass, spell, type Clef, type Note } from '../music/notes'
import { seededRandom } from '../random'

export const SERIES_LENGTH = 20
export const PENALTY_MS = 5000

const MIN_SEED = 1000
const SEED_COUNT = 9000

/** Version 1 draws notes uniformly; version 2 plays the start of a generated melody. */
export type SeriesVersion = 1 | 2

export type SeriesConfig =
  | { kind: 'random'; version: SeriesVersion; seed: number; clefs: Clef[]; armures: boolean }
  | { kind: 'score'; scoreId: string }

export type RandomSeriesConfig = Extract<SeriesConfig, { kind: 'random' }>

export interface SeriesItem {
  clef: Clef
  pitch: number
  fifths: number
  note: Note
}

export function newSeed(random: () => number = Math.random): number {
  return MIN_SEED + Math.floor(random() * SEED_COUNT)
}

function writeItem({ clef, pitch }: Prompt, armures: boolean, random: () => number): SeriesItem {
  if (armures) return { clef, pitch, ...chooseKey(pitch, clef, random) }
  return { clef, pitch, fifths: 0, note: spell(pitch, false) }
}

/** Every pitched note of the score in order, written in the score's own key. */
export function scoreSeries(score: Pick<Melody, 'clef' | 'key' | 'notes'>): SeriesItem[] {
  return score.notes.flatMap(({ pitch }) =>
    pitch === null
      ? []
      : [
          {
            clef: score.clef,
            pitch,
            fifths: score.key,
            note: spellInKey(pitch, score.key) ?? spell(pitch, score.key < 0),
          },
        ],
  )
}

const MELODY_SERIES_DIFFICULTY = 2
const MELODY_SERIES_BARS = 16

function generateMelodySeries({ seed, clefs, armures }: RandomSeriesConfig): SeriesItem[] {
  const clef = clefs[seed % clefs.length]
  if (!clef) throw new Error('Cannot generate a series without a clef')

  const melody = generateMelody(seed, {
    clef,
    armures,
    difficulty: MELODY_SERIES_DIFFICULTY,
    bars: MELODY_SERIES_BARS,
  })
  return scoreSeries(melody).slice(0, SERIES_LENGTH)
}

export function generateSeries(config: RandomSeriesConfig): SeriesItem[] {
  return config.version === 2 ? generateMelodySeries(config) : generateUniformSeries(config)
}

function generateUniformSeries({ seed, clefs, armures }: RandomSeriesConfig): SeriesItem[] {
  const pool = buildPool(clefs, armures)
  if (pool.length === 0) throw new Error('Cannot generate a series without a clef')

  const random = seededRandom((seed ^ hashText(`${clefs.join(',')}:${armures}`)) >>> 0)
  const items: SeriesItem[] = []
  let previous: Prompt | null = null
  for (let i = 0; i < SERIES_LENGTH; i++) {
    const candidates: Prompt[] =
      pool.length > 1
        ? pool.filter((prompt) => prompt.clef !== previous?.clef || prompt.pitch !== previous.pitch)
        : pool
    const prompt = candidates[Math.floor(random() * candidates.length)] as Prompt
    items.push(writeItem(prompt, armures, random))
    previous = prompt
  }
  return items
}

export interface SeriesRun {
  index: number
  /** Wrong taps per item. */
  mistakes: number[]
}

export const INITIAL_RUN: SeriesRun = { index: 0, mistakes: [] }

export function answerItem(
  run: SeriesRun,
  items: readonly SeriesItem[],
  chosenPitchClass: number,
): { run: SeriesRun; correct: boolean; finished: boolean } {
  const item = items[run.index]
  if (!item) return { run, correct: false, finished: true }

  if (pitchClass(item.pitch) !== chosenPitchClass) {
    const mistakes = Array.from({ length: items.length }, (_, i) => run.mistakes[i] ?? 0)
    mistakes[run.index] = (mistakes[run.index] ?? 0) + 1
    return { run: { index: run.index, mistakes }, correct: false, finished: false }
  }

  const index = run.index + 1
  return { run: { index, mistakes: run.mistakes }, correct: true, finished: index >= items.length }
}

export function penaltyMs(run: SeriesRun): number {
  return run.mistakes.reduce((sum, taps) => sum + taps, 0) * PENALTY_MS
}

export function firstTryResults(run: SeriesRun, length: number = SERIES_LENGTH): boolean[] {
  return Array.from({ length }, (_, i) => (run.mistakes[i] ?? 0) === 0)
}
