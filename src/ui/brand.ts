import { t } from '../i18n'
import { createBrandLogo } from './brandLogo'
import { el } from './dom'

export function renderBrand(withTagline = true): HTMLElement {
  const title = el('h1', 'home-title', 'Solfège hero')
  return el('div', 'home-brand', createBrandLogo('brand-logo home-logo'), title, ...(withTagline ? [el('p', 'home-tagline', t('home.tagline'))] : []))
}
