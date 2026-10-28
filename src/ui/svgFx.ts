import type { FxFrameValues, FxPart } from '../brand/streakFx'

type Setter = (value: string) => void

/** Writes an attribute only when its value changed since the last write. */
function attribute(element: Element, name: string): Setter {
  let last = element.getAttribute(name)
  return (value) => {
    if (value === last) return
    last = value
    element.setAttribute(name, value)
  }
}

const fixed = (value: number) => value.toFixed(2)

interface Sprite {
  opacity: Setter
  transform: Setter
}

const sprite = (element: Element): Sprite => ({ opacity: attribute(element, 'opacity'), transform: attribute(element, 'transform') })

const placed = ({ x, y, scale }: FxPart) => `translate(${fixed(x)} ${fixed(y)}) scale(${fixed(scale)})`
const waved = ({ x, y, scale }: FxPart) => `translate(${fixed(x)} ${fixed(y)}) scale(1 ${fixed(scale)})`

function applyAll(targets: Sprite[], parts: FxPart[], transform: (part: FxPart) => string): void {
  targets.forEach((target, index) => {
    const part = parts[index]
    if (!part) return
    target.opacity(fixed(part.opacity))
    if (part.opacity > 0) target.transform(transform(part))
  })
}

export interface FxBinding {
  /** Puts every layer out (opacity 0). */
  hide(): void
  update(values: FxFrameValues): void
}

/** Binds the layers made by `fxBehindMarkup`, `fxFrontMarkup` and `hotHeadMarkup` found under `root` (data-k attributes). */
export function bindFx(root: Element): FxBinding {
  const all = (key: string) => [...root.querySelectorAll(`[data-k=${key}]`)]
  const one = (key: string) => root.querySelector(`[data-k=${key}]`)
  const aura = one('aura')
  const flash = one('flash')
  const heatElement = one('heat')
  const auraSprite = aura && sprite(aura)
  const flashSprite = flash && sprite(flash)
  const heat = heatElement && attribute(heatElement, 'opacity')
  const waves = all('wave').map(sprite)
  const embers = all('ember').map(sprite)
  const smokes = all('smoke').map(sprite)

  return {
    hide() {
      auraSprite?.opacity('0')
      flashSprite?.opacity('0')
      heat?.('0')
      for (const part of [...waves, ...embers, ...smokes]) part.opacity('0')
    },
    update(values) {
      if (auraSprite) {
        auraSprite.opacity(fixed(values.aura.opacity))
        if (values.aura.opacity > 0) auraSprite.transform(`scale(${fixed(values.aura.scale)})`)
      }
      heat?.(fixed(values.heat))
      if (flashSprite) {
        flashSprite.opacity(fixed(values.flash.opacity))
        if (values.flash.opacity > 0) flashSprite.transform(`scale(${fixed(values.flash.scale)})`)
      }
      applyAll(waves, values.waves, waved)
      applyAll(embers, values.embers, placed)
      applyAll(smokes, values.smokes, placed)
    },
  }
}
