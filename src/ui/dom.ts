export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (className) element.className = className
  element.append(...children)
  return element
}

export function trackPressed(element: HTMLElement): void {
  element.addEventListener('pointerdown', () => element.classList.add('pressed'))
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    element.addEventListener(type, () => element.classList.remove('pressed'))
  }
}

export function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const element = el('button', className, label)
  element.type = 'button'
  element.addEventListener('click', onClick)
  trackPressed(element)
  return element
}
