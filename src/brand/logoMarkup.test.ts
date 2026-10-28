import { describe, expect, it } from 'vitest'
import { QUARTER_REST_PATH as GLYPH_QUARTER_REST_PATH } from '../ui/glyphs'
import {
  FADE_LEFT_X,
  FADE_RIGHT_X,
  HIT_X,
  POOL_SIZE,
  PX_PER_BEAT,
  QUARTER_REST_PATH,
  animatedLogoContent,
  edgeOpacity,
  splashLogoSvg,
  staticLogoContent,
} from './logoMarkup'

const definedIds = (markup: string) => [...markup.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id)
const referencedIds = (markup: string) => [...markup.matchAll(/(?:url\(#|href="#)([^)"]+)/g)].map(([, id]) => id)
/** Every `var(--name)` without a fallback colour: it would paint nothing where the stylesheet is missing. */
const bareVariables = (markup: string) => [...markup.matchAll(/var\(--[\w-]+\)/g)].map(([variable]) => variable)

const MAX_SPLASH_BYTES = 9500

describe('logo markup', () => {
  it('resolves every gradient and symbol it references, with unique ids', () => {
    for (const markup of [staticLogoContent('t'), animatedLogoContent('t')]) {
      const ids = definedIds(markup)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of referencedIds(markup)) expect(ids).toContain(id)
    }
  })

  it('draws with gradients and opacity only, never a filter', () => {
    for (const markup of [staticLogoContent('t'), animatedLogoContent('t')]) expect(markup).not.toMatch(/filter|blur/i)
  })

  it('keeps the pre-rendered logo light, hidden from assistive technology and themed by css variables with fallbacks', () => {
    const svg = splashLogoSvg()
    expect(svg.length).toBeLessThan(MAX_SPLASH_BYTES)
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).toContain('var(--logo-gold-1, ')
    expect(bareVariables(svg)).toEqual([])
    expect(bareVariables(animatedLogoContent('t'))).toEqual([])
  })

  it('draws the still frame with three hot notes, a quarter rest and plain notes still to come', () => {
    const svg = staticLogoContent('t')
    expect(svg.split(QUARTER_REST_PATH)).toHaveLength(2)
    expect(svg.match(/url\(#t-aura\)/g)).toHaveLength(3)
    expect(svg.match(/<ellipse rx="10.5" ry="7.5" transform="rotate\(-20\)" fill="currentColor"\/>/g)).toHaveLength(3)
  })

  it('heats the still notes more toward the hit spot', () => {
    const heats = [...staticLogoContent('t').matchAll(/url\(#t-heat\)" opacity="([\d.]+)"/g)].map(([, opacity]) => Number(opacity))
    expect(heats).toHaveLength(3)
    expect(heats[0]).toBeLessThan(heats[1] as number)
    expect(heats[1]).toBeLessThan(heats[2] as number)
  })

  it('copies the quarter rest of the notation glyphs', () => {
    expect(QUARTER_REST_PATH).toBe(GLYPH_QUARTER_REST_PATH)
  })

  it('gives the scrolling logo a fixed pool of beat slots, each with a rest and an aura', () => {
    const animated = animatedLogoContent('t')
    expect(animated.split('data-k="slot"')).toHaveLength(POOL_SIZE + 1)
    expect(animated.split('data-k="rest"')).toHaveLength(POOL_SIZE + 1)
    expect(animated.split('data-k="aura"')).toHaveLength(POOL_SIZE + 1)
  })

  it('has enough slots to keep the whole wide staff filled while notes scroll', () => {
    expect(POOL_SIZE * PX_PER_BEAT).toBeGreaterThan(FADE_RIGHT_X - FADE_LEFT_X + 12 + PX_PER_BEAT)
  })

  it('fades notes under the clef and at the right edge, solid in between', () => {
    expect(edgeOpacity(FADE_LEFT_X)).toBe(0)
    expect(edgeOpacity(HIT_X)).toBe(1)
    expect(edgeOpacity(FADE_RIGHT_X)).toBe(0)
    expect(edgeOpacity(FADE_LEFT_X + 5)).toBeCloseTo(0.5)
  })
})
