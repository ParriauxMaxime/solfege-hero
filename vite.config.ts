import { readFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import { LANDING_PAGES, customDomain, normalizeSiteUrl, renderHumans, renderRobots, renderSitemap } from './scripts/site-url.mjs'
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

function landingPage(page: string, siteUrl: string) {
  return readFileSync(new URL(`./landing/${page}/index.html`, import.meta.url), 'utf8').replaceAll('%SITE_URL%', siteUrl)
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
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%SITE_URL%', siteUrl).replace('</body>', () => closeBody),
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const page = LANDING_PAGES.find((name) => (request as { url?: string }).url?.split('?')[0] === `/${name}/`)
        if (!page) return next()
        response.setHeader('Content-Type', 'text/html')
        response.end(landingPage(page, siteUrl))
      })
    },
    generateBundle() {
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source })
      for (const page of LANDING_PAGES) emit(`${page}/index.html`, landingPage(page, siteUrl))
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
      devOptions: { enabled: false },
      // The glob below already picks the icons up; listing them twice duplicates precache entries.
      includeManifestIcons: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,musicxml,json,mjs,wasm}'],
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
