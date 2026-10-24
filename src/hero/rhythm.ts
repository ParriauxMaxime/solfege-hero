import { BEATS_PER_BAR, type Duration } from './types'

export interface RhythmSymbol {
  duration: Duration
  rest: boolean
}

const WHOLE_CHANCE = 0.08
const HALF_CHANCE = 0.22
const EIGHTH_PAIR_CHANCE = 0.25
const REST_CHANCE = 0.08

const note = (duration: Duration): RhythmSymbol => ({ duration, rest: false })

export function randomBarRhythm(random: () => number): RhythmSymbol[] {
  const symbols: RhythmSymbol[] = []
  let beat = 0
  while (beat < BEATS_PER_BAR) {
    const roll = random()
    if (beat === 0 && roll < WHOLE_CHANCE) {
      symbols.push(note('whole'))
      beat += 4
    } else if (beat % 2 === 0 && roll < WHOLE_CHANCE + HALF_CHANCE) {
      symbols.push(note('half'))
      beat += 2
    } else if (roll < WHOLE_CHANCE + HALF_CHANCE + EIGHTH_PAIR_CHANCE) {
      symbols.push(note('eighth'), note('eighth'))
      beat += 1
    } else {
      symbols.push({ duration: 'quarter', rest: beat > 0 && random() < REST_CHANCE })
      beat += 1
    }
  }
  return symbols
}
