import { ref, watch, nextTick, type Ref } from 'vue';

// Define a generic RowDataItem or import it if available from a shared types definition
export interface RowDataItem {
  [key: string]: any;
}
// Potentially import ColumnDefinition if specific properties like 'editable' are needed
// For now, assume colDef passed to handleCellDblClick is 'any' or has a 'field' and 'editable' property.
export interface ColumnDefinitionForEdit {
  field: string;
  editable?: boolean;
  // any other properties from ColumnDefinition that might be used by getCellValue if it were more complex
}

export interface UseUpGridInlineEditingProps {
  rowIdField: Ref<string | undefined>;
  rowData: Ref<Readonly<RowDataItem[]>>;
  // Props from UpGrid.vue that might influence editing,
  // e.g., a global getCellValue function if it's passed from parent
}

export interface UseUpGridInlineEditingEmit {
  (event: 'cell-value-changed', payload: {
    rowId: string | number;
    field: string;
    oldValue: any;
    newValue: any;
    rowData: RowDataItem; // Full original row data object
    originalRowIndex: number; // Index in the original rowData prop
  }): void;
}

export function useUpGridInlineEditing(
  props: UseUpGridInlineEditingProps,
  emit: UseUpGridInlineEditingEmit
) {
  const editingCell = ref<{ rowId: string | number; field: string } | null>(null);
  const editingCellValue = ref<any>(null);
  const editingInputRef = ref<HTMLInputElement | null>(null);

  // A local getCellValue, assuming simple dot notation.
  // If UpGrid.vue's getCellValue has more complex logic (e.g., formatters), it should be passed in or replicated.
  const getCellValue = (row: RowDataItem, field: string): any => {
    if (!row || typeof field !== 'string') return '';
    return field.split('.').reduce((o, k) => (o || {})[k], row);
  };

  const handleCellDblClick = (row: RowDataItem, colDef: ColumnDefinitionForEdit) => {
    if (!colDef.editable) {
      return;
    }
    if (!props.rowIdField.value) {
      console.warn("UpGrid Editing: 'rowIdField' prop is required for cell editing.");
      return;
    }
    const rowId = row[props.rowIdField.value];
    if (rowId === undefined || rowId === null) {
      console.warn(`UpGrid Editing: 'rowIdField' ("${props.rowIdField.value}") not found in dblclicked row or its value is null/undefined.`);
      return;
    }

    if (editingCell.value && editingCell.value.rowId === rowId && editingCell.value.field === colDef.field) {
      return; // Already editing this cell
    }

    // Potentially commit previous edit here if one was active
    // if (editingCell.value) { saveEdit(); }

    editingCell.value = { rowId: rowId, field: colDef.field };
    editingCellValue.value = getCellValue(row, colDef.field);

    nextTick(() => {
      editingInputRef.value?.focus();
    });
  };

  const saveEdit = () => {
    if (!editingCell.value || !props.rowIdField.value) return;

    const { rowId, field } = editingCell.value;
    const originalRowDataArray = props.rowData.value;
    const originalRowIndex = originalRowDataArray.findIndex(r => r[props.rowIdField.value!] === rowId);

    if (originalRowIndex === -1) {
      console.warn(`UpGrid Editing: Original row data not found for rowId "${rowId}". Cannot save edit.`);
      editingCell.value = null;
      editingCellValue.value = null;
      return;
    }
    const originalRow = originalRowDataArray[originalRowIndex];
    const oldValue = getCellValue(originalRow, field);
    const newValue = editingCellValue.value;

    if (newValue !== oldValue) {
      emit('cell-value-changed', {
        rowId: rowId,
        field: field,
        oldValue: oldValue,
        newValue: newValue,
        rowData: originalRow,
        originalRowIndex: originalRowIndex
      });
    }

    editingCell.value = null;
    editingCellValue.value = null;
  };

  const cancelEdit = () => {
    editingCell.value = null;
    editingCellValue.value = null;
  };

  const handleEditEnter = () => {
    saveEdit();
  };

  const handleEditEscape = () => {
    cancelEdit();
  };

  const handleEditBlur = () => {
    saveEdit(); // Common behavior: save on blur
  };

  // Watcher to automatically focus the input when editingCell changes
  watch(editingCell, (newVal) => {
    if (newVal) {
      nextTick(() => {
        editingInputRef.value?.focus();
      });
    }
  });

  // Watcher to cancel edit if the underlying rowData prop changes externally
  // This helps prevent saving stale data or editing a row that no longer exists in the same state.
  watch(() => props.rowData.value, () => {
    if (editingCell.value) {
        // Check if the currently edited row still exists and is consistent, or just cancel
        // For simplicity here, we'll just cancel. More sophisticated checks could be added.
        const stillEditingRowExists = props.rowData.value.find(r =>
            props.rowIdField.value && r[props.rowIdField.value] === editingCell.value!.rowId
        );
        if (!stillEditingRowExists) {
            cancelEdit();
        }
    }
  }, { deep: true });


  return {
    editingCell,
    editingCellValue,
    editingInputRef,
    handleCellDblClick,
    saveEdit,
    cancelEdit,
    handleEditEnter,
    handleEditEscape,
    handleEditBlur,
    // getCellValue function is not returned as it's mainly an internal helper for this composable
  };
}
