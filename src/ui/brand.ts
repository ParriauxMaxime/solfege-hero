import { t } from '../i18n'
import { el } from './dom'
import { clefGlyph, inkGroup, ledgerLines, noteHead, staffLines, stem, stepY, svgElement } from './glyphs'

const NOTE_X = 126
const FLAME_SCALE = 0.28

type Tier = 'outer' | 'middle' | 'inner'

interface Tongue {
  x: number
  height: number
  width: number
  lean: number
  bend: number
  tier: Tier
}

const TONGUES: Tongue[] = [
  { x: -52, height: 100, width: 50, lean: -26, bend: 10, tier: 'outer' },
  { x: -28, height: 150, width: 56, lean: -16, bend: 12, tier: 'outer' },
  { x: 2, height: 182, width: 66, lean: 6, bend: -10, tier: 'outer' },
  { x: 32, height: 146, width: 54, lean: 18, bend: -10, tier: 'outer' },
  { x: 54, height: 98, width: 46, lean: 26, bend: -8, tier: 'outer' },
  { x: -14, height: 140, width: 50, lean: -8, bend: 8, tier: 'middle' },
  { x: 18, height: 150, width: 50, lean: 12, bend: -7, tier: 'middle' },
  { x: 2, height: 118, width: 42, lean: 3, bend: -4, tier: 'inner' },
]

type Stop = [offset: number, color: string, opacity?: number]

const FLAME_RAMPS: Record<Tier, Stop[]> = {
  outer: [[0, 'warm', 0], [0.14, 'warm'], [0.35, 'orange'], [0.75, 'red'], [1, 'deep', 0]],
  middle: [[0, 'hot'], [0.3, 'warm'], [0.6, 'orange'], [0.85, 'red'], [1, 'deep', 0]],
  inner: [[0, 'hot'], [0.5, 'warm'], [0.85, 'orange'], [1, 'red', 0]],
}

const GOLD_RAMP: Stop[] = [[0, 'light'], [0.45, 'mid'], [1, 'deep']]
const BASE_RAMP: Stop[] = [[0, 'base', 0.8], [1, 'base', 0]]

let logoCount = 0

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function tonguePath({ x, height, width, lean, bend }: Tongue): string {
  const half = width / 2
  const bendX = x + bend
  const [left, right] = [x - half, x + half]
  const curve = (...points: number[]) => points.map(round).join(' ')
  return [
    `M${curve(left, 0)}`,
    `C${curve(x - half * 1.25, -height * 0.35, bendX - half * 0.3, -height * 0.62, x + lean, -height)}`,
    `C${curve(bendX + half * 0.4, -height * 0.6, x + half * 1.25, -height * 0.3, right, 0)}`,
    `C${curve(x + half * 0.6, half * 0.9, x - half * 0.6, half * 0.9, left, 0)}Z`,
  ].join('')
}

function stops(element: SVGGradientElement, prefix: string, ramp: Stop[]): SVGGradientElement {
  for (const [offset, color, opacity = 1] of ramp) {
    const stop = svgElement('stop', { offset, 'stop-opacity': opacity })
    stop.style.setProperty('stop-color', `var(--logo-${prefix}-${color})`)
    element.append(stop)
  }
  return element
}

function logoDefs(id: string): SVGDefsElement {
  const defs = svgElement('defs', {})
  for (const tier of Object.keys(FLAME_RAMPS) as Tier[]) {
    defs.append(stops(svgElement('linearGradient', { id: `${id}-${tier}`, x1: 0, y1: 1, x2: 0, y2: 0 }), 'flame', FLAME_RAMPS[tier]))
  }
  defs.append(
    stops(svgElement('linearGradient', { id: `${id}-gold`, x1: 0, y1: 0, x2: 0, y2: 1 }), 'gold', GOLD_RAMP),
    stops(svgElement('radialGradient', { id: `${id}-base` }), 'ember', BASE_RAMP),
  )
  return defs
}

function flame(id: string): SVGGElement {
  const placement = svgElement('g', { transform: `translate(${NOTE_X} ${stepY(0)}) scale(${FLAME_SCALE})` })
  const tongues = svgElement('g', { class: 'home-logo-flame' })
  for (const tongue of TONGUES) tongues.append(svgElement('path', { d: tonguePath(tongue), fill: `url(#${id}-${tongue.tier})` }))
  placement.append(tongues)
  return placement
}

function logoStaff(): SVGSVGElement {
  const id = `home-logo-${logoCount++}`
  const svg = svgElement('svg', { viewBox: '24 34 146 132', class: 'home-logo', 'aria-hidden': 'true' })
  const note = inkGroup({ class: 'home-logo-note' })
  const head = noteHead('filled', NOTE_X, 0)
  head.setAttribute('fill', `url(#${id}-gold)`)
  head.classList.add('home-logo-head')
  const stemUp = stem('filled', NOTE_X, 0, true)
  const stemDown = stem('filled', NOTE_X, 0, false)
  stemUp.classList.add('home-logo-stem-up')
  stemDown.classList.add('home-logo-stem-down')
  note.append(head, stemUp, stemDown)
  const mover = svgElement('g', { class: 'home-logo-mover' })
  const halo = svgElement('circle', { class: 'home-logo-halo', cx: NOTE_X, cy: stepY(0), r: 22 })
  const emberBase = svgElement('ellipse', { cx: NOTE_X, cy: stepY(0), rx: 17, ry: 13, fill: `url(#${id}-base)` })
  mover.append(halo, flame(id), emberBase, note)
  const ledger = svgElement('g', { class: 'home-logo-ledger' })
  ledger.append(...ledgerLines(-2, NOTE_X))
  svg.append(logoDefs(id), staffLines(24, 170), ledger, clefGlyph('treble'), mover)
  return svg
}

export function renderBrand(withTagline = true): HTMLElement {
  const title = el('h1', 'home-title', 'Solfège hero')
  return el('div', 'home-brand', logoStaff(), title, ...(withTagline ? [el('p', 'home-tagline', t('home.tagline'))] : []))
}
