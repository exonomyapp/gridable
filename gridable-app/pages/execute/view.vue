<template>
  <v-container fluid>
    <v-row v-if="loadingView">
      <v-col class="text-center pa-8">
        <v-progress-circular indeterminate size="64"></v-progress-circular>
        <p class="mt-4">Loading and executing view...</p>
      </v-col>
    </v-row>

    <v-row v-if="!loadingView && viewDefinition">
      <v-col cols="12">
        <v-card>
          <v-card-title>
            Executing View: {{ viewDefinition.viewName }}
          </v-card-title>
          <v-card-subtitle v-if="viewDefinition._id">
            View ID: {{ viewDefinition._id }} (DB: {{ viewAddress }})
          </v-card-subtitle>
          <v-card-text>
            <p v-if="executionError" class="text-error">{{ executionError }}</p>

            <GridableGrid
              v-if="viewResults.length > 0 || !initialDataLoaded"
              :column-defs="resultGridColDefs"
              :row-data="viewResults"
              :items-per-page="10"
              :view-id="viewAddress"
              :initial-grid-state="loadedGridState"
              @grid-state-change="handleGridStateSave"
            />
            <p v-else-if="initialDataLoaded && viewResults.length === 0" class="pa-4 text-center">
              This view returned no data based on the current criteria and source table content.
            </p>
            <p v-else-if="!initialDataLoaded && !executionError" class="pa-4 text-center">
              Preparing to load data...
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="!loadingView && !viewDefinition && !executionError">
      <v-col>
        <v-alert type="warning">
          No view address provided or view could not be loaded.
          Please provide a view address, e.g., <code>/execute/view?address=orbitdb://...</code>
        </v-alert>
      </v-col>
    </v-row>
     <v-row v-if="executionError && !loadingView">
       <v-col>
        <v-alert type="error">
          Error executing view: {{ executionError }}
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import GridableGrid from '~/components/core/GridableGrid.vue';
import { useAuthStore } from '~/store/auth';
import { getDocumentStoreDatabase, getKeyValueDatabase } from '~/services/orbitdb'; // Assuming getKeyValueDatabase for table data for now
import { getViewGridState, saveViewGridState, type GridState } from '~/services/userPreferences'; // For grid state persistence

// --- View Definition Interface (copied from view-editor for consistency) ---
interface ViewTableReference { tableId: string; orbitDBAddress: string; name: string; alias?: string; x: number; y: number; }
interface ViewCriteria { field: string; table: string; alias?: string; output: boolean; sort?: 'asc' | 'desc' | ''; filter?: string; group?: boolean; }
interface ViewDefinition { _id?: string; viewId: string; viewName: string; tables: ViewTableReference[]; relationships: any[]; criteria: ViewCriteria[]; ownerDID: string; createdTimestamp: number; lastModifiedTimestamp: number; }

const route = useRoute();
const authStore = useAuthStore();

const viewAddress = ref<string | null>(null);
const viewDefinition = ref<ViewDefinition | null>(null);
const viewResults = ref<any[]>([]);
const resultGridColDefs = ref<any[]>([]); // To be derived from ViewDefinition.criteria with output:true

const loadingView = ref(true);
const initialDataLoaded = ref(false); // To distinguish between no results and not yet loaded
const executionError = ref<string | null>(null);

// For GridableGrid state persistence on this results grid
const loadedGridState = ref<GridState>({});

async function loadAndExecuteView() {
  loadingView.value = true;
  executionError.value = null;
  initialDataLoaded.value = false;
  viewResults.value = [];
  resultGridColDefs.value = [];

  const address = route.query.address as string;
  if (!address) {
    executionError.value = "No view address provided in URL query parameter 'address'.";
    loadingView.value = false;
    return;
  }
  viewAddress.value = address;

  try {
    // 1. Load the View Definition
    const viewDefDb = await getDocumentStoreDatabase(address);
    const results = await viewDefDb.all(); // Assuming view def is the only doc
    if (!results || results.length === 0) {
      throw new Error("View definition not found at the provided address.");
    }
    viewDefinition.value = results[0] as ViewDefinition;
    console.log("Loaded View Definition:", viewDefinition.value);

    if (!viewDefinition.value || !viewDefinition.value.tables || viewDefinition.value.tables.length === 0) {
      throw new Error("View definition is invalid or contains no tables.");
    }

    // --- Load Grid State for this results grid ---
    if (authStore.currentUser?.did) {
        loadedGridState.value = (await getViewGridState(viewAddress.value)) || {};
        console.log("Loaded display preferences for this view execution:", loadedGridState.value);
    }


    // 2. Data Fetching (Focus on SINGLE TABLE for now)
    if (viewDefinition.value.tables.length > 1) {
      console.warn("View execution currently only supports single tables. Using the first table defined.");
      // executionError.value = "Multi-table views are not yet supported in execution.";
      // loadingView.value = false;
      // return;
    }
    const firstTableRef = viewDefinition.value.tables[0];
    if (!firstTableRef || !firstTableRef.orbitDBAddress) {
      throw new Error("First table reference in view definition is invalid or missing its OrbitDB address.");
    }

    console.log(`Fetching data from table: ${firstTableRef.name} (${firstTableRef.orbitDBAddress})`);
    // Assuming table data is in a key-value store where each value is a row object,
    // or a document store where db.all() returns all row documents.
    // Let's use getKeyValueDatabase and assume values are row objects.
    // TODO: The actual type of table DB (kv, docs, etc.) should ideally be in TableMetadata.
    const tableDb = await getKeyValueDatabase(firstTableRef.orbitDBAddress);
    const tableDataEntries = await tableDb.all(); // Format: [{ hash, key, value }, ...] for KV
    let rawTableData = tableDataEntries.map((entry:any) => entry.value); // Extract values

    // If it was a document store:
    // const tableDb = await getDocumentStoreDatabase(firstTableRef.orbitDBAddress);
    // rawTableData = await tableDb.all(); // Format: [doc1, doc2, ...]

    console.log("Raw data from table:", rawTableData);

    // 3. Apply View Criteria (Simplified)
    let processedData = [...rawTableData];

    // Apply Filters (very basic example: exact match on one field)
    const activeFilters = viewDefinition.value.criteria.filter(c => c.filter && c.filter.trim() !== '');
    activeFilters.forEach(crit => {
      if (crit.table === firstTableRef.name) { // Ensure filter applies to the current table
        // Super simple filter: field=value (e.g., "Status=Active")
        const [filterField, filterValue] = crit.filter!.split('=');
        if (filterField && filterValue) {
          console.log(`Applying filter: ${filterField} = ${filterValue}`);
          processedData = processedData.filter(row => {
            const rowVal = String(row[filterField?.trim()]);
            return rowVal === filterValue.trim();
          });
        }
      }
    });
    console.log("Data after filtering:", processedData);


    // Apply Sorting (single field for now)
    const sortCriterion = viewDefinition.value.criteria.find(c => c.sort && (c.sort === 'asc' || c.sort === 'desc'));
    if (sortCriterion && sortCriterion.table === firstTableRef.name) {
      const field = sortCriterion.field;
      const direction = sortCriterion.sort === 'asc' ? 1 : -1;
      console.log(`Applying sort: ${field} ${sortCriterion.sort}`);
      processedData.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA < valB) return -1 * direction;
        if (valA > valB) return 1 * direction;
        return 0;
      });
    }
    console.log("Data after sorting:", processedData);

    // Apply Output Fields & Aliases, and generate Column Definitions for the grid
    const outputCriteria = viewDefinition.value.criteria.filter(c => c.output && c.table === firstTableRef.name);
    resultGridColDefs.value = outputCriteria.map(crit => ({
      headerName: crit.alias || crit.field,
      field: crit.field, // Data will be mapped to use crit.field from the source
      sortable: true, // Allow user to re-sort on results grid
      // other AG Grid colDef properties can be added here if stored in criteria
    }));

    viewResults.value = processedData.map(row => {
      const resultRow: any = {};
      outputCriteria.forEach(crit => {
        resultRow[crit.field] = row[crit.field]; // Data is keyed by original field name
      });
      return resultRow;
    });
    console.log("Final view results:", viewResults.value);
    console.log("Result Grid ColDefs:", resultGridColDefs.value);


  } catch (err: any) {
    console.error("Error executing view:", err);
    executionError.value = err.message || "An unknown error occurred during view execution.";
  } finally {
    loadingView.value = false;
    initialDataLoaded.value = true;
  }
}

// For saving the UI state of the results grid (sorting, column order etc on *this* page)
const handleGridStateSave = (event: { viewId: string, state: GridState }) => {
  if (authStore.currentUser?.did && viewAddress.value) { // viewAddress.value is the viewId for its results grid state
    console.log(`Saving display state for executed view ${viewAddress.value}:`, event.state);
    saveViewGridState(viewAddress.value, event.state);
  }
};


onMounted(() => {
  if (authStore.isAuthenticated) {
    loadAndExecuteView();
  } else {
    // Watch for auth to complete then load
    const unwatch = watch(() => authStore.isAuthenticated, (isAuth) => {
      if (isAuth) {
        loadAndExecuteView();
        unwatch();
      }
    }, {immediate: true}); // immediate:true in case auth is already done when watcher is set up
  }
});

// Re-run if query address changes (e.g., user navigates from one view exec to another)
watch(() => route.query.address, (newAddress) => {
  if (newAddress && newAddress !== viewAddress.value) {
    loadAndExecuteView();
  }
});

</script>

<style scoped>
/* Add styles if needed */
.text-error {
  color: red;
}
</style>
