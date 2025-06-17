# upGrid

**upGrid: The Ultimate Data Grid for Modern Web Applications.**

upGrid is a powerful, flexible, and feature-rich data grid component designed to handle large datasets with ease. It provides a seamless developer experience and a rich set of features to build high-performance, interactive data tables.

## Framework Support

While the core logic of `upGrid` is designed to be framework-agnostic, our first official implementation is for Vue. We plan to release official wrappers for other popular frameworks like React and Svelte in the future.

## Features

*   **High Performance:** `upGrid` is architected for speed with a client-side-first approach. All data operations (sorting, filtering, pagination) run directly on the local data array, making them incredibly fast. This design offers two key advantages:
    *   **Virtual Scrolling:** Efficiently renders only the visible rows, allowing the grid to handle millions of records without performance degradation.
    *   **Local-First Synergy:** The client-side model is a perfect match for local-first applications using technologies like Helia/IPFS and OrbitDB. By operating on local data, network latency is completely eliminated for UI interactions, resulting in an instantaneous and fluid user experience.
*   **Rich Feature Set:** A comprehensive suite of features is available out-of-the-box. For a complete list of features and their configurations, please see our [API Reference](./docs/upgrid-api.md).
    *   **Sorting, Filtering, and Pagination:** Essential data grid functionalities are included. **Pagination** is enabled by default for large datasets but can be disabled entirely if not needed, removing the footer and related logic.
    *   **Inline Editing with Access Control:** Inline editing is supported, and access control (i.e., who can edit what) can be managed by the implementing application. For instance, you can leverage a decentralized solution like OrbitDB's Access Controller to manage permissions.
    *   **Row Selection:** Simple and intuitive row selection is built-in.
*   **Extensible and Customizable:** upGrid is designed to be highly extensible.
    *   **Custom Components:** Developers can provide their own Vue components for **cell renderers** and **editors**, allowing for custom data rendering and unique editing experiences.
    *   **Theming and Layouts:** The grid is fully themeable to match your application's look and feel. You can customize styles and even provide your own layouts to control the grid's structure.
    *   **Custom Functionality:** Add your own features and integrate with other libraries to extend the grid's capabilities.
*   **Developer-Friendly:** We prioritize a smooth developer experience.
    *   **Declarative API:** A simple, declarative API makes it easy to get started. Just pass your columns and rows as props.
    *   **Comprehensive Documentation:** Clear and thorough documentation helps you get the most out of upGrid.
    *   **Seamless Integration:** Framework-specific wrappers, starting with Vue, ensure that `upGrid` feels like a native component in your application.

## Getting Started

### Installation

To install the official `upGrid` component for Vue, run the following command:

`npm install @upgrid/vue`

## Usage

```vue
<template>
  <UpGrid :columns="columns" :rows="rows" />
</template>

<script setup>
import { ref } from 'vue';
import { UpGrid } from '@upgrid/vue';

const columns = ref([
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
]);

const rows = ref([
  { id: 1, name: 'John Doe', email: 'john.doe@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com' },
]);
</script>
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.