import { shortDateLabel } from '../../stats/dates'
import { heatmapGrid, type HeatCell, type HeatLevel } from '../../stats/heatmap'
import type { DayKey, History } from '../../stats/history'
import { el } from '../dom'
import { svgElement } from '../glyphs'
import { plural } from '../plural'

const CELL = 16
const GAP = 2
const PITCH = CELL + GAP
const LEFT = 14
const TOP = 14
const WEEKDAY_LABELS: Record<number, string> = { 0: 'L', 2: 'M', 4: 'V' }
const LEVELS: HeatLevel[] = [0, 1, 2, 3, 4]
const IDLE_READOUT = 'Touche un jour pour voir le détail.'

export function describeCell(cell: HeatCell): string {
  const label = shortDateLabel(cell.day)
  if (cell.answered === 0) return `${label} · aucune réponse`
  const percent = Math.round((cell.correct / cell.answered) * 100)
  return `${label} · ${cell.answered} ${plural(cell.answered, 'réponse', 'réponses')} · ${percent} %`
}

function monthLabels(grid: HeatCell[][]): { column: number; text: string }[] {
  const labels: { column: number; text: string }[] = []
  grid.forEach((week, column) => {
    const first = week.find((cell) => cell.day.endsWith('-01'))
    if (first) labels.push({ column, text: shortDateLabel(first.day).split(' ')[1] ?? '' })
  })
  if (labels.length === 0 || (labels[0]?.column ?? 0) > 1) {
    const start = grid[0]?.[0]
    if (start) labels.unshift({ column: 0, text: shortDateLabel(start.day).split(' ')[1] ?? '' })
  }
  return labels
}

function swatch(level: HeatLevel): SVGSVGElement {
  const svg = svgElement('svg', { class: 'heat-swatch', viewBox: `0 0 ${CELL} ${CELL}`, 'aria-hidden': 'true' })
  svg.append(svgElement('rect', { class: `heat-cell heat-l${level}`, width: CELL, height: CELL, rx: 2 }))
  return svg
}

export function createHeatmap(history: History, today: DayKey, weeks = 16): HTMLElement {
  const grid = heatmapGrid(history, today, weeks)
  const width = LEFT + weeks * PITCH - GAP
  const height = TOP + 7 * PITCH - GAP
  const playedDays = grid.flat().filter((cell) => cell.answered > 0).length
  const svg = svgElement('svg', {
    class: 'heat-svg',
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': `Activité des ${weeks} dernières semaines : ${playedDays} ${plural(playedDays, 'jour joué', 'jours joués')}`,
  })
  svg.setAttribute('tabindex', '0')
  const readout = el('p', 'heat-readout', IDLE_READOUT)
  readout.setAttribute('aria-live', 'polite')
  const rects = new Map<DayKey, SVGRectElement>()
  let selected: HeatCell | null = null

  for (const { column, text } of monthLabels(grid)) {
    const label = svgElement('text', { class: 'chart-axis', x: LEFT + column * PITCH, y: TOP - 4 })
    label.textContent = text
    svg.append(label)
  }
  for (const [row, text] of Object.entries(WEEKDAY_LABELS)) {
    const label = svgElement('text', { class: 'chart-axis', x: 0, y: TOP + Number(row) * PITCH + CELL - 4 })
    label.textContent = text
    svg.append(label)
  }

  function select(cell: HeatCell | null): void {
    if (selected) rects.get(selected.day)?.classList.remove('selected')
    selected = cell
    if (cell) rects.get(cell.day)?.classList.add('selected')
    readout.textContent = cell ? describeCell(cell) : IDLE_READOUT
  }

  grid.forEach((week, column) => {
    week.forEach((cell, row) => {
      if (cell.future) return
      const rect = svgElement('rect', {
        class: `heat-cell heat-l${cell.level}`,
        x: LEFT + column * PITCH,
        y: TOP + row * PITCH,
        width: CELL,
        height: CELL,
        rx: 2,
      })
      rect.addEventListener('click', () => select(cell))
      rect.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') select(cell)
      })
      rects.set(cell.day, rect)
      svg.append(rect)
    })
  })

  svg.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') select(null)
  })
  svg.addEventListener('blur', () => select(null))
  svg.addEventListener('keydown', (event) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const current = selected ?? grid.flat().filter((cell) => !cell.future).pop() ?? null
    if (!current) return
    if (!selected) return select(current)
    const column = grid.findIndex((week) => week.includes(current))
    const row = grid[column]?.indexOf(current) ?? 0
    const next = grid[column + move[0]]?.[row + move[1]]
    if (next && !next.future) select(next)
  })

  const legend = el(
    'div',
    'heat-legend',
    el('span', '', 'Moins'),
    ...LEVELS.map(swatch),
    el('span', '', 'Plus'),
  )
  return el('div', 'heatmap', svg, legend, readout)
}
