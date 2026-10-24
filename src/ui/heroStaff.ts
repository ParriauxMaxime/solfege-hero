import { BEATS_PER_BAR } from '../hero/types'
import type { HeroNote } from '../hero/types'
import { inlineAccidental } from '../music/keySignature'
import { staffStep } from '../music/notes'
import type { Clef } from '../music/notes'
import {
  accidentalGlyph,
  barLine,
  beam,
  clefGlyph,
  flag,
  inkGroup,
  keySignatureGlyph,
  keySignatureWidth,
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
import { restartAnimation } from './effects'

export interface ScrollingStaff {
  element: SVGSVGElement
  setClef(clef: Clef, fifths: number): void
  render(notes: readonly HeroNote[], nowBeat: number, firstBarBeat: number): void
  markHit(id: number): void
  markMiss(id: number, label: string): void
  notePoint(id: number): DOMPoint | null
}

const CONTENT_TOP = 0
const CONTENT_BOTTOM = stepY(-4) + 16
const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP
const BEATS_AHEAD = 6
const MIN_PX_PER_BEAT = 80
// Tighter than the single-note staff so an accidental never reaches back into the previous eighth.
const ACCIDENTAL_OFFSET = -24
const BAR_LINE_OFFSET_BEATS = -0.4
const SIGNATURE_X = 90
const CLIP_LEFT_WITHOUT_SIGNATURE = 92
const HIT_DISTANCE_FROM_CLIP = 32
const STAFF_LEFT = 8
const OFFSCREEN_MARGIN = 40
const HIT_BAND_HALF_WIDTH = 20
const HIT_BAND_INSET = 4
const MISS_LABEL_Y = CONTENT_TOP + 22
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
  fifths: number,
  pxPerBeat: number,
): SVGGElement {
  const group = inkGroup({ class: 'hero-note' })
  if (!hero.note) {
    group.append(quarterRest(0))
    return group
  }

  const step = staffStep(hero.note, clef)
  const fill: HeadFill = hero.duration === 'whole' || hero.duration === 'half' ? 'hollow' : 'filled'
  group.append(...ledgerLines(step, 0))
  const accidental = inlineAccidental(hero.note, fifths)
  if (accidental) group.append(accidentalGlyph(accidental, ACCIDENTAL_OFFSET, step))
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
  if (startsBeam) group.append(beam(stemX(fill, 0, up), stemX(fill, pxPerBeat / 2, up), tipY, up))
  return group
}

export function createScrollingStaff(initialClef: Clef, initialFifths: number): ScrollingStaff {
  let clef = initialClef
  let fifths = initialFifths
  let clipLeft = CLIP_LEFT_WITHOUT_SIGNATURE
  let hitX = clipLeft + HIT_DISTANCE_FROM_CLIP
  let viewWidth = hitX + BEATS_AHEAD * MIN_PX_PER_BEAT
  let pxPerBeat = MIN_PX_PER_BEAT
  let size: { width: number; height: number } | null = null
  const svg = svgElement('svg', {
    class: 'hero-staff-svg',
    viewBox: `0 ${CONTENT_TOP} ${viewWidth} ${CONTENT_HEIGHT}`,
    preserveAspectRatio: 'xMinYMid meet',
    role: 'img',
    'aria-label': 'Portée défilante',
  })
  const clipRect = svgElement('rect', { x: clipLeft })
  const clip = svgElement('clipPath', { id: CLIP_ID })
  clip.append(clipRect)
  const hitZone = svgElement('rect', {
    class: 'hero-hit-zone',
    y: CONTENT_TOP + HIT_BAND_INSET,
    width: HIT_BAND_HALF_WIDTH * 2,
    height: CONTENT_HEIGHT - HIT_BAND_INSET * 2,
    rx: 10,
  })
  let lines = staffLines(STAFF_LEFT, viewWidth)
  const clefHolder = svgElement('g', {})
  const scrolling = svgElement('g', { 'clip-path': `url(#${CLIP_ID})` })
  const barGroup = svgElement('g', { stroke: 'currentColor' })
  const noteGroup = svgElement('g', {})
  scrolling.append(barGroup, noteGroup)
  // Outside the clip: a note judged late has already slid under the clef.
  const missLabel = svgElement('text', { class: 'hero-miss-label', y: MISS_LABEL_Y })
  svg.append(clip, hitZone, lines, clefHolder, scrolling, missLabel)

  const bars = createKeyedLayer(barGroup)
  const notes = createKeyedLayer(noteGroup)

  function layout(width: number, height: number): void {
    const scale = Math.min(height / CONTENT_HEIGHT, width / (hitX + BEATS_AHEAD * MIN_PX_PER_BEAT))
    viewWidth = width / scale
    const viewHeight = height / scale
    const top = CONTENT_TOP + (CONTENT_HEIGHT - viewHeight) / 2
    svg.setAttribute('viewBox', `0 ${top} ${viewWidth} ${viewHeight}`)
    clipRect.setAttribute('y', String(top))
    clipRect.setAttribute('width', String(viewWidth - clipLeft))
    clipRect.setAttribute('height', String(viewHeight))
    const nextLines = staffLines(STAFF_LEFT, viewWidth)
    lines.replaceWith(nextLines)
    lines = nextLines
    pxPerBeat = (viewWidth - hitX) / BEATS_AHEAD
    notes.clear()
  }

  function beatToX(beat: number, nowBeat: number): number {
    return hitX + (beat - nowBeat) * pxPerBeat
  }

  new ResizeObserver(() => {
    size = { width: svg.clientWidth, height: svg.clientHeight }
    if (size.width > 0 && size.height > 0) layout(size.width, size.height)
  }).observe(svg)

  function setClef(value: Clef, signature: number): void {
    clef = value
    fifths = signature
    clefHolder.replaceChildren(clefGlyph(clef), keySignatureGlyph(clef, fifths, SIGNATURE_X))
    clipLeft = CLIP_LEFT_WITHOUT_SIGNATURE + keySignatureWidth(fifths)
    hitX = clipLeft + HIT_DISTANCE_FROM_CLIP
    clipRect.setAttribute('x', String(clipLeft))
    hitZone.setAttribute('x', String(hitX - HIT_BAND_HALF_WIDTH))
    missLabel.setAttribute('x', String(hitX))
    notes.clear()
    if (size && size.width > 0 && size.height > 0) layout(size.width, size.height)
  }

  function renderBars(nowBeat: number, firstBarBeat: number): void {
    const first = Math.max(0, Math.ceil((nowBeat - (hitX + OFFSCREEN_MARGIN) / pxPerBeat - firstBarBeat) / BEATS_PER_BAR))
    bars.begin()
    for (let bar = first; ; bar++) {
      const x = beatToX(firstBarBeat + bar * BEATS_PER_BAR, nowBeat) + BAR_LINE_OFFSET_BEATS * pxPerBeat
      if (x > viewWidth + OFFSCREEN_MARGIN) break
      bars.place(bar, x, () => {
        const group = svgElement('g', {})
        group.append(barLine(0))
        return group
      })
    }
    bars.end()
  }

  setClef(clef, fifths)

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
        if (x > viewWidth + OFFSCREEN_MARGIN) break
        notes.place(hero.id, x, () => createNoteGroup(hero, heroNotes[i - 1], heroNotes[i + 1], clef, fifths, pxPerBeat))
      }
      notes.end()
    },
    markHit(id) {
      notes.find(id)?.classList.add('hit')
    },
    markMiss(id, text) {
      notes.find(id)?.classList.add('miss')
      missLabel.textContent = text
      restartAnimation(missLabel, 'shown')
    },
    notePoint(id) {
      const target = notes.find(id)?.querySelector('.staff-note-head') ?? notes.find(id)
      if (!target) return null
      const box = target.getBoundingClientRect()
      return new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
    },
  }
}
