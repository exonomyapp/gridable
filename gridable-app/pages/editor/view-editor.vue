<template>
  <v-container fluid class="view-editor-container">
    <v-row>
      <v-col cols="12" class="d-flex justify-space-between align-center pb-0">
        <div>
          <v-text-field
            v-model="currentViewName"
            label="View Name"
            placeholder="Enter a name for your view"
            dense
            hide-details
            class="mr-4"
            style="max-width: 400px; display: inline-block;"
          ></v-text-field>
        </div>
        <div>
          <v-btn @click="loadUserTables(true)" :loading="loadingTables" small density="compact" class="mr-2">Refresh Tables</v-btn>
          <v-btn @click="openLoadViewDialog" small density="compact" class="mr-2" :disabled="!authStore.isAuthenticated">Load View</v-btn>
          <v-btn @click="handleSaveView" color="primary" prepend-icon="mdi-content-save" :disabled="designedTables.length === 0 || !currentViewName || !authStore.isAuthenticated" :loading="savingView" density="compact">
            Save View
          </v-btn>
        </div>
      </v-col>
      <v-col cols="12" class="pt-0">
         <p class="text-caption" v-if="currentViewDbAddress">
            Current View DB Address: {{ currentViewDbAddress }}
            <v-icon size="small" @click="copyToClipboard(currentViewDbAddress)" title="Copy Address">mdi-clipboard-outline</v-icon>
          </p>
      </v-col>
    </v-row>

    <!-- Load View Dialog -->
    <v-dialog v-model="loadViewDialog" max-width="700px">
      <v-card>
        <v-card-title>Load View</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="viewAddressToLoad"
            label="OrbitDB View Address (or select from list below)"
            placeholder="Enter the full OrbitDB address of the view"
            clearable
            class="mb-3"
          ></v-text-field>

          <v-divider class="my-4"></v-divider>

          <h4 class="mb-2">My Saved Views</h4>
          <div v-if="loadingSavedViews" class="text-center pa-4"><v-progress-circular indeterminate></v-progress-circular></div>
          <v-list dense v-if="!loadingSavedViews && savedViews.length > 0" style="max-height: 300px; overflow-y: auto;">
            <v-list-item
              v-for="view in sortedSavedViews"
              :key="view.viewId"
              @click="selectViewToLoad(view)"
              :active="view.viewAddress === viewAddressToLoad"
              color="primary"
            >
              <v-list-item-title>{{ view.viewName }}</v-list-item-title>
              <v-list-item-subtitle :title="view.viewAddress">
                ID: {{ view.viewId.substring(0,15) }}...
                <span v-if="view.lastAccessedTimestamp">Accessed: {{ new Date(view.lastAccessedTimestamp).toLocaleDateString() }}</span>
              </v-list-item-subtitle>
              <template v-slot:append>
                <v-btn icon="mdi-delete-outline" variant="text" size="small" @click.stop="confirmDeleteSavedView(view)" title="Remove from list"></v-btn>
              </template>
            </v-list-item>
          </v-list>
          <p v-if="!loadingSavedViews && savedViews.length === 0" class="text-caption">
            No views saved yet. Save a view in the editor to see it here.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="loadViewDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="confirmLoadViewFromDialog" :disabled="!viewAddressToLoad">Load Selected/Entered</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirm Delete Dialog -->
    <v-dialog v-model="confirmDeleteDialog" max-width="400px">
        <v-card>
            <v-card-title>Confirm Delete</v-card-title>
            <v-card-text>
                Are you sure you want to remove "{{ viewToDelete?.viewName }}" from your saved views list? This does not delete the actual view data, only the reference from this list.
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click="confirmDeleteDialog = false">Cancel</v-btn>
                <v-btn color="error" @click="executeDeleteSavedView">Delete</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>


    <!-- Editor Panes (condensed template for brevity, content taken from previous full version) -->
    <v-row class="editor-panes mt-2">
      <v-col cols="12" md="3" class="tables-pane">
        <v-card class="fill-height">
          <v-card-title>Available Tables</v-card-title>
          <v-card-text>
            <div v-if="loadingTables" class="text-center pa-4"><v-progress-circular indeterminate></v-progress-circular></div>
            <v-list dense v-else-if="availableTablesForDisplay.length > 0">
              <v-list-item v-for="table in availableTablesForDisplay" :key="table.id" @click="() => addTableToDesign(table)" link>
                <v-list-item-title :title="table.id">{{ table.name }}</v-list-item-title>
                 <v-list-item-subtitle>{{ table.fields.length }} fields</v-list-item-subtitle>
                <v-tooltip activator="parent" location="end">ID: {{ table.id }}\nClick to add to design</v-tooltip>
              </v-list-item>
            </v-list>
            <p v-else class="text-caption pa-3">No tables. <v-btn small variant="text" @click="registerSampleTables" :loading="loadingTables">Register Samples</v-btn></p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="9" class="design-surface-pane">
        <v-card class="fill-height">
          <v-card-title>View Design Surface</v-card-title>
          <v-card-text class="design-surface" ref="designSurfaceRef" @dragover.prevent="handleDragOver" @drop.prevent="handleDropOnSurface">
            <div v-for="(table, index) in designedTables" :key="table.id" :id="'designed_table_' + table.id.replace(/[^a-zA-Z0-9]/g, '_')"
              class="designed-table-representation" :style="{ top: table.y + 'px', left: table.x + 'px', cursor: 'grab' }"
              draggable="true" @dragstart="event => handleTableDragStart(event, table, index)" @dragend="handleTableDragEnd">
              <strong>{{ table.name }}</strong>
               <ul class="field-list">
                <li v-for="field in table.fields" :key="field.name" class="field-item">
                  <v-icon size="x-small" class="mr-1">{{ getFieldIcon(field.type) }}</v-icon>
                  <span class="field-name">{{ field.name }}</span>
                  <span class="text-caption grey--text"> ({{ field.type }})</span>
                  <div
                    class="field-port"
                    :data-table-id="table.id"
                    :data-field-name="field.name"
                    @mousedown.stop="event => handlePortMouseDown(event, table, field)"
                  ></div>
                </li>
              </ul>
            </div>
            <!-- SVG Overlay for drawing lines -->
            <svg class="relationship-lines-svg" width="100%" height="100%" @click="deselectRelationshipLine">
              <line
                v-if="isDrawingLine && lineSourceCoords && currentLineEnd"
                :x1="lineSourceCoords.x" :y1="lineSourceCoords.y"
                :x2="currentLineEnd.x" :y2="currentLineEnd.y"
                stroke="#777" stroke-width="2" stroke-dasharray="5,5"
              />
              <g v-for="relLine in linesToRender" :key="relLine.id" @click.stop="handleRelationshipLineClick(relLine.id)" class="relationship-line-group">
                <!-- Wider invisible line for easier clicking -->
                <line
                  :x1="relLine.x1" :y1="relLine.y1"
                  :x2="relLine.x2" :y2="relLine.y2"
                  stroke="transparent" stroke-width="10"
                  style="cursor: pointer;"
                />
                <line
                  :x1="relLine.x1" :y1="relLine.y1"
                  :x2="relLine.x2" :y2="relLine.y2"
                  :stroke="selectedRelationshipId === relLine.id ? 'red' : '#555'"
                  :stroke-width="selectedRelationshipId === relLine.id ? 3 : 2"
                  style="pointer-events: none;"
                />
              </g>
            </svg>
            <p class="text-h6 text-center grey--text" v-if="designedTables.length === 0 && !draggedTable">Add tables to design.</p>
             <p class="text-caption mt-4" v-if="designedTables.length > 0">
              Drag tables. Click & drag field ports for relationships. Click line & press Del/Backspace to remove.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row class="criteria-pane-row mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>Field Selection & Criteria Grid</v-card-title>
          <v-card-text>
            <p class="text-caption mb-2" v-if="designedTables.length === 0">Add tables to the design surface to see their fields here.</p>
            <GridableGrid v-else :column-defs="criteriaGridColDefs" :row-data="criteriaGridRowData" :items-per-page="10" @cell-value-changed="handleCriteriaGridChange" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import GridableGrid from '~/components/core/GridableGrid.vue';
import { useAuthStore } from '~/store/auth';
import {
  getAllTableMetadata, registerTable, getTableMetadata,
  addSavedView, listSavedViews, removeSavedView, getSavedView,
  type TableMetadata, type TableFieldSchema, type SavedViewInfo
} from '~/services/userPreferences';
import { getDocumentStoreDatabase, putDocument, getDocumentById as getOrbitDocById, mockDidVerificationFunction } from '~/services/orbitdb';
import { CustomDIDAccessController } from '~/services/orbitdb-did-access-controller';

const authStore = useAuthStore();
const route = useRoute();

// --- Interfaces ---
interface DesignedTableField { name: string; type: string; }
interface DesignedTableDisplay { id: string; name: string; fields: DesignedTableField[]; x: number; y: number; originalMetadata?: TableMetadata; orbitDBAddress?: string; }
interface ViewTableReference { tableId: string; orbitDBAddress: string; name: string; alias?: string; x: number; y: number; }
interface CriteriaRow { field: string; table: string; alias?: string; output: boolean; sort?: 'asc' | 'desc' | ''; filter?: string; group?: boolean; }

/**
 * @interface Relationship
 * Defines the structure for a visual relationship between two table fields.
 * @property {string} id - Unique identifier for the relationship.
 * @property {string} sourceTableId - The ID of the source table.
 * @property {string} sourceFieldId - The name/ID of the source field.
 * @property {string} targetTableId - The ID of the target table.
 * @property {string} targetFieldId - The name/ID of the target field.
 */
interface Relationship {
  id: string;
  sourceTableId: string;
  sourceFieldId: string; // Using field name as ID for now
  targetTableId: string;
  targetFieldId: string; // Using field name as ID for now
}
interface ViewDefinition { _id?: string; viewId: string; viewName: string; tables: ViewTableReference[]; relationships: Relationship[]; criteria: CriteriaRow[]; ownerDID: string; createdTimestamp: number; lastModifiedTimestamp: number; }


// --- Component State ---
const currentViewName = ref('');
const currentViewId = ref<string | null>(null);
const currentViewDbAddress = ref<string | null>(null);
const savingView = ref(false);
const loadingView = ref(false);

const loadViewDialog = ref(false);
const viewAddressToLoad = ref('');
const savedViews = ref<SavedViewInfo[]>([]);
const loadingSavedViews = ref(false);

const confirmDeleteDialog = ref(false);
const viewToDelete = ref<SavedViewInfo | null>(null);

const availableTablesInternal = ref<TableMetadata[]>([]); const loadingTables = ref(false);
const availableTablesForDisplay = computed(() => availableTablesInternal.value.map(tm => ({ id: tm.tableId, name: tm.tableName, fields: tm.schemaDefinition.map(f => ({ name: f.name, type: f.type })), originalMetadata: tm })));
async function loadUserTables(forceRefresh = false) { if (!authStore.isAuthenticated && !authStore.loading) { await authStore.login("DevUserEditorLoad"); if (!authStore.isAuthenticated) { console.error("Mock login failed for table load."); loadingTables.value = false; return; } } else if (authStore.loading) { return; } loadingTables.value = true; try { const tables = await getAllTableMetadata(); availableTablesInternal.value = tables; } catch (error) { console.error("Error loading tables:", error); availableTablesInternal.value = []; } finally { loadingTables.value = false; } }
async function registerSampleTables() { if (!authStore.currentUser?.did) { await authStore.login("DevUserSamplesReg"); if(!authStore.currentUser?.did) { alert("Login needed to register samples."); return; }} loadingTables.value = true; const owner = authStore.currentUser.did; const sTData: Omit<TableMetadata, 'ownerDID'|'createdTimestamp'|'description'>[] = [ {tableId:'cust',tableName:'Customers',orbitDBAddress:'custAddr',schemaDefinition:[{name:'ID',type:'string'},{name:'Name',type:'string'}]}, {tableId:'ord',tableName:'Orders',orbitDBAddress:'ordAddr',schemaDefinition:[{name:'OrderID',type:'string'},{name:'CustomerID',type:'string'}]}]; try { for(const tD of sTData){ const ex=await getTableMetadata(tD.tableId); if(!ex) await registerTable({...tD, ownerDID:owner,createdTimestamp:Date.now(), description: `Sample ${tD.tableName} table`});} await loadUserTables(true); } catch(e){console.error(e);}finally{loadingTables.value=false;} }

onMounted(async () => {
  let viewLoadedFromQuery = false;
  const addressFromQuery = route.query.loadAddress as string;
  if (addressFromQuery) {
    viewAddressToLoad.value = addressFromQuery;
    if (!authStore.isAuthenticated && !authStore.loading) { // Ensure auth is checked before load attempt
        console.log("ViewEditor: User not authenticated, attempting mock login for query param load...");
        await authStore.login("DevUserQueryLoad");
    }
    // Wait for auth if it was loading, or if login was just attempted
    if (authStore.loading) {
        const unwatchAuthLoading = watch(() => authStore.loading, async (isLoading) => {
            if (!isLoading && authStore.isAuthenticated) {
                await confirmLoadViewFromDialog();
                viewLoadedFromQuery = true;
                unwatchAuthLoading();
            } else if (!isLoading && !authStore.isAuthenticated) {
                alert("Authentication failed. Cannot load view from query parameter.");
                unwatchAuthLoading();
            }
        });
    } else if (authStore.isAuthenticated) {
        await confirmLoadViewFromDialog();
        viewLoadedFromQuery = true;
    } else {
         alert("Authentication required to load view from query parameter. Please log in.");
    }
  }

  // Load user tables if not already loaded by confirmLoadViewFromDialog (which calls loadUserTables)
  // and if user is authenticated or becomes authenticated.
  if (authStore.isAuthenticated) {
    if (!viewLoadedFromQuery || availableTablesInternal.value.length === 0) {
        loadUserTables();
    }
  } else {
    const unwatchUser = watch(() => authStore.currentUser, (newUser) => {
        if(newUser){
            if (!viewLoadedFromQuery || availableTablesInternal.value.length === 0) {
                loadUserTables();
            }
            unwatchUser();
        }
    }, {immediate: true});
  }
});

interface DesignedTableDisplay { id: string; name: string; fields: { name: string; type: string; }[]; x: number; y: number; originalMetadata?: TableMetadata; orbitDBAddress?: string; }
const designedTables = ref<DesignedTableDisplay[]>([]);
let tableCounter = 0;
const designSurfaceRef = ref<HTMLElement | null>(null);
const draggedTable = ref<DesignedTableDisplay | null>(null);
const dragOffsetX = ref(0); const dragOffsetY = ref(0);
const draggedTableIndex = ref(-1);

// --- Line Drawing & Relationship Management State ---
// This section manages the UI and state for creating, displaying, and deleting visual table relationships.
// The overall flow is:
// 1. User mousedowns on a 'field-port' of a table.
// 2. `handlePortMouseDown` initiates drawing mode (`isDrawingLine = true`), records the source port.
// 3. Global mousemove (`handleGlobalMouseMove`) updates the end coordinates of a temporary line.
// 4. Global mouseup (`handleGlobalMouseUp`) finalizes the line:
//    - If dropped on a valid target port, a `Relationship` object is created and added to `drawnRelationships`.
//    - Drawing mode is reset.
// 5. The `linesToRender` computed property calculates screen coordinates for all relationships in `drawnRelationships`.
// 6. An SVG overlay renders these lines. Lines can be clicked (`handleRelationshipLineClick`) to select them.
// 7. Selected lines can be deleted using the Delete/Backspace key (`handleDeleteKey`).

/** Indicates if a relationship line is currently being drawn by the user. */
const isDrawingLine = ref(false);

/** Stores information about the source port (table ID, field ID, and initial screen coordinates) when a line drawing starts. */
interface LinePortInfo { tableId: string; fieldId: string; x: number; y: number; }
const lineSource = ref<LinePortInfo | null>(null);

/** Stores the screen coordinates (relative to the SVG canvas) of the source port for the line currently being drawn. */
const lineSourceCoords = ref<{x: number, y: number} | null>(null);

/** Stores the current mouse coordinates (relative to the SVG canvas) for the end point of the line being drawn. */
const currentLineEnd = ref<{ x: number, y: number } | null>(null);

/** Array holding all successfully drawn (and loaded) Relationship objects. This is persisted with the view definition. */
const drawnRelationships = ref<Relationship[]>([]);

/** Stores the ID of the currently selected relationship line, or null if no line is selected. Used for deletion and visual highlighting. */
const selectedRelationshipId = ref<string | null>(null);

function handleTableDragStart(event: DragEvent, table: DesignedTableDisplay, index: number) {
  selectedRelationshipId.value = null; // Deselect any selected relationship line when starting to drag a table.
  event.dataTransfer?.setData('text/plain', table.id);
  draggedTable.value = table;
  draggedTableIndex.value = index;
  const tableElement = document.getElementById('designed_table_' + table.id.replace(/[^a-zA-Z0-9]/g, '_'));
  if (tableElement) {
    const rect = tableElement.getBoundingClientRect();
    dragOffsetX.value = event.clientX - rect.left;
    dragOffsetY.value = event.clientY - rect.top;
  }
}
function handleDragOver(event: DragEvent) { event.preventDefault(); }
function handleDropOnSurface(event: DragEvent) {
   if (draggedTable.value && designSurfaceRef.value) {
    const surfaceRect = designSurfaceRef.value.getBoundingClientRect();
    const newX = event.clientX - surfaceRect.left - dragOffsetX.value;
    const newY = event.clientY - surfaceRect.top - dragOffsetY.value;
    const tableToMove = designedTables.value.find(t => t.id === draggedTable.value!.id);
    if (tableToMove) {
      tableToMove.x = Math.max(0, newX);
      tableToMove.y = Math.max(0, newY);
    }
  }
  draggedTable.value = null;
  draggedTableIndex.value = -1;
}
function handleTableDragEnd(event: DragEvent) {
   if (draggedTable.value && designSurfaceRef.value) {
    const surfaceRect = designSurfaceRef.value.getBoundingClientRect();
    const newX = event.clientX - surfaceRect.left - dragOffsetX.value;
    const newY = event.clientY - surfaceRect.top - dragOffsetY.value;
    const tableToMove = designedTables.value.find(t => t.id === draggedTable.value!.id);
    if (tableToMove) {
      tableToMove.x = Math.max(0, newX);
      tableToMove.y = Math.max(0, newY);
    }
  }
  draggedTable.value = null;
  draggedTableIndex.value = -1;
}
const addTableToDesign = (table: any) => { if (!designedTables.value.find(t => t.id === table.id)) { designedTables.value.push({ ...table, orbitDBAddress: table.originalMetadata?.orbitDBAddress, x: (tableCounter % 3) * 240 + 20, y: Math.floor(tableCounter / 3) * 180 + 20 }); tableCounter++; table.fields.forEach((field:any) => { if (!criteriaGridRowData.value.find(r => r.field === field.name && r.table === table.name)) { criteriaGridRowData.value.push({ field: field.name, table: table.name, output: true, sort: '', filter: '', group: false, alias: '' }); } }); } };

const criteriaGridColDefs = ref([ { headerName: 'Output', field: 'output', cellRenderer: 'checkbox', width:100 }, { headerName: 'Field', field: 'field' }, { headerName: 'Table', field: 'table' }, { headerName: 'Alias', field: 'alias', editable: true }, { headerName: 'Sort', field: 'sort', width:120 }, { headerName: 'Filter', field: 'filter', editable: true }, { headerName: 'Group By', field: 'group', cellRenderer: 'checkbox', width:100 } ]);
const criteriaGridRowData = ref<CriteriaRow[]>([]);
function handleCriteriaGridChange(event: any) { /* ... */ }

async function handleSaveView() {
  if (!authStore.currentUser?.did || !currentViewName.value) { alert("User not authenticated or view name is missing."); return; }
  savingView.value = true;
  let viewDefinition: ViewDefinition | null = null;
  try {
    const viewIdForSave = currentViewId.value || `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const isNewView = !currentViewId.value;
    const createdTs = isNewView ? Date.now() : (await getMinimalViewDefinitionForTimestamp(currentViewDbAddress.value))?.createdTimestamp || Date.now();
    // Include drawnRelationships in the view definition
    viewDefinition = { viewId: viewIdForSave, viewName: currentViewName.value, tables: designedTables.value.map(dt => ({ tableId: dt.id, orbitDBAddress: dt.orbitDBAddress || dt.originalMetadata?.orbitDBAddress || '', name: dt.name, alias: '', x: dt.x, y: dt.y })), relationships: drawnRelationships.value, criteria: criteriaGridRowData.value.map(cr => ({...cr})), ownerDID: authStore.currentUser.did, createdTimestamp: createdTs, lastModifiedTimestamp: Date.now(), };
    if (!isNewView && currentViewId.value) viewDefinition._id = currentViewId.value; // Preserve existing OrbitDB document _id
    const dbNameForView = currentViewDbAddress.value || `gridable-viewdef-${viewDefinition.viewId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const acOptions = { type: CustomDIDAccessController.type, write: [authStore.currentUser.did], admin: [authStore.currentUser.did], verificationFunction: mockDidVerificationFunction };
    const viewDb = await getDocumentStoreDatabase(dbNameForView, acOptions);
    const docId = await putDocument(viewDb, viewDefinition); // putDocument will update if _id exists, or insert if new
    currentViewId.value = viewDefinition._id || viewDefinition.viewId; // Use existing _id or generated viewId
    currentViewDbAddress.value = viewDb.address.toString();
    if (currentViewId.value && currentViewName.value && currentViewDbAddress.value && authStore.currentUser?.did && viewDefinition) {
      const savedViewEntry: SavedViewInfo = { viewId: currentViewId.value, viewName: currentViewName.value, viewAddress: currentViewDbAddress.value, createdTimestamp: viewDefinition.createdTimestamp, lastAccessedTimestamp: viewDefinition.lastModifiedTimestamp, description: "" };
      await addSavedView(savedViewEntry); console.log("View details added/updated in user's saved views manifest.");
    }
    if (currentViewDbAddress.value) { navigator.clipboard.writeText(currentViewDbAddress.value).then(() => alert(`View '${currentViewName.value}' saved! DB Address copied: ${currentViewDbAddress.value}`)).catch(err => alert(`View '${currentViewName.value}' saved! DB Address: ${currentViewDbAddress.value} (copy manually)`)); }
  } catch (error) { console.error("Error saving view:", error); alert("Failed to save. See console."); }
  finally { savingView.value = false; }
}

async function getMinimalViewDefinitionForTimestamp(dbAddress: string | null): Promise<{ createdTimestamp: number } | null> { if (!dbAddress) return null; try { const db = await getDocumentStoreDatabase(dbAddress); const docs = await db.all(); if (docs.length > 0 && docs[0].value) return docs[0].value; return null; } catch (error) { console.error("Error getting minimal view def for timestamp:", error); return null; } }
async function openLoadViewDialog() { viewAddressToLoad.value = ''; loadViewDialog.value = true; loadingSavedViews.value = true; try { savedViews.value = await listSavedViews(); } catch (error) { console.error("Error loading saved views list:", error); savedViews.value = []; alert("Could not load your saved views list."); } finally { loadingSavedViews.value = false; } }
function selectViewToLoad(view: SavedViewInfo) { viewAddressToLoad.value = view.viewAddress; }

async function confirmLoadViewFromDialog() {
  if (!viewAddressToLoad.value) { alert("Please select or enter a view address."); return; }
  loadingView.value = true; loadViewDialog.value = false;
  try {
    const db = await getDocumentStoreDatabase(viewAddressToLoad.value); // AC options are for write, read is usually public or handled by OrbitDB
    const results = await db.all(); // OrbitDB doc stores return array of { hash, key, value }
    if (results && results.length > 0 && results[0].value) {
      const loadedDef = results[0].value as ViewDefinition;
      currentViewName.value = loadedDef.viewName;
      currentViewId.value = loadedDef._id || loadedDef.viewId;
      currentViewDbAddress.value = viewAddressToLoad.value;
      await loadUserTables(true); // Ensure tables are loaded to resolve field metadata
      designedTables.value = loadedDef.tables.map(t => { const oMD = availableTablesInternal.value.find(at => at.tableId === t.tableId); return {id:t.tableId, name:t.name, fields:oMD?.schemaDefinition.map(f=>({name:f.name,type:f.type}))||[], x:t.x,y:t.y,orbitDBAddress:t.orbitDBAddress,originalMetadata:oMD}; });
      tableCounter = designedTables.value.length;
      criteriaGridRowData.value = loadedDef.criteria.map(c=>({...c}));
      drawnRelationships.value = loadedDef.relationships || []; // Load relationships
      if (authStore.currentUser?.did && currentViewId.value) {
        const existingSavedView = await getSavedView(currentViewId.value);
        if (existingSavedView) { await addSavedView({ ...existingSavedView, viewName: loadedDef.viewName, viewAddress: currentViewDbAddress.value, lastAccessedTimestamp: Date.now() }); }
        else { await addSavedView({ viewId: currentViewId.value, viewName: loadedDef.viewName, viewAddress: currentViewDbAddress.value, createdTimestamp: loadedDef.createdTimestamp, lastAccessedTimestamp: Date.now() }); }
      }
      alert(`View '${loadedDef.viewName}' loaded successfully!`);
    } else { alert("Could not find a view definition at the provided address, or it was empty."); }
  } catch (error) { console.error("Error loading view:", error); alert("Failed to load view."); }
  finally { loadingView.value = false; viewAddressToLoad.value = ''; }
}

function confirmDeleteSavedView(view: SavedViewInfo) { viewToDelete.value = view; confirmDeleteDialog.value = true; }
async function executeDeleteSavedView() { if (viewToDelete.value) { try { await removeSavedView(viewToDelete.value.viewId); savedViews.value = await listSavedViews(); alert(`View '${viewToDelete.value.viewName}' removed from your saved list.`); } catch (error) { console.error("Error removing saved view:", error); alert("Failed to remove view from list."); } } confirmDeleteDialog.value = false; viewToDelete.value = null; }
const copyToClipboard = (text: string | null) => { if(text) { navigator.clipboard.writeText(text).then(() => alert('Address copied!')).catch(()=> alert('Failed to copy.'));}};
function getFieldIcon(fieldType: string): string { switch (fieldType?.toLowerCase()) { case 'string': return 'mdi-format-text'; case 'number': return 'mdi-numeric'; case 'boolean': return 'mdi-toggle-switch-outline'; case 'date': return 'mdi-calendar'; default: return 'mdi-help-circle-outline'; } }
const sortedSavedViews = computed(() => { return [...savedViews.value].sort((a, b) => (b.lastAccessedTimestamp || b.createdTimestamp) - (a.lastAccessedTimestamp || a.createdTimestamp)); });

// --- Line Drawing Logic ---
const getPortElement = (tableId: string, fieldId: string): HTMLElement | null => {
  const safeTableId = `designed_table_${tableId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const tableElement = document.getElementById(safeTableId);
  return tableElement?.querySelector(`.field-port[data-table-id="${tableId}"][data-field-name="${fieldId}"]`) as HTMLElement | null;
};

/**
 * Calculates the precise center coordinates of a field's connection port relative to the design surface.
 * This is essential for accurately drawing SVG lines that connect to these ports,
 * especially when tables are moved or the view is scrolled.
 *
 * @param {string} tableId - The ID of the table containing the field.
 * @param {string} fieldName - The name of the field (used as its ID within the port's data attributes).
 * @returns {{ x: number, y: number } | null} The {x, y} coordinates of the port's center relative
 *                                            to the design surface, or null if the port or surface cannot be found.
 */
const calculatePortCenter = (tableId: string, fieldName: string): { x: number, y: number } | null => {
  if (!designSurfaceRef.value) return null; // Ensure design surface ref is available

  // Construct the DOM ID for the table element and find the specific port element within it.
  // Field ports are identified by data attributes `data-table-id` and `data-field-name`.
  const portEl = getPortElement(tableId, fieldName);
  if (!portEl) {
    // console.warn(`Port element not found for table ${tableId}, field ${fieldName}`);
    return null;
  }

  // Get the bounding rectangles of the design surface and the port.
  // These provide position and size information relative to the viewport.
  const surfaceRect = designSurfaceRef.value.getBoundingClientRect();
  const portRect = portEl.getBoundingClientRect();

  // Calculate the center of the port.
  // Then, adjust these coordinates to be relative to the design surface's top-left corner.
  const x = portRect.left + portRect.width / 2 - surfaceRect.left;
  const y = portRect.top + portRect.height / 2 - surfaceRect.top;
  return { x, y };
};

/**
 * A computed property that transforms the `drawnRelationships` data into a format suitable for rendering SVG lines.
 * For each relationship, it calculates the current screen coordinates of its source and target field ports
 * using `calculatePortCenter`. This ensures lines dynamically update when tables are moved.
 * It filters out any relationships for which port coordinates couldn't be determined (e.g., if a table/field was removed).
 *
 * The lines also include an 'id' for keying in v-for and for click handling to select/deselect lines.
 * An invisible wider line is rendered first for each relationship to improve clickability, followed by the visible line.
 * The visible line's appearance (stroke, stroke-width) changes if it's selected.
 */
const linesToRender = computed(() => {
  return drawnRelationships.value.map(rel => {
    const sourcePos = calculatePortCenter(rel.sourceTableId, rel.sourceFieldId);
    const targetPos = calculatePortCenter(rel.targetTableId, rel.targetFieldId);
    if (sourcePos && targetPos) {
      // Return all necessary info for rendering, including original relationship ID
      return { id: rel.id, x1: sourcePos.x, y1: sourcePos.y, x2: targetPos.x, y2: targetPos.y };
    }
    return null; // If any port cannot be found, this relationship won't be rendered.
  }).filter(line => line !== null) as { id: string, x1: number, y1: number, x2: number, y2: number }[];
});


/**
 * Handles the mousedown event on a field port to initiate line drawing for a new relationship.
 * - Sets `isDrawingLine` to true.
 * - Records the source port's table ID, field ID, and initial screen coordinates.
 * - Sets up global mousemove and mouseup listeners on the document to track the mouse
 *   and finalize or cancel the line drawing.
 * - Deselects any currently selected relationship line.
 *
 * @param {MouseEvent} event - The mousedown event.
 * @param {DesignedTableDisplay} table - The table object containing the source field.
 * @param {DesignedTableField} field - The field object that is the source of the new line.
 */
const handlePortMouseDown = (event: MouseEvent, table: DesignedTableDisplay, field: DesignedTableField) => {
  event.preventDefault();
  selectedRelationshipId.value = null; // Deselect any selected line when starting a new one.
  if (!designSurfaceRef.value) return;

  isDrawingLine.value = true;
  const portEl = event.currentTarget as HTMLElement;
  const surfaceRect = designSurfaceRef.value.getBoundingClientRect();
  const portRect = portEl.getBoundingClientRect();

  const initialX = portRect.left + portRect.width / 2 - surfaceRect.left;
  const initialY = portRect.top + portRect.height / 2 - surfaceRect.top;

  lineSource.value = { tableId: table.id, fieldId: field.name, x: initialX, y: initialY };
  lineSourceCoords.value = {x: initialX, y: initialY };
  currentLineEnd.value = { x: initialX, y: initialY };

  document.addEventListener('mousemove', handleGlobalMouseMove);
  document.addEventListener('mouseup', handleGlobalMouseUp);
};

/**
 * Handles the global mousemove event when a line is being drawn.
 * Updates the `currentLineEnd` coordinates based on the mouse position relative to the design surface.
 *
 * @param {MouseEvent} event - The mousemove event.
 */
const handleGlobalMouseMove = (event: MouseEvent) => {
  if (isDrawingLine.value && designSurfaceRef.value) {
    const surfaceRect = designSurfaceRef.value.getBoundingClientRect();
    currentLineEnd.value = {
      x: event.clientX - surfaceRect.left,
      y: event.clientY - surfaceRect.top,
    };
  }
};

/**
 * Handles the global mouseup event to finalize or cancel line drawing.
 * If the mouse is released over a valid target field port (different table or different field on the same table),
 * a new `Relationship` object is created and added to `drawnRelationships`.
 * Otherwise, the line drawing is cancelled.
 * Resets all drawing-related state variables and removes global mouse listeners.
 *
 * @param {MouseEvent} event - The mouseup event.
 */
const handleGlobalMouseUp = (event: MouseEvent) => {
  if (isDrawingLine.value && lineSource.value) {
    const targetElement = event.target as HTMLElement;
    // Check if the mouse is released over a '.field-port' element.
    const targetPort = targetElement.classList.contains('field-port') ? targetElement : targetElement.closest('.field-port');

    if (targetPort) {
      const targetTableId = targetPort.getAttribute('data-table-id');
      const targetFieldId = targetPort.getAttribute('data-field-name');

      // Ensure target is valid (exists and is not the same as the source port).
      if (targetTableId && targetFieldId &&
          (targetTableId !== lineSource.value.tableId || targetFieldId !== lineSource.value.fieldId)) {
        const newRelationship: Relationship = {
          id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, // Simple unique ID
          sourceTableId: lineSource.value.tableId,
          sourceFieldId: lineSource.value.fieldId,
          targetTableId: targetTableId,
          targetFieldId: targetFieldId,
        };
        // Prevent adding exact duplicate or inverse duplicate relationships.
        const exists = drawnRelationships.value.some(r =>
            (r.sourceTableId === newRelationship.sourceTableId && r.sourceFieldId === newRelationship.sourceFieldId && r.targetTableId === newRelationship.targetTableId && r.targetFieldId === newRelationship.targetFieldId) ||
            (r.sourceTableId === newRelationship.targetTableId && r.sourceFieldId === newRelationship.targetFieldId && r.targetTableId === newRelationship.sourceTableId && r.targetFieldId === newRelationship.sourceFieldId)
        );
        if (!exists) {
            drawnRelationships.value.push(newRelationship);
        } else {
            console.warn("Relationship already exists or is inverse of existing.");
        }
      } else {
        console.log("Line dropped on invalid target (same port or missing attributes).");
      }
    } else {
      console.log("Line dropped on non-port area, drawing cancelled.");
    }
  }
  // Reset drawing state regardless of outcome.
  isDrawingLine.value = false;
  lineSource.value = null;
  lineSourceCoords.value = null;
  currentLineEnd.value = null;
  document.removeEventListener('mousemove', handleGlobalMouseMove);
  document.removeEventListener('mouseup', handleGlobalMouseUp);
};

/**
 * Handles clicks on rendered relationship lines in the SVG.
 * Toggles the selection state of the clicked line. If the clicked line is already selected,
 * it deselects it. Otherwise, it sets it as the `selectedRelationshipId`.
 *
 * @param {string} relationshipId - The ID of the relationship line that was clicked.
 */
const handleRelationshipLineClick = (relationshipId: string) => {
  if (selectedRelationshipId.value === relationshipId) {
    selectedRelationshipId.value = null; // Toggle deselect
  } else {
    selectedRelationshipId.value = relationshipId;
  }
};

/**
 * Deselects any currently selected relationship line if a click occurs on the
 * background of the SVG canvas (i.e., not on a specific line).
 * @param {MouseEvent} event - The click event on the SVG canvas.
 */
const deselectRelationshipLine = (event: MouseEvent) => {
  if ((event.target as SVGSVGElement)?.classList?.contains('relationship-lines-svg')) {
    selectedRelationshipId.value = null;
  }
};

/**
 * Handles keyboard events, specifically looking for 'Delete' or 'Backspace' keys
 * to delete a currently selected relationship line.
 * If a line is selected and one of these keys is pressed, the relationship is removed
 * from the `drawnRelationships` array, and the selection is cleared.
 *
 * @param {KeyboardEvent} event - The keyboard event.
 */
const handleDeleteKey = (event: KeyboardEvent) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedRelationshipId.value) {
      event.preventDefault(); // Important to prevent browser back navigation on Backspace.
      const index = drawnRelationships.value.findIndex(r => r.id === selectedRelationshipId.value);
      if (index !== -1) {
        drawnRelationships.value.splice(index, 1);
        console.log("Deleted relationship:", selectedRelationshipId.value);
      }
      selectedRelationshipId.value = null; // Deselect after deletion.
    }
  }
};

// Watch for changes in `designedTables` (e.g., when tables are moved).
// When tables move, their field port coordinates change, so lines need to be re-calculated.
// The `linesToRender` computed property handles this automatically by re-calling `calculatePortCenter`.
// A `nextTick` ensures DOM updates (table positions) are flushed before recalculations.
watch(designedTables, async () => {
  await nextTick();
}, { deep: true });

onMounted(() => {
  // ... existing onMounted logic ...
  // Add global listener for the delete key when component is mounted.
  window.addEventListener('keydown', handleDeleteKey);
});

onUnmounted(() => {
  // ... existing onUnmounted logic ...
  // Remove global listener for the delete key when component is unmounted.
  window.removeEventListener('keydown', handleDeleteKey);
  // Clean up any residual global mouse listeners from line drawing if the component
  // is destroyed while a line is being drawn (edge case).
  document.removeEventListener('mousemove', handleGlobalMouseMove);
  document.removeEventListener('mouseup', handleGlobalMouseUp);
});

// Ensure all condensed functions are present for completeness
// These were empty placeholders, their actual logic for table dragging would be more involved.
// For now, keeping them simple as the focus is on line drawing.
// const handleTableDragStart = (event: DragEvent, table: DesignedTableDisplay, index: number) => {
//   selectedRelationshipId.value = null; // Deselect line when dragging table
//   // Basic drag data, actual repositioning on dragEnd or via a library
//   event.dataTransfer?.setData('text/plain', table.id);
//   draggedTable.value = table;
//   draggedTableIndex.value = index;
//   const tableElement = document.getElementById('designed_table_' + table.id.replace(/[^a-zA-Z0-9]/g, '_'));
//   if (tableElement) {
//     const rect = tableElement.getBoundingClientRect();
//     dragOffsetX.value = event.clientX - rect.left;
//     dragOffsetY.value = event.clientY - rect.top;
//   }
// };
// const handleDropOnSurface = (event: DragEvent) => {
//    if (draggedTable.value && designSurfaceRef.value) {
//     const surfaceRect = designSurfaceRef.value.getBoundingClientRect();
//     const newX = event.clientX - surfaceRect.left - dragOffsetX.value;
//     const newY = event.clientY - surfaceRect.top - dragOffsetY.value;

//     const tableToMove = designedTables.value.find(t => t.id === draggedTable.value!.id);
//     if (tableToMove) {
//       tableToMove.x = Math.max(0, newX); // Prevent dragging outside bounds (simple example)
//       tableToMove.y = Math.max(0, newY);
//     }
//   }
//   draggedTable.value = null;
//   draggedTableIndex.value = -1;
// };
// const handleTableDragEnd = (event: DragEvent) => {
//   // This is where you'd typically update the table's x, y in designedTables
//   // if not using a more sophisticated drag library or approach.
//   // The handleDropOnSurface example above is one way to handle it.
//    if (draggedTable.value && designSurfaceRef.value) {
//     const surfaceRect = designSurfaceRef.value.getBoundingClientRect();
//     const newX = event.clientX - surfaceRect.left - dragOffsetX.value;
//     const newY = event.clientY - surfaceRect.top - dragOffsetY.value;

//     const tableToMove = designedTables.value.find(t => t.id === draggedTable.value!.id);
//     if (tableToMove) {
//       tableToMove.x = Math.max(0, newX);
//       tableToMove.y = Math.max(0, newY);
//     }
//   }
//   draggedTable.value = null;
//   draggedTableIndex.value = -1;
// };
const handleCriteriaGridChange = (event: any) => {};


</script>

<style scoped>
.view-editor-container { height: calc(100vh - 64px); display: flex; flex-direction: column; }
.editor-panes { flex-grow: 1; min-height: 300px; }
.design-surface { position: relative; border: 1px dashed #ccc; min-height: 400px; overflow: auto; /* Changed from hidden to auto/scroll if tables can move freely */ }
.designed-table-representation { position: absolute; background-color: white; border: 1px solid #aeaeae; padding: 10px; width: 220px; user-select: none; z-index: 10; } /* Added z-index */
.designed-table-representation strong { display: block; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;}
.designed-table-representation ul.field-list { list-style-type: none; padding-left: 0; margin-top: 5px; font-size: 0.9em; max-height: 150px; overflow-y: auto;}
.designed-table-representation ul.field-list li.field-item {
  padding: 3px 0;
  display: flex;
  align-items: center;
  position: relative; /* For port positioning */
}
.field-port {
  width: 10px;
  height: 10px;
  background-color: #ddd;
  border: 1px solid #999;
  border-radius: 50%;
  position: absolute;
  right: -5px; /* Position to the right of the field item */
  top: 50%;
  transform: translateY(-50%);
  cursor: crosshair;
  z-index: 11;
}
.field-port:hover {
  background-color: #bbb;
}
.fill-height { height: 100%; }

.relationship-lines-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* pointer-events: none; SVG itself needs clicks for deselect, line groups for select */
  z-index: 5;
}
.relationship-line-group {
  /* pointer-events: all; /* This would make only the line clickable, not the transparent wider line */
  /* The transparent line handles the click event due to being drawn first in the group */
}


</style>
