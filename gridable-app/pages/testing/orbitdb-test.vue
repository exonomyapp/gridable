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
            <UpGrid v-if="isKVDBReady" :column-defs="gridColumns" :row-data="gridData" :items-per-page="5" />
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
import { ref, onUnmounted, computed, defineAsyncComponent } from 'vue';
import { useAuthStore } from '~/store/auth'; // Added for auth
import {
  getOrbitDBInstance,
  getKeyValueDatabase,
  addDataToDB,
  getAllDataFromDB,
  deleteDataFromDB,
  closeOrbitDB,
  getDocumentStoreDatabase,
  putDocument,
  getDocumentById,
  type KeyValueEntry, // Changed MyDataItem to KeyValueEntry for clarity
  // For Test Case 2, we need more direct imports if not re-exported by orbitdb.ts
  CustomDIDIdentityProvider,
  CustomDIDAccessController,
  mockDidSigningFunction,
  // mockDidVerificationFunction, // Not directly needed by test client usually
} from '~/services/orbitdb';

// Helia and OrbitDBCore are needed for Test Case 2's isolated instance
import { createHelia } from 'helia';
import { createOrbitDB } from '@orbitdb/core';


const TEST_KV_DB_NAME = 'gridable_test_kv_store';
const TEST_OWNED_DB_NAME_PREFIX = 'owned_db_';
const TEST_PUBLIC_DB_NAME = 'test_public_kv_store';

const statusMessage = ref('');
const statusType = ref<'success' | 'error' | 'info'>('info');
const loading = ref({
  initKV: false,
  add: false,
  loadKV: false,
  delete: false,
  close: false,
  docStoreOpen: false,
  docPut: false,
  docGet: false,
  login: false, // Added for auth
  testCase1: false, // Added for new test
  testCase2: false  // Added for new test
});

const authStore = useAuthStore(); // Added for auth
const orbitDBInstance = ref<any>(null);
const kvDbInstance = ref<any>(null);

const newItem = ref<KeyValueEntry>({ id: '', name: '', value: '' }); // Changed type
const deleteKey = ref('');
const gridData = ref<KeyValueEntry[]>([]); // Changed type

const gridColumns = ref([
  { headerName: 'ID (Key)', field: 'id', sortable: true },
  { headerName: 'Name', field: 'name', sortable: true },
  { headerName: 'Value', field: 'value', sortable: true }
]);

// Test Case State
const testCase1Result = ref('');
const testCase2Result = ref('');
const ownedDBAddressForTestCase2 = ref<string | null>(null);


const isAuthenticated = computed(() => authStore.isAuthenticated);
const userDID = computed(() => authStore.currentUser?.did);

// Computed for KV DB readiness, OrbitDB instance is checked separately for Doc store
const isKVDBReady = computed(() => !!orbitDBInstance.value && !!kvDbInstance.value && isAuthenticated.value);

const setStatus = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
  statusMessage.value = message;
  statusType.value = type;
  if (duration > 0) { setTimeout(() => statusMessage.value = '', duration); }
};

// --- Authentication ---
async function loginUser() {
  loading.value.login = true;
  setStatus('Logging in mock user...', 'info', 0);
  try {
    await authStore.login('Mock Test User');
    setStatus(`Logged in as ${authStore.currentUser?.displayName} (DID: ${authStore.currentUser?.did})`, 'success');
    // Attempt to initialize OrbitDB after login
    await ensureOrbitDBInitialized();
  } catch (error: any) {
    console.error('Error logging in:', error);
    setStatus(`Login failed: ${error.message}`, 'error');
  } finally {
    loading.value.login = false;
  }
}


async function ensureOrbitDBInitialized() {
  if (!isAuthenticated.value) {
    setStatus('User not authenticated. Please login first.', 'error');
    return null; // Return null instead of throwing to allow UI to handle
  }
  if (orbitDBInstance.value) return orbitDBInstance.value;

  // Check if user is authenticated before trying to init.
  if (!authStore.currentUser?.did) {
    setStatus('Cannot initialize OrbitDB: User DID not available. Please login.', 'error');
    return null;
  }

  loading.value.initKV = true; // Use initKV for global init indicator for now
  setStatus('Initializing Helia and OrbitDB (first time for this user session)...', 'info', 0);
  try {
    orbitDBInstance.value = await getOrbitDBInstance(); // This now relies on logged-in user's DID
    setStatus('OrbitDB initialized successfully for current user!', 'success');
    return orbitDBInstance.value;
  } catch (error: any) {
    console.error('Error initializing OrbitDB globally:', error);
    setStatus(`Error initializing OrbitDB: ${error.message}`, 'error');
    orbitDBInstance.value = null; // Reset on error
    // Do not re-throw, allow UI to stay responsive
    return null;
  } finally {
    loading.value.initKV = false;
  }
}

async function initKVDB() {
  if (!isAuthenticated.value) { setStatus('Please login first.', 'error'); return; }
  try {
    const odb = await ensureOrbitDBInitialized();
    if (!odb) {
      setStatus('OrbitDB could not be initialized. Cannot open KV store.', 'error');
      return;
    }
    loading.value.initKV = true; // Specific loading for KV DB part
    setStatus('Opening KV Store...', 'info', 0);
    // Using ownerControlled: true for the default test KV store for this user
    kvDbInstance.value = await getKeyValueDatabase(TEST_KV_DB_NAME, undefined, true);
    setStatus(`KV Store '${TEST_KV_DB_NAME}' (owner-controlled) initialized! Address: ${kvDbInstance.value.address.toString()}`, 'success');
    await loadKVData();
  } catch (error: any) {
    setStatus(error.message || 'Failed to initialize KV DB', 'error');
    kvDbInstance.value = null; // Ensure it's null on failure
  } finally {
    loading.value.initKV = false;
  }
}

async function addItem() {
  if (!isKVDBReady.value || !newItem.value.id || !newItem.value.name) { setStatus('KV Store not ready, user not logged in, or ID/Name missing.', 'error'); return; }
  loading.value.add = true; setStatus('Adding item to KV...', 'info', 0);
  try {
    // addDataToDB implicitly uses the DB name passed to getKeyValueDatabase during initKVDB
    await addDataToDB(TEST_KV_DB_NAME, newItem.value.id, { ...newItem.value });
    setStatus('Item added to KV successfully!', 'success');
    newItem.value = { id: '', name: '', value: '' }; // Reset newItem
    await loadKVData();
  } catch (error: any) { console.error('Error adding KV item:', error); setStatus(`Error adding KV item: ${error.message}`, 'error'); }
  finally { loading.value.add = false; }
}

async function loadKVData() {
  if (!isKVDBReady.value) { setStatus('KV Store not ready or user not logged in.', 'error'); return; }
  loading.value.loadKV = true;
  try {
    // getAllDataFromDB implicitly uses the DB name passed to getKeyValueDatabase during initKVDB
    gridData.value = await getAllDataFromDB(TEST_KV_DB_NAME);
  } catch (error: any) { console.error('Error loading KV data:', error); setStatus(`Error loading KV data: ${error.message}`, 'error'); gridData.value = []; }
  finally { loading.value.loadKV = false; }
}

async function deleteItem() {
  if (!isKVDBReady.value || !deleteKey.value) { setStatus('KV Store not ready, user not logged in, or ID to delete missing.', 'error'); return; }
  loading.value.delete = true; setStatus(`Deleting KV item ID: ${deleteKey.value}...`, 'info', 0);
  try {
    // deleteDataFromDB implicitly uses the DB name passed to getKeyValueDatabase during initKVDB
    await deleteDataFromDB(TEST_KV_DB_NAME, deleteKey.value);
    setStatus('KV Item deleted successfully!', 'success');
    deleteKey.value = '';
    await loadKVData();
  } catch (error: any) { console.error('Error deleting KV item:', error); setStatus(`Error deleting KV item: ${error.message}`, 'error'); }
  finally { loading.value.delete = false; }
}

async function closeDB() { // This closes the global OrbitDB instance for the logged-in user
  loading.value.close = true; setStatus('Closing OrbitDB & Helia node for current user...', 'info', 0);
  try {
    await closeOrbitDB(); // This is the one from orbitdb.ts service
    orbitDBInstance.value = null; // Reset the global instance ref
    kvDbInstance.value = null;
    currentDocStore.value = null;
    gridData.value = [];
    ownedDBAddressForTestCase2.value = null; // Reset test specific state
    setStatus('OrbitDB and Helia node closed for current user.', 'success');
    // Note: This does not automatically log out the user from authStore.
    // If another action requires OrbitDB, ensureOrbitDBInitialized will re-initialize it.
  } catch (error: any) { console.error('Error closing OrbitDB:', error); setStatus(`Error closing OrbitDB: ${error.message}`, 'error'); }
  finally { loading.value.close = false; }
}

onUnmounted(async () => {
  // Close DB if any instance (KV or Doc) is active or if global OrbitDB instance exists
  if (orbitDBInstance.value) { // If the global OrbitDB instance for the user exists
    console.log('OrbitDB test page unmounted, closing user DB connection.');
    await closeDB(); // This will close the user's global OrbitDB instance
  }
  // Any Helia/OrbitDB instances created specifically for Test Case 2 should be stopped within that test case.
});

// --- Document Store Test State & Methods ---
const docStoreName = ref("gridable-test-docstore");
const currentDocStore = ref<any>(null); // This will be for the logged-in user
const newDocumentContent = ref(`{ "message": "Hello OrbitDB Docs!", "timestamp": ${Date.now()} }`);
const newDocumentId = ref("");
const docIdToFetch = ref("");
const fetchedDocument = ref<any>(null);

async function openOrCreateDocStore() {
  if (!isAuthenticated.value) { setStatus('Please login first.', 'error'); return; }
  const odb = await ensureOrbitDBInitialized();
  if (!odb || !docStoreName.value) {
    setStatus("OrbitDB not ready or Doc Store name not provided.", "error"); return;
  }
  loading.value.docStoreOpen = true;
  setStatus(`Opening/Creating Document Store: ${docStoreName.value}...`, "info", 0);
  try {
    // Making this document store owner-controlled by default for testing purposes
    currentDocStore.value = await getDocumentStoreDatabase(docStoreName.value, undefined, true);
    setStatus(`Document Store "${docStoreName.value}" (owner-controlled) opened at ${currentDocStore.value.address.toString()}`, "success");
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
  if (!currentDocStore.value || !isAuthenticated.value) { setStatus("Document Store not open or user not logged in.", "error"); return; }
  let docToPut;
  try {
    docToPut = JSON.parse(newDocumentContent.value);
    if (newDocumentId.value.trim() !== "") { docToPut._id = newDocumentId.value.trim(); }
  } catch (e: any) { setStatus(`Invalid JSON content: ${e.message}`, "error"); return; }

  loading.value.docPut = true; setStatus("Putting document...", "info", 0);
  try {
    const returnedIdOrHash = await putDocument(currentDocStore.value, docToPut);
    const finalId = docToPut._id || returnedIdOrHash;
    setStatus(`Document put. Final _id: ${finalId}`, "success");
    if (finalId) { docIdToFetch.value = finalId; }
    newDocumentContent.value = `{ "message": "Another doc!", "value": ${Math.floor(Math.random()*100)} }`;
    newDocumentId.value = "";
  } catch (error: any) { console.error("Error putting document:", error); setStatus(`Error putting document: ${error.message}`, "error"); }
  finally { loading.value.docPut = false; }
}

async function fetchDocumentById() {
  if (!currentDocStore.value || !isAuthenticated.value) { setStatus("Document Store not open or user not logged in.", "error"); return; }
  if (!docIdToFetch.value) { setStatus("Please provide a Document _id to fetch.", "error"); return; }
  loading.value.docGet = true; setStatus(`Fetching document by _id: ${docIdToFetch.value}...`, "info", 0);
  fetchedDocument.value = null;
  try {
    const doc = await getDocumentById(currentDocStore.value, docIdToFetch.value);
    if (doc) {
      fetchedDocument.value = doc;
      setStatus(`Document with _id "${docIdToFetch.value}" fetched.`, "success");
    } else {
      setStatus(`Document with _id "${docIdToFetch.value}" not found.`, "info");
    }
  } catch (error: any) { console.error("Error fetching document by ID:", error); setStatus(`Error fetching document: ${error.message}`, "error"); }
  finally { loading.value.docGet = false; }
}


// --- ACCESS CONTROL TEST CASES ---

/**
 * Test Case 1: Owner Write Access & Public Write Access.
 * This test verifies that:
 * 1. The currently authenticated user (DID_A) can write to a database they own
 *    (configured with `ownerControlled: true`).
 * 2. The currently authenticated user (DID_A) can write to a database configured
 *    for public write access (`ownerControlled: false` and no specific AC options,
 *    defaulting to `write: ['*']`).
 * It also saves the address of the owner-controlled database for use in Test Case 2.
 */
async function runTestCase1() {
  if (!isAuthenticated.value || !userDID.value) {
    testCase1Result.value = "Error: User not logged in or DID not available.";
    return;
  }
  loading.value.testCase1 = true;
  testCase1Result.value = "Running Test Case 1: Owner and Public Write Access...";

  const ownedDBName = `${TEST_OWNED_DB_NAME_PREFIX}${userDID.value.replace(/[^a-zA-Z0-9]/g, '_').slice(-10)}`;
  let ownedDb, publicDb;

  try {
    // 1. Ensure global OrbitDB is initialized for the current user
    const odb = await ensureOrbitDBInitialized();
    if (!odb) throw new Error("Failed to initialize main OrbitDB instance for current user.");

    // 2. Create/Open Owner-Controlled DB
    testCase1Result.value += "\nAttempting to open owner-controlled DB...";
    ownedDb = await getKeyValueDatabase(ownedDBName, undefined, true);
    ownedDBAddressForTestCase2.value = ownedDb.address.toString(); // Save for Test Case 2
    testCase1Result.value += `\n  Success: Owner DB '${ownedDBName}' opened at ${ownedDBAddressForTestCase2.value}.`;

    // 3. Write to Owner-Controlled DB
    const ownerData = { id: 'ownerKey1', message: 'Data from owner' };
    await addDataToDB(ownedDBName, ownerData.id, ownerData);
    testCase1Result.value += `\n  Success: Wrote to owner-controlled DB ('${ownedDBName}').`;

    // 4. Create/Open Public DB
    testCase1Result.value += "\nAttempting to open public DB...";
    publicDb = await getKeyValueDatabase(TEST_PUBLIC_DB_NAME, undefined, false); // ownerControlled: false
    testCase1Result.value += `\n  Success: Public DB '${TEST_PUBLIC_DB_NAME}' opened at ${publicDb.address.toString()}.`;

    // 5. Write to Public DB
    const publicData = { id: 'publicKey1', message: 'Data to public DB' };
    // Need to use the specific db instance for addDataToDB if not using default name.
    // Or ensure addDataToDB can take a db instance or re-opens with the name.
    // For now, let's assume addDataToDB refers to the most recently opened by getKeyValueDatabase if name matches,
    // or modify addDataToDB. The current addDataToDB re-opens by name.
    await addDataToDB(TEST_PUBLIC_DB_NAME, publicData.id, publicData);
    testCase1Result.value += `\n  Success: Wrote to public DB ('${TEST_PUBLIC_DB_NAME}').`;

    testCase1Result.value += "\n\nTest Case 1 Completed Successfully.";
    setStatus("Test Case 1: Owner/Public write successful.", "success", 5000);
  } catch (e: any) {
    console.error("Test Case 1 Error:", e);
    testCase1Result.value += `\n  Error: ${e.message}`;
    setStatus(`Test Case 1 Failed: ${e.message}`, "error", 0);
  } finally {
    loading.value.testCase1 = false;
    // Note: We are not closing these DBs here as they might be part of the main user session.
    // ownedDBAddressForTestCase2.value is critical for TC2.
  }
}

/**
 * Test Case 2: Denied Write Access for a Different DID.
 * This test verifies that a simulated different user (DID_B) cannot write to a
 * database owned by the currently authenticated user (DID_A).
 *
 * To achieve this, it performs the following steps:
 * 1. Retrieves the address of the owner-controlled database created by DID_A
 *    (from Test Case 1).
 * 2. Defines a new DID string for the simulated user (`DID_B`).
 * 3. **Simulates `DID_B` by creating an entirely new, isolated OrbitDB/Helia stack:**
 *    - Initializes a new Helia instance (`helia_B`).
 *    - Creates a `CustomDIDIdentityProvider` configured with `DID_B` and a
 *      corresponding mock signing function.
 *    - Creates a new OrbitDB instance (`orbitdb_B`) using `helia_B` and `identityProvider_B`.
 *      This `orbitdb_B` instance operates with `DID_B`'s identity.
 *      The `CustomDIDAccessController` is also registered with this instance.
 *    This isolation is crucial because the main OrbitDB service (`orbitdb.ts`) is
 *    tied to the logged-in user's (DID_A) identity.
 * 4. Using `orbitdb_B` (as DID_B), it attempts to open the database owned by DID_A.
 *    Opening the database and reading its manifest might succeed if the manifest is public.
 * 5. **Crucially, it then attempts to write a key-value pair to this database.**
 * 6. **Verification:** This write operation is expected to FAIL. The `CustomDIDAccessController`
 *    on the database (which only grants write access to DID_A) should prevent DID_B
 *    from appending entries. The test catches this error.
 * 7. **Cleanup:** The temporary `orbitdb_B` and `helia_B` instances are stopped.
 */
async function runTestCase2() {
  if (!ownedDBAddressForTestCase2.value) {
    testCase2Result.value = "Error: Owned DB address not available. Run Test Case 1 first to create an owner-controlled DB.";
    return;
  }
  if (!userDID.value) { // Original owner's DID (DID_A)
     testCase2Result.value = "Error: Original user DID (DID_A) not available.";
     return;
  }

  loading.value.testCase2 = true;
  testCase2Result.value = "Running Test Case 2: Denied Write for Different DID...";

  const DID_A = userDID.value; // Logged-in user who owns the DB
  const DID_B = 'did:example:maliciousUser123'; // Simulated other user
  const dbAddressOfA = ownedDBAddressForTestCase2.value;

  let helia_B: any = null; // Helia instance for DID_B
  let orbitdb_B: any = null; // OrbitDB instance for DID_B

  try {
    testCase2Result.value += `\nSimulating user DID_B (${DID_B}). DB to target (owned by ${DID_A}): ${dbAddressOfA}`;

    // Step 1: Create a new Helia instance for DID_B.
    // This provides an independent IPFS node for DID_B's operations.
    testCase2Result.value += "\n  Initializing Helia for DID_B...";
    helia_B = await createHelia({});
    testCase2Result.value += `\n    Helia for DID_B peer ID: ${helia_B.libp2p.peerId.toString()}`;

    // Step 2: Create an IdentityProvider for DID_B.
    // This uses DID_B's unique DID and a signing function associated with DID_B.
    const identityProvider_B = new CustomDIDIdentityProvider({
      did: DID_B,
      signingFunction: mockDidSigningFunction(DID_B)
    });
    testCase2Result.value += "\n  Identity Provider created for DID_B.";

    // Step 3: Create an OrbitDB instance for DID_B.
    // This instance will use DID_B's identity for all its operations.
    // It's crucial to also register any custom Access Controllers this instance might encounter
    // when opening databases created by other users (like DID_A's DB).
    orbitdb_B = await createOrbitDB({
      ipfs: helia_B,
      identity: identityProvider_B,
      AccessControllers: {
        [CustomDIDAccessController.type]: CustomDIDAccessController // Register AC for DID_B's instance
      },
      directory: `./orbitdb_temp/user_B_${Date.now()}` // Temporary, unique directory for DID_B's OrbitDB metadata
    });
    testCase2Result.value += "\n  OrbitDB instance created for DID_B.";

    // Step 4: DID_B attempts to open DID_A's database.
    // Opening the database by its address is generally allowed if the manifest is public.
    // The access controller on DID_A's DB will only be checked during a write attempt.
    testCase2Result.value += `\n  DID_B attempting to open DB at ${dbAddressOfA}...`;
    const db_A_opened_by_B = await orbitdb_B.open(dbAddressOfA, { type: 'keyvalue' });
    testCase2Result.value += `\n    DB successfully opened by DID_B (address: ${db_A_opened_by_B.address.toString()}). This is expected.`;
    await db_A_opened_by_B.load();
    testCase2Result.value += "\n    DB loaded by DID_B.";


    // Step 5: DID_B attempts to write to DID_A's database.
    // This is the critical part of the test. The write should be denied by the
    // CustomDIDAccessController configured on DID_A's database, which only permits DID_A.
    testCase2Result.value += "\n  DID_B attempting to write to the DB...";
    try {
      await db_A_opened_by_B.put('attemptByB', { message: 'Data from DID_B' });
      // If this line is reached, the access control failed.
      testCase2Result.value += "\n    ERROR: Write operation by DID_B succeeded unexpectedly! Access control failed.";
      setStatus("Test Case 2 Failed: Write by other DID succeeded!", "error", 0);
    } catch (writeError: any) {
      // This is the expected outcome.
      console.error("Test Case 2 Expected Write Error:", writeError);
      // Check if the error message indicates an access control issue.
      // OrbitDB's default error for AC denial is often "Could not append entry".
      // The CustomDIDAccessController also logs "Write DENIED".
      if (writeError.message.includes('Could not append entry') || writeError.message.includes('Forbidden')) {
         testCase2Result.value += `\n    SUCCESS: Write operation by DID_B failed as expected. Error: ${writeError.message}`;
         setStatus("Test Case 2: Write denied for other DID (Success!)", "success", 5000);
      } else {
         testCase2Result.value += `\n    UNEXPECTED ERROR: Write by DID_B failed, but not with a clear access control error. Error: ${writeError.message}`;
         setStatus("Test Case 2: Write failed, but error type unclear.", "info", 0);
      }
    }
  } catch (e: any) { // Catch errors from setting up DID_B's stack or opening the DB.
    console.error("Test Case 2 General Error:", e);
    testCase2Result.value += `\n  Test Case 2 General Error: ${e.message}`;
    setStatus(`Test Case 2 Failed: ${e.message}`, "error", 0);
  } finally {
    // Step 7: Cleanup - Stop the temporary Helia and OrbitDB instances for DID_B.
    if (orbitdb_B) {
      testCase2Result.value += "\n  Stopping DID_B's OrbitDB instance...";
      try { await orbitdb_B.stop(); testCase2Result.value += " Done."; }
      catch (e) { console.error("Error stopping DID_B OrbitDB", e); testCase2Result.value += " Error stopping.";}
    }
    if (helia_B) {
      testCase2Result.value += "\n  Stopping DID_B's Helia instance...";
      try { await helia_B.stop(); testCase2Result.value += " Done."; }
      catch (e) { console.error("Error stopping DID_B Helia", e); testCase2Result.value += " Error stopping.";}
    }
    loading.value.testCase2 = false;
  }
}


</script>

<style scoped>
/* Add any specific styles for this test page */
</style>
