import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  EMPTY_PROGRESS,
  exportData,
  importData,
  sanitizeProgress,
  sanitizeSettings,
  type Progress,
  type Settings,
} from './storage'

describe('sanitizeSettings', () => {
  it('keeps a known instrument and falls back to piano otherwise', () => {
    expect(DEFAULT_SETTINGS.instrument).toBe('piano')
    expect(sanitizeSettings({ instrument: 'guitar' }).instrument).toBe('guitar')
    expect(sanitizeSettings({ instrument: 'kazoo' }).instrument).toBe('piano')
    expect(sanitizeSettings({ instrument: 3 }).instrument).toBe('piano')
  })

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
      keyNames: false,
      naming: 'english',
      theme: 'system',
      colorblind: true,
      reducedMotion: true,
      keySize: 'L',
      keyboardSpan: 1.5,
      vibration: false,
      volume: 0.35,
      instrument: 'organ',
    }
    expect(sanitizeSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings)
  })

  it('defaults to the dark theme, medium keys, latin names and 80% volume', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      keyNames: true,
      naming: 'latin',
      theme: 'dark',
      colorblind: false,
      reducedMotion: false,
      keySize: 'M',
      vibration: true,
      volume: 0.8,
    })
  })

  it('rejects unknown choices and clamps the volume', () => {
    expect(
      sanitizeSettings({ naming: 'german', theme: 'sepia', keySize: 'XL', vibration: 'on' }),
    ).toMatchObject({ naming: 'latin', theme: 'dark', keySize: 'M', vibration: true })
    expect(sanitizeSettings({ keyboardSpan: 3 }).keyboardSpan).toBe(1)
    expect(sanitizeSettings({ volume: 4 }).volume).toBe(1)
    expect(sanitizeSettings({ volume: -1 }).volume).toBe(0)
    expect(sanitizeSettings({ volume: 'loud' }).volume).toBe(0.8)
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
      series: { bestMs: 47000, played: 6, won: 4, lost: 2 },
    }
    expect(sanitizeProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress)
  })

  it('sanitizes hero progress field by field', () => {
    const { hero } = sanitizeProgress({ hero: { bestScore: 50, maxBpm: -3, hits: 'x' } })
    expect(hero).toEqual({ ...EMPTY_PROGRESS.hero, bestScore: 50 })
  })

  it('sanitizes series progress field by field', () => {
    const { series } = sanitizeProgress({ series: { bestMs: 52000, played: 'x', won: -1, lost: 2 } })
    expect(series).toEqual({ bestMs: 52000, played: 0, won: 0, lost: 2 })
  })

  it('defaults series progress to zeros', () => {
    expect(sanitizeProgress({}).series).toEqual({ bestMs: 0, played: 0, won: 0, lost: 0 })
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

describe('exportData and importData', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, clefs: ['bass'], theme: 'light', volume: 0.5 }
  const progress: Progress = {
    ...EMPTY_PROGRESS,
    notes: { 'bass:48': { attempts: 3, correct: 2, misses: 1, avgMs: 900 } },
    bestStreak: 7,
  }

  it('writes pretty JSON tagged with app, version and date', () => {
    const text = exportData(settings, progress)
    expect(text).toContain('\n  "app": "solfege"')
    const parsed = JSON.parse(text)
    expect(parsed).toMatchObject({ app: 'solfege', version: 1, settings, progress })
    expect(Number.isNaN(Date.parse(parsed.exportedAt))).toBe(false)
  })

  it('round-trips through importData', () => {
    expect(importData(exportData(settings, progress))).toEqual({ settings, progress })
  })

  it('rejects invalid JSON and other apps', () => {
    expect(importData('not json')).toBeNull()
    expect(importData('null')).toBeNull()
    expect(importData(JSON.stringify({ app: 'guitar', settings, progress }))).toBeNull()
  })

  it('sanitizes what it imports', () => {
    const result = importData(
      JSON.stringify({ app: 'solfege', settings: { theme: 'sepia', volume: 9 }, progress: { bestStreak: -3 } }),
    )
    expect(result?.settings).toMatchObject({ theme: 'dark', volume: 1 })
    expect(result?.progress).toEqual(EMPTY_PROGRESS)
  })

  it('falls back to defaults when sections are missing', () => {
    expect(importData(JSON.stringify({ app: 'solfege' }))).toEqual({
      settings: DEFAULT_SETTINGS,
      progress: EMPTY_PROGRESS,
    })
  })
})
