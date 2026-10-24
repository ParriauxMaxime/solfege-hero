import { describe, expect, it } from 'vitest'
import { COLORBLIND_SQUARES, formatTenths, formatTime, shareText } from './share'

describe('formatTime', () => {
  it('shows minutes and zero-padded seconds', () => {
    expect(formatTime(47_000)).toBe('0:47')
    expect(formatTime(65_000)).toBe('1:05')
    expect(formatTime(600_000)).toBe('10:00')
  })

  it('floors to whole seconds', () => {
    expect(formatTime(59_999)).toBe('0:59')
    expect(formatTime(0)).toBe('0:00')
  })
})

describe('formatTenths', () => {
  it('shows minutes, seconds and one floored decimal', () => {
    expect(formatTenths(12_900)).toBe('0:12.9')
    expect(formatTenths(65_040)).toBe('1:05.0')
    expect(formatTenths(59_999)).toBe('0:59.9')
    expect(formatTenths(0)).toBe('0:00.0')
  })
})

describe('shareText', () => {
  const results = Array.from({ length: 20 }, (_, i) => i !== 3 && i !== 11)
  const base = {
    seed: 4821,
    results,
    totalMs: 47_300,
    penaltyMs: 10_000,
    url: 'https://example.com/#s=4821&c=sol&k=1&t=47',
  }

  it('writes the four lines exactly', () => {
    expect(shareText(base)).toBe(
      [
        'Solfège hero · Série #4821',
        '🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩',
        '⏱ 0:47.3 (+10 s) · 18/20',
        'Bats-moi : https://example.com/#s=4821&c=sol&k=1&t=47',
      ].join('\n'),
    )
  })

  it('omits the penalty when there is none', () => {
    const text = shareText({ ...base, results: results.map(() => true), penaltyMs: 0 })
    expect(text.split('\n')[2]).toBe('⏱ 0:47.3 · 20/20')
  })

  it('offers colour-blind friendly squares', () => {
    expect(COLORBLIND_SQUARES).toEqual({ ok: '🟦', bad: '🟧' })
    const text = shareText({ ...base, results: [true, false], squares: COLORBLIND_SQUARES })
    expect(text.split('\n')[1]).toBe('🟦🟧')
  })

  it('accepts custom squares', () => {
    const text = shareText({ ...base, results: [true, false], squares: { ok: 'O', bad: 'X' } })
    expect(text.split('\n')[1]).toBe('OX')
    expect(text.split('\n')[2]).toContain('1/2')
  })
})
