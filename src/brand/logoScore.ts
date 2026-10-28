import { seededRandom } from '../random'

export interface LogoNote {
  index: number
  step: number
  stemUp: boolean
  barStart: boolean
  miss: boolean
  streak: number
  /** Index of the first miss after this note: the note's flame goes out then. */
  snuffIndex: number
}

export const BEATS_PER_BAR = 4
export const MIN_MISS_GAP = 12
export const MAX_MISS_GAP = 30
/** D4 to G5 on the treble staff: every step is on or between the five lines, never on a ledger line. */
export const LOWEST_STEP = -1
export const HIGHEST_STEP = 9

const MIDDLE_LINE_STEP = 4
const WALK_SEED_SALT = 0x27d4eb2f
const MISS_SEED_SALT = 0x5bd1e995
const MAX_LEAP = 5
const LEAP_WEIGHTS = [0.8, 4, 2.5, 0.6, 0.35, 0.2]
const MAX_IDENTICAL_IN_A_ROW = 2
const DRIFT_FROM_DISTANCE = 3
const DRIFT_PER_STEP = 0.5
const PATTERN_LENGTH = 6
const PATTERN_BASE = HIGHEST_STEP - LOWEST_STEP + 1
const HISTORY_NOTES = 256

const FLAME_SCALE_AT_FIRST_HIT = 0.75
const FLAME_SCALE_AT_FULL_STREAK = 1.05
const FULL_STREAK = 10

/** Flames grow with the streak up to a cap. */
export const flameScale = (streak: number) =>
  FLAME_SCALE_AT_FIRST_HIT + (FLAME_SCALE_AT_FULL_STREAK - FLAME_SCALE_AT_FIRST_HIT) * Math.max(0, Math.min(1, (streak - 1) / (FULL_STREAK - 1)))

/** Weight of moving from `step` by `change`: small steps first, leaps rarely, a gentle pull back to the middle near the edges. */
function moveWeight(step: number, change: number): number {
  const weight = LEAP_WEIGHTS[Math.abs(change)] as number
  if (change === 0) return weight
  const distance = Math.abs(step - MIDDLE_LINE_STEP)
  const pull = distance < DRIFT_FROM_DISTANCE ? 1 : 1 + DRIFT_PER_STEP * (distance - DRIFT_FROM_DISTANCE + 1)
  return Math.sign(change) === Math.sign(MIDDLE_LINE_STEP - step) ? weight * pull : weight / pull
}

/** Endless tonal walk on the staff that never repeats a six-note pattern heard in its recent past. */
function createWalk(seed: number): () => number {
  const random = seededRandom(seed)
  const lastHeard = new Map<number, number>()
  const tail: number[] = []
  let count = 0

  const patternKey = (candidate: number) => [...tail, candidate].reduce((key, step) => key * PATTERN_BASE + step - LOWEST_STEP, 0)
  const heardAt = (candidate: number) => (tail.length < PATTERN_LENGTH - 1 ? -Infinity : (lastHeard.get(patternKey(candidate)) ?? -Infinity))

  return () => {
    const current = tail[tail.length - 1]
    const options: { step: number; weight: number }[] = []
    if (current === undefined) {
      options.push({ step: MIDDLE_LINE_STEP - 2 + Math.floor(random() * 5), weight: 1 })
    } else {
      const repeating = tail[tail.length - MAX_IDENTICAL_IN_A_ROW] === current
      for (let change = -MAX_LEAP; change <= MAX_LEAP; change++) {
        const step = current + change
        if (step < LOWEST_STEP || step > HIGHEST_STEP || (change === 0 && repeating)) continue
        options.push({ step, weight: moveWeight(current, change) })
      }
    }
    const fresh = options.filter(({ step }) => count - heardAt(step) > HISTORY_NOTES)
    const pool = fresh.length ? fresh : [options.reduce((oldest, option) => (heardAt(option.step) < heardAt(oldest.step) ? option : oldest))]
    let pick = random() * pool.reduce((total, { weight }) => total + weight, 0)
    const chosen = pool.find(({ weight }) => (pick -= weight) < 0) ?? (pool[pool.length - 1] as { step: number })
    if (tail.length === PATTERN_LENGTH - 1) lastHeard.set(patternKey(chosen.step), count)
    tail.push(chosen.step)
    if (tail.length >= PATTERN_LENGTH) tail.shift()
    count++
    if (count % HISTORY_NOTES === 0) for (const [key, at] of lastHeard) if (count - at > HISTORY_NOTES) lastHeard.delete(key)
    return chosen.step
  }
}

/** Endless stream of quarter notes from a seeded tonal walk, with a miss every 12 to 30 notes. */
export function createLogoScore(seed: number): () => LogoNote {
  const nextStep = createWalk(seed ^ WALK_SEED_SALT)
  const missGaps = seededRandom(seed ^ MISS_SEED_SALT)
  const nextMissGap = () => MIN_MISS_GAP + Math.floor(missGaps() * (MAX_MISS_GAP - MIN_MISS_GAP + 1))
  let index = 0
  let streak = 0
  let nextMiss = nextMissGap()

  return () => {
    const step = nextStep()
    const current = index++
    const miss = current === nextMiss
    if (miss) nextMiss += nextMissGap()
    streak = miss ? 0 : streak + 1
    return { index: current, step, stemUp: step < MIDDLE_LINE_STEP, barStart: current % BEATS_PER_BAR === 0, miss, streak, snuffIndex: nextMiss }
  }
}
