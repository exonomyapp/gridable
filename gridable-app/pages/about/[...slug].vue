<template>
  <v-container fluid>
    <v-row>
      <v-col>
        <MarkdownViewer :url="`/api/docs/${slug}`" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import MarkdownViewer from '~/components/MarkdownViewer.vue';

const route = useRoute();
const slug = Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug;
</script>