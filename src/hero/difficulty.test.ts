import { describe, expect, it } from 'vitest'
import { INITIAL_DIFFICULTY, TEMPO_CAP, onJudgement, type DifficultyState } from './difficulty'

function hits(state: DifficultyState, count: number, bar = 0): DifficultyState {
  let next = state
  for (let i = 0; i < count; i++) next = onJudgement(next, true, bar)
  return next
}

describe('onJudgement', () => {
  it('starts at level 1', () => {
    expect(INITIAL_DIFFICULTY.level).toBe(1)
  })

  it('climbs one level every 16 clean notes and restarts the run', () => {
    expect(hits(INITIAL_DIFFICULTY, 15)).toMatchObject({ level: 1, cleanRun: 15 })
    expect(hits(INITIAL_DIFFICULTY, 16)).toMatchObject({ level: 2, cleanRun: 0 })
    expect(hits(INITIAL_DIFFICULTY, 48)).toMatchObject({ level: 4, cleanRun: 0 })
  })

  it('breaks the clean run on a miss', () => {
    const almost = hits(INITIAL_DIFFICULTY, 15)
    const missed = onJudgement(almost, false, 1)
    expect(missed).toMatchObject({ level: 1, cleanRun: 0, missesInBar: 1 })
    expect(hits(missed, 15, 2).level).toBe(1)
  })

  it('drops a level after three misses in the same bar', () => {
    let state: DifficultyState = { ...INITIAL_DIFFICULTY, level: 3 }
    state = onJudgement(state, false, 4)
    state = onJudgement(state, false, 4)
    expect(state.level).toBe(3)
    state = onJudgement(state, false, 4)
    expect(state).toMatchObject({ level: 2, missesInBar: 0 })
  })

  it('does not add up misses from different bars', () => {
    let state: DifficultyState = { ...INITIAL_DIFFICULTY, level: 3 }
    for (const bar of [1, 2, 3, 4]) state = onJudgement(state, false, bar)
    expect(state.level).toBe(3)
    expect(state.missesInBar).toBe(1)
  })

  it('keeps counting misses across a hit inside one bar', () => {
    let state: DifficultyState = { ...INITIAL_DIFFICULTY, level: 3 }
    state = onJudgement(state, false, 7)
    state = onJudgement(state, true, 7)
    state = onJudgement(state, false, 7)
    state = onJudgement(state, false, 7)
    expect(state.level).toBe(2)
  })

  it('stays between levels 1 and 5', () => {
    expect(onJudgement({ ...INITIAL_DIFFICULTY, bar: 0, missesInBar: 2 }, false, 0).level).toBe(1)
    expect(hits({ ...INITIAL_DIFFICULTY, level: 5 }, 16).level).toBe(5)
  })

  it('does not mutate the previous state', () => {
    const before = { ...INITIAL_DIFFICULTY }
    onJudgement(INITIAL_DIFFICULTY, true, 0)
    expect(INITIAL_DIFFICULTY).toEqual(before)
  })
})

describe('TEMPO_CAP', () => {
  it('rises with the level', () => {
    expect(TEMPO_CAP).toEqual({ 1: 72, 2: 90, 3: 110, 4: 140, 5: 200 })
  })
})
