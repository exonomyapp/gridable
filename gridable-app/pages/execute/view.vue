<template>
  <v-container fluid>
    <v-row v-if="loadingView">
      <v-col class="text-center pa-8">
        <v-progress-circular indeterminate size="64"></v-progress-circular>
        <p class="mt-4 text-h6">Loading and executing view...</p>
      </v-col>
    </v-row>

    <v-row v-if="executionError && !loadingView">
       <v-col>
        <v-alert
          type="error"
          variant="tonal"
          prominent
          border="start"
          class="my-4"
        >
          <template v-slot:title>
            <div class="text-h6">Error Executing View</div>
          </template>
          <p>{{ executionError }}</p>
          <p v-if="viewAddress">Attempted to load view from address: <code>{{ viewAddress }}</code></p>
          <p class="mt-3 text-caption">
            Please ensure the address is correct and the underlying data sources are accessible.
            If this view was shared with you, the owner might have revoked access or deleted the view/tables.
          </p>
        </v-alert>
      </v-col>
    </v-row>

    <v-row v-if="!loadingView && viewDefinition && !executionError">
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Executing View: {{ viewDefinition.viewName }}</span>
            <v-btn v-if="isOwnerOfView" small density="compact" icon="mdi-pencil-outline" @click="editThisView" title="Edit this View"></v-btn>
          </v-card-title>
          <v-card-subtitle v-if="viewDefinition._id || viewDefinition.viewId">
            View ID: {{ viewDefinition._id || viewDefinition.viewId }} (DB: {{ viewAddress }})
          </v-card-subtitle>
          <v-card-text>
            <GridableGrid
              v-if="viewResults.length > 0 || !initialDataLoaded"
              :column-defs="resultGridColDefs"
              :row-data="viewResults"
              :items-per-page="10"
              :view-id="viewAddress"
              :initial-grid-state="loadedGridState"
              @grid-state-change="handleGridStateSave"
            />
            <p v-else-if="initialDataLoaded && viewResults.length === 0" class="pa-4 text-center text-medium-emphasis">
              This view returned no data based on the current criteria and source table content.
            </p>
             <p v-else-if="!initialDataLoaded" class="pa-4 text-center text-medium-emphasis">
              Preparing to load data...
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="!loadingView && !viewDefinition && !executionError">
      <v-col>
        <v-alert
            type="warning"
            variant="tonal"
            prominent
            border="start"
            class="my-4"
        >
          <template v-slot:title>
            <div class="text-h6">View Not Loaded</div>
          </template>
          <p>No view address was provided in the URL, or the specified view could not be loaded.</p>
          <p class="mt-2">Please ensure you have a valid view address in the URL, for example: <code>/execute/view?address=orbitdb://...</code></p>
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import GridableGrid from '~/components/core/GridableGrid.vue';
import { useAuthStore } from '~/store/auth';
import { getDocumentStoreDatabase, getKeyValueDatabase } from '~/services/orbitdb';
import { getViewGridState, saveViewGridState, type GridState } from '~/services/userPreferences';

interface ViewTableReference { tableId: string; orbitDBAddress: string; name: string; alias?: string; x: number; y: number; }
interface ViewCriteria { field: string; table: string; alias?: string; output: boolean; sort?: 'asc' | 'desc' | ''; filter?: string; group?: boolean; }
interface ViewDefinition { _id?: string; viewId: string; viewName: string; tables: ViewTableReference[]; relationships: any[]; criteria: ViewCriteria[]; ownerDID: string; createdTimestamp: number; lastModifiedTimestamp: number; }

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const viewAddress = ref<string | null>(null);
const viewDefinition = ref<ViewDefinition | null>(null);
const viewResults = ref<any[]>([]);
const resultGridColDefs = ref<any[]>([]);

const loadingView = ref(true);
const initialDataLoaded = ref(false);
const executionError = ref<string | null>(null);
const loadedGridState = ref<GridState>({});

const isOwnerOfView = computed(() => {
  return authStore.isAuthenticated && viewDefinition.value && authStore.currentUser?.did === viewDefinition.value.ownerDID;
});

async function loadAndExecuteView() {
  loadingView.value = true;
  executionError.value = null;
  initialDataLoaded.value = false;
  viewResults.value = [];
  resultGridColDefs.value = [];
  viewDefinition.value = null;

  const addressFromQuery = route.query.address as string;
  if (!addressFromQuery) {
    executionError.value = "No view address found in the URL. Please provide an 'address' query parameter.";
    loadingView.value = false;
    return;
  }
  viewAddress.value = addressFromQuery;

  try {
    console.log(`[ExecuteView] Loading view definition from: ${viewAddress.value}`);
    const viewDefDb = await getDocumentStoreDatabase(viewAddress.value);
    const results = await viewDefDb.all();
    if (!results || results.length === 0) {
      throw new Error(`No view definition document found at the OrbitDB address: ${viewAddress.value}. The database might be empty, the address incorrect, or you may not have access permissions for this specific view's database.`);
    }
    viewDefinition.value = results[0] as ViewDefinition;
    console.log("[ExecuteView] Loaded View Definition:", viewDefinition.value);

    if (!viewDefinition.value || !viewDefinition.value.tables || viewDefinition.value.tables.length === 0) {
      throw new Error("The loaded view definition is invalid: it may be corrupted, incomplete, or does not specify any source tables.");
    }

    if (authStore.currentUser?.did && viewAddress.value) {
        loadedGridState.value = (await getViewGridState(viewAddress.value)) || {};
    }

    const firstTableRef = viewDefinition.value.tables[0];
    if (!firstTableRef || !firstTableRef.orbitDBAddress) {
      throw new Error("The first table specified in the view definition is invalid or missing its OrbitDB address. The view may be misconfigured or the source table is no longer accessible.");
    }

    console.log(`[ExecuteView] Fetching data from table: ${firstTableRef.name} (${firstTableRef.orbitDBAddress})`);
    const tableDb = await getKeyValueDatabase(firstTableRef.orbitDBAddress);
    const tableDataEntries = await tableDb.all();
    let rawTableData = tableDataEntries.map((entry:any) => entry.value);
    console.log("[ExecuteView] Raw data from table:", rawTableData);

    let processedData = [...rawTableData];
    const activeFilters = viewDefinition.value.criteria.filter(c => c.filter && c.filter.trim() !== '');
    activeFilters.forEach(crit => { if (crit.table === firstTableRef.name) { const [filterField, filterValue] = crit.filter!.split('='); if (filterField && filterValue) { processedData = processedData.filter(row => String(row[filterField?.trim()]) === filterValue.trim()); } } });
    const sortCriterion = viewDefinition.value.criteria.find(c => c.sort && (c.sort === 'asc' || c.sort === 'desc'));
    if (sortCriterion && sortCriterion.table === firstTableRef.name) { const field = sortCriterion.field; const direction = sortCriterion.sort === 'asc' ? 1 : -1; processedData.sort((a,b)=>{const vA=a[field]; const vB=b[field]; if(vA<vB)return -1*direction; if(vA>vB)return 1*direction; return 0;});}

    const outputCriteria = viewDefinition.value.criteria.filter(c => c.output && c.table === firstTableRef.name);
    if(outputCriteria.length === 0 && processedData.length > 0) {
        console.warn("No output fields specified in criteria for the source table. Results grid will be empty of columns.");
    }
    resultGridColDefs.value = outputCriteria.map(crit => ({ headerName: crit.alias || crit.field, field: crit.field, sortable: true }));
    viewResults.value = processedData.map(row => { const resultRow: any = {}; outputCriteria.forEach(crit => { resultRow[crit.field] = row[crit.field]; }); return resultRow; });

  } catch (err: any) {
    console.error("[ExecuteView] Error executing view:", err);
    let friendlyMessage = "An unexpected error occurred while trying to execute the view.";
    if (err.message) {
        if (err.message.includes("not found") || err.message.includes("orbitdb") || err.message.includes("database")) {
            friendlyMessage = `Could not load the view or its data. The OrbitDB address might be incorrect, the database may not be accessible/found, or it might be empty. Please verify the address and try again. Details: ${err.message}`;
        } else if (err.message.includes("access") || err.message.includes("permission")) {
            friendlyMessage = `You may not have permission to access the required view definition or one of its source tables. Details: ${err.message}`;
        } else {
            friendlyMessage = err.message;
        }
    }
    executionError.value = friendlyMessage;
  } finally {
    loadingView.value = false;
    initialDataLoaded.value = true;
  }
}

const handleGridStateSave = (event: { viewId: string, state: GridState }) => { if (authStore.currentUser?.did && viewAddress.value) { saveViewGridState(viewAddress.value, event.state); }};
onMounted(() => { if (authStore.isAuthenticated) { loadAndExecuteView(); } else { const unwatch = watch(() => authStore.isAuthenticated, (isAuth) => { if (isAuth) { loadAndExecuteView(); unwatch(); } }, {immediate: true}); }});
watch(() => route.query.address, (newAddress) => { if (newAddress && newAddress !== viewAddress.value) { loadAndExecuteView(); }});

// --- Edit View Button ---
function editThisView() {
  if (isOwnerOfView.value && viewAddress.value) {
    router.push({ path: '/editor/view-editor', query: { loadAddress: viewAddress.value } });
  }
}
</script>

<style scoped>
code {
  background-color: rgba(0,0,0,0.05);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
}
</style>
