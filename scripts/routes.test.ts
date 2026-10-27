import { describe, expect, it } from 'vitest'
import { LANDING_ONLY, LEGACY_REDIRECTS, ROUTES, appBasePath, routePath, routeSegments, screenFromPath } from './routes.mjs'

describe('routes', () => {
  it('maps every path to its screen and back', () => {
    for (const { screen, segment } of [...ROUTES, ...LANDING_ONLY]) {
      expect(routePath(screen)).toBe(segment)
      expect(screenFromPath(`/${segment}${segment ? '/' : ''}`)).toBe(screen)
      if (segment) expect(screenFromPath(`/solfege-hero/${segment}/`)).toBe(screen)
    }
  })

  it('tolerates a missing trailing slash and index.html', () => {
    expect(screenFromPath('/solfege-hero/series')).toBe('series')
    expect(screenFromPath('/solfege-hero/series/index.html')).toBe('series')
    expect(screenFromPath('/')).toBe('home')
    expect(screenFromPath('/index.html')).toBe('home')
  })

  it('returns null for unknown and legacy paths, and for a home under a sub-folder (callers treat null as home)', () => {
    expect(screenFromPath('/solfege-hero/')).toBeNull()
    expect(screenFromPath('/solfege-hero/nope/')).toBeNull()
    expect(screenFromPath('/solfege-hero/apprendre/')).toBeNull()
  })

  it('extracts the app base from any route path', () => {
    expect(appBasePath('/solfege-hero/')).toBe('/solfege-hero/')
    expect(appBasePath('/solfege-hero/series/')).toBe('/solfege-hero/')
    expect(appBasePath('/solfege-hero/series')).toBe('/solfege-hero/')
    expect(appBasePath('/')).toBe('/')
    expect(appBasePath('/learn/')).toBe('/')
    expect(appBasePath('/solfege-hero/index.html')).toBe('/solfege-hero/')
    expect(appBasePath('/solfege-hero/apprendre/')).toBe('/solfege-hero/')
    expect(appBasePath('/solfege-hero/learn/index.html')).toBe('/solfege-hero/')
  })

  it('lists every legacy target as a page', () => {
    const segments = routeSegments()
    for (const target of Object.values(LEGACY_REDIRECTS)) expect(segments).toContain(target)
  })
})
