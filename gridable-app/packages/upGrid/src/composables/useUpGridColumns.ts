import { ref, computed, watch, type Ref, type WritableComputedRef } from 'vue';

// Assuming ColumnDefinition and GridState are imported from appropriate paths if they are complex types.
// For this adaptation, we'll define simplified local versions or use 'any'.

export interface ColumnDefinition {
  headerName: string;
  field: string;
  textAlign?: 'left' | 'center' | 'right';
  sortable?: boolean;
  width?: number;
  minWidth?: number;
  visible?: boolean;
  cellRenderer?: 'checkbox' | string;
  editable?: boolean;
  filter?: boolean | 'text' | 'number';
  filterParams?: {
    filterType?: 'text' | 'number';
    condition?: 'contains' | 'startsWith' | 'equals' | 'notEqual' | 'greaterThan' | 'lessThan' | 'inRange';
  };
  // Internal properties added by the composable
  _internalWidth?: number; // Actual current width after resize
  _internalVisible?: boolean; // Actual current visibility
  // _internalOrder?: number; // If we manage order explicitly with a number
}

export interface GridColumnState {
  field: string;
  width: number;
  visible: boolean;
  // order: number; // If order is managed by an explicit number
}

export interface UseUpGridColumnsProps {
  columnDefs: Ref<Readonly<ColumnDefinition[]>>; // Original column definitions from props
  initialGridState: Ref<{ // Simplified GridState for what this composable cares about
    columnOrder?: string[];
    columnVisibility?: { [field: string]: boolean };
    columnWidths?: { [field: string]: number };
  } | undefined>;
}

export interface UseUpGridColumnsEmit {
  (event: 'columnStateChanged', changedState: { // Emits specific changes for parent to aggregate into full GridState
    type: 'visibility' | 'order' | 'width';
    field?: string; // For visibility and width
    order?: string[]; // For order
    value?: boolean | number; // For visibility or width
  }): void;
}

export function useUpGridColumns(
  props: UseUpGridColumnsProps,
  emit: UseUpGridColumnsEmit
) {
  const internalColumnDefs = ref<ColumnDefinition[]>([]);

  const displayedColumnDefs = computed(() => {
    return internalColumnDefs.value.filter(cd => cd._internalVisible !== false);
    // Note: Sorting by an explicit '_internalOrder' would happen here if implemented
  });

  // Helper to deep clone and initialize internal column properties
  function initializeInternalDefs(baseDefs: Readonly<ColumnDefinition[]>, initialState?: UseUpGridColumnsProps['initialGridState']['value']) {
    let orderedFields = initialState?.columnOrder || baseDefs.map(c => c.field);

    const newInternalDefs = orderedFields.map(field => {
      const baseDef = baseDefs.find(cd => cd.field === field);
      if (!baseDef) return null; // Should not happen if orderedFields is derived from baseDefs

      let isVisible = baseDef.visible !== false; // Default to true if not specified
      if (initialState?.columnVisibility && initialState.columnVisibility[field] !== undefined) {
        isVisible = initialState.columnVisibility[field];
      }

      let currentWidth = initialState?.columnWidths?.[field] || baseDef.width || baseDef.minWidth || 150; // Default width logic

      return {
        ...baseDef,
        _internalWidth: currentWidth,
        _internalVisible: isVisible,
      };
    }).filter(cd => cd !== null) as ColumnDefinition[];

    // Ensure any columns not in orderedFields (e.g. new columns added to props.columnDefs) are appended
    baseDefs.forEach(baseDef => {
        if (!newInternalDefs.find(cd => cd.field === baseDef.field)) {
            newInternalDefs.push({
                ...baseDef,
                _internalWidth: baseDef.width || baseDef.minWidth || 150,
                _internalVisible: baseDef.visible !== false,
            });
        }
    });
    internalColumnDefs.value = newInternalDefs;
  }


  watch([props.columnDefs, props.initialGridState], ([newColDefs, newInitialState]) => {
    initializeInternalDefs(newColDefs, newInitialState);
  }, { immediate: true, deep: true });


  const toggleColumnVisibility = (field: string) => {
    const columnIndex = internalColumnDefs.value.findIndex(col => col.field === field);
    if (columnIndex !== -1) {
      const col = internalColumnDefs.value[columnIndex];
      // Ensure not hiding the last visible column
      if (col._internalVisible === true) { // only proceed if it's currently visible
        const visibleCols = internalColumnDefs.value.filter(c => c._internalVisible !== false);
        if (visibleCols.length <= 1) {
            // console.warn("Cannot hide the last visible column."); // Or use a toast/notification
            alert("Cannot hide the last visible column."); // Alert for now, as in original
            return;
        }
      }
      col._internalVisible = !(col._internalVisible !== false); // Toggle
      internalColumnDefs.value.splice(columnIndex, 1, { ...col }); // Force reactivity on array element
      emit('columnStateChanged', { type: 'visibility', field, value: col._internalVisible });
    }
  };

  // --- Column Resizing State & Logic ---
  const isResizingColumn = ref(false);
  const resizingColumnField = ref<string | null>(null); // Store field instead of index for stability
  const columnResizeStartX = ref(0);
  const columnResizeStartWidth = ref(0);
  // resizeIndicatorLeft is purely a temporary UI effect, might be better handled in component if it needs DOM access for position

  const initColumnResize = (event: MouseEvent, field: string) => {
    const colDef = internalColumnDefs.value.find(c => c.field === field);
    if (!colDef || colDef._internalVisible === false) return;

    isResizingColumn.value = true;
    resizingColumnField.value = field;
    columnResizeStartX.value = event.clientX;
    columnResizeStartWidth.value = colDef._internalWidth || colDef.minWidth || 50;

    // Add global listeners for mousemove and mouseup
    document.addEventListener('mousemove', handleGlobalMouseMoveForResize);
    document.addEventListener('mouseup', handleGlobalMouseUpForResize);
  };

  const handleGlobalMouseMoveForResize = (event: MouseEvent) => {
    if (!isResizingColumn.value || !resizingColumnField.value) return;
    event.preventDefault(); // Prevent text selection, etc.

    const colDefIndex = internalColumnDefs.value.findIndex(c => c.field === resizingColumnField.value);
    if (colDefIndex === -1) return;

    const colDef = internalColumnDefs.value[colDefIndex];
    const minWidth = colDef.minWidth || 50;
    const newWidth = columnResizeStartWidth.value + (event.clientX - columnResizeStartX.value);

    colDef._internalWidth = Math.max(newWidth, minWidth);
    // No splice needed if internalWidth is reactive, but if not, force update:
    // internalColumnDefs.value.splice(colDefIndex, 1, {...colDef});
    // Forcing update for safety, as _internalWidth might not be initially reactive on the object itself
    internalColumnDefs.value[colDefIndex] = { ...colDef, _internalWidth: Math.max(newWidth, minWidth) };


  };

  const handleGlobalMouseUpForResize = () => {
    if (isResizingColumn.value && resizingColumnField.value) {
      const colDef = internalColumnDefs.value.find(c => c.field === resizingColumnField.value);
      if (colDef) {
         emit('columnStateChanged', { type: 'width', field: resizingColumnField.value, value: colDef._internalWidth });
      }
    }
    isResizingColumn.value = false;
    resizingColumnField.value = null;
    document.removeEventListener('mousemove', handleGlobalMouseMoveForResize);
    document.removeEventListener('mouseup', handleGlobalMouseUpForResize);
  };

  // --- Column Drag & Drop State & Logic ---
  const draggedColumnField = ref<string | null>(null);
  const dragOverColumnField = ref<string | null>(null); // For visual feedback

  const handleColumnDragStart = (event: DragEvent, field: string) => {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', field); // Set data for drop
    }
    draggedColumnField.value = field;
  };

  const handleColumnDragOver = (event: DragEvent, targetField: string) => {
    event.preventDefault(); // Necessary to allow drop
    if (draggedColumnField.value && draggedColumnField.value !== targetField) {
      dragOverColumnField.value = targetField;
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    } else {
      dragOverColumnField.value = null; // Don't highlight if dragging over itself
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    }
  };

  const handleColumnDragLeave = (event: DragEvent, targetField: string) => {
     if (dragOverColumnField.value === targetField) {
        dragOverColumnField.value = null;
     }
  };

  const handleColumnDrop = (event: DragEvent, targetField: string) => {
    event.preventDefault();
    const sourceField = draggedColumnField.value;
    dragOverColumnField.value = null; // Clear visual cue
    draggedColumnField.value = null;  // Clear dragged state

    if (sourceField && sourceField !== targetField) {
      const defs = [...internalColumnDefs.value];
      const sourceIndex = defs.findIndex(col => col.field === sourceField);
      const targetIndex = defs.findIndex(col => col.field === targetField);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        const [movedItem] = defs.splice(sourceIndex, 1);
        defs.splice(targetIndex, 0, movedItem);
        internalColumnDefs.value = defs; // Trigger reactivity
        emit('columnStateChanged', { type: 'order', order: defs.map(cd => cd.field) });
      }
    }
  };

  const handleGlobalDragEnd = () => { // Clean up if drag ends outside a valid drop target
      draggedColumnField.value = null;
      dragOverColumnField.value = null;
  };


  const getColumnStateForPersistence = () => {
    return {
      columnOrder: internalColumnDefs.value.map(cd => cd.field),
      columnVisibility: Object.fromEntries(internalColumnDefs.value.map(cd => [cd.field, cd._internalVisible !== false])),
      columnWidths: Object.fromEntries(internalColumnDefs.value.map(cd => [cd.field, cd._internalWidth as number])),
    };
  };

  // loadGridState might be better handled via watching initialGridState as done in initializeInternalDefs

  return {
    internalColumnDefs, // The main reactive array of column definitions
    displayedColumnDefs, // Computed property for visible columns

    toggleColumnVisibility,

    // Resizing
    isResizingColumn, // For UI feedback if needed
    initColumnResize,
    // Global mouse move/up for resize are handled internally by adding/removing listeners

    // Drag & Drop
    draggedColumnField, // For UI feedback
    dragOverColumnField, // For UI feedback
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragLeave,
    handleColumnDrop,
    handleGlobalDragEnd, // To clean up drag state

    getColumnStateForPersistence, // To get serializable state
  };
}
