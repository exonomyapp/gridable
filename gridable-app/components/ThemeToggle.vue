<template>
  <v-btn icon @click="toggleTheme">
    <v-icon>{{ themeIcon }}</v-icon>
  </v-btn>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify';
import { computed } from 'vue';

const theme = useTheme();

const themeIcon = computed(() => {
  return theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night';
});

const toggleTheme = () => {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark';
};
</script>