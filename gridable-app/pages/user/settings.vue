<template>
  <v-container>
    <v-row v-if="authStore.isAuthenticated">
      <v-col>
        <v-card>
          <v-card-title>Settings</v-card-title>
          <v-card-text>
            <p><strong>User:</strong> {{ authStore.currentUser?.displayName }}</p>
            <h5 class="mt-4">Gridable Settings</h5>
            <p class="text-caption">Placeholder for Gridable application settings.</p>
            <!-- Add Gridable specific settings here -->

            <h5 class="mt-6">Third-Party Authenticator Settings</h5>
            <p class="text-caption">
              Placeholder for managing linked third-party authenticators (Google, GitHub, etc.).
              This will be part of the Nuxt 3 layers for authentication.
            </p>
            <!-- Add 3rd party auth settings here -->
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
     <v-row v-else>
      <v-col>
        <p>Please log in to manage settings.</p>
        <LoginButton />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/store/auth';
import LoginButton from '~/components/auth/LoginButton.vue';

const authStore = useAuthStore();

definePageMeta({
  // middleware: ['auth']
});
</script>
