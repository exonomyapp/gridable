<template>
  <v-container fluid>
    <v-row>
      <v-col>
        <h2>OrbitDB Test Page</h2>
        <p>Testing OrbitDB integration and displaying data in GridableGrid.</p>
        <v-alert v-if="statusMessage" :type="statusType" dense dismissible>
          {{ statusMessage }}
        </v-alert>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>Controls</v-card-title>
          <v-card-text>
            <v-btn @click="initDB" :loading="loading.init" :disabled="isOrbitDBReady" block class="mb-2">
              Initialize OrbitDB
            </v-btn>
            <v-divider class="my-3"></v-divider>
            <v-text-field v-model="newItem.id" label="Item ID (Key)" :disabled="!isOrbitDBReady"></v-text-field>
            <v-text-field v-model="newItem.name" label="Item Name" :disabled="!isOrbitDBReady"></v-text-field>
            <v-text-field v-model="newItem.value" label="Item Value" :disabled="!isOrbitDBReady"></v-text-field>
            <v-btn @click="addItem" :loading="loading.add" :disabled="!isOrbitDBReady || !newItem.id || !newItem.name" block class="mb-2">
              Add Item
            </v-btn>
            <v-divider class="my-3"></v-divider>
            <v-text-field v-model="deleteKey" label="ID to Delete" :disabled="!isOrbitDBReady"></v-text-field>
            <v-btn @click="deleteItem" :loading="loading.delete" :disabled="!isOrbitDBReady || !deleteKey" block color="error" class="mb-2">
              Delete Item by ID
            </v-btn>
             <v-divider class="my-3"></v-divider>
            <v-btn @click="closeDB" :loading="loading.close" :disabled="!isOrbitDBReady" block class="mt-2">
              Close OrbitDB & Helia
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>Data from OrbitDB</v-card-title>
          <v-card-text>
            <v-btn @click="loadData" :loading="loading.load" :disabled="!isOrbitDBReady" small class="mb-3">
              Refresh Data
            </v-btn>
            <GridableGrid v-if="isOrbitDBReady" :column-defs="gridColumns" :row-data="gridData" :items-per-page="5" />
            <p v-else>OrbitDB not initialized. Click "Initialize OrbitDB" to start.</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

  </v-container>
</template>

<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue';
import GridableGrid from '~/components/core/GridableGrid.vue';
import {
  getOrbitDBInstance,
  getKeyValueDatabase,
  addDataToDB,
  getAllDataFromDB,
  deleteDataFromDB,
  closeOrbitDB,
  type MyDataItem
} from '~/services/orbitdb'; // Adjusted path

const TEST_DB_NAME = 'gridable_test_kv_store';

const statusMessage = ref('');
const statusType = ref<'success' | 'error' | 'info'>('info');
const loading = ref({
  init: false,
  add: false,
  load: false,
  delete: false,
  close: false,
});

const orbitDBInstance = ref<any>(null);
const dbInstance = ref<any>(null); // To hold the specific db instance

const newItem = ref<MyDataItem>({ id: '', name: '', value: '' });
const deleteKey = ref('');
const gridData = ref<MyDataItem[]>([]);

const gridColumns = ref([
  { headerName: 'ID (Key)', field: 'id', sortable: true },
  { headerName: 'Name', field: 'name', sortable: true },
  { headerName: 'Value', field: 'value', sortable: true }
]);

const isOrbitDBReady = computed(() => !!orbitDBInstance.value && !!dbInstance.value);

const setStatus = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
  statusMessage.value = message;
  statusType.value = type;
  if (duration > 0) {
    setTimeout(() => statusMessage.value = '', duration);
  }
};

async function initDB() {
  loading.value.init = true;
  setStatus('Initializing Helia and OrbitDB...', 'info', 0);
  try {
    orbitDBInstance.value = await getOrbitDBInstance();
    dbInstance.value = await getKeyValueDatabase(TEST_DB_NAME);
    setStatus('OrbitDB initialized successfully and test database opened!', 'success');
    await loadData(); // Load initial data
  } catch (error: any) {
    console.error('Error initializing OrbitDB:', error);
    setStatus(`Error initializing OrbitDB: ${error.message}`, 'error');
    orbitDBInstance.value = null;
    dbInstance.value = null;
  } finally {
    loading.value.init = false;
  }
}

async function addItem() {
  if (!isOrbitDBReady.value || !newItem.value.id || !newItem.value.name) {
    setStatus('Please provide ID and Name for the item.', 'error');
    return;
  }
  loading.value.add = true;
  setStatus('Adding item...', 'info', 0);
  try {
    await addDataToDB(TEST_DB_NAME, newItem.value.id, { ...newItem.value });
    setStatus('Item added successfully!', 'success');
    newItem.value = { id: '', name: '', value: '' }; // Reset form
    await loadData(); // Refresh grid
  } catch (error: any) {
    console.error('Error adding item:', error);
    setStatus(`Error adding item: ${error.message}`, 'error');
  } finally {
    loading.value.add = false;
  }
}

async function loadData() {
  if (!isOrbitDBReady.value) {
    // setStatus('OrbitDB not ready to load data.', 'info');
    return;
  }
  loading.value.load = true;
  // setStatus('Loading data from OrbitDB...', 'info', 0);
  try {
    gridData.value = await getAllDataFromDB(TEST_DB_NAME);
    // setStatus('Data loaded successfully.', 'success');
  } catch (error: any)
  {
    console.error('Error loading data:', error);
    setStatus(`Error loading data: ${error.message}`, 'error');
    gridData.value = []; // Clear data on error
  } finally {
    loading.value.load = false;
  }
}

async function deleteItem() {
  if (!isOrbitDBReady.value || !deleteKey.value) {
    setStatus('Please provide an ID to delete.', 'error');
    return;
  }
  loading.value.delete = true;
  setStatus(`Deleting item with ID: ${deleteKey.value}...`, 'info', 0);
  try {
    await deleteDataFromDB(TEST_DB_NAME, deleteKey.value);
    setStatus('Item deleted successfully!', 'success');
    deleteKey.value = ''; // Clear input
    await loadData(); // Refresh grid
  } catch (error: any) {
    console.error('Error deleting item:', error);
    setStatus(`Error deleting item: ${error.message}`, 'error');
  } finally {
    loading.value.delete = false;
  }
}

async function closeDB() {
  loading.value.close = true;
  setStatus('Closing OrbitDB and Helia node...', 'info', 0);
  try {
    await closeOrbitDB();
    orbitDBInstance.value = null;
    dbInstance.value = null;
    gridData.value = [];
    setStatus('OrbitDB and Helia node closed.', 'success');
  } catch (error: any) {
    console.error('Error closing OrbitDB:', error);
    setStatus(`Error closing OrbitDB: ${error.message}`, 'error');
  } finally {
    loading.value.close = false;
  }
}

// Attempt to close OrbitDB when the component is unmounted (e.g., navigating away)
// This is important for releasing resources.
onUnmounted(async () => {
  if (isOrbitDBReady.value) {
    console.log('OrbitDB test page unmounted, closing DB connection.');
    await closeDB();
  }
});

</script>

<style scoped>
/* Add any specific styles for this test page */
</style>
