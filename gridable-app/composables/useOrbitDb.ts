import { ref, onMounted } from 'vue';
import { useNuxtApp } from '#app';

export function useOrbitDb(dbName: string = 'default-kv') {
  const { $getKeyValueDatabase, $orbitdb } = useNuxtApp();
  const isDbReady = ref(false);
  const db = ref<any>(null);

  const initialize = async () => {
    if (process.client) {
      try {
        db.value = await $getKeyValueDatabase(dbName, undefined, true); // Owner-controlled
        console.log(`Database ${dbName} opened at address: ${db.value.address}`);
        isDbReady.value = true;
      } catch (error) {
        console.error(`Failed to initialize OrbitDB or database ${dbName}:`, error);
        isDbReady.value = false;
      }
    }
  };

  onMounted(initialize);

  return {
    orbitdb: $orbitdb,
    db,
    isDbReady,
  };
}