import { registerSW } from 'virtual:pwa-register'

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    // An installed app can stay open for days: look for a new version whenever it comes back to the foreground.
    onRegisteredSW(_url, registration) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration?.update()
      })
    },
  })
}
