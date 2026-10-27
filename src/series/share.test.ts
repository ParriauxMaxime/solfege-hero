import { describe, expect, it } from 'vitest'
import { challengeTimeS } from './challenge'
import { COLORBLIND_SQUARES, formatTenths, formatTenthsUp, formatTime, shareText } from './share'

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

describe('formatTenthsUp', () => {
  it('rounds up to the tenth like the challenge link', () => {
    expect(formatTenthsUp(12_901)).toBe('0:13.0')
    expect(formatTenthsUp(47_340)).toBe('0:47.4')
    expect(formatTenthsUp(47_300)).toBe('0:47.3')
    expect(formatTenthsUp(47_340)).toBe(formatTenths(challengeTimeS(47_340) * 1000))
  })
})

describe('shareText', () => {
  const results = Array.from({ length: 20 }, (_, i) => i !== 3 && i !== 11)
  const base = {
    title: 'Série #4821',
    results,
    totalMs: 47_300,
    penaltyMs: 10_000,
  }

  it('writes the four lines exactly, time first and no link', () => {
    expect(shareText(base)).toBe(
      [
        'Solfège hero · Série #4821 · ⏱ 0:47.3',
        '🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩',
        '18/20 du premier coup (+10 s)',
        'Bats-moi !',
      ].join('\n'),
    )
  })

  it('shows the same rounded-up time as the challenge link', () => {
    const text = shareText({ ...base, totalMs: 47_301, penaltyMs: 0 })
    expect(text.split('\n')[0]).toBe('Solfège hero · Série #4821 · ⏱ 0:47.4')
    expect(challengeTimeS(47_301)).toBe(47.4)
  })

  it('omits the penalty when there is none', () => {
    const text = shareText({ ...base, results: results.map(() => true), penaltyMs: 0 })
    expect(text.split('\n')[2]).toBe('20/20 du premier coup')
  })

  it('offers colour-blind friendly squares', () => {
    expect(COLORBLIND_SQUARES).toEqual({ ok: '🟦', bad: '🟧' })
    const text = shareText({ ...base, results: [true, false], squares: COLORBLIND_SQUARES })
    expect(text.split('\n')[1]).toBe('🟦🟧')
  })

  it('writes the daily challenge title and call to action', () => {
    const text = shareText({
      ...base,
      title: 'Défi du jour 24/10/2026',
      callToAction: 'Joue aussi !',
    })
    const lines = text.split('\n')
    expect(lines[0]).toBe('Solfège hero · Défi du jour 24/10/2026 · ⏱ 0:47.3')
    expect(lines[3]).toBe('Joue aussi !')
  })

  it('accepts custom squares', () => {
    const text = shareText({ ...base, results: [true, false], squares: { ok: 'O', bad: 'X' } })
    expect(text.split('\n')[1]).toBe('OX')
    expect(text.split('\n')[2]).toContain('1/2')
  })
})
