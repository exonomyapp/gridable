<template>
  <div class="markdown-container">
    <div
      class="slider-container"
      :style="zoomStyle"
      @mouseenter="isHovering = true"
      @mouseleave="isHovering = false"
    >
      <v-card
        class="slider-card"
        :class="{ 'is-active': isHovering }"
        :color="sliderColor"
        elevation="4"
      >
        <v-icon :class="{ 'mr-2': isHovering }">mdi-format-size</v-icon>
        <v-slider
          v-if="isHovering"
          v-model="fontSize"
          min="8"
          max="80"
          step="1"
          thumb-label
          dense
          hide-details
          class="font-slider"
        ></v-slider>
      </v-card>
    </div>

    <div class="markdown-content-wrapper">
      <div
        v-if="readme"
        :style="{ fontSize: `${fontSize}px` }"
        class="markdown-body"
        v-html="readme"
      ></div>
      <v-progress-circular v-else indeterminate></v-progress-circular>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { marked } from 'marked';
import { useTheme } from 'vuetify';
import { useHead } from '#app';

// Statically import the stylesheets. The build tool will process these
// and provide a URL as a string.
import darkStyleUrl from 'github-markdown-css/github-markdown-dark.css?url';
import lightStyleUrl from 'github-markdown-css/github-markdown-light.css?url';

const props = defineProps({
  url: {
    type: String,
    required: true,
  },
});

const readme = ref('');
const fontSize = ref(16);
const isHovering = ref(false);
const devicePixelRatio = ref(1);
const theme = useTheme();

// Create a computed property that holds the URL to the correct stylesheet.
const markdownStyleHref = computed(() => {
  return theme.global.current.value.dark ? darkStyleUrl : lightStyleUrl;
});

// Use useHead to reactively manage the <link> tag in the document's head.
useHead({
  link: [
    {
      rel: 'stylesheet',
      href: markdownStyleHref,
    },
  ],
});

const updatePixelRatio = () => {
  devicePixelRatio.value = window.devicePixelRatio || 1;
};

const zoomStyle = computed(() => {
  const scale = 1 / devicePixelRatio.value;
  return {
    transform: `scale(${scale})`,
    transformOrigin: 'top right',
  };
});

const sliderColor = computed(() => {
  if (theme.global.current.value.dark) {
    return isHovering.value ? 'rgba(50, 50, 50, 0.85)' : 'rgba(30, 30, 30, 1)';
  } else {
    return isHovering.value ? 'rgba(255, 255, 255, 0.85)' : 'rgba(230, 230, 230, 1)';
  }
});

onMounted(async () => {
  updatePixelRatio();
  window.addEventListener('resize', updatePixelRatio);
  const response = await fetch(props.url);
  const data = await response.json();
  readme.value = await marked(data.content);
});

onUnmounted(() => {
  window.removeEventListener('resize', updatePixelRatio);
});
</script>

<style>
.markdown-container {
  position: relative;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.markdown-content-wrapper {
  flex-grow: 1;
  overflow-y: auto;
}

.markdown-body {
  box-sizing: border-box;
  min-width: 200px;
  margin: 0 auto;
  padding: 45px;
}

.slider-container {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 10;
}

.slider-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 16px;
  transition: all 0.3s ease;
  width: 72px;
  height: 72px;
  overflow: hidden;
}

.slider-card.is-active {
  width: 400px;
  height: 48px;
  overflow: visible;
  justify-content: flex-start;
  padding: 0 1rem;
}

.font-slider {
  color: white;
}
</style>