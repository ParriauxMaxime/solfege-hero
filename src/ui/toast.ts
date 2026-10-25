import { button, el } from './dom'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  action?: ToastAction
  /** Extra class, e.g. a celebratory animation. */
  className?: string
}

export function showToast(message: string, { action, className }: ToastOptions = {}): void {
  const toast = el('div', ['toast', action ? 'toast-action' : '', className ?? ''].filter(Boolean).join(' '), message)
  if (action) {
    toast.append(
      button('toast-button', action.label, () => {
        action.onClick()
        toast.remove()
      }),
    )
  }
  toast.addEventListener('animationend', (event) => {
    if (event.animationName === 'toast') toast.remove()
  })
  document.body.append(toast)
}
