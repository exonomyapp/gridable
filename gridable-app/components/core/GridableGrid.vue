<template>
  <div class="gridable-grid-container" :style="gridContainerStyle">
    <div v-if="!columnDefs || !rowData" class="grid-loading">
      <p>Loading grid data or configuration...</p>
    </div>
    <div v-else class="grid-wrapper" :style="gridWrapperStyle">
      <!-- Header Row -->
      <div class="grid-header-row">
        <div
          v-for="colDef in displayedColumnDefs" <!-- Use displayedColumnDefs -->
          :key="colDef.field"
          class="grid-header-cell"
          :style="[headerCellStyle, { width: colDef.width ? colDef.width + 'px' : 'auto' }]"
          @click="() => sortData(colDef.field)"
          draggable="true" @dragstart="e => handleDragStart(e, colDef.field)" @dragover.prevent @drop="e => handleDrop(e, colDef.field)"
        >
          {{ colDef.headerName }}
          <span v-if="currentSortState.field === colDef.field">
            {{ currentSortState.direction === 'asc' ? '▲' : '▼' }}
          </span>
          <!-- Basic Resizer (conceptual) -->
          <div class="col-resizer" @mousedown="e => initResize(e, colDef.field)"></div>
        </div>
      </div>
      <!-- Data Rows -->
      <div v-if="paginatedData.length === 0" class="grid-no-data">
        <p :style="{ color: theme?.noDataTextColor || '#757575' }">No data to display.</p>
      </div>
      <div
        v-for="(row, rowIndex) in paginatedData"
        :key="'row-' + rowIndex"
        class="grid-data-row"
      >
        <div
          v-for="colDef in displayedColumnDefs" <!-- Use displayedColumnDefs -->
          :key="colDef.field + '-' + rowIndex"
          class="grid-data-cell"
          :style="[dataCellStyle, { 'text-align': colDef.textAlign || 'left', width: colDef.width ? colDef.width + 'px' : 'auto' }]"
        >
          {{ getCellValue(row, colDef.field) }}
        </div>
      </div>
    </div>
    <div v-if="rowData && rowData.length > currentItemsPerPage" class="grid-pagination" :style="paginationStyle">
      <v-btn :disabled="currentPage === 1" @click="prevPage" small>Previous</v-btn>
      <span :style="{ color: theme?.paginationTextColor || 'inherit' }">Page {{ currentPage }} of {{ totalPages }}</span>
      <v-btn :disabled="currentPage === totalPages" @click="nextPage" small>Next</v-btn>
      <v-select
        label="Per Page"
        :items="[5, 10, 20, 50, 100]"
        v-model="currentItemsPerPage"
        @update:modelValue="onItemsPerPageChange"
        density="compact"
        hide-details
        style="max-width: 100px; display: inline-block; margin-left: 15px; font-size: 0.8em;"
      ></v-select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineProps, toRefs, PropType, onMounted, nextTick } from 'vue';
import type { GridTheme } from './GridableGridTheme'; // Assuming theme is separated
import type { GridState } from '~/services/userPreferences'; // Import conceptual GridState

// --- Props ---
interface ColumnDefinition {
  headerName: string;
  field: string;
  textAlign?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean; // Placeholder
  width?: number; // For column width
  visible?: boolean; // For column visibility
}
interface RowDataItem { [key: string]: any; }

const props = defineProps({
  columnDefs: { type: Array as PropType<ColumnDefinition[]>, required: true },
  rowData: { type: Array as PropType<RowDataItem[]>, required: true },
  itemsPerPage: { type: Number, default: 10 },
  theme: { type: Object as PropType<GridTheme>, default: () => ({}) },
  initialGridState: { type: Object as PropType<GridState>, default: () => ({}) },
  viewId: { type: String, default: 'default-view' } // To identify this grid's state for saving
});

const emit = defineEmits(['grid-state-change']);

const { columnDefs, rowData, itemsPerPage, theme, initialGridState, viewId } = toRefs(props);

// --- Internal Reactive State for Grid Customizations ---
const currentSortState = ref(initialGridState.value.sortState || { field: null, direction: 'asc' });
const currentColumnDefs = ref<ColumnDefinition[]>([]); // This will hold ordered, sized, visibility-set columns
const currentItemsPerPage = ref(initialGridState.value.itemsPerPage || itemsPerPage.value);
const currentPage = ref(1); // Not typically saved in initialGridState, but could be

// Initialize currentColumnDefs based on props and initial state
onMounted(() => {
  let orderedFields = initialGridState.value.columnOrder || columnDefs.value.map(c => c.field);
  currentColumnDefs.value = orderedFields.map(field => {
    const baseDef = columnDefs.value.find(cd => cd.field === field);
    if (!baseDef) return null; // Should not happen if columnOrder is valid
    return {
      ...baseDef,
      width: initialGridState.value.columnWidths?.[field] || baseDef.width,
      visible: initialGridState.value.columnVisibility?.[field] !== undefined ? initialGridState.value.columnVisibility[field] : (baseDef.visible !== undefined ? baseDef.visible : true),
    };
  }).filter(cd => cd !== null) as ColumnDefinition[];

  // If initialGridState didn't provide columnOrder, populate from columnDefs prop respecting visibility
  if (!initialGridState.value.columnOrder && columnDefs.value) {
     currentColumnDefs.value = columnDefs.value.map(cd => ({
        ...cd,
        width: initialGridState.value.columnWidths?.[cd.field] || cd.width,
        visible: initialGridState.value.columnVisibility?.[cd.field] !== undefined ? initialGridState.value.columnVisibility[cd.field] : (cd.visible !== undefined ? cd.visible : true),
     }));
  }
});

const displayedColumnDefs = computed(() => {
  return currentColumnDefs.value.filter(cd => cd.visible !== false);
});


// --- Sorting ---
const processedData = computed(() => {
  // ... (sorting logic using currentSortState.value)
  if (!rowData.value) return [];
  let data = [...rowData.value];
  if (currentSortState.value.field) {
    const field = currentSortState.value.field;
    const direction = currentSortState.value.direction === 'asc' ? 1 : -1;
    data.sort((a, b) => {
      const valA = getCellValue(a, field);
      const valB = getCellValue(b, field);
      if (valA < valB) return -1 * direction;
      if (valA > valB) return 1 * direction;
      return 0;
    });
  }
  return data;
});

// --- Pagination ---
const totalPages = computed(() => Math.ceil(processedData.value.length / currentItemsPerPage.value) || 1);
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * currentItemsPerPage.value;
  return processedData.value.slice(start, start + currentItemsPerPage.value);
});

// --- Methods ---
function getCellValue(row: RowDataItem, field: string): any { /* ... */ return field.split('.').reduce((o, i) => o?.[i], row); }

function sortData(field: string) {
  const colDef = displayedColumnDefs.value.find(c => c.field === field);
  if (!colDef || colDef.sortable === false) return;
  if (currentSortState.value.field === field) {
    currentSortState.value.direction = currentSortState.value.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortState.value.field = field;
    currentSortState.value.direction = 'asc';
  }
  currentPage.value = 1;
  notifyGridStateChange();
}

function nextPage() { if (currentPage.value < totalPages.value) currentPage.value++; }
function prevPage() { if (currentPage.value > 1) currentPage.value--; }

function onItemsPerPageChange() {
  currentPage.value = 1;
  notifyGridStateChange();
}

// --- Grid State Change Notification ---
function notifyGridStateChange() {
  const currentState: GridState = {
    columnOrder: currentColumnDefs.value.map(cd => cd.field),
    columnVisibility: Object.fromEntries(currentColumnDefs.value.map(cd => [cd.field, cd.visible !== false])),
    columnWidths: Object.fromEntries(currentColumnDefs.value.filter(cd => cd.width !== undefined).map(cd => [cd.field, cd.width as number])),
    sortState: { ...currentSortState.value },
    itemsPerPage: currentItemsPerPage.value,
    // filterModel: currentFilterModel.value // Placeholder for actual filter model
  };
  // console.log('Grid state changed, emitting:', viewId.value, currentState);
  emit('grid-state-change', { viewId: viewId.value, state: currentState });
  // In a real app, this might also directly call:
  // import { saveViewGridState } from '~/services/userPreferences';
  // import { useAuthStore } from '~/store/auth';
  // const authStore = useAuthStore();
  // if (authStore.currentUser?.did) {
  //   saveViewGridState(viewId.value, authStore.currentUser.did, currentState);
  // }
}

// --- Watchers for external changes ---
watch(rowData, () => { currentPage.value = 1; });
watch(() => props.itemsPerPage, (newVal) => { currentItemsPerPage.value = newVal; currentPage.value = 1; });
watch(() => props.initialGridState, (newState) => {
  // Re-apply initial state if it changes from outside
  currentSortState.value = newState.sortState || { field: null, direction: 'asc' };
  currentItemsPerPage.value = newState.itemsPerPage || props.itemsPerPage;

  let orderedFields = newState.columnOrder || props.columnDefs.map(c => c.field);
  currentColumnDefs.value = orderedFields.map(field => {
    const baseDef = props.columnDefs.find(cd => cd.field === field);
    if (!baseDef) return null;
    return {
      ...baseDef,
      width: newState.columnWidths?.[field] || baseDef.width,
      visible: newState.columnVisibility?.[field] !== undefined ? newState.columnVisibility[field] : (baseDef.visible !== undefined ? baseDef.visible : true),
    };
  }).filter(cd => cd !== null) as ColumnDefinition[];

   if (!newState.columnOrder && props.columnDefs) {
     currentColumnDefs.value = props.columnDefs.map(cd => ({
        ...cd,
        width: newState.columnWidths?.[cd.field] || cd.width,
        visible: newState.columnVisibility?.[cd.field] !== undefined ? newState.columnVisibility[cd.field] : (cd.visible !== undefined ? cd.visible : true),
     }));
  }

  currentPage.value = 1; // Reset page
}, { deep: true });


// --- Column Drag & Drop (Basic Reordering) ---
let draggedField: string | null = null;
function handleDragStart(event: DragEvent, field: string) {
  draggedField = field;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}
function handleDrop(event: DragEvent, targetField: string) {
  if (!draggedField || draggedField === targetField) return;
  const fromIndex = currentColumnDefs.value.findIndex(cd => cd.field === draggedField);
  const toIndex = currentColumnDefs.value.findIndex(cd => cd.field === targetField);
  if (fromIndex === -1 || toIndex === -1) return;

  const item = currentColumnDefs.value.splice(fromIndex, 1)[0];
  currentColumnDefs.value.splice(toIndex, 0, item);
  draggedField = null;
  nextTick(notifyGridStateChange);
}

// --- Column Resizing (Conceptual) ---
// This is a very simplified placeholder. Real resizing is complex.
let resizingField: string | null = null;
let startX: number = 0;
let startWidth: number = 0;

function initResize(event: MouseEvent, field: string) {
  resizingField = field;
  startX = event.clientX;
  const colDef = currentColumnDefs.value.find(cd => cd.field === field);
  startWidth = colDef?.width || (event.target as HTMLElement).parentElement!.offsetWidth; // Approximate

  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
  event.preventDefault(); // Prevent text selection, etc.
}
function doResize(event: MouseEvent) {
  if (!resizingField) return;
  const diffX = event.clientX - startX;
  const newWidth = startWidth + diffX;
  const colDef = currentColumnDefs.value.find(cd => cd.field === resizingField);
  if (colDef) {
    colDef.width = Math.max(50, newWidth); // Min width 50px
  }
}
function stopResize() {
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
  if (resizingField) {
    resizingField = null;
    notifyGridStateChange();
  }
}


// --- Dynamic Grid Styles based on Theme (condensed for brevity) ---
const gridContainerStyle = computed(() => ({ /* ... */ borderColor: theme.value?.gridBorderColor || '#ccc' }));
const gridWrapperStyle = computed(() => ({ 'grid-template-columns': `repeat(${displayedColumnDefs.value?.length || 1}, auto)` })); // Use 'auto' or fr as needed
const headerCellStyle = computed(() => ({ /* ... */ backgroundColor: theme.value?.headerBackgroundColor || '#f5f5f5', color: theme.value?.headerTextColor || 'inherit', borderBottomColor: theme.value?.headerBorderColor || '#ddd', borderRightColor: theme.value?.headerBorderColor || '#ddd' }));
const dataCellStyle = computed(() => ({ /* ... */ color: theme.value?.cellTextColor || 'inherit', borderBottomColor: theme.value?.cellBorderColor || '#eee', borderRightColor: theme.value?.cellBorderColor || '#ddd' }));
const paginationStyle = computed(() => ({ /* ... */ backgroundColor: theme.value?.paginationBackgroundColor || '#f9f9f9', borderTopColor: theme.value?.gridBorderColor || '#ddd' }));

</script>

<style scoped>
/* ... (existing styles, ensure .col-resizer is styled) */
.gridable-grid-container { /* ... */ }
.grid-loading, .grid-no-data { /* ... */ }
.grid-wrapper { display: grid; overflow-x: auto; } /* Added overflow-x for many columns */
.grid-header-row, .grid-data-row { display: contents; }
.grid-header-cell {
  /* ... */
  position: relative; /* For resizer */
  overflow: hidden; /* Prevent text overflow during resize */
}
.grid-header-cell:last-child { border-right: none; }
.grid-data-cell { /* ... */ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grid-data-cell:last-child { border-right: none; }
.grid-data-row:last-child .grid-data-cell { border-bottom: none; }
.grid-pagination { /* ... */ }
.grid-pagination span { /* ... */ }
.col-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  /* background-color: rgba(0,0,255,0.1); */ /* Optional: for visibility during dev */
}
</style>
