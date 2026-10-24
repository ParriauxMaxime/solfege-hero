import { el } from './dom'

export function showToast(message: string): void {
  const toast = el('div', 'toast', message)
  toast.addEventListener('animationend', () => toast.remove(), { once: true })
  document.body.append(toast)
}
