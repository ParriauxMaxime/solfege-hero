import { t } from '../../i18n'
import { button, el } from '../dom'

const CHOICES = [0, 1, 2]

export interface StaffPicker {
  element: HTMLElement
  value: () => number
}

/** Which staff of every system is read: 1 is the top one, where the melody usually is. */
export function createStaffPicker(initial: number, onChange: (staffIndex: number) => boolean | Promise<boolean>): StaffPicker {
  let current = initial
  const buttons = CHOICES.map((choice) =>
    button('segment', String(choice + 1), async () => {
      if (choice === current) return
      const previous = current
      current = choice
      refresh()
      if (await onChange(choice)) return
      current = previous
      refresh()
    }),
  )
  const group = el('div', 'segmented', ...buttons)
  const element = el('div', 'omr-field', el('span', 'omr-label', t('omr.settings.staff')), group)

  function refresh(): void {
    buttons.forEach((candidate, index) => candidate.classList.toggle('active', index === current))
  }

  refresh()
  return { element, value: () => current }
}
