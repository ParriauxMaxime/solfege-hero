import { WISP, brandDefs, flameWisp, type Relief } from '../brand/art'
import { streakFlameScale, streakRelief } from '../game/streakFlame'
import { motionReduced } from '../platform/appearance'
import { el } from './dom'

/** Art coordinates of the wisp: its base (the note head) is at 0,0 and it rises to y -140. */
export const FLAME_BOX = { x: -48, y: -140, width: 84, height: 165 }
/** Art units to staff units: a full flame is about 44 staff units tall, a bit under three staff spaces. */
export const FLAME_ART_SCALE = 0.27
/** Where a flame sits on a hollow head (staff units from its centre) so it licks the top without hiding it. */
export const FLAME_HEAD_OFFSET = { x: -2, y: -11 }

const DEFS_ID = 'sf-defs'
const PUFF_DELAYS_MS = [0, 120]
const SNUFF_FALLBACK_MS = 1200

const boxAttribute = `${FLAME_BOX.x} ${FLAME_BOX.y} ${FLAME_BOX.width} ${FLAME_BOX.height}`

/** Once per document: gradients and shapes shared by every flame, in a hidden svg that stays rendered so the gradients resolve. */
export function ensureFlameDefs(): void {
  if (document.getElementById(DEFS_ID)) return
  document.body.insertAdjacentHTML(
    'beforeend',
    `<svg id="${DEFS_ID}" aria-hidden="true" width="0" height="0" style="position:absolute">
  ${brandDefs('sf')}
  <defs>
    <g id="sf-wisp-1">${flameWisp('sf', 1)}</g>
    <g id="sf-wisp-2">${flameWisp('sf', 2)}</g>
    <path id="sf-ash" d="${WISP}" transform="rotate(-14)"/>
    <radialGradient id="sf-puff"><stop offset="0" style="stop-color:var(--smoke)" stop-opacity="0.55"/><stop offset="1" style="stop-color:var(--smoke)" stop-opacity="0"/></radialGradient>
  </defs>
</svg>`,
  )
}

export const flameUse = (relief: Relief) => `<use href="#sf-wisp-${relief}"/>`

function random(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** A flame whose base sits on the origin of its parent: `scale` is its size in px per art unit. Place it with `placeFlame`. */
export function createFlame(scale: number, relief: Relief): HTMLElement {
  ensureFlameDefs()
  const flame = el('span', 'sflame')
  flame.innerHTML = `<span class="sflame-live" style="--sf-dur:${random(1.1, 1.5).toFixed(2)}s;--sf-phase:${random(0, 0.4).toFixed(2)}s"><svg viewBox="${boxAttribute}" aria-hidden="true">${flameUse(relief)}</svg></span>`
  placeFlame(flame, 0, 0, scale)
  return flame
}

export function placeFlame(flame: HTMLElement, x: number, y: number, scale: number): void {
  flame.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
}

export function setFlameRelief(flame: HTMLElement, relief: Relief): void {
  flame.querySelector('use')?.setAttribute('href', `#sf-wisp-${relief}`)
}

/** Only the newest flames flicker: the others are drawn still. */
export function setFlameFlickering(flame: HTMLElement, flickering: boolean): void {
  flame.classList.toggle('still', !flickering)
}

/** A flame under the pinned header fades the way its note does. */
export function setFlameCovered(flame: HTMLElement, covered: boolean): void {
  flame.classList.toggle('covered', covered)
}

/** Shrinks and fades the flame with two grey puffs, then removes it. */
export function snuffFlame(flame: HTMLElement): void {
  if (flame.classList.contains('out')) return
  if (motionReduced()) {
    flame.remove()
    return
  }
  flame.classList.add('out')
  const puffs = PUFF_DELAYS_MS.map((delay) => {
    const puff = el('span', 'sflame-puff')
    puff.style.animationDelay = `${delay}ms`
    return puff
  })
  flame.append(...puffs)
  const remove = () => flame.remove()
  puffs.at(-1)?.addEventListener('animationend', remove, { once: true })
  window.setTimeout(remove, SNUFF_FALLBACK_MS)
}

export interface HudFlame {
  element: HTMLElement
  update: (streak: number) => void
}

/** The streak flame of the HUD: the unlit wisp always shown, a lit flame on top that grows with the streak and is snuffed when it breaks. */
export function createHudFlame(): HudFlame {
  ensureFlameDefs()
  const anchor = el('span', 'hud-flame-anchor')
  const element = el('span', 'hud-flame')
  element.setAttribute('aria-hidden', 'true')
  element.insertAdjacentHTML('afterbegin', `<svg class="hud-flame-ash" viewBox="${boxAttribute}"><use href="#sf-ash"/></svg>`)
  element.append(anchor)
  let lit: HTMLElement | null = null

  return {
    element,
    update(streak) {
      const scale = streakFlameScale(streak)
      if (scale === 0) {
        if (lit) snuffFlame(lit)
        lit = null
        return
      }
      const relief = streakRelief(streak)
      if (lit) {
        placeFlame(lit, 0, 0, scale)
        setFlameRelief(lit, relief)
        return
      }
      lit = createFlame(scale, relief)
      anchor.append(lit)
    },
  }
}
