import { barLength, specBeats } from '../hero/meter'
import { DURATION_BEATS, type Duration, type NoteSpec, type Score } from '../hero/types'
import { spellInKey } from './keySignature'
import { spell, type Clef, type Note } from './notes'

type ExportableScore = Pick<Score, 'name' | 'clef' | 'key' | 'tempo' | 'timeSignature' | 'notes'> & {
  composer?: string
}

const DIVISIONS = 24
const EPSILON = 1e-6
const MAX_DOTS = 2
const TRIPLET_RATIO = 2 / 3
const DURATIONS_DESCENDING: Duration[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth']
const GREEDY_UNITS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25]
const TYPE_NAMES: Record<Duration, string> = {
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  sixteenth: '16th',
}
const CLEF_ELEMENTS: Record<Clef, string> = {
  treble: '<sign>G</sign><line>2</line>',
  bass: '<sign>F</sign><line>4</line>',
  alto: '<sign>C</sign><line>3</line>',
}

interface Written {
  duration: Duration
  dots: number
  tuplet: boolean
}

interface Piece {
  pitch: number | null
  beats: number
  written: Written
  endsMeasure: boolean
  tiedToNext: boolean
}

const near = (a: number, b: number) => Math.abs(a - b) < EPSILON

function plainValue(beats: number): Written | null {
  for (const duration of DURATIONS_DESCENDING) {
    for (let dots = 0; dots <= MAX_DOTS; dots++) {
      if (near(specBeats({ duration, dots }), beats)) return { duration, dots, tuplet: false }
    }
  }
  const triplet = DURATIONS_DESCENDING.find((duration) => near(DURATION_BEATS[duration] * TRIPLET_RATIO, beats))
  return triplet ? { duration: triplet, dots: 0, tuplet: true } : null
}

function nearestPlain(beats: number): Written {
  const duration = DURATIONS_DESCENDING.reduce((best, candidate) =>
    Math.abs(DURATION_BEATS[candidate] - beats) < Math.abs(DURATION_BEATS[best] - beats) ? candidate : best,
  )
  return { duration, dots: 0, tuplet: false }
}

function writtenOfSpec(spec: NoteSpec): Written {
  const dots = spec.dots ?? 0
  const base = specBeats({ duration: spec.duration, dots })
  if (spec.beats === undefined || near(spec.beats, base)) return { duration: spec.duration, dots, tuplet: false }
  if (near(spec.beats, base * TRIPLET_RATIO)) return { duration: spec.duration, dots, tuplet: true }
  return nearestPlain(spec.beats)
}

/** Written values covering `length` exactly when possible, splitting into tied pieces otherwise. */
function splitLength(length: number): { beats: number; written: Written }[] {
  const exact = plainValue(length)
  if (exact) return [{ beats: length, written: exact }]
  const parts: { beats: number; written: Written }[] = []
  let remaining = length
  for (const unit of GREEDY_UNITS) {
    while (remaining >= unit - EPSILON) {
      parts.push({ beats: unit, written: plainValue(unit) as Written })
      remaining -= unit
    }
  }
  return parts
}

function spellPitch(pitch: number, key: number): Note {
  return spellInKey(pitch, key) ?? spell(pitch, key < 0)
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pitchXml(pitch: number, key: number): string {
  const { letter, octave, alter } = spellPitch(pitch, key)
  const alteration = alter === 0 ? '' : `<alter>${alter}</alter>`
  return `<pitch><step>${letter}</step>${alteration}<octave>${octave}</octave></pitch>`
}

function noteXml(piece: Piece, key: number, tie: { start: boolean; stop: boolean }): string {
  const { written } = piece
  const ties = (tie.stop ? '<tie type="stop"/>' : '') + (tie.start ? '<tie type="start"/>' : '')
  const tied = (tie.stop ? '<tied type="stop"/>' : '') + (tie.start ? '<tied type="start"/>' : '')
  const modification = written.tuplet
    ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>'
    : ''
  return (
    '<note>' +
    (piece.pitch === null ? '<rest/>' : pitchXml(piece.pitch, key)) +
    `<duration>${Math.round(piece.beats * DIVISIONS)}</duration>` +
    ties +
    `<type>${TYPE_NAMES[written.duration]}</type>` +
    '<dot/>'.repeat(written.dots) +
    modification +
    (tied ? `<notations>${tied}</notations>` : '') +
    '</note>'
  )
}

function toPieces(notes: readonly NoteSpec[], bar: number): Piece[] {
  const pieces: Piece[] = []
  let position = 0

  function place(pitch: number | null, total: number, spec?: NoteSpec): void {
    const first = pieces.length
    let remaining = total
    while (remaining > EPSILON) {
      const length = Math.min(remaining, bar - position)
      const parts =
        spec && near(length, total) ? [{ beats: length, written: writtenOfSpec(spec) }] : splitLength(length)
      for (const part of parts) pieces.push({ pitch, ...part, endsMeasure: false, tiedToNext: false })
      position += length
      remaining -= length
      if (position >= bar - EPSILON) {
        const last = pieces[pieces.length - 1]
        if (last) last.endsMeasure = true
        position = 0
      }
    }
    if (pitch === null) return
    for (let index = first; index < pieces.length - 1; index++) (pieces[index] as Piece).tiedToNext = true
  }

  for (const spec of notes) place(spec.pitch, specBeats(spec), spec)
  if (position > EPSILON) place(null, bar - position)
  return pieces
}

function identification(composer: string | undefined): string {
  return composer ? `<identification><creator type="composer">${escapeXml(composer)}</creator></identification>` : ''
}

export function toMusicXml(score: ExportableScore): string {
  const bar = barLength(score.timeSignature)
  const pieces = toPieces(score.notes, bar)

  const measures: string[][] = [[]]
  pieces.forEach((piece, index) => {
    const stop = pieces[index - 1]?.tiedToNext ?? false
    ;(measures[measures.length - 1] as string[]).push(noteXml(piece, score.key, { start: piece.tiedToNext, stop }))
    if (piece.endsMeasure) measures.push([])
  })
  if ((measures[measures.length - 1] as string[]).length === 0) measures.pop()

  const attributes =
    `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${score.key}</fifths></key>` +
    `<time><beats>${score.timeSignature.beats}</beats><beat-type>${score.timeSignature.beatType}</beat-type></time>` +
    `<clef>${CLEF_ELEMENTS[score.clef]}</clef></attributes>`
  const tempo =
    '<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit>' +
    `<per-minute>${score.tempo}</per-minute></metronome></direction-type><sound tempo="${score.tempo}"/></direction>`

  const body = measures
    .map((content, index) => `<measure number="${index + 1}">${index === 0 ? attributes + tempo : ''}${content.join('')}</measure>`)
    .join('')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="4.0">' +
    `<work><work-title>${escapeXml(score.name)}</work-title></work>` +
    identification(score.composer) +
    '<part-list><score-part id="P1"><part-name>Mélodie</part-name></score-part></part-list>' +
    `<part id="P1">${body}</part></score-partwise>`
  )
}
