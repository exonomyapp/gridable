<template>
  <v-container fluid>
    <v-row>
      <v-col>
        <h2>OrbitDB Test Page</h2>
        <p>Testing OrbitDB integration: Key-Value and Document Stores.</p>
        <v-alert v-if="statusMessage" :type="statusType" dense dismissible>
          {{ statusMessage }}
        </v-alert>
      </v-col>
    </v-row>

    <!-- Key-Value Store Tests -->
    <v-row>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>KV Store Controls</v-card-title>
          <v-card-text>
            <v-btn @click="initKVDB" :loading="loading.initKV" :disabled="isKVDBReady" block class="mb-2">
              Initialize KV Store
            </v-btn>
            <v-divider class="my-3"></v-divider>
            <v-text-field v-model="newItem.id" label="Item ID (Key)" :disabled="!isKVDBReady"></v-text-field>
            <v-text-field v-model="newItem.name" label="Item Name" :disabled="!isKVDBReady"></v-text-field>
            <v-text-field v-model="newItem.value" label="Item Value" :disabled="!isKVDBReady"></v-text-field>
            <v-btn @click="addItem" :loading="loading.add" :disabled="!isKVDBReady || !newItem.id || !newItem.name" block class="mb-2">
              Add Item to KV
            </v-btn>
            <v-divider class="my-3"></v-divider>
            <v-text-field v-model="deleteKey" label="ID to Delete" :disabled="!isKVDBReady"></v-text-field>
            <v-btn @click="deleteItem" :loading="loading.delete" :disabled="!isKVDBReady || !deleteKey" block color="error" class="mb-2">
              Delete Item by ID (KV)
            </v-btn>
             <v-divider class="my-3"></v-divider>
            <v-btn @click="closeDB" :loading="loading.close" block class="mt-2">
              Close OrbitDB & Helia
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>Data from Key-Value Store</v-card-title>
          <v-card-text>
            <v-btn @click="loadKVData" :loading="loading.loadKV" :disabled="!isKVDBReady" small class="mb-3">
              Refresh KV Data
            </v-btn>
            <GridableGrid v-if="isKVDBReady" :column-defs="gridColumns" :row-data="gridData" :items-per-page="5" />
            <p v-else>Key-Value Store not initialized.</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Document Store Tests -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>Document Store Tests</v-card-title>
          <v-card-text>
            <v-text-field v-model="docStoreName" label="Document Store Name (e.g., my-docs-db)" :disabled="!orbitDBInstance" hint="Will be created if it does not exist. Ensure OrbitDB is initialized first (via KV Store section or implicitly)."></v-text-field>
            <v-btn @click="openOrCreateDocStore" :loading="loading.docStoreOpen" :disabled="!orbitDBInstance || !docStoreName" block class="mb-3">
              Open/Create Document Store
            </v-btn>

            <div v-if="currentDocStore">
              <p class="text-caption">Current Doc Store: <strong>{{ currentDocStore.address?.toString() }}</strong></p>
              <v-textarea v-model="newDocumentContent" label="New Document JSON Content (e.g., { &quot;name&quot;: &quot;test&quot;, &quot;value&quot;: 123 })" rows="3" class="mt-2"></v-textarea>
              <v-text-field v-model="newDocumentId" label="Document _id (optional - if empty, OrbitDB assigns one)" hint="If providing, ensure it is unique for new docs."></v-text-field>
              <v-btn @click="putNewDocument" :loading="loading.docPut" :disabled="!newDocumentContent" block class="mb-3">Put Document</v-btn>

              <v-text-field v-model="docIdToFetch" label="Document _id to Fetch" class="mt-2"></v-text-field>
              <v-btn @click="fetchDocumentById" :loading="loading.docGet" :disabled="!docIdToFetch" block class="mb-3">Fetch Document by _id</v-btn>

              <div v-if="fetchedDocument">
                <h4>Fetched Document:</h4>
                <pre style="background-color: #f0f0f0; padding: 10px; border-radius: 4px; white-space: pre-wrap;">{{ JSON.stringify(fetchedDocument, null, 2) }}</pre>
              </div>
            </div>
            <p v-else-if="orbitDBInstance">Document Store not yet opened/created. Please provide a name and click above.</p>
             <p v-else>Initialize OrbitDB first (e.g. via KV Store section) to enable Document Store operations.</p>
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
  getDocumentStoreDatabase, // New import
  putDocument,             // New import
  getDocumentById,         // New import
  type MyDataItem // Assuming MyDataItem is {id, name, value} for KV store
} from '~/services/orbitdb';

const TEST_KV_DB_NAME = 'gridable_test_kv_store';

const statusMessage = ref('');
const statusType = ref<'success' | 'error' | 'info'>('info');
const loading = ref({
  initKV: false, // Renamed from init
  add: false,
  loadKV: false, // Renamed from load
  delete: false,
  close: false,
  docStoreOpen: false, // New
  docPut: false,       // New
  docGet: false        // New
});

const orbitDBInstance = ref<any>(null); // Will hold the global OrbitDB instance
const kvDbInstance = ref<any>(null);    // Specific to the Key-Value store example

const newItem = ref<MyDataItem>({ id: '', name: '', value: '' });
const deleteKey = ref('');
const gridData = ref<MyDataItem[]>([]);

const gridColumns = ref([
  { headerName: 'ID (Key)', field: 'id', sortable: true },
  { headerName: 'Name', field: 'name', sortable: true },
  { headerName: 'Value', field: 'value', sortable: true }
]);

// Computed for KV DB readiness, OrbitDB instance is checked separately for Doc store
const isKVDBReady = computed(() => !!orbitDBInstance.value && !!kvDbInstance.value);

const setStatus = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
  statusMessage.value = message;
  statusType.value = type;
  if (duration > 0) { setTimeout(() => statusMessage.value = '', duration); }
};

async function ensureOrbitDBInitialized() {
  if (orbitDBInstance.value) return orbitDBInstance.value;
  loading.value.initKV = true; // Use initKV for global init indicator for now
  setStatus('Initializing Helia and OrbitDB (first time)...', 'info', 0);
  try {
    orbitDBInstance.value = await getOrbitDBInstance();
    setStatus('OrbitDB initialized successfully!', 'success');
    return orbitDBInstance.value;
  } catch (error: any) {
    console.error('Error initializing OrbitDB globally:', error);
    setStatus(`Error initializing OrbitDB: ${error.message}`, 'error');
    orbitDBInstance.value = null;
    throw error; // Re-throw to calling function
  } finally {
    loading.value.initKV = false;
  }
}

async function initKVDB() {
  try {
    await ensureOrbitDBInitialized();
    if (!orbitDBInstance.value) return; // Guard if ensureOrbitDBInitialized failed silently or was modified

    loading.value.initKV = true; // Specific loading for KV DB part
    setStatus('Opening KV Store...', 'info', 0);
    kvDbInstance.value = await getKeyValueDatabase(TEST_KV_DB_NAME);
    setStatus('KV Store initialized and test database opened!', 'success');
    await loadKVData();
  } catch (error: any) {
    // Error already set by ensureOrbitDBInitialized or getKeyValueDatabase
    kvDbInstance.value = null; // Ensure it's null on failure
  } finally {
    loading.value.initKV = false;
  }
}

async function addItem() {
  if (!isKVDBReady.value || !newItem.value.id || !newItem.value.name) { setStatus('KV Store not ready or ID/Name missing.', 'error'); return; }
  loading.value.add = true; setStatus('Adding item to KV...', 'info', 0);
  try {
    await addDataToDB(TEST_KV_DB_NAME, newItem.value.id, { ...newItem.value });
    setStatus('Item added to KV successfully!', 'success');
    newItem.value = { id: '', name: '', value: '' };
    await loadKVData();
  } catch (error: any) { console.error('Error adding KV item:', error); setStatus(`Error adding KV item: ${error.message}`, 'error'); }
  finally { loading.value.add = false; }
}

async function loadKVData() {
  if (!isKVDBReady.value) return;
  loading.value.loadKV = true;
  try {
    gridData.value = await getAllDataFromDB(TEST_KV_DB_NAME);
  } catch (error: any) { console.error('Error loading KV data:', error); setStatus(`Error loading KV data: ${error.message}`, 'error'); gridData.value = []; }
  finally { loading.value.loadKV = false; }
}

async function deleteItem() {
  if (!isKVDBReady.value || !deleteKey.value) { setStatus('KV Store not ready or ID to delete missing.', 'error'); return; }
  loading.value.delete = true; setStatus(`Deleting KV item ID: ${deleteKey.value}...`, 'info', 0);
  try {
    await deleteDataFromDB(TEST_KV_DB_NAME, deleteKey.value);
    setStatus('KV Item deleted successfully!', 'success');
    deleteKey.value = '';
    await loadKVData();
  } catch (error: any) { console.error('Error deleting KV item:', error); setStatus(`Error deleting KV item: ${error.message}`, 'error'); }
  finally { loading.value.delete = false; }
}

async function closeDB() {
  loading.value.close = true; setStatus('Closing OrbitDB & Helia node...', 'info', 0);
  try {
    await closeOrbitDB();
    orbitDBInstance.value = null;
    kvDbInstance.value = null;
    currentDocStore.value = null; // Also clear doc store instance
    gridData.value = [];
    setStatus('OrbitDB and Helia node closed.', 'success');
  } catch (error: any) { console.error('Error closing OrbitDB:', error); setStatus(`Error closing OrbitDB: ${error.message}`, 'error'); }
  finally { loading.value.close = false; }
}

onUnmounted(async () => {
  // Close DB if any instance (KV or Doc) is active or if global OrbitDB instance exists
  if (orbitDBInstance.value) {
    console.log('OrbitDB test page unmounted, closing DB connection.');
    await closeDB();
  }
});

// --- Document Store Test State & Methods ---
const docStoreName = ref("gridable-test-docstore");
const currentDocStore = ref<any>(null);
const newDocumentContent = ref(`{ "message": "Hello OrbitDB Docs!", "timestamp": ${Date.now()} }`);
const newDocumentId = ref("");
const docIdToFetch = ref("");
const fetchedDocument = ref<any>(null);

async function openOrCreateDocStore() {
  try {
    await ensureOrbitDBInitialized(); // Make sure global OrbitDB is up
    if (!orbitDBInstance.value || !docStoreName.value) {
      setStatus("OrbitDB not ready or Doc Store name not provided.", "error"); return;
    }
    loading.value.docStoreOpen = true;
    setStatus(`Opening/Creating Document Store: ${docStoreName.value}...`, "info", 0);
    currentDocStore.value = await getDocumentStoreDatabase(docStoreName.value); // Add AC options if needed
    setStatus(`Document Store "${docStoreName.value}" opened at ${currentDocStore.value.address.toString()}`, "success");
    fetchedDocument.value = null; docIdToFetch.value = "";
  } catch (error: any) {
    console.error("Error opening/creating document store:", error);
    setStatus(`Error opening Doc Store: ${error.message}`, "error");
    currentDocStore.value = null;
  } finally {
    loading.value.docStoreOpen = false;
  }
}

async function putNewDocument() {
  if (!currentDocStore.value) { setStatus("Document Store not open.", "error"); return; }
  let docToPut;
  try {
    docToPut = JSON.parse(newDocumentContent.value);
    if (newDocumentId.value.trim() !== "") { docToPut._id = newDocumentId.value.trim(); }
  } catch (e: any) { setStatus(`Invalid JSON content: ${e.message}`, "error"); return; }

  loading.value.docPut = true; setStatus("Putting document...", "info", 0);
  try {
    const returnedIdOrHash = await putDocument(currentDocStore.value, docToPut);
    // OrbitDB Document store populates _id on the object itself if it was new.
    const finalId = docToPut._id || returnedIdOrHash;
    setStatus(`Document put. Final _id: ${finalId}`, "success");
    if (finalId) { docIdToFetch.value = finalId; } // Set for easy fetching
    newDocumentContent.value = `{ "message": "Another doc!", "value": ${Math.floor(Math.random()*100)} }`;
    newDocumentId.value = "";
  } catch (error: any) { console.error("Error putting document:", error); setStatus(`Error putting document: ${error.message}`, "error"); }
  finally { loading.value.docPut = false; }
}

async function fetchDocumentById() {
  if (!currentDocStore.value) { setStatus("Document Store not open.", "error"); return; }
  if (!docIdToFetch.value) { setStatus("Please provide a Document _id to fetch.", "error"); return; }
  loading.value.docGet = true; setStatus(`Fetching document by _id: ${docIdToFetch.value}...`, "info", 0);
  fetchedDocument.value = null;
  try {
    const doc = await getDocumentById(currentDocStore.value, docIdToFetch.value);
    if (doc) {
      fetchedDocument.value = doc;
      setStatus(`Document with _id "${docIdToFetch.value}" fetched.`, "success");
    } else {
      setStatus(`Document with _id "${docIdToFetch.value}" not found.`, "warning");
    }
  } catch (error: any) { console.error("Error fetching document by ID:", error); setStatus(`Error fetching document: ${error.message}`, "error"); }
  finally { loading.value.docGet = false; }
}

</script>

<style scoped>
/* Add any specific styles for this test page */
</style>
