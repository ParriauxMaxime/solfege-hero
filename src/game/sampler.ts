import { pitchClass, pitchesInRange, type Clef } from '../music/notes'

export interface Prompt {
  clef: Clef
  /** MIDI number */
  pitch: number
}

export function promptId(prompt: Prompt): string {
  return `${prompt.clef}:${prompt.pitch}`
}

export function buildPool(clefs: readonly Clef[], withAccidentals: boolean): Prompt[] {
  return clefs.flatMap((clef) =>
    pitchesInRange(clef, withAccidentals).map((pitch) => ({ clef, pitch })),
  )
}

export interface NoteRecord {
  attempts: number
  correct: number
  misses: number
  avgMs: number
}

export type NoteStats = Record<string, NoteRecord>

const MISS_RECOVERY = 0.5
const MISS_WEIGHT = 2
const SLOW_AFTER_MS = 1500
const SLOWNESS_SPAN_MS = 1000
const MAX_SLOWNESS = 3
const AVG_ALPHA = 0.3

export function recordAnswer(
  stats: NoteStats,
  id: string,
  correct: boolean,
  ms: number | null,
): NoteStats {
  const previous = stats[id]
  const misses = previous?.misses ?? 0
  const knownAvgMs = previous?.avgMs ?? 0
  const record: NoteRecord = {
    attempts: (previous?.attempts ?? 0) + 1,
    correct: (previous?.correct ?? 0) + (correct ? 1 : 0),
    misses: correct ? Math.max(0, misses - MISS_RECOVERY) : misses + 1,
    avgMs: nextAverage(knownAvgMs, ms),
  }
  return { ...stats, [id]: record }
}

/** An average of 0 means no timing yet; a null sample (untimed answer) leaves it untouched. */
function nextAverage(avgMs: number, ms: number | null): number {
  if (ms === null) return avgMs
  return avgMs === 0 ? ms : AVG_ALPHA * ms + (1 - AVG_ALPHA) * avgMs
}

export function noteWeight(record: NoteRecord | undefined): number {
  if (!record) return 1
  const slowness = Math.min(
    MAX_SLOWNESS,
    Math.max(0, (record.avgMs - SLOW_AFTER_MS) / SLOWNESS_SPAN_MS),
  )
  return 1 + record.misses * MISS_WEIGHT + slowness
}

/** Each pitch class of a clef is equally likely, however many octaves of it the pool holds. */
function pitchClassKey(prompt: Prompt): string {
  return `${prompt.clef}:${pitchClass(prompt.pitch)}`
}

export function pickPrompt(
  pool: Prompt[],
  stats: NoteStats,
  previousId: string | null,
  random: () => number = Math.random,
): Prompt {
  if (pool.length === 0) throw new Error('Cannot pick a prompt from an empty pool')

  const sizes = new Map<string, number>()
  for (const prompt of pool) {
    const key = pitchClassKey(prompt)
    sizes.set(key, (sizes.get(key) ?? 0) + 1)
  }

  const fresh = pool.filter((prompt) => promptId(prompt) !== previousId)
  const candidates = fresh.length > 0 ? fresh : pool
  const weights = candidates.map(
    (prompt) => noteWeight(stats[promptId(prompt)]) / (sizes.get(pitchClassKey(prompt)) ?? 1),
  )
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  let threshold = random() * total
  for (const [index, candidate] of candidates.entries()) {
    threshold -= weights[index] ?? 0
    if (threshold < 0) return candidate
  }
  return candidates[candidates.length - 1] as Prompt
}

export function accuracy(record: NoteRecord | undefined): number | null {
  return record && record.attempts > 0 ? record.correct / record.attempts : null
}
