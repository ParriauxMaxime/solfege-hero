import { hashText } from '../hash'
import { MAX_LEVEL, capsFor, isUncapped } from '../level/level'
import { generateMelody } from '../music/generator'
import type { Clef } from '../music/notes'
import { scoreSeries, type SeriesItem } from '../series/series'
import { difficultyFor, NOTES_PER_LEVEL } from './game'

export const BLOCK_NOTES = NOTES_PER_LEVEL
const BLOCK_BARS = 16

export interface SurvivalSequenceConfig {
  seed: number
  clefs: Clef[]
  armures: boolean
  /** Player level capping the notes; absent or 100 means no cap. */
  level?: number
}

/**
 * Notes come in blocks of BLOCK_NOTES, one difficulty per block. A block depends only on
 * (seed, clefs, armures, block index), so note i never depends on how the player did.
 */
function generateBlock({ seed, clefs, armures, level = MAX_LEVEL }: SurvivalSequenceConfig, block: number): SeriesItem[] {
  const difficulty = difficultyFor(block * BLOCK_NOTES)
  const blockSeed = hashText(`survie:${seed}:${block}`)
  const clef = clefs[blockSeed % clefs.length]
  if (!clef) throw new Error('Cannot play Survie without a clef')
  const caps = isUncapped(level) ? undefined : capsFor(level)
  return scoreSeries(generateMelody(blockSeed, { clef, armures, difficulty, bars: BLOCK_BARS, caps })).slice(0, BLOCK_NOTES)
}

export interface SurvivalSequence {
  noteAt: (index: number) => SeriesItem
}

export function createSurvivalSequence(config: SurvivalSequenceConfig): SurvivalSequence {
  const blocks = new Map<number, SeriesItem[]>()

  return {
    noteAt(index) {
      const block = Math.floor(index / BLOCK_NOTES)
      let items = blocks.get(block)
      if (!items) {
        items = generateBlock(config, block)
        blocks.set(block, items)
      }
      return items[index % items.length] as SeriesItem
    },
  }
}
