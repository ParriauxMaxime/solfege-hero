import { fxDefs, fxIntensity, hotHeadMarkup, isLit } from '../brand/streakFx'
import { fxLook } from '../game/streakFxCaps'
import { motionReduced } from '../platform/appearance'
import { el } from './dom'

/** Streak from which the lit head sends embers. */
const SPARKS_STREAK = 5
const HEAD = { rx: 7, ry: 5 }
const PLAIN_TILT = -20

let instances = 0

export interface HudStreak {
  element: HTMLElement
  update: (streak: number) => void
}

const fixed = (value: number) => String(Number(value.toFixed(2)))

/**
 * The streak icon of the HUD: a note head, flat in the dim ink at streak 0, then hot gold with a halo behind it
 * (and embers from a streak of 5). A break snuffs it with one grey puff and the head cools back.
 * Everything that moves is a css animation on transform and opacity; the values per streak are custom properties set on change only.
 */
export function createHudStreak(): HudStreak {
  const prefix = `hud-fx-${instances++}`
  const element = el('span', 'hud-fx')
  element.setAttribute('aria-hidden', 'true')
  element.innerHTML = `<span class="hud-fx-aura"><span class="hud-fx-glow"></span></span>
<svg class="hud-fx-svg" viewBox="-10 -10 20 20">${fxDefs(prefix)}
  <ellipse class="hud-fx-plain" rx="${HEAD.rx}" ry="${HEAD.ry}" transform="rotate(${PLAIN_TILT})" fill="currentColor"/>
  <g class="hud-fx-hot">${hotHeadMarkup(prefix, 'filled', HEAD)}</g>
</svg>
<span class="hud-fx-ember"></span><span class="hud-fx-ember second"></span>`
  let last = 0

  function puff(): void {
    if (motionReduced()) return
    const smoke = el('span', 'hud-fx-smoke')
    smoke.addEventListener('animationend', () => smoke.remove(), { once: true })
    element.append(smoke)
  }

  return {
    element,
    update(streak) {
      if (streak === last) return
      const wasLit = isLit(last)
      last = streak
      const lit = isLit(streak)
      if (wasLit && !lit) puff()
      element.classList.toggle('lit', lit)
      element.classList.toggle('sparks', streak >= SPARKS_STREAK)
      if (!lit) return
      const look = fxLook(fxIntensity(streak))
      element.style.setProperty('--fx-aura-s', fixed(look.auraScale))
      element.style.setProperty('--fx-aura-o', fixed(look.auraOpacity))
      element.style.setProperty('--fx-heat', fixed(look.heat))
    },
  }
}
