<template>
  <v-app>
    <div class="app-container">
      <header class="app-header">
        <div class="header-content">
          <h1>Gridable</h1>
          <v-spacer></v-spacer>
          <LoginButton />
        </div>
      </header>
      <nav class="app-nav">
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
      </nav>
      <main class="app-content">
        <slot />
      </main>
      <footer class="app-footer">
        <p>&copy; {{ new Date().getFullYear() }} Gridable</p>
      </footer>
    </div>
  </v-app>
</template>

<script setup lang="ts">
import LoginButton from '~/components/auth/LoginButton.vue';
// Script setup if needed for other things
</script>

<style scoped>
/* Scoped styles for the layout if needed */
.app-header {
  /* Existing styles */
  /* Ensure header-content can use flex */
}
.header-content {
  display: flex;
  align-items: center;
  width: 100%;
}
</style>
