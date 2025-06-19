<template>
  <div class="app-container" :style="gridStyles">
    <nav class="nav-drawer" v-show="drawer">
      <div class="nav-content">
        <v-list v-if="isMounted" nav class="nav-list">
          <v-list-item v-if="authStore.isAuthenticated" link to="/" prepend-icon="mdi-view-dashboard" title="Dashboard" value="dashboard"></v-list-item>
          <v-list-group value="Documents">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-file-document-outline" title="Documents"></v-list-item>
            </template>
            <v-list-item
              v-for="doc in docs"
              :key="doc.slug"
              :to="`/about/${doc.slug}`"
              :title="doc.title"
              class="pl-8 document-link"
              density="compact"
            ></v-list-item>
          </v-list-group>
          <v-list-item v-if="authStore.isAuthenticated" link to="/testing/grid-test" prepend-icon="mdi-grid" title="Grid Test"></v-list-item>
          <v-list-item v-if="authStore.isAuthenticated" link to="/testing/orbitdb-test" prepend-icon="mdi-database-search" title="OrbitDB Test"></v-list-item>
          <v-list-item v-if="authStore.isAuthenticated" link to="/editor/view-editor" prepend-icon="mdi-pencil" title="View Editor"></v-list-item>
        </v-list>
      </div>
      <div
        class="resizer"
        @mousedown.prevent="startResize"
      ></div>
    </nav>

    <v-app-bar style="grid-area: app-bar; background-color: rgba(var(--v-theme-surface), 0.7) !important; position: relative;" height="64">
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title class="d-flex align-center">
        <v-img :src="brandImageUrl" alt="Gridable Brand" height="56" width="150" contain class="mr-2 my-n2"></v-img>
      </v-toolbar-title>
      <v-spacer></v-spacer>
      <ThemeToggle />
      <UserProfileChip v-if="authStore.isAuthenticated" />
      <LoginButton v-else />
    </v-app-bar>

    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useTheme } from 'vuetify';
import { useAuthStore } from '~/store/auth';
import UserProfileChip from '~/components/auth/UserProfileChip.vue';
import LoginButton from '~/components/auth/LoginButton.vue';
import ThemeToggle from '~/components/ThemeToggle.vue';
import brandImageUrl from '~/assets/images/gridable-brand.svg';
import { getGlobalAppSettings, saveGlobalAppSettings } from '~/services/userPreferences';

const theme = useTheme();
const authStore = useAuthStore();
const drawer = ref(true);
const isMounted = ref(false);
const docs = ref([
  { title: 'About', slug: 'README.md' },
  { title: 'Architecture', slug: 'architecture.md' },
  { title: 'Pre-Commit State', slug: 'pre-commit-state.md' },
  { title: 'Deletion Proposals', slug: 'delete.md' },
  { title: 'External Data Sources', slug: 'external-data-sources-proposal.md' },
  { title: 'Product Plan', slug: 'gridable-product-plan.md' },
  { title: 'Style Guide', slug: 'gridable-style-guide.md' },
  { title: 'upGrid API', slug: 'upGrid/upgrid-api.md' },
  { title: 'upGrid Product Plan', slug: 'upGrid/upGrid-product-plan.md' },
  { title: 'upGrid Style Guide', slug: 'upGrid/upGrid-style-guide.md' },
]);

// Resizable navigation drawer logic
const navDrawerWidth = ref(256); // Default width
const isResizing = ref(false);

const gridStyles = computed(() => ({
  '--nav-drawer-width': drawer.value ? `${navDrawerWidth.value}px` : '0px',
}));

let doResize: (e: MouseEvent) => void;
let stopResize: () => Promise<void>;

const startResize = () => {
  isResizing.value = true;
  document.body.style.cursor = 'col-resize';
  window.addEventListener('mousemove', doResize);
  window.addEventListener('mouseup', stopResize);
};

onMounted(async () => {
  isMounted.value = true;
  const settings = await getGlobalAppSettings();
  if (settings) {
    if (settings.navDrawerWidth) {
      navDrawerWidth.value = settings.navDrawerWidth;
    }
    if (settings.defaultThemeId) {
      theme.global.name.value = settings.defaultThemeId;
    }
  }

  doResize = (e: MouseEvent) => {
    if (isResizing.value) {
      const newWidth = Math.max(180, Math.min(e.clientX, 600));
      navDrawerWidth.value = newWidth;
    }
  };

  stopResize = async () => {
    if (!isResizing.value) return;
    isResizing.value = false;
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', doResize);
    window.removeEventListener('mouseup', stopResize);

    const settings = await getGlobalAppSettings();
    await saveGlobalAppSettings({
      ...settings,
      navDrawerWidth: navDrawerWidth.value,
    });
  };
});

onBeforeUnmount(() => {
  // Ensure we clean up listeners if the component is unmounted while resizing
  if (isResizing.value) {
    stopResize();
  }
});
</script>

<style>
.v-application,
.v-app-bar,
.v-navigation-drawer,
.nav-drawer,
.main-content,
.v-list,
.markdown-viewer-container {
  transition: background-color 2s ease, color 2s ease;
}
</style>

<style scoped>
.app-container {
  display: grid;
  grid-template-columns: var(--nav-drawer-width) 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    "app-bar app-bar"
    "nav-drawer main-content";
  height: 100vh;
  overflow: hidden;
  transition: grid-template-columns 0.2s ease;
}

.nav-drawer {
  grid-area: nav-drawer;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgb(var(--v-theme-surface));
}

.nav-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}


.nav-list {
  flex-grow: 1;
  overflow-y: auto;
}

.resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 100;
}

.resizer:hover,
.resizer:active {
  box-shadow: inset -2px 0 0 0 rgba(0,0,0,0.2);
}

.main-content {
  grid-area: main-content;
  overflow-y: auto;
}

.document-link :deep(.v-list-item-title) {
  font-size: 0.9rem;
}

</style>

<style>
.themed-logo {
  color: rgb(var(--v-theme-on-surface));
}
</style>
