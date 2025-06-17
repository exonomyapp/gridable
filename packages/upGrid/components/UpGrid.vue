<template>
  <div
    class="up-grid-container"
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
        :class="{ 'row-selected': props.selectionMode !== 'none' && props.rowIdField && selectedRowIdsInternal.has(row[props.rowIdField]) }"
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
            <!-- Conditional rendering for inline editing:
                 Show input if this cell (matching rowId and field) is the `editingCell`.
                 Otherwise, show standard cell content (text or custom renderer like checkbox). -->
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
import { ref, computed, watch, defineProps, defineEmits, defineExpose, toRefs, onMounted, nextTick } from 'vue';
import type { PropType } from 'vue';
import type { upGridTheme } from '../types/upGridTheme';
import type { ColumnDefinition, RowDataItem } from '../types';

interface FilterCondition { filterType: 'text'|'number'|'date'|'set'; condition: string; filter?:any; filterTo?:any; }
interface FilterModel { [field: string]: FilterCondition; }
interface GridState {
  columnOrder?: string[];
  columnVisibility?: { [field: string]: boolean };
  columnWidths?: { [field: string]: number };
  sortState?: { field: string | null; direction: 'asc' | 'desc' };
  itemsPerPage?: number;
  filterModel?: FilterModel;
}

const props = defineProps({
  columnDefs: { type: Array as PropType<ColumnDefinition[]>, required: true },
  rowData: { type: Array as PropType<RowDataItem[]>, required: true },
  itemsPerPage: { type: Number, default: 10 },
  theme: { type: Object as PropType<upGridTheme>, default: () => ({}) },
  initialGridState: { type: Object as PropType<GridState>, default: () => ({}) },
  viewId: { type: String, default: 'default-view' },
  selectionMode: { type: String as PropType<'single' | 'multiple' | 'none'>, default: 'none' },
  rowIdField: { type: String, required: false }
});

const emit = defineEmits(['grid-state-change', 'cell-value-changed', 'selectionChanged', 'rowClick']);

const { columnDefs, rowData, itemsPerPage, theme, initialGridState, viewId, selectionMode, rowIdField } = toRefs(props);

// Internal States
const currentSortState = ref(initialGridState.value.sortState || { field: null, direction: 'asc' as 'asc' | 'desc' });
const currentColumnDefs = ref<ColumnDefinition[]>([]);
const currentItemsPerPage = ref(initialGridState.value.itemsPerPage || itemsPerPage.value);
const currentPage = ref(1);
const currentFilterModel = ref<FilterModel>(initialGridState.value.filterModel || {});
const activeFilterField = ref<string | null>(null);
const filterInputValue = ref<string>('');
const initialDataProcessed = ref(false);
const gridWrapperRef = ref<HTMLElement | null>(null);

// Inline Cell Editing State
const editingCell = ref<{ rowId: string | number; field: string } | null>(null);
const editingCellValue = ref<any>(null);
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

// Row Selection State
const selectedRowIdsInternal = ref(new Set<string | number>());
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

// This is a simplified version. A real implementation would need to handle sorting and filtering.
const processedData = computed(() => {
  let data = [...rowData.value];

  // Sorting
  const sortField = currentSortState.value.field;
  if (sortField) {
    data.sort((a, b) => {
      const valA = getCellValue(a, sortField);
      const valB = getCellValue(b, sortField);
      if (valA < valB) return currentSortState.value.direction === 'asc' ? -1 : 1;
      if (valA > valB) return currentSortState.value.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Filtering (simplified example)
  Object.entries(currentFilterModel.value).forEach(([field, filter]) => {
    if (filter && filter.filter !== undefined && filter.filter !== null && String(filter.filter).trim() !== '') {
      const filterValue = String(filter.filter).toLowerCase();
      data = data.filter(row => {
        const cellValue = String(getCellValue(row, field)).toLowerCase();
        return cellValue.includes(filterValue);
      });
    }
  });

  return data;
});

const totalPages = computed(() => Math.ceil(processedData.value.length / currentItemsPerPage.value) || 1);
const paginatedData = computed(() => {
    if (processedData.value.length === 0) return [];
    const start = (currentPage.value - 1) * currentItemsPerPage.value;
    return processedData.value.slice(start, start + currentItemsPerPage.value);
});

function getCellValue(row: any, field: string): any { return field.split('.').reduce((o, i) => o?.[i], row); }

function setCellValue(row: RowDataItem, field: string, value: any, originalRowIndex: number) {
  if (row && typeof row === 'object' && field in row) {
    (row as any)[field] = value;
  }
  emit('cell-value-changed', {row, field, newValue: value, originalRowIndex});
}

function sortData(field: string) {
  if (currentSortState.value.field === field) {
    currentSortState.value.direction = currentSortState.value.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortState.value.field = field;
    currentSortState.value.direction = 'asc';
  }
  notifyGridStateChange();
}

function handleCellDblClick(row: RowDataItem, colDef: ColumnDefinition) {
  if (!colDef.editable) return;
  if (!props.rowIdField) {
    console.warn("UpGrid: 'rowIdField' prop is required for cell editing.");
    return;
  }
  const rowId = (row as any)[props.rowIdField];
  if (rowId === undefined || rowId === null) return;

  if (editingCell.value && editingCell.value.rowId === rowId && editingCell.value.field === colDef.field) return;

  editingCell.value = { rowId: rowId, field: colDef.field };
  editingCellValue.value = getCellValue(row, colDef.field);
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
}

function saveEdit() {
  if (!editingCell.value) return;
  const { rowId, field } = editingCell.value;
  const originalRowData = props.rowData.find(r => props.rowIdField && (r as any)[props.rowIdField] === rowId);
  if (!originalRowData) {
    cancelEdit();
    return;
  }
  const oldValue = getCellValue(originalRowData, field);
  const newValue = editingCellValue.value;
  if (newValue !== oldValue) {
    const originalRowIndex = props.rowData.findIndex(r => props.rowIdField && (r as any)[props.rowIdField] === rowId);
    emit('cell-value-changed', {
      rowId: rowId,
      field: field,
      oldValue: oldValue,
      newValue: newValue,
      rowData: originalRowData,
      originalRowIndex: originalRowIndex
    });
  }
  cancelEdit();
}

function cancelEdit() {
  editingCell.value = null;
  editingCellValue.value = null;
}

function handleEditEnter() { saveEdit(); }
function handleEditEscape() { cancelEdit(); }
function handleEditBlur() { saveEdit(); }

watch(rowData, () => {
  currentPage.value = 1;
  selectedRowIdsInternal.value.clear();
  lastClickedRowId.value = null;
  editingCell.value = null;
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
    if (newState.columnVisibility) { currentColumnDefs.value.forEach(cd => { if (newState.columnVisibility![cd.field] !== undefined) { (cd as any).visible = newState.columnVisibility![cd.field]; } }); }
    if (newState.columnOrder) { /* Reorder logic */ }
    if (newState.columnWidths) { currentColumnDefs.value.forEach(cd => { if (newState.columnWidths![cd.field] !== undefined) { (cd as any).width = newState.columnWidths![cd.field]; } }); }
    if (newState.sortState) { currentSortState.value = { ...newState.sortState }; }
    if (newState.itemsPerPage) { currentItemsPerPage.value = newState.itemsPerPage; }
    currentPage.value = 1;
    selectedRowIdsInternal.value.clear();
    lastClickedRowId.value = null;
    nextTick(() => { initialDataProcessed.value = true; });
}, { deep: true, immediate: true });

watch(() => props.selectionMode, (newMode) => {
  if (newMode === 'none') {
    selectedRowIdsInternal.value.clear();
    lastClickedRowId.value = null;
    emit('selectionChanged', new Set(), []);
  }
});

function toggleFilterInput(field: string) {
  if (activeFilterField.value === field) {
    activeFilterField.value = null;
  } else {
    activeFilterField.value = field;
    filterInputValue.value = (currentFilterModel.value[field] as any)?.filter || '';
  }
}

function applyColumnFilter(field: string, value: string, filterType: 'text' | 'number', condition: string) {
  const newFilterModel = { ...currentFilterModel.value };
  if (value === null || value.trim() === '') {
    delete (newFilterModel as any)[field];
  } else {
    (newFilterModel as any)[field] = { filterType, condition, filter: value };
  }
  currentFilterModel.value = newFilterModel;
  currentPage.value = 1;
  notifyGridStateChange();
}

function isFilterActive(field: string): boolean {
  const fV = (currentFilterModel.value[field] as any)?.filter;
  return fV !== undefined && fV !== null && String(fV).trim() !== '';
}

function handleColumnDragStart(event: DragEvent, field: string) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', field);
    draggedColumnField.value = field;
  }
}

function handleColumnDragOver(event: DragEvent, targetField: string) {
  event.preventDefault();
  dragOverColumnField.value = targetField;
}

function handleColumnDragLeave(event: DragEvent, targetField: string) {
  if (dragOverColumnField.value === targetField) {
    dragOverColumnField.value = null;
  }
}

function handleColumnDrop(event: DragEvent, targetField: string) {
  const sourceField = event.dataTransfer?.getData('text/plain');
  if (sourceField && sourceField !== targetField) {
    const newColumnDefs = [...currentColumnDefs.value];
    const sourceIndex = newColumnDefs.findIndex(c => c.field === sourceField);
    const targetIndex = newColumnDefs.findIndex(c => c.field === targetField);
    if (sourceIndex > -1 && targetIndex > -1) {
      const [removed] = newColumnDefs.splice(sourceIndex, 1);
      newColumnDefs.splice(targetIndex, 0, removed);
      currentColumnDefs.value = newColumnDefs;
      notifyGridStateChange();
    }
  }
  draggedColumnField.value = null;
  dragOverColumnField.value = null;
}

function handleGlobalDragEnd(event: DragEvent) {
  draggedColumnField.value = null;
  dragOverColumnField.value = null;
}

function initColumnResize(event: MouseEvent, field: string, displayIndex: number) {
  isResizingColumn.value = true;
  resizingColumnIndex.value = displayIndex;
  columnResizeStartX.value = event.clientX;
  const headerCell = document.getElementById(`header_cell_${field}`);
  columnResizeStartWidth.value = headerCell?.offsetWidth || 150;
  resizeIndicatorLeft.value = event.clientX;
}

function handleGlobalMouseMove(event: MouseEvent) {
  if (isResizingColumn.value) {
    const diffX = event.clientX - columnResizeStartX.value;
    const newWidth = columnResizeStartWidth.value + diffX;
    const colDef = displayedColumnDefs.value[resizingColumnIndex.value];
    if (colDef && newWidth > (colDef.minWidth || 50)) {
      (colDef as any).width = newWidth;
      resizeIndicatorLeft.value = event.clientX;
    }
  }
}

function handleGlobalMouseUp(event: MouseEvent) {
  if (isResizingColumn.value) {
    isResizingColumn.value = false;
    notifyGridStateChange();
  }
}

function toggleColumnVisibility(field: string) {
  const columnIndex = currentColumnDefs.value.findIndex(col => col.field === field);
  if (columnIndex !== -1) {
    const visibleCols = currentColumnDefs.value.filter(c => c.visible !== false);
    if (visibleCols.length === 1 && currentColumnDefs.value[columnIndex].visible !== false) {
      alert("Cannot hide the last visible column.");
      return;
    }
    (currentColumnDefs.value[columnIndex] as any).visible = !(currentColumnDefs.value[columnIndex].visible !== false);
    notifyGridStateChange();
  }
}

const gridContainerStyle = computed(() => ({ borderColor: theme.value?.gridBorderColor || '#ccc' }));
const gridWrapperStyle = computed(() => {
  const tC = displayedColumnDefs.value.map(c => (c.width ? c.width + 'px' : 'minmax(100px,1fr)')).join(' ');
  return { 'grid-template-columns': tC || 'auto' };
});
const headerCellStyle = computed(() => ({ backgroundColor: theme.value?.headerBackgroundColor || '#f5f5f5', color: theme.value?.headerTextColor || 'inherit', borderBottomColor: theme.value?.headerBorderColor || '#ddd', borderRightColor: theme.value?.headerBorderColor || '#ddd' }));
const dataCellStyle = computed(() => ({ color: theme.value?.cellTextColor || 'inherit', borderBottomColor: theme.value?.cellBorderColor || '#eee', borderRightColor: theme.value?.cellBorderColor || '#ddd' }));
const paginationStyle = computed(() => ({ backgroundColor: theme.value?.paginationBackgroundColor || '#f9f9f9', borderTopColor: theme.value?.gridBorderColor || '#ddd' }));

function handleRowClick(row: RowDataItem, event: MouseEvent) {
  emit('rowClick', { row, event });
  if (props.selectionMode === 'none' || !props.rowIdField) return;
  const rowId = (row as any)[props.rowIdField];
  if (rowId === undefined || rowId === null) return;

  if (props.selectionMode === 'single') {
    selectedRowIdsInternal.value.clear();
    selectedRowIdsInternal.value.add(rowId);
    lastClickedRowId.value = rowId;
  } else if (props.selectionMode === 'multiple') {
    if (event.shiftKey && lastClickedRowId.value !== null) {
      const lastIdx = paginatedData.value.findIndex(r => props.rowIdField && (r as any)[props.rowIdField] === lastClickedRowId.value);
      const currentIdx = paginatedData.value.findIndex(r => props.rowIdField && (r as any)[props.rowIdField] === rowId);
      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        if (!(event.ctrlKey || event.metaKey)) {
          selectedRowIdsInternal.value.clear();
        }
        for (let i = start; i <= end; i++) {
          const rowInRange = paginatedData.value[i];
          const idInRange = props.rowIdField && (rowInRange as any)[props.rowIdField];
          if (idInRange !== undefined && idInRange !== null) {
            selectedRowIdsInternal.value.add(idInRange);
          }
        }
      }
    } else if (event.ctrlKey || event.metaKey) {
      if (selectedRowIdsInternal.value.has(rowId)) {
        selectedRowIdsInternal.value.delete(rowId);
      } else {
        selectedRowIdsInternal.value.add(rowId);
      }
      lastClickedRowId.value = rowId;
    } else {
      selectedRowIdsInternal.value.clear();
      selectedRowIdsInternal.value.add(rowId);
      lastClickedRowId.value = rowId;
    }
  }
  const selectedData = props.rowData.filter(r => props.rowIdField && selectedRowIdsInternal.value.has((r as any)[props.rowIdField]));
  emit('selectionChanged', new Set(selectedRowIdsInternal.value), selectedData);
}

defineExpose({
  getSelectedRowIds: () => new Set(selectedRowIdsInternal.value),
  getSelectedRowsData: () => {
    if (!props.rowIdField) return [];
    return props.rowData.filter(row => props.rowIdField && selectedRowIdsInternal.value.has((row as any)[props.rowIdField]));
  },
  getEditingCell: () => editingCell.value,
  clearSelection: () => {
    selectedRowIdsInternal.value.clear();
    lastClickedRowId.value = null;
    emit('selectionChanged', new Set(), []);
  },
  setSelectedRowIds: (idsToSelect: (string | number)[] | Set<string | number>) => {
    if (!props.rowIdField) return;
    if (props.selectionMode === 'none') return;
    const newSelectedIds = new Set<string | number>();
    const inputIdSet = new Set(idsToSelect);
    if (props.selectionMode === 'single' && inputIdSet.size > 1) {
      const firstValidIdInData = props.rowData.find(row => {
        const rowId = props.rowIdField && (row as any)[props.rowIdField];
        return rowId !== undefined && rowId !== null && inputIdSet.has(rowId);
      })?.[props.rowIdField!];
      if (firstValidIdInData !== undefined && firstValidIdInData !== null) {
        newSelectedIds.add(firstValidIdInData);
      }
    } else {
      for (const row of props.rowData) {
        const rowId = props.rowIdField && (row as any)[props.rowIdField];
        if (rowId !== undefined && rowId !== null && inputIdSet.has(rowId)) {
          newSelectedIds.add(rowId);
          if (props.selectionMode === 'single') break;
        }
      }
    }
    selectedRowIdsInternal.value = newSelectedIds;
    lastClickedRowId.value = null;
    const selectedData = props.rowData.filter(r => props.rowIdField && selectedRowIdsInternal.value.has((r as any)[props.rowIdField]));
    emit('selectionChanged', new Set(selectedRowIdsInternal.value), selectedData);
  }
});
</script>
