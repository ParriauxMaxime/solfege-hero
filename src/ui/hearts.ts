import { t } from '../i18n'
import { MAX_LIVES } from '../survival/game'
import { el } from './dom'
import { svgElement } from './glyphs'

const WHOLE = 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z'
const LEFT_HALF = 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8L10.5 11 13.5 14z'
const RIGHT_HALF = 'M12 21s8-5.2 8-11a4.5 4.5 0 0 0-8-2.8L10.5 11 13.5 14z'

export interface Hearts {
  element: HTMLElement
  /** Breaks the heart at `index` (0 is the leftmost). */
  breakAt: (index: number) => void
}

function heart(): SVGSVGElement {
  const svg = svgElement('svg', { viewBox: '0 0 24 24', class: 'heart', 'aria-hidden': 'true' })
  svg.append(svgElement('path', { d: WHOLE, fill: 'currentColor' }))
  return svg
}

export function createHearts(): Hearts {
  const hearts = Array.from({ length: MAX_LIVES }, heart)
  const element = el('div', 'hearts', ...hearts)
  element.setAttribute('role', 'img')
  element.setAttribute('aria-label', t('survival.hearts', { count: MAX_LIVES }))

  return {
    element,
    breakAt(index) {
      const target = hearts[index]
      if (!target) return
      target.classList.add('lost')
      target.replaceChildren(
        svgElement('path', { d: LEFT_HALF, fill: 'currentColor', class: 'heart-half left' }),
        svgElement('path', { d: RIGHT_HALF, fill: 'currentColor', class: 'heart-half right' }),
      )
      element.setAttribute('aria-label', t('survival.heartsLeft', { count: hearts.filter((candidate) => !candidate.classList.contains('lost')).length }))
    },
  }
}
