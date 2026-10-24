import { scoreId } from '../music/musicxml'
import { CLEFS, type Clef } from '../music/notes'
import type { Duration, NoteSpec, Score } from '../hero/types'

export const MAX_LINK_BLOB = 6000

type EncodableScore = Pick<Score, 'name' | 'clef' | 'key' | 'tempo' | 'timeSignature' | 'notes'>
type DecodedScore = Omit<Score, 'source' | 'importedAt'>

const DURATION_CODES: readonly Duration[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth']
const REST_CODE = -1
const MAX_NAME_LENGTH = 80
const MAX_NOTES = 2000
const MAX_FIFTHS = 7
const MIN_TEMPO = 40
const MAX_TEMPO = 200
const MAX_DOTS = 2
const MAX_BEATS_PER_NOTE = 16
const MAX_TIME_BEATS = 32
const BEAT_TYPES = [1, 2, 4, 8, 16, 32]
const BEATS_PRECISION = 1e4
const MAX_MIDI = 127
const DEFAULT_NAME = 'Sans titre'

type CompactNote = [pitch: number, duration: number, dots?: number, beats?: number]

interface Compact {
  n: string
  c: number
  k: number
  t: number
  m: [number, number]
  p: CompactNote[]
}

function compactNote(spec: NoteSpec): CompactNote {
  const pitch = spec.pitch ?? REST_CODE
  const duration = DURATION_CODES.indexOf(spec.duration)
  const dots = spec.dots ?? 0
  if (spec.beats !== undefined) return [pitch, duration, dots, Math.round(spec.beats * BEATS_PRECISION) / BEATS_PRECISION]
  return dots > 0 ? [pitch, duration, dots] : [pitch, duration]
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const source = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(source).arrayBuffer())
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(blob: string): Uint8Array {
  const binary = atob(blob.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export async function encodeScoreBlob(score: EncodableScore): Promise<string> {
  const compact: Compact = {
    n: score.name,
    c: CLEFS.indexOf(score.clef),
    k: score.key,
    t: score.tempo,
    m: [score.timeSignature.beats, score.timeSignature.beatType],
    p: score.notes.map(compactNote),
  }
  const json = new TextEncoder().encode(JSON.stringify(compact))
  return toBase64Url(await transform(json, new CompressionStream('deflate-raw')))
}

function integerIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null
}

function readNote(raw: unknown): NoteSpec | null {
  if (!Array.isArray(raw)) return null
  const [pitchCode, durationCode, dotCount = 0, beats] = raw as unknown[]
  const pitch = pitchCode === REST_CODE ? null : integerIn(pitchCode, 0, MAX_MIDI)
  const duration = DURATION_CODES[integerIn(durationCode, 0, DURATION_CODES.length - 1) ?? -1]
  const dots = integerIn(dotCount, 0, MAX_DOTS)
  if ((pitch === null && pitchCode !== REST_CODE) || !duration || dots === null) return null
  if (beats !== undefined && !(typeof beats === 'number' && beats > 0 && beats <= MAX_BEATS_PER_NOTE)) return null
  return { pitch, duration, ...(dots > 0 ? { dots } : {}), ...(beats !== undefined ? { beats } : {}) }
}

function sanitize(value: unknown): DecodedScore | null {
  if (typeof value !== 'object' || value === null) return null
  const compact = value as Partial<Record<keyof Compact, unknown>>
  const clef = CLEFS[integerIn(compact.c, 0, CLEFS.length - 1) ?? -1] as Clef | undefined
  const key = integerIn(compact.k, -MAX_FIFTHS, MAX_FIFTHS)
  const tempo = typeof compact.t === 'number' && Number.isFinite(compact.t) ? compact.t : null
  const [beats, beatType] = Array.isArray(compact.m) ? (compact.m as unknown[]) : []
  const timeBeats = integerIn(beats, 1, MAX_TIME_BEATS)
  const timeBeatType = typeof beatType === 'number' && BEAT_TYPES.includes(beatType) ? beatType : null
  if (!clef || key === null || tempo === null || timeBeats === null || timeBeatType === null) return null
  if (!Array.isArray(compact.p) || compact.p.length === 0 || compact.p.length > MAX_NOTES) return null

  const notes = compact.p.map(readNote)
  if (notes.some((note) => note === null)) return null
  const specs = notes as NoteSpec[]
  if (specs.every((spec) => spec.pitch === null)) return null

  const melody = { clef, key, timeSignature: { beats: timeBeats, beatType: timeBeatType }, notes: specs }
  const name = typeof compact.n === 'string' ? compact.n.trim().slice(0, MAX_NAME_LENGTH) : ''
  return {
    ...melody,
    id: scoreId(melody),
    name: name || DEFAULT_NAME,
    tempo: Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(tempo))),
  }
}

export async function decodeScoreBlob(blob: string): Promise<DecodedScore | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(blob) || blob.length > MAX_LINK_BLOB) return null
  try {
    const json = await transform(fromBase64Url(blob), new DecompressionStream('deflate-raw'))
    return sanitize(JSON.parse(new TextDecoder().decode(json)))
  } catch {
    return null
  }
}

export function scoreLinkHash(blob: string): string {
  return `score=${blob}`
}

export function parseScoreHash(hash: string): { blob: string; timeS: number | null } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const blob = params.get('score')
  if (!blob || !/^[A-Za-z0-9_-]+$/.test(blob)) return null
  const timeS = Number.parseFloat(params.get('t') ?? '')
  return { blob, timeS: timeS > 0 ? timeS : null }
}
