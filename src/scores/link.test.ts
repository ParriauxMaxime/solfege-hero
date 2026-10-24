import { describe, expect, it } from 'vitest'
import type { Duration, NoteSpec } from '../hero/types'
import { scoreId } from '../music/musicxml'
import { decodeScoreBlob, encodeScoreBlob, MAX_LINK_BLOB, parseScoreHash, scoreLinkHash } from './link'

const TRIPLET = 2 / 3

const fixture = {
  name: 'Valse de test',
  clef: 'bass' as const,
  key: -3,
  tempo: 96,
  timeSignature: { beats: 3, beatType: 4 },
  notes: [
    { pitch: 60, duration: 'half', dots: 1 },
    { pitch: null, duration: 'quarter' },
    { pitch: 62, duration: 'eighth', beats: TRIPLET / 2 },
    { pitch: 64, duration: 'eighth', beats: TRIPLET / 2 },
    { pitch: 65, duration: 'eighth', beats: TRIPLET / 2 },
    { pitch: null, duration: 'half', dots: 2 },
    { pitch: 67, duration: 'sixteenth' },
  ] satisfies NoteSpec[],
}

function randomScore(count: number) {
  let seed = 7
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  const durations: Duration[] = ['quarter', 'eighth', 'sixteenth', 'half']
  const notes: NoteSpec[] = Array.from({ length: count }, () => ({
    pitch: next() < 0.1 ? null : 55 + Math.floor(next() * 30),
    duration: durations[Math.floor(next() * durations.length)] as Duration,
    ...(next() < 0.2 ? { dots: 1 } : {}),
  }))
  return { ...fixture, notes }
}

describe('score blob', () => {
  it('round-trips a score with dots, tuplets and rests', async () => {
    const decoded = await decodeScoreBlob(await encodeScoreBlob(fixture))
    expect(decoded).not.toBeNull()
    expect(decoded).toMatchObject({
      name: fixture.name,
      clef: 'bass',
      key: -3,
      tempo: 96,
      timeSignature: { beats: 3, beatType: 4 },
    })
    expect(decoded?.notes).toHaveLength(fixture.notes.length)
    decoded?.notes.forEach((spec, index) => {
      const original = fixture.notes[index] as NoteSpec
      expect(spec.pitch).toBe(original.pitch)
      expect(spec.duration).toBe(original.duration)
      expect(spec.dots).toBe(original.dots)
      if (original.beats === undefined) expect(spec.beats).toBeUndefined()
      else expect(spec.beats).toBeCloseTo(original.beats, 3)
    })
    expect(decoded?.id).toBe(scoreId(fixture))
  })

  it('uses only url-safe characters', async () => {
    expect(await encodeScoreBlob(fixture)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('returns null on junk', async () => {
    for (const junk of ['', 'not a blob!', 'AAAA', '////', '-'.repeat(50), 'a'.repeat(MAX_LINK_BLOB + 1)]) {
      expect(await decodeScoreBlob(junk)).toBeNull()
    }
  })

  it('rejects a well-formed blob holding an invalid score', async () => {
    const blob = await encodeScoreBlob({ ...fixture, notes: [{ pitch: null, duration: 'quarter' }] })
    expect(await decodeScoreBlob(blob)).toBeNull()
  })

  it('clamps the tempo and falls back to a default name', async () => {
    const decoded = await decodeScoreBlob(await encodeScoreBlob({ ...fixture, name: '  ', tempo: 400 }))
    expect(decoded).toMatchObject({ name: 'Sans titre', tempo: 200 })
  })

  it('keeps a 200-note score under the link limit', async () => {
    const blob = await encodeScoreBlob(randomScore(200))
    expect(blob.length).toBeLessThan(MAX_LINK_BLOB)
    expect((await decodeScoreBlob(blob))?.notes).toHaveLength(200)
  })
})

describe('score hash', () => {
  it('builds and parses the hash', () => {
    expect(scoreLinkHash('abc_-1')).toBe('score=abc_-1')
    expect(parseScoreHash('#score=abc_-1')).toEqual({ blob: 'abc_-1', timeS: null })
    expect(parseScoreHash('#score=abc&t=12.3')).toEqual({ blob: 'abc', timeS: 12.3 })
  })

  it('rejects other hashes', () => {
    expect(parseScoreHash('')).toBeNull()
    expect(parseScoreHash('#s=1234&c=sol')).toBeNull()
    expect(parseScoreHash('#score=a b')).toBeNull()
  })
})
