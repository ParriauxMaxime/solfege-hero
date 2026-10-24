import { VitePWA } from 'vite-plugin-pwa'
import { configDefaults, defineConfig } from 'vitest/config'

const background = '#12101a'

export default defineConfig({
  base: './',
  server: { allowedHosts: ['.ts.net'], hmr: { clientPort: 443 } },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      // The glob below already picks the icons up; listing them twice duplicates precache entries.
      includeManifestIcons: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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
