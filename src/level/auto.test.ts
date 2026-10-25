import { describe, expect, it } from 'vitest'
import { LEVEL_STEP, LEVEL_WINDOW, recordLevelAnswer, sanitizeLevelWindow, type LevelSample } from './auto'

function fill(okCount: number, ms: number, total = LEVEL_WINDOW - 1): LevelSample[] {
  return Array.from({ length: total }, (_, index) => ({ ok: index < okCount, ms }))
}

describe('recordLevelAnswer', () => {
  it('does not step before the window is full', () => {
    const result = recordLevelAnswer(fill(48, 500, 48), { ok: true, ms: 500 }, 40, true)
    expect(result.step).toBeNull()
    expect(result.window).toHaveLength(49)
  })

  it('steps up at exactly 90 % with a median of 1999 ms', () => {
    const result = recordLevelAnswer(fill(44, 1999), { ok: true, ms: 1999 }, 40, true)
    expect(result).toEqual({ window: [], level: 40 + LEVEL_STEP, step: 'up' })
  })

  it('does not step up at a median of 2000 ms', () => {
    expect(recordLevelAnswer(fill(49, 2000), { ok: true, ms: 2000 }, 40, true).step).toBeNull()
  })

  it('does not step up at 89 %', () => {
    const window = fill(44, 500)
    expect(recordLevelAnswer(window, { ok: false, ms: 500 }, 40, true).step).toBeNull()
  })

  it('steps down at 59 % and not at 60 %', () => {
    const down = recordLevelAnswer(fill(29, 500), { ok: false, ms: 500 }, 40, true)
    expect(down).toEqual({ window: [], level: 40 - LEVEL_STEP, step: 'down' })
    expect(recordLevelAnswer(fill(29, 500), { ok: true, ms: 500 }, 40, true).step).toBeNull()
  })

  it('resets after a step, so at most one step per 50 answers', () => {
    let window: LevelSample[] = []
    let level = 40
    const steps: (string | null)[] = []
    for (let i = 0; i < 100; i++) {
      const result = recordLevelAnswer(window, { ok: true, ms: 500 }, level, true)
      window = result.window
      level = result.level
      steps.push(result.step)
    }
    expect(steps.filter(Boolean)).toHaveLength(2)
    expect(level).toBe(40 + 2 * LEVEL_STEP)
  })

  it('clamps at 0 and 100', () => {
    expect(recordLevelAnswer(fill(0, 500), { ok: false, ms: 500 }, 0, true)).toMatchObject({ level: 0, step: null })
    expect(recordLevelAnswer(fill(49, 500), { ok: true, ms: 500 }, 100, true)).toMatchObject({ level: 100, step: null })
    expect(recordLevelAnswer(fill(49, 500), { ok: true, ms: 500 }, 98, true).level).toBe(100)
    expect(recordLevelAnswer(fill(0, 500), { ok: false, ms: 500 }, 3, true).level).toBe(0)
  })

  it('rolls the window to the last 50 and rounds the milliseconds', () => {
    const result = recordLevelAnswer(fill(30, 500), { ok: true, ms: 1234.6 }, 40, true)
    expect(result.window).toHaveLength(LEVEL_WINDOW)
    expect(result.window[LEVEL_WINDOW - 1]).toEqual({ ok: true, ms: 1235 })
    const rolled = recordLevelAnswer(result.window, { ok: true, ms: 1 }, 40, false)
    expect(rolled.window).toHaveLength(LEVEL_WINDOW)
  })

  it('never steps with auto off', () => {
    expect(recordLevelAnswer(fill(49, 500), { ok: true, ms: 500 }, 40, false)).toMatchObject({ level: 40, step: null })
    expect(recordLevelAnswer(fill(0, 500), { ok: false, ms: 500 }, 40, false)).toMatchObject({ level: 40, step: null })
  })
})

describe('sanitizeLevelWindow', () => {
  it('keeps valid entries only, at most 50', () => {
    const raw = [{ ok: true, ms: 10 }, { ok: 'yes', ms: 10 }, { ok: false, ms: -1 }, null, { ok: false, ms: Infinity }, { ok: false, ms: 0 }]
    expect(sanitizeLevelWindow(raw)).toEqual([{ ok: true, ms: 10 }, { ok: false, ms: 0 }])
    expect(sanitizeLevelWindow(Array.from({ length: 80 }, (_, i) => ({ ok: true, ms: i })))).toHaveLength(LEVEL_WINDOW)
    expect(sanitizeLevelWindow('nope')).toEqual([])
  })
})
