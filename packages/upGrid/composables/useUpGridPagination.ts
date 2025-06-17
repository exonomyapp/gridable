import { ref, computed, watch, type Ref } from 'vue';
import type { RowDataItem } from '../types';

export interface UseUpGridPaginationProps {
  // Renamed from 'itemsPerPage' in UpGrid.vue props to 'initialItemsPerPage' for clarity in composable
  initialItemsPerPage: Ref<number | undefined>;
  // The 'processedData' from UpGrid.vue (data after filtering and sorting) will be passed as 'datasetToPaginate'
  datasetToPaginate: Ref<Readonly<RowDataItem[]>>;
  // The 'currentItemsPerPage' from UpGrid.vue's template v-select will be managed by this composable.
  // The options for this v-select can be passed directly if needed, or handled by parent.
  // For now, we assume the options are static or managed outside this composable's direct concern,
  // but the composable will manage the 'itemsPerPage' value itself.
}

export interface UseUpGridPaginationEmit {
  // Emitted when itemsPerPage changes, so parent can update its state if needed (e.g., for saving grid state)
  (event: 'itemsPerPageChanged', newItemsPerPage: number): void;
}


export function useUpGridPagination(
  props: UseUpGridPaginationProps,
  emit: UseUpGridPaginationEmit
) {
  const currentPage = ref(1);
  // Initialize itemsPerPage from initialGridState.itemsPerPage (via UpGrid.vue's currentItemsPerPage initial value)
  // or the prop 'itemsPerPage' (which we've named initialItemsPerPage in the composable props)
  const itemsPerPage = ref(props.initialItemsPerPage.value || 10); // Default to 10 if nothing provided

  const totalPages = computed(() => {
    return Math.ceil(props.datasetToPaginate.value.length / itemsPerPage.value) || 1;
  });

  const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;
    return props.datasetToPaginate.value.slice(start, end);
  });

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  };

  const nextPage = () => {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  };

  const prevPage = () => {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  };

  const updateItemsPerPage = (newItemsPerPage: number) => {
    const oldVal = itemsPerPage.value;
    if (oldVal !== newItemsPerPage) {
      itemsPerPage.value = newItemsPerPage;
      currentPage.value = 1; // Reset to first page
      emit('itemsPerPageChanged', newItemsPerPage); // Notify parent
    }
  };

  // Watcher for external changes to initialItemsPerPage (e.g. loaded from grid state)
  watch(props.initialItemsPerPage, (newVal) => {
    if (newVal !== undefined && newVal !== itemsPerPage.value) {
        itemsPerPage.value = newVal;
        // currentPage is already watched against totalPages, which will update if itemsPerPage changes totalPages
    }
  });


  // Watcher to adjust currentPage if datasetToPaginate changes (e.g., filtering)
  // and currentPage becomes out of bounds.
  watch(() => props.datasetToPaginate.value.length, () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value || 1; // Go to last page or first if no pages
    }
  });

  // Also watch itemsPerPage itself in case it's directly manipulated (though updateItemsPerPage is preferred)
  // This handles the case where parent might set itemsPerPage directly on the composable's return if exposed for v-model.
  // The updateItemsPerPage method is the main way to trigger changes from UI and emit event.
  watch(itemsPerPage, (newVal, oldVal) => {
      if (newVal !== oldVal) {
          currentPage.value = 1;
          // No emit here, direct mutation of itemsPerPage ref from parent should be a conscious choice
          // and parent should handle side effects like saving state if it bypasses updateItemsPerPage.
      }
  });


  return {
    currentPage,
    itemsPerPage, // This can be v-modeled by parent component's v-select for items per page
    totalPages,
    paginatedData,
    goToPage,
    nextPage,
    prevPage,
    updateItemsPerPage, // Method to be called by parent when v-select changes
  };
}
