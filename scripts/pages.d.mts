import type { LanguageTexts } from './page-texts.mjs'
import type { LandingScreen, Route, Screen } from './routes.mjs'

export interface RoutePageOptions {
  segment: string
  lang: string
  prefix?: string
  title: string
  description: string
  h1: string
  intro: string
  image: string
  imageAlt: string
}
export interface GeneratedPage {
  fileName: string
  source: string
}
export const ROUTE_PAGES: Route<Screen | LandingScreen>[]
export function pagePath(prefix: string, segment: string): string
export function hreflangEntries(siteUrl: string, segment: string): { hreflang: string; href: string }[]
export function addHreflang(html: string, siteUrl: string, segment?: string): string
export function routePageOptions(route: Route<Screen | LandingScreen>, texts?: LanguageTexts, prefix?: string): RoutePageOptions
export function renderRoutePage(indexHtml: string, options: RoutePageOptions, siteUrl: string): string
export function renderRedirectPage(newSegment: string, siteUrl: string): string
export function render404Page(): string
export function generateSitePages(indexHtml: string, siteUrl: string): GeneratedPage[]
