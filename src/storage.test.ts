import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  EMPTY_PROGRESS,
  exportData,
  importData,
  recordDaily,
  recordPlayDay,
  recordScoreBest,
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
      survivalDelayS: 3,
      seriesDifficulty: 4,
      strictOctave: true,
      keysMode: 'both',
      learnKeyMode: 'fixed',
      learnFixedFifths: -3,
      learnKeyChange: '20',
    }
    expect(sanitizeSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings)
  })

  it('sanitizes the Apprendre key settings', () => {
    expect(sanitizeSettings({ learnFixedFifths: 9, learnKeyMode: 'x', learnKeyChange: 5 })).toMatchObject({
      learnFixedFifths: 0,
      learnKeyMode: 'random',
      learnKeyChange: 'short',
    })
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

describe('play days', () => {
  it('records a day once per mode and keeps them sorted', () => {
    let progress = recordPlayDay(EMPTY_PROGRESS, 'hero', '20261024')
    progress = recordPlayDay(progress, 'hero', '20261022')
    expect(recordPlayDay(progress, 'hero', '20261024')).toBe(progress)
    expect(progress.playDays.hero).toEqual(['20261022', '20261024'])
    expect(progress.playDays.learn).toEqual([])
  })

  it('sanitizes malformed, duplicate and unordered days', () => {
    const { playDays } = sanitizeProgress({
      playDays: { learn: ['20261024', '20261023', '20261024', '20261340', 5, 'x'], series: 'nope' },
    })
    expect(playDays).toEqual({ learn: ['20261023', '20261024'], series: [], survival: [], hero: [], keys: [] })
  })

  it('keeps only the newest 400 days', () => {
    const keys = Array.from({ length: 450 }, (_, i) => new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10).replaceAll('-', ''))
    const { playDays } = sanitizeProgress({ playDays: { hero: keys } })
    expect(playDays.hero).toHaveLength(400)
    expect(playDays.hero.at(-1)).toBe(keys.at(-1))
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
      playDays: { learn: ['20261023', '20261024'], series: [], survival: ['20261024'], hero: [], keys: ['20261024'] },
      notes: { 'treble:C4': { attempts: 5, correct: 3, misses: 1.5, avgMs: 1200 } },
      pitches: { Do4: { attempts: 6, correct: 4 }, 'Sol#3': { attempts: 2, correct: 0 } },
      keys: { '4': { attempts: 6, correct: 5, misses: 0.5, avgMs: 2100 }, '-3': { attempts: 2, correct: 0, misses: 2, avgMs: 3000 } },
      keysBestTimed: 14,
      bestStreak: 12,
      totalAnswered: 80,
      bestTimed: 340,
      hero: { bestScore: 900, bestStreak: 30, maxBpm: 110, hits: 200, misses: 20, perfects: 90, challengesWon: 3, challengesLost: 1 },
      series: { bestMs: 47000, played: 6, won: 4, lost: 2, bestByScore: { abc: 31500 } },
      daily: {
        attempts: { '20261024': { totalMs: 52300, penaltyMs: 5000, results: [true, false, true] } },
        bestMs: 52300,
      },
      survival: { bestScore: 47, played: 9, challengesWon: 2, challengesLost: 1 },
    }
    expect(sanitizeProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress)
  })

  it('defaults the survival delay to 5 s and accepts only 3 or 5', () => {
    expect(DEFAULT_SETTINGS.survivalDelayS).toBe(5)
    expect(sanitizeSettings({ survivalDelayS: 3 }).survivalDelayS).toBe(3)
    expect(sanitizeSettings({ survivalDelayS: 4 }).survivalDelayS).toBe(5)
    expect(sanitizeSettings({ survivalDelayS: '3' }).survivalDelayS).toBe(5)
    expect(DEFAULT_SETTINGS.seriesDifficulty).toBe(2)
    expect(sanitizeSettings({ seriesDifficulty: 5 }).seriesDifficulty).toBe(5)
    expect(sanitizeSettings({ seriesDifficulty: 6 }).seriesDifficulty).toBe(2)
    expect(sanitizeSettings({ seriesDifficulty: '3' }).seriesDifficulty).toBe(2)
  })

  it('defaults strict octave to off and ignores non-boolean values', () => {
    expect(DEFAULT_SETTINGS.strictOctave).toBe(false)
    expect(sanitizeSettings({ strictOctave: true }).strictOctave).toBe(true)
    expect(sanitizeSettings({ strictOctave: 'yes' }).strictOctave).toBe(false)
  })

  it('sanitizes key signature stats entry by entry', () => {
    const good = { attempts: 3, correct: 2, misses: 1, avgMs: 900 }
    const { keys } = sanitizeProgress({
      keys: { '4': good, '-7': good, '8': good, '1.5': good, '01': good, x: good, '2': { attempts: 1, correct: 2, misses: 0, avgMs: 0 }, '3': 'x' },
    })
    expect(keys).toEqual({ '4': good, '-7': good })
    expect(sanitizeProgress({ keys: [1] }).keys).toEqual({})
    expect(sanitizeProgress({ bestStreak: 4 }).keys).toEqual({})
  })

  it('defaults the armures mode to major and accepts the three modes', () => {
    expect(DEFAULT_SETTINGS.keysMode).toBe('major')
    expect(sanitizeSettings({ keysMode: 'both' }).keysMode).toBe('both')
    expect(sanitizeSettings({ keysMode: 'minor' }).keysMode).toBe('minor')
    expect(sanitizeSettings({ keysMode: 'dorian' }).keysMode).toBe('major')
  })

  it('loads progress saved before exact pitch stats existed', () => {
    expect(sanitizeProgress({ bestStreak: 4 }).pitches).toEqual({})
  })

  it('sanitizes exact pitch stats entry by entry', () => {
    const { pitches } = sanitizeProgress({
      pitches: { Do4: { attempts: 3, correct: 2 }, Re4: { attempts: 1, correct: 2 }, Mi4: 'x', Fa4: { attempts: -1, correct: 0 } },
    })
    expect(pitches).toEqual({ Do4: { attempts: 3, correct: 2 } })
    expect(sanitizeProgress({ pitches: [1, 2] }).pitches).toEqual({})
  })

  it('loads progress saved before Survie existed', () => {
    expect(sanitizeProgress({ bestStreak: 4 }).survival).toEqual({
      bestScore: 0,
      played: 0,
      challengesWon: 0,
      challengesLost: 0,
    })
  })

  it('sanitizes survival progress field by field', () => {
    const { survival } = sanitizeProgress({ survival: { bestScore: 31, played: 'x', challengesWon: -2, challengesLost: 1 } })
    expect(survival).toEqual({ bestScore: 31, played: 0, challengesWon: 0, challengesLost: 1 })
  })

  it('sanitizes daily progress, dropping bad days and keeping the newest 400', () => {
    const good = { totalMs: 40000, penaltyMs: 0, results: [true, true] }
    const days = Array.from({ length: 450 }, (_, offset) => {
      const date = new Date(Date.UTC(2025, 0, 1 + offset))
      return date.toISOString().slice(0, 10).replaceAll('-', '')
    })
    const attempts = Object.fromEntries(days.map((day) => [day, good]))
    const { daily } = sanitizeProgress({
      daily: {
        attempts: {
          ...attempts,
          '20260230': good,
          nope: good,
          '20260101x': good,
          '20270101': { ...good, totalMs: -1 },
          '20270102': { ...good, results: ['yes'] },
          '20270103': { ...good, results: Array(101).fill(true) },
        },
        bestMs: 'fast',
      },
    })
    const keys = Object.keys(daily.attempts)
    expect(keys).toHaveLength(400)
    expect(keys[keys.length - 1]).toBe(days[449])
    expect(keys[0]).toBe(days[50])
    expect(daily.bestMs).toBe(0)
  })

  it('defaults daily progress to nothing', () => {
    expect(sanitizeProgress({}).daily).toEqual({ attempts: {}, bestMs: 0 })
    expect(sanitizeProgress({ daily: { attempts: [1] } }).daily.attempts).toEqual({})
  })

  it('sanitizes hero progress field by field', () => {
    const { hero } = sanitizeProgress({ hero: { bestScore: 50, maxBpm: -3, hits: 'x' } })
    expect(hero).toEqual({ ...EMPTY_PROGRESS.hero, bestScore: 50 })
  })

  it('defaults hero challenge counters for progress saved before hero challenges', () => {
    const { hero } = sanitizeProgress({ hero: { bestScore: 50, hits: 4 } })
    expect(hero).toMatchObject({ challengesWon: 0, challengesLost: 0, hits: 4 })
    expect(sanitizeProgress({ hero: { challengesWon: 3, challengesLost: -1 } }).hero).toMatchObject({
      challengesWon: 3,
      challengesLost: 0,
    })
  })

  it('sanitizes series progress field by field', () => {
    const { series } = sanitizeProgress({ series: { bestMs: 52000, played: 'x', won: -1, lost: 2 } })
    expect(series).toEqual({ bestMs: 52000, played: 0, won: 0, lost: 2, bestByScore: {} })
  })

  it('defaults series progress to zeros', () => {
    expect(sanitizeProgress({}).series).toEqual({
      bestMs: 0,
      played: 0,
      won: 0,
      lost: 0,
      bestByScore: {},
    })
  })

  it('keeps only valid per-score best times', () => {
    const { series } = sanitizeProgress({
      series: { bestByScore: { good: 20000, zero: 0, negative: -5, text: '9', nested: {} } },
    })
    expect(series.bestByScore).toEqual({ good: 20000 })
    expect(sanitizeProgress({ series: { bestByScore: [1, 2] } }).series.bestByScore).toEqual({})
  })

  it('records the fastest time per score', () => {
    const first = recordScoreBest(EMPTY_PROGRESS, 'abc', 30000)
    expect(first.series.bestByScore).toEqual({ abc: 30000 })
    expect(recordScoreBest(first, 'abc', 35000)).toBe(first)
    expect(recordScoreBest(first, 'abc', 30000)).toBe(first)
    const faster = recordScoreBest(first, 'abc', 28000)
    expect(faster.series.bestByScore.abc).toBe(28000)
    expect(recordScoreBest(faster, 'def', 50000).series.bestByScore).toEqual({ abc: 28000, def: 50000 })
    expect(EMPTY_PROGRESS.series.bestByScore).toEqual({})
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

describe('recordDaily', () => {
  const first = { totalMs: 50000, penaltyMs: 5000, results: [true, false] }

  it('stores the first attempt of a day and counts it', () => {
    const { progress, counted } = recordDaily(EMPTY_PROGRESS, '20261024', first)
    expect(counted).toBe(true)
    expect(progress.daily.attempts['20261024']).toEqual(first)
    expect(progress.daily.bestMs).toBe(50000)
    expect(EMPTY_PROGRESS.daily.attempts).toEqual({})
  })

  it('ignores later attempts on the same day', () => {
    const stored = recordDaily(EMPTY_PROGRESS, '20261024', first).progress
    const again = recordDaily(stored, '20261024', { totalMs: 30000, penaltyMs: 0, results: [true, true] })
    expect(again.counted).toBe(false)
    expect(again.progress).toBe(stored)
    expect(again.progress.daily.bestMs).toBe(50000)
  })

  it('keeps the best time across days', () => {
    let progress = recordDaily(EMPTY_PROGRESS, '20261024', first).progress
    progress = recordDaily(progress, '20261025', { ...first, totalMs: 40000 }).progress
    progress = recordDaily(progress, '20261026', { ...first, totalMs: 70000 }).progress
    expect(progress.daily.bestMs).toBe(40000)
    expect(Object.keys(progress.daily.attempts)).toEqual(['20261024', '20261025', '20261026'])
  })

  it('keeps only the last 400 days', () => {
    let progress = EMPTY_PROGRESS
    for (let offset = 0; offset < 402; offset++) {
      const day = new Date(Date.UTC(2025, 0, 1 + offset)).toISOString().slice(0, 10).replaceAll('-', '')
      progress = recordDaily(progress, day, first).progress
    }
    const keys = Object.keys(progress.daily.attempts)
    expect(keys).toHaveLength(400)
    expect(keys[0]).toBe('20250103')
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
