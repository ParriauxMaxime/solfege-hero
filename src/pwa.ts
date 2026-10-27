// Not `registerSW` from vite-plugin-pwa: its workbox-window compares the worker URL with `location.href`, not with the
// `<base href="../">` of the route pages, takes the worker for an external update and reloads on the very first install,
// which lost the challenge link of a first-time visitor.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller)
  // A new version takes control by itself (skipWaiting + clientsClaim): reload once so the open page runs it too.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload()
  })
  void navigator.serviceWorker.register(new URL('./sw.js', document.baseURI), { scope: new URL('./', document.baseURI).pathname }).then((registration) => {
    // An installed app can stay open for days: look for a new version whenever it comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update()
    })
  })
}
