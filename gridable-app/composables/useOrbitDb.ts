import { ref, onMounted } from 'vue';
import { getOrbitDBInstance, getKeyValueDatabase } from '~/services/orbitdb';

const orbitdb = ref<any>(null);
const db = ref<any>(null);

export function useOrbitDb(dbName: string = 'default-kv') {
  const isDbReady = ref(false);

  const initialize = async () => {
    try {
      orbitdb.value = await getOrbitDBInstance();
      console.log(`OrbitDB instance retrieved for ${dbName}.`);
      db.value = await getKeyValueDatabase(dbName, undefined, true); // Owner-controlled
      console.log(`Database ${dbName} opened at address: ${db.value.address}`);
      isDbReady.value = true;
    } catch (error) {
      console.error(`Failed to initialize OrbitDB or database ${dbName}:`, error);
      isDbReady.value = false;
    }
  };

  onMounted(initialize);

  return {
    orbitdb,
    db,
    isDbReady,
  };
}