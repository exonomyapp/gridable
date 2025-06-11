import { ref, watch, type Ref } from 'vue';

// Define a generic RowDataItem or import it if available from a shared types definition
export interface RowDataItem {
  [key: string]: any;
}

export interface UseUpGridRowSelectionProps {
  selectionMode: Ref<string>; // 'single', 'multiple', 'none'
  rowIdField: Ref<string | undefined>;
  rowData: Ref<Readonly<RowDataItem[]>>;
  paginatedData: Ref<Readonly<RowDataItem[]>>; // For shift-click context
}

export interface UseUpGridRowSelectionEmit {
  (event: 'selectionChanged', selectedIds: Set<string | number>, selectedData: RowDataItem[]): void;
  (event: 'rowClick', row: RowDataItem, mouseEvent: MouseEvent): void;
}

export function useUpGridRowSelection(
  props: UseUpGridRowSelectionProps,
  emit: UseUpGridRowSelectionEmit
) {
  const selectedRowIdsInternal = ref(new Set<string | number>());
  const lastClickedRowId = ref<string | number | null>(null);

  const clearSelection = () => {
    if (selectedRowIdsInternal.value.size > 0 || lastClickedRowId.value !== null) {
      selectedRowIdsInternal.value.clear();
      lastClickedRowId.value = null;
      emit('selectionChanged', new Set(), []);
    }
  };

  const handleRowClick = (row: RowDataItem, event: MouseEvent) => {
    emit('rowClick', { row, event }); // Emit rowClick event first

    if (props.selectionMode.value === 'none') {
      return;
    }

    if (!props.rowIdField.value) {
      console.warn("UpGrid: 'rowIdField' prop is required for selection to work.");
      return;
    }
    const rowId = row[props.rowIdField.value];
    if (rowId === undefined || rowId === null) {
      console.warn(`UpGrid: 'rowIdField' ("${props.rowIdField.value}") not found in clicked row or its value is null/undefined. Cannot process selection.`, row);
      return;
    }

    let selectionChanged = false;
    const oldSelectedSize = selectedRowIdsInternal.value.size;
    const oldSelectedIds = new Set(selectedRowIdsInternal.value);


    if (props.selectionMode.value === 'single') {
      if (!selectedRowIdsInternal.value.has(rowId) || selectedRowIdsInternal.value.size !== 1) {
        selectedRowIdsInternal.value.clear();
        selectedRowIdsInternal.value.add(rowId);
        selectionChanged = true;
      }
      lastClickedRowId.value = rowId;
    } else if (props.selectionMode.value === 'multiple') {
      if (event.shiftKey && lastClickedRowId.value !== null) {
        const paginatedRows = props.paginatedData.value;
        const lastIdx = paginatedRows.findIndex(r => props.rowIdField.value && r[props.rowIdField.value] === lastClickedRowId.value);
        const currentIdx = paginatedRows.findIndex(r => props.rowIdField.value && r[props.rowIdField.value] === rowId);

        if (lastIdx !== -1 && currentIdx !== -1) {
          if (!(event.ctrlKey || event.metaKey)) {
            selectedRowIdsInternal.value.clear();
          }
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          for (let i = start; i <= end; i++) {
            const rowInRange = paginatedRows[i];
            const idInRange = props.rowIdField.value && rowInRange[props.rowIdField.value];
            if (idInRange !== undefined && idInRange !== null) {
              selectedRowIdsInternal.value.add(idInRange);
            }
          }
          // Anchor (`lastClickedRowId`) is not updated on Shift+click to allow further range selections from the same anchor.
        }
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
      // Check if selection actually changed for multiple mode
      if (selectedRowIdsInternal.value.size !== oldSelectedSize || !Array.from(oldSelectedIds).every(id => selectedRowIdsInternal.value.has(id))) {
          selectionChanged = true;
      }

    }

    if (selectionChanged || (props.selectionMode.value === 'single' && !oldSelectedIds.has(rowId))) {
         const fullRowData = props.rowData.value;
         const selectedData = fullRowData.filter(r => props.rowIdField.value && r.hasOwnProperty(props.rowIdField.value) && selectedRowIdsInternal.value.has(r[props.rowIdField.value]));
         emit('selectionChanged', new Set(selectedRowIdsInternal.value), selectedData);
    }
  };

  const getSelectedRowIds = (): Set<string | number> => {
    return new Set(selectedRowIdsInternal.value);
  };

  const getSelectedRowsData = (): RowDataItem[] => {
    if (!props.rowIdField.value) {
      // console.warn("UpGrid: 'rowIdField' prop is required for getSelectedRowsData().");
      return [];
    }
    const fullRowData = props.rowData.value;
    return fullRowData.filter(row => props.rowIdField.value && row.hasOwnProperty(props.rowIdField.value) && selectedRowIdsInternal.value.has(row[props.rowIdField.value]));
  };

  const setSelectedRowIds = (idsToSelect: (string | number)[] | Set<string | number>) => {
    if (!props.rowIdField.value) {
      console.warn("UpGrid: 'rowIdField' prop is required to use setSelectedRowIds().");
      return;
    }
    if (props.selectionMode.value === 'none') {
      console.warn("UpGrid: Cannot set selection when selectionMode is 'none'.");
      return;
    }

    const newSelectedIds = new Set<string | number>();
    const inputIdSet = new Set(idsToSelect);
    const fullRowData = props.rowData.value;

    if (props.selectionMode.value === 'single' && inputIdSet.size > 1) {
      console.warn("UpGrid: setSelectedRowIds called with multiple IDs in 'single' selection mode. Only the first valid ID will be selected.");
      const firstValidIdInData = fullRowData.find(row => {
        const rowIdVal = props.rowIdField.value && row[props.rowIdField.value];
        return rowIdVal !== undefined && rowIdVal !== null && inputIdSet.has(rowIdVal);
      })?.[props.rowIdField.value!];

      if (firstValidIdInData !== undefined && firstValidIdInData !== null) {
        newSelectedIds.add(firstValidIdInData);
      }
    } else {
      for (const row of fullRowData) {
        const rowIdVal = props.rowIdField.value && row[props.rowIdField.value];
        if (rowIdVal !== undefined && rowIdVal !== null && inputIdSet.has(rowIdVal)) {
          newSelectedIds.add(rowIdVal);
          if (props.selectionMode.value === 'single' && newSelectedIds.size === 1) {
            break;
          }
        }
      }
    }

    selectedRowIdsInternal.value = newSelectedIds;
    lastClickedRowId.value = null;

    const selectedData = fullRowData.filter(r => props.rowIdField.value && r.hasOwnProperty(props.rowIdField.value) && selectedRowIdsInternal.value.has(r[props.rowIdField.value]));
    emit('selectionChanged', new Set(selectedRowIdsInternal.value), selectedData);
  };

  watch(() => props.rowData.value, () => {
    // Validate selected IDs against new rowData and remove any that no longer exist
    if (!props.rowIdField.value) return;
    const currentSelected = Array.from(selectedRowIdsInternal.value);
    let changed = false;
    for (const selectedId of currentSelected) {
        const exists = props.rowData.value.some(row => row[props.rowIdField.value!] === selectedId);
        if (!exists) {
            selectedRowIdsInternal.value.delete(selectedId);
            changed = true;
        }
    }
    if (lastClickedRowId.value !== null) {
        const exists = props.rowData.value.some(row => row[props.rowIdField.value!] === lastClickedRowId.value);
        if (!exists) {
            lastClickedRowId.value = null; // No direct emit change for this, it's an internal anchor
        }
    }
    if (changed) {
        const selectedData = props.rowData.value.filter(r => props.rowIdField.value && r.hasOwnProperty(props.rowIdField.value) && selectedRowIdsInternal.value.has(r[props.rowIdField.value!]));
        emit('selectionChanged', new Set(selectedRowIdsInternal.value), selectedData);
    }
  }, { deep: true }); // Deep watch might be heavy if rowData is very large/frequently changed for other reasons.

  watch(() => props.selectionMode.value, (newMode, oldMode) => {
    if (newMode !== oldMode) {
      clearSelection(); // This will emit selectionChanged with empty set
    }
  });

  return {
    selectedRowIdsInternal, // Exposed for direct v-model or :class binding in parent if needed.
    // lastClickedRowId, // Generally internal, not needed by parent.
    handleRowClick,
    getSelectedRowIds,
    getSelectedRowsData,
    clearSelection,
    setSelectedRowIds,
  };
}
