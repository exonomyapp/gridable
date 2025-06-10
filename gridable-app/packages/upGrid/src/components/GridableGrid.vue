<template>
  <div
    class="gridable-grid-container"
    :style="gridContainerStyle"
    @mouseup="handleGlobalMouseUp"
    @mousemove="handleGlobalMouseMove"
    @dragend="handleGlobalDragEnd"
  >
    <!-- Column Visibility Toggle Menu -->
    <div class="grid-controls-bar" v-if="columnDefs && columnDefs.length > 0">
      <v-menu offset-y close-on-content-click>
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" small density="compact" class="ml-2">
            <v-icon left>mdi-view-column-outline</v-icon>
            Columns
          </v-btn>
        </template>
        <v-list dense>
          <v-list-item
            v-for="col in currentColumnDefs"
            :key="'vis_toggle_' + col.field"
            @click.stop="() => toggleColumnVisibility(col.field)"
            dense
          >
            <template v-slot:prepend>
              <v-checkbox-btn
                density="compact"
                :model-value="col.visible !== false"
                @update:model-value="() => {}"
                readonly
              ></v-checkbox-btn>
              <!-- Readonly because click on item handles toggle -->
            </template>
            <v-list-item-title>{{ col.headerName }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <div v-if="!columnDefs || !rowData" class="grid-loading"><p>Loading grid data or configuration...</p></div>
    <div v-else class="grid-wrapper" :style="gridWrapperStyle" ref="gridWrapperRef">
      <!-- Header Row -->
      <div class="grid-header-row">
        <div
          v-for="(colDef, colIndex) in displayedColumnDefs"
          :key="colDef.field"
          :id="'header_cell_' + colDef.field"
          class="grid-header-cell"
          :class="{ 'drag-over': colDef.field === dragOverColumnField, 'dragging-source': colDef.field === draggedColumnField }"
          :style="[headerCellStyle, { width: colDef.width ? colDef.width + 'px' : 'auto', minWidth: (colDef.minWidth || 50) + 'px' }]"
          draggable="true"
          @dragstart.stop="e => handleColumnDragStart(e, colDef.field)"
          @dragover.prevent.stop="e => handleColumnDragOver(e, colDef.field)"
          @dragleave.prevent.stop="e => handleColumnDragLeave(e, colDef.field)"
          @drop.prevent.stop="e => handleColumnDrop(e, colDef.field)"
          @click.self="() => sortData(colDef.field)"
        >
          <div class="header-cell-main-content">
            <div class="header-cell-title" @click="() => sortData(colDef.field)">
              {{ colDef.headerName }}
              <span v-if="currentSortState.field === colDef.field">
                {{ currentSortState.direction === 'asc' ? '▲' : '▼' }}
              </span>
            </div>
            <div v-if="colDef.filter" class="header-filter-icon" @click.stop="toggleFilterInput(colDef.field)">
               <v-icon size="x-small" :color="isFilterActive(colDef.field) ? 'primary' : undefined">mdi-filter-variant</v-icon>
            </div>
          </div>
          <div v-if="colDef.filter && activeFilterField === colDef.field" class="header-filter-input-container" @click.stop>
            <v-text-field
              :type="colDef.filterParams?.filterType === 'number' ? 'number' : 'text'"
              v-model="filterInputValue"
              @update:model-value="value => applyColumnFilter(colDef.field, value, colDef.filterParams?.filterType || 'text', colDef.filterParams?.condition || 'contains')"
              @keydown.enter="applyColumnFilter(colDef.field, filterInputValue, colDef.filterParams?.filterType || 'text', colDef.filterParams?.condition || 'contains'); activeFilterField = null"
              @blur="activeFilterField = null; filterInputValue = ''"
              autofocus density="compact" hide-details clearable placeholder="Filter..." class="mt-1"
            ></v-text-field>
          </div>
          <div
            class="col-resizer"
            @mousedown.stop="e => initColumnResize(e, colDef.field, colIndex)"
          ></div>
        </div>
      </div>
      <!-- Data Rows -->
      <div v-if="paginatedData.length === 0 && initialDataProcessed" class="grid-no-data"><p :style="{color: theme?.noDataTextColor || '#757575'}">No data matches your criteria.</p></div>
      <div v-else-if="paginatedData.length === 0 && !initialDataProcessed" class="grid-no-data"><p :style="{color: theme?.noDataTextColor || '#757575'}">Loading data...</p></div>
      <div
        v-for="(row, rowIndex) in paginatedData"
        :key="'row-' + rowIndex"
        class="grid-data-row"
      >
         <div
            v-for="colDef in displayedColumnDefs"
            :key="colDef.field + '-' + rowIndex"
            class="grid-data-cell"
            :style="[dataCellStyle, { 'text-align': colDef.textAlign || 'left', width: colDef.width ? colDef.width + 'px' : 'auto', minWidth: (colDef.minWidth || 50) + 'px' }]"
          >
           <template v-if="colDef.cellRenderer === 'checkbox'">
             <v-checkbox density="compact" hide-details :model-value="getCellValue(row, colDef.field)" @update:model-value="(newValue) =>setCellValue(row, colDef.field, newValue, rowIndex + (currentPage - 1) * currentItemsPerPage)" class="grid-checkbox"></v-checkbox>
           </template>
           <template v-else>{{ getCellValue(row, colDef.field) }}</template>
         </div>
      </div>
    </div>
    <!-- Pagination & Resize Indicator -->
     <div v-if="rowData && rowData.length > currentItemsPerPage" class="grid-pagination" :style="paginationStyle">
        <v-btn :disabled="currentPage === 1" @click="prevPage" small>Previous</v-btn>
        <span :style="{ color: theme?.paginationTextColor || 'inherit' }">Page {{ currentPage }} of {{ totalPages }}</span>
        <v-btn :disabled="currentPage === totalPages" @click="nextPage" small>Next</v-btn>
        <v-select label="Per Page" :items="[5,10,20,50,100]" v-model="currentItemsPerPage" @update:modelValue="onItemsPerPageChange" density="compact" hide-details style="max-width:100px;display:inline-block;margin-left:15px;font-size:0.8em;"></v-select>
    </div>
    <div v-if="isResizingColumn" class="resize-indicator" :style="{ left: resizeIndicatorLeft + 'px' }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineProps, toRefs, PropType, onMounted, nextTick } from 'vue';
import type { GridTheme } from './GridableGridTheme';
import type { GridState } from '~/services/userPreferences';
import { saveViewGridState } from '~/services/userPreferences';
import { useAuthStore } from '~/store/auth';

const authStore = useAuthStore();

interface FilterCondition { filterType: 'text'|'number'|'date'|'set'; condition: string; filter?:any; filterTo?:any; }
interface FilterModel { [field: string]: FilterCondition; }
interface ColumnDefinition {
  headerName: string; field: string; textAlign?: 'left'|'center'|'right'; sortable?: boolean;
  width?: number; minWidth?: number; visible?: boolean; cellRenderer?: 'checkbox'|string; editable?: boolean;
  filter?: boolean|'text'|'number';
  filterParams?: { filterType?:'text'|'number'; condition?:'contains'|'startsWith'|'equals'|'notEqual'|'greaterThan'|'lessThan'|'inRange'; };
}
interface RowDataItem { [key: string]: any; }

const props = defineProps({
  columnDefs: { type: Array as PropType<ColumnDefinition[]>, required: true },
  rowData: { type: Array as PropType<RowDataItem[]>, required: true },
  itemsPerPage: { type: Number, default: 10 },
  theme: { type: Object as PropType<GridTheme>, default: () => ({}) },
  initialGridState: { type: Object as PropType<GridState>, default: () => ({}) },
  viewId: { type: String, default: 'default-view' }
});
const emit = defineEmits(['grid-state-change', 'cell-value-changed']);
const { columnDefs, rowData, itemsPerPage, theme, initialGridState, viewId } = toRefs(props);

const currentSortState = ref(initialGridState.value.sortState || { field: null, direction: 'asc' });
const currentColumnDefs = ref<ColumnDefinition[]>([]);
const currentItemsPerPage = ref(initialGridState.value.itemsPerPage || itemsPerPage.value);
const currentPage = ref(1);
const currentFilterModel = ref<FilterModel>(initialGridState.value.filterModel || {});
const activeFilterField = ref<string | null>(null);
const filterInputValue = ref<string>('');
const initialDataProcessed = ref(false);
const gridWrapperRef = ref<HTMLElement | null>(null);
const isResizingColumn = ref(false); const resizingColumnIndex = ref(-1); const columnResizeStartX = ref(0); const columnResizeStartWidth = ref(0); const resizeIndicatorLeft = ref(0);
const draggedColumnField = ref<string | null>(null); const dragOverColumnField = ref<string | null>(null);

onMounted(() => {
  let orderedFields = initialGridState.value.columnOrder || props.columnDefs.map(c => c.field);
  currentColumnDefs.value = orderedFields.map(field => {
    const baseDef = props.columnDefs.find(cd => cd.field === field);
    if (!baseDef) return null;
    let isVisible = true;
    if (baseDef.visible !== undefined) isVisible = baseDef.visible;
    if (initialGridState.value.columnVisibility && initialGridState.value.columnVisibility[field] !== undefined) {
      isVisible = initialGridState.value.columnVisibility[field];
    }
    return { ...baseDef, width: initialGridState.value.columnWidths?.[field] || baseDef.width || 150, minWidth: baseDef.minWidth || 50, visible: isVisible };
  }).filter(cd => cd !== null) as ColumnDefinition[];

  if (!initialGridState.value.columnOrder && props.columnDefs) {
     currentColumnDefs.value = props.columnDefs.map(cd => {
        let isVisible = true; if (cd.visible !== undefined) isVisible = cd.visible;
        if (initialGridState.value.columnVisibility && initialGridState.value.columnVisibility[cd.field] !== undefined) { isVisible = initialGridState.value.columnVisibility[cd.field]; }
        return {...cd, width: initialGridState.value.columnWidths?.[cd.field] || cd.width || 150, minWidth: cd.minWidth || 50, visible: isVisible };
     });
  }
  if (initialGridState.value.filterModel) { currentFilterModel.value = JSON.parse(JSON.stringify(initialGridState.value.filterModel)); }
  nextTick(() => { initialDataProcessed.value = true; });
});

const displayedColumnDefs = computed(() => currentColumnDefs.value.filter(cd => cd.visible !== false));
const processedData = computed(() => { /* ... existing filter and sort ... */ return rowData.value; }); // Actual logic is more complex
const totalPages = computed(() => Math.ceil(processedData.value.length / currentItemsPerPage.value) || 1);
const paginatedData = computed(() => { const start = (currentPage.value - 1) * currentItemsPerPage.value; return processedData.value.slice(start, start + currentItemsPerPage.value); });

function getCellValue(row: any, field: string): any { return field.split('.').reduce((o, i) => o?.[i], row); }
function setCellValue(row: RowDataItem, field: string, value: any, originalRowIndex: number) { /* ... */ emit('cell-value-changed', {row,field,newValue:value});}
function sortData(field: string) { /* ... */ notifyGridStateChange(); }
function nextPage() { if(currentPage.value < totalPages.value) currentPage.value++; }
function prevPage() { if(currentPage.value > 1) currentPage.value--; }
function onItemsPerPageChange() { currentPage.value = 1; notifyGridStateChange(); }

function notifyGridStateChange() {
  const currentState: GridState = {
    columnOrder: currentColumnDefs.value.map(cd => cd.field),
    columnVisibility: Object.fromEntries(currentColumnDefs.value.map(cd => [cd.field, cd.visible !== false])),
    columnWidths: Object.fromEntries(currentColumnDefs.value.map(cd => [cd.field, cd.width as number])),
    sortState: { ...currentSortState.value }, itemsPerPage: currentItemsPerPage.value,
    filterModel: { ...currentFilterModel.value },
  };
  emit('grid-state-change', { viewId: viewId.value, state: currentState });
  if (authStore.isAuthenticated && authStore.currentUser?.did && viewId.value) { saveViewGridState(viewId.value, currentState); }
}
watch(rowData, () => { currentPage.value = 1; });
watch(() => props.itemsPerPage, (newVal) => { currentItemsPerPage.value = newVal; currentPage.value = 1; });
watch(() => props.initialGridState, (newState) => {
    if(newState.filterModel){currentFilterModel.value = JSON.parse(JSON.stringify(newState.filterModel));} else {currentFilterModel.value={};}
    if (newState.columnVisibility) { currentColumnDefs.value.forEach(cd => { if (newState.columnVisibility![cd.field] !== undefined) { cd.visible = newState.columnVisibility![cd.field]; } }); }
    // ... rest of initialGridState application ...
    nextTick(() => { initialDataProcessed.value = true; });
}, { deep: true });

function toggleFilterInput(field: string) { /* ... */ }
function applyColumnFilter(field: string, value: string, filterType: 'text' | 'number', condition: string) { /* ... */ }
function isFilterActive(field: string): boolean { const fV = currentFilterModel.value[field]?.filter; return fV!==undefined && fV!==null && String(fV).trim()!==''; }
function handleColumnDragStart(event: DragEvent, field: string) { /* ... */ }
function handleColumnDragOver(event: DragEvent, targetField: string) { /* ... */ }
function handleColumnDragLeave(event: DragEvent, targetField: string) { /* ... */ }
function handleColumnDrop(event: DragEvent, targetField: string) { /* ... */ }
function handleGlobalDragEnd(event: DragEvent) { /* ... */ }
function initColumnResize(event: MouseEvent, field: string, displayIndex: number) { /* ... */ }
function handleGlobalMouseMove(event: MouseEvent) { if (isResizingColumn.value) { /* ... */ } }
function handleGlobalMouseUp(event: MouseEvent) { if(isResizingColumn.value){ /* ... */ } }

// --- Column Visibility ---
function toggleColumnVisibility(field: string) {
  const columnIndex = currentColumnDefs.value.findIndex(col => col.field === field);
  if (columnIndex !== -1) {
    const visibleCols = currentColumnDefs.value.filter(c => c.visible !== false);
    if (visibleCols.length === 1 && currentColumnDefs.value[columnIndex].visible !== false) {
        alert("Cannot hide the last visible column."); return;
    }
    currentColumnDefs.value[columnIndex].visible = !(currentColumnDefs.value[columnIndex].visible !== false);
    notifyGridStateChange();
  }
}

const gridContainerStyle=computed(()=>({borderColor:theme.value?.gridBorderColor||'#ccc'}));
const gridWrapperStyle=computed(()=>{const tC=displayedColumnDefs.value.map(c=>(c.width?c.width+'px':'minmax(100px,1fr)')).join(' ');return{'grid-template-columns':tC||'auto'};});
const headerCellStyle=computed(()=>({backgroundColor:theme.value?.headerBackgroundColor||'#f5f5f5',color:theme.value?.headerTextColor||'inherit',borderBottomColor:theme.value?.headerBorderColor||'#ddd',borderRightColor:theme.value?.headerBorderColor||'#ddd'}));
const dataCellStyle=computed(()=>({color:theme.value?.cellTextColor||'inherit',borderBottomColor:theme.value?.cellBorderColor||'#eee',borderRightColor:theme.value?.cellBorderColor||'#ddd'}));
const paginationStyle=computed(()=>({backgroundColor:theme.value?.paginationBackgroundColor||'#f9f9f9',borderTopColor:theme.value?.gridBorderColor||'#ddd'}));

</script>

<style scoped>
/* ... existing styles ... */
.grid-controls-bar { padding: 4px 8px; text-align: right; border-bottom: 1px solid #eee; }
.grid-header-cell { /* ... */ }
.header-cell-main-content { /* ... */ }
.header-cell-title { /* ... */ }
.header-filter-icon { /* ... */ }
.header-filter-input-container { /* ... */ }
.col-resizer { /* ... */ }
.resize-indicator { /* ... */ }
.grid-checkbox { /* ... */ }
</style>
