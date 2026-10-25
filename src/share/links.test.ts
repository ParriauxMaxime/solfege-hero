import { describe, expect, it } from 'vitest'
import { appBase, landingUrl } from './links'

describe('appBase', () => {
  it('keeps the folder of the app on GitHub Pages', () => {
    expect(appBase('https://parriauxmaxime.github.io/solfege-hero/')).toBe('https://parriauxmaxime.github.io/solfege-hero/')
    expect(appBase('https://parriauxmaxime.github.io/solfege-hero/index.html')).toBe('https://parriauxmaxime.github.io/solfege-hero/')
  })

  it('drops the search and hash', () => {
    expect(appBase('https://x.test/solfege-hero/?demo#s=1234')).toBe('https://x.test/solfege-hero/')
  })

  it('works on a local server root', () => {
    expect(appBase('http://localhost:4173/')).toBe('http://localhost:4173/')
  })
})

describe('landingUrl', () => {
  it('points at the static landing page with the hash', () => {
    expect(landingUrl('https://x.test/solfege-hero/', 'defi', 's=1')).toBe('https://x.test/solfege-hero/defi/#s=1')
  })
})
