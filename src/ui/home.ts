import { button, el, iconButton } from './dom'
import { clefGlyph, inkGroup, noteHead, staffLines, stem, svgElement } from './glyphs'

export type HomeChoice = 'apprendre' | 'series' | 'hero'

interface HomeOptions {
  onChoose: (choice: HomeChoice) => void
  onSettings: () => void
  onStats: () => void
}

interface CardSpec {
  choice: HomeChoice
  accent: string
  title: string
  subtitle: string
  icon: () => SVGSVGElement
}

type Shape = [tag: 'path' | 'circle' | 'ellipse' | 'line', attributes: Record<string, string | number>]

function icon(shapes: Shape[]): SVGSVGElement {
  const svg = svgElement('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true', class: 'home-card-icon' })
  const group = inkGroup({ fill: 'none', 'stroke-width': 3.5, 'stroke-linejoin': 'round' })
  for (const [tag, attributes] of shapes) group.append(svgElement(tag, attributes))
  svg.append(group)
  return svg
}

const STAFF_SHAPES: Shape[] = [14, 24, 34, 44].map((y) => ['line', { x1: 6, x2: 58, y1: y, y2: y, 'stroke-width': 2 }])

const CARDS: CardSpec[] = [
  {
    choice: 'apprendre',
    accent: 'violet',
    title: 'Apprendre',
    subtitle: 'Une note à la fois, à ton rythme',
    icon: () =>
      icon([
        ...STAFF_SHAPES,
        ['ellipse', { cx: 34, cy: 29, rx: 9, ry: 6.5, fill: 'currentColor', stroke: 'none', transform: 'rotate(-20 34 29)' }],
      ]),
  },
  {
    choice: 'series',
    accent: 'mint',
    title: 'Séries',
    subtitle: '20 notes chrono, défie tes amis',
    icon: () =>
      icon([
        ['circle', { cx: 32, cy: 36, r: 20 }],
        ['path', { d: 'M26 8H38M32 8V16M32 36L42 26' }],
        ['path', { d: 'M50 14L54 18' }],
      ]),
  },
  {
    choice: 'hero',
    accent: 'sunset',
    title: 'Solfège hero',
    subtitle: 'Les notes défilent en rythme',
    icon: () =>
      icon([
        ...STAFF_SHAPES,
        ['ellipse', { cx: 14, cy: 39, rx: 6, ry: 4.5, fill: 'currentColor', stroke: 'none' }],
        ['path', { d: 'M19.5 38V16', 'stroke-width': 2.5 }],
        ['ellipse', { cx: 33, cy: 29, rx: 6, ry: 4.5, fill: 'currentColor', stroke: 'none' }],
        ['path', { d: 'M38.5 28V6', 'stroke-width': 2.5 }],
        ['ellipse', { cx: 52, cy: 19, rx: 6, ry: 4.5, fill: 'currentColor', stroke: 'none' }],
        ['path', { d: 'M46 19V42', 'stroke-width': 2.5 }],
      ]),
  },
]

function logo(): SVGSVGElement {
  const svg = svgElement('svg', { viewBox: '20 24 150 150', class: 'home-logo', 'aria-hidden': 'true' })
  const halo = svgElement('circle', { class: 'home-logo-halo', cx: 126, cy: 100, r: 30 })
  const note = inkGroup({ class: 'home-logo-note' })
  note.append(noteHead('filled', 126, 5), stem('filled', 126, 5, true))
  svg.append(staffLines(20, 170), clefGlyph('treble'), halo, note)
  return svg
}

function card(spec: CardSpec, index: number, onChoose: (choice: HomeChoice) => void): HTMLButtonElement {
  const element = button('home-card', '', () => onChoose(spec.choice))
  element.dataset.accent = spec.accent
  element.style.setProperty('--i', String(index))
  element.append(
    spec.icon(),
    el('span', 'home-card-text', el('strong', 'home-card-title', spec.title), el('span', 'home-card-subtitle', spec.subtitle)),
  )
  return element
}

export function createHome({ onChoose, onSettings, onStats }: HomeOptions): HTMLElement {
  const actions = el('div', 'home-actions', iconButton('stats', onStats, 'Statistiques'), iconButton('settings', onSettings, 'Réglages'))
  const brand = el('div', 'home-brand', logo(), el('h1', 'home-title', 'Solfège ', el('span', '', 'hero')))
  const cards = el('div', 'home-cards', ...CARDS.map((spec, index) => card(spec, index, onChoose)))
  return el('section', 'home', brand, actions, cards)
}
