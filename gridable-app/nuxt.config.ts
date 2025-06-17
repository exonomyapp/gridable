import { defineNuxtConfig } from 'nuxt/config'
import { resolve } from 'path'

export default defineNuxtConfig({
  devtools: { enabled: true },
  compatibilityDate: '2025-06-17',
  css: [
    'vuetify/lib/styles/main.sass',
    '@mdi/font/css/materialdesignicons.css',
    '~/assets/css/layouts/main.css',
    '~/assets/css/main.css'
  ],
  build: {
    transpile: ['vuetify'],
  },
  modules: [
    '@pinia/nuxt',
  ],
  extends: [
    resolve(__dirname, '../packages/upGrid')
  ],
  vite: {
    define: {
      'process.env.DEBUG': false,
      // 'global': {}, // Sometimes needed for certain libraries
    },
    resolve: {
      alias: {
        // Polyfill for Node.js 'fs' and 'path' if some deep dependency needs it
        // 'fs': 'rollup-plugin-node-builtins/src/es6/fs.js',
        // 'path': 'rollup-plugin-node-builtins/src/es6/path.js',
      }
    },
    // optimizeDeps: {
    //   exclude: ['@orbitdb/core'] // May be needed if issues arise with CJS/ESM interop
    // }
  },
  // vue: {
  //   compilerOptions: {
  //     isCustomElement: (tag) => ['orbitdbprovider'].includes(tag), // If using custom elements from orbitdb
  //   },
  // },
  // If Buffer or other globals are needed, a plugin can provide them:
  // plugins: [
  //   '~/plugins/provide-globals.client.ts' // Example
  // ]
})
