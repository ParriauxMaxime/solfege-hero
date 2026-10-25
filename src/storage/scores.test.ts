import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Score } from '../hero/types'
import { MELODIES } from '../music/melodies'
import { scoreId } from '../music/musicxml'
import { BUILTIN_SCORES, createScoreLibrary, type NewScore, type ScoreBackend } from './scores'

function memoryBackend(): ScoreBackend & { stored: Map<string, Score> } {
  const stored = new Map<string, Score>()
  return {
    stored,
    getAll: async () => [...stored.values()],
    put: async (score) => void stored.set(score.id, score),
    delete: async (id) => void stored.delete(id),
  }
}

const draft = (pitch = 60, overrides: Partial<NewScore> = {}): NewScore => {
  const melody = {
    clef: 'treble' as const,
    key: 0,
    timeSignature: { beats: 4, beatType: 4 },
    notes: [{ pitch, duration: 'whole' as const }],
  }
  return { ...melody, id: scoreId(melody), name: 'Ma pièce', tempo: 90, ...overrides }
}

describe('registerBuiltin', () => {
  it('makes a catalogue score listed, resolvable, unstored and undeletable', async () => {
    const backend = memoryBackend()
    const library = createScoreLibrary(backend, BUILTIN_SCORES)
    const registered = library.registerBuiltin(draft(64))
    expect(registered.source).toBe('builtin')
    expect(library.registerBuiltin(draft(64))).toBe(registered)
    expect(await library.get(registered.id)).toBe(registered)
    expect(backend.stored.size).toBe(0)
    await expect(library.remove(registered.id)).rejects.toThrow()
  })
})

describe('BUILTIN_SCORES', () => {
  it('turns every melody into a builtin score with a content id and its time signature', () => {
    expect(BUILTIN_SCORES).toHaveLength(MELODIES.length)
    BUILTIN_SCORES.forEach((score, index) => {
      expect(score).toMatchObject({ source: 'builtin', importedAt: 0 })
      expect(score.timeSignature).toEqual(MELODIES[index]?.timeSignature ?? { beats: 4, beatType: 4 })
      expect(score.id).toBe(scoreId(score))
    })
  })

  it('has unique ids', () => {
    expect(new Set(BUILTIN_SCORES.map((score) => score.id)).size).toBe(BUILTIN_SCORES.length)
  })
})

describe('createScoreLibrary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
  })
  afterEach(() => vi.useRealTimers())

  const create = () => {
    const backend = memoryBackend()
    return { backend, library: createScoreLibrary(backend, BUILTIN_SCORES) }
  }

  it('lists only the builtins at first', async () => {
    const { library } = create()
    expect(await library.list()).toEqual(BUILTIN_SCORES)
  })

  it('adds a score with its source and import time', async () => {
    const { library, backend } = create()
    const added = await library.add(draft(), 'file')
    expect(added).toMatchObject({ source: 'file', importedAt: 1000, name: 'Ma pièce', tempo: 90 })
    expect(backend.stored.get(added.id)).toEqual(added)
    expect(await library.get(added.id)).toEqual(added)
  })

  it('lists builtins first, then imports newest first', async () => {
    const { library } = create()
    const first = await library.add(draft(60), 'file')
    vi.setSystemTime(2000)
    const second = await library.add(draft(62), 'link')
    const ids = (await library.list()).map((score) => score.id)
    expect(ids.slice(0, BUILTIN_SCORES.length)).toEqual(BUILTIN_SCORES.map((score) => score.id))
    expect(ids.slice(BUILTIN_SCORES.length)).toEqual([second.id, first.id])
  })

  it('stores a recognised score with the omr source', async () => {
    const { library, backend } = create()
    const added = await library.add(draft(65), 'omr')
    expect(added.source).toBe('omr')
    expect(backend.stored.get(added.id)?.source).toBe('omr')
  })

  it('keeps the existing entry when the same score is added again', async () => {
    const { library, backend } = create()
    const first = await library.add(draft(), 'file')
    vi.setSystemTime(5000)
    const again = await library.add(draft(), 'link')
    expect(again).toEqual(first)
    expect(backend.stored.size).toBe(1)
  })

  it('does not store a duplicate of a builtin', async () => {
    const { library, backend } = create()
    const builtin = BUILTIN_SCORES[0] as Score
    const added = await library.add(builtin, 'link')
    expect(added).toEqual(builtin)
    expect(backend.stored.size).toBe(0)
  })

  it('returns null for an unknown id', async () => {
    expect(await create().library.get('nope')).toBeNull()
  })

  it('removes imported scores', async () => {
    const { library } = create()
    const added = await library.add(draft(), 'file')
    await library.remove(added.id)
    expect(await library.get(added.id)).toBeNull()
  })

  it('refuses to remove a builtin', async () => {
    const { library } = create()
    await expect(library.remove((BUILTIN_SCORES[0] as Score).id)).rejects.toThrow()
    expect(await library.list()).toEqual(BUILTIN_SCORES)
  })

  it('sanitizes what it stores', async () => {
    const { library } = create()
    const hostile = {
      ...draft(),
      id: 'forged',
      name: `  ${'x'.repeat(200)}  `,
      tempo: 9999,
      key: 42,
      clef: 'tenor',
      timeSignature: { beats: 999, beatType: 5 },
      notes: [
        { pitch: 60, duration: 'quarter', dots: 9, beats: -2 },
        { pitch: 200, duration: 'quarter' },
        { pitch: 61, duration: 'huge' },
        { pitch: null, duration: 'half', beats: 1 / 3 },
        'junk',
      ],
    } as unknown as NewScore
    const stored = await library.add(hostile, 'link')
    expect(stored.id).not.toBe('forged')
    expect(stored).toMatchObject({
      name: 'x'.repeat(80),
      tempo: 200,
      key: 7,
      clef: 'treble',
      timeSignature: { beats: 32, beatType: 4 },
    })
    expect(stored.notes).toEqual([
      { pitch: 60, duration: 'quarter', dots: 2 },
      { pitch: null, duration: 'half', beats: 1 / 3 },
    ])
    expect(stored.id).toBe(scoreId(stored))
  })

  it('defaults a blank name and rejects scores without notes', async () => {
    const { library } = create()
    expect((await library.add(draft(60, { name: '   ' }), 'file')).name).toBe('Sans titre')
    const silent = draft(60, { notes: [{ pitch: null, duration: 'whole' }] })
    await expect(library.add(silent, 'file')).rejects.toThrow('Aucune note trouvée')
    await expect(library.add(draft(60, { notes: [] }), 'file')).rejects.toThrow()
  })
})
