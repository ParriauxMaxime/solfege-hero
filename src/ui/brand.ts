import { t } from '../i18n'
import { el } from './dom'
import { clefGlyph, inkGroup, ledgerLines, noteHead, staffLines, stem, stepY, svgElement } from './glyphs'

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

export function renderBrand(withTagline = true): HTMLElement {
  const title = el('h1', 'home-title', 'Solfège hero')
  return el('div', 'home-brand', logoStaff(), title, ...(withTagline ? [el('p', 'home-tagline', t('home.tagline'))] : []))
}
