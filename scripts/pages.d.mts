import type { LanguageTexts } from './page-texts.mjs'
import type { LandingScreen, Route, Screen } from './routes.mjs'

export interface RoutePageOptions {
  segment: string
  lang: string
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
export function routePageOptions(route: Route<Screen | LandingScreen>, texts?: LanguageTexts): RoutePageOptions
export function renderRoutePage(indexHtml: string, options: RoutePageOptions, siteUrl: string): string
export function renderRedirectPage(newSegment: string, siteUrl: string): string
export function render404Page(): string
export function generateSitePages(indexHtml: string, siteUrl: string, texts?: LanguageTexts): GeneratedPage[]
