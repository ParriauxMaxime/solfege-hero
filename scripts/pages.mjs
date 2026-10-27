import { PAGE_IMAGES, PAGE_TEXTS } from './page-texts.mjs'
import { siteBasePath } from './site-url.mjs'
import { LANDING_ONLY, LEGACY_REDIRECTS, ROUTES, routeSegments } from './routes.mjs'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const LANGUAGES = ['fr', 'en']
const NOSCRIPT_EN = 'Solfège hero is a training app to learn to read music notes. JavaScript is required: enable it in your browser.'

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character])
}

function replaceOnce(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`index.html has no ${label}: the page generator needs updating`)
  return html.replace(pattern, () => replacement)
}

function setMeta(html, attribute, key, value) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*/?>`)
  return replaceOnce(html, pattern, `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`, `<meta ${attribute}="${key}">`)
}

/** Sets the one absolute `<base href>` right after the charset, so relative urls resolve the same whatever path serves the html. */
export function injectBase(html, basePath) {
  const cleaned = html.replace(/\s*<base\s[^>]*>/gi, '')
  return replaceOnce(cleaned, /<meta\s+charset="[^"]*"\s*\/?>/i, `<meta charset="UTF-8" />\n    <base href="${basePath}" />`, '<meta charset>')
}

/** Folder of a page: '' for the root home, 'learn/', 'en/', 'en/learn/'. */
export function pagePath(prefix, segment) {
  const parts = [prefix, segment].filter(Boolean)
  return parts.length ? `${parts.join('/')}/` : ''
}

/** The three hreflang alternates of a page (x-default is the root page). */
export function hreflangEntries(siteUrl, segment) {
  return [
    ...LANGUAGES.map((code) => ({ hreflang: code, href: `${siteUrl}${pagePath(code, segment)}` })),
    { hreflang: 'x-default', href: `${siteUrl}${pagePath('', segment)}` },
  ]
}

/** Adds the hreflang links right after the canonical link, replacing any existing ones. */
export function addHreflang(html, siteUrl, segment = '') {
  const links = hreflangEntries(siteUrl, segment).map(({ hreflang, href }) => `<link rel="alternate" hreflang="${hreflang}" href="${href}" />`)
  const cleaned = html.replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>/g, '')
  const canonical = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/
  const found = canonical.exec(cleaned)
  if (!found) throw new Error('index.html has no canonical link: the page generator needs updating')
  return cleaned.replace(canonical, () => `${found[0]}\n    ${links.join('\n    ')}`)
}

export function renderRoutePage(indexHtml, { segment, lang, prefix = '', title, description, h1, intro, image, imageAlt }, siteUrl, basePath = siteBasePath(siteUrl)) {
  const path = pagePath(prefix, segment)
  const pageUrl = `${siteUrl}${path}`
  const imageUrl = `${siteUrl}og/${image}`
  let html = injectBase(indexHtml, basePath)
  html = replaceOnce(html, /<html\s+lang="[^"]*"/, `<html lang="${escapeHtml(lang)}"`, '<html lang>')
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`, '<title>')
  html = replaceOnce(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${pageUrl}" />`, 'canonical link')
  html = addHreflang(html, siteUrl, segment)
  html = setMeta(html, 'name', 'description', description)
  html = setMeta(html, 'property', 'og:title', title)
  html = setMeta(html, 'property', 'og:description', description)
  html = setMeta(html, 'property', 'og:url', pageUrl)
  html = setMeta(html, 'property', 'og:image', imageUrl)
  html = setMeta(html, 'property', 'og:image:alt', imageAlt)
  html = setMeta(html, 'name', 'twitter:title', title)
  html = setMeta(html, 'name', 'twitter:description', description)
  html = setMeta(html, 'name', 'twitter:image', imageUrl)
  if (lang === 'en') html = html.replace(/(<noscript>\s*<p[^>]*>)[^<]*(<\/p>)/, `$1\n        ${NOSCRIPT_EN}\n      $2`)
  return replaceOnce(
    html,
    /<div id="app">\s*<main(\s[^>]*)?>[\s\S]*?<\/main>/,
    `<div id="app">\n      <main style="font-family: system-ui, sans-serif; padding: 1.5rem; max-width: 40rem; margin: 0 auto; line-height: 1.5">\n        <h1>${escapeHtml(h1)}</h1>\n        <p>${escapeHtml(intro)}</p>\n      </main>`,
    'pre-rendered <main> in #app',
  )
}

export function renderRedirectPage(newSegment, siteUrl) {
  const target = `../${newSegment}/`
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Solfège hero</title>
    <link rel="canonical" href="${siteUrl}${newSegment}/" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <script>location.replace('${target}' + location.search + location.hash)</script>
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 1.5rem">
    <p><a id="open" href="${target}">Ouvrir Solfège hero</a></p>
    <script>document.getElementById('open').href = '${target}' + location.search + location.hash</script>
  </body>
</html>
`
}

export function render404Page() {
  const known = JSON.stringify([...routeSegments(), ...Object.keys(LEGACY_REDIRECTS)])
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Page introuvable : Solfège hero</title>
    <script>
      var known = ${known}
      var path = location.pathname
      var parts = path.split('/').filter(Boolean)
      var isPage = known.indexOf(parts[parts.length - 1]) >= 0
      var needsSlash = isPage && !/\\/$/.test(path)
      if (isPage) parts.pop()
      var lang = Math.max(parts.lastIndexOf('fr'), parts.lastIndexOf('en'))
      if (!isPage && lang >= 0) parts = parts.slice(0, lang + 1)
      else if (!isPage) parts = location.hostname.endsWith('github.io') ? parts.slice(0, 1) : []
      var root = '/' + parts.join('/') + (parts.length ? '/' : '')
      location.replace((needsSlash ? path + '/' : root) + location.search + location.hash)
    </script>
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 1.5rem">
    <p>Page introuvable. <a id="root" href="/">Retour à Solfège hero</a></p>
    <script>
      document.getElementById('root').href = root
    </script>
  </body>
</html>
`
}

const ALL_PAGES = [...ROUTES, ...LANDING_ONLY]
export const ROUTE_PAGES = ALL_PAGES.filter(({ segment }) => segment)

/** prefix '' = root page (French), 'fr' / 'en' = language folders; English og images live under og/en/. */
export function routePageOptions({ screen, segment }, texts = PAGE_TEXTS.fr, prefix = '') {
  const image = prefix === 'en' ? `en/${PAGE_IMAGES[screen]}` : PAGE_IMAGES[screen]
  return { segment, prefix, lang: texts.lang, ...texts.pages[screen], image }
}

export function generateSitePages(indexHtml, siteUrl) {
  const pages = ROUTE_PAGES.map((route) => ({
    fileName: `${route.segment}/index.html`,
    source: renderRoutePage(indexHtml, routePageOptions(route), siteUrl),
  }))
  const localized = LANGUAGES.flatMap((code) =>
    ALL_PAGES.map((route) => ({
      fileName: `${pagePath(code, route.segment)}index.html`,
      source: renderRoutePage(indexHtml, routePageOptions(route, PAGE_TEXTS[code], code), siteUrl),
    })),
  )
  const redirects = Object.entries(LEGACY_REDIRECTS).map(([legacy, segment]) => ({
    fileName: `${legacy}/index.html`,
    source: renderRedirectPage(segment, siteUrl),
  }))
  return [...pages, ...localized, ...redirects, { fileName: '404.html', source: render404Page() }]
}
