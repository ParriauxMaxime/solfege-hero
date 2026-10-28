import { describe, expect, it } from 'vitest'
import { PAGE_IMAGES, PAGE_TEXTS } from './page-texts.mjs'
import { addHreflang, generateSitePages, injectBase, render404Page, renderRedirectPage, renderRoutePage } from './pages.mjs'
import { LANDING_ONLY, LEGACY_REDIRECTS, ROUTES } from './routes.mjs'
import { renderSitemap, sitePaths } from './site-url.mjs'

const SITE = 'https://x.test/solfege-hero/'

const INDEX_HTML = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Home title</title>
    <meta name="description" content="Home description" />
    <link rel="canonical" href="${SITE}" />
    <meta property="og:title" content="Home title" />
    <meta property="og:description" content="Home description" />
    <meta property="og:url" content="${SITE}" />
    <meta property="og:image" content="${SITE}og/og.png" />
    <meta property="og:image:alt" content="Home alt" />
    <meta name="twitter:title" content="Home title" />
    <meta name="twitter:description" content="Home description" />
    <meta name="twitter:image" content="${SITE}og/og.png" />
    <script type="application/ld+json">{ "url": "${SITE}" }</script>
    <script type="module" crossorigin src="./assets/index-abc.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-abc.css">
  <link rel="manifest" href="./manifest.webmanifest"></head>
  <body>
    <div id="app">
      <main style="padding: 1rem">
        <h1>Home</h1>
        <ul><li>x</li></ul>
      </main>
      <noscript>
        <style>#app { overflow-y: auto; }</style>
        <p style="padding: 0">Texte sans script</p>
      </noscript>
    </div>
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"t"}'></script>
  </body>
</html>`

const OPTIONS = {
  segment: 'learn',
  lang: 'fr',
  title: 'Apprendre · Solfège hero',
  description: 'Une description',
  h1: 'Apprendre',
  intro: 'Deux phrases. Voilà.',
  image: 'og-learn.png',
  imageAlt: 'Alt texte',
}

const count = (html: string, needle: string) => html.split(needle).length - 1

describe('renderRoutePage', () => {
  const html = renderRoutePage(INDEX_HTML, OPTIONS, SITE)

  it('sets language, title, description and absolute urls', () => {
    expect(html).toContain('<html lang="fr"')
    expect(html).toContain('<title>Apprendre · Solfège hero</title>')
    expect(html).toContain('<meta name="description" content="Une description" />')
    expect(html).toContain(`<link rel="canonical" href="${SITE}learn/" />`)
    expect(html).toContain(`<meta property="og:url" content="${SITE}learn/" />`)
    expect(html).toContain(`<meta property="og:image" content="${SITE}og/og-learn.png" />`)
    expect(html).toContain(`<meta name="twitter:image" content="${SITE}og/og-learn.png" />`)
    expect(html).toContain('<meta property="og:image:alt" content="Alt texte" />')
    expect(html).toContain('<meta name="twitter:title" content="Apprendre · Solfège hero" />')
    expect(html).not.toContain('Home title')
  })

  it('inserts one base tag right after the charset', () => {
    expect(count(html, '<base ')).toBe(1)
    expect(html).toMatch(/<meta charset="UTF-8" \/>\s*<base href="\/solfege-hero\/" \/>/)
  })

  it('leaves assets, manifest, beacon and json-ld untouched', () => {
    expect(html).toContain('src="./assets/index-abc.js"')
    expect(html).toContain('href="./manifest.webmanifest"')
    expect(count(html, 'beacon.min.js')).toBe(1)
    expect(html).toContain(`{ "url": "${SITE}" }`)
  })

  it('resolves relative assets to the app root from the page folder', () => {
    expect(new URL('./assets/index-abc.js', new URL('../', `${SITE}learn/`)).href).toBe('https://x.test/solfege-hero/assets/index-abc.js')
  })

  it('replaces the pre-rendered main', () => {
    expect(html).toContain('<h1>Apprendre</h1>')
    expect(html).toContain('<p>Deux phrases. Voilà.</p>')
    expect(html).not.toContain('<li>x</li>')
    expect(count(html, '<main')).toBe(1)
  })

  it('keeps the no-script text inside the app, after the pre-rendered main', () => {
    expect(html.indexOf('Texte sans script')).toBeGreaterThan(html.indexOf('</main>'))
    expect(html.indexOf('Texte sans script')).toBeLessThan(html.indexOf('</div>'))
    expect(html).toContain('#app { overflow-y: auto; }')
  })

  it('translates the no-script text on English pages only', () => {
    const english = renderRoutePage(INDEX_HTML, { ...OPTIONS, lang: 'en' }, SITE)
    expect(english).toContain('JavaScript is required')
    expect(english).not.toContain('Texte sans script')
    expect(english).toContain('#app { overflow-y: auto; }')
  })

  it('draws the still logo above the heading of the pre-rendered main', () => {
    expect(count(html, '<svg class="brand-logo brand-logo-splash"')).toBe(1)
    expect(html.indexOf('brand-logo-splash')).toBeGreaterThan(html.indexOf('<main'))
    expect(html.indexOf('brand-logo-splash')).toBeLessThan(html.indexOf('<h1>'))
  })

  it('escapes html in texts', () => {
    const escaped = renderRoutePage(INDEX_HTML, { ...OPTIONS, title: 'A & "B"', intro: '<script>x</script> $& $1' }, SITE)
    expect(escaped).toContain('<title>A &amp; &quot;B&quot;</title>')
    expect(escaped).toContain('<p>&lt;script&gt;x&lt;/script&gt; $&amp; $1</p>')
  })

  it('throws when the built index.html changed shape', () => {
    expect(() => renderRoutePage(INDEX_HTML.replace('<title>Home title</title>', ''), OPTIONS, SITE)).toThrow('<title>')
    expect(() => renderRoutePage(INDEX_HTML.replace('<div id="app">', '<div>'), OPTIONS, SITE)).toThrow('#app')
    expect(() => renderRoutePage(INDEX_HTML.replace('og:url', 'og:uri'), OPTIONS, SITE)).toThrow('og:url')
  })
})

describe('renderRedirectPage', () => {
  const html = renderRedirectPage('learn', SITE)

  it('forwards to the new page keeping search and hash', () => {
    expect(html).toContain("location.replace('../learn/' + location.search + location.hash)")
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=../learn/" />')
    expect(html).toContain(`<link rel="canonical" href="${SITE}learn/" />`)
    expect(html).toContain('<meta name="robots" content="noindex" />')
  })
})

describe('render404Page', () => {
  it('knows every route and legacy segment', () => {
    const html = render404Page()
    expect(html).toContain('"learn"')
    expect(html).toContain('"apprendre"')
    expect(html).toContain('"challenge"')
  })
})

describe('generateSitePages', () => {
  const pages = generateSitePages(INDEX_HTML, SITE)
  const names = pages.map((page) => page.fileName)

  it('has a page for every route and landing-only page, except home', () => {
    for (const { segment } of [...ROUTES, ...LANDING_ONLY]) if (segment) expect(names).toContain(`${segment}/index.html`)
    expect(names).not.toContain('/index.html')
    expect(names).toContain('404.html')
  })

  it('has a redirect for every legacy segment', () => {
    for (const legacy of Object.keys(LEGACY_REDIRECTS)) expect(names).toContain(`${legacy}/index.html`)
  })

  it('has texts and an image for every page', () => {
    for (const { screen } of [...ROUTES, ...LANDING_ONLY]) {
      expect(PAGE_TEXTS.fr.pages[screen]?.title).toBeTruthy()
      expect(PAGE_IMAGES[screen]).toMatch(/\.png$/)
    }
  })
})

describe('language pages', () => {
  const pages = generateSitePages(INDEX_HTML, SITE)
  const source = (fileName: string) => pages.find((page) => page.fileName === fileName)?.source ?? ''

  it('generates fr/ and en/ pages for home, routes and landing pages', () => {
    for (const code of ['fr', 'en']) {
      expect(source(`${code}/index.html`)).not.toBe('')
      for (const { segment } of [...ROUTES, ...LANDING_ONLY]) if (segment) expect(source(`${code}/${segment}/index.html`)).not.toBe('')
    }
  })

  it('sets lang, own canonical, translated texts and english og image', () => {
    const html = source('en/learn/index.html')
    expect(html).toContain('<html lang="en"')
    expect(html).toContain(`<link rel="canonical" href="${SITE}en/learn/" />`)
    expect(html).toContain(`<meta property="og:url" content="${SITE}en/learn/" />`)
    expect(html).toContain(`<meta property="og:image" content="${SITE}og/en/og-learn.png" />`)
    expect(html).toContain('<title>Learn the notes · Solfège hero</title>')
    expect(source('fr/learn/index.html')).toContain('<html lang="fr"')
    expect(source('fr/learn/index.html')).toContain(`content="${SITE}og/og-learn.png"`)
  })

  it('links the three hreflang alternates, x-default on the root page', () => {
    for (const fileName of ['en/learn/index.html', 'fr/learn/index.html', 'learn/index.html']) {
      const html = source(fileName)
      expect(html).toContain(`<link rel="alternate" hreflang="fr" href="${SITE}fr/learn/" />`)
      expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE}en/learn/" />`)
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE}learn/" />`)
    }
    expect(source('learn/index.html')).toContain(`<link rel="canonical" href="${SITE}learn/" />`)
    expect(source('en/index.html')).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE}" />`)
  })

  it('adds hreflang to the home idempotently', () => {
    const once = addHreflang(INDEX_HTML, SITE)
    expect(count(once, 'hreflang=')).toBe(3)
    expect(count(addHreflang(once, SITE), 'hreflang=')).toBe(3)
  })

  it('uses the same absolute base href at any depth, replacing an existing one', () => {
    for (const file of ['en/learn', 'en/challenge', 'en', 'fr']) expect(source(`${file}/index.html`)).toContain('<base href="/solfege-hero/" />')
    expect(source('en/learn/index.html').match(/<base /g)).toHaveLength(1)
    expect(new URL('./assets/index-abc.js', new URL('/solfege-hero/', `${SITE}en/learn/`)).href).toBe('https://x.test/solfege-hero/assets/index-abc.js')
    expect(injectBase(injectBase(INDEX_HTML, '/'), '/a/').match(/<base href="[^"]*"/g)).toEqual(['<base href="/a/"'])
  })

  it('has english texts for every page', () => {
    for (const { screen } of [...ROUTES, ...LANDING_ONLY]) expect(PAGE_TEXTS.en.pages[screen]?.title).toBeTruthy()
  })

  it('keeps the 404 page aware of language folders', () => {
    expect(render404Page()).toContain("lastIndexOf('en')")
  })
})

describe('sitemap', () => {
  it('lists root, fr and en pages with hreflang alternates', () => {
    const sitemap = renderSitemap(SITE, '2026-01-01')
    expect(sitemap).toContain(`<loc>${SITE}en/learn/</loc>`)
    expect(sitemap).toContain(`<loc>${SITE}fr/</loc>`)
    expect(sitemap).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}learn/"/>`)
  })

  it('lists every route and no legacy segment', () => {
    const sitemap = renderSitemap(SITE, '2026-01-01')
    for (const path of sitePaths()) expect(sitemap).toContain(`<loc>${SITE}${path}</loc>`)
    expect(sitemap).toContain(`${SITE}learn/`)
    expect(sitemap).toContain(`${SITE}score/`)
    for (const legacy of Object.keys(LEGACY_REDIRECTS)) expect(sitemap).not.toContain(`/${legacy}/`)
  })
})
