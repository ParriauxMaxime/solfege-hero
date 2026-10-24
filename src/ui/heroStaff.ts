import { COMMON_TIME } from '../hero/types'
import type { HeroNote, TimeSignature } from '../hero/types'
import { barClicks, barLength } from '../hero/meter'
import { inlineAccidental } from '../music/keySignature'
import { staffStep } from '../music/notes'
import type { Clef, Note } from '../music/notes'
import {
  accidentalGlyph,
  augmentationDots,
  barLine,
  beam,
  clefGlyph,
  dotsStartX,
  flag,
  inkGroup,
  keySignatureGlyph,
  keySignatureWidth,
  ledgerLines,
  noteHead,
  restGlyph,
  staffLines,
  timeSignatureGlyph,
  timeSignatureWidth,
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
  setClef(clef: Clef, fifths: number, time?: TimeSignature): void
  render(notes: readonly HeroNote[], nowBeat: number, firstBarBeat: number): void
  markHit(id: number): void
  markMiss(id: number, label: string): void
  notePoint(id: number): DOMPoint | null
}

const CONTENT_TOP = 0
const CONTENT_BOTTOM = stepY(-4) + 16
const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP
interface Density {
  beatsAhead: number
  minPxPerBeat: number
  hitDistanceFromClip: number
}

const LANDSCAPE_DENSITY: Density = { beatsAhead: 6, minPxPerBeat: 80, hitDistanceFromClip: 32 }
const PORTRAIT_DENSITY: Density = { beatsAhead: 3, minPxPerBeat: 60, hitDistanceFromClip: 26 }
const PORTRAIT_ASPECT = 0.8
// Tighter than the single-note staff so an accidental never reaches back into the previous eighth.
const ACCIDENTAL_OFFSET = -20
const BAR_LINE_OFFSET_BEATS = -0.4
const GROUP_EPSILON = 1e-6
const BEAM_STUB = 10
const FLAG_PITCH = 8
const REST_DOT_X = 10
const REST_DOT_STEP = 5
const SIGNATURE_X = 90
const CLIP_LEFT_WITHOUT_SIGNATURE = 92
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

type PitchedNote = HeroNote & { note: Note }

function isBeamable(hero: HeroNote | undefined): hero is PitchedNote {
  return hero?.note != null && (hero.duration === 'eighth' || hero.duration === 'sixteenth')
}

/** Consecutive eighths and sixteenths sharing one beat group (a beat, or a dotted quarter in compound time). */
function beamRun(notes: readonly HeroNote[], index: number, beamUnit: number): PitchedNote[] {
  const hero = notes[index]
  if (!isBeamable(hero)) return []
  const group = (candidate: HeroNote) => Math.floor(candidate.beat / beamUnit + GROUP_EPSILON)
  const joins = (candidate: HeroNote | undefined) => isBeamable(candidate) && group(candidate) === group(hero)
  let start = index
  while (joins(notes[start - 1])) start--
  let end = index
  while (joins(notes[end + 1])) end++
  return notes.slice(start, end + 1) as PitchedNote[]
}

function appendBeams(group: SVGGElement, run: readonly PitchedNote[], fill: HeadFill, up: boolean, tipY: number, pxPerBeat: number): void {
  const first = run[0] as PitchedNote
  const stemAt = (hero: HeroNote) => stemX(fill, (hero.beat - first.beat) * pxPerBeat, up)
  const last = run[run.length - 1] as PitchedNote
  group.append(beam(stemAt(first), stemAt(last), tipY, up))
  run.forEach((hero, index) => {
    if (hero.duration !== 'sixteenth') return
    const next = run[index + 1]
    const previous = run[index - 1]
    if (next?.duration === 'sixteenth') group.append(beam(stemAt(hero), stemAt(next), tipY, up, 1))
    else if (previous?.duration !== 'sixteenth') {
      const direction = next ? 1 : -1
      group.append(beam(stemAt(hero), stemAt(hero) + direction * BEAM_STUB, tipY, up, 1))
    }
  })
}

function createNoteGroup(
  notes: readonly HeroNote[],
  index: number,
  clef: Clef,
  fifths: number,
  pxPerBeat: number,
  beamUnit: number,
): SVGGElement {
  const hero = notes[index] as HeroNote
  const group = inkGroup({ class: 'hero-note' })
  if (!hero.note) {
    group.append(restGlyph(hero.duration, 0), ...augmentationDots(REST_DOT_X, REST_DOT_STEP, hero.dots))
    return group
  }

  const step = staffStep(hero.note, clef)
  const fill: HeadFill = hero.duration === 'whole' || hero.duration === 'half' ? 'hollow' : 'filled'
  group.append(...ledgerLines(step, 0))
  const accidental = inlineAccidental(hero.note, fifths)
  if (accidental) group.append(accidentalGlyph(accidental, ACCIDENTAL_OFFSET, step))
  group.append(noteHead(fill, 0, step), ...augmentationDots(dotsStartX(fill), step, hero.dots))
  if (hero.duration === 'whole') return group

  const run = beamRun(notes, index, beamUnit)
  const steps = run.length > 1 ? run.map((member) => staffStep(member.note, clef)) : [step]
  const up = stemsUp(steps.reduce((sum, value) => sum + value, 0) / steps.length)
  const tips = steps.map((value) => stemTipY(value, up))
  const tipY = up ? Math.min(...tips) : Math.max(...tips)
  group.append(stem(fill, 0, step, up, tipY))
  if (run.length > 1) {
    if (run[0] === hero) appendBeams(group, run, fill, up, tipY, pxPerBeat)
    return group
  }
  const flagCount = hero.duration === 'sixteenth' ? 2 : hero.duration === 'eighth' ? 1 : 0
  for (let level = 0; level < flagCount; level++) {
    group.append(flag(stemX(fill, 0, up), tipY + (up ? 1 : -1) * level * FLAG_PITCH, up))
  }
  return group
}

function beamUnitOf(time: TimeSignature): number {
  return barClicks(time)[1]?.offset ?? barLength(time)
}

export function createScrollingStaff(
  initialClef: Clef,
  initialFifths: number,
  initialTime?: TimeSignature,
): ScrollingStaff {
  let clef = initialClef
  let fifths = initialFifths
  let time = initialTime
  let density = LANDSCAPE_DENSITY
  let clipLeft = CLIP_LEFT_WITHOUT_SIGNATURE
  let hitX = clipLeft + density.hitDistanceFromClip
  let viewWidth = hitX + density.beatsAhead * density.minPxPerBeat
  let pxPerBeat = density.minPxPerBeat
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

  function placeHitZone(): void {
    clipLeft = CLIP_LEFT_WITHOUT_SIGNATURE + keySignatureWidth(fifths) + (time ? timeSignatureWidth(time) : 0)
    hitX = clipLeft + density.hitDistanceFromClip
    clipRect.setAttribute('x', String(clipLeft))
    hitZone.setAttribute('x', String(hitX - HIT_BAND_HALF_WIDTH))
    missLabel.setAttribute('x', String(hitX))
  }

  function layout(width: number, height: number): void {
    density = height > width * PORTRAIT_ASPECT ? PORTRAIT_DENSITY : LANDSCAPE_DENSITY
    placeHitZone()
    const scale = Math.min(height / CONTENT_HEIGHT, width / (hitX + density.beatsAhead * density.minPxPerBeat))
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
    pxPerBeat = (viewWidth - hitX) / density.beatsAhead
    notes.clear()
  }

  function beatToX(beat: number, nowBeat: number): number {
    return hitX + (beat - nowBeat) * pxPerBeat
  }

  new ResizeObserver(() => {
    size = { width: svg.clientWidth, height: svg.clientHeight }
    if (size.width > 0 && size.height > 0) layout(size.width, size.height)
  }).observe(svg)

  function setClef(value: Clef, signature: number, timeSignature?: TimeSignature): void {
    clef = value
    fifths = signature
    time = timeSignature
    clefHolder.replaceChildren(clefGlyph(clef), keySignatureGlyph(clef, fifths, SIGNATURE_X))
    if (time) clefHolder.append(timeSignatureGlyph(time, SIGNATURE_X + keySignatureWidth(fifths)))
    placeHitZone()
    notes.clear()
    if (size && size.width > 0 && size.height > 0) layout(size.width, size.height)
  }

  function renderBars(nowBeat: number, firstBarBeat: number): void {
    const length = barLength(time ?? COMMON_TIME)
    const first = Math.max(0, Math.ceil((nowBeat - (hitX + OFFSCREEN_MARGIN) / pxPerBeat - firstBarBeat) / length))
    bars.begin()
    for (let bar = first; ; bar++) {
      const x = beatToX(firstBarBeat + bar * length, nowBeat) + BAR_LINE_OFFSET_BEATS * pxPerBeat
      if (x > viewWidth + OFFSCREEN_MARGIN) break
      bars.place(bar, x, () => {
        const group = svgElement('g', {})
        group.append(barLine(0))
        return group
      })
    }
    bars.end()
  }

  setClef(clef, fifths, time)

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
        notes.place(hero.id, x, () => createNoteGroup(heroNotes, i, clef, fifths, pxPerBeat, beamUnitOf(time ?? COMMON_TIME)))
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
