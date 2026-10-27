import { hashText } from '../hash'
import { t } from '../i18n'
import { barLength, specBeats } from '../hero/meter'
import {
  COMMON_TIME,
  DURATION_BEATS,
  type Duration,
  type Melody,
  type NoteSpec,
  type Score,
  type TimeSignature,
} from '../hero/types'
import { LETTERS, midi, pitchesInRange, type Clef } from './notes'
import { unzip } from './unzip'
import { child, children, parseXml, textOf, type XmlElement } from './xml'

export interface ImportResult {
  score: Omit<Score, 'source' | 'importedAt'>
  warnings: string[]
}

const DEFAULT_TEMPO = 80
const MIN_TEMPO = 40
const MAX_TEMPO = 200
const MAX_DOTS = 2
const MAX_FIFTHS = 7
const EPSILON = 1e-6

const DURATIONS_DESCENDING: Duration[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth']
const REST_UNITS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25]
const TYPE_DURATION: Record<string, Duration> = {
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  '16th': 'sixteenth',
}
const BEAT_UNIT_QUARTERS: Record<string, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
}

type Length = Pick<NoteSpec, 'duration' | 'dots' | 'beats'>

export function scoreId(
  melody: Pick<Melody, 'clef' | 'key' | 'notes'> & { timeSignature?: TimeSignature },
): string {
  const time = melody.timeSignature ?? COMMON_TIME
  const notes = melody.notes
    .map((spec) =>
      [spec.pitch ?? 'r', spec.duration, spec.dots ?? 0, spec.beats?.toFixed(4) ?? ''].join(':'),
    )
    .join(',')
  return hashText(`${melody.clef}|${melody.key}|${time.beats}/${time.beatType}|${notes}`).toString(36)
}

/** The exact length as a written value when one fits, else the closest written value plus the exact beats. */
function writeLength(beats: number): Length {
  for (const duration of DURATIONS_DESCENDING) {
    for (let dots = 0; dots <= MAX_DOTS; dots++) {
      if (Math.abs(specBeats({ duration, dots }) - beats) < EPSILON) {
        return dots > 0 ? { duration, dots } : { duration }
      }
    }
  }
  const duration = DURATIONS_DESCENDING.find((d) => DURATION_BEATS[d] <= beats + EPSILON)
  return { duration: duration ?? 'sixteenth', beats }
}

function restsFor(beats: number): NoteSpec[] {
  const rests: NoteSpec[] = []
  let remaining = beats
  for (const unit of REST_UNITS) {
    while (remaining >= unit - EPSILON) {
      rests.push({ pitch: null, ...writeLength(unit) })
      remaining -= unit
    }
  }
  return rests
}

function readDocument(xml: string): XmlElement {
  let root: XmlElement
  try {
    root = parseXml(xml)
  } catch {
    throw new Error(t('library.errors.unreadableXml'))
  }
  if (root.name === 'score-timewise') throw new Error(t('library.errors.partwiseExpected'))
  if (root.name !== 'score-partwise') throw new Error(t('library.errors.unreadableXml'))
  return root
}

function readPitch(note: XmlElement): number | null {
  const pitch = child(note, 'pitch')
  if (!pitch) return null
  const letter = LETTERS.find((candidate) => candidate === textOf(pitch, 'step'))
  const octave = Number.parseInt(textOf(pitch, 'octave') ?? '', 10)
  const alter = Math.round(Number(textOf(pitch, 'alter') ?? 0))
  if (!letter || Number.isNaN(octave) || Number.isNaN(alter)) return null
  return midi({ letter, octave, alter: 0 }) + alter
}

interface NoteLength {
  played: number
  written: Length
}

function readLength(note: XmlElement, divisions: number, wholeMeasureRest: boolean): NoteLength | null {
  const duration = TYPE_DURATION[textOf(note, 'type') ?? '']
  const dots = children(note, 'dot').length
  if (duration && dots <= MAX_DOTS && !wholeMeasureRest) {
    const base = specBeats({ duration, dots })
    const dotted = dots > 0 ? { dots } : {}
    const modification = child(note, 'time-modification')
    const actual = Number(modification && textOf(modification, 'actual-notes'))
    const normal = Number(modification && textOf(modification, 'normal-notes'))
    if (actual > 0 && normal > 0) {
      const played = (base * normal) / actual
      return { played, written: { duration, ...dotted, beats: played } }
    }
    return { played: base, written: { duration, ...dotted } }
  }
  const played = Number(textOf(note, 'duration')) / divisions
  return played > 0 ? { played, written: writeLength(played) } : null
}

function readClef(element: XmlElement): { clef: Clef; supported: boolean } {
  const sign = textOf(element, 'sign')
  if (sign === 'G') return { clef: 'treble', supported: true }
  if (sign === 'F') return { clef: 'bass', supported: true }
  if (sign === 'C' && textOf(element, 'line') === '3') return { clef: 'alto', supported: true }
  return { clef: 'treble', supported: false }
}

function readTempo(element: XmlElement): number | null {
  const sound = element.name === 'sound' ? element : child(element, 'sound')
  const soundTempo = Number.parseFloat(sound?.attributes.tempo ?? '')
  if (soundTempo > 0) return soundTempo

  const metronome = children(element, 'direction-type')
    .map((directionType) => child(directionType, 'metronome'))
    .find((candidate) => candidate !== undefined)
  if (!metronome) return null
  const perMinute = Number.parseFloat(textOf(metronome, 'per-minute') ?? '')
  const unit = BEAT_UNIT_QUARTERS[textOf(metronome, 'beat-unit') ?? 'quarter']
  const dotFactor = child(metronome, 'beat-unit-dot') ? 1.5 : 1
  return perMinute > 0 && unit ? perMinute * unit * dotFactor : null
}

function readTitle(root: XmlElement): string {
  return textOf(root, 'work/work-title') || textOf(root, 'movement-title') || 'Sans titre'
}

export function parseMusicXml(xml: string): ImportResult {
  const root = readDocument(xml)
  const part = child(root, 'part')
  if (!part) throw new Error(t('library.errors.noNotes'))

  const warnings: string[] = []
  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message)
  }

  const notes: NoteSpec[] = []
  let divisions = 1
  let clef: Clef | null = null
  let key: number | null = null
  let time: TimeSignature | null = null
  let tempo: number | null = null
  let tieOpen = false

  const measures = children(part, 'measure')
  measures.forEach((measure, measureIndex) => {
    const measureStart = notes.length
    let written = 0
    let voice = '1'

    for (const element of measure.children) {
      if (element.name === 'attributes') {
        const attributeDivisions = Number(textOf(element, 'divisions'))
        if (attributeDivisions > 0) divisions = attributeDivisions

        const clefElement = child(element, 'clef')
        if (clefElement) {
          const read = readClef(clefElement)
          if (clef === null) {
            clef = read.clef
            if (!read.supported) warn(t('library.warnings.unsupportedClef'))
          } else if (read.clef !== clef) {
            warn(t('library.warnings.clefChange'))
          }
        }

        const fifths = Number.parseInt(textOf(element, 'key/fifths') ?? '', 10)
        if (!Number.isNaN(fifths)) {
          const read = Math.max(-MAX_FIFTHS, Math.min(MAX_FIFTHS, fifths))
          if (key === null) key = read
          else if (read !== key) warn(t('library.warnings.keyChange'))
        }

        const beats = Number.parseInt(textOf(element, 'time/beats') ?? '', 10)
        const beatType = Number.parseInt(textOf(element, 'time/beat-type') ?? '', 10)
        if (child(element, 'time')) {
          if (beats > 0 && beatType > 0) {
            if (time === null) time = { beats, beatType }
            else if (time.beats !== beats || time.beatType !== beatType) {
              warn(t('library.warnings.timeChange'))
            }
          } else if (time === null) {
            warn(t('library.warnings.unsupportedTime'))
          }
        }
      } else if (element.name === 'direction' || element.name === 'sound') {
        tempo ??= readTempo(element)
      } else if (element.name === 'forward') {
        voice = textOf(element, 'voice') ?? voice
        const length = Number(textOf(element, 'duration')) / divisions
        if (voice === '1' && length > 0) {
          written += length
          notes.push({ pitch: null, ...writeLength(length) })
          tieOpen = false
        }
      } else if (element.name === 'note') {
        voice = textOf(element, 'voice') ?? '1'
        if (voice !== '1' || child(element, 'grace')) continue

        const pitch = readPitch(element)
        const previous = notes[notes.length - 1]
        if (child(element, 'chord')) {
          if (previous?.pitch != null && pitch !== null) previous.pitch = Math.max(previous.pitch, pitch)
          continue
        }

        const wholeMeasureRest = child(element, 'rest')?.attributes.measure === 'yes'
        const length = readLength(element, divisions, wholeMeasureRest)
        if (!length) {
          warn(t('library.warnings.noDuration'))
          continue
        }
        written += length.played

        const ties = children(element, 'tie').map((tie) => tie.attributes.type)
        if (tieOpen && ties.includes('stop') && previous && pitch !== null && previous.pitch === pitch) {
          notes[notes.length - 1] = { pitch, ...writeLength(specBeats(previous) + length.played) }
        } else {
          notes.push({ pitch, ...length.written })
        }
        tieOpen = pitch !== null && ties.includes('start')
      }
    }

    const label = measure.attributes.number ?? String(measureIndex + 1)
    const missing = barLength(time ?? COMMON_TIME) - written
    if (missing > EPSILON && !tieOpen) {
      const isPickup = measureIndex === 0
      const isLast = measureIndex === measures.length - 1
      if (isPickup) notes.splice(measureStart, 0, ...restsFor(missing))
      else notes.push(...restsFor(missing))
      if (!isPickup && !isLast) warn(t('library.warnings.shortMeasure', { label }))
    } else if (missing < -EPSILON) {
      warn(t('library.warnings.longMeasure', { label }))
    }
  })

  const pitched = notes.filter((spec) => spec.pitch !== null)
  if (pitched.length === 0) throw new Error(t('library.errors.noNotes'))

  if (clef === null) warn(t('library.warnings.noClef'))
  if (tempo === null) warn(t('library.warnings.noTempo', { tempo: DEFAULT_TEMPO }))
  if (time === null) warn(t('library.warnings.noTime'))

  const finalClef: Clef = clef ?? 'treble'
  const inRange = new Set(pitchesInRange(finalClef, true))
  const outside = pitched.filter((spec) => !inRange.has(spec.pitch as number)).length
  if (outside > 0) warn(t('library.warnings.outOfRange', { count: outside }))

  const melody = {
    clef: finalClef,
    key: key ?? 0,
    timeSignature: time ?? COMMON_TIME,
    notes,
  }
  const score = {
    ...melody,
    id: scoreId(melody),
    name: readTitle(root).trim() || 'Sans titre',
    tempo: Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(tempo ?? DEFAULT_TEMPO))),
  }
  return { score, warnings }
}

const ZIP_MAGIC = [0x50, 0x4b]

function containerRootfile(files: Map<string, Uint8Array>): string | undefined {
  const container = files.get('META-INF/container.xml')
  if (!container) return undefined
  try {
    const rootfiles = child(parseXml(new TextDecoder().decode(container)), 'rootfiles')
    return rootfiles && child(rootfiles, 'rootfile')?.attributes['full-path']
  } catch {
    return undefined
  }
}

async function readArchive(data: ArrayBuffer): Promise<string> {
  const files = await unzip(data)
  const declared = containerRootfile(files)
  const fallback = [...files.keys()].find(
    (name) => !name.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(name),
  )
  const content = files.get(declared ?? '') ?? files.get(fallback ?? '')
  if (!content) throw new Error(t('library.errors.noScoreInArchive'))
  return new TextDecoder().decode(content)
}

export async function importScoreFile(fileName: string, data: ArrayBuffer): Promise<ImportResult> {
  const bytes = new Uint8Array(data)
  const zipped = ZIP_MAGIC.every((byte, index) => bytes[index] === byte) || /\.mxl$/i.test(fileName)
  return parseMusicXml(zipped ? await readArchive(data) : new TextDecoder().decode(bytes))
}
