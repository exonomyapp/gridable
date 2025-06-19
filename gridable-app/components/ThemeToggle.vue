<template>
  <v-btn icon @click="toggleTheme">
    <v-icon>{{ themeIcon }}</v-icon>
  </v-btn>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify';
import { computed } from 'vue';
import { getGlobalAppSettings, saveGlobalAppSettings } from '~/services/userPreferences';

const theme = useTheme();

const themeIcon = computed(() => {
  return theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night';
});

const toggleTheme = async () => {
  const newTheme = theme.global.current.value.dark ? 'twitterLight' : 'twitterDark';
  theme.global.name.value = newTheme;
  const settings = await getGlobalAppSettings();
  await saveGlobalAppSettings({
    ...settings,
    defaultThemeId: newTheme,
  });
};
</script>