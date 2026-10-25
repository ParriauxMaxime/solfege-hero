import { MAX_LEVEL, clampLevel } from './level'

export interface LevelSample {
  ok: boolean
  ms: number
}

export const LEVEL_WINDOW = 50
export const LEVEL_STEP = 5

const PROMOTE_PRECISION = 0.9
const DEMOTE_PRECISION = 0.6
const PROMOTE_MEDIAN_MS = 2000

export interface LevelUpdate {
  window: LevelSample[]
  level: number
  step: 'up' | 'down' | null
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}

export function recordLevelAnswer(
  window: readonly LevelSample[],
  sample: LevelSample,
  level: number,
  auto: boolean,
): LevelUpdate {
  const rolled = [...window, { ok: sample.ok, ms: Math.round(sample.ms) }].slice(-LEVEL_WINDOW)
  if (!auto || rolled.length < LEVEL_WINDOW) return { window: rolled, level, step: null }

  const precision = rolled.filter((entry) => entry.ok).length / rolled.length
  if (precision >= PROMOTE_PRECISION && median(rolled.map((entry) => entry.ms)) < PROMOTE_MEDIAN_MS && level < MAX_LEVEL) {
    return { window: [], level: clampLevel(level + LEVEL_STEP), step: 'up' }
  }
  if (precision < DEMOTE_PRECISION && level > 0) {
    return { window: [], level: clampLevel(level - LEVEL_STEP), step: 'down' }
  }
  return { window: rolled, level, step: null }
}

export function sanitizeLevelWindow(raw: unknown): LevelSample[] {
  if (!Array.isArray(raw)) return []
  const valid = raw.flatMap((entry): LevelSample[] => {
    const candidate = entry as Partial<LevelSample> | null
    const ok = candidate?.ok
    const ms = candidate?.ms
    return typeof ok === 'boolean' && typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 ? [{ ok, ms }] : []
  })
  return valid.slice(-LEVEL_WINDOW)
}
