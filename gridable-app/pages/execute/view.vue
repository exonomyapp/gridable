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

// Interfaces (matching view-editor.vue for consistency)
interface ViewTableReference { tableId: string; orbitDBAddress: string; name: string; alias?: string; x: number; y: number; }

/**
 * @interface ViewCriteria
 * Defines the structure for a single criterion applied to a field in a view.
 * This mirrors `CriteriaRow` from `view-editor.vue` but is named `ViewCriteria`
 * in this execution context for clarity.
 * @property {string} field - The original name of the field from the source table.
 * @property {string} table - The name of the source table this field belongs to.
 * @property {string} [alias] - Optional alias to be used for this field in the view's output.
 * @property {boolean} output - If true, this field (or its aggregated/aliased version)
 *                              should be included in the final output of the view.
 * @property {'asc' | 'desc' | ''} [sort] - Specifies the sort order for this field.
 *                                          Empty or undefined means no sorting on this field.
 * @property {string} [filter] - Filter condition string applied to this field (e.g., "value>10").
 *                               Note: Current implementation uses a simple "field=value" split.
 * @property {boolean} [group] - If true, the view results will be grouped by this field.
 *                               Mutual exclusivity with `aggregationFunction` is handled during processing.
 * @property {'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | ''} [aggregationFunction] - Specifies the aggregation
 *                               function to apply to this field (e.g., SUM, COUNT).
 *                               If set, `group` should typically be false for this field.
 */
interface ViewCriteria {
  field: string;
  table: string; // Name of the source table for this field
  alias?: string;
  output: boolean;
  sort?: 'asc' | 'desc' | '';
  filter?: string;
  group?: boolean;
  aggregationFunction?: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | '';
}

interface ViewDefinition {
  _id?: string;
  viewId: string;
  viewName: string;
  tables: ViewTableReference[];
  relationships: any[]; // Assuming structure from view-editor.vue: Relationship[]
  criteria: ViewCriteria[];
  ownerDID: string;
  createdTimestamp: number;
  lastModifiedTimestamp: number;
}


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

    // Apply Filters (pre-aggregation/grouping)
    const activeFilters = viewDefinition.value.criteria.filter(c => c.filter && c.filter.trim() !== '' && c.table === firstTableRef.name);
    activeFilters.forEach(crit => {
      const [filterField, filterValue] = crit.filter!.split('='); // Basic filter
      if (filterField && filterValue) {
        processedData = processedData.filter(row => String(row[filterField?.trim()])?.toLowerCase() === filterValue.trim()?.toLowerCase());
      }
    });

    // Apply Grouping and Aggregation or simple projection.
    // This step transforms the `processedData` based on `group` and `aggregationFunction`
    // flags in the `relevantCriteria`. It also handles field aliasing for the output.
    // Note: `relevantCriteria` are filtered for the first table, as this component
    // currently only processes single-table views.
    const relevantCriteria = viewDefinition.value.criteria.filter(c => c.table === firstTableRef.name);
    processedData = processGroupingAndAggregation(processedData, relevantCriteria);

    // Apply Sorting (post-aggregation/grouping).
    // Sorting is performed on the `processedData` which might now be grouped/aggregated results.
    // It uses the field name or alias specified in the sort criterion.
    const sortCriterion = viewDefinition.value.criteria.find(c => c.sort && (c.sort === 'asc' || c.sort === 'desc') && c.table === firstTableRef.name && c.output);
    if (sortCriterion && processedData.length > 0) {
        // Use alias if provided, otherwise original field name for sorting.
        // This key must match a key in the objects within `processedData`.
        const sortFieldKey = sortCriterion.alias || sortCriterion.field;

        // Ensure the sortFieldKey exists in the processed data to prevent errors.
        // This is particularly important if aliases are used or if aggregation changes field names.
        if (processedData[0].hasOwnProperty(sortFieldKey)) {
            const direction = sortCriterion.sort === 'asc' ? 1 : -1;
            processedData.sort((a, b) => {
                const vA = a[sortFieldKey]; // Access data using the determined sort key
                const vB = b[sortFieldKey];
                if (typeof vA === 'number' && typeof vB === 'number') {
                    return (vA - vB) * direction;
                }
                if (String(vA).toLowerCase() < String(vB).toLowerCase()) return -1 * direction;
                if (String(vA).toLowerCase() > String(vB).toLowerCase()) return 1 * direction;
                return 0;
            });
        } else {
            console.warn(`[ExecuteView] Sort field '${sortFieldKey}' not found in processed data after aggregation/grouping. Skipping sort.`);
        }
    }

    // Determine Column Definitions for GridableGrid.
    // If data exists after processing, column definitions are derived from the keys of the first result row.
    // These keys will correspond to grouped field names (or their aliases) and aggregate field names (or their aliases).
    // If no data, column definitions are attempted from `relevantCriteria` that are marked for output.
    if (processedData.length > 0) {
        const firstResultRow = processedData[0];
        resultGridColDefs.value = Object.keys(firstResultRow).map(key => ({
            headerName: key, // Key is already the alias or final field name from G&A processing.
            field: key,
            sortable: true
        }));
    } else {
        // Fallback if processedData is empty: generate columns from criteria.
        const outputCriteria = relevantCriteria.filter(c => c.output);
         if(outputCriteria.length === 0 && viewDefinition.value.criteria.length > 0) { // Check if criteria existed
            console.warn("[ExecuteView] No output fields specified or all data filtered out. Grid columns may be empty or based on initial criteria if no data to infer from.");
            resultGridColDefs.value = []; // No data, no output criteria = no columns
        } else {
             // Attempt to build columns from criteria that were supposed to be outputted.
            resultGridColDefs.value = outputCriteria.map(crit => {
                let finalFieldName = crit.alias || crit.field;
                if (crit.aggregationFunction && !crit.alias) {
                    finalFieldName = `${crit.aggregationFunction}_${crit.field}`;
                }
                return { headerName: finalFieldName, field: finalFieldName, sortable: true };
            });
        }
    }

    viewResults.value = processedData;

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


// --- Grouping and Aggregation Helper Functions ---

/**
 * Calculates a single aggregate value (SUM, AVG, COUNT, MIN, MAX) for a specified field
 * from an array of data rows.
 *
 * - For `SUM`, `AVG`, `MIN`, `MAX`: Values are parsed as floats. Non-numeric values are ignored.
 *   If no valid numeric values are found for these functions, `undefined` is returned.
 * - For `COUNT`: It counts the number of rows where the specified `field` has a non-null
 *   and non-undefined value. If all values for the field are null/undefined, it returns 0.
 * - If `rows` is empty or `funcName` is not recognized, `undefined` is returned (except for COUNT which would be 0).
 *
 * @param {any[]} rows - The array of data objects (rows) to aggregate.
 * @param {string} field - The name of the field within each row object to aggregate.
 * @param {'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | ''} funcName - The aggregation function to apply.
 * @returns {number | undefined} The calculated aggregate value, or undefined if not applicable/possible.
 */
function calculateAggregate(
  rows: any[],
  field: string,
  funcName: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | ''
): number | undefined {
  if (!rows || rows.length === 0) return funcName === 'COUNT' ? 0 : undefined;

  const values = rows.map(row => row[field]).filter(val => val !== null && val !== undefined);

  if (funcName === 'COUNT') {
    return values.length;
  }

  if (values.length === 0) return undefined; // No non-null values to aggregate for SUM, AVG, MIN, MAX

  const numericValues = values.map(val => parseFloat(String(val))).filter(val => !isNaN(val));
  if (numericValues.length === 0) return undefined; // No valid numbers to aggregate

  switch (funcName) {
    case 'SUM':
      return numericValues.reduce((acc, val) => acc + val, 0);
    case 'AVG':
      return numericValues.reduce((acc, val) => acc + val, 0) / numericValues.length;
    case 'MIN':
      return Math.min(...numericValues);
    case 'MAX':
      return Math.max(...numericValues);
    default:
      console.warn(`[calculateAggregate] Unknown aggregation function: ${funcName}`);
      return undefined;
  }
}

/**
 * Processes an array of data rows based on grouping and aggregation criteria defined in `viewDefCriteria`.
 * This function currently operates on data assumed to be from a single table.
 *
 * **Processing Logic:**
 * 1.  **Filters Criteria:** Considers only criteria marked for `output`.
 * 2.  **Identifies Grouping & Aggregation:** Separates criteria into `groupingFieldsCriteria` (where `group: true`)
 *     and `aggregationTasksCriteria` (where `aggregationFunction` is set and not grouped).
 * 3.  **Handles Scenarios:**
 *     a.  **No Grouping, No Aggregation (Projection):** If neither grouping nor aggregation is specified,
 *         it projects the data by selecting output fields and applying aliases as defined.
 *     b.  **Global Aggregates (No Grouping, With Aggregation):** If aggregations are specified but no
 *         grouping fields, it calculates aggregates over the entire dataset. Non-aggregated output
 *         fields are taken from the first row (if data exists). Returns a single result row.
 *     c.  **Grouping (With or Without Aggregation):** If grouping fields are specified:
 *         -   Data is grouped by creating a composite key from the values of grouping fields.
 *         -   For each group, it includes the grouping field values (from the first row of the group)
 *             and calculates any specified aggregations over the rows in that group.
 *         -   Field aliases are applied to both grouping and aggregated fields in the output.
 *
 * @param {any[]} data - The input array of data rows (assumed to be already filtered).
 * @param {ViewCriteria[]} viewDefCriteria - An array of `ViewCriteria` objects that define
 *                                           how fields should be processed (grouped, aggregated, aliased, etc.).
 * @returns {any[]} An array of processed rows. Each row is an object where keys are
 *                  either original field names, aliases for grouped fields, or aliases/generated names
 *                  for aggregated fields (e.g., `SUM_sales` or a user-defined alias).
 */
function processGroupingAndAggregation(
  data: any[],
  viewDefCriteria: ViewCriteria[]
): any[] {
  // Filter for criteria that are marked for output, as these are the only ones relevant for the result set.
  const relevantCriteria = viewDefCriteria.filter(c => c.output);

  const groupingFieldsCriteria = relevantCriteria.filter(crit => crit.group === true);
  const aggregationTasksCriteria = relevantCriteria.filter(crit => crit.aggregationFunction && crit.aggregationFunction !== '' && crit.group !== true);

  // Scenario d: No Grouping, No Aggregation defined by user for output fields.
  // Perform simple projection based on 'output' and 'alias'.
  if (groupingFieldsCriteria.length === 0 && aggregationTasksCriteria.length === 0) {
    return data.map(row => {
      const resultRow: any = {};
      relevantCriteria.forEach(crit => { // Iterate over all relevant (output) criteria
        resultRow[crit.alias || crit.field] = row[crit.field];
      });
      return resultRow;
    });
  }

  // Scenario b: Global Aggregates (No Grouping fields, but Aggregation tasks exist)
  if (groupingFieldsCriteria.length === 0) {
    if (data.length === 0 && aggregationTasksCriteria.some(agg => agg.aggregationFunction !== 'COUNT')) {
        // If no data and not just doing a COUNT, return empty to avoid a row of undefineds.
        // COUNT on empty set should be 0.
        const resultRowForEmptyCount: any = {};
         aggregationTasksCriteria.forEach(aggCrit => {
            if(aggCrit.aggregationFunction === 'COUNT') {
                 resultRowForEmptyCount[aggCrit.alias || `${aggCrit.aggregationFunction}_${aggCrit.field}`] = 0;
            } else {
                 resultRowForEmptyCount[aggCrit.alias || `${aggCrit.aggregationFunction}_${aggCrit.field}`] = undefined;
            }
        });
        // Include other non-aggregated output fields as undefined
        relevantCriteria.filter(crit => !crit.group && !crit.aggregationFunction && crit.output).forEach(crit => {
            resultRowForEmptyCount[crit.alias || crit.field] = undefined;
        });
        return aggregationTasksCriteria.length > 0 ? [resultRowForEmptyCount] : [];
    }

    const resultRow: any = {};
    aggregationTasksCriteria.forEach(aggCrit => {
      const value = calculateAggregate(data, aggCrit.field, aggCrit.aggregationFunction!);
      resultRow[aggCrit.alias || `${aggCrit.aggregationFunction}_${aggCrit.field}`] = value;
    });
    // For non-aggregated, non-grouped fields marked for output, SQL would typically require them in a GROUP BY.
    // Here, we take their value from the first row if data exists. This might be misleading if values vary.
    relevantCriteria.filter(crit => !crit.group && !crit.aggregationFunction && crit.output).forEach(crit => {
        resultRow[crit.alias || crit.field] = data.length > 0 ? data[0][crit.field] : undefined;
    });
    return [resultRow]; // Global aggregates always produce a single row.
  }

  // Scenario c: Grouping (with or without Aggregations)
  const groupedData: { [key: string]: any[] } = {};
  data.forEach(row => {
    // Construct a composite key from the values of all grouping fields.
    const groupKey = groupingFieldsCriteria.map(gf => row[gf.field]).join('::');
    if (!groupedData[groupKey]) {
      groupedData[groupKey] = [];
    }
    groupedData[groupKey].push(row);
  });

  const finalResults: any[] = [];
  for (const groupKey in groupedData) {
    const groupRows = groupedData[groupKey]; // Rows belonging to the current group.
    const resultRow: any = {};

    // Add grouping fields to the result row (using alias if provided).
    // Values are taken from the first row of the group as they are constant within the group.
    groupingFieldsCriteria.forEach(groupCrit => {
      resultRow[groupCrit.alias || groupCrit.field] = groupRows[0][groupCrit.field];
    });

    // Calculate and add aggregated fields to the result row.
    aggregationTasksCriteria.forEach(aggCrit => {
      const value = calculateAggregate(groupRows, aggCrit.field, aggCrit.aggregationFunction!);
      resultRow[aggCrit.alias || `${aggCrit.aggregationFunction}_${aggCrit.field}`] = value;
    });
    finalResults.push(resultRow);
  }
  return finalResults;
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
