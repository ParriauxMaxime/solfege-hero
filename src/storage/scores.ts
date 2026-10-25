import { COMMON_TIME, DURATION_BEATS, type Duration, type NoteSpec, type Score, type TimeSignature } from '../hero/types'
import { MELODIES } from '../music/melodies'
import { scoreId } from '../music/musicxml'
import { CLEFS, type Clef } from '../music/notes'

export interface ScoreBackend {
  getAll(): Promise<Score[]>
  put(score: Score): Promise<void>
  delete(id: string): Promise<void>
}

export type NewScore = Omit<Score, 'source' | 'importedAt'>

export interface ScoreLibrary {
  /** Built-ins first, then imported scores, newest first. */
  list(): Promise<Score[]>
  get(id: string): Promise<Score | null>
  /** Keeps the existing entry when the same content is already stored. */
  add(score: NewScore, source: 'file' | 'link'): Promise<Score>
  remove(id: string): Promise<void>
  /** Makes a catalogue score resolvable by id for this session; it is never stored. */
  registerBuiltin(score: NewScore): Score
}

const MAX_NAME_LENGTH = 80
const MAX_NOTES = 5000
const MAX_NOTE_BEATS = 32
const MIN_TEMPO = 40
const MAX_TEMPO = 200
const MAX_FIFTHS = 7
const MAX_DOTS = 2
const MAX_BEATS_PER_BAR = 32
const BEAT_TYPES = [1, 2, 4, 8, 16, 32]

const isDuration = (value: unknown): value is Duration =>
  typeof value === 'string' && Object.hasOwn(DURATION_BEATS, value)

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function sanitizeSpec(raw: unknown): NoteSpec | null {
  const spec = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  if (!isDuration(spec.duration)) return null
  const { pitch, dots, beats } = spec
  if (pitch !== null && !(Number.isInteger(pitch) && (pitch as number) >= 0 && (pitch as number) <= 127)) {
    return null
  }

  const sanitized: NoteSpec = { pitch: pitch as number | null, duration: spec.duration }
  if (typeof dots === 'number' && dots > 0) sanitized.dots = clampInteger(dots, 0, MAX_DOTS, 0)
  if (typeof beats === 'number' && Number.isFinite(beats) && beats > 0 && beats <= MAX_NOTE_BEATS) {
    sanitized.beats = beats
  }
  return sanitized
}

function sanitizeTime(raw: unknown): TimeSignature {
  const time = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const beatType = BEAT_TYPES.find((candidate) => candidate === time.beatType) ?? 4
  return { beats: clampInteger(time.beats, 1, MAX_BEATS_PER_BAR, 4), beatType }
}

function sanitizeScore(raw: NewScore): NewScore {
  const clef: Clef = CLEFS.find((candidate) => candidate === raw.clef) ?? 'treble'
  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .slice(0, MAX_NOTES)
    .map(sanitizeSpec)
    .filter((spec): spec is NoteSpec => spec !== null)
  if (!notes.some((spec) => spec.pitch !== null)) throw new Error('Aucune note trouvée')

  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_NAME_LENGTH) : ''
  const melody = {
    clef,
    key: clampInteger(raw.key, -MAX_FIFTHS, MAX_FIFTHS, 0),
    timeSignature: sanitizeTime(raw.timeSignature),
    notes,
  }
  return {
    ...melody,
    id: scoreId(melody),
    name: name || 'Sans titre',
    tempo: clampInteger(raw.tempo, MIN_TEMPO, MAX_TEMPO, 80),
  }
}

export function createScoreLibrary(backend: ScoreBackend, initialBuiltins: Score[]): ScoreLibrary {
  const builtins = [...initialBuiltins]
  const isBuiltin = (id: string) => builtins.some((score) => score.id === id)

  async function list(): Promise<Score[]> {
    const stored = (await backend.getAll())
      .filter((score) => !isBuiltin(score.id))
      .sort((a, b) => b.importedAt - a.importedAt)
    return [...builtins, ...stored]
  }

  return {
    list,
    async get(id) {
      return (await list()).find((score) => score.id === id) ?? null
    },
    async add(raw, source) {
      const clean = sanitizeScore(raw)
      const existing = (await list()).find((score) => score.id === clean.id)
      if (existing) return existing
      const score: Score = { ...clean, source, importedAt: Date.now() }
      await backend.put(score)
      return score
    },
    async remove(id) {
      if (isBuiltin(id)) throw new Error('Les partitions intégrées ne peuvent pas être supprimées')
      await backend.delete(id)
    },
    registerBuiltin(raw) {
      const clean = sanitizeScore(raw)
      const existing = builtins.find((score) => score.id === clean.id)
      if (existing) return existing
      const score: Score = { ...clean, source: 'builtin', importedAt: 0 }
      builtins.push(score)
      return score
    },
  }
}

export const BUILTIN_SCORES: Score[] = MELODIES.map((melody) => ({
  ...melody,
  timeSignature: melody.timeSignature ?? COMMON_TIME,
  id: scoreId(melody),
  source: 'builtin',
  importedAt: 0,
}))

function request<T>(idbRequest: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    idbRequest.onsuccess = () => resolve(idbRequest.result)
    idbRequest.onerror = () => reject(idbRequest.error)
  })
}

export function indexedDbBackend(dbName = 'solfege', storeName = 'scores'): ScoreBackend {
  let opened: Promise<IDBDatabase> | null = null

  function open(): Promise<IDBDatabase> {
    opened ??= new Promise((resolve, reject) => {
      const opening = indexedDB.open(dbName, 1)
      opening.onupgradeneeded = () => opening.result.createObjectStore(storeName, { keyPath: 'id' })
      opening.onsuccess = () => resolve(opening.result)
      opening.onerror = () => reject(opening.error)
    })
    return opened
  }

  async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await open()).transaction(storeName, mode).objectStore(storeName)
  }

  return {
    async getAll() {
      return request((await store('readonly')).getAll() as IDBRequest<Score[]>)
    },
    async put(score) {
      await request((await store('readwrite')).put(score))
    },
    async delete(id) {
      await request((await store('readwrite')).delete(id))
    },
  }
}
