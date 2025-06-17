import { ref, computed, watch, type Ref } from 'vue';

export interface RowDataItem {
  [key: string]: any;
}

export interface ColumnDefinitionSortable {
  field: string;
  sortable?: boolean;
  // Add other ColumnDefinition properties if the sorting logic relies on them (e.g., a custom comparator)
}

export interface SortState {
  field: string | null;
  direction: 'asc' | 'desc' | null;
}

export interface UseUpGridSortingProps {
  initialSortState: Ref<SortState | undefined>;
  datasetToSort: Ref<Readonly<RowDataItem[]>>; // This is the data that needs sorting (e.g., after filtering)
  columnDefs: Ref<Readonly<ColumnDefinitionSortable[]>>; // Needed to check if a column is sortable
}

export interface UseUpGridSortingEmit {
  (event: 'sortChanged', newSortState: SortState): void;
}

export function useUpGridSorting(
  props: UseUpGridSortingProps,
  emit: UseUpGridSortingEmit
) {
  const currentSortState = ref<SortState>(
    props.initialSortState?.value
    ? { ...props.initialSortState.value }
    : { field: null, direction: null }
  );

  const sortedData = computed(() => {
    const { field, direction } = currentSortState.value;
    if (!field || !direction) {
      return props.datasetToSort.value; // Return original data if no sort is active
    }

    const sorted = [...props.datasetToSort.value]; // Create a shallow copy to sort

    // Find the column definition to check for custom comparators or data types if needed in future
    // const column = props.columnDefs.value.find(c => c.field === field);

    sorted.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      // Basic type handling for sorting
      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        // Numbers are fine
      } else {
        // Fallback for mixed types or other types: convert to string
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) {
        return direction === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  });

  const handleSort = (field: string) => {
    const column = props.columnDefs.value.find(c => c.field === field);
    if (!column || column.sortable === false) { // Check if column is explicitly not sortable
        // If sortable property is undefined, assume it is sortable by default.
        // Only skip if sortable is explicitly false.
      return;
    }

    let newDirection: 'asc' | 'desc';
    if (currentSortState.value.field === field) {
      newDirection = currentSortState.value.direction === 'asc' ? 'desc' : 'asc';
    } else {
      newDirection = 'asc';
    }
    currentSortState.value = { field, direction: newDirection };
    emit('sortChanged', { ...currentSortState.value });
  };

  const clearSort = () => {
    if (currentSortState.value.field !== null || currentSortState.value.direction !== null) {
      currentSortState.value = { field: null, direction: null };
      emit('sortChanged', { ...currentSortState.value });
    }
  };

  // Watch for external changes to initialSortState (e.g., loaded from grid state)
  watch(props.initialSortState, (newState) => {
    if (newState) {
      if (newState.field !== currentSortState.value.field || newState.direction !== currentSortState.value.direction) {
        currentSortState.value = { ...newState };
        // Note: No emit here as this is an external state update, not a user interaction
      }
    } else if (currentSortState.value.field !== null) { // If new state is undefined/null, clear sort
        currentSortState.value = { field: null, direction: null };
    }
  }, { deep: true });


  return {
    sortColumn: computed(() => currentSortState.value.field),
    sortDirection: computed(() => currentSortState.value.direction),
    currentSortState: computed(() => ({...currentSortState.value })), // Readonly version for external use
    sortedData,
    handleSort,
    clearSort,
  };
}
