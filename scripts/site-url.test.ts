import { describe, expect, it } from 'vitest'
import { DEFAULT_SITE_URL, customDomain, normalizeSiteUrl, renderRobots, renderSitemap, siteHost } from './site-url.mjs'

describe('site url', () => {
  it('defaults to the github pages url', () => {
    expect(normalizeSiteUrl(undefined)).toBe(DEFAULT_SITE_URL)
    expect(normalizeSiteUrl('  ')).toBe(DEFAULT_SITE_URL)
  })

  it('always ends with a slash and drops query and hash', () => {
    expect(normalizeSiteUrl('https://example.org')).toBe('https://example.org/')
    expect(normalizeSiteUrl('https://example.org/app?x=1#y')).toBe('https://example.org/app/')
  })

  it('extracts the host and detects custom domains', () => {
    expect(siteHost('https://example.org/')).toBe('example.org')
    expect(customDomain('https://example.org/')).toBe('example.org')
    expect(customDomain(DEFAULT_SITE_URL)).toBeNull()
  })

  it('renders sitemap and robots from the site url', () => {
    expect(renderSitemap('https://example.org/', '2026-01-01')).toContain('<loc>https://example.org/challenge/</loc>')
    expect(renderRobots('https://example.org/')).toContain('Sitemap: https://example.org/sitemap.xml')
  })
})
