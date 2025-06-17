<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <v-img :src="logoUrl" alt="Gridable Logo" width="150" class="ma-4"></v-img>
      <v-list dense>
        <v-list-item link to="/">
          <v-list-item-title>Home</v-list-item-title>
        </v-list-item>
        <v-list-item link to="/about">
          <v-list-item-title>About</v-list-item-title>
        </v-list-item>
        <v-list-item link to="/testing/grid-test">
          <v-list-item-title>Grid Test</v-list-item-title>
        </v-list-item>
        <v-list-item link to="/testing/orbitdb-test">
          <v-list-item-title>OrbitDB Test</v-list-item-title>
        </v-list-item>
        <v-list-item link to="/editor/view-editor">
          <v-list-item-title>View Editor</v-list-item-title>
        </v-list-item>
        <!-- <v-list-item link to="/execute/view?address=YOUR_VIEW_DB_ADDRESS_HERE">
            <v-list-item-title>Execute View (Test)</v-list-item-title>
          </v-list-item> -->
        <!-- Profile and Settings links are now in UserProfileChip dropdown -->
      </v-list>
    </v-navigation-drawer>

    <v-app-bar color="blue-lighten-4" density="comfortable">
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-spacer></v-spacer>
      <UserProfileChip />
    </v-app-bar>

    <v-main>
      <slot />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import UserProfileChip from '~/components/auth/UserProfileChip.vue';
import logoUrl from '~/assets/images/gridable-rubiks.webp';

const drawer = ref(false);
</script>

<style scoped>
/* Scoped styles for the layout if needed */
/* Scoped styles for the layout if needed */
</style>
