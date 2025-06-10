// Main entry point for the upGrid library

// Export the component
export { default as GridableGrid } from './components/GridableGrid.vue';

// Export types
export type { GridTheme } from './components/GridableGridTheme.ts';
// Re-export GridState and ColumnDefinition from where GridableGrid will now get them
// For now, GridableGrid imports GridState from '~/services/userPreferences'.
// This will need to be refactored if GridState is to be part of upGrid's public API.
// Let's assume for now that types used as props (like ColumnDefinition) are defined within GridableGrid.vue or co-located.

// If ColumnDefinition is defined inside GridableGrid.vue, we might need to extract it
// or re-export it carefully if GridableGrid.vue uses <script setup>.
// For now, let's assume these types might be co-located or part of the component's props definition.

// Placeholder for other exports if any (e.g., utility functions)
