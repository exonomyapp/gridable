import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css' // Ensure you are using css-loader

export default defineNuxtPlugin(nuxtApp => {
  const vuetify = createVuetify({
    ssr: true, // Enable SSR if needed
    components,
    directives,
    theme: {
      defaultTheme: 'light' // Or 'dark'
    }
  })
  nuxtApp.vueApp.use(vuetify)
})
