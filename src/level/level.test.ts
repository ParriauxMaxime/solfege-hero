import { describe, expect, it } from 'vitest'
import { HIGHEST_STEP, LOWEST_STEP } from '../music/notes'
import { capsFor, clampLevel, describeCaps, isUncapped, ledgerStepRange, pickCappedSignature, signatureWeight, tierName } from './level'

describe('clampLevel', () => {
  it('keeps an integer between 0 and 100', () => {
    expect([-5, 0, 42.6, 100, 250].map(clampLevel)).toEqual([0, 0, 43, 100, 100])
  })
})

describe('capsFor', () => {
  const table: [number, number, number, boolean][] = [
    [0, 0, 0, false],
    [19, 0, 0, false],
    [20, 1, 0, false],
    [29, 1, 0, false],
    [30, 1, 0, true],
    [34, 1, 0, true],
    [35, 1, 1, true],
    [39, 1, 1, true],
    [40, 2, 1, true],
    [49, 2, 1, true],
    [50, 2, 1, true],
    [59, 2, 1, true],
    [60, 4, 1, true],
    [69, 4, 1, true],
    [70, 4, 2, true],
    [79, 4, 2, true],
    [80, 6, 2, true],
    [99, 6, 2, true],
    [100, 7, 2, true],
  ]

  it.each(table)('level %i: %i fifths, %i ledger lines, inline accidentals %s', (level, maxFifths, ledgerLines, inline) => {
    expect(capsFor(level)).toMatchObject({ maxFifths, ledgerLines, inlineAccidentals: inline })
  })

  it('scales the hero difficulty, tempo and survival delay', () => {
    expect(capsFor(0)).toMatchObject({ heroMaxDifficulty: 1, heroTempoCap: 60, survivalDefaultDelay: 5 })
    expect(capsFor(25).heroMaxDifficulty).toBe(2)
    expect(capsFor(49)).toMatchObject({ heroMaxDifficulty: 2, survivalDefaultDelay: 5 })
    expect(capsFor(50)).toMatchObject({ heroMaxDifficulty: 3, survivalDefaultDelay: 3 })
    expect(capsFor(75).heroMaxDifficulty).toBe(4)
    expect(capsFor(100)).toMatchObject({ heroMaxDifficulty: 5, heroTempoCap: 200 })
  })
})

describe('isUncapped', () => {
  it('is true only at 100', () => {
    expect([99, 100].map(isUncapped)).toEqual([false, true])
  })
})

describe('tierName', () => {
  it('names the four tiers', () => {
    expect([0, 24, 25, 49, 50, 74, 75, 100].map(tierName)).toEqual([
      'Débutant',
      'Débutant',
      'Apprenti',
      'Apprenti',
      'Lecteur',
      'Lecteur',
      'Virtuose',
      'Virtuose',
    ])
  })
})

describe('describeCaps', () => {
  it('writes one French line', () => {
    expect(describeCaps(capsFor(45))).toBe('Armures jusqu’à 2♯/2♭ · 1 ligne supplémentaire · altérations')
    expect(describeCaps(capsFor(0))).toBe('Pas d’armure · pas de ligne supplémentaire · pas d’altérations')
    expect(describeCaps(capsFor(100))).toBe('Toutes les armures · 2 lignes supplémentaires · altérations')
    expect(describeCaps(capsFor(20))).toContain('Armures jusqu’à 1♯/1♭')
  })
})

describe('signatureWeight', () => {
  it('weighs the cap 3, one below 2, the rest 1, nothing beyond', () => {
    expect([4, -4, 3, -3, 2, 0].map((fifths) => signatureWeight(fifths, 4))).toEqual([3, 3, 2, 2, 1, 1])
    expect(signatureWeight(5, 4)).toBe(0)
    expect(signatureWeight(-5, 4)).toBe(0)
  })

  it('makes 0 the lightest when the cap is above 2', () => {
    const weights = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((fifths) => signatureWeight(fifths, 4))
    expect(Math.min(...weights)).toBe(1)
    expect(weights[4]).toBe(1)
  })
})

describe('pickCappedSignature', () => {
  it('is deterministic and one draw', () => {
    let calls = 0
    const random = () => {
      calls++
      return 0.5
    }
    const first = pickCappedSignature(3, random)
    expect(calls).toBe(1)
    expect(pickCappedSignature(3, () => 0.5)).toBe(first)
  })

  it('stays within the cap and reaches every key', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 700; i++) seen.add(pickCappedSignature(3, () => i / 700))
    expect(seen).toEqual(new Set([-3, -2, -1, 0, 1, 2, 3]))
  })

  it('draws the cap more often than 0', () => {
    const counts = new Map<number, number>()
    for (let i = 0; i < 1000; i++) {
      const fifths = pickCappedSignature(4, () => i / 1000)
      counts.set(fifths, (counts.get(fifths) ?? 0) + 1)
    }
    expect(counts.get(4)).toBeGreaterThan(counts.get(0) as number)
  })

  it('always gives 0 when the cap is 0, whatever is excluded', () => {
    expect(pickCappedSignature(0, () => 0.9)).toBe(0)
    expect(pickCappedSignature(0, () => 0.1, 0)).toBe(0)
  })

  it('never returns the excluded key when another exists', () => {
    for (let i = 0; i < 200; i++) expect(pickCappedSignature(2, () => i / 200, 1)).not.toBe(1)
  })
})

describe('ledgerStepRange', () => {
  it('opens the range by two steps per ledger line up to the full range', () => {
    expect(ledgerStepRange(0)).toEqual([-1, 9])
    expect(ledgerStepRange(1)).toEqual([-3, 11])
    expect(ledgerStepRange(2)).toEqual([LOWEST_STEP, HIGHEST_STEP])
    expect(ledgerStepRange(5)).toEqual([LOWEST_STEP, HIGHEST_STEP])
  })
})
