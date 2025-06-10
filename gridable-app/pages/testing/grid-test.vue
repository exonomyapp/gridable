<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h2>Gridable Grid Test Page</h2>
        <p>Testing custom grid: theming, state persistence (sort, columns, filters, visibility), and interactive features.</p>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>Theme Controls</v-card-title>
          <v-card-text>
            <v-text-field v-model="currentTheme.gridBorderColor" label="Grid Border Color"></v-text-field>
            <v-text-field v-model="currentTheme.headerBackgroundColor" label="Header Background"></v-text-field>
            <v-text-field v-model="currentTheme.cellTextColor" label="Cell Text Color"></v-text-field>
            <v-btn @click="applyDefaultTheme" class="mt-2" block>Apply Default Theme</v-btn>
          </v-card-text>
        </v-card>

        <v-card class="mt-4">
          <v-card-title>Grid State Simulation</v-card-title>
          <v-card-text>
            <v-btn @click="loadSimulatedState1" class="mr-2 mb-2" block>Load State 1 (Filter Make, Hide Price)</v-btn>
            <v-btn @click="loadSimulatedState2" class="mr-2 mb-2" block>Load State 2 (Sort Price, Show All, No Filter)</v-btn>
            <v-btn @click="loadSimulatedState3" class="mb-2" block>Load State 3 (Porsche only, ID visible)</v-btn>
            <v-divider class="my-2"></v-divider>
            <p class="text-caption mt-3">Last saved state for 'sampleGrid1':</p>
            <pre class="state-display">{{ JSON.stringify(savedStates['sampleGrid1'], null, 2) }}</pre>
            <p class="text-caption mt-3">Global App Settings (Loaded):</p>
            <pre class="state-display">{{ JSON.stringify(globalAppSettings, null, 2) }}</pre>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>Sample Grid (Themed & State Managed)</v-card-title>
          <v-card-text>
            <div v-if="reloadingGrid" class="text-center pa-5">
              <v-progress-circular indeterminate></v-progress-circular>
              <p>Reloading grid with new state...</p>
            </div>
            <GridableGrid
              v-else
              :key="gridKey"
              view-id="sampleGrid1"
              :column-defs="sampleColDefs"
              :row-data="sampleRowData"
              :items-per-page="userSelectedItemsPerPage"
              :theme="currentTheme"
              :initial-grid-state="currentInitialGridState['sampleGrid1']"
              @grid-state-change="handleGridStateSave"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Other grids can also have their own view-id and initial state -->

  </v-container>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, nextTick } from 'vue';
import { GridableGrid } from '@upgrid/core'; // Updated import
import type { GridTheme } from '@upgrid/core'; // Updated import
import type { GridState, GlobalAppSettings } from '~/services/userPreferences';
import { getViewGridState, getGlobalAppSettings, saveViewGridState } from '~/services/userPreferences';
import { useAuthStore } from '~/store/auth';

// --- Theme ---
const defaultTheme: GridTheme = {
  gridBorderColor: '#cccccc', headerBackgroundColor: '#f5f5f5', headerTextColor: '#333333',
  headerBorderColor: '#dddddd', cellTextColor: '#333333', cellBorderColor: '#eeeeee',
  noDataTextColor: '#757575', paginationBackgroundColor: '#f9f9f9', paginationTextColor: '#000000',
};
const currentTheme = reactive<GridTheme>({ ...defaultTheme });
const applyDefaultTheme = () => Object.assign(currentTheme, defaultTheme);

// --- Grid Data ---
const sampleColDefs = ref([
  { headerName: 'ID', field: 'id', sortable: true, textAlign: 'center', width: 70, minWidth: 50, filter: 'number', filterParams: { filterType: 'number', condition: 'equals' } },
  { headerName: 'Make', field: 'make', sortable: true, width: 180, minWidth: 100, filter: 'text', filterParams: { filterType: 'text', condition: 'contains' } },
  { headerName: 'Model', field: 'model', sortable: true, width: 180, minWidth: 100, filter: 'text' },
  { headerName: 'Price ($)', field: 'price', sortable: true, textAlign: 'right', width: 120, minWidth: 80, filter: 'number', filterParams: { filterType: 'number', condition: 'greaterThan' } }
]);
const sampleRowData = ref([
  { id: 1, make: 'Toyota', model: 'Celica', price: 35000 }, { id: 2, make: 'Ford', model: 'Mondeo', price: 32000 },
  { id: 3, make: 'Porsche', model: 'Boxster', price: 72000 }, { id: 4, make: 'BMW', model: 'X5', price: 55000 },
  { id: 5, make: 'Toyota', model: 'RAV4', price: 40000 }, { id: 6, make: 'Ford', model: 'Focus', price: 22000 },
]);

// --- Grid State Management Simulation ---
const authStore = useAuthStore();
const globalAppSettings = ref<GlobalAppSettings | null>(null);
const userSelectedItemsPerPage = ref(5);
const gridKey = ref(0);
const reloadingGrid = ref(false);

const currentInitialGridState = reactive<{ [viewId: string]: GridState }>({
  sampleGrid1: {
    itemsPerPage: 5,
    sortState: { field: 'make', direction: 'asc' },
    columnOrder: ['id', 'make', 'model', 'price'],
    columnWidths: { 'make': 190, 'model': 190, 'price': 130, 'id': 60 },
    columnVisibility: { 'id': true, 'make': true, 'model': true, 'price': true },
    filterModel: {}
  }
});
const savedStates = reactive<{ [viewId: string]: GridState }>({});

async function applyAndReloadGrid(viewId: string, newState: GridState) {
  reloadingGrid.value = true;
  currentInitialGridState[viewId] = JSON.parse(JSON.stringify(newState));
  if (newState.itemsPerPage) {
    userSelectedItemsPerPage.value = newState.itemsPerPage;
  }
  await nextTick();
  gridKey.value++;
  await nextTick();
  reloadingGrid.value = false;
}

onMounted(async () => {
  if (!authStore.isAuthenticated) { await authStore.login("Test User Prefs"); }
  if (authStore.currentUser?.did) {
    globalAppSettings.value = await getGlobalAppSettings();
    if (globalAppSettings.value?.defaultItemsPerPage) {
      userSelectedItemsPerPage.value = globalAppSettings.value.defaultItemsPerPage;
      if (currentInitialGridState['sampleGrid1'] && !currentInitialGridState['sampleGrid1'].itemsPerPage) {
          currentInitialGridState['sampleGrid1'].itemsPerPage = userSelectedItemsPerPage.value;
      }
    }
    const loadedState = await getViewGridState("sampleGrid1");
    if (loadedState && Object.keys(loadedState).length > 0) {
      console.log("Loaded state for sampleGrid1 onMount:", loadedState);
      const mergedState: GridState = {
        ...(currentInitialGridState['sampleGrid1'] || {}),
        ...loadedState,
        itemsPerPage: loadedState.itemsPerPage || currentInitialGridState['sampleGrid1']?.itemsPerPage || userSelectedItemsPerPage.value,
        filterModel: loadedState.filterModel || {},
        sortState: loadedState.sortState || currentInitialGridState['sampleGrid1']?.sortState,
        columnOrder: loadedState.columnOrder || currentInitialGridState['sampleGrid1']?.columnOrder,
        columnWidths: loadedState.columnWidths || currentInitialGridState['sampleGrid1']?.columnWidths,
        columnVisibility: loadedState.columnVisibility || currentInitialGridState['sampleGrid1']?.columnVisibility,
      };
      await applyAndReloadGrid('sampleGrid1', mergedState);
    } else {
      await applyAndReloadGrid('sampleGrid1', { ...(currentInitialGridState['sampleGrid1'] || {itemsPerPage: userSelectedItemsPerPage.value}) });
    }
  }
});

watch(() => authStore.currentUser?.did, async (newDid) => {
    if (newDid) {
        console.log("User changed or became available, (re)loading initial state for sampleGrid1...");
        const loadedState = await getViewGridState("sampleGrid1");
        if (loadedState && Object.keys(loadedState).length > 0) {
            await applyAndReloadGrid('sampleGrid1', loadedState);
        } else {
            const defaultStateForNewUser: GridState = { itemsPerPage: globalAppSettings.value?.defaultItemsPerPage || 5, filterModel: {}, columnOrder: ['id', 'make', 'model', 'price'], columnVisibility: {'id':true,'make':true,'model':true,'price':true}};
            await applyAndReloadGrid('sampleGrid1', defaultStateForNewUser);
        }
    }
}, { immediate: false });

function handleGridStateSave(event: { viewId: string, state: GridState }) {
  console.log(`Event 'grid-state-change' for ${event.viewId}:`, event.state);
  savedStates[event.viewId] = JSON.parse(JSON.stringify(event.state));
}

function loadSimulatedState1() {
  const newState: GridState = {
    itemsPerPage: 3,
    sortState: { field: 'id', direction: 'desc' },
    columnOrder: ['make', 'model', 'id', 'price'],
    columnVisibility: { 'id': true, 'make': true, 'model': true, 'price': false },
    columnWidths: { 'make': 200, 'model': 200, 'id': 70 },
    filterModel: { 'make': { filterType: 'text', condition: 'contains', filter: 'Ford' } }
  };
  applyAndReloadGrid('sampleGrid1', newState);
}

function loadSimulatedState2() {
  const newState: GridState = {
    itemsPerPage: 5,
    sortState: { field: 'price', direction: 'desc' },
    columnOrder: ['price', 'make', 'model', 'id'],
    columnVisibility: { 'id': true, 'make': true, 'model': true, 'price': true },
    columnWidths: { 'price': 150, 'make': 160, 'model': 170, 'id': 50},
    filterModel: {}
  };
  applyAndReloadGrid('sampleGrid1', newState);
}

function loadSimulatedState3() {
  const newState: GridState = {
    itemsPerPage: 5,
    sortState: { field: 'model', direction: 'asc' },
    columnOrder: ['id', 'make', 'model', 'price'],
    columnVisibility: { 'id': true, 'make': true, 'model': true, 'price': true },
    columnWidths: { 'id': 60, 'make': 150, 'model': 150, 'price': 100 },
    filterModel: { 'make': { filterType: 'text', condition: 'equals', filter: 'Porsche' } }
  };
  applyAndReloadGrid('sampleGrid1', newState);
}

</script>

<style scoped>
.state-display {
  white-space: pre-wrap;
  background-color: #f0f0f0;
  padding: 10px;
  border-radius: 4px;
  font-size: 0.8em;
  max-height: 200px;
  overflow-y: auto;
}
</style>
