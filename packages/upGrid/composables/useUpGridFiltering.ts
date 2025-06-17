import { ref, computed, watch, type Ref } from 'vue';

export interface RowDataItem {
  [key: string]: any;
}

// This should align with the ColumnDefinition in UpGrid.vue or a shared types file
export interface ColumnDefinitionForFiltering {
  field: string;
  filter?: boolean | 'text' | 'number'; // Indicates if column is filterable and its general type
  filterParams?: {
    filterType?: 'text' | 'number'; // More specific type for filter operation
    condition?: 'contains' | 'startsWith' | 'equals' | 'notEqual' | 'greaterThan' | 'lessThan' | 'inRange';
  };
  // Optional: if a custom value getter is needed for filtering specific columns
  // getCellValueForFilter?: (row: RowDataItem) => any;
}

// This structure should match `currentFilterModel` from UpGrid.vue
export interface ActiveFilterModel {
  [field: string]: {
    filterType: 'text' | 'number';
    condition: 'contains' | 'startsWith' | 'equals' | 'notEqual' | 'greaterThan' | 'lessThan' | 'inRange';
    filter?: any;       // Primary filter value
    filterTo?: any;     // Secondary value for 'inRange'
  };
}

export interface UseUpGridFilteringProps {
  initialFilterModel: Ref<ActiveFilterModel | undefined>;
  // Column definitions are needed to know how to filter each column (e.g., type, specific conditions)
  columnDefs: Ref<Readonly<ColumnDefinitionForFiltering[]>>;
  datasetToFilter: Ref<Readonly<RowDataItem[]>>; // Data before filtering (e.g., raw rowData)
}

export interface UseUpGridFilteringEmit {
  (event: 'filterModelChanged', newFilterModel: ActiveFilterModel): void;
}

export function useUpGridFiltering(
  props: UseUpGridFilteringProps,
  emit: UseUpGridFilteringEmit
) {
  const activeFilterModel = ref<ActiveFilterModel>(
    props.initialFilterModel?.value ? JSON.parse(JSON.stringify(props.initialFilterModel.value)) : {}
  );

  const getCellValue = (row: RowDataItem, field: string): any => {
    // This is a simplified getCellValue. If UpGrid.vue's version is more complex
    // (e.g., handles nested paths differently or has specific formatters for filtering),
    // that logic would need to be replicated or the function passed in.
    return field.split('.').reduce((o, i) => (o || {})[i], row);
  };

  const filteredData = computed(() => {
    const filters = activeFilterModel.value;
    const filterKeys = Object.keys(filters).filter(key => {
      const f = filters[key];
      return f && f.filter !== undefined && f.filter !== '' && f.filter !== null;
    });

    if (filterKeys.length === 0) {
      return props.datasetToFilter.value;
    }

    return props.datasetToFilter.value.filter(row => {
      return filterKeys.every(field => {
        const filterDetail = filters[field];
        // Find column definition to get filterParams if not directly in filterDetail
        const colDef = props.columnDefs.value.find(c => c.field === field);
        const filterType = filterDetail.filterType || colDef?.filterParams?.filterType || 'text';
        const condition = filterDetail.condition || colDef?.filterParams?.condition || (filterType === 'text' ? 'contains' : 'equals');

        const cellValue = getCellValue(row, field);

        if (cellValue === undefined || cellValue === null) return false;

        let cellValProcessed = cellValue;
        let filterValProcessed = filterDetail.filter;
        let filterToValProcessed = filterDetail.filterTo;

        if (filterType === 'text') {
          cellValProcessed = String(cellValue).toLowerCase();
          filterValProcessed = String(filterDetail.filter).toLowerCase();
        } else if (filterType === 'number') {
          cellValProcessed = parseFloat(String(cellValue));
          filterValProcessed = parseFloat(String(filterDetail.filter));
          if (filterDetail.filterTo !== undefined && filterDetail.filterTo !== null) {
            filterToValProcessed = parseFloat(String(filterDetail.filterTo));
          }
        }
        // Add other type processing (e.g., date) if necessary

        switch (condition) {
          case 'contains':
            return filterType === 'text' && cellValProcessed.includes(filterValProcessed);
          case 'startsWith':
            return filterType === 'text' && cellValProcessed.startsWith(filterValProcessed);
          case 'equals':
            return cellValProcessed === filterValProcessed;
          case 'notEqual':
            return cellValProcessed !== filterValProcessed;
          case 'greaterThan':
            return filterType === 'number' && cellValProcessed > filterValProcessed;
          case 'lessThan':
            return filterType === 'number' && cellValProcessed < filterValProcessed;
          case 'inRange':
            return filterType === 'number' &&
                   filterToValProcessed !== undefined && // Ensure filterTo is defined for range
                   cellValProcessed >= filterValProcessed &&
                   cellValProcessed <= filterToValProcessed;
          default:
            console.warn(`Unknown filter condition: ${condition}`);
            return true;
        }
      });
    });
  });

  const applyColumnFilter = (
    field: string,
    value: any,
    filterTypeFromParam?: 'text' | 'number',
    conditionFromParam?: ActiveFilterModel[string]['condition']
    // Note: UpGrid.vue also had a filterToValue for range, but it's not directly used by applyColumnFilter's signature.
    // It's part of the filterModel structure. If UI provides filterTo, it should be included when setting activeFilterModel.value[field]
  ) => {
    const colDef = props.columnDefs.value.find(c => c.field === field);
    const resolvedFilterType = filterTypeFromParam || colDef?.filterParams?.filterType || 'text';
    const resolvedCondition = conditionFromParam || colDef?.filterParams?.condition || (resolvedFilterType === 'text' ? 'contains' : 'equals');

    if (value === '' || value === null || value === undefined) {
      if (activeFilterModel.value[field]) {
        delete activeFilterModel.value[field];
        emit('filterModelChanged', { ...activeFilterModel.value });
      }
    } else {
      // For range filters, the UI would need to supply both 'filter' and 'filterTo'
      // This basic applyColumnFilter assumes 'value' is the primary 'filter' value.
      // A more complex setup might involve passing an object for 'value' or separate args for 'filterTo'.
      activeFilterModel.value[field] = {
        filterType: resolvedFilterType,
        condition: resolvedCondition,
        filter: value
        // filterTo would need to be handled if the UI for setting range sends it
      };
      emit('filterModelChanged', { ...activeFilterModel.value });
    }
  };

  const clearAllFilters = () => {
    if (Object.keys(activeFilterModel.value).length > 0) {
      activeFilterModel.value = {};
      emit('filterModelChanged', {});
    }
  };

  // Watch for external changes to initialFilterModel
  watch(props.initialFilterModel, (newState) => {
    activeFilterModel.value = newState ? JSON.parse(JSON.stringify(newState)) : {};
    // No emit here as this is an external state update
  }, { deep: true });

  return {
    activeFilterModel: computed(() => activeFilterModel.value),
    filteredData,
    applyColumnFilter,
    clearAllFilters,
    // UI-specific states like 'activeFilterField' and 'filterInputValue' from UpGrid.vue
    // would typically remain in the component itself, as they manage the filter input UI.
  };
}
