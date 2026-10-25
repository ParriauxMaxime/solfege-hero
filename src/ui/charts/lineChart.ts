import { shortDateLabel } from '../../stats/dates'
import type { DayKey } from '../../stats/history'
import { dateTicks } from '../../stats/ticks'
import { el } from '../dom'
import { svgElement } from '../glyphs'
import { createTooltip } from './tooltip'

export interface ChartPoint {
  day: DayKey
  value: number | null
}

export interface LineChartOptions {
  title: string
  points: ChartPoint[]
  /** Ascending; the first and last tick bound the y range. */
  yTicks: number[]
  format: (value: number) => string
  formatTick?: (value: number) => string
  ariaSummary: string
  emptyMessage: string
  valueHeader: string
  height?: number
}

interface Placed {
  index: number
  x: number
  y: number
  value: number
}

const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 140
const MARGIN = { left: 42, right: 10, top: 8, bottom: 22 }
const INSET = 6
const DOT_RADIUS = 4
const SELECTED_RADIUS = 5
const MIN_DOT_SPACING = 12

function runsOf(placed: (Placed | null)[]): Placed[][] {
  const runs: Placed[][] = []
  let current: Placed[] = []
  for (const point of placed) {
    if (point) current.push(point)
    else if (current.length > 0) {
      runs.push(current)
      current = []
    }
  }
  if (current.length > 0) runs.push(current)
  return runs
}

function dataTable(options: LineChartOptions): HTMLElement {
  const rows = options.points
    .filter((point): point is ChartPoint & { value: number } => point.value !== null)
    .map((point) => el('tr', '', el('td', '', shortDateLabel(point.day)), el('td', '', options.format(point.value))))
  const table = el('table', 'chart-table', el('thead', '', el('tr', '', el('th', '', 'Date'), el('th', '', options.valueHeader))), el('tbody', '', ...rows))
  return el('details', 'chart-data', el('summary', '', 'Voir les données'), table)
}

export function createLineChart(options: LineChartOptions): HTMLElement {
  const { points, yTicks, format } = options
  const formatTick = options.formatTick ?? format
  const height = options.height ?? DEFAULT_HEIGHT
  const days = points.map((point) => point.day)
  const hasData = points.some((point) => point.value !== null)
  const yMin = yTicks[0] ?? 0
  const yMax = yTicks[yTicks.length - 1] ?? 1
  const ySpan = yMax - yMin || 1
  let width = DEFAULT_WIDTH
  let selected: number | null = null

  const svg = svgElement('svg', { class: 'chart-svg', role: 'img', 'aria-label': options.ariaSummary })
  svg.setAttribute('tabindex', '0')
  const tooltip = createTooltip()
  const plot = el('div', 'chart-plot', svg, tooltip.element)

  function plotWidth(): number {
    return width - MARGIN.left - MARGIN.right
  }

  function xOf(index: number): number {
    const count = points.length
    if (count <= 1) return MARGIN.left + plotWidth() / 2
    return MARGIN.left + INSET + (index * (plotWidth() - 2 * INSET)) / (count - 1)
  }

  function yOf(value: number): number {
    const plotHeight = height - MARGIN.top - MARGIN.bottom
    return MARGIN.top + (1 - (value - yMin) / ySpan) * plotHeight
  }

  function place(index: number): Placed | null {
    const value = points[index]?.value
    return value === null || value === undefined ? null : { index, x: xOf(index), y: yOf(value), value }
  }

  function nearestWithData(x: number): number | null {
    let best: number | null = null
    let bestDistance = Infinity
    points.forEach((point, index) => {
      if (point.value === null) return
      const distance = Math.abs(xOf(index) - x)
      if (distance < bestDistance) {
        best = index
        bestDistance = distance
      }
    })
    return best
  }

  function stepFrom(index: number | null, direction: 1 | -1): number | null {
    const start = index ?? (direction === 1 ? -1 : points.length)
    for (let next = start + direction; next >= 0 && next < points.length; next += direction) {
      if (points[next]?.value !== null) return next
    }
    return index
  }

  function drawGrid(): void {
    for (const tick of yTicks) {
      const y = yOf(tick)
      svg.append(svgElement('line', { class: 'chart-grid', x1: MARGIN.left, x2: width - MARGIN.right, y1: y, y2: y }))
      const label = svgElement('text', { class: 'chart-axis', x: MARGIN.left - 6, y, 'text-anchor': 'end', dy: '0.35em' })
      label.textContent = formatTick(tick)
      svg.append(label)
    }
    const ticks = new Set(dateTicks(days))
    days.forEach((day, index) => {
      if (!ticks.has(day)) return
      const anchor = index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'
      const label = svgElement('text', { class: 'chart-axis', x: xOf(index), y: height - 5, 'text-anchor': anchor })
      label.textContent = shortDateLabel(day)
      svg.append(label)
    })
  }

  function drawSeries(): void {
    const placed = points.map((_, index) => place(index))
    const spacing = (plotWidth() - 2 * INSET) / Math.max(1, points.length - 1)
    const showAllDots = spacing >= MIN_DOT_SPACING
    for (const run of runsOf(placed)) {
      if (run.length > 1) {
        const path = run.map((point, step) => `${step === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
        svg.append(svgElement('path', { class: 'chart-line', d: path }))
      }
      run.forEach((point, step) => {
        const lone = run.length === 1
        const last = point.index === points.length - 1 || step === run.length - 1
        if (showAllDots || lone || last) svg.append(svgElement('circle', { class: 'chart-dot', cx: point.x, cy: point.y, r: DOT_RADIUS }))
      })
    }
  }

  function drawSelection(): void {
    if (selected === null) return
    const point = place(selected)
    if (!point) return
    svg.append(
      svgElement('line', { class: 'chart-cross', x1: point.x, x2: point.x, y1: MARGIN.top, y2: height - MARGIN.bottom }),
      svgElement('circle', { class: 'chart-dot selected', cx: point.x, cy: point.y, r: SELECTED_RADIUS }),
    )
    tooltip.show(point.x, point.y, width, shortDateLabel(points[point.index]?.day ?? ''), format(point.value))
  }

  function draw(): void {
    svg.replaceChildren()
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    drawGrid()
    if (hasData) drawSeries()
    else {
      const message = svgElement('text', { class: 'chart-empty', x: (MARGIN.left + width - MARGIN.right) / 2, y: (height - MARGIN.bottom) / 2, 'text-anchor': 'middle' })
      message.textContent = options.emptyMessage
      svg.append(message)
    }
    drawSelection()
    if (hasData) {
      const hit = svgElement('rect', { class: 'chart-hit', x: MARGIN.left, y: 0, width: plotWidth(), height: height - MARGIN.bottom })
      svg.append(hit)
    }
    if (selected === null) tooltip.hide()
  }

  function select(index: number | null): void {
    if (index === selected) return
    selected = index
    draw()
  }

  function clientToX(clientX: number): number {
    const box = svg.getBoundingClientRect()
    return ((clientX - box.left) * width) / (box.width || width)
  }

  function onPointer(event: PointerEvent): void {
    if (!hasData) return
    select(nearestWithData(clientToX(event.clientX)))
  }

  if (hasData) {
    svg.addEventListener('pointerdown', onPointer)
    svg.addEventListener('pointermove', onPointer)
    svg.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') select(null)
    })
    svg.addEventListener('blur', () => select(null))
    svg.addEventListener('keydown', (event) => {
      const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (direction === 0) return
      event.preventDefault()
      select(stepFrom(selected, direction))
    })
  }

  new ResizeObserver((entries) => {
    const next = Math.round(entries[0]?.contentRect.width ?? 0)
    if (next > 0 && next !== width) {
      width = next
      draw()
    }
  }).observe(plot)

  draw()
  return el('div', 'chart', el('h3', 'chart-title', options.title), plot, dataTable(options))
}
