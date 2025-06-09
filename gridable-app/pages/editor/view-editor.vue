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
          <v-btn @click="loadUserTables(true)" :loading="loadingTables" small class="mr-2">Refresh Tables</v-btn>
          <v-btn @click="handleLoadView" small class="mr-2" :disabled="!authStore.isAuthenticated">Load View</v-btn>
          <v-btn @click="handleSaveView" color="primary" prepend-icon="mdi-content-save" :disabled="designedTables.length === 0 || !currentViewName || !authStore.isAuthenticated" :loading="savingView">
            Save View
          </v-btn>
          <!-- Share button removed for now, can be re-added -->
        </div>
      </v-col>
      <v-col cols="12" class="pt-0">
         <p class="text-caption" v-if="currentViewDbAddress">
            Current View DB Address: {{ currentViewDbAddress }} (Copied to clipboard on save)
          </p>
      </v-col>
    </v-row>

    <!-- Load View Dialog -->
    <v-dialog v-model="loadViewDialog" max-width="500px">
      <v-card>
        <v-card-title>Load View from OrbitDB Address</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="viewAddressToLoad"
            label="OrbitDB View Address"
            placeholder="Enter the full OrbitDB address of the view"
          ></v-text-field>
          <p class="text-caption">For now, manually paste a previously saved view address.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="loadViewDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="confirmLoadView" :disabled="!viewAddressToLoad">Load</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-row class="editor-panes mt-2">
      <!-- Pane 1: Available Tables -->
      <v-col cols="12" md="3" class="tables-pane">
        <v-card class="fill-height">
          <v-card-title>Available Tables</v-card-title>
          <v-card-text>
            <div v-if="loadingTables" class="text-center pa-4"><v-progress-circular indeterminate></v-progress-circular></div>
            <v-list dense v-else-if="availableTablesForDisplay.length > 0">
              <v-list-item v-for="table in availableTablesForDisplay" :key="table.id" @click="() => addTableToDesign(table)" link>
                <v-list-item-title :title="table.id">{{ table.name }}</v-list-item-title>
              </v-list-item>
            </v-list>
            <p v-else class="text-caption pa-3">No tables. <v-btn small variant="text" @click="registerSampleTables" :loading="loadingTables">Register Samples</v-btn></p>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Pane 2: Visual Design Surface -->
      <v-col cols="12" md="9" class="design-surface-pane">
        <v-card class="fill-height">
          <v-card-title>View Design Surface</v-card-title>
          <v-card-text class="design-surface" ref="designSurfaceRef" @dragover.prevent="handleDragOver" @drop.prevent="handleDropOnSurface">
            <div v-for="(table, index) in designedTables" :key="table.id" :id="'designed_table_' + table.id.replace(/[^a-zA-Z0-9]/g, '_')"
              class="designed-table-representation" :style="{ top: table.y + 'px', left: table.x + 'px', cursor: 'grab' }"
              draggable="true" @dragstart="event => handleTableDragStart(event, table, index)" @dragend="handleTableDragEnd">
              <strong>{{ table.name }}</strong>
               <ul class="field-list">
                <li v-for="field in table.fields" :key="field.name">
                  <v-icon size="x-small" class="mr-1">{{ getFieldIcon(field.type) }}</v-icon>
                  {{ field.name }}
                  <span class="text-caption grey--text">({{ field.type }})</span>
                </li>
              </ul>
            </div>
            <p class="text-h6 text-center grey--text" v-if="designedTables.length === 0 && !draggedTable">Add tables to design.</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="criteria-pane-row mt-4">
      <!-- Pane 3: Criteria Grid -->
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
import { ref, onMounted, computed, watch } from 'vue';
import GridableGrid from '~/components/core/GridableGrid.vue';
import { useAuthStore } from '~/store/auth';
import { getAllTableMetadata, registerTable, getTableMetadata, type TableMetadata, type TableFieldSchema } from '~/services/userPreferences';
// Import OrbitDB document store functions
import { getDocumentStoreDatabase, putDocument, getDocumentById as getOrbitDocById } from '~/services/orbitdb';

const authStore = useAuthStore();

// --- View Definition Interface ---
interface ViewTableReference {
  tableId: string;
  orbitDBAddress: string;
  name: string;
  alias?: string;
  x: number;
  y: number;
}
interface CriteriaRow { // Re-defining or ensuring it's compatible
  field: string; table: string; alias?: string; output: boolean; sort?: 'asc' | 'desc' | ''; filter?: string; group?: boolean;
}
interface ViewDefinition {
  _id?: string;
  viewId: string;
  viewName: string;
  tables: ViewTableReference[];
  relationships: any[];
  criteria: CriteriaRow[];
  ownerDID: string;
  createdTimestamp: number;
  lastModifiedTimestamp: number;
}

// --- Component State ---
const currentViewName = ref('');
const currentViewId = ref<string | null>(null);
const currentViewDbAddress = ref<string | null>(null);
const savingView = ref(false);
const loadingView = ref(false);

const loadViewDialog = ref(false);
const viewAddressToLoad = ref('');


// --- Available Tables (condensed) ---
const availableTablesInternal = ref<TableMetadata[]>([]);
const loadingTables = ref(false);
const availableTablesForDisplay = computed(() => availableTablesInternal.value.map(tm => ({ id: tm.tableId, name: tm.tableName, fields: tm.schemaDefinition.map(f => ({ name: f.name, type: f.type })), originalMetadata: tm })));
async function loadUserTables(forceRefresh = false) { if (!authStore.isAuthenticated && !authStore.loading) { await authStore.login("DevUserEditorLoad"); if (!authStore.isAuthenticated) { console.error("Mock login failed for table load."); loadingTables.value = false; return; } } else if (authStore.loading) { return; } loadingTables.value = true; try { const tables = await getAllTableMetadata(); availableTablesInternal.value = tables; } catch (error) { console.error("Error loading tables:", error); availableTablesInternal.value = []; } finally { loadingTables.value = false; } }
async function registerSampleTables() { if (!authStore.currentUser?.did) { await authStore.login("DevUserSamplesReg"); if(!authStore.currentUser?.did) { alert("Login needed to register samples."); return; }} loadingTables.value = true; const owner = authStore.currentUser.did; const sTData: Omit<TableMetadata, 'oDID'|'cTS'>[] = [ {tId:'cust', tN:'Cust', oA:'custAddr', sch:[{n:'ID',t:'s'}]}, {tId:'ord', tN:'Ord',oA:'ordAddr',sch:[{n:'OID',t:'s'}]}]; try { for(const tD of sTData){ const ex=await getTableMetadata(tD.tableId); if(!ex) await registerTable({...tD, ownerDID:owner,createdTimestamp:Date.now()});} await loadUserTables(true); } catch(e){console.error(e);}finally{loadingTables.value=false;} }
onMounted(() => { if (authStore.isAuthenticated) { loadUserTables(); } else { const unW = watch(() => authStore.currentUser, (nu) => { if(nu){ loadUserTables(); unW(); } }, {immediate: true}); } });

// --- Visual Design Surface (condensed) ---
interface DesignedTableDisplay { id: string; name: string; fields: { name: string; type: string; }[]; x: number; y: number; originalMetadata?: TableMetadata; orbitDBAddress?: string; }
const designedTables = ref<DesignedTableDisplay[]>([]);
let tableCounter = 0;
const designSurfaceRef = ref<HTMLElement | null>(null);
const draggedTable = ref<DesignedTableDisplay | null>(null);
const dragOffsetX = ref(0); const dragOffsetY = ref(0); const draggedTableIndex = ref(-1);
function handleTableDragStart(event: DragEvent, table: DesignedTableDisplay, index: number) { draggedTable.value = table; draggedTableIndex.value = index; const el = document.getElementById('designed_table_' + table.id.replace(/[^a-zA-Z0-9]/g, '_')); if(el){const r=el.getBoundingClientRect(); dragOffsetX.value=event.clientX-r.left; dragOffsetY.value=event.clientY-r.top;} else {dragOffsetX.value=event.offsetX; dragOffsetY.value=event.offsetY;} if(event.dataTransfer){event.dataTransfer.effectAllowed='move'; event.dataTransfer.setData('text/plain',table.id);} if(event.target && event.target instanceof HTMLElement) event.target.style.cursor='grabbing'; }
function handleDragOver(event: DragEvent) { event.preventDefault(); }
function handleDropOnSurface(event: DragEvent) { event.preventDefault(); if (draggedTable.value && draggedTableIndex.value !== -1 && designSurfaceRef.value) { const sR = designSurfaceRef.value.getBoundingClientRect(); let nX = event.clientX - sR.left - dragOffsetX.value; let nY = event.clientY - sR.top - dragOffsetY.value; const tE = document.getElementById('designed_table_' + draggedTable.value.id.replace(/[^a-zA-Z0-9]/g, '_')); const tW = tE?.offsetWidth||220; const tH = tE?.offsetHeight||150; nX=Math.max(0,Math.min(nX,sR.width-tW)); nY=Math.max(0,Math.min(nY,sR.height-tH)); const tU = designedTables.value[draggedTableIndex.value]; if(tU){tU.x=nX; tU.y=nY;} } }
function handleTableDragEnd(event: DragEvent) { if(event.target && event.target instanceof HTMLElement) event.target.style.cursor='grab'; draggedTable.value=null;draggedTableIndex.value=-1;dragOffsetX.value=0;dragOffsetY.value=0; }

const addTableToDesign = (table: {id: string, name: string, fields: {name: string, type: string}[], originalMetadata?: TableMetadata}) => {
  if (!designedTables.value.find(t => t.id === table.id)) {
    designedTables.value.push({
      ...table,
      orbitDBAddress: table.originalMetadata?.orbitDBAddress,
      x: (tableCounter % 3) * 240 + 20, y: Math.floor(tableCounter / 3) * 180 + 20
    });
    tableCounter++;
    table.fields.forEach(field => {
      if (!criteriaGridRowData.value.find(r => r.field === field.name && r.table === table.name)) {
        criteriaGridRowData.value.push({ field: field.name, table: table.name, output: true, sort: '', filter: '', group: false, alias: '' });
      }
    });
  }
};

// --- Criteria Grid (condensed) ---
const criteriaGridColDefs = ref([ { headerName: 'Output', field: 'output', cellRenderer: 'checkbox', width:100 }, { headerName: 'Field', field: 'field' }, { headerName: 'Table', field: 'table' }, { headerName: 'Alias', field: 'alias', editable: true }, { headerName: 'Sort', field: 'sort', width:120 }, { headerName: 'Filter', field: 'filter', editable: true }, { headerName: 'Group By', field: 'group', cellRenderer: 'checkbox', width:100 } ]);
const criteriaGridRowData = ref<CriteriaRow[]>([]);
function handleCriteriaGridChange(event: { row: CriteriaRow, field: string, newValue: any }) { console.log('Criteria change:', event); }

// --- Save View Logic ---
async function handleSaveView() {
  if (!authStore.currentUser?.did || !currentViewName.value) {
    alert("User not authenticated or view name is missing."); return;
  }
  savingView.value = true;
  try {
    const viewDefinition: ViewDefinition = {
      viewId: currentViewId.value || `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      viewName: currentViewName.value,
      tables: designedTables.value.map(dt => ({
        tableId: dt.id, orbitDBAddress: dt.orbitDBAddress || dt.originalMetadata?.orbitDBAddress || '', name: dt.name, alias: '', x: dt.x, y: dt.y,
      })),
      relationships: [],
      criteria: criteriaGridRowData.value.map(cr => ({...cr})),
      ownerDID: authStore.currentUser.did,
      createdTimestamp: currentViewId.value ? (await getLoadedViewDefinitionForTimestamp(currentViewDbAddress.value))?.createdTimestamp || Date.now() : Date.now(),
      lastModifiedTimestamp: Date.now(),
    };
    if(currentViewId.value) viewDefinition._id = currentViewId.value;

    const dbNameForView = currentViewDbAddress.value || `gridable-viewdef-${viewDefinition.viewId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    // TODO: Implement DID-based Access Control for the view definition DB
    const viewDb = await getDocumentStoreDatabase(dbNameForView /*, { accessController: { type: 'did', write: [authStore.currentUser.did] }} */);

    const docId = await putDocument(viewDb, viewDefinition);

    if (!viewDefinition._id && docId.startsWith('zd')) viewDefinition._id = docId; // If OrbitDB assigned an _id
    currentViewId.value = viewDefinition._id || viewDefinition.viewId;
    currentViewDbAddress.value = viewDb.address.toString();

    if (currentViewDbAddress.value) {
      navigator.clipboard.writeText(currentViewDbAddress.value)
        .then(() => alert(`View '${currentViewName.value}' saved! DB Address copied: ${currentViewDbAddress.value}`))
        .catch(err => alert(`View '${currentViewName.value}' saved! DB Address: ${currentViewDbAddress.value} (copy manually)`));
    } else {
       alert(`View '${currentViewName.value}' saved! (Could not get DB address for clipboard)`);
    }

  } catch (error) { console.error("Error saving view:", error); alert("Failed to save. See console."); }
  finally { savingView.value = false; }
}

async function getLoadedViewDefinitionForTimestamp(dbAddress: string | null): Promise<ViewDefinition | null> {
    if (!dbAddress) return null;
    try {
        const db = await getDocumentStoreDatabase(dbAddress);
        const docs = await db.all();
        return (docs.length > 0 ? docs[0] : null) as ViewDefinition | null;
    } catch (error) { console.error("Error fetching view for timestamp:", error); return null; }
}

// --- Load View Logic ---
function handleLoadView() { loadViewDialog.value = true; }

async function confirmLoadView() {
  if (!viewAddressToLoad.value) { alert("Please enter a view OrbitDB address."); return; }
  loadingView.value = true; loadViewDialog.value = false;
  try {
    const db = await getDocumentStoreDatabase(viewAddressToLoad.value);
    const results = await db.all();

    if (results && results.length > 0) {
      const loadedDef = results[0] as ViewDefinition;

      currentViewName.value = loadedDef.viewName;
      currentViewId.value = loadedDef._id || loadedDef.viewId;
      currentViewDbAddress.value = viewAddressToLoad.value;

      await loadUserTables(true); // Ensure availableTablesInternal is populated before mapping

      designedTables.value = loadedDef.tables.map(t => {
        const originalTableMeta = availableTablesInternal.value.find(at => at.tableId === t.tableId);
        return {
          id: t.tableId, name: t.name,
          fields: originalTableMeta?.schemaDefinition.map(f => ({name: f.name, type: f.type})) || [],
          x: t.x, y: t.y,
          orbitDBAddress: t.orbitDBAddress,
          originalMetadata: originalTableMeta
        };
      });
      tableCounter = designedTables.value.length;
      criteriaGridRowData.value = loadedDef.criteria.map(c => ({...c}));
      alert(`View '${loadedDef.viewName}' loaded!`);
    } else { alert("Could not find view at address."); }
  } catch (error) { console.error("Error loading view:", error); alert("Failed to load view."); }
  finally { loadingView.value = false; viewAddressToLoad.value = ''; }
}

function getFieldIcon(fieldType: string): string { switch (fieldType?.toLowerCase()) { case 'string': return 'mdi-format-text'; case 'number': return 'mdi-numeric'; case 'boolean': return 'mdi-toggle-switch-outline'; case 'date': return 'mdi-calendar'; default: return 'mdi-help-circle-outline'; } }

</script>

<style scoped>
.view-editor-container { height: calc(100vh - 64px); display: flex; flex-direction: column; }
.editor-panes { flex-grow: 1; min-height: 300px; }
.design-surface { position: relative; border: 1px dashed #ccc; min-height: 400px; overflow: hidden; }
.designed-table-representation { position: absolute; background-color: white; border: 1px solid #aeaeae; padding: 10px; width: 220px; user-select: none; }
.designed-table-representation strong { display: block; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;}
.designed-table-representation ul.field-list { list-style-type: none; padding-left: 0; margin-top: 5px; font-size: 0.9em; max-height: 150px; overflow-y: auto;}
.designed-table-representation ul.field-list li { padding: 3px 0; display: flex; align-items: center;}
.fill-height { height: 100%; }
</style>
