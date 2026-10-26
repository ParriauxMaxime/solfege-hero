export const DEFAULT_SITE_URL = 'https://parriauxmaxime.github.io/solfege-hero/'
export const LANDING_PAGES = ['defi', 'survie', 'hero', 'jour', 'partition']

export function normalizeSiteUrl(raw) {
  const url = new URL(raw?.trim() || DEFAULT_SITE_URL)
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  url.search = ''
  url.hash = ''
  return url.href
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
  return ['', ...LANDING_PAGES.map((page) => `${page}/`)]
}

export function renderSitemap(siteUrl, lastmod) {
  const urls = sitePaths().map((path) => `  <url><loc>${siteUrl}${path}</loc><lastmod>${lastmod}</lastmod></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function renderRobots(siteUrl) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`
}

export function renderHumans(siteUrl) {
  return `/* TEAM */\nAuthor: Maxime Parriaux\nSite: ${siteUrl}\n\n/* SITE */\nLanguage: French\nTools: Vite, TypeScript\n`
}
