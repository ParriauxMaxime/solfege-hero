import { BEATS_PER_BAR } from '../hero/types'
import type { HeroNote } from '../hero/types'
import { staffStep } from '../music/notes'
import type { Clef } from '../music/notes'
import {
  accidentalGlyph,
  barLine,
  beam,
  clefGlyph,
  flag,
  inkGroup,
  ledgerLines,
  noteHead,
  quarterRest,
  staffLines,
  stemsUp,
  stem,
  stemTipY,
  stemX,
  stepY,
  svgElement,
} from './glyphs'
import type { HeadFill } from './glyphs'

export interface ScrollingStaff {
  element: SVGSVGElement
  setClef(clef: Clef): void
  render(notes: readonly HeroNote[], nowBeat: number, firstBarBeat: number): void
  markHit(id: number): void
  markMiss(id: number, label: string): void
  notePoint(id: number): DOMPoint | null
}

const VIEW_WIDTH = 570
const VIEW_HEIGHT = 200
const HIT_X = 110
const PX_PER_BEAT = 80
// Tighter than the single-note staff so an accidental never reaches back into the previous eighth.
const ACCIDENTAL_OFFSET = -24
const BAR_LINE_OFFSET = -PX_PER_BEAT * 0.4
const CLIP_LEFT = 92
const OFFSCREEN_MARGIN = 40
const HIT_BAND_HALF_WIDTH = 20
const MISS_LABEL_RISE = 40
const MISS_LABEL_MIN_Y = 14
const CLIP_ID = 'hero-notes-clip'

interface Entry {
  group: SVGGElement
  seen: number
}

interface KeyedLayer {
  begin(): void
  place(key: number, x: number, create: () => SVGGElement): void
  end(): void
  clear(): void
  find(key: number): SVGGElement | undefined
}

function createKeyedLayer(parent: SVGElement): KeyedLayer {
  const entries = new Map<number, Entry>()
  let frame = 0
  return {
    begin() {
      frame++
    },
    place(key, x, create) {
      let entry = entries.get(key)
      if (!entry) {
        entry = { group: create(), seen: frame }
        entries.set(key, entry)
        parent.append(entry.group)
      }
      entry.seen = frame
      entry.group.setAttribute('transform', `translate(${x} 0)`)
    },
    end() {
      for (const [key, entry] of entries) {
        if (entry.seen === frame) continue
        entry.group.remove()
        entries.delete(key)
      }
    },
    clear() {
      for (const entry of entries.values()) entry.group.remove()
      entries.clear()
    },
    find: (key) => entries.get(key)?.group,
  }
}

function beatToX(beat: number, nowBeat: number): number {
  return HIT_X + (beat - nowBeat) * PX_PER_BEAT
}

function isBeamStart(first: HeroNote | undefined, second: HeroNote | undefined): boolean {
  return (
    first !== undefined &&
    second !== undefined &&
    first.duration === 'eighth' &&
    second.duration === 'eighth' &&
    first.note !== null &&
    second.note !== null &&
    Number.isInteger(first.beat) &&
    second.beat === first.beat + 0.5
  )
}

function createNoteGroup(
  hero: HeroNote,
  previous: HeroNote | undefined,
  next: HeroNote | undefined,
  clef: Clef,
): SVGGElement {
  const group = inkGroup({ class: 'hero-note' })
  const label = svgElement('text', { class: 'hero-miss-label', y: MISS_LABEL_MIN_Y })
  group.append(label)
  if (!hero.note) {
    group.append(quarterRest(0))
    return group
  }

  const step = staffStep(hero.note, clef)
  const fill: HeadFill = hero.duration === 'whole' || hero.duration === 'half' ? 'hollow' : 'filled'
  label.setAttribute('y', String(Math.max(MISS_LABEL_MIN_Y, stepY(Math.max(step, 8)) - MISS_LABEL_RISE)))
  group.append(...ledgerLines(step, 0))
  if (hero.note.alter !== 0) group.append(accidentalGlyph(hero.note.alter, ACCIDENTAL_OFFSET, step))
  group.append(noteHead(fill, 0, step))
  if (hero.duration === 'whole') return group

  const startsBeam = isBeamStart(hero, next)
  const partner = startsBeam ? next : isBeamStart(previous, hero) ? previous : undefined
  if (!partner?.note) {
    const up = stemsUp(step)
    const tipY = stemTipY(step, up)
    group.append(stem(fill, 0, step, up, tipY))
    if (hero.duration === 'eighth') group.append(flag(stemX(fill, 0, up), tipY, up))
    return group
  }

  const up = stemsUp((step + staffStep(partner.note, clef)) / 2)
  const tips = [stemTipY(step, up), stemTipY(staffStep(partner.note, clef), up)]
  const tipY = up ? Math.min(...tips) : Math.max(...tips)
  group.append(stem(fill, 0, step, up, tipY))
  if (startsBeam) group.append(beam(stemX(fill, 0, up), stemX(fill, PX_PER_BEAT / 2, up), tipY, up))
  return group
}

export function createScrollingStaff(initialClef: Clef): ScrollingStaff {
  let clef = initialClef
  const svg = svgElement('svg', {
    class: 'hero-staff',
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    width: '100%',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': 'Portée défilante',
  })
  const clip = svgElement('clipPath', { id: CLIP_ID })
  clip.append(svgElement('rect', { x: CLIP_LEFT, y: 0, width: VIEW_WIDTH - CLIP_LEFT, height: VIEW_HEIGHT }))
  const hitZone = svgElement('rect', {
    class: 'hero-hit-zone',
    x: HIT_X - HIT_BAND_HALF_WIDTH,
    y: 12,
    width: HIT_BAND_HALF_WIDTH * 2,
    height: VIEW_HEIGHT - 24,
    rx: 10,
  })
  const clefHolder = svgElement('g', {})
  const scrolling = svgElement('g', { 'clip-path': `url(#${CLIP_ID})` })
  const barGroup = svgElement('g', { stroke: 'currentColor' })
  const noteGroup = svgElement('g', {})
  scrolling.append(barGroup, noteGroup)
  svg.append(clip, hitZone, staffLines(8, VIEW_WIDTH), clefHolder, scrolling)

  const bars = createKeyedLayer(barGroup)
  const notes = createKeyedLayer(noteGroup)

  function setClef(value: Clef): void {
    clef = value
    clefHolder.replaceChildren(clefGlyph(clef))
    notes.clear()
  }

  function renderBars(nowBeat: number, firstBarBeat: number): void {
    const first = Math.max(0, Math.ceil((nowBeat - (HIT_X + OFFSCREEN_MARGIN) / PX_PER_BEAT - firstBarBeat) / BEATS_PER_BAR))
    bars.begin()
    for (let bar = first; ; bar++) {
      const x = beatToX(firstBarBeat + bar * BEATS_PER_BAR, nowBeat) + BAR_LINE_OFFSET
      if (x > VIEW_WIDTH + OFFSCREEN_MARGIN) break
      bars.place(bar, x, () => {
        const group = svgElement('g', {})
        group.append(barLine(0))
        return group
      })
    }
    bars.end()
  }

  setClef(clef)

  return {
    element: svg,
    setClef,
    render(heroNotes, nowBeat, firstBarBeat) {
      renderBars(nowBeat, firstBarBeat)
      notes.begin()
      for (let i = 0; i < heroNotes.length; i++) {
        const hero = heroNotes[i] as HeroNote
        const x = beatToX(hero.beat, nowBeat)
        if (x < -OFFSCREEN_MARGIN) continue
        if (x > VIEW_WIDTH + OFFSCREEN_MARGIN) break
        notes.place(hero.id, x, () => createNoteGroup(hero, heroNotes[i - 1], heroNotes[i + 1], clef))
      }
      notes.end()
    },
    markHit(id) {
      notes.find(id)?.classList.add('hit')
    },
    markMiss(id, text) {
      const group = notes.find(id)
      if (!group) return
      group.classList.add('miss')
      const labelElement = group.querySelector('.hero-miss-label')
      if (labelElement) labelElement.textContent = text
    },
    notePoint(id) {
      const target = notes.find(id)?.querySelector('.staff-note-head') ?? notes.find(id)
      if (!target) return null
      const box = target.getBoundingClientRect()
      return new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
    },
  }
}
