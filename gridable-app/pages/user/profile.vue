<template>
  <v-container>
    <v-row v-if="authStore.isAuthenticated && authStore.currentUser">
      <v-col>
        <v-card>
          <v-card-title>User Profile</v-card-title>
          <v-card-text>
            <p><strong>DID:</strong> {{ authStore.currentUser.did }}</p>
            <p><strong>Display Name:</strong> {{ authStore.currentUser.displayName }}</p>
            <!-- Add more profile fields here -->
            <v-img :src="authStore.currentUser.avatarUrl" max-width="150" class="my-3"></v-img>
            <p class="mt-4 text-caption">
              This is a placeholder profile page. Full DID profile management will be implemented later.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row v-else>
      <v-col>
        <p>Please log in to view your profile.</p>
        <LoginButton />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/store/auth';
import LoginButton from '~/components/auth/LoginButton.vue'; // If needed for non-logged in state

const authStore = useAuthStore();

// Nuxt 3 middleware can also be used to protect this route
definePageMeta({
  // middleware: ['auth'] // Example if an auth middleware is defined
});
</script>
