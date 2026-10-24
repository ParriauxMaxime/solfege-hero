import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  EMPTY_PROGRESS,
  sanitizeProgress,
  sanitizeSettings,
  type Progress,
  type Settings,
} from './storage'

describe('sanitizeSettings', () => {
  it('falls back to defaults for missing or malformed data', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS)
    expect(
      sanitizeSettings({ clefs: 'alto', accidentals: 'yes', timed: 'yes', muted: 1 }),
    ).toEqual(DEFAULT_SETTINGS)
  })

  it('defaults to the treble clef with accidentals, untimed and with sound', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      clefs: ['treble'],
      accidentals: true,
      timed: false,
      muted: false,
    })
  })

  it('round-trips valid settings', () => {
    const settings: Settings = {
      clefs: ['treble', 'alto'],
      accidentals: false,
      timed: true,
      muted: true,
    }
    expect(sanitizeSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings)
  })

  it('keeps valid clefs once each, in clef order', () => {
    expect(sanitizeSettings({ clefs: ['alto', 'banjo', 'bass', 'alto', 3] }).clefs).toEqual([
      'bass',
      'alto',
    ])
  })

  it('falls back to treble when no clef is valid', () => {
    expect(sanitizeSettings({ clefs: [] }).clefs).toEqual(['treble'])
    expect(sanitizeSettings({ clefs: ['banjo'] }).clefs).toEqual(['treble'])
  })
})

describe('sanitizeProgress', () => {
  it('falls back to empty progress for missing or malformed data', () => {
    expect(sanitizeProgress(null)).toEqual(EMPTY_PROGRESS)
    expect(sanitizeProgress([])).toEqual(EMPTY_PROGRESS)
    expect(sanitizeProgress({ notes: 'x', bestStreak: -1, totalAnswered: 'many' })).toEqual(
      EMPTY_PROGRESS,
    )
  })

  it('round-trips valid progress', () => {
    const progress: Progress = {
      notes: { 'treble:C4': { attempts: 5, correct: 3, misses: 1.5, avgMs: 1200 } },
      bestStreak: 12,
      totalAnswered: 80,
      bestTimed: 340,
    }
    expect(sanitizeProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress)
  })

  it('drops malformed note records and keeps the valid ones', () => {
    const valid = { attempts: 2, correct: 1, misses: 1, avgMs: 900 }
    const result = sanitizeProgress({
      notes: {
        good: valid,
        missingField: { attempts: 2, correct: 1, misses: 1 },
        wrongType: { ...valid, avgMs: '900' },
        negative: { ...valid, misses: -1 },
        impossible: { ...valid, correct: 3 },
        notAnObject: 4,
      },
    })
    expect(Object.keys(result.notes)).toEqual(['good'])
  })
})
