import { describe, expect, it } from 'vitest'
import {
  BAR_OFFSET,
  CURRENT_NOTE_RATIO,
  NOTE_LEFT_EXTENT,
  NOTE_SPACING,
  anchorAt,
  changeWidth,
  firstNoteX,
  headerWidth,
  isUnderHeader,
  layoutTimeline,
  noteState,
  scrollOffset,
  timelineScale,
  type ClefAndKey,
} from './timelineLayout'

const treble = (fifths = 0): ClefAndKey => ({ clef: 'treble', fifths })
const run = (count: number, item: ClefAndKey = treble()): ClefAndKey[] => Array.from({ length: count }, () => item)

describe('layoutTimeline', () => {
  it('is empty without notes', () => {
    expect(layoutTimeline([])).toEqual({ noteX: [], bars: [], changes: [] })
  })

  it('puts the first note after the header of its key', () => {
    expect(layoutTimeline([treble(3)]).noteX).toEqual([firstNoteX(3)])
    expect(firstNoteX(3)).toBeGreaterThan(firstNoteX(0))
    expect(headerWidth(7)).toBeGreaterThan(headerWidth(3))
  })

  it('spaces notes evenly without a change', () => {
    const { noteX } = layoutTimeline(run(6))
    for (let i = 1; i < noteX.length; i++) expect((noteX[i] as number) - (noteX[i - 1] as number)).toBe(NOTE_SPACING)
  })

  it('draws a bar line every four notes, between the notes', () => {
    const { noteX, bars } = layoutTimeline(run(10))
    expect(bars.map((bar) => bar.index)).toEqual([4, 8])
    for (const bar of bars) {
      expect(bar.x).toBe((noteX[bar.index - 1] as number) + BAR_OFFSET)
      expect(bar.x).toBeLessThan(noteX[bar.index] as number)
    }
  })

  it('shows no bar line before the fifth note', () => {
    expect(layoutTimeline(run(4)).bars).toEqual([])
  })

  it('reserves width and a bar line at a change of key, and restarts the bar count', () => {
    const items = [...run(4), ...run(6, treble(2))]
    const { noteX, bars, changes } = layoutTimeline(items)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ index: 4, clefChanged: false, keyChanged: true, previousFifths: 0 })
    expect((noteX[4] as number) - (noteX[3] as number)).toBe(NOTE_SPACING + changeWidth(treble(0), treble(2)))
    expect(bars.map((bar) => bar.index)).toEqual([4, 8])
  })

  it('forces a bar line mid-measure when the clef changes', () => {
    const items = [...run(2), ...run(5, { clef: 'bass', fifths: 0 })]
    const { bars, changes } = layoutTimeline(items)
    expect(changes[0]).toMatchObject({ index: 2, clefChanged: true, keyChanged: false })
    expect(bars.map((bar) => bar.index)).toEqual([2, 6])
  })

  it('starts the change block after its bar line and ends it before the note', () => {
    const { noteX, changes } = layoutTimeline([treble(), { clef: 'alto', fifths: -1 }])
    const block = changes[0]
    expect(block).toBeDefined()
    expect(block?.startX).toBeGreaterThan(block?.barX as number)
    expect((block?.startX as number) + (block?.width as number)).toBeLessThan(noteX[1] as number)
  })

  it('lays out a prefix the same way as the whole series', () => {
    const items = [...run(4), ...run(5, treble(4)), ...run(5, { clef: 'bass', fifths: -2 })]
    const whole = layoutTimeline(items)
    for (let count = 1; count <= items.length; count++) {
      expect(layoutTimeline(items.slice(0, count)).noteX).toEqual(whole.noteX.slice(0, count))
    }
  })
})

describe('changeWidth', () => {
  it('is zero when nothing changes', () => {
    expect(changeWidth(treble(2), treble(2))).toBe(0)
  })

  it('costs more for a clef and a key than for either alone', () => {
    const both = changeWidth(treble(0), { clef: 'bass', fifths: 3 })
    expect(both).toBeGreaterThan(changeWidth(treble(0), { clef: 'bass', fifths: 0 }))
    expect(both).toBeGreaterThan(changeWidth(treble(0), treble(3)))
  })

  it('keeps room for the naturals cancelling a signature', () => {
    expect(changeWidth(treble(3), treble(0))).toBeGreaterThan(changeWidth(treble(1), treble(0)))
  })

  it('redraws a signature that stays when the clef moves', () => {
    expect(changeWidth(treble(2), { clef: 'bass', fifths: 2 })).toBeGreaterThan(changeWidth(treble(0), { clef: 'bass', fifths: 0 }))
  })
})

describe('scrollOffset', () => {
  const visible = 330
  const { noteX } = layoutTimeline(run(30))
  const offsets = noteX.map((_, index) => scrollOffset(noteX, index, visible))

  it('stays at zero while the next note fits', () => {
    expect(offsets[0]).toBe(0)
    const lastResting = offsets.findIndex((offset) => offset > 0) - 1
    expect(lastResting).toBeGreaterThan(2)
    expect((noteX[lastResting] as number) + NOTE_SPACING).toBeLessThanOrEqual(visible - 20)
  })

  it('puts the current note at 68 % of the visible width once it scrolls', () => {
    const first = offsets.findIndex((offset) => offset > 0)
    for (let i = first; i < noteX.length; i++) {
      expect((noteX[i] as number) - (offsets[i] as number)).toBeCloseTo(CURRENT_NOTE_RATIO * visible)
    }
  })

  it('never moves back', () => {
    for (let i = 1; i < offsets.length; i++) expect(offsets[i] as number).toBeGreaterThanOrEqual(offsets[i - 1] as number)
  })

  it('never hides the current note beyond the right edge', () => {
    for (let i = 0; i < noteX.length; i++) expect((noteX[i] as number) - (offsets[i] as number)).toBeLessThan(visible)
  })

  it('does not scroll when everything fits', () => {
    expect(scrollOffset(noteX, 3, 2000)).toBe(0)
  })

  it('scrolls earlier on a narrower view', () => {
    expect(scrollOffset(noteX, 6, 250)).toBeGreaterThan(scrollOffset(noteX, 6, 400))
  })

  it('stays monotonic across clef and key changes', () => {
    const items = [...run(4), ...run(5, treble(4)), ...run(5, { clef: 'bass', fifths: -2 }), ...run(10, { clef: 'alto', fifths: 0 })]
    const xs = layoutTimeline(items).noteX
    let previous = 0
    xs.forEach((_, index) => {
      const offset = scrollOffset(xs, index, visible)
      expect(offset).toBeGreaterThanOrEqual(previous)
      previous = offset
    })
  })

  it('ignores an index past the written notes', () => {
    expect(scrollOffset(noteX, 99, visible)).toBe(offsets[offsets.length - 1])
  })
})

describe('noteState', () => {
  it('leaves future notes pending', () => {
    expect(noteState(3, 2, 0)).toBe('pending')
  })

  it('marks the target current, red once a wrong key was tapped', () => {
    expect(noteState(2, 2, 0)).toBe('current')
    expect(noteState(2, 2, 1)).toBe('current-missed')
    expect(noteState(2, 2, 4)).toBe('current-missed')
  })

  it('keeps first-try notes correct and the others recovered', () => {
    expect(noteState(1, 2, 0)).toBe('correct')
    expect(noteState(1, 2, 2)).toBe('recovered')
  })

  it('hides an unanswered target until it is found, whatever the taps', () => {
    expect(noteState(2, 2, 0, true)).toBe('hidden')
    expect(noteState(2, 2, 3, true)).toBe('hidden-missed')
    expect(noteState(1, 2, 0, true)).toBe('correct')
    expect(noteState(3, 2, 0, true)).toBe('pending')
  })
})

describe('isUnderHeader', () => {
  it('covers what has scrolled past the header edge, nothing before', () => {
    expect(isUnderHeader(100, 0, 90)).toBe(false)
    expect(isUnderHeader(100, 20, 90)).toBe(true)
    expect(isUnderHeader(110, 20, 90)).toBe(false)
  })

  it('covers a growing prefix of the notes as the offset grows', () => {
    const { noteX } = layoutTimeline(run(30))
    const edge = headerWidth(0)
    const covered = (offset: number) => noteX.filter((x) => isUnderHeader(x - NOTE_LEFT_EXTENT, offset, edge)).length
    expect(covered(0)).toBe(0)
    expect(covered(200)).toBeGreaterThan(covered(100))
    expect(covered(400)).toBeLessThan(noteX.length)
  })
})

describe('timelineScale', () => {
  it('is limited by the height in a short box', () => {
    expect(timelineScale(2000, 120, 0).scale).toBeCloseTo(120 / 158)
  })

  it('shrinks to keep five notes visible on a narrow screen', () => {
    const narrow = timelineScale(280, 600, 0)
    const wide = timelineScale(800, 600, 0)
    expect(narrow.scale).toBeLessThan(wide.scale)
    expect(Math.floor((narrow.visibleUnits - firstNoteX(0)) / NOTE_SPACING)).toBeGreaterThanOrEqual(4)
  })

  it('shrinks more for a wide key signature', () => {
    expect(timelineScale(330, 600, 7).scale).toBeLessThan(timelineScale(330, 600, 0).scale)
  })

  it('stays within sane bounds', () => {
    expect(timelineScale(100, 40, 7).scale).toBeGreaterThan(0.5)
    expect(timelineScale(5000, 5000, 0).scale).toBeLessThanOrEqual(1.25)
  })

  it('reports the visible width in layout units', () => {
    const { scale, visibleUnits } = timelineScale(400, 300, 0)
    expect(visibleUnits * scale).toBeCloseTo(400)
  })
})

describe('history cap (anchorAt)', () => {
  const bass = (fifths = 0): ClefAndKey => ({ clef: 'bass', fifths })
  const mixed: ClefAndKey[] = [
    ...run(5),
    ...run(4, treble(-3)),
    ...run(5, bass(-3)),
    ...run(7, bass(2)),
    ...run(3, treble()),
    ...run(6, treble(5)),
  ]

  it('keeps every x, bar line and change where they were when old notes are dropped', () => {
    const full = layoutTimeline(mixed)
    for (const drop of [1, 3, 4, 5, 9, 14, 20, 25]) {
      const anchor = anchorAt(mixed, drop)
      const trimmed = layoutTimeline(mixed.slice(drop), anchor)
      expect(trimmed.noteX).toEqual(full.noteX.slice(drop))
      expect(trimmed.bars.map((bar) => ({ index: bar.index + drop, x: bar.x }))).toEqual(
        full.bars.filter((bar) => bar.index > drop),
      )
      expect(trimmed.changes.map((change) => ({ ...change, index: change.index + drop }))).toEqual(
        full.changes.filter((change) => change.index > drop),
      )
    }
  })

  it('stays stable when trimming is repeated one note at a time', () => {
    const full = layoutTimeline(mixed)
    let dropped = 0
    let anchor = anchorAt(mixed, 0)
    for (let step = 0; step < 20; step++) {
      anchor = anchorAt(mixed.slice(dropped), 1, anchor)
      dropped++
      expect(layoutTimeline(mixed.slice(dropped), anchor).noteX).toEqual(full.noteX.slice(dropped))
    }
  })

  it('gives the same scroll offset on the kept window as on the whole history', () => {
    const full = layoutTimeline(mixed)
    const drop = 10
    const trimmed = layoutTimeline(mixed.slice(drop), anchorAt(mixed, drop))
    const last = mixed.length - 1
    expect(scrollOffset(trimmed.noteX, last - drop, 330)).toBe(scrollOffset(full.noteX, last, 330))
  })
})
