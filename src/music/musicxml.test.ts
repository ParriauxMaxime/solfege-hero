import { describe, expect, it } from 'vitest'
import { setLanguage } from '../i18n'
import { makeZip } from '../../scripts/zip.mjs'
import { specBeats } from '../hero/meter'
import type { NoteSpec } from '../hero/types'
import bassFixture from './fixtures/bass.musicxml?raw'
import waltzFixture from './fixtures/waltz.musicxml?raw'
import { importScoreFile, parseMusicXml, scoreId } from './musicxml'

const fixtures: Record<string, string> = {
  'waltz.musicxml': waltzFixture,
  'bass.musicxml': bassFixture,
}
const fixture = (name: string) => fixtures[name] as string

const ATTRIBUTES =
  '<attributes><divisions>4</divisions><key><fifths>0</fifths></key>' +
  '<time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>'

const note = (step: string, octave: number, type: string, extra = '') =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><type>${type}</type>${extra}</note>`
const rest = (type: string) => `<note><rest/><type>${type}</type></note>`

function score(measures: string[], attributes = ATTRIBUTES, header = ''): string {
  const body = measures
    .map((content, index) => `<measure number="${index + 1}">${index === 0 ? attributes : ''}${content}</measure>`)
    .join('')
  return `<score-partwise>${header}<part-list/><part id="P1">${body}</part></score-partwise>`
}

const FULL_BAR = [note('C', 4, 'whole')]

describe('Petite valse fixture', () => {
  const { score: waltz, warnings } = parseMusicXml(fixture('waltz.musicxml'))

  it('reads the metadata', () => {
    expect(waltz).toMatchObject({
      name: 'Petite valse',
      clef: 'treble',
      key: 1,
      tempo: 90,
      timeSignature: { beats: 3, beatType: 4 },
    })
    expect(waltz.id).toBe(scoreId(waltz))
  })

  it('reads every note of voice one, with dots, ties, chord, rest, triplet and no grace', () => {
    expect(waltz.notes).toEqual([
      { pitch: 67, duration: 'half', dots: 1 },
      { pitch: 69, duration: 'quarter', dots: 1 },
      { pitch: 71, duration: 'eighth' },
      { pitch: 74, duration: 'quarter' },
      { pitch: 71, duration: 'quarter' },
      { pitch: 72, duration: 'quarter' },
      { pitch: 74, duration: 'half' },
      { pitch: 76, duration: 'quarter' },
      { pitch: null, duration: 'quarter' },
      { pitch: 69, duration: 'eighth', beats: 1 / 3 },
      { pitch: 71, duration: 'eighth', beats: 1 / 3 },
      { pitch: 72, duration: 'eighth', beats: 1 / 3 },
      { pitch: 74, duration: 'half' },
      { pitch: 78, duration: 'half', dots: 1 },
      { pitch: 79, duration: 'quarter' },
      { pitch: 78, duration: 'quarter' },
      { pitch: 76, duration: 'quarter' },
      { pitch: 67, duration: 'half', dots: 1 },
    ])
  })

  it('keeps time exact: eight bars of three beats', () => {
    const total = waltz.notes.reduce((sum, spec) => sum + specBeats(spec), 0)
    expect(total).toBeCloseTo(24, 9)
  })

  it('needs no warnings', () => {
    expect(warnings).toEqual([])
  })
})

describe('Berceuse grave fixture', () => {
  const { score: bass, warnings } = parseMusicXml(fixture('bass.musicxml'))

  it('reads a bass clef 6/8 score with a dotted-quarter metronome', () => {
    expect(bass).toMatchObject({
      name: 'Berceuse grave',
      clef: 'bass',
      key: -2,
      tempo: 75,
      timeSignature: { beats: 6, beatType: 8 },
    })
    expect(warnings).toEqual([])
  })

  it('reads divisions of two and a whole-measure rest', () => {
    expect(bass.notes).toEqual([
      { pitch: 43, duration: 'quarter', dots: 1 },
      { pitch: 46, duration: 'eighth' },
      { pitch: 50, duration: 'eighth' },
      { pitch: 48, duration: 'eighth' },
      { pitch: 46, duration: 'quarter', dots: 1 },
      { pitch: 51, duration: 'quarter', dots: 1 },
      { pitch: null, duration: 'half', dots: 1 },
      { pitch: 43, duration: 'half', dots: 1 },
    ])
  })
})

describe('parseMusicXml errors', () => {
  it('rejects unreadable files', () => {
    expect(() => parseMusicXml('not xml')).toThrow('Fichier MusicXML illisible')
    expect(() => parseMusicXml('<html/>')).toThrow('Fichier MusicXML illisible')
  })

  it('rejects timewise scores', () => {
    expect(() => parseMusicXml('<score-timewise/>')).toThrow('Format partwise attendu')
  })

  it('rejects scores without notes', () => {
    expect(() => parseMusicXml('<score-partwise><part-list/></score-partwise>')).toThrow(
      'Aucune note trouvée',
    )
    expect(() => parseMusicXml(score([rest('whole')]))).toThrow('Aucune note trouvée')
  })
})

describe('parseMusicXml rules', () => {
  it('defaults the title and warns about a missing tempo', () => {
    const result = parseMusicXml(score(FULL_BAR))
    expect(result.score.name).toBe('Sans titre')
    expect(result.score.tempo).toBe(80)
    expect(result.warnings).toContain('Tempo absent : 80 par défaut')
  })

  it('prefers the work title over the movement title', () => {
    const header = '<work><work-title>Oeuvre</work-title></work><movement-title>Mouvement</movement-title>'
    expect(parseMusicXml(score(FULL_BAR, ATTRIBUTES, header)).score.name).toBe('Oeuvre')
  })

  it('reads the tempo from a sound element or a metronome and clamps it', () => {
    const sound = (tempo: number) => `<direction><sound tempo="${tempo}"/></direction>${FULL_BAR[0]}`
    expect(parseMusicXml(score([sound(120.4)])).score.tempo).toBe(120)
    expect(parseMusicXml(score([sound(300)])).score.tempo).toBe(200)
    expect(parseMusicXml(score([sound(10)])).score.tempo).toBe(40)
    const half = `<direction><direction-type><words>Allegro</words></direction-type><direction-type><metronome><beat-unit>half</beat-unit><per-minute>60</per-minute></metronome></direction-type></direction>${FULL_BAR[0]}`
    expect(parseMusicXml(score([half])).score.tempo).toBe(120)
  })

  it('maps clefs and warns about unsupported ones', () => {
    const withClef = (sign: string, line: number) =>
      ATTRIBUTES.replace(/<clef>.*<\/clef>/, `<clef><sign>${sign}</sign><line>${line}</line></clef>`)
    expect(parseMusicXml(score(FULL_BAR, withClef('F', 4))).score.clef).toBe('bass')
    expect(parseMusicXml(score(FULL_BAR, withClef('C', 3))).score.clef).toBe('alto')
    const tenor = parseMusicXml(score(FULL_BAR, withClef('C', 4)))
    expect(tenor.score.clef).toBe('treble')
    expect(tenor.warnings).toContain('Clef non gérée : clef de sol utilisée')
  })

  it('ignores later clef, key and time changes with a warning', () => {
    const change =
      '<attributes><clef><sign>F</sign><line>4</line></clef><key><fifths>3</fifths></key>' +
      '<time><beats>3</beats><beat-type>4</beat-type></time></attributes>'
    const result = parseMusicXml(score([note('C', 4, 'whole'), change + note('C', 4, 'whole')]))
    expect(result.score).toMatchObject({ clef: 'treble', key: 0, timeSignature: { beats: 4, beatType: 4 } })
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Changement de clef ignoré',
        'Changement d’armure ignoré',
        'Changement de mesure ignoré',
      ]),
    )
  })

  it('skips voices other than one and handles backup', () => {
    const second = '<note><pitch><step>E</step><octave>4</octave></pitch><voice>2</voice><type>whole</type></note>'
    const voiceOne = note('C', 5, 'whole', '<voice>1</voice>')
    const { score: parsed, warnings } = parseMusicXml(
      score([`${voiceOne}<backup><duration>16</duration></backup>${second}`]),
    )
    expect(parsed.notes).toEqual([{ pitch: 72, duration: 'whole' }])
    expect(warnings).not.toContain('Mesure 1 trop longue')
  })

  it('turns a forward in voice one into a rest', () => {
    const { score: parsed } = parseMusicXml(
      score([`${note('C', 5, 'half')}<forward><duration>8</duration></forward>`]),
    )
    expect(parsed.notes).toEqual([
      { pitch: 72, duration: 'half' },
      { pitch: null, duration: 'half' },
    ])
  })

  it('keeps the highest pitch of a chord', () => {
    const chord = `${note('C', 4, 'whole')}${note('G', 4, 'whole', '<chord/>')}${note('E', 4, 'whole', '<chord/>')}`
    const { score: parsed } = parseMusicXml(score([chord]))
    expect(parsed.notes).toEqual([{ pitch: 67, duration: 'whole' }])
  })

  it('writes double dots and falls back on duration without type', () => {
    const doubleDot = note('C', 4, 'half', '<dot/><dot/>') + note('C', 4, 'eighth')
    expect(parseMusicXml(score([doubleDot])).score.notes[0]).toEqual({
      pitch: 60,
      duration: 'half',
      dots: 2,
    })
    const untyped = '<note><pitch><step>D</step><octave>4</octave></pitch><duration>3</duration></note>'
    const { score: parsed } = parseMusicXml(score([untyped + note('C', 4, '16th') + note('C', 4, 'half', '<dot/>')]))
    expect(parsed.notes[0]).toEqual({ pitch: 62, duration: 'eighth', dots: 1 })
  })

  it('merges ties into one note, with exact beats when no single value fits', () => {
    const tied = (type: string, step = 'C') =>
      note(step, 4, type === 'start' ? 'quarter' : 'whole', `<tie type="${type}"/>`)
    const first = note('C', 4, 'half', '<dot/>') + tied('start')
    const result = parseMusicXml(score([first, tied('stop')]))
    expect(result.score.notes).toEqual([
      { pitch: 60, duration: 'half', dots: 1 },
      { pitch: 60, duration: 'whole', beats: 5 },
    ])
    expect(result.warnings).not.toContain('Mesure 2 trop longue')
  })

  it('does not merge a tie stop onto a different pitch', () => {
    const start = note('C', 4, 'whole', '<tie type="start"/>')
    const stop = note('D', 4, 'whole', '<tie type="stop"/>')
    expect(parseMusicXml(score([start, stop])).score.notes).toHaveLength(2)
  })

  it('completes a pickup measure with leading rests', () => {
    const { score: parsed } = parseMusicXml(score([note('G', 4, 'quarter'), FULL_BAR[0] as string]))
    expect(parsed.notes.map((spec) => spec.pitch)).toEqual([null, 67, 60])
    expect(specBeats(parsed.notes[0] as NoteSpec)).toBe(3)
  })

  it('completes short inner measures and warns', () => {
    const { score: parsed, warnings } = parseMusicXml(
      score([FULL_BAR[0] as string, note('C', 4, 'half'), FULL_BAR[0] as string]),
    )
    expect(parsed.notes.map((spec) => spec.pitch)).toEqual([60, 60, null, 60])
    expect(warnings).toContain('Mesure 2 incomplète : complétée par un silence')
  })

  it('warns about notes the staff cannot show', () => {
    const { warnings } = parseMusicXml(score([note('C', 8, 'whole')]))
    expect(warnings).toContain('1 note hors de la portée affichable')
  })

  it('warns in English when the language is English', () => {
    setLanguage('en')
    try {
      const { warnings } = parseMusicXml(score([note('C', 8, 'whole')]))
      expect(warnings).toContain('1 note outside the displayable staff')
      expect(warnings).toContain('No tempo: defaulting to 80')
      expect(() => parseMusicXml('<nope/>')).toThrow('Unreadable MusicXML file')
    } finally {
      setLanguage('fr')
    }
  })
})

describe('scoreId', () => {
  const melody = {
    clef: 'treble' as const,
    key: 0,
    notes: [{ pitch: 60, duration: 'quarter' as const }],
  }

  it('is a short stable base-36 hash', () => {
    expect(scoreId(melody)).toMatch(/^[0-9a-z]{1,7}$/)
    expect(scoreId({ ...melody })).toBe(scoreId(melody))
  })

  it('treats 4/4 as the default time signature', () => {
    expect(scoreId({ ...melody, timeSignature: { beats: 4, beatType: 4 } })).toBe(scoreId(melody))
  })

  it('changes with any musical content', () => {
    const id = scoreId(melody)
    expect(scoreId({ ...melody, clef: 'bass' })).not.toBe(id)
    expect(scoreId({ ...melody, key: 1 })).not.toBe(id)
    expect(scoreId({ ...melody, timeSignature: { beats: 3, beatType: 4 } })).not.toBe(id)
    expect(scoreId({ ...melody, notes: [{ pitch: 61, duration: 'quarter' }] })).not.toBe(id)
    expect(scoreId({ ...melody, notes: [{ pitch: 60, duration: 'quarter', dots: 1 }] })).not.toBe(id)
  })
})

describe('importScoreFile', () => {
  const encoder = new TextEncoder()
  const toBuffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

  it('reads plain MusicXML text', async () => {
    const data = toBuffer(encoder.encode(fixture('waltz.musicxml')))
    const result = await importScoreFile('valse.musicxml', data)
    expect(result.score.name).toBe('Petite valse')
  })

  it('reads a compressed .mxl through its container', async () => {
    const container =
      '<container><rootfiles><rootfile full-path="partition/valse.xml"/></rootfiles></container>'
    const zip = await makeZip([
      { name: 'META-INF/container.xml', data: encoder.encode(container) },
      { name: 'other.xml', data: encoder.encode('<nope/>') },
      { name: 'partition/valse.xml', data: encoder.encode(fixture('waltz.musicxml')) },
    ])
    const result = await importScoreFile('valse.mxl', toBuffer(zip))
    expect(result.score.name).toBe('Petite valse')
  })

  it('falls back to the first score file outside META-INF', async () => {
    const zip = await makeZip([
      { name: 'META-INF/container.xml', data: encoder.encode('<container/>') },
      { name: 'score.musicxml', data: encoder.encode(fixture('bass.musicxml')), deflate: false },
    ])
    const result = await importScoreFile('berceuse.mxl', toBuffer(zip))
    expect(result.score.clef).toBe('bass')
  })

  it('sniffs the zip magic whatever the file name', async () => {
    const zip = await makeZip([{ name: 'a.xml', data: encoder.encode(fixture('waltz.musicxml')) }])
    const result = await importScoreFile('mystere.xml', toBuffer(zip))
    expect(result.score.name).toBe('Petite valse')
  })

  it('reports an archive without a score', async () => {
    const zip = await makeZip([{ name: 'notes.txt', data: encoder.encode('hello') }])
    await expect(importScoreFile('vide.mxl', toBuffer(zip))).rejects.toThrow('Aucune partition')
  })

  it('reports unreadable files in French', async () => {
    await expect(importScoreFile('x.mxl', toBuffer(encoder.encode('junk')))).rejects.toThrow('Archive .mxl illisible')
    await expect(importScoreFile('x.xml', toBuffer(encoder.encode('junk')))).rejects.toThrow('Fichier MusicXML illisible')
  })
})
