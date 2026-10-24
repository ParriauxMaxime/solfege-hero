import { describe, expect, it } from 'vitest'
import { challengeUrl, encodeChallenge, parseChallenge, type Challenge } from './challenge'

const challenge: Challenge = {
  config: { seed: 4821, clefs: ['treble', 'bass'], armures: true },
  timeS: 47,
}

describe('encodeChallenge', () => {
  it('writes seed, clef codes, armures and time', () => {
    expect(encodeChallenge(challenge)).toBe('s=4821&c=sol-fa&k=1&t=47')
  })

  it('omits the time when there is none', () => {
    expect(encodeChallenge({ ...challenge, timeS: null })).toBe('s=4821&c=sol-fa&k=1')
  })

  it('writes clefs in clef order with ut for alto and k=0 without armures', () => {
    const encoded = encodeChallenge({
      config: { seed: 1234, clefs: ['alto', 'treble'], armures: false },
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
      config: { seed: 1234, clefs: ['treble'], armures: false },
      timeS: null,
    })
  })
})

describe('challengeUrl', () => {
  it('appends the encoded challenge as a hash', () => {
    expect(challengeUrl('https://example.com/solfege/', challenge)).toBe(
      'https://example.com/solfege/#s=4821&c=sol-fa&k=1&t=47',
    )
  })
})
