import { t, type MessageKey } from '../i18n'
import { renderBrand } from './brand'
import { button, el } from './dom'
import { icon } from './icons'

export const SKIP_LEVEL = 30

interface StartingPoint {
  level: number
  title: MessageKey
  description: MessageKey
}

const STARTING_POINTS: readonly StartingPoint[] = [
  { level: 0, title: 'onboarding.beginner.title', description: 'onboarding.beginner.description' },
  { level: SKIP_LEVEL, title: 'onboarding.slow.title', description: 'onboarding.slow.description' },
  { level: 60, title: 'onboarding.fluent.title', description: 'onboarding.fluent.description' },
]

export interface OnboardingOptions {
  onChoose: (level: number) => void
}

export function createOnboarding({ onChoose }: OnboardingOptions): HTMLElement {
  let selected = SKIP_LEVEL
  const cards = STARTING_POINTS.map(({ level, title, description }) => {
    const mark = icon('check')
    mark.classList.add('onboarding-check')
    const card = button('onboarding-card', '', () => {
      selected = level
      refresh()
    })
    card.append(el('strong', '', t(title)), el('span', '', t(description)), mark)
    return { level, card }
  })
  const refresh = () => {
    for (const { level, card } of cards) {
      card.classList.toggle('selected', level === selected)
      card.setAttribute('aria-pressed', String(level === selected))
    }
  }
  refresh()
  return el(
    'section',
    'screen onboarding',
    renderBrand(false),
    el('h2', 'onboarding-title', t('onboarding.title')),
    el('p', 'onboarding-lead', t('onboarding.lead')),
    el('div', 'onboarding-cards', ...cards.map(({ card }) => card)),
    button('primary onboarding-continue', t('onboarding.continue'), () => onChoose(selected)),
    button('link-button', t('onboarding.skip'), () => onChoose(SKIP_LEVEL)),
  )
}
