export const DEFAULT_SITE_URL: string
export function normalizeSiteUrl(raw?: string): string
export function siteHost(siteUrl: string): string
export function isGithubPagesHost(host: string): boolean
export function customDomain(siteUrl: string): string | null
export function sitePaths(): string[]
export function renderSitemap(siteUrl: string, lastmod: string): string
export function renderRobots(siteUrl: string): string
export function renderHumans(siteUrl: string): string
