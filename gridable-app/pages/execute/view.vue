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
/**
 * @ref allTablesData
 * A reactive Map to store the raw data fetched from each table specified in the ViewDefinition.
 * The key is the `tableId` (from `ViewTableReference`), and the value is an array of row objects.
 * This data is fetched once and then used as input for join operations.
 */
const allTablesData = ref(new Map<string, any[]>());

const isOwnerOfView = computed(() => {
  return authStore.isAuthenticated && viewDefinition.value && authStore.currentUser?.did === viewDefinition.value.ownerDID;
});


// --- Data Fetching and Joining Logic ---

/**
 * Prefixes all keys in a given row object with a specified `tableId_` prefix.
 * This is crucial for disambiguating field names when data from multiple tables is combined
 * into a single row object after joins. For example, if two tables have an 'id' field,
 * they would become 'table1_id' and 'table2_id' in the joined row.
 *
 * @param {any} row - The input row object whose keys are to be prefixed.
 * @param {string} tableId - The ID of the table (typically `ViewTableReference.tableId`)
 *                           to use as the prefix for the keys.
 * @returns {any} A new object with all keys prefixed.
 */
function prefixFields(row: any, tableId: string): any {
  const prefixedRow: any = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      prefixedRow[`${tableId}_${key}`] = row[key];
    }
  }
  return prefixedRow;
}

/**
 * Fetches data from all tables specified in the ViewDefinition and then combines this data
 * based on the relationships (joins) defined in the ViewDefinition.
 *
 * **Current Implementation Details:**
 * - **Join Type:** Implements a simplified iterative INNER JOIN. If any table in a join sequence
 *   is empty or a join condition yields no matches, the resulting dataset for subsequent joins
 *   will be empty.
 * - **Join Order:** Processes relationships in the order they appear in `viewDef.relationships`.
 *   It assumes a somewhat linear or left-deep join tree structure where one table in each
 *   relationship is already part of the `processedData` set from previous joins.
 * - **Field Prefixing:** All fields in the output (joined) rows are prefixed with their original
 *   `tableId` (e.g., `tableId_fieldName`) to prevent naming collisions.
 *
 * **Limitations & Future Enhancements:**
 * - Does not yet support different join types (LEFT, RIGHT, OUTER).
 * - Does not implement sophisticated join order optimization; relies on the defined order.
 * - Error handling for complex disconnected relationship graphs is basic.
 *
 * @param {ViewDefinition} viewDef - The full view definition object, containing lists of
 *                                   tables and their relationships.
 * @param {Map<string, any[]>} allFetchedTableData - A map where keys are `tableId`s and
 *                                                   values are arrays of raw data rows for each table.
 * @returns {any[]} An array of combined row objects. Each object represents a successfully
 *                  joined row, with all its fields prefixed by their original `tableId`.
 *                  Returns an empty array if no data after joins or if initial tables are empty.
 */
function executeAndCombineAllData(
  viewDef: ViewDefinition,
  allFetchedTableData: Map<string, any[]>
): any[] {
  if (!viewDef.tables || viewDef.tables.length === 0) {
    return [];
  }

  // Base Case: If no relationships are defined, or only one table is in the view,
  // simply take the data from the first (or only) table and prefix its fields.
  if (!viewDef.relationships || viewDef.relationships.length === 0) {
    const firstTableRef = viewDef.tables[0];
    const tableData = allFetchedTableData.get(firstTableRef.tableId) || [];
    return tableData.map(row => prefixFields(row, firstTableRef.tableId));
  }

  let processedData: any[] = [];
  // TODO: Implement a more robust way to determine the starting table and join order,
  //       perhaps by analyzing the relationship graph or respecting a user-defined order.
  // For now, we simplify by initializing `processedData` with the source table of the first relationship.
  const initialRel = viewDef.relationships[0];

  const leftTableId = initialRel.sourceTableId;
  const leftTableData = allFetchedTableData.get(leftTableId) || [];
  if (leftTableData.length === 0) {
      console.warn(`[executeAndCombineAllData] Initial left table ${leftTableId} for join sequence has no data. INNER JOIN will result in empty set.`);
      return [];
  }
  processedData = leftTableData.map(row => prefixFields(row, leftTableId));

  const joinedTableIds = new Set<string>([leftTableId]); // Tracks tables already included in processedData

  // Iteratively apply subsequent joins.
  for (const rel of viewDef.relationships) {
    let currentLeftTableId: string | undefined; // tableId of the side already in processedData
    let currentRightTableId: string | undefined; // tableId of the new table to join
    let currentLeftJoinFieldKey: string | undefined; // Prefixed field key from processedData for the join
    let currentRightJoinFieldOriginal: string | undefined; // Original field key from the new table for the join
    let newTableToJoinId: string | undefined; // The ID of the table being newly joined

    // Determine which part of the relationship corresponds to already processed data
    // and which part is the new table to be joined.
    if (joinedTableIds.has(rel.sourceTableId) && !joinedTableIds.has(rel.targetTableId)) {
      // Source table is already joined, target table is new.
      currentLeftTableId = rel.sourceTableId;
      currentRightTableId = rel.targetTableId;
      currentLeftJoinFieldKey = `${rel.sourceTableId}_${rel.sourceFieldId}`;
      currentRightJoinFieldOriginal = rel.targetFieldId;
      newTableToJoinId = rel.targetTableId;
    } else if (!joinedTableIds.has(rel.sourceTableId) && joinedTableIds.has(rel.targetTableId)) {
      // Target table is already joined, source table is new. Swap them for processing.
      currentLeftTableId = rel.targetTableId;
      currentRightTableId = rel.sourceTableId;
      currentLeftJoinFieldKey = `${rel.targetTableId}_${rel.targetFieldId}`;
      currentRightJoinFieldOriginal = rel.sourceFieldId;
      newTableToJoinId = rel.sourceTableId;
    } else if (joinedTableIds.has(rel.sourceTableId) && joinedTableIds.has(rel.targetTableId)) {
      // Both tables in this relationship are already part of the joined set.
      // This might occur with cyclical relationships or if the initial table selection was naive.
      // For this simplified iterative joiner, we skip such relationships to avoid re-joining or complex handling.
      console.warn(`[executeAndCombineAllData] Skipping relationship as both tables ${rel.sourceTableId} and ${rel.targetTableId} are already part of the joined dataset.`);
      continue;
    } else {
      // This relationship connects two tables, neither of which is in the current `processedData`.
      // This indicates an issue with the join order assumption or a disconnected graph.
      console.error(`[executeAndCombineAllData] Cannot process relationship: neither source (${rel.sourceTableId}) nor target (${rel.targetTableId}) is in the current joined set. Relationships might be out of order, or the view definition might represent a disconnected graph.`);
      return []; // Or handle more gracefully, e.g., by trying other relationships first.
    }

    if (!newTableToJoinId) {
        console.error("[executeAndCombineAllData] Internal error: failed to identify new table to join for relationship:", rel);
        return []; // Should not be reached if above logic is sound
    }

    const rightTableDataOriginal = allFetchedTableData.get(newTableToJoinId) || [];
    // INNER JOIN behavior: if the new table to join is empty, the result of all joins becomes empty.
    if (rightTableDataOriginal.length === 0) {
      console.warn(`[executeAndCombineAllData] Right table ${newTableToJoinId} for join has no data. INNER JOIN with this table results in an empty set.`);
      return [];
    }

    // Build a hash map for the "right" table's rows for efficient O(1) average time lookups.
    // Keyed by the value of the join field in the right table.
    const rightTableHashMap = new Map<any, any[]>();
    rightTableDataOriginal.forEach(row => {
      const joinValue = row[currentRightJoinFieldOriginal!];
      if (!rightTableHashMap.has(joinValue)) {
        rightTableHashMap.set(joinValue, []);
      }
      rightTableHashMap.get(joinValue)!.push(row);
    });

    const nextProcessedData: any[] = [];
    // Iterate through the current `processedData` (left side of the join).
    processedData.forEach(leftRow => {
      const leftJoinValue = leftRow[currentLeftJoinFieldKey!]; // Value from the already joined data.
      const matchingRightRows = rightTableHashMap.get(leftJoinValue); // Find matches in the new table.

      if (matchingRightRows) {
        // If matches are found, combine the left row with each matching right row.
        matchingRightRows.forEach(rightRowOriginal => {
          nextProcessedData.push({
            ...leftRow, // Spread existing fields from the left side (already prefixed)
            ...prefixFields(rightRowOriginal, newTableToJoinId!) // Prefix fields from the new right table and merge
          });
        });
      }
      // If no matches found for a leftRow, it's dropped (INNER JOIN behavior).
    });
    processedData = nextProcessedData; // Update processedData with the result of this join.
    joinedTableIds.add(newTableToJoinId); // Mark the new table as joined.

    // If at any point the join results in an empty dataset, no further joins can produce data.
    if (processedData.length === 0) {
      console.warn(`[executeAndCombineAllData] Join with table ${newTableToJoinId} resulted in zero rows. Halting further joins.`);
      break;
    }
  }
  return processedData;
}


async function loadAndExecuteView() {
  loadingView.value = true;
  executionError.value = null;
 * @param tableId The tableId to use as a prefix.
 * @returns A new object with prefixed keys.
 */
function prefixFields(row: any, tableId: string): any {
  const prefixedRow: any = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      prefixedRow[`${tableId}_${key}`] = row[key];
    }
  }
  return prefixedRow;
}

/**
 * Fetches data from all tables in the view definition, then combines them based on relationships.
 * Currently implements a simplified iterative INNER JOIN strategy.
 * @param viewDef The ViewDefinition object.
 * @param allFetchedTableData A Map containing pre-fetched raw data for each table, keyed by tableId.
 * @returns An array of combined (joined) row objects with fields prefixed by tableId.
 */
function executeAndCombineAllData(
  viewDef: ViewDefinition,
  allFetchedTableData: Map<string, any[]>
): any[] {
  if (!viewDef.tables || viewDef.tables.length === 0) {
    return [];
  }

  // If no relationships or only one table, just prefix its data and return.
  if (!viewDef.relationships || viewDef.relationships.length === 0) {
    const firstTableRef = viewDef.tables[0];
    const tableData = allFetchedTableData.get(firstTableRef.tableId) || [];
    return tableData.map(row => prefixFields(row, firstTableRef.tableId));
  }

  let processedData: any[] = [];
  const initialRel = viewDef.relationships[0]; // TODO: More robust starting point for complex join trees

  // Initialize with the first table in the first relationship
  const leftTableId = initialRel.sourceTableId;
  const leftTableData = allFetchedTableData.get(leftTableId) || [];
  if (leftTableData.length === 0 && viewDef.relationships.length > 0) { // If first table in chain is empty, inner join result is empty
      console.warn(`[executeAndCombineAllData] Initial left table ${leftTableId} has no data. INNER JOIN will result in empty set.`);
      return [];
  }
  processedData = leftTableData.map(row => prefixFields(row, leftTableId));

  const joinedTableIds = new Set<string>([leftTableId]);

  // Iteratively join remaining tables based on relationships
  // This simple loop assumes a somewhat linear chain or that relationships are ordered correctly.
  // A more robust solution would build a proper join tree/plan.
  for (const rel of viewDef.relationships) {
    let currentLeftTableId: string | undefined;
    let currentRightTableId: string | undefined;
    let currentLeftJoinFieldKey: string | undefined;
    let currentRightJoinFieldOriginal: string | undefined;
    let newTableToJoinId: string | undefined;

    // Determine which side of the relationship is already in `processedData`
    if (joinedTableIds.has(rel.sourceTableId) && !joinedTableIds.has(rel.targetTableId)) {
      currentLeftTableId = rel.sourceTableId;
      currentRightTableId = rel.targetTableId;
      currentLeftJoinFieldKey = `${rel.sourceTableId}_${rel.sourceFieldId}`;
      currentRightJoinFieldOriginal = rel.targetFieldId;
      newTableToJoinId = rel.targetTableId;
    } else if (!joinedTableIds.has(rel.sourceTableId) && joinedTableIds.has(rel.targetTableId)) {
      // Swap: treat target as left, source as right for this join step
      currentLeftTableId = rel.targetTableId;
      currentRightTableId = rel.sourceTableId;
      currentLeftJoinFieldKey = `${rel.targetTableId}_${rel.targetFieldId}`;
      currentRightJoinFieldOriginal = rel.sourceFieldId;
      newTableToJoinId = rel.sourceTableId;
    } else if (joinedTableIds.has(rel.sourceTableId) && joinedTableIds.has(rel.targetTableId)) {
      // Both tables already joined (e.g. complex relationship or redundant definition), skip for now.
      // Or, this could be a self-join if table IDs were aliased, but not supported yet.
      console.warn(`[executeAndCombineAllData] Skipping relationship as both tables ${rel.sourceTableId} and ${rel.targetTableId} are already notionally joined.`);
      continue;
    } else {
      // This relationship connects two tables not yet in the main dataset, or logic error.
      // This can happen if the first relationship didn't involve the initial `leftTableId` from above.
      // For this simplified iterative join, we require one part of the relationship to already be 'processed'.
      console.error(`[executeAndCombineAllData] Cannot process relationship: neither source (${rel.sourceTableId}) nor target (${rel.targetTableId}) is in the current joined set. Relationships might be out of order or disconnected.`);
      return []; // Or handle more gracefully
    }

    if (!newTableToJoinId) { // Should not happen if logic above is correct
        console.error("[executeAndCombineAllData] Error identifying new table to join for relationship:", rel);
        return [];
    }

    const rightTableDataOriginal = allFetchedTableData.get(newTableToJoinId) || [];
    if (rightTableDataOriginal.length === 0) {
      console.warn(`[executeAndCombineAllData] Right table ${newTableToJoinId} for join has no data. INNER JOIN will result in empty set.`);
      return []; // INNER JOIN behavior
    }

    // Build a hash map for the right table for efficient lookup
    const rightTableHashMap = new Map<any, any[]>();
    rightTableDataOriginal.forEach(row => {
      const joinValue = row[currentRightJoinFieldOriginal!];
      if (!rightTableHashMap.has(joinValue)) {
        rightTableHashMap.set(joinValue, []);
      }
      rightTableHashMap.get(joinValue)!.push(row);
    });

    const nextProcessedData: any[] = [];
    processedData.forEach(leftRow => {
      const leftJoinValue = leftRow[currentLeftJoinFieldKey!];
      const matchingRightRows = rightTableHashMap.get(leftJoinValue);
      if (matchingRightRows) {
        matchingRightRows.forEach(rightRowOriginal => {
          nextProcessedData.push({
            ...leftRow,
            ...prefixFields(rightRowOriginal, newTableToJoinId!)
          });
        });
      }
    });
    processedData = nextProcessedData;
    joinedTableIds.add(newTableToJoinId);

    if (processedData.length === 0) {
      console.warn(`[executeAndCombineAllData] Join resulted in zero rows. Halting further joins.`);
      break; // No more rows to join with
    }
  }
  return processedData;
}


async function loadAndExecuteView() {
  loadingView.value = true;
  executionError.value = null;
  initialDataLoaded.value = false;
  viewResults.value = [];
  resultGridColDefs.value = [];
  viewDefinition.value = null;
  allTablesData.value.clear();

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

    // Step 1: Fetch data for all tables defined in the view.
    // Each table's data is stored in `allTablesData` Map, keyed by `tableRef.tableId`.
    for (const tableRef of viewDefinition.value.tables) {
      if (!tableRef.orbitDBAddress) {
        console.error(`[ExecuteView] Table '${tableRef.name}' (ID: ${tableRef.tableId}) is missing its OrbitDB address. Skipping.`);
        allTablesData.value.set(tableRef.tableId, []);
        continue;
      }
      try {
        console.log(`[ExecuteView] Fetching data for table: ${tableRef.name} (ID: ${tableRef.tableId}, Address: ${tableRef.orbitDBAddress})`);
        const tableDb = await getKeyValueDatabase(tableRef.orbitDBAddress);
        const tableDataEntries = await tableDb.all();
        const fetchedRows = tableDataEntries.map((entry: any) => entry.value);
        allTablesData.value.set(tableRef.tableId, fetchedRows);
        console.log(`[ExecuteView] Fetched ${fetchedRows.length} rows for table '${tableRef.name}' (ID: ${tableRef.tableId})`);
      } catch (tableErr: any) {
        console.error(`[ExecuteView] Error fetching data for table ${tableRef.name} (ID: ${tableRef.tableId}):`, tableErr);
        // Store empty array and set a general error message; specific errors might be numerous.
        allTablesData.value.set(tableRef.tableId, []);
        if (!executionError.value) { // Set general error if not already set by a more critical failure
             executionError.value = `Error fetching data for one or more tables (e.g., '${tableRef.name}'). View may be incomplete or fail.`;
        }
      }
    }
    console.log("[ExecuteView] All tables data fetched:", Object.fromEntries(allTablesData.value));

    // Step 2: Combine data from multiple tables based on defined relationships (joins).
    // The `executeAndCombineAllData` function handles this, returning rows with prefixed field names.
    let combinedData = executeAndCombineAllData(viewDefinition.value, allTablesData.value);
    console.log("[ExecuteView] Combined (Joined) Data (count: " + combinedData.length + "):", combinedData.length < 10 ? combinedData : combinedData.slice(0,10));


    // Step 3: Apply Filters.
    // Filters are applied to the combined (joined) dataset.
    // Criteria need to reference fields using their prefixed names (e.g., 'tableId_fieldName').
    // A map from table name (used in criteria) to tableId (used for prefix) is helpful here.
    const tableNameToIdMap = new Map<string, string>();
    viewDefinition.value.tables.forEach(t => tableNameToIdMap.set(t.name, t.tableId));

    const activeFilters = viewDefinition.value.criteria.filter(c => c.filter && c.filter.trim() !== '');
    let filteredData = [...combinedData];
    activeFilters.forEach(crit => {
      const tableId = tableNameToIdMap.get(crit.table); // Get tableId from table name in criterion
      if (!tableId) {
        console.warn(`[ExecuteView] Filter criteria for unknown table name '${crit.table}'. Skipping filter:`, crit);
        return;
      }
      const prefixedField = `${tableId}_${crit.field}`; // Construct the prefixed field name

      // Basic filter parsing: assumes "operator=value" or just "value" for equality.
      // TODO: Implement more robust filter parsing (e.g., for >, <, LIKE etc.)
      const filterParts = crit.filter!.split('=');
      const filterValue = (filterParts.length > 1 ? filterParts[1] : filterParts[0]).trim().toLowerCase();
      // const filterOperator = filterParts.length > 1 ? filterParts[0].trim() : '='; // Example for future

      filteredData = filteredData.filter(row => {
        if (!row.hasOwnProperty(prefixedField)) {
          // This can happen if a join did not include this table for a particular row,
          // or if the field simply doesn't exist. Such rows should not pass the filter.
          return false;
        }
        return String(row[prefixedField])?.toLowerCase() === filterValue;
      });
    });
    console.log("[ExecuteView] Filtered Data (count: " + filteredData.length + "):", filteredData.length < 10 ? filteredData : filteredData.slice(0,10));

    // Step 4: Apply Grouping and Aggregation.
    // Criteria are adapted to use prefixed field names for grouping lookups in `filteredData`.
    // The `originalField` is passed for `calculateAggregate` to use on raw group rows before projection.
    const criteriaForGA = viewDefinition.value.criteria.map(crit => {
        const tableId = tableNameToIdMap.get(crit.table);
        if (!tableId) {
             console.warn(`[ExecuteView] Criteria for G&A for unknown table name '${crit.table}'. Using original field name.`);
             return { ...crit, originalField: crit.field, field: crit.field };
        }
        return {
            ...crit,
            originalField: crit.field, // Used by calculateAggregate on non-prefixed data within a group
            field: `${tableId}_${crit.field}`, // Prefixed field used for grouping keys and identifying field in joined data
        };
    });
    let processedData = processGroupingAndAggregation(filteredData, criteriaForGA);
    console.log("[ExecuteView] Grouped/Aggregated Data (count: " + processedData.length + "):", processedData.length < 10 ? processedData : processedData.slice(0,10));


    // Step 5: Apply Sorting (post-aggregation/grouping).
    // Sorting operates on the `processedData` which has aliased or specially named fields from G&A.
    const sortCriterion = viewDefinition.value.criteria.find(c => c.sort && (c.sort === 'asc' || c.sort === 'desc') && c.output);
    if (sortCriterion && processedData.length > 0) {
        // Determine the final field key to sort by. This could be an alias,
        // a prefixed group key, or a prefixed/aliased aggregate field name.
        let sortFieldKey = sortCriterion.alias; // User-defined alias takes precedence.
        if (!sortFieldKey) {
            const tableId = tableNameToIdMap.get(sortCriterion.table);
            if (sortCriterion.aggregationFunction) { // Field is an aggregate
                sortFieldKey = `${sortCriterion.aggregationFunction}_${tableId}_${sortCriterion.field}`;
            } else if (sortCriterion.group && tableId) { // Field is a grouping key
                 sortFieldKey = `${tableId}_${sortCriterion.field}`;
            } else { // Field is a simple projection from a table (should be prefixed if joined)
                sortFieldKey = tableId ? `${tableId}_${sortCriterion.field}` : sortCriterion.field;
            }
        }

        if (processedData[0].hasOwnProperty(sortFieldKey)) {
            const direction = sortCriterion.sort === 'asc' ? 1 : -1;
            processedData.sort((a, b) => {
                const vA = a[sortFieldKey];
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
