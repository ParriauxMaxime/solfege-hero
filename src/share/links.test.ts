import { describe, expect, it } from 'vitest'
import { LEGACY_REDIRECTS, ROUTES } from '../../scripts/routes.mjs'
import { appBase, landingUrl, routeUrl } from './links'

const PAGES = 'https://parriauxmaxime.github.io/solfege-hero/'

describe('appBase', () => {
  it('keeps the folder of the app on GitHub Pages', () => {
    expect(appBase(PAGES)).toBe(PAGES)
    expect(appBase(`${PAGES}index.html`)).toBe(PAGES)
  })

  it('drops the search and hash', () => {
    expect(appBase('https://x.test/solfege-hero/?demo#s=1234')).toBe('https://x.test/solfege-hero/')
  })

  it('returns the app folder from every route path, with or without the trailing slash', () => {
    for (const { segment } of ROUTES) {
      expect(appBase(`${PAGES}${segment}/?demo#x`)).toBe(PAGES)
      expect(appBase(`${PAGES}${segment}`)).toBe(PAGES)
    }
  })

  it('returns the app folder from a legacy path', () => {
    for (const legacy of Object.keys(LEGACY_REDIRECTS)) expect(appBase(`${PAGES}${legacy}/#x`)).toBe(PAGES)
  })

  it('works on a local server root', () => {
    expect(appBase('http://localhost:4173/')).toBe('http://localhost:4173/')
    expect(appBase('http://localhost:4173/series/')).toBe('http://localhost:4173/')
  })
})

describe('routeUrl', () => {
  it('appends the route segment', () => {
    expect(routeUrl(PAGES, 'home')).toBe(PAGES)
    expect(routeUrl(PAGES, 'scores')).toBe(`${PAGES}scores/`)
    expect(routeUrl('http://localhost:4173/', 'challenge')).toBe('http://localhost:4173/challenge/')
  })
})

describe('landingUrl', () => {
  it('points at the static landing page with the hash', () => {
    expect(landingUrl('https://x.test/solfege-hero/', 'challenge', 's=1')).toBe('https://x.test/solfege-hero/challenge/#s=1')
    expect(landingUrl('https://x.test/solfege-hero/', 'score', 'score=a')).toBe('https://x.test/solfege-hero/score/#score=a')
  })
})
