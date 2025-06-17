<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <v-img :src="logoUrl" alt="Gridable Logo" width="150" class="ma-4"></v-img>
      <v-list dense>
        <v-list-item link to="/">
          <v-list-item-title>Dashboard</v-list-item-title>
        </v-list-item>
        <v-list-group value="Documents">
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-file-document-outline"
              title="Documents"
            ></v-list-item>
          </template>
          <v-list-item
            v-for="doc in docs"
            :key="doc.slug"
            :to="`/about/${doc.slug}`"
            :title="doc.title"
          ></v-list-item>
        </v-list-group>
        <v-list-item link to="/testing/grid-test">
          <v-list-item-title>Grid Test</v-list-item-title>
        </v-list-item>
        <v-list-item link to="/testing/orbitdb-test">
          <v-list-item-title>OrbitDB Test</v-list-item-title>
        </v-list-item>
        <v-list-item link to="/editor/view-editor">
          <v-list-item-title>View Editor</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar density="comfortable">
      <div class="d-flex align-center">
        <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
        <v-img :src="brandImageUrl" alt="Gridable Brand" height="32" width="100" contain class="ml-2 brand-logo"></v-img>
      </div>
      <v-spacer></v-spacer>
      <ThemeToggle />
      <UserProfileChip v-if="authStore.isAuthenticated" />
      <LoginButton v-else />
    </v-app-bar>

    <v-main>
      <slot />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '~/store/auth';
import UserProfileChip from '~/components/auth/UserProfileChip.vue';
import LoginButton from '~/components/auth/LoginButton.vue';
import ThemeToggle from '~/components/ThemeToggle.vue';
import logoUrl from '~/assets/images/gridable-rubiks.webp';
import brandImageUrl from '~/assets/images/gridable-brand.svg';

const authStore = useAuthStore();
const drawer = ref(false);
const docs = ref([
  { title: 'About', slug: 'README.md' },
  { title: 'External Data Sources', slug: 'external-data-sources-proposal.md' },
  { title: 'Product Plan', slug: 'gridable-product-plan.md' },
  { title: 'Style Guide', slug: 'gridable-style-guide.md' },
]);
</script>



<style>
.v-application,
.v-app-bar,
.v-navigation-drawer {
  transition: background-color 2s ease, color 2s ease;
}
</style>

<style scoped>
.brand-logo {
  filter: brightness(0.5);
}
</style>
