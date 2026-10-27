import { t, type MessageKey } from '../i18n'
import { button, el } from './dom'

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
  const cards = STARTING_POINTS.map(({ level, title, description }) => {
    const card = button('onboarding-card', '', () => onChoose(level))
    card.append(el('strong', '', t(title)), el('span', '', t(description)))
    return card
  })
  return el(
    'section',
    'screen onboarding',
    el('h1', '', t('onboarding.title')),
    el('p', 'onboarding-lead', t('onboarding.lead')),
    el('div', 'onboarding-cards', ...cards),
    button('link-button', t('onboarding.skip'), () => onChoose(SKIP_LEVEL)),
  )
}
