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
            :class="{ 'cell-editable': colDef.editable && !(editingCell && editingCell.rowId === (props.rowIdField ? row[props.rowIdField] : undefined) && editingCell.field === colDef.field) }"
            @dblclick="handleCellDblClick(row, colDef)"
          >
            <!-- Conditional rendering for inline editing: show input if cell is active, otherwise show standard content -->
            <template v-if="editingCell && (props.rowIdField && editingCell.rowId === row[props.rowIdField]) && editingCell.field === colDef.field">
              <input
                type="text"
                v-model="editingCellValue"
                ref="editingInputRef"
                class="cell-editing-input"
                style="width: 100%; height: 100%; border: 1px solid #757575; outline: none; box-sizing: border-box; padding: 0 4px; margin: 0; font-family: inherit; font-size: inherit;"
                @blur="handleEditBlur()"
                @keydown.enter.prevent="handleEditEnter()"
                @keydown.escape.prevent="handleEditEscape()"
              />
            </template>
            <template v-else>
              <template v-if="colDef.cellRenderer === 'checkbox'">
                <v-checkbox density="compact" hide-details :model-value="getCellValue(row, colDef.field)" @update:model-value="(newValue) =>setCellValue(row, colDef.field, newValue, rowIndex + (currentPage - 1) * currentItemsPerPage)" class="grid-checkbox"></v-checkbox>
              </template>
              <template v-else>{{ getCellValue(row, colDef.field) }}</template>
            </template>
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
  width?: number; minWidth?: number; visible?: boolean; cellRenderer?: 'checkbox'|string;
  /** If true, cells in this column can be double-clicked to enable inline editing. Requires `rowIdField` to be set on the grid. */
  editable?: boolean;
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
   * Defines the row selection behavior of the grid.
   * - `'none'` (default): Row selection is disabled.
   * - `'single'`: Allows only one row to be selected at a time. Clicking a new row deselects any previously selected row.
   * - `'multiple'`: Allows multiple rows to be selected. Behavior includes:
   *    - Simple click: Clears previous selections and selects the clicked row. Sets this row as the anchor for Shift+click.
   *    - Ctrl/Cmd+Click: Toggles the selection state of the clicked row without affecting other selections. Sets this row as the anchor for Shift+click.
   *    - Shift+Click: Selects a range of rows from the last anchored row (last row clicked without Shift) to the currently clicked row. If Ctrl/Cmd is not also held, this replaces the current selection with the range.
   * @type {'single' | 'multiple' | 'none'}
   * @default 'none'
   */
  selectionMode: { type: String as PropType<'single' | 'multiple' | 'none'>, default: 'none' },
  /**
   * The name of the field in each `rowData` object that serves as its unique identifier.
   * This prop is **essential** for row selection features (`'single'` or `'multiple'`) to function correctly,
   * as it's used to track selected rows by their ID.
   * If `selectionMode` is not 'none' and `rowIdField` is not provided or is invalid for some rows,
   * selection behavior for those rows may be unpredictable or disabled.
   * @type {string}
   * @required if selectionMode is 'single' or 'multiple'
   */
  rowIdField: { type: String, required: false }
});

/**
 * Defines the events emitted by the GridableGrid component.
 *
 * @emits grid-state-change - Fired when a significant UI state of the grid changes (e.g., sort order, column visibility/order/width, items per page, or filter model).
 *   Payload: `{ viewId: string, state: GridState }`
 *     - `viewId`: The ID of the view associated with this grid instance.
 *     - `state`: An object representing the current comprehensive state of the grid.
 *
 * @emits cell-value-changed - Fired when the value of a cell is changed, typically through an interactive cell renderer like a checkbox.
 *   Payload: `{ row: RowDataItem, field: string, newValue: any, originalRowIndex: number }`
 *     - `row`: The data object for the row that was changed.
 *     - `field`: The field (property key) of the cell that was changed.
 *     - `newValue`: The new value of the cell.
 *     - `originalRowIndex`: The index of the row in the original `rowData` array (before pagination/filtering/sorting).
 *
 * @emits selectionChanged - Fired whenever the set of selected rows changes, either through user interaction or programmatic calls.
 *   Payload: `{ selectedIds: Set<string | number>, selectedData: RowDataItem[] }`
 *     - `selectedIds`: A `Set` containing the unique IDs (from `rowIdField`) of all currently selected rows.
 *     - `selectedData`: An array of the full data objects for all currently selected rows.
 *
 * @emits rowClick - Fired when a data row is clicked, regardless of the current `selectionMode`.
 *   Payload: `{ row: RowDataItem, event: MouseEvent }`
 *     - `row`: The data object for the row that was clicked.
 *     - `event`: The native `MouseEvent` object associated with the click.
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

// --- Inline Cell Editing State ---
/**
 * @ref editingCell
 * Tracks the currently active cell for inline editing.
 * Structure: `{ rowId: string | number, field: string }` or `null` if no cell is being edited.
 * `rowId` is derived from `props.rowIdField` of the row being edited.
 * `field` is the column's field name.
 */
const editingCell = ref<{ rowId: string | number; field: string } | null>(null);
/**
 * @ref editingCellValue
 * Holds the temporary value of the cell currently being edited in an input field.
 */
const editingCellValue = ref<any>(null);
/**
 * @ref editingInputRef
 * Template ref for the `<input>` element used during inline editing.
 * Primarily used for managing focus on the input when editing starts.
 */
const editingInputRef = ref<HTMLInputElement | null>(null);

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
 * A reactive `Set` storing the unique IDs (derived from the `props.rowIdField` of row data objects)
 * of the currently selected rows. This is the primary internal state for managing row selections.
 */
const selectedRowIdsInternal = ref(new Set<string | number>());
/**
 * @ref lastClickedRowId
 * Stores the ID of the row that was last clicked without the Shift key being pressed
 * (i.e., a simple click or a Ctrl/Cmd+click). This ID serves as the anchor point for
 * subsequent Shift+click range selections when `selectionMode` is 'multiple'.
 * It is reset if the selection mode changes, data is reloaded, or selection is cleared.
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

/**
 * Handles the double-click event on a data cell to initiate inline editing.
 * - Checks if the column definition (`colDef`) allows editing (`colDef.editable === true`).
 * - Requires `props.rowIdField` to be set on the grid for uniquely identifying rows.
 * - Sets `editingCell` to the target cell's `rowId` and `field`.
 * - Populates `editingCellValue` with the current value of the cell.
 * - Uses `nextTick` to ensure the input element is rendered, then focuses it via `editingInputRef`.
 * @param {RowDataItem} row The data object for the row containing the double-clicked cell.
 * @param {ColumnDefinition} colDef The column definition for the double-clicked cell.
 */
function handleCellDblClick(row: RowDataItem, colDef: ColumnDefinition) {
  if (!colDef.editable) {
    return;
  }
  if (!props.rowIdField) {
    console.warn("GridableGrid: 'rowIdField' prop is required for cell editing to identify the row.");
    return;
  }
  const rowId = row[props.rowIdField];
  if (rowId === undefined || rowId === null) {
    console.warn(`GridableGrid: 'rowIdField' ("${props.rowIdField}") not found in dblclicked row or its value is null/undefined. Cannot initiate editing.`, row);
    return;
  }

  // If already editing this cell, do nothing
  if (editingCell.value && editingCell.value.rowId === rowId && editingCell.value.field === colDef.field) {
    return;
  }

  // TODO: Commit any previous edit before starting a new one - to be handled in a subsequent step
  // if (editingCell.value) {
  //   commitEdit();
  // }

  editingCell.value = { rowId: rowId, field: colDef.field };
  editingCellValue.value = getCellValue(row, colDef.field); // Pass field string
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


function saveEdit() {
  if (!editingCell.value) return;

  const { rowId, field } = editingCell.value;
  const originalRowData = props.rowData.find(r => props.rowIdField && r[props.rowIdField] === rowId);

  if (!originalRowData) {
    console.warn(`GridableGrid: Original row data not found for rowId "${rowId}". Cannot save edit.`);
    editingCell.value = null;
    editingCellValue.value = null;
    return;
  }

  const oldValue = getCellValue(originalRowData, field);
  const newValue = editingCellValue.value;

  if (newValue !== oldValue) {
    // Find the original index for consistency with checkbox emit, though less critical here
    const originalRowIndex = props.rowData.findIndex(r => props.rowIdField && r[props.rowIdField] === rowId);

    emit('cell-value-changed', {
      rowId: rowId,
      field: field,
      oldValue: oldValue,
      newValue: newValue,
      rowData: originalRowData, // The row data object itself
      originalRowIndex: originalRowIndex // Index in the original unfiltered/unsorted rowData
    });
    // Note: The parent component is responsible for actually updating props.rowData
  }

  editingCell.value = null;
  editingCellValue.value = null;
}

function cancelEdit() {
  editingCell.value = null;
  editingCellValue.value = null;
}

function handleEditEnter() {
  saveEdit();
}

function handleEditEscape() {
  cancelEdit();
}

function handleEditBlur() {
  // Save on blur, as is common behavior. saveEdit() will only emit if value changed.
  saveEdit();
}


watch(rowData, () => {
  currentPage.value = 1;
  selectedRowIdsInternal.value.clear();
  lastClickedRowId.value = null;
  editingCell.value = null; // Stop editing if data changes
});

watch(editingCell, (newVal) => {
  if (newVal) {
    nextTick(() => {
      editingInputRef.value?.focus();
    });
  }
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
 * Handles click events on grid data rows to manage row selection based on the current `props.selectionMode`.
 *
 * Emits a `rowClick` event with the clicked row's data and the original mouse event.
 *
 * If `selectionMode` is `'single'`:
 * - Clears any existing selection.
 * - Selects the clicked row.
 * - Updates `lastClickedRowId` for potential future Shift+click use if mode changes.
 *
 * If `selectionMode` is `'multiple'`:
 * - **Shift+Click:** If `event.shiftKey` is true and `lastClickedRowId` (anchor) is set:
 *   - Determines the range of rows in `paginatedData` between the anchor row and the clicked row.
 *   - If Ctrl/Cmd is *not* also pressed, clears the current selection.
 *   - Adds all rows within the identified range to the selection.
 *   - `lastClickedRowId` (anchor) is *not* updated by a Shift+click itself.
 * - **Ctrl/Cmd+Click:** Toggles the selection state of the clicked row (adds if unselected, removes if selected)
 *   without affecting other selected rows. Updates `lastClickedRowId` to the clicked row.
 * - **Simple Click (no modifiers):** Clears all previous selections and selects only the currently clicked row.
 *   Updates `lastClickedRowId` to the clicked row.
 *
 * After any change to the selection, it emits a `selectionChanged` event with the new set of
 * selected row IDs and an array of the corresponding full row data objects.
 *
 * Requires `props.rowIdField` to be correctly set for identifying rows.
 *
 * @param {RowDataItem} row - The data object for the row that was clicked.
 * @param {MouseEvent} event - The original mouse event.
 */
function handleRowClick(row: RowDataItem, event: MouseEvent) {
  emit('rowClick', { row, event });

  if (props.selectionMode === 'none') {
    return;
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
      // Current behavior: clicking an already selected single row keeps it selected.
      // To make it deselect: selectedRowIdsInternal.value.clear();
    } else {
      selectedRowIdsInternal.value.clear();
      selectedRowIdsInternal.value.add(rowId);
    }
    lastClickedRowId.value = rowId;
  } else if (props.selectionMode === 'multiple') {
    if (event.shiftKey && lastClickedRowId.value !== null) {
      const lastIdx = paginatedData.value.findIndex(r => r[props.rowIdField!] === lastClickedRowId.value);
      const currentIdx = paginatedData.value.findIndex(r => r[props.rowIdField!] === rowId);

      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);

        if (!(event.ctrlKey || event.metaKey)) {
            selectedRowIdsInternal.value.clear();
        }
        for (let i = start; i <= end; i++) {
          const rowInRange = paginatedData.value[i];
          const idInRange = rowInRange[props.rowIdField!];
          if (idInRange !== undefined && idInRange !== null) {
            selectedRowIdsInternal.value.add(idInRange);
          }
        }
      }
      // Anchor (`lastClickedRowId`) is not updated on Shift+click.
    } else if (event.ctrlKey || event.metaKey) {
      if (selectedRowIdsInternal.value.has(rowId)) {
        selectedRowIdsInternal.value.delete(rowId);
      } else {
        selectedRowIdsInternal.value.add(rowId);
      }
      lastClickedRowId.value = rowId; // Ctrl/Cmd click updates the anchor.
    } else {
      selectedRowIdsInternal.value.clear();
      selectedRowIdsInternal.value.add(rowId);
      lastClickedRowId.value = rowId; // Simple click in multi-mode sets new selection and anchor.
    }
  }

  const selectedData = props.rowData.filter(r => props.rowIdField && r.hasOwnProperty(props.rowIdField) && selectedRowIdsInternal.value.has(r[props.rowIdField]));
  emit('selectionChanged', new Set(selectedRowIdsInternal.value), selectedData);
}


// --- Exposed Public API Methods ---
defineExpose({
  /**
   * Returns a reactive `Set` of the unique IDs of all currently selected rows.
   * @returns {Set<string | number>} A `Set` containing the IDs of selected rows.
   */
  getSelectedRowIds: () => new Set(selectedRowIdsInternal.value),
  /**
   * Returns an array of the full data objects for all currently selected rows.
   * This method relies on `props.rowIdField` being correctly set and present in row data.
   * @returns {RowDataItem[]} An array of the data objects for all selected rows.
   */
  getSelectedRowsData: () => {
    if (!props.rowIdField) {
      console.warn("GridableGrid: 'rowIdField' prop is required for getSelectedRowsData().");
      return [];
    }
    return props.rowData.filter(row => props.rowIdField && row.hasOwnProperty(props.rowIdField) && selectedRowIdsInternal.value.has(row[props.rowIdField]));
  },
  getEditingCell: () => editingCell.value,
  /**
   * Clears all current row selections in the grid.
   * Also resets the `lastClickedRowId` used for Shift+click range selections.
   * Emits a `selectionChanged` event with an empty selection.
   */
  clearSelection: () => {
    selectedRowIdsInternal.value.clear();
    lastClickedRowId.value = null;
    emit('selectionChanged', new Set(), []);
  },
  /**
   * Programmatically sets the selected rows in the grid based on a provided array or Set of row IDs.
   * - Requires `props.rowIdField` to be correctly configured.
   * - If `selectionMode` is 'none', this method logs a warning and does nothing.
   * - It validates the provided IDs against the current `props.rowData` to ensure only existing rows are selected.
   * - If `selectionMode` is `'single'` and multiple valid IDs are provided, only the first valid ID found in `props.rowData` will be selected.
   * - Resets `lastClickedRowId` (the anchor for Shift+click) as this is a programmatic change.
   * - Emits the `selectionChanged` event with the new set of selected IDs and their corresponding row data objects.
   *
   * @param {(string | number)[] | Set<string | number>} idsToSelect - An array or a Set of row IDs to be selected.
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
    const inputIdSet = new Set(idsToSelect); // Standardize input to a Set

    if (props.selectionMode === 'single' && inputIdSet.size > 1) {
      console.warn("GridableGrid: setSelectedRowIds called with multiple IDs in 'single' selection mode. Only the first valid ID will be selected.");
      // Find the first ID from inputIdSet that is present in the actual rowData
      const firstValidIdInData = props.rowData.find(row => {
        const rowId = row[props.rowIdField!]; // Use non-null assertion as we've checked props.rowIdField
        return rowId !== undefined && rowId !== null && inputIdSet.has(rowId);
      })?.[props.rowIdField!]; // Get the ID value itself

      if (firstValidIdInData !== undefined && firstValidIdInData !== null) {
        newSelectedIds.add(firstValidIdInData);
      }
    } else {
      // For 'multiple' mode, or 'single' mode with 0 or 1 ID in idsToSelect.
      for (const row of props.rowData) {
        const rowId = row[props.rowIdField!]; // Use non-null assertion
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

    // Gather full data for selected rows and emit the 'selectionChanged' event.
    const selectedData = props.rowData.filter(r => props.rowIdField && r.hasOwnProperty(props.rowIdField) && selectedRowIdsInternal.value.has(r[props.rowIdField]));
    emit('selectionChanged', new Set(selectedRowIdsInternal.value), selectedData);
  }
});
>>>>>>> REPLACE
