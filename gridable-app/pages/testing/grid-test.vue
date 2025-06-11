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
          <v-card-title>Selection Mode</v-card-title>
          <v-card-text>
            <v-radio-group v-model="currentSelectionMode" inline>
              <v-radio label="None" value="none"></v-radio>
              <v-radio label="Single" value="single"></v-radio>
              <v-radio label="Multiple" value="multiple"></v-radio>
            </v-radio-group>
          </v-card-text>
        </v-card>

        <v-card class="mt-4">
          <v-card-title>Programmatic Selection</v-card-title>
          <v-card-text>
            <v-btn @click="selectFirstTwo" block class="mb-2" :disabled="currentSelectionMode !== 'multiple'">Select First Two (Multiple)</v-btn>
            <v-btn @click="selectId2" block class="mb-2" :disabled="currentSelectionMode === 'none'">Select ID 2 (Single/Multiple)</v-btn>
            <v-btn @click="logSelectedIds" block class="mb-2">Log Selected IDs</v-btn>
            <v-btn @click="logSelectedData" block class="mb-2">Log Selected Data</v-btn>
            <v-btn @click="clearGridSelection" block color="warning" class="mb-2">Clear Programmatic Selection</v-btn>
          </v-card-text>
        </v-card>

        <v-card class="mt-4">
            <v-card-title>Inline Editing Test</v-card-title>
            <v-card-text>
                <p class="text-caption">
                    Double-click cells in 'Make' or 'Model' columns of the 'Sample Grid' to edit.
                    <br />- Press Enter or click away (Blur) to save.
                    <br />- Press Escape to cancel.
                </p>
                <div v-if="lastCellValueChangedEvent">
                    <p class="font-weight-bold mt-3">Last <code>cell-value-changed</code> Event:</p>
                    <pre class="state-display">{{ JSON.stringify(lastCellValueChangedEvent, null, 2) }}</pre>
                    <v-btn @click="commitLastSampleEdit" block color="primary" class="mt-2" :disabled="!lastCellValueChangedEvent">
                        Commit Last Edit to Sample Data
                    </v-btn>
                </div>
                <p v-else class="text-caption mt-3">No cell edits captured yet.</p>
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
         <v-card class="mt-4">
          <v-card-title>Current Selection</v-card-title>
          <v-card-text>
            <p><strong>Mode:</strong> {{ currentSelectionMode }}</p>
            <p><strong>Selected IDs Count:</strong> {{ currentSelectedIds.size }}</p>
            <p><strong>Selected IDs:</strong></p>
            <pre class="state-display">{{ JSON.stringify(Array.from(currentSelectedIds), null, 2) }}</pre>
            <p class="mt-2"><strong>Selected Data (first 3 shown):</strong></p>
            <pre class="state-display">{{ JSON.stringify(currentSelectedData.slice(0,3), null, 2) }}</pre>
             <p v-if="lastClickedRowForDisplay" class="mt-2"><strong>Last Clicked Row (via @rowClick):</strong></p>
            <pre v-if="lastClickedRowForDisplay" class="state-display">{{ JSON.stringify(lastClickedRowForDisplay, null, 2) }}</pre>
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
              ref="gridApi"
              :key="gridKey"
              view-id="sampleGrid1"
              :column-defs="sampleColDefs"
              :row-data="sampleRowData"
              :items-per-page="userSelectedItemsPerPage"
              :theme="currentTheme"
              :initial-grid-state="currentInitialGridState['sampleGrid1']"
              :selection-mode="currentSelectionMode"
              :row-id-field="'id'"
              @grid-state-change="handleGridStateSave"
              @selectionChanged="onSelectionChanged"
              @rowClick="onRowClicked"
              @cell-value-changed="onCellValueChanged"
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
import { GridableGrid } from '@upgrid/core';
import type { GridTheme, ColumnDefinition as UpGridColumnDefinition, RowDataItem as UpGridRowDataItem } from '@upgrid/core';
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
const sampleColDefs = ref<UpGridColumnDefinition[]>([
  { headerName: 'ID', field: 'id', sortable: true, textAlign: 'center', width: 70, minWidth: 50, filter: 'number', filterParams: { filterType: 'number', condition: 'equals' } },
  { headerName: 'Make', field: 'make', sortable: true, width: 180, minWidth: 100, filter: 'text', filterParams: { filterType: 'text', condition: 'contains' }, editable: true },
  { headerName: 'Model', field: 'model', sortable: true, width: 180, minWidth: 100, filter: 'text', editable: true },
  { headerName: 'Price ($)', field: 'price', sortable: true, textAlign: 'right', width: 120, minWidth: 80, filter: 'number', filterParams: { filterType: 'number', condition: 'greaterThan' } }
]);
const sampleRowData = ref<UpGridRowDataItem[]>([
  { id: 1, make: 'Toyota', model: 'Celica', price: 35000 }, { id: 2, make: 'Ford', model: 'Mondeo', price: 32000 },
  { id: 3, make: 'Porsche', model: 'Boxster', price: 72000 }, { id: 4, make: 'BMW', model: 'X5', price: 55000 },
  { id: 5, make: 'Toyota', model: 'RAV4', price: 40000 }, { id: 6, make: 'Ford', model: 'Focus', price: 22000 },
]);

// --- Grid State Management Simulation ---
const authStore = useAuthStore();
const globalAppSettings = ref<GlobalAppSettings | null>(null);
const userSelectedItemsPerPage = ref(5); // Default, can be overridden by loaded global/view state
const gridKey = ref(0); // Used to force re-render of GridableGrid when initial state changes significantly
const reloadingGrid = ref(false);

// --- Grid Selection State ---
const gridApi = ref<InstanceType<typeof GridableGrid> | null>(null);
const currentSelectionMode = ref<'single' | 'multiple' | 'none'>('single');
const currentSelectedIds = ref(new Set<string | number>());
const currentSelectedData = ref<any[]>([]);
const lastClickedRowForDisplay = ref<any | null>(null);

// --- Inline Editing State ---
const lastCellValueChangedEvent = ref<any | null>(null);


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
  gridKey.value++; // Increment key to force re-mount of GridableGrid
  await nextTick();
  reloadingGrid.value = false;
}

onMounted(async () => {
  if (!authStore.isAuthenticated) { await authStore.login("Test User Prefs"); }
  if (authStore.currentUser?.did) {
    globalAppSettings.value = await getGlobalAppSettings();
    if (globalAppSettings.value?.defaultItemsPerPage) {
      userSelectedItemsPerPage.value = globalAppSettings.value.defaultItemsPerPage;
      // Ensure initial grid state for itemsPerPage reflects global setting if not already set
      if (currentInitialGridState['sampleGrid1'] && !currentInitialGridState['sampleGrid1'].itemsPerPage) {
          currentInitialGridState['sampleGrid1'].itemsPerPage = userSelectedItemsPerPage.value;
      }
    }
    const loadedState = await getViewGridState("sampleGrid1");
    if (loadedState && Object.keys(loadedState).length > 0) {
      console.log("Loaded state for sampleGrid1 onMount:", loadedState);
      // Merge with defaults carefully, ensuring loaded state takes precedence
      const mergedState: GridState = {
        ...(currentInitialGridState['sampleGrid1'] || {}), // Start with defaults
        ...loadedState, // Override with loaded state
        // Ensure itemsPerPage is correctly prioritized: loadedState > initialGridState's default > global
        itemsPerPage: loadedState.itemsPerPage || currentInitialGridState['sampleGrid1']?.itemsPerPage || userSelectedItemsPerPage.value,
        filterModel: loadedState.filterModel || {}, // Ensure filterModel is an object
        sortState: loadedState.sortState || currentInitialGridState['sampleGrid1']?.sortState,
        columnOrder: loadedState.columnOrder || currentInitialGridState['sampleGrid1']?.columnOrder,
        columnWidths: loadedState.columnWidths || currentInitialGridState['sampleGrid1']?.columnWidths,
        columnVisibility: loadedState.columnVisibility || currentInitialGridState['sampleGrid1']?.columnVisibility,
      };
      await applyAndReloadGrid('sampleGrid1', mergedState);
    } else {
      // Ensure itemsPerPage is set even if no state is loaded
      await applyAndReloadGrid('sampleGrid1', { ...(currentInitialGridState['sampleGrid1'] || {itemsPerPage: userSelectedItemsPerPage.value}) });
    }
  }
});

// Watch for user changes to reload their preferences/states
watch(() => authStore.currentUser?.did, async (newDid) => {
    if (newDid) {
        console.log("User changed or became available, (re)loading initial state for sampleGrid1...");
        // This will re-trigger part of the onMounted logic essentially
        const loadedState = await getViewGridState("sampleGrid1");
        if (loadedState && Object.keys(loadedState).length > 0) {
            await applyAndReloadGrid('sampleGrid1', loadedState);
        } else {
            // Apply a fresh default state if no state is loaded for the new user
            const defaultStateForNewUser: GridState = { itemsPerPage: globalAppSettings.value?.defaultItemsPerPage || 5, filterModel: {}, columnOrder: ['id', 'make', 'model', 'price'], columnVisibility: {'id':true,'make':true,'model':true,'price':true}};
            await applyAndReloadGrid('sampleGrid1', defaultStateForNewUser);
        }
    }
}, { immediate: false }); // `immediate: false` to avoid re-running on initial mount if DID already present

function handleGridStateSave(event: { viewId: string, state: GridState }) {
  console.log(`Event 'grid-state-change' for ${event.viewId}:`, event.state);
  savedStates[event.viewId] = JSON.parse(JSON.stringify(event.state));
}

// --- Selection Event Handlers ---
function onSelectionChanged(payload: { selectedIds: Set<string | number>, selectedData: any[] }) {
  console.log("TestPage @selectionChanged: IDs:", payload.selectedIds, "Data:", payload.selectedData);
  currentSelectedIds.value = payload.selectedIds;
  currentSelectedData.value = payload.selectedData;
}

function onRowClicked(payload: { row: any, event: MouseEvent }) {
  console.log("TestPage @rowClick:", payload.row);
  lastClickedRowForDisplay.value = payload.row;
}

// --- Inline Edit Event Handler ---
function onCellValueChanged(payload: any) {
  console.log("TestPage @cell-value-changed:", payload);
  lastCellValueChangedEvent.value = payload;
  // Note: We are not yet updating the actual sampleRowData here.
  // That will be done by commitLastSampleEdit() for testing purposes.
}

function commitLastSampleEdit() {
  if (!lastCellValueChangedEvent.value) {
    alert("No edit event to commit.");
    return;
  }
  const { rowId, field, newValue } = lastCellValueChangedEvent.value;
  const rowIndex = sampleRowData.value.findIndex(row => row.id === rowId);

  if (rowIndex !== -1) {
    const updatedRow = { ...sampleRowData.value[rowIndex], [field]: newValue };
    sampleRowData.value.splice(rowIndex, 1, updatedRow); // Replace item to trigger reactivity if needed
    // Or, if direct mutation is fine and reactive:
    // sampleRowData.value[rowIndex][field] = newValue;
    console.log(`Committed edit: Row ID ${rowId}, Field ${field}, New Value ${newValue}. Local data updated.`);
    lastCellValueChangedEvent.value = null; // Clear after commit
  } else {
    console.error(`Could not find row with ID ${rowId} in sampleRowData to commit edit.`);
    alert(`Error: Row with ID ${rowId} not found.`);
  }
}

// --- Programmatic Selection Test Functions ---
function selectFirstTwo() {
  if (gridApi.value && sampleRowData.value.length >= 2) {
    const idsToSelect = [sampleRowData.value[0]?.id, sampleRowData.value[1]?.id].filter(id => id !== undefined);
    gridApi.value.setSelectedRowIds(idsToSelect as (string|number)[]);
  } else {
    console.warn("Not enough data to select first two, or gridApi not available.");
  }
}

function selectId2() {
  if (gridApi.value) {
    const targetId = 2; // Assuming 'id: 2' exists in sampleRowData
    const rowExists = sampleRowData.value.some(row => row.id === targetId);
    if (rowExists) {
      gridApi.value.setSelectedRowIds([targetId]);
    } else {
      console.warn(`Row with ID ${targetId} not found in sampleRowData.`);
    }
  } else {
    console.warn("gridApi not available.");
  }
}

function logSelectedIds() {
  if (gridApi.value) {
    const ids = gridApi.value.getSelectedRowIds();
    console.log("Programmatic getSelectedRowIds():", ids);
    alert("Selected IDs logged to console.");
  } else {
    console.warn("gridApi not available.");
  }
}

function logSelectedData() {
  if (gridApi.value) {
    const data = gridApi.value.getSelectedRowsData();
    console.log("Programmatic getSelectedRowsData():", data);
    alert("Selected data logged to console.");
  } else {
    console.warn("gridApi not available.");
  }
}

function clearGridSelection() {
  if (gridApi.value) {
    gridApi.value.clearSelection();
    console.log("Programmatic clearSelection() called.");
  } else {
    console.warn("gridApi not available.");
  }
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
