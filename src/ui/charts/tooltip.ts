import { el } from '../dom'

export interface Tooltip {
  element: HTMLElement
  show: (x: number, y: number, containerWidth: number, label: string, value: string) => void
  hide: () => void
}

const EDGE_SHARE = 0.3
const LIFT_PX = 38

export function createTooltip(): Tooltip {
  const date = el('span', 'chart-tip-label')
  const value = el('strong', 'chart-tip-value')
  const element = el('div', 'chart-tip', date, el('span', 'chart-tip-sep', ' · '), value)
  element.hidden = true
  element.setAttribute('aria-live', 'polite')

  return {
    element,
    show(x, y, containerWidth, label, text) {
      date.textContent = label
      value.textContent = text
      element.hidden = false
      element.style.left = `${x}px`
      element.style.top = `${Math.max(0, y - LIFT_PX)}px`
      const share = x / containerWidth
      element.dataset.align = share < EDGE_SHARE ? 'start' : share > 1 - EDGE_SHARE ? 'end' : 'center'
    },
    hide() {
      element.hidden = true
    },
  }
}
