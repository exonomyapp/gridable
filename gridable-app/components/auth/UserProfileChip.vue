<template>
  <div v-if="authStore.isAuthenticated && authStore.currentUser" class="d-flex align-center">
    <v-menu offset-y>
      <template v-slot:activator="{ props }">
        <v-chip pill v-bind="props" link>
          <v-avatar start>
            <v-img :src="authStore.userAvatar || 'https://cdn.vuetifyjs.com/images/avatars/avatar.png'"></v-img>
          </v-avatar>
          {{ authStore.userDisplayName }}
        </v-chip>
      </template>
      <v-list dense>
        <v-list-item to="/user/profile">
          <v-list-item-title>Profile</v-list-item-title>
        </v-list-item>
        <v-list-item to="/user/settings">
          <v-list-item-title>Settings</v-list-item-title>
        </v-list-item>
        <v-divider></v-divider>
        <v-list-item @click="handleLogout">
          <v-list-item-title>Logout</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/store/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();

const handleLogout = async () => {
  await authStore.logout();
  router.push('/'); // Redirect to home after logout
};
</script>
