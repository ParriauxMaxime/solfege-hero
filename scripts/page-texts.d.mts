import type { LandingScreen, Screen } from './routes.mjs'

export interface PageText {
  title: string
  description: string
  h1: string
  intro: string
  imageAlt: string
}
export interface LanguageTexts {
  lang: string
  pages: Record<Screen | LandingScreen, PageText>
}
export const PAGE_IMAGES: Record<Screen | LandingScreen, string>
export const PAGE_TEXTS: { fr: LanguageTexts; en: LanguageTexts } & Record<string, LanguageTexts>
