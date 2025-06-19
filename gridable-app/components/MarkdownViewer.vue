<template>
  <div class="markdown-container markdown-viewer-container">
    <div
      class="slider-container"
      :style="zoomStyle"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <v-card
        class="slider-card"
        :class="{ 'is-active': isHovering, 'is-dormant': isDormant }"
        :color="sliderColor"
        elevation="4"
      >
        <v-icon>mdi-format-size</v-icon>
        <v-slider
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
import { useTheme } from 'vuetify';
import { useHead } from '#app';
import { marked } from 'marked';

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
const isDormant = ref(true);
let inactivityTimer: number | null = null;
let lastMousePosition: { x: number; y: number } | null = null;

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
    return isHovering.value ? 'rgba(50, 50, 50, 0.6)' : 'rgba(30, 30, 30, 0.7)';
  } else {
    return isHovering.value ? 'rgba(255, 255, 255, 0.6)' : 'rgba(200, 200, 200, 0.7)';
  }
});

const handleMouseEnter = () => {
  isHovering.value = true;
};

const handleMouseLeave = () => {
  isHovering.value = false;
};

const resetInactivityTimer = (event: MouseEvent) => {
  if (!lastMousePosition) {
    lastMousePosition = { x: event.clientX, y: event.clientY };
    return;
  }

  const distance = Math.sqrt(
    Math.pow(event.clientX - lastMousePosition.x, 2) +
      Math.pow(event.clientY - lastMousePosition.y, 2)
  );

  if (distance > window.innerWidth / 3) {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    isDormant.value = false;
    inactivityTimer = window.setTimeout(() => {
      isDormant.value = true;
    }, 5000);
    lastMousePosition = { x: event.clientX, y: event.clientY };
  }
};

onMounted(async () => {
  updatePixelRatio();
  window.addEventListener('resize', updatePixelRatio);
  window.addEventListener('mousemove', resetInactivityTimer as (event: Event) => void, { passive: true });
  const response = await fetch(props.url);
  const data = await response.json();
  readme.value = await marked(data.content);
});

onUnmounted(() => {
  window.removeEventListener('resize', updatePixelRatio);
  window.removeEventListener('mousemove', resetInactivityTimer as (event: Event) => void);
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
});
</script>

<style>
.markdown-container {
  position: relative;
  border: none;
  border-radius: 0;
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
  position: fixed;
  top: 5rem;
  right: 1.5rem;
  z-index: 10;
  padding: 10px;
  border-radius: 50%;
}

.slider-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1rem;
  border-radius: 16px;
  transition: width 1.5s ease, height 1.5s ease, background-color 1.5s linear,
    transform 1.5s ease;
  transform-origin: top right;
  width: 72px;
  height: 72px;
  overflow: hidden;
  gap: 1rem;
}

.slider-card.is-active {
  width: 400px;
  height: 58px;
  justify-content: flex-start;
}

.slider-card .v-icon {
  transition: all 1.5s linear;
}

.slider-card.is-dormant:not(.is-active) {
  transform: scale(0.5) translate(50%, -50%);
}

.slider-card.is-dormant:not(.is-active) .v-icon {
  transform: scale(1.5);
}

.font-slider {
  color: white;
  min-width: 0;
  flex-shrink: 0;
  width: 0;
  opacity: 0;
  pointer-events: none;
  /* This defines the OUT transition */
  transition: width 1.2s ease, opacity 0.3s ease 1.2s;
}

.slider-card.is-active .font-slider {
  width: 300px;
  opacity: 1;
  pointer-events: auto;
  /* This defines the IN transition */
  transition: width 1.5s ease, opacity 0.3s ease;
}

/* Custom styles for checkbox contrast */
.markdown-body ul.contains-task-list .task-list-item input[type='checkbox'] {
  -webkit-appearance: none;
  appearance: none;
  background-color: transparent;
  border: 1.5px solid currentColor !important;
  width: 1em;
  height: 1em;
  border-radius: 0.15em;
  position: relative;
  cursor: pointer;
  vertical-align: middle;
  margin-right: 0.3em;
  transform: translateY(-0.075em);
}

.markdown-body ul.contains-task-list .task-list-item input[type='checkbox']:checked {
  background-color: currentColor !important;
}

.markdown-body .task-list-item input[type='checkbox']:checked::before {
  content: '✔';
  position: absolute;
  color: var(--v-theme-surface);
  font-size: 0.8em;
  font-weight: bold;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  line-height: 1;
}
/* Reduce the size of the font-size slider thumb and label to prevent clipping */
.font-slider.v-slider .v-slider-thumb {
  --v-slider-thumb-size: 12px;
}

.font-slider.v-slider .v-slider-thumb__label {
  height: 24px;
  width: 24px;
  font-size: 0.7rem;
}
</style>