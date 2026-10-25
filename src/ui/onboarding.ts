import { button, el } from './dom'

export const SKIP_LEVEL = 30

interface StartingPoint {
  level: number
  title: string
  description: string
}

const STARTING_POINTS: readonly StartingPoint[] = [
  { level: 0, title: 'Je débute', description: 'Notes sur la portée, sans armure ni altération' },
  { level: SKIP_LEVEL, title: 'Je lis lentement', description: 'Altérations et armures simples' },
  { level: 60, title: 'Je lis déjà', description: 'Armures jusqu’à 4 dièses ou bémols, une ligne en plus' },
]

export interface OnboardingOptions {
  onChoose: (level: number) => void
}

export function createOnboarding({ onChoose }: OnboardingOptions): HTMLElement {
  const cards = STARTING_POINTS.map(({ level, title, description }) => {
    const card = button('onboarding-card', '', () => onChoose(level))
    card.append(el('strong', '', title), el('span', '', description))
    return card
  })
  return el(
    'section',
    'screen onboarding',
    el('h1', '', 'Où en es-tu ?'),
    el('p', 'onboarding-lead', 'Le jeu s’adapte ensuite à toi.'),
    el('div', 'onboarding-cards', ...cards),
    button('link-button', 'Passer', () => onChoose(SKIP_LEVEL)),
  )
}
