import { workerRegistration } from './pwaUrls'

// Not `registerSW` from vite-plugin-pwa: its workbox-window compares the worker URL with `location.href` and reloads on
// the very first install, which lost the challenge link of a first-time visitor.
// The html carries an absolute `<base>`, so the worker url and scope are the same from any page path. A page that an old
// worker served from the wrong path recovers by itself: update() fetches the new worker, which takes control (skipWaiting
// + clientsClaim) and reloads the page once.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return
    reloaded = true
    window.location.reload()
  })
  const { script, scope } = workerRegistration(document.baseURI)
  void navigator.serviceWorker.register(script, { scope, updateViaCache: 'none' }).then((registration) => {
    void registration.update()
    // An installed app can stay open for days: look for a new version whenever it comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update()
    })
  })
}
