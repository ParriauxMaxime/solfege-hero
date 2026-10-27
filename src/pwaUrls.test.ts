import { describe, expect, it } from 'vitest'
import { appBase } from './share/links'
import { workerRegistration } from './pwaUrls'

describe('workerRegistration', () => {
  it('derives an absolute script and scope from the base', () => {
    expect(workerRegistration('https://x.test/solfege-hero/')).toEqual({ script: 'https://x.test/solfege-hero/sw.js', scope: '/solfege-hero/' })
    expect(workerRegistration('https://x.test/')).toEqual({ script: 'https://x.test/sw.js', scope: '/' })
  })

  it('agrees with appBase whichever path serves the html', () => {
    const base = 'https://x.test/solfege-hero/'
    for (const path of ['', 'daily/', 'en/learn/', 'fr/', 'challenge/']) {
      expect(appBase(`${base}${path}#daily=1`)).toBe(base)
      expect(new URL(workerRegistration(base).script).pathname).toBe('/solfege-hero/sw.js')
    }
  })
})
