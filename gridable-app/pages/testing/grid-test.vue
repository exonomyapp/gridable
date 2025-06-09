<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h2>Gridable Grid Test Page</h2>
        <p>Testing custom grid with theme options and placeholder for state persistence.</p>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>Theme Controls</v-card-title>
          <v-card-text>
            <!-- ... Theme controls from previous step ... -->
            <v-text-field v-model="currentTheme.gridBorderColor" label="Grid Border Color"></v-text-field>
            <v-text-field v-model="currentTheme.headerBackgroundColor" label="Header Background"></v-text-field>
            <v-btn @click="applyDefaultTheme" class="mt-2">Apply Default Theme</v-btn>
          </v-card-text>
        </v-card>
        <v-card class="mt-4">
          <v-card-title>Grid State Simulation</v-card-title>
          <v-card-text>
            <v-btn @click="loadSimulatedState1" class="mr-2">Load State 1 (Toyota first, 5/page)</v-btn>
            <v-btn @click="loadSimulatedState2">Load State 2 (Price sorted desc, 3/page)</v-btn>
            <p class="text-caption mt-3">Last saved state for 'sampleGrid1':</p>
            <pre style="white-space: pre-wrap; background-color: #f0f0f0; padding: 5px; border-radius:3px;">{{ JSON.stringify(savedStates['sampleGrid1'], null, 2) }}</pre>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>Sample Grid (Themed & State)</v-card-title>
          <v-card-text>
            <GridableGrid
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

    <!-- ... Other grids can also have their own view-id and initial state ... -->

  </v-container>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import GridableGrid from '~/components/core/GridableGrid.vue';
import type { GridTheme } from '~/components/core/GridableGridTheme'; // Import from new file
import type { GridState } from '~/services/userPreferences';

// --- Theme ---
const defaultTheme: GridTheme = { gridBorderColor: '#cccccc', headerBackgroundColor: '#f5f5f5', /* ... */ };
const currentTheme = reactive<GridTheme>({ ...defaultTheme });
const applyDefaultTheme = () => Object.assign(currentTheme, defaultTheme);

// --- Grid Data ---
const sampleColDefs = ref([
  { headerName: 'ID', field: 'id', sortable: true, textAlign: 'center', width: 80 },
  { headerName: 'Make', field: 'make', sortable: true, width: 150 },
  { headerName: 'Model', field: 'model', sortable: true, width: 150 },
  { headerName: 'Price', field: 'price', sortable: true, textAlign: 'right', width: 100 }
]);
const sampleRowData = ref([
  { id: 1, make: 'Toyota', model: 'Celica', price: 35000 }, { id: 2, make: 'Ford', model: 'Mondeo', price: 32000 },
  { id: 3, make: 'Porsche', model: 'Boxster', price: 72000 }, { id: 4, make: 'BMW', model: 'X5', price: 55000 },
]);

// --- Grid State Management Simulation ---
const userSelectedItemsPerPage = ref(5); // Can be part of global or view-specific settings

// Holds the "initial" state to pass to grids, simulating loaded preferences
const currentInitialGridState = reactive<{ [viewId: string]: GridState }>({
  sampleGrid1: { // Default initial state for sampleGrid1
    itemsPerPage: 5,
    sortState: { field: 'make', direction: 'asc' },
    columnOrder: ['id', 'make', 'model', 'price'], // Default order
    columnWidths: { 'make': 160, 'price': 120 }
  }
});

// Simulates a "saved" state store (e.g., what might be in OrbitDB)
const savedStates = reactive<{ [viewId: string]: GridState }>({});

function handleGridStateSave(event: { viewId: string, state: GridState }) {
  console.log(`Event 'grid-state-change' received for ${event.viewId}:`, event.state);
  savedStates[event.viewId] = event.state;
  // Here, you would call:
  // import { saveViewGridState } from '~/services/userPreferences';
  // import { useAuthStore } from '~/store/auth';
  // const authStore = useAuthStore();
  // if (authStore.currentUser?.did) {
  //   saveViewGridState(event.viewId, authStore.currentUser.did, event.state);
  // }
}

function loadSimulatedState1() {
  currentInitialGridState['sampleGrid1'] = {
    itemsPerPage: 5,
    sortState: { field: 'make', direction: 'asc' },
    columnOrder: ['make', 'model', 'price', 'id'], // Toyota first
    columnWidths: { 'make': 200, 'model': 180, 'id': 50 }
  };
  userSelectedItemsPerPage.value = 5; // Match itemsPerPage for consistency in this test
}

function loadSimulatedState2() {
  currentInitialGridState['sampleGrid1'] = {
    itemsPerPage: 3,
    sortState: { field: 'price', direction: 'desc' }, // Price sorted descending
    columnVisibility: { 'id': false } // Hide ID column
  };
  userSelectedItemsPerPage.value = 3; // Match
}

// Other data for more grids (anotherColDefs, anotherRowData) can be added if needed for more tests

</script>
<style scoped></style>
