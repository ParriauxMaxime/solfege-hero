import { FX_WAVE_OPACITY, emberCount, fxStillFrame } from '../brand/streakFx'

/** Burning notes that breathe (animated aura); the older ones keep a static aura and a hot head. */
export const FX_LIVE_CAP = 6
/** Burning notes that also send embers and heat waves. */
export const FX_RICH_CAP = 4
/** Embers a note keeps under reduced motion (frozen). */
export const FX_FROZEN_EMBERS = 2

/** Index, among `count` burning notes oldest first, of the first one inside the newest `cap`. */
export function liveFxStart(count: number, cap: number): number {
  return Math.max(0, count - cap)
}

/** Static look shared by every burning note at an intensity: the css custom properties are set from it once per answer. */
export interface FxLook {
  /** Scale of an aura drawn at its gradient radius (1 = 20 staff units). */
  auraScale: number
  auraOpacity: number
  /** Opacity of the white-hot overlay on the head. */
  heat: number
  emberOpacity: number
  waveOpacity: number
  /** Embers a rich note sends. */
  embers: number
}

export function fxLook(intensity: number): FxLook {
  const level = Math.max(0, Math.min(1, intensity))
  const still = fxStillFrame(level)
  return {
    auraScale: still.aura.scale,
    auraOpacity: still.aura.opacity,
    heat: still.heat,
    emberOpacity: 0.5 + 0.5 * level,
    waveOpacity: FX_WAVE_OPACITY * (0.25 + 0.45 * level),
    embers: emberCount(level),
  }
}
