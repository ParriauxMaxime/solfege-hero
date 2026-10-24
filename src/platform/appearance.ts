import type { Settings } from '../storage'

type AppearanceSettings = Pick<Settings, 'theme' | 'colorblind' | 'reducedMotion' | 'keySize' | 'keyNames'>

const THEME_COLORS = { dark: '#12101a', light: '#f6f3ee' }

export function motionReduced(): boolean {
  return document.documentElement.dataset['motion'] === 'reduced'
}

export function createAppearance(): { apply: (settings: AppearanceSettings) => void } {
  const prefersLight = matchMedia('(prefers-color-scheme: light)')
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let current: AppearanceSettings | null = null

  function render(): void {
    if (!current) return
    const theme = current.theme === 'system' ? (prefersLight.matches ? 'light' : 'dark') : current.theme
    const root = document.documentElement
    root.dataset['theme'] = theme
    root.dataset['colorblind'] = current.colorblind ? 'on' : 'off'
    root.dataset['motion'] = current.reducedMotion || prefersReducedMotion.matches ? 'reduced' : 'full'
    root.dataset['keys'] = current.keySize
    root.dataset['keyNames'] = current.keyNames ? 'on' : 'off'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  }

  prefersLight.addEventListener('change', render)
  prefersReducedMotion.addEventListener('change', render)

  return {
    apply(settings) {
      current = settings
      render()
    },
  }
}
