/** Absolute worker url and scope, from the document `<base>`: the same whichever path the html was served from. */
export function workerRegistration(baseURI: string): { script: string; scope: string } {
  return { script: new URL('sw.js', baseURI).href, scope: new URL('./', baseURI).pathname }
}
