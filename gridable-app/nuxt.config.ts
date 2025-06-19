import { defineNuxtConfig } from 'nuxt/config'
import { resolve } from 'path'

export default defineNuxtConfig({
  devtools: { enabled: true },
  compatibilityDate: '2025-06-17',

  // SSR is disabled for this application because it functions as a client-side
  // only P2P application. Key dependencies like Helia and OrbitDB require a
  // browser environment and are not compatible with server-side rendering.
  // See /docs/architecture.md for more details.
  ssr: false,
  css: [
    'vuetify/lib/styles/main.sass',
    '@mdi/font/css/materialdesignicons.css',
    '~/assets/css/layouts/main.css',
    '~/assets/css/main.css'
  ],
  modules: [
    '@pinia/nuxt',
  ],
  extends: [
    resolve(__dirname, '../packages/upGrid')
  ],
  build: {
    transpile: ['vuetify'],
  },
})
