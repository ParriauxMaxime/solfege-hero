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
    expect(DEFAULT_SETTINGS).toMatchObject({
      clefs: ['treble'],
      accidentals: true,
      timed: false,
      muted: false,
    })
  })

  it('defaults hero mode to 60 BPM, metronome on and random notes', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ heroTempo: 60, metronome: true, heroMelody: '' })
  })

  it('round-trips valid settings', () => {
    const settings: Settings = {
      clefs: ['treble', 'alto'],
      accidentals: false,
      timed: true,
      muted: true,
      heroTempo: 120,
      metronome: false,
      heroMelody: 'Frère Jacques',
    }
    expect(sanitizeSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings)
  })

  it('keeps valid clefs once each, in clef order', () => {
    expect(sanitizeSettings({ clefs: ['alto', 'banjo', 'bass', 'alto', 3] }).clefs).toEqual([
      'bass',
      'alto',
    ])
  })

  it('clamps and rounds the hero tempo', () => {
    expect(sanitizeSettings({ heroTempo: 10 }).heroTempo).toBe(40)
    expect(sanitizeSettings({ heroTempo: 500 }).heroTempo).toBe(160)
    expect(sanitizeSettings({ heroTempo: 87.6 }).heroTempo).toBe(88)
    expect(sanitizeSettings({ heroTempo: 'fast' }).heroTempo).toBe(60)
  })

  it('ignores malformed hero settings', () => {
    expect(sanitizeSettings({ metronome: 'no', heroMelody: 3 })).toMatchObject({
      metronome: true,
      heroMelody: '',
    })
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
      hero: { bestScore: 900, bestStreak: 30, maxBpm: 110, hits: 200, misses: 20, perfects: 90 },
    }
    expect(sanitizeProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress)
  })

  it('sanitizes hero progress field by field', () => {
    const { hero } = sanitizeProgress({ hero: { bestScore: 50, maxBpm: -3, hits: 'x' } })
    expect(hero).toEqual({ ...EMPTY_PROGRESS.hero, bestScore: 50 })
  })

  it('loads progress saved before hero mode existed', () => {
    expect(sanitizeProgress({ notes: {}, bestStreak: 4, totalAnswered: 9, bestTimed: 1 }).hero).toEqual(
      EMPTY_PROGRESS.hero,
    )
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
