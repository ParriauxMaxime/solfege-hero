import { dailyStreak, type DailyKey } from '../series/daily'
import { formatTenthsUp } from '../series/share'
import type { PlayMode, Progress } from '../storage'
import type { Score } from '../hero/types'
import { button, el } from './dom'
import { icon as glyph } from './icons'
import { clefGlyph, inkGroup, ledgerLines, noteHead, staffLines, stem, stepY, svgElement } from './glyphs'

export type HomeChoice = 'apprendre' | 'series' | 'survival' | 'hero' | 'partitions' | 'daily'

export type LogoVariant = 'a' | 'b' | 'c'

interface HomeOptions {
  progress: Progress
  today: DailyKey
  scores: Promise<Score[]>
  onChoose: (choice: HomeChoice) => void
  onSettings: () => void
  onStats: () => void
}

interface Stat {
  value: string
  label?: string
}

interface CardSpec {
  choice: HomeChoice
  accent: string
  title: string
  stats: Node
  icon: () => SVGSVGElement
}

type Shape = [tag: 'path' | 'circle' | 'ellipse' | 'line', attributes: Record<string, string | number>]

const NONE = '—'

function icon(shapes: Shape[]): SVGSVGElement {
  const svg = svgElement('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true', class: 'home-card-icon' })
  const group = inkGroup({ fill: 'none', 'stroke-width': 3.5, 'stroke-linejoin': 'round' })
  for (const [tag, attributes] of shapes) group.append(svgElement(tag, attributes))
  svg.append(group)
  return svg
}

const STAFF_SHAPES: Shape[] = [14, 24, 34, 44].map((y) => ['line', { x1: 6, x2: 58, y1: y, y2: y, 'stroke-width': 2 }])

const ICONS: Record<HomeChoice, () => SVGSVGElement> = {
  apprendre: () =>
    icon([
      ...STAFF_SHAPES,
      ['ellipse', { cx: 34, cy: 29, rx: 9, ry: 6.5, fill: 'currentColor', stroke: 'none', transform: 'rotate(-20 34 29)' }],
    ]),
  series: () =>
    icon([
      ['circle', { cx: 32, cy: 36, r: 20 }],
      ['path', { d: 'M26 8H38M32 8V16M32 36L42 26' }],
      ['path', { d: 'M50 14L54 18' }],
    ]),
  survival: () => icon([['path', { d: 'M32 56C32 56 8 42 8 24a12 12 0 0 1 24-5 12 12 0 0 1 24 5C56 42 32 56 32 56Z' }]]),
  hero: () =>
    icon([
      ...STAFF_SHAPES,
      ['ellipse', { cx: 14, cy: 39, rx: 6, ry: 4.5, fill: 'currentColor', stroke: 'none' }],
      ['path', { d: 'M19.5 38V16', 'stroke-width': 2.5 }],
      ['ellipse', { cx: 33, cy: 29, rx: 6, ry: 4.5, fill: 'currentColor', stroke: 'none' }],
      ['path', { d: 'M38.5 28V6', 'stroke-width': 2.5 }],
      ['ellipse', { cx: 52, cy: 19, rx: 6, ry: 4.5, fill: 'currentColor', stroke: 'none' }],
      ['path', { d: 'M46 19V42', 'stroke-width': 2.5 }],
    ]),
  partitions: () =>
    icon([
      ['path', { d: 'M14 6H40L50 16V58H14Z' }],
      ['path', { d: 'M40 6V16H50' }],
      ['ellipse', { cx: 29, cy: 46, rx: 5.5, ry: 4, fill: 'currentColor', stroke: 'none' }],
      ['path', { d: 'M34.5 46V28L44 31', 'stroke-width': 2.5 }],
    ]),
  daily: () =>
    icon([
      ['path', { d: 'M10 14H54V56H10Z' }],
      ['path', { d: 'M10 26H54M20 8V18M44 8V18' }],
      ['circle', { cx: 32, cy: 42, r: 5, fill: 'currentColor', stroke: 'none' }],
    ]),
}

function logoParam(): LogoVariant {
  const value = new URLSearchParams(window.location.search).get('logo')
  return value === 'b' || value === 'c' ? value : 'a'
}

function logoStaff(): SVGSVGElement {
  const svg = svgElement('svg', { viewBox: '24 34 146 132', class: 'home-logo', 'aria-hidden': 'true' })
  const note = inkGroup({ class: 'home-logo-note' })
  const stemUp = stem('filled', 126, 0, true)
  const stemDown = stem('filled', 126, 0, false)
  stemUp.classList.add('home-logo-stem-up')
  stemDown.classList.add('home-logo-stem-down')
  note.append(noteHead('filled', 126, 0), stemUp, stemDown)
  const mover = svgElement('g', { class: 'home-logo-mover' })
  mover.append(svgElement('circle', { class: 'home-logo-halo', cx: 126, cy: stepY(0), r: 22 }), note)
  const ledger = svgElement('g', { class: 'home-logo-ledger' })
  ledger.append(...ledgerLines(-2, 126))
  svg.append(staffLines(24, 170), ledger, clefGlyph('treble'), mover)
  return svg
}

function logoClef(): SVGSVGElement {
  const svg = svgElement('svg', { viewBox: '30 30 56 140', class: 'home-logo', 'aria-hidden': 'true' })
  svg.append(clefGlyph('treble'))
  return svg
}

function logoBadge(): SVGSVGElement {
  const svg = svgElement('svg', { viewBox: '0 0 48 48', class: 'home-logo', 'aria-hidden': 'true' })
  const staff = svgElement('g', { transform: 'rotate(-12 24 24)', stroke: 'currentColor', 'stroke-linecap': 'round' })
  for (const y of [14, 20, 26, 32, 38]) staff.append(svgElement('line', { x1: 7, x2: 41, y1: y, y2: y, 'stroke-width': 1.6 }))
  staff.append(
    svgElement('ellipse', { cx: 25, cy: 29, rx: 5.2, ry: 3.8, fill: 'currentColor', stroke: 'none', transform: 'rotate(-20 25 29)' }),
    svgElement('line', { x1: 29.6, x2: 29.6, y1: 28, y2: 13, 'stroke-width': 2.2 }),
  )
  svg.append(svgElement('rect', { class: 'home-logo-badge', width: 48, height: 48, rx: 12 }), staff)
  return svg
}

function renderLogo(variant: LogoVariant): HTMLElement {
  const title = el('h1', 'home-title', 'Solfège hero')
  const mark = variant === 'b' ? logoClef() : variant === 'c' ? logoBadge() : logoStaff()
  return el('div', `home-brand home-brand-${variant}`, mark, title)
}

function flame(): SVGSVGElement {
  const svg = glyph('flame')
  svg.classList.add('home-flame')
  return svg
}

function streakStat(days: number): Node {
  return el('span', 'home-stat', days > 0 ? el('b', 'home-stat-value', flame(), `${days} j`) : el('b', 'home-stat-value', NONE))
}

function valueStat({ value, label }: Stat): Node {
  return el('span', 'home-stat', el('b', 'home-stat-value', value), ...(label ? [el('small', 'home-stat-label', label)] : []))
}

function statsRow(first: Stat, streak: number): HTMLElement {
  return el('span', 'home-stats', valueStat(first), el('span', 'home-stat-sep', '·'), streakStat(streak))
}

function accuracyStat(progress: Progress): Stat {
  const records = Object.values(progress.notes)
  const attempts = records.reduce((sum, record) => sum + record.attempts, 0)
  const correct = records.reduce((sum, record) => sum + record.correct, 0)
  return { value: attempts > 0 ? `${Math.round((100 * correct) / attempts)} %` : NONE, label: 'précision' }
}

function shortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function scoresStats(scores: Score[]): Node[] {
  const lastImport = Math.max(0, ...scores.map((score) => score.importedAt))
  return [
    valueStat({ value: String(scores.length), label: 'partitions' }),
    el('span', 'home-stat-sep', '·'),
    valueStat({ value: lastImport > 0 ? shortDate(lastImport) : NONE, label: 'import' }),
  ]
}

function dailyBanner(progress: Progress, today: DailyKey): HTMLElement {
  const attemptMs = progress.daily.attempts[today]?.totalMs ?? null
  const status =
    attemptMs === null
      ? el('span', 'home-card-note', '20 notes')
      : el('span', 'home-card-note inline-icon', glyph('check'), formatTenthsUp(attemptMs))
  const streak = dailyStreak(Object.keys(progress.daily.attempts), today)
  return el(
    'span',
    'home-banner-body',
    el('span', 'home-card-text', el('strong', 'home-card-title', 'Défi du jour'), status),
    ...(streak > 0 ? [el('span', 'home-stats', streakStat(streak))] : []),
  )
}

function streakOf(progress: Progress, mode: PlayMode, today: DailyKey): number {
  return dailyStreak(progress.playDays[mode], today)
}

function cardSpecs(progress: Progress, today: DailyKey): CardSpec[] {
  const best = (value: number, format: (value: number) => string = String): string => (value > 0 ? format(value) : NONE)
  return [
    {
      choice: 'apprendre',
      accent: 'violet',
      title: 'Apprendre',
      stats: statsRow(accuracyStat(progress), streakOf(progress, 'learn', today)),
      icon: ICONS.apprendre,
    },
    {
      choice: 'series',
      accent: 'mint',
      title: 'Séries',
      stats: statsRow({ value: best(progress.series.bestMs, formatTenthsUp), label: 'temps' }, streakOf(progress, 'series', today)),
      icon: ICONS.series,
    },
    {
      choice: 'survival',
      accent: 'rose',
      title: 'Survie',
      stats: statsRow({ value: best(progress.survival.bestScore), label: 'score' }, streakOf(progress, 'survival', today)),
      icon: ICONS.survival,
    },
    {
      choice: 'hero',
      accent: 'sunset',
      title: 'Solfège hero',
      stats: statsRow({ value: best(progress.hero.bestScore), label: 'score' }, streakOf(progress, 'hero', today)),
      icon: ICONS.hero,
    },
  ]
}

function card(
  choice: HomeChoice,
  accent: string,
  index: number,
  onChoose: (choice: HomeChoice) => void,
  ...content: Node[]
): HTMLButtonElement {
  const element = button('home-card', '', () => onChoose(choice))
  element.dataset.accent = accent
  element.style.setProperty('--i', String(index))
  element.append(ICONS[choice](), ...content)
  return element
}

function specCard(spec: CardSpec, index: number, onChoose: (choice: HomeChoice) => void): HTMLButtonElement {
  return card(spec.choice, spec.accent, index, onChoose, el('span', 'home-card-text', el('strong', 'home-card-title', spec.title), spec.stats))
}

export function createHome({ progress, today, scores, onChoose, onSettings, onStats }: HomeOptions): HTMLElement {
  const answers = Object.values(progress.notes).reduce((sum, record) => sum + record.attempts, 0)
  const utilityCard = (name: 'stats' | 'settings', title: string, onClick: () => void, detail?: string): HTMLButtonElement => {
    const mark = glyph(name)
    mark.classList.add('home-card-icon')
    const element = button('home-card home-utility', '', onClick)
    element.style.setProperty('--i', '6')
    element.append(mark, el('span', 'home-card-text', el('strong', 'home-card-title', title), ...(detail ? [el('small', 'home-stat-label', detail)] : [])))
    return element
  }
  const partitionsStats = el('span', 'home-stats', ...scoresStats([]))
  void scores.then((list) => partitionsStats.replaceChildren(...scoresStats(list)))
  const cards = el(
    'div',
    'home-cards',
    card('daily', 'gold', 0, onChoose, dailyBanner(progress, today)),
    ...cardSpecs(progress, today).map((spec, index) => specCard(spec, index + 1, onChoose)),
    card('partitions', 'ocean', 5, onChoose, el('span', 'home-card-text', el('strong', 'home-card-title', 'Partitions'), partitionsStats)),
    utilityCard('settings', 'Réglages', onSettings),
    utilityCard('stats', 'Statistiques', onStats, answers > 0 ? `${answers} réponses` : undefined),
  )
  cards.firstElementChild?.classList.add('home-daily')
  cards.children[5]?.classList.add('home-partitions')
  return el('section', 'home', renderLogo(logoParam()), cards)
}
