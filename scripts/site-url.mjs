import { LANDING_ONLY, ROUTES } from './routes.mjs'

export const DEFAULT_SITE_URL = 'https://parriauxmaxime.github.io/solfege-hero/'

export function normalizeSiteUrl(raw) {
  const url = new URL(raw?.trim() || DEFAULT_SITE_URL)
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  url.search = ''
  url.hash = ''
  return url.href
}

/** Absolute path of the site root ('/solfege-hero/' or '/'): the `<base href>` of every html page. */
export function siteBasePath(siteUrl) {
  return new URL(siteUrl).pathname
}

export function siteHost(siteUrl) {
  return new URL(siteUrl).hostname
}

export function isGithubPagesHost(host) {
  return host === 'github.io' || host.endsWith('.github.io')
}

export function customDomain(siteUrl) {
  const host = siteHost(siteUrl)
  return isGithubPagesHost(host) ? null : host
}

export function sitePaths() {
  return [...ROUTES, ...LANDING_ONLY].map(({ segment }) => (segment ? `${segment}/` : ''))
}

export const LANGUAGE_PREFIXES = ['fr', 'en']

/** Every indexable path: the root pages, then the fr/ and en/ ones. */
export function allSitePaths() {
  return [...sitePaths(), ...LANGUAGE_PREFIXES.flatMap((prefix) => sitePaths().map((path) => `${prefix}/${path}`))]
}

export function renderSitemap(siteUrl, lastmod) {
  const urls = allSitePaths().map((path) => {
    const rest = path.replace(/^(fr|en)\/?/, '')
    const alternates = [...LANGUAGE_PREFIXES.map((code) => [code, `${code}/${rest}`]), ['x-default', rest]]
      .map(([code, target]) => `<xhtml:link rel="alternate" hreflang="${code}" href="${siteUrl}${target}"/>`)
      .join('')
    return `  <url><loc>${siteUrl}${path}</loc><lastmod>${lastmod}</lastmod>${alternates}</url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
}

export function renderRobots(siteUrl) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`
}

export function renderHumans(siteUrl) {
  return `/* TEAM */\nAuthor: Maxime Parriaux\nSite: ${siteUrl}\n\n/* SITE */\nLanguage: French\nTools: Vite, TypeScript\n`
}
