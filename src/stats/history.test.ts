import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import {
  MAX_HISTORY_DAYS,
  MAX_NOTE_HISTORY_WEEKS,
  recordHistoryAnswer,
  recordHistoryGame,
  recordNoteHistory,
  sanitizeHistory,
  sanitizeNoteHistory,
  type History,
  type NoteHistory,
} from './history'

const DAY = '2026-10-24'
const record = { answered: 4, correct: 3, totalMs: 4000, timed: 4, games: 1, best: 3 }

describe('recordHistoryAnswer', () => {
  it('creates the record and counts timed answers', () => {
    const history = recordHistoryAnswer({}, 'learn', DAY, true, 1234.6)
    expect(history[DAY]?.learn).toEqual({ answered: 1, correct: 1, totalMs: 1235, timed: 1, games: 0, best: 0 })
  })

  it('counts untimed and wrong answers without time', () => {
    const once = recordHistoryAnswer({}, 'hero', DAY, false, null)
    const twice = recordHistoryAnswer(once, 'hero', DAY, true, Number.NaN)
    expect(twice[DAY]?.hero).toMatchObject({ answered: 2, correct: 1, totalMs: 0, timed: 0 })
  })

  it('does not mutate its input and keeps other modes', () => {
    const history: History = { [DAY]: { keys: record } }
    const frozen = structuredClone(history)
    const next = recordHistoryAnswer(history, 'learn', DAY, true, 10)
    expect(history).toEqual(frozen)
    expect(next[DAY]?.keys).toEqual(record)
  })

  it('keeps only the newest days', () => {
    let history: History = {}
    for (let index = 0; index <= MAX_HISTORY_DAYS; index++) {
      history = recordHistoryAnswer(history, 'learn', addDays('2025-01-01', index), true, 1)
    }
    expect(Object.keys(history)).toHaveLength(MAX_HISTORY_DAYS)
    expect(history['2025-01-01']).toBeUndefined()
  })
})

describe('recordHistoryGame', () => {
  it('keeps the highest score for score modes', () => {
    let history = recordHistoryGame({}, 'survival', DAY, 12)
    history = recordHistoryGame(history, 'survival', DAY, 8)
    expect(history[DAY]?.survival).toMatchObject({ games: 2, best: 12 })
    history = recordHistoryGame(history, 'survival', DAY, 20)
    expect(history[DAY]?.survival?.best).toBe(20)
  })

  it('keeps the fastest time for time modes, 0 meaning none', () => {
    let history = recordHistoryGame({}, 'series', DAY, 0)
    expect(history[DAY]?.series?.best).toBe(0)
    history = recordHistoryGame(history, 'series', DAY, 30_000)
    history = recordHistoryGame(history, 'series', DAY, 40_000)
    history = recordHistoryGame(history, 'series', DAY, null)
    expect(history[DAY]?.series).toMatchObject({ games: 4, best: 30_000 })
  })
})

describe('recordNoteHistory', () => {
  it('counts attempts and caps to the newest weeks', () => {
    let noteHistory: NoteHistory = recordNoteHistory({}, '2026-W43', 'treble:60', true)
    noteHistory = recordNoteHistory(noteHistory, '2026-W43', 'treble:60', false)
    expect(noteHistory['2026-W43']?.['treble:60']).toEqual({ attempts: 2, correct: 1 })
    for (let week = 1; week <= MAX_NOTE_HISTORY_WEEKS; week++) {
      noteHistory = recordNoteHistory(noteHistory, `2025-W${String(week).padStart(2, '0')}`, 'keys:-3', true)
    }
    expect(Object.keys(noteHistory)).toHaveLength(MAX_NOTE_HISTORY_WEEKS)
    expect(noteHistory['2025-W01']).toBeUndefined()
  })
})

describe('sanitizeHistory', () => {
  it('keeps valid records and defaults a missing timed to 0', () => {
    const { timed: _timed, ...withoutTimed } = record
    expect(sanitizeHistory({ [DAY]: { learn: record, series: withoutTimed } })).toEqual({
      [DAY]: { learn: record, series: { ...record, timed: 0 } },
    })
  })

  it('drops invalid keys, modes and numbers', () => {
    const raw = {
      'nope': { learn: record },
      '2026-02-31': { learn: record },
      [DAY]: {
        learn: { ...record, correct: 9 },
        keys: { ...record, timed: 9 },
        series: { ...record, totalMs: -1 },
        hero: { ...record, best: Number.NaN },
        piano: record,
        daily: record,
      },
    }
    expect(sanitizeHistory(raw)).toEqual({ [DAY]: { daily: record } })
  })

  it('ignores arrays and non-objects', () => {
    expect(sanitizeHistory([record])).toEqual({})
    expect(sanitizeHistory(null)).toEqual({})
    expect(sanitizeHistory({ [DAY]: [record] })).toEqual({})
  })
})

describe('sanitizeNoteHistory', () => {
  it('keeps valid ids and weeks only', () => {
    const raw = {
      '2026-W43': {
        'treble:60': { attempts: 3, correct: 2 },
        'keys:-3': { attempts: 1, correct: 1 },
        'keys:8': { attempts: 1, correct: 1 },
        'tenor:60': { attempts: 1, correct: 1 },
        'bass:40': { attempts: 1, correct: 2 },
        'alto:50': { attempts: -1, correct: 0 },
      },
      '2026-W99': { 'treble:60': { attempts: 1, correct: 1 } },
      nope: { 'treble:60': { attempts: 1, correct: 1 } },
    }
    expect(sanitizeNoteHistory(raw)).toEqual({
      '2026-W43': { 'treble:60': { attempts: 3, correct: 2 }, 'keys:-3': { attempts: 1, correct: 1 } },
    })
    expect(sanitizeNoteHistory([raw])).toEqual({})
  })
})
