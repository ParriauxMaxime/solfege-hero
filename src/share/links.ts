export type LandingKind = 'defi' | 'survie' | 'hero' | 'jour' | 'partition' | 'dictee'

export function appBase(href: string): string {
  return new URL('./', href).href
}

export function landingUrl(base: string, kind: LandingKind, hash: string): string {
  return `${base}${kind}/#${hash}`
}
