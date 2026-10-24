import { describe, expect, it } from 'vitest'
import { barClicks, barLength, specBeats } from './meter'

describe('specBeats', () => {
  it('uses the written value', () => {
    expect(specBeats({ duration: 'quarter' })).toBe(1)
    expect(specBeats({ duration: 'sixteenth' })).toBe(0.25)
  })

  it('lengthens by single and double dots', () => {
    expect(specBeats({ duration: 'half', dots: 1 })).toBe(3)
    expect(specBeats({ duration: 'quarter', dots: 2 })).toBe(1.75)
    expect(specBeats({ duration: 'eighth', dots: 0 })).toBe(0.5)
  })

  it('prefers the exact played length', () => {
    expect(specBeats({ duration: 'eighth', beats: 1 / 3 })).toBe(1 / 3)
    expect(specBeats({ duration: 'half', dots: 1, beats: 5 })).toBe(5)
  })
})

describe('barLength', () => {
  it('counts quarter notes', () => {
    expect(barLength({ beats: 4, beatType: 4 })).toBe(4)
    expect(barLength({ beats: 3, beatType: 4 })).toBe(3)
    expect(barLength({ beats: 6, beatType: 8 })).toBe(3)
    expect(barLength({ beats: 2, beatType: 2 })).toBe(4)
  })
})

describe('barClicks', () => {
  it('clicks every beat of simple meters with an accent on the first', () => {
    expect(barClicks({ beats: 3, beatType: 4 })).toEqual([
      { offset: 0, accent: true },
      { offset: 1, accent: false },
      { offset: 2, accent: false },
    ])
    expect(barClicks({ beats: 4, beatType: 4 })).toHaveLength(4)
    expect(barClicks({ beats: 2, beatType: 4 }).map((click) => click.offset)).toEqual([0, 1])
  })

  it('clicks two dotted quarters in 6/8', () => {
    expect(barClicks({ beats: 6, beatType: 8 })).toEqual([
      { offset: 0, accent: true },
      { offset: 1.5, accent: false },
    ])
  })

  it('groups other compound eighth meters by three', () => {
    expect(barClicks({ beats: 9, beatType: 8 }).map((click) => click.offset)).toEqual([0, 1.5, 3])
  })

  it('clicks every eighth when eighths do not group by three', () => {
    expect(barClicks({ beats: 5, beatType: 8 }).map((click) => click.offset)).toEqual([
      0, 0.5, 1, 1.5, 2,
    ])
  })
})
