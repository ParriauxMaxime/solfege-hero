import { describe, expect, it } from 'vitest'
import type { NoteHistory } from './history'
import { noteTrend } from './trend'

const id = 'treble:60'

function history(weeks: Record<string, [attempts: number, correct: number]>): NoteHistory {
  return Object.fromEntries(
    Object.entries(weeks).map(([week, [attempts, correct]]) => [week, { [id]: { attempts, correct } }]),
  )
}

describe('noteTrend', () => {
  it('detects an improvement against the pooled previous 4 weeks', () => {
    const trend = noteTrend(history({ '2026-W43': [10, 9], '2026-W42': [5, 2], '2026-W40': [5, 3] }), id, '2026-W43')
    expect(trend).toMatchObject({ current: 90, baseline: 50, delta: 40, direction: 'up' })
  })

  it('detects a decline', () => {
    const trend = noteTrend(history({ '2026-W43': [10, 5], '2026-W39': [10, 9] }), id, '2026-W43')
    expect(trend).toMatchObject({ delta: -40, direction: 'down' })
  })

  it('reports flat under the threshold', () => {
    const trend = noteTrend(history({ '2026-W43': [10, 8], '2026-W42': [10, 8] }), id, '2026-W43')
    expect(trend?.direction).toBe('flat')
    expect(noteTrend(history({ '2026-W43': [100, 82], '2026-W42': [100, 80] }), id, '2026-W43')?.direction).toBe('flat')
  })

  it('ignores weeks older than 4 back and crosses year boundaries', () => {
    expect(noteTrend(history({ '2026-W43': [5, 5], '2026-W38': [5, 0] }), id, '2026-W43')).toBeNull()
    const trend = noteTrend(history({ '2026-W01': [4, 4], '2025-W52': [4, 2] }), id, '2026-W01')
    expect(trend).toMatchObject({ baseline: 50, direction: 'up' })
  })

  it('returns null when a side has too few attempts', () => {
    expect(noteTrend(history({ '2026-W43': [2, 2], '2026-W42': [10, 5] }), id, '2026-W43')).toBeNull()
    expect(noteTrend(history({ '2026-W43': [10, 5], '2026-W42': [2, 1] }), id, '2026-W43')).toBeNull()
    expect(noteTrend({}, id, '2026-W43')).toBeNull()
  })
})
