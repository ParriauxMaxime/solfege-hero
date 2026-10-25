import type { NoteSpec } from '../hero/types'

function token(spec: NoteSpec): string {
  return `${spec.pitch ?? 'r'}:${spec.duration}:${spec.dots ?? 0}`
}

export interface Alignment {
  correct: number
  substituted: number
  missing: number
  extra: number
}

/** Levenshtein alignment of two note sequences; a note is correct when pitch, duration and dots all match. */
export function alignNotes(truth: readonly NoteSpec[], read: readonly NoteSpec[]): Alignment {
  const a = truth.map(token)
  const b = read.map(token)
  const cost: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const substitution = (cost[i - 1]?.[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1)
      cost[i]![j] = Math.min(substitution, (cost[i - 1]?.[j] as number) + 1, (cost[i]?.[j - 1] as number) + 1)
    }
  }
  const result: Alignment = { correct: 0, substituted: 0, missing: 0, extra: 0 }
  let i = a.length
  let j = b.length
  while (i > 0 || j > 0) {
    const here = cost[i]?.[j] as number
    if (i > 0 && j > 0 && here === (cost[i - 1]?.[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] === b[j - 1]) result.correct++
      else result.substituted++
      i--
      j--
    } else if (i > 0 && here === (cost[i - 1]?.[j] as number) + 1) {
      result.missing++
      i--
    } else {
      result.extra++
      j--
    }
  }
  return result
}

export function noteAccuracy(truth: readonly NoteSpec[], read: readonly NoteSpec[]): number {
  return truth.length === 0 ? 1 : alignNotes(truth, read).correct / truth.length
}
