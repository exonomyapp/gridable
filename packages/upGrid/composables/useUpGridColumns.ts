import { ref, computed, watch, type Ref, type ComputedRef, nextTick } from 'vue';

// Assuming ColumnDefinition and GridState are imported from appropriate paths if they are complex types.
// For this adaptation, we'll define simplified local versions or use 'any'.

export interface ColumnDefinition {
  headerName: string;
  field: string;
  textAlign?: 'left' | 'center' | 'right';
  sortable?: boolean;
  width?: number; // Initial/default width
  minWidth?: number;
  visible?: boolean; // Initial visibility
  cellRenderer?: 'checkbox' | string;
  editable?: boolean;
  filter?: boolean | 'text' | 'number';
  filterParams?: {
    filterType?: 'text' | 'number';
    condition?: 'contains' | 'startsWith' | 'equals' | 'notEqual' | 'greaterThan' | 'lessThan' | 'inRange';
  };
  // Internal properties added by this composable
  _internalWidth?: number;
  _internalVisible?: boolean;
  // _internalOrder?: number; // Can be inferred from array position
}

export interface GridStateForColumns { // Relevant parts of GridState
    columnOrder?: string[];
    columnVisibility?: { [field: string]: boolean };
    columnWidths?: { [field: string]: number };
}

export interface UseUpGridColumnsProps {
  columnDefs: Ref<Readonly<ColumnDefinition[]>>; // Original column definitions from props
  initialGridState: Ref<GridStateForColumns | undefined>; // For loading column order, visibility, widths
}

export interface UseUpGridColumnsEmit {
  // Emits parts of the grid state that change, allowing parent to reconstruct full GridState
  (event: 'columnStateChanged', payload: {
    order?: string[];
    visibility?: { field: string; visible: boolean };
    width?: { field: string; width: number };
  }): void;
}

export function useUpGridColumns(
  props: UseUpGridColumnsProps,
  emit: UseUpGridColumnsEmit
) {
  const internalColumnDefs = ref<ColumnDefinition[]>([]);

  // Helper to get a clean version of a base ColDef, ensuring defaults
  const createInternalColDef = (baseDef: ColumnDefinition, initialState?: GridStateForColumns): ColumnDefinition => {
    let isVisible = baseDef.visible !== false; // Default to true if 'visible' prop is not explicitly false
    if (initialState?.columnVisibility && initialState.columnVisibility[baseDef.field] !== undefined) {
      isVisible = initialState.columnVisibility[baseDef.field];
    }

    let currentWidth = initialState?.columnWidths?.[baseDef.field] || baseDef.width || baseDef.minWidth || 150;

    return {
      ...baseDef,
      _internalWidth: currentWidth,
      _internalVisible: isVisible,
    };
  };

  watch([props.columnDefs, props.initialGridState], ([newBaseDefs, newInitialState]) => {
    let processedDefs: ColumnDefinition[];
    const order = newInitialState?.columnOrder;

    if (order && order.length > 0 && newBaseDefs.length > 0) { // Ensure newBaseDefs is not empty for meaningful ordering
      processedDefs = order.map(field => {
        const baseDef = newBaseDefs.find(cd => cd.field === field);
        if (baseDef) {
          return createInternalColDef(baseDef, newInitialState);
        }
        return null;
      }).filter(cd => cd !== null) as ColumnDefinition[];

      // Add any new columns from newBaseDefs not present in 'order'
      newBaseDefs.forEach(baseDef => {
        if (!processedDefs.find(pd => pd.field === baseDef.field)) {
          processedDefs.push(createInternalColDef(baseDef, newInitialState));
        }
      });
    } else {
      // No order in initial state or no base defs, process based on props.columnDefs order
      processedDefs = newBaseDefs.map(baseDef => createInternalColDef(baseDef, newInitialState));
    }
    internalColumnDefs.value = processedDefs;
  }, { immediate: true, deep: true });


  const displayedColumnDefs = computed(() => {
    return internalColumnDefs.value.filter(cd => cd._internalVisible !== false);
    // Note: Sorting by an explicit '_internalOrder' would happen here if implemented
  });

  const toggleColumnVisibility = (field: string) => {
    const col = internalColumnDefs.value.find(c => c.field === field);
    if (col) {
      const currentVisibility = col._internalVisible !== false;
      if (currentVisibility === true) { // only proceed if it's currently visible and we are trying to hide it
        const visibleCols = internalColumnDefs.value.filter(c => c._internalVisible !== false);
        if (visibleCols.length <= 1) {
            alert("Cannot hide the last visible column.");
            return;
        }
      }
      col._internalVisible = !currentVisibility; // Toggle
      // No need to splice, direct mutation on ref content object property is reactive
      emit('columnStateChanged', { visibility: { field, visible: col._internalVisible } });
    }
  };

  // --- Column Resizing State & Logic ---
  const isResizingColumn = ref(false);
  const resizingColumnField = ref<string | null>(null);
  const columnResizeStartX = ref(0);
  const columnResizeStartWidth = ref(0);

  const initColumnResize = (event: MouseEvent, field: string) => {
    const colDef = internalColumnDefs.value.find(c => c.field === field);
    if (!colDef || colDef._internalVisible === false) return;

    isResizingColumn.value = true;
    resizingColumnField.value = field;
    columnResizeStartX.value = event.clientX;
    columnResizeStartWidth.value = colDef._internalWidth || colDef.minWidth || 50;

    document.addEventListener('mousemove', handleGlobalMouseMoveForResize);
    document.addEventListener('mouseup', handleGlobalMouseUpForResize);
  };

  const handleGlobalMouseMoveForResize = (event: MouseEvent) => {
    if (!isResizingColumn.value || !resizingColumnField.value) return;
    event.preventDefault();

    const colDef = internalColumnDefs.value.find(c => c.field === resizingColumnField.value);
    if (!colDef) return;

    const minWidth = colDef.minWidth || 50;
    const newWidth = columnResizeStartWidth.value + (event.clientX - columnResizeStartX.value);

    colDef._internalWidth = Math.max(newWidth, minWidth);
  };

  const handleGlobalMouseUpForResize = () => {
    if (isResizingColumn.value && resizingColumnField.value) {
      const colDef = internalColumnDefs.value.find(c => c.field === resizingColumnField.value);
      if (colDef) {
         emit('columnStateChanged', { width: { field: resizingColumnField.value, width: colDef._internalWidth! } });
      }
    }
    isResizingColumn.value = false;
    resizingColumnField.value = null;
    document.removeEventListener('mousemove', handleGlobalMouseMoveForResize);
    document.removeEventListener('mouseup', handleGlobalMouseUpForResize);
  };

  // --- Column Drag & Drop State & Logic ---
  const draggedColumnField = ref<string | null>(null);
  const dragOverColumnField = ref<string | null>(null);

  const handleColumnDragStart = (event: DragEvent, field: string) => {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', field);
    }
    draggedColumnField.value = field;
  };

  const handleColumnDragOver = (event: DragEvent, targetField: string) => {
    event.preventDefault();
    if (draggedColumnField.value && draggedColumnField.value !== targetField) {
      dragOverColumnField.value = targetField;
      if(event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    } else {
      dragOverColumnField.value = null;
      if(event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    }
  };

  const handleColumnDragLeave = (targetField: string) => {
     if (dragOverColumnField.value === targetField) {
        dragOverColumnField.value = null;
     }
  };

  const handleColumnDrop = (event: DragEvent, targetField: string) => {
    event.preventDefault();
    const sourceField = draggedColumnField.value;
    dragOverColumnField.value = null;
    draggedColumnField.value = null;

    if (sourceField && sourceField !== targetField) {
      const defs = [...internalColumnDefs.value];
      const sourceIndex = defs.findIndex(col => col.field === sourceField);
      const targetIndex = defs.findIndex(col => col.field === targetField);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        const [movedItem] = defs.splice(sourceIndex, 1);
        defs.splice(targetIndex, 0, movedItem);
        internalColumnDefs.value = defs;
        emit('columnStateChanged', { order: defs.map(cd => cd.field) });
      }
    }
  };

  const handleGlobalDragEnd = () => {
      draggedColumnField.value = null;
      dragOverColumnField.value = null;
  };

  const getColumnStateForPersistence = (): GridStateForColumns => {
    return {
      columnOrder: internalColumnDefs.value.map(cd => cd.field),
      columnVisibility: Object.fromEntries(internalColumnDefs.value.map(cd => [cd.field, cd._internalVisible !== false])),
      columnWidths: Object.fromEntries(internalColumnDefs.value.map(cd => [cd.field, cd._internalWidth || cd.width || cd.minWidth || 150])),
    };
  };

  return {
    internalColumnDefs: computed(() => internalColumnDefs.value), // Expose as computed for primarily readonly access from parent
    displayedColumnDefs,

    toggleColumnVisibility,

    isResizingColumn: computed(() => isResizingColumn.value),
    resizingColumnField: computed(() => resizingColumnField.value),
    initColumnResize,

    draggedColumnField: computed(() => draggedColumnField.value),
    dragOverColumnField: computed(() => dragOverColumnField.value),
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragLeave,
    handleColumnDrop,
    handleGlobalDragEnd,

    getColumnStateForPersistence,
  };
}
