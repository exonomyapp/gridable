<template>
  <div>
    <v-btn v-if="!authStore.isAuthenticated" @click="handleLogin" :loading="authStore.loading" color="primary">
      Login (Mock)
    </v-btn>
    <div v-else>
      <UserProfileChip />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/store/auth';
import UserProfileChip from './UserProfileChip.vue';

const authStore = useAuthStore();

const handleLogin = async () => {
  await authStore.login('Demo User'); // Provide a default name for mock login
};
</script>
