import { describe, expect, it } from 'vitest'
import { FADE_LEFT_X, FADE_RIGHT_X, HIT_X, POOL_SIZE, animatedLogoContent, edgeOpacity, splashLogoSvg, staticLogoContent } from './logoMarkup'

const definedIds = (markup: string) => [...markup.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id)
const referencedIds = (markup: string) => [...markup.matchAll(/(?:url\(#|href="#)([^)"]+)/g)].map(([, id]) => id)

const MAX_SPLASH_BYTES = 7500

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

  it('keeps the pre-rendered logo light, hidden from assistive technology and themed by css variables', () => {
    const svg = splashLogoSvg()
    expect(svg.length).toBeLessThan(MAX_SPLASH_BYTES)
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).toContain('var(--logo-gold-1)')
  })

  it('gives the scrolling logo a fixed pool of note slots', () => {
    expect(animatedLogoContent('t').split('data-k="slot"')).toHaveLength(POOL_SIZE + 1)
  })

  it('fades notes under the clef and at the right edge, solid in between', () => {
    expect(edgeOpacity(FADE_LEFT_X)).toBe(0)
    expect(edgeOpacity(HIT_X)).toBe(1)
    expect(edgeOpacity(FADE_RIGHT_X)).toBe(0)
    expect(edgeOpacity(FADE_LEFT_X + 5)).toBeCloseTo(0.5)
  })
})
