import { PAGE_IMAGES, PAGE_TEXTS } from './page-texts.mjs'
import { LANDING_ONLY, LEGACY_REDIRECTS, ROUTES, routeSegments } from './routes.mjs'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

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

export function renderRoutePage(indexHtml, { segment, lang, title, description, h1, intro, image, imageAlt }, siteUrl) {
  const pageUrl = `${siteUrl}${segment}/`
  const imageUrl = `${siteUrl}og/${image}`
  let html = indexHtml
  html = replaceOnce(html, /<html\s+lang="[^"]*"/, `<html lang="${escapeHtml(lang)}"`, '<html lang>')
  html = replaceOnce(html, /<meta\s+charset="[^"]*"\s*\/?>/i, '<meta charset="UTF-8" />\n    <base href="../" />', '<meta charset>')
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`, '<title>')
  html = replaceOnce(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${pageUrl}" />`, 'canonical link')
  html = setMeta(html, 'name', 'description', description)
  html = setMeta(html, 'property', 'og:title', title)
  html = setMeta(html, 'property', 'og:description', description)
  html = setMeta(html, 'property', 'og:url', pageUrl)
  html = setMeta(html, 'property', 'og:image', imageUrl)
  html = setMeta(html, 'property', 'og:image:alt', imageAlt)
  html = setMeta(html, 'name', 'twitter:title', title)
  html = setMeta(html, 'name', 'twitter:description', description)
  html = setMeta(html, 'name', 'twitter:image', imageUrl)
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
      else parts = location.hostname.endsWith('github.io') ? parts.slice(0, 1) : []
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

export const ROUTE_PAGES = [...ROUTES, ...LANDING_ONLY].filter(({ segment }) => segment)

export function routePageOptions({ screen, segment }, texts = PAGE_TEXTS.fr) {
  return { segment, lang: texts.lang, ...texts.pages[screen], image: PAGE_IMAGES[screen] }
}

export function generateSitePages(indexHtml, siteUrl, texts = PAGE_TEXTS.fr) {
  const pages = ROUTE_PAGES.map((route) => ({
    fileName: `${route.segment}/index.html`,
    source: renderRoutePage(indexHtml, routePageOptions(route, texts), siteUrl),
  }))
  const redirects = Object.entries(LEGACY_REDIRECTS).map(([legacy, segment]) => ({
    fileName: `${legacy}/index.html`,
    source: renderRedirectPage(segment, siteUrl),
  }))
  return [...pages, ...redirects, { fileName: '404.html', source: render404Page() }]
}
