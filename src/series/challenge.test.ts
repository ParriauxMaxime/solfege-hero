import { describe, expect, it } from 'vitest'
import {
  challengeTimeS,
  challengeUrl,
  challengeWon,
  encodeChallenge,
  parseChallenge,
  type Challenge,
} from './challenge'

const challenge: Challenge = {
  config: { kind: 'random', version: 1, seed: 4821, clefs: ['treble', 'bass'], armures: true, difficulty: 2 },
  timeS: 47,
}

describe('series difficulty', () => {
  const hard: Challenge = { ...challenge, config: { ...challenge.config, version: 2, difficulty: 4 } }

  it('writes d only when it differs from the default of 2', () => {
    expect(encodeChallenge(hard)).toBe('s=4821&c=sol-fa&k=1&v=2&d=4&t=47')
    expect(encodeChallenge(challenge)).not.toContain('d=')
  })

  it('round-trips every level', () => {
    for (const difficulty of [1, 2, 3, 4, 5] as const) {
      const level: Challenge = { ...hard, config: { ...hard.config, difficulty } }
      expect(parseChallenge(encodeChallenge(level))).toEqual(level)
    }
  })

  it('reads old links without d as difficulty 2', () => {
    expect(parseChallenge('s=4821&c=sol&k=1&v=2&t=47')?.config.difficulty).toBe(2)
  })

  it('falls back to 2 on an invalid d', () => {
    for (const d of ['0', '6', 'x', '', '2.5', '-1']) {
      expect(parseChallenge(`s=4821&c=sol&k=1&v=2&d=${d}`)?.config.difficulty).toBe(2)
    }
  })
})

describe('series version', () => {
  const v2: Challenge = { ...challenge, config: { ...challenge.config, version: 2 } }

  it('writes v=2 for the melody series and nothing for version 1', () => {
    expect(encodeChallenge(v2)).toBe('s=4821&c=sol-fa&k=1&v=2&t=47')
    expect(encodeChallenge(challenge)).not.toContain('v=')
  })

  it('round-trips version 2', () => {
    expect(parseChallenge(encodeChallenge(v2))).toEqual(v2)
  })

  it('writes and reads v=3', () => {
    const v3: Challenge = { ...challenge, config: { ...challenge.config, version: 3 } }
    expect(encodeChallenge(v3)).toBe('s=4821&c=sol-fa&k=1&v=3&t=47')
    expect(parseChallenge(encodeChallenge(v3))).toEqual(v3)
    expect(parseChallenge('s=4821&c=sol&k=1&v=2')?.config).toMatchObject({ version: 2 })
  })

  it('reads links without v as version 1', () => {
    expect(parseChallenge('s=4821&c=sol&k=1')?.config).toMatchObject({ version: 1 })
    expect(parseChallenge('s=4821&c=sol&k=1&v=9')?.config).toMatchObject({ version: 1 })
  })
})

describe('encodeChallenge', () => {
  it('writes seed, clef codes, armures and time', () => {
    expect(encodeChallenge(challenge)).toBe('s=4821&c=sol-fa&k=1&t=47')
  })

  it('omits the time when there is none', () => {
    expect(encodeChallenge({ ...challenge, timeS: null })).toBe('s=4821&c=sol-fa&k=1')
  })

  it('writes clefs in clef order with ut for alto and k=0 without armures', () => {
    const encoded = encodeChallenge({
      config: { kind: 'random', version: 1, seed: 1234, clefs: ['alto', 'treble'], armures: false, difficulty: 2 },
      timeS: null,
    })
    expect(encoded).toBe('s=1234&c=sol-ut&k=0')
  })
})

describe('parseChallenge', () => {
  it('round-trips an encoded challenge', () => {
    expect(parseChallenge(encodeChallenge(challenge))).toEqual(challenge)
    const noTime = { ...challenge, timeS: null }
    expect(parseChallenge(encodeChallenge(noTime))).toEqual(noTime)
  })

  it('accepts a leading #', () => {
    expect(parseChallenge(`#${encodeChallenge(challenge)}`)).toEqual(challenge)
  })

  it('drops unknown clef codes', () => {
    expect(parseChallenge('s=1234&c=sol-banjo-ut&k=0')?.config.clefs).toEqual(['treble', 'alto'])
  })

  it('rejects junk', () => {
    for (const hash of ['', '#', 'hello', 's=abc&c=sol', 's=-5&c=sol', 's=12.5&c=sol', 's=1234']) {
      expect(parseChallenge(hash)).toBeNull()
    }
  })

  it('rejects when no valid clef remains', () => {
    expect(parseChallenge('s=1234&c=banjo&k=1')).toBeNull()
    expect(parseChallenge('s=1234&c=&k=1')).toBeNull()
  })

  it('ignores a malformed time and treats unknown armures as off', () => {
    expect(parseChallenge('s=1234&c=sol&k=yes&t=fast')).toEqual({
      config: { kind: 'random', version: 1, seed: 1234, clefs: ['treble'], armures: false, difficulty: 2 },
      timeS: null,
    })
  })
})

describe('challenge time', () => {
  it('encodes one decimal and round-trips it', () => {
    const timed = { ...challenge, timeS: 12.9 }
    expect(encodeChallenge(timed)).toBe('s=4821&c=sol-fa&k=1&t=12.9')
    expect(parseChallenge(encodeChallenge(timed))).toEqual(timed)
  })

  it('rounds a measured time up to the next tenth', () => {
    expect(challengeTimeS(12_900)).toBe(12.9)
    expect(challengeTimeS(12_901)).toBe(13)
    expect(challengeTimeS(47_000)).toBe(47)
    expect(challengeTimeS(12_850)).toBe(12.9)
  })

  it('accepts whole and one-decimal values within range', () => {
    expect(parseChallenge('s=1234&c=sol&t=47')?.timeS).toBe(47)
    expect(parseChallenge('s=1234&c=sol&t=0.1')?.timeS).toBe(0.1)
    expect(parseChallenge('s=1234&c=sol&t=5999.9')?.timeS).toBe(5999.9)
  })

  it('drops out-of-range or malformed times but keeps the challenge', () => {
    for (const t of ['0', '0.0', '6000', '99999999999', '1.25', '-3', '1e3', 'NaN', '']) {
      expect(parseChallenge(`s=1234&c=sol&t=${t}`)).toEqual({
        config: { kind: 'random', version: 1, seed: 1234, clefs: ['treble'], armures: false, difficulty: 2 },
        timeS: null,
      })
    }
  })
})

describe('challengeWon', () => {
  it('wins when faster or tied, loses when slower', () => {
    expect(challengeWon(12_800, 12.9)).toBe(true)
    expect(challengeWon(12_900, 12.9)).toBe(true)
    expect(challengeWon(12_901, 12.9)).toBe(false)
  })
})

describe('challengeUrl', () => {
  it('appends the encoded challenge as a hash', () => {
    expect(challengeUrl('https://example.com/solfege/', challenge)).toBe(
      'https://example.com/solfege/#s=4821&c=sol-fa&k=1&t=47',
    )
  })
})
