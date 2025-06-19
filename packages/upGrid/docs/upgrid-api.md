# upGrid API Reference

This document provides a reference for the `upGrid` component's public API.

## Component: `UpGrid.vue`

A powerful, themeable, and reusable data grid component for Vue 3.

### Props

| Prop Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `columnDefs` | `Array<ColumnDef>` | `true` | An array of objects defining the columns of the grid (e.g., `headerName`, `field`, `sortable`). |
| `rowData` | `Array<Object>` | `true` | An array of objects, where each object represents a row of data. |
| `theme` | `Object` | `false` | A theme object to customize the grid's appearance (colors, borders, etc.). See `upGridTheme.ts`. |
| `initialGridState` | `Object` | `false` | An object representing the initial state of the grid, including column order, widths, sorting, and filter settings. |

### Events

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `grid-state-change` | `Object` | Emitted whenever the grid's UI state changes (e.g., a column is resized, reordered, sorted, or filtered). The payload contains the complete, updated grid state, which can be persisted. |
| `row-selection-change` | `Array<Object>` | Emitted when the set of selected rows changes. The payload is an array of the currently selected row data objects. |
| `cell-value-change` | `{ rowIndex: number, colId: string, newValue: any }` | Emitted after a cell's value is changed through inline editing. |

### Features

The `upGrid` component provides a rich set of interactive features:

*   **Sorting:** Click on column headers to sort data.
*   **Filtering:** Per-column filtering for text and numbers.
*   **Pagination:** Controls for navigating through pages of data.
*   **Column Resizing:** Drag the edges of column headers to resize them.
*   **Column Reordering:** Drag and drop column headers to change their order.
*   **Column Visibility:** Toggle the visibility of columns.
*   **Row Selection:** Single and multiple row selection (with `Ctrl/Cmd` and `Shift` key modifiers).
*   **Inline Editing:** Double-click cells to edit their values directly in the grid.
*   **Theming:** Apply custom themes to control the grid's appearance.
*   **State Persistence:** The grid's state (column order, size, sort, etc.) can be saved and restored.