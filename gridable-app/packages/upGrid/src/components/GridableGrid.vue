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
        :key="props.rowIdField ? row[props.rowIdField] : 'row-' + rowIndex"
        class="grid-data-row"
        :class="{ 'row-selected': props.selectionMode !== 'none' && selectedRowIdsInternal.has(row[props.rowIdField]) }"
        @click="handleRowClick(row, $event)"
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
import { ref, computed, watch, defineProps, defineEmits, defineExpose, toRefs, PropType, onMounted, nextTick } from 'vue';
import type { GridTheme } from './GridableGridTheme';
import type { GridState } from '~/services/userPreferences'; // Assuming this path is valid or will be adjusted
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
  viewId: { type: String, default: 'default-view' },
  /**
   * Defines the row selection behavior.
   * - `'none'`: Disables row selection.
   * - `'single'`: Allows only one row to be selected at a time. Clicking a new row deselects the previous.
   * - `'multiple'`: Allows multiple rows to be selected using Ctrl/Cmd+click (toggle),
   *                 Shift+click (range selection), or simple click (replaces selection with clicked row).
   * @default 'none'
   */
  selectionMode: { type: String as PropType<'single' | 'multiple' | 'none'>, default: 'none' },
  /**
   * The name of the field in `rowData` objects that contains a unique identifier for each row.
   * This prop is **required** if `selectionMode` is `'single'` or `'multiple'` for selection to work correctly.
   */
  rowIdField: { type: String, required: false }
});

/**
 * @emits selectionChanged - Fired when the set of selected rows changes.
 *   Payload: `{ selectedIds: Set<string | number>, selectedData: RowDataItem[] }`
 *     - `selectedIds`: A Set containing the unique IDs of the currently selected rows.
 *     - `selectedData`: An array containing the full data objects for the currently selected rows.
 * @emits rowClick - Fired when a row is clicked, regardless of selection mode.
 *   Payload: `{ row: RowDataItem, event: MouseEvent }`
 *     - `row`: The data object for the clicked row.
 *     - `event`: The original MouseEvent.
 * @emits grid-state-change - Fired when grid UI state (sort, columns, pagination, filter) changes.
 * @emits cell-value-changed - Fired when a cell's value is changed (e.g., by a checkbox renderer).
 */
const emit = defineEmits(['grid-state-change', 'cell-value-changed', 'selectionChanged', 'rowClick']);
const { columnDefs, rowData, itemsPerPage, theme, initialGridState, viewId, selectionMode, rowIdField } = toRefs(props);

// Internal States
const currentSortState = ref(initialGridState.value.sortState || { field: null, direction: 'asc' });
const currentColumnDefs = ref<ColumnDefinition[]>([]);
const currentItemsPerPage = ref(initialGridState.value.itemsPerPage || itemsPerPage.value);
const currentPage = ref(1);
const currentFilterModel = ref<FilterModel>(initialGridState.value.filterModel || {});
const activeFilterField = ref<string | null>(null);
const filterInputValue = ref<string>('');
const initialDataProcessed = ref(false);
const gridWrapperRef = ref<HTMLElement | null>(null);

// Column Resize State
const isResizingColumn = ref(false);
const resizingColumnIndex = ref(-1);
const columnResizeStartX = ref(0);
const columnResizeStartWidth = ref(0);
const resizeIndicatorLeft = ref(0);

// Column Drag & Drop State
const draggedColumnField = ref<string | null>(null);
const dragOverColumnField = ref<string | null>(null);

// --- Row Selection State ---
/**
 * @ref selectedRowIdsInternal
 * A reactive Set storing the unique IDs (obtained via `props.rowIdField`) of the currently selected rows.
 * This is the primary internal state for managing row selection.
 */
const selectedRowIdsInternal = ref(new Set<string | number>());
/**
 * @ref lastClickedRowId
 * Stores the ID of the last row that was clicked without the Shift key being pressed.
 * This serves as the anchor point for Shift+click range selections in 'multiple' selection mode.
 * It's reset when selection mode changes, data changes, or selection is cleared programmatically.
 */
const lastClickedRowId = ref<string | number | null>(null);


onMounted(() => {
  // Initialize currentColumnDefs based on props and initialGridState
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
function setCellValue(row: RowDataItem, field: string, value: any, originalRowIndex: number) {
  // This is a simplified setter. For nested fields, a more robust solution is needed.
  // For now, assume direct property access.
  if (row && typeof row === 'object' && field in row) {
    row[field] = value;
  }
  emit('cell-value-changed', {row, field, newValue: value, originalRowIndex});
  // Note: If rowData itself is a ref or reactive, this change might already be reactive.
  // If rowData items are plain objects, this direct mutation won't trigger parent updates
  // unless the whole rowData array is replaced or specific item is replaced reactively.
  // For checkboxes, GridableGrid likely handles this by directly modifying the object in the array.
}

function sortData(field: string) {
  if (currentSortState.value.field === field) {
    currentSortState.value.direction = currentSortState.value.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortState.value.field = field;
    currentSortState.value.direction = 'asc';
  }
  // Actual sorting is handled by the `processedData` computed property.
  // Need to ensure `processedData` re-evaluates if it doesn't already depend on `currentSortState`.
  // For now, assume `processedData` is correctly re-sorted.
  notifyGridStateChange();
}

function nextPage() { if(currentPage.value < totalPages.value) currentPage.value++; }
function prevPage() { if(currentPage.value > 1) currentPage.value--; }
function onItemsPerPageChange() { currentPage.value = 1; notifyGridStateChange(); }

function notifyGridStateChange() {
  const currentState: GridState = {
    columnOrder: currentColumnDefs.value.map(cd => cd.field),
    columnVisibility: Object.fromEntries(currentColumnDefs.value.map(cd => [cd.field, cd.visible !== false])),
    columnWidths: Object.fromEntries(currentColumnDefs.value.map(cd => [cd.field, cd.width as number])),
    sortState: { ...currentSortState.value },
    itemsPerPage: currentItemsPerPage.value,
    filterModel: { ...currentFilterModel.value },
  };
  emit('grid-state-change', { viewId: viewId.value, state: currentState });
  if (authStore.isAuthenticated && authStore.currentUser?.did && viewId.value) {
    saveViewGridState(viewId.value, currentState);
  }
}

watch(rowData, () => {
  currentPage.value = 1;
  selectedRowIdsInternal.value.clear();
  lastClickedRowId.value = null;
});
watch(() => props.itemsPerPage, (newVal) => {
  currentItemsPerPage.value = newVal;
  currentPage.value = 1;
});
watch(() => props.initialGridState, (newState) => {
    if(newState.filterModel){currentFilterModel.value = JSON.parse(JSON.stringify(newState.filterModel));} else {currentFilterModel.value={};}
    if (newState.columnVisibility) { currentColumnDefs.value.forEach(cd => { if (newState.columnVisibility![cd.field] !== undefined) { cd.visible = newState.columnVisibility![cd.field]; } }); }
    // TODO: Implement reordering and width application from initialGridState more robustly if needed
    if (newState.columnOrder) { /* Reorder currentColumnDefs based on newState.columnOrder */ }
    if (newState.columnWidths) { currentColumnDefs.value.forEach(cd => { if (newState.columnWidths![cd.field] !== undefined) { cd.width = newState.columnWidths![cd.field]; } }); }
    if (newState.sortState) { currentSortState.value = { ...newState.sortState }; }
    if (newState.itemsPerPage) { currentItemsPerPage.value = newState.itemsPerPage; }
    currentPage.value = 1;
    selectedRowIdsInternal.value.clear();
    lastClickedRowId.value = null;
    nextTick(() => { initialDataProcessed.value = true; });
}, { deep: true, immediate: true });

watch(() => props.selectionMode, (newMode, oldMode) => {
  if (newMode !== oldMode) {
    selectedRowIdsInternal.value.clear();
    lastClickedRowId.value = null;
    // Emit selectionChanged when mode changes to ensure consistency
    emit('selectionChanged', new Set(), []);
  }
});


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
  selectedRowIdsInternal.value.clear();
  lastClickedRowId.value = null;
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


// --- Row Selection Logic ---

/**
 * Handles click events on grid rows to manage selection based on the current `selectionMode`.
 * Emits `rowClick` event for every click and `selectionChanged` event when the selection state changes.
 *
 * Behavior by `selectionMode`:
 * - `'none'`: No selection occurs.
 * - `'single'`:
 *   - Clicking a row selects it and deselects any previously selected row.
 *   - Clicking an already selected row keeps it selected (can be modified to deselect).
 * - `'multiple'`:
 *   - **Simple Click (no modifiers):** Clears any previous selection and selects only the clicked row. Updates `lastClickedRowId`.
 *   - **Ctrl/Cmd+Click:** Toggles the selection state of the clicked row (adds if unselected, removes if selected) without affecting other rows. Updates `lastClickedRowId`.
 *   - **Shift+Click:** Selects a range of rows from the `lastClickedRowId` (anchor) to the currently clicked row.
 *     The range is based on the order in `paginatedData` (visible rows).
 *     If Ctrl/Cmd is also held, this range is added to the current selection (TODO for future, current behavior is to set selection to range).
 *     If only Shift is held, the previous selection is cleared, and the new range becomes the selection.
 *     `lastClickedRowId` is *not* updated by a Shift+click itself, preserving the anchor.
 *
 * @param {RowDataItem} row - The data object for the clicked row.
 * @param {MouseEvent} event - The mouse click event.
 */
function handleRowClick(row: RowDataItem, event: MouseEvent) {
  emit('rowClick', { row, event }); // Emit general rowClick event first

  if (props.selectionMode === 'none') {
    return; // Do nothing for selection if mode is 'none'
  }

  if (!props.rowIdField) {
    console.warn("GridableGrid: 'rowIdField' prop is required for selection to work.");
    return;
  }
  const rowId = row[props.rowIdField];
  if (rowId === undefined || rowId === null) {
    console.warn(`GridableGrid: 'rowIdField' ("${props.rowIdField}") not found in clicked row or its value is null/undefined. Cannot process selection.`, row);
    return;
  }

  if (props.selectionMode === 'single') {
    if (selectedRowIdsInternal.value.has(rowId) && selectedRowIdsInternal.value.size === 1) {
      // Optional: allow deselecting by clicking the already selected single row
      // selectedRowIdsInternal.value.clear();
    } else {
      selectedRowIdsInternal.value.clear();
      selectedRowIdsInternal.value.add(rowId);
    }
    lastClickedRowId.value = rowId; // Update for potential mode switch then shift-click
  } else if (props.selectionMode === 'multiple') {
    if (event.shiftKey && lastClickedRowId.value !== null) {
      // Shift+click: Range selection
      const lastIdx = paginatedData.value.findIndex(r => r[props.rowIdField!] === lastClickedRowId.value);
      const currentIdx = paginatedData.value.findIndex(r => r[props.rowIdField!] === rowId);

      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);

        // If Ctrl/Cmd is NOT held with Shift, clear previous selection before applying range.
        // Standard behavior: Shift+Click defines a new selection range from the anchor (lastClickedRowId).
        if (!(event.ctrlKey || event.metaKey)) {
            selectedRowIdsInternal.value.clear();
        }
        // Add all rows within the determined range (inclusive) from the currently displayed (paginated) data.
        for (let i = start; i <= end; i++) {
          const rowInRange = paginatedData.value[i];
          const idInRange = rowInRange[props.rowIdField!];
          if (idInRange !== undefined && idInRange !== null) {
            selectedRowIdsInternal.value.add(idInRange);
          }
        }
      }
      // `lastClickedRowId` (the anchor) is NOT updated on a shift-click.
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+click: Toggle selection for the clicked row.
      if (selectedRowIdsInternal.value.has(rowId)) {
        selectedRowIdsInternal.value.delete(rowId);
      } else {
        selectedRowIdsInternal.value.add(rowId);
      }
      lastClickedRowId.value = rowId; // A Ctrl/Cmd click also sets the anchor for a subsequent Shift+click.
    } else {
      // Simple click (no modifiers) in 'multiple' mode:
      // Clears all previous selections and selects only the currently clicked row.
      selectedRowIdsInternal.value.clear();
      selectedRowIdsInternal.value.add(rowId);
      lastClickedRowId.value = rowId; // This click sets the new anchor.
    }
  }

  // After any selection change, gather all selected data and emit the 'selectionChanged' event.
  const selectedData = props.rowData.filter(r => props.rowIdField && r.hasOwnProperty(props.rowIdField) && selectedRowIdsInternal.value.has(r[props.rowIdField]));
  emit('selectionChanged', new Set(selectedRowIdsInternal.value), selectedData);
}


// --- Exposed Public API Methods ---
defineExpose({
  /**
   * Returns a Set of the unique IDs of all currently selected rows.
   * @returns {Set<string | number>} A Set containing the IDs of selected rows.
   */
  getSelectedRowIds: () => new Set(selectedRowIdsInternal.value),
  /**
   * Returns an array of the full data objects for all currently selected rows.
   * Requires `rowIdField` prop to be correctly set.
   * @returns {RowDataItem[]} An array of selected row data objects.
   */
  getSelectedRowsData: () => {
    if (!props.rowIdField) {
      console.warn("GridableGrid: 'rowIdField' prop is required for getSelectedRowsData().");
      return [];
    }
    return props.rowData.filter(row => props.rowIdField && row.hasOwnProperty(props.rowIdField) && selectedRowIdsInternal.value.has(row[props.rowIdField]));
  },
  /**
   * Clears the current row selection and resets the Shift+click anchor.
   * Emits a `selectionChanged` event with empty selection.
   */
  clearSelection: () => {
    selectedRowIdsInternal.value.clear();
    lastClickedRowId.value = null;
    emit('selectionChanged', new Set(), []);
  },
  /**
   * Programmatically sets the selected rows in the grid.
   * - Validates IDs against `props.rowData` using `props.rowIdField`.
   * - In 'single' selection mode, if multiple IDs are provided, only the first valid ID is selected.
   * - Resets `lastClickedRowId` (Shift+click anchor).
   * - Emits the `selectionChanged` event with the new selection.
   * @param {(string | number)[] | Set<string | number>} idsToSelect - An array or Set of row IDs to select.
   */
  setSelectedRowIds: (idsToSelect: (string | number)[] | Set<string | number>) => {
    if (!props.rowIdField) {
      console.warn("GridableGrid: 'rowIdField' prop is required to use setSelectedRowIds().");
      return;
    }
    if (props.selectionMode === 'none') {
      console.warn("GridableGrid: Cannot set selection when selectionMode is 'none'.");
      return;
    }

    const newSelectedIds = new Set<string | number>();
    const inputIdSet = new Set(idsToSelect);

    if (props.selectionMode === 'single' && inputIdSet.size > 1) {
      console.warn("GridableGrid: setSelectedRowIds called with multiple IDs in 'single' selection mode. Only the first valid ID will be selected.");
      // Find the first ID from inputIdSet that exists in the actual rowData
      const firstValidIdInData = props.rowData.find(row => {
        const rowId = row[props.rowIdField!];
        return rowId !== undefined && rowId !== null && inputIdSet.has(rowId);
      })?.[props.rowIdField!];

      if (firstValidIdInData !== undefined && firstValidIdInData !== null) {
        newSelectedIds.add(firstValidIdInData);
      }
    } else {
      // For 'multiple' mode, or 'single' mode with 0 or 1 ID.
      for (const row of props.rowData) {
        const rowId = row[props.rowIdField!];
        if (rowId !== undefined && rowId !== null && inputIdSet.has(rowId)) {
          newSelectedIds.add(rowId);
          // If single selection mode, and we've found one, that's enough.
          if (props.selectionMode === 'single' && newSelectedIds.size === 1) {
            break;
          }
        }
      }
    }

    selectedRowIdsInternal.value = newSelectedIds;
    lastClickedRowId.value = null; // Programmatic selection should reset the Shift+click anchor.

    // Gather full data for selected rows and emit event.
    const selectedData = props.rowData.filter(r => props.rowIdField && r.hasOwnProperty(props.rowIdField) && selectedRowIdsInternal.value.has(r[props.rowIdField]));
    emit('selectionChanged', new Set(selectedRowIdsInternal.value), selectedData);
  }
});

</script>

<style scoped>
/* ... existing styles ... */
/* Applies a background color to selected rows. */
.grid-header-cell { /* ... */ }
.header-cell-main-content { /* ... */ }
.header-cell-title { /* ... */ }
.header-filter-icon { /* ... */ }
.header-filter-input-container { /* ... */ }
.col-resizer { /* ... */ }
.resize-indicator { /* ... */ }
.grid-checkbox { /* ... */ }

.grid-data-row.row-selected {
  background-color: #e0e0ff !important; /* Light blue, adjust as needed */
}
.grid-data-row:hover {
    background-color: #f0f0f0;
}
</style>
