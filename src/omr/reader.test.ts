import { describe, expect, it } from 'vitest'
import {
  ACCIDENTAL_BAR_WIDTH,
  ACCIDENTAL_SHAPES,
  ACCIDENTAL_STEM_WIDTH,
  FLAGGED_REST_BALL,
  FLAGGED_REST_FLAG_SHIFT,
  FLAGGED_REST_STEMS,
  FLAT_PATH,
  FLAT_WIDTH,
  QUARTER_REST_PATH,
  REST_FLAG_PATH,
  REST_STROKE_WIDTH,
} from '../ui/glyphs'
import { recognize } from './recognize'
import { strokePath } from './rasterize'
import type { Shape } from './rasterize'
import { blankPage, drawBarLine, drawHollowHead, drawLedgerLines, drawLine, drawQuarter, drawStaff, fillEllipse, fillRect, stampGlyph } from './testing/draw'
import type { DrawnStaff } from './testing/draw'

const UNIT = 22
const voice: DrawnStaff = { left: 60, right: 1460, top: 120, unit: UNIT, thickness: 3 }
const piano: DrawnStaff = { left: 60, right: 1460, top: 300, unit: UNIT, thickness: 3 }

function systemPage() {
  const page = blankPage(1520, 520)
  drawStaff(page, voice)
  drawStaff(page, piano)
  fillRect(page, voice.left, voice.top, voice.left + 1, piano.top + 4 * UNIT)
  return page
}

function notesAt(page: ReturnType<typeof blankPage>, staff: DrawnStaff, steps: number[], firstX = 180) {
  steps.forEach((step, index) => {
    const x = firstX + index * 80
    drawLedgerLines(page, staff, x, step)
    drawQuarter(page, staff, x, step)
  })
}

describe('recognize on drawn staves', () => {
  it('reads pitches including ledger lines, and notes whole or half', () => {
    const page = systemPage()
    notesAt(page, voice, [0, 2, 4, 6, -2, 10])
    drawHollowHead(page, voice, 700, 5)
    drawLine(page, 700 + UNIT * 0.6, stepRowOf(5), 700 + UNIT * 0.6, stepRowOf(5) - UNIT * 3.2, 2)
    const result = recognize(page)
    expect(result.score.notes.map((note) => note.pitch)).toEqual([64, 67, 71, 74, 60, 81, 72])
    expect(result.score.notes.map((note) => note.duration)).toEqual(['quarter', 'quarter', 'quarter', 'quarter', 'quarter', 'quarter', 'half'])
  })

  it('keeps one staff of each system, ignoring the other staves, lyrics and chord symbols', () => {
    const page = systemPage()
    notesAt(page, voice, [0, 4, 8])
    notesAt(page, piano, [2, 2, 2, 2, 2])
    for (let i = 0; i < 12; i++) fillEllipse(page, 200 + i * 40, voice.top + 4 * UNIT + 70, 5, 6)
    for (let i = 0; i < 6; i++) drawLine(page, 180 + i * 100, voice.top - 70, 180 + i * 100, voice.top - 40, 3)
    expect(recognize(page).score.notes.map((note) => note.pitch)).toEqual([64, 71, 77])
    expect(recognize(page, { staffIndexInSystem: 1 }).score.notes.map((note) => note.pitch)).toEqual([67, 67, 67, 67, 67])
  })

  it('concatenates the chosen staff of every system in order', () => {
    const page = blankPage(1520, 1000)
    const second: DrawnStaff = { ...voice, top: 600 }
    for (const staff of [voice, second]) drawStaff(page, staff)
    notesAt(page, voice, [0, 2])
    notesAt(page, second, [4, 6, 8])
    const result = recognize(page)
    expect(result.systems).toBe(2)
    expect(result.score.notes.map((note) => note.pitch)).toEqual([64, 67, 71, 74, 77])
    expect(result.staves.map((staff) => staff.notes.length)).toEqual([2, 3])
  })

  it('flags measures that do not add up and lowers their confidence', () => {
    const page = systemPage()
    notesAt(page, voice, [0, 2, 4, 6, 4, 2], 160)
    drawBarLine(page, voice, 160 + 4 * 80 - 40)
    const result = recognize(page)
    expect(result.measures).toEqual([
      { startNote: 0, endNote: 4, uncertain: false },
      { startNote: 4, endNote: 6, uncertain: true },
    ])
    expect(result.confidence[0] as number).toBeGreaterThan(result.confidence[5] as number)
    expect(result.warnings.some((warning) => warning.includes('1 mesure'))).toBe(true)
  })

  it('says so, in French, when it finds no staff or no clef', () => {
    expect(recognize(blankPage(400, 300)).warnings[0]).toContain('Aucune portée')
    const page = systemPage()
    notesAt(page, voice, [0])
    const result = recognize(page)
    expect(result.warnings).toContain('Clé non reconnue : clé de sol supposée.')
    expect(result.warnings).toContain('Signature rythmique non reconnue : 4/4 supposé.')
  })

  it('reports boxes in source-image coordinates and progress by stage', () => {
    const page = systemPage()
    notesAt(page, voice, [0, 4])
    const stages: string[] = []
    const result = recognize(page, { onProgress: (stage) => stages.push(stage) })
    const [staff] = result.staves
    expect(staff?.box.y).toBeLessThan(voice.top)
    expect((staff?.box.y ?? 0) + (staff?.box.height ?? 0)).toBeGreaterThan(voice.top + 4 * UNIT)
    const first = staff?.notes[0]
    expect(first?.box.x).toBeGreaterThan(150)
    expect(first?.box.x).toBeLessThan(200)
    expect(new Set(stages)).toEqual(new Set(['preprocess', 'staves', 'symbols', 'music']))
    expect(result.timings.symbols).toBeGreaterThanOrEqual(0)
  })
})

describe('accidentals and rests', () => {
  const accidental = (kind: 'sharp' | 'flat' | 'natural'): Shape[] =>
    kind === 'flat'
      ? [strokePath(FLAT_PATH, FLAT_WIDTH)]
      : [
          ...ACCIDENTAL_SHAPES[kind].stems.map((d) => strokePath(d, ACCIDENTAL_STEM_WIDTH)),
          ...ACCIDENTAL_SHAPES[kind].bars.map((d) => strokePath(d, ACCIDENTAL_BAR_WIDTH)),
        ]

  it.each([
    ['sharp', 78],
    ['flat', 76],
    ['natural', 77],
  ] as const)('applies a %s to the note on its right and to its repeats in the measure', (kind, expected) => {
    const page = systemPage()
    const y = stepRowOf(8)
    stampGlyph(page, voice, accidental(kind), 220, y)
    drawQuarter(page, voice, 280, 8)
    drawQuarter(page, voice, 380, 8)
    drawBarLine(page, voice, 440)
    drawQuarter(page, voice, 500, 8)
    const result = recognize(page, { staffIndexInSystem: 0 })
    expect(result.score.notes.map((note) => note.pitch)).toEqual([expected, expected, 77])
  })

  it('reads the quarter, eighth and sixteenth rests, and whole and half rests by their place on the staff', () => {
    const page = systemPage()
    const middle = stepRowOf(4)
    stampGlyph(page, voice, [strokePath(QUARTER_REST_PATH, REST_STROKE_WIDTH)], 200, middle)
    stampGlyph(page, voice, flaggedRest(1), 320, middle)
    stampGlyph(page, voice, flaggedRest(2), 440, middle)
    fillRect(page, 540, stepRowOf(6), 540 + UNIT * 0.9, stepRowOf(6) + UNIT * 0.3)
    fillRect(page, 660, stepRowOf(4) - UNIT * 0.3, 660 + UNIT * 0.9, stepRowOf(4))
    const result = recognize(page)
    expect(result.score.notes).toEqual([
      { pitch: null, duration: 'quarter' },
      { pitch: null, duration: 'eighth' },
      { pitch: null, duration: 'sixteenth' },
      { pitch: null, duration: 'whole' },
      { pitch: null, duration: 'half' },
    ])
  })

  it('adds the dots after a head', () => {
    const page = systemPage()
    drawQuarter(page, voice, 200, 2)
    fillEllipse(page, 200 + UNIT * 1.2, stepRowOf(3), 3.5, 3.5)
    drawQuarter(page, voice, 320, 3)
    fillEllipse(page, 320 + UNIT * 1.2, stepRowOf(3), 3.5, 3.5)
    fillEllipse(page, 320 + UNIT * 1.7, stepRowOf(3), 3.5, 3.5)
    expect(recognize(page).score.notes.map((note) => note.dots ?? 0)).toEqual([1, 2])
  })
})

function flaggedRest(flags: 1 | 2): Shape[] {
  const shapes: Shape[] = [strokePath(FLAGGED_REST_STEMS[flags - 1] as string, REST_STROKE_WIDTH)]
  for (let flag = 0; flag < flags; flag++) {
    const dx = flag * FLAGGED_REST_FLAG_SHIFT.x
    const dy = flag * FLAGGED_REST_FLAG_SHIFT.y
    shapes.push(strokePath(REST_FLAG_PATH, REST_STROKE_WIDTH, dx, dy), { kind: 'disc', cx: FLAGGED_REST_BALL.cx + dx, cy: FLAGGED_REST_BALL.cy + dy, radius: FLAGGED_REST_BALL.r })
  }
  return shapes
}

function stepRowOf(step: number): number {
  return voice.top + (8 - step) * (UNIT / 2)
}
