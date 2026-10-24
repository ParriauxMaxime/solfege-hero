import { registerSW } from 'virtual:pwa-register'

if (import.meta.env.PROD) registerSW()
