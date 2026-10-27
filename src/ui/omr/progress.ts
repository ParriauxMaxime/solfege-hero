import { t, type MessageKey } from '../../i18n'
import { formatPercent } from '../../i18n/format'
import type { OmrStage } from '../../omr/types'
import { button, el } from '../dom'
import { icon } from '../icons'

export type ProgressStep = 'read' | OmrStage

const STEP_KEYS = {
  read: 'omr.progress.steps.read',
  preprocess: 'omr.progress.steps.preprocess',
  staves: 'omr.progress.steps.staves',
  symbols: 'omr.progress.steps.symbols',
  music: 'omr.progress.steps.music',
} satisfies Record<ProgressStep, MessageKey>

const STEPS = Object.keys(STEP_KEYS) as ProgressStep[]

export interface ProgressScreen {
  element: HTMLElement
  update: (step: ProgressStep, percent: number) => void
  fail: (message: string) => void
}

export interface ProgressOptions {
  onCancel: () => void
  onBack: () => void
}

export function createProgress({ onCancel, onBack }: ProgressOptions): ProgressScreen {
  const fill = el('div', 'omr-bar-fill')
  const bar = el('div', 'omr-bar', fill)
  bar.setAttribute('role', 'progressbar')
  bar.setAttribute('aria-valuemin', '0')
  bar.setAttribute('aria-valuemax', '100')
  const percentLabel = el('span', 'omr-percent', formatPercent(0))
  const items = new Map<ProgressStep, HTMLElement>(STEPS.map((step) => [step, el('li', 'omr-step', t(STEP_KEYS[step]))]))
  const heading = el('h2', '', t('omr.progress.heading'))
  const errorText = el('p', 'omr-error')
  errorText.hidden = true
  const cancel = button('segment-button', t('omr.progress.cancel'), onCancel)
  const back = button('primary', t('omr.progress.back'), onBack)
  back.hidden = true
  const element = el('section', 'omr-progress', heading, el('div', 'omr-bar-row', bar, percentLabel), el('ol', 'omr-steps', ...items.values()), errorText, cancel, back)

  function update(step: ProgressStep, percent: number): void {
    const current = STEPS.indexOf(step)
    STEPS.forEach((name, index) => {
      const item = items.get(name) as HTMLElement
      item.classList.toggle('done', index < current)
      item.classList.toggle('current', index === current)
      item.querySelector('svg')?.remove()
      if (index < current) item.prepend(icon('check'))
    })
    const rounded = Math.round(percent)
    fill.style.width = `${rounded}%`
    bar.setAttribute('aria-valuenow', String(rounded))
    percentLabel.textContent = formatPercent(rounded / 100)
  }

  function fail(message: string): void {
    heading.textContent = t('omr.progress.failed')
    errorText.textContent = message
    errorText.hidden = false
    cancel.hidden = true
    back.hidden = false
  }

  update('read', 0)
  return { element, update, fail }
}
