import { readFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import { PAGE_TEXTS } from './scripts/page-texts.mjs'
import { ROUTE_PAGES, addHreflang, generateSitePages, injectBase, renderRedirectPage, renderRoutePage, routePageOptions } from './scripts/pages.mjs'
import { LEGACY_REDIRECTS } from './scripts/routes.mjs'
import { customDomain, normalizeSiteUrl, renderHumans, renderRobots, renderSitemap, siteBasePath } from './scripts/site-url.mjs'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

const background = '#12101a'

const PDFJS_WASM_URL = '/pdfjs-wasm/'
const PDFJS_WASM_FILES = ['openjpeg.wasm', 'jbig2.wasm', 'qcms_bg.wasm']

/** pdf.js loads its JPEG 2000, JBIG2 and ICC decoders from a directory of wasm files: scanned PDFs need them. */
function pdfjsWasm(): Plugin {
  const source = (file: string) => readFileSync(new URL(`./node_modules/pdfjs-dist/wasm/${file}`, import.meta.url))
  return {
    name: 'pdfjs-wasm',
    configureServer(server) {
      server.middlewares.use(PDFJS_WASM_URL, (request, response, next) => {
        const file = PDFJS_WASM_FILES.find((name) => (request as { url?: string }).url === `/${name}`)
        if (!file) return next()
        response.setHeader('Content-Type', 'application/wasm')
        response.end(source(file))
      })
    },
    generateBundle() {
      for (const file of PDFJS_WASM_FILES) this.emitFile({ type: 'asset', fileName: `pdfjs-wasm/${file}`, source: source(file) })
    },
  }
}

declare const process: { env: Record<string, string | undefined>; cwd(): string }

const CF_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js'

function devPage(requestPath: string, siteUrl: string): string | null {
  const [first = '', ...others] = requestPath.replace(/^\/|\/$/g, '').split('/')
  const prefix = first === 'fr' || first === 'en' ? first : ''
  const segment = prefix ? others.join('/') : [first, ...others].join('/')
  const raw = () => readFileSync(new URL('./index.html', import.meta.url), 'utf8')
  const route = [{ screen: 'home', segment: '' }, ...ROUTE_PAGES].find((candidate) => candidate.segment === segment)
  if (route && (prefix || segment)) return renderRoutePage(raw(), routePageOptions(route as (typeof ROUTE_PAGES)[number], PAGE_TEXTS[prefix || 'fr'], prefix), siteUrl, '/')
  if (prefix) return null
  const redirect = LEGACY_REDIRECTS[segment]
  return redirect ? renderRedirectPage(redirect, siteUrl) : null
}

/** One site URL feeds the html pages, sitemap, robots, humans, CNAME and the optional Cloudflare beacon. */
function siteFiles(siteUrl: string, beaconToken: string): Plugin {
  const domain = customDomain(siteUrl)
  const closeBody = beaconToken
    ? `    <script defer src="${CF_BEACON_SRC}" data-cf-beacon='${JSON.stringify({ token: beaconToken })}'></script>\n  </body>`
    : '</body>'
  const lastmod = new Date().toISOString().slice(0, 10)
  return {
    name: 'site-files',
    enforce: 'post',
    transformIndexHtml: {
      order: 'pre',
      // Absolute <base> in the built home only (the dev server serves from its own root): any html served at any path boots.
      handler: (html, context) => {
        const filled = html.replaceAll('%SITE_URL%', siteUrl).replace('</body>', () => closeBody)
        return context.server ? filled : injectBase(filled, siteBasePath(siteUrl))
      },
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const { method, url = '' } = request as { method?: string; url?: string }
        if (method !== 'GET' && method !== 'HEAD') return next()
        const [path = '', search = ''] = url.split('?')
        const html = devPage(path, siteUrl)
        if (html === null) return next()
        if (!path.endsWith('/')) {
          response.statusCode = 301
          response.setHeader('Location', `${path}/${search && `?${search}`}`)
          return response.end()
        }
        response.setHeader('Content-Type', 'text/html')
        response.end(await server.transformIndexHtml('/', html))
      })
    },
    generateBundle(_options, bundle) {
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source })
      const index = bundle['index.html']
      if (index?.type !== 'asset') throw new Error('site-files must run after vite:build-html: index.html is not in the bundle')
      const homeHtml = String(index.source)
      for (const page of generateSitePages(homeHtml, siteUrl)) emit(page.fileName, page.source)
      index.source = addHreflang(homeHtml, siteUrl)
      emit('sitemap.xml', renderSitemap(siteUrl, lastmod))
      emit('robots.txt', renderRobots(siteUrl))
      emit('humans.txt', renderHumans(siteUrl))
      if (domain) emit('CNAME', `${domain}\n`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL)
  return {
  base: './',
  server: { allowedHosts: ['.ts.net'], hmr: { clientPort: 443 } },
  plugins: [
    pdfjsWasm(),
    siteFiles(siteUrl, env.VITE_CF_BEACON?.trim() ?? ''),
    VitePWA({
      registerType: 'autoUpdate',
      // src/pwa.ts registers the worker itself (see there why).
      injectRegister: false,
      devOptions: { enabled: false },
      // The glob below already picks the icons up; listing them twice duplicates precache entries.
      includeManifestIcons: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,musicxml,json,mjs,wasm}'],
        // A new version takes over open pages at once (src/pwa.ts then reloads once): the built worker has neither unless asked.
        skipWaiting: true,
        clientsClaim: true,
        // Safe at any path: index.html carries an absolute <base>, so its relative assets and sw.js resolve from the site root.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/og\//, /\/pdfjs-wasm\//, /\/[^/?]+\.[^/]+$/],
        ignoreURLParametersMatching: [/.*/],
        // pdf.js is only needed by the PDF import and the og images only by crawlers: fetched on demand, not on every install.
        globIgnores: ['**/pdf.worker*', '**/assets/pdf-*.js', 'pdfjs-wasm/**', 'og/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/pdf(\.worker\.min)?-[^/]+\.js$|\/pdfjs-wasm\//.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'pdfjs', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
        ],
      },
      manifest: {
        name: 'Solfège',
        short_name: 'Solfège',
        description:
          'Application gratuite pour apprendre à lire les notes sur la portée : clés de sol, fa et ut, séries chronométrées, survie, mode rythmique et partitions MusicXML, hors ligne.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        theme_color: background,
        background_color: background,
        categories: ['music', 'education'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    exclude: [...configDefaults.exclude, 'scratch/**'],
  },
  }
})
