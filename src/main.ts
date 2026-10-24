import './styles/base.css'
import './styles/game.css'
import './styles/screens.css'
import './styles/effects.css'
import './styles/hero.css'
import './styles/hero-screen.css'
import './styles/home.css'
import './styles/series.css'
import './styles/library.css'
import './pwa'
import { startApp } from './app'

const root = document.querySelector<HTMLElement>('#app')
if (root) startApp(root)
