import { el } from './dom'

export interface Point {
  x: number
  y: number
}

const PARTICLE_COLORS = ['#2ee6a6', '#7c5cff', '#f2eefc', '#ffd166']
const CONFETTI_COLORS = ['#2ee6a6', '#7c5cff', '#ff4d6d', '#ffd166', '#f2eefc']
const PARTICLE_COUNT = 14
const CONFETTI_COUNT = 48

export function restartAnimation(element: Element, className: string): void {
  element.classList.remove(className)
  void element.getBoundingClientRect()
  element.classList.add(className)
}

export function centerOf(element: Element): Point {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function spawn(layer: HTMLElement, className: string, vars: Record<string, string>, text = ''): HTMLElement {
  const piece = el('span', className, text)
  for (const [name, value] of Object.entries(vars)) piece.style.setProperty(name, value)
  piece.addEventListener('animationend', () => piece.remove(), { once: true })
  layer.append(piece)
  return piece
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T
}

export function burstParticles(layer: HTMLElement, origin: Point): void {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.4
    const distance = 50 + Math.random() * 60
    spawn(layer, 'particle', {
      left: `${origin.x}px`,
      top: `${origin.y}px`,
      '--dx': `${Math.cos(angle) * distance}px`,
      '--dy': `${Math.sin(angle) * distance}px`,
      '--color': pick(PARTICLE_COLORS),
    })
  }
}

export function burstConfetti(layer: HTMLElement): void {
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    spawn(layer, 'confetti', {
      left: `${Math.random() * 100}%`,
      '--dx': `${(Math.random() - 0.5) * 160}px`,
      '--spin': `${(Math.random() - 0.5) * 1080}deg`,
      '--delay': `${Math.random() * 250}ms`,
      '--color': pick(CONFETTI_COLORS),
    })
  }
}

export function floatText(layer: HTMLElement, origin: Point, text: string, tone: 'good' | 'bad' = 'good'): void {
  spawn(layer, tone === 'bad' ? 'float-text bad' : 'float-text', { left: `${origin.x}px`, top: `${origin.y}px` }, text)
}
