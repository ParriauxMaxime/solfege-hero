import { readFileSync } from 'node:fs'
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

export default defineConfig({
  base: './',
  server: { allowedHosts: ['.ts.net'], hmr: { clientPort: 443 } },
  plugins: [
    pdfjsWasm(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      // The glob below already picks the icons up; listing them twice duplicates precache entries.
      includeManifestIcons: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,musicxml,json,mjs,wasm}'],
      },
      manifest: {
        name: 'Solfège',
        short_name: 'Solfège',
        description: 'Entraînement à la lecture de notes sur la portée.',
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
})
