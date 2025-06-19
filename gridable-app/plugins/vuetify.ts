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
      defaultTheme: 'twitterLight',
      themes: {
        twitterLight: {
          dark: false,
          colors: {
            background: '#FFFFFF',
            surface: '#FFFFFF',
            primary: '#1DA1F2',
            'primary-darken-1': '#0c8de8',
            secondary: '#14171A',
            'secondary-darken-1': '#000000',
            error: '#E0245E',
            info: '#17A2B8',
            success: '#28A745',
            warning: '#FFC107',
          }
        },
        twitterDark: {
          dark: true,
          colors: {
            background: '#0D1117',
            surface: '#0D1117',
            primary: '#1DA1F2',
            'primary-darken-1': '#0c8de8',
            secondary: '#C9D1D9',
            'secondary-darken-1': '#adbac7',
            error: '#E0245E',
            info: '#17A2B8',
            success: '#28A745',
            warning: '#FFC107',
          }
        }
      }
    }
  })
  nuxtApp.vueApp.use(vuetify)

  return {
    provide: {
      vuetify
    }
  }
})
