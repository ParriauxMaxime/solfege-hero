import { button, el } from './dom'

export function confirmOverlay(host: HTMLElement, message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const close = (answer: boolean) => {
      overlay.remove()
      resolve(answer)
    }
    const overlay = el(
      'div',
      'overlay confirm-overlay',
      el(
        'div',
        'result',
        el('h2', '', message),
        button('danger', confirmLabel, () => close(true)),
        button('primary', cancelLabel, () => close(false)),
      ),
    )
    host.append(overlay)
  })
}
