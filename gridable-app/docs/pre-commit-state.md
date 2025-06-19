# Gridable Application: Architecture & Component Summary

This document provides a high-level overview of the Gridable application's architecture, based on an analysis of the codebase.

## 1. Project Structure

The Gridable project is a monorepo containing the main Nuxt application (`gridable-app`) and local packages (`packages`).

### `gridable-app/`

This is the primary Nuxt 3 application. Key directories and files include:

*   **`nuxt.config.ts`**: Configures the Nuxt app. Notably, **SSR is disabled** (`ssr: false`), which is a critical architectural decision to support the client-side-only nature of P2P libraries like Helia and OrbitDB. It also extends the functionality of the local `upGrid` package.
*   **`plugins/`**:
    *   `p2p.client.ts`: A crucial client-side plugin that initializes the P2P stack (Helia and OrbitDB) when a user is authenticated. It injects the IPFS node, OrbitDB instance, and database helper functions into the Nuxt app context.
    *   `vuetify.ts`: Configures the Vuetify UI library.
*   **`services/`**: Contains the core application logic, decoupled from the UI.
    *   `orbitdb.ts`: Provides high-level, reusable functions for interacting with OrbitDB (e.g., `getKeyValueDatabase`, `putDocument`).
    *   `orbitdb-did-identity-provider.ts`: Implements a custom OrbitDB `IdentityProvider` using Decentralized Identifiers (DIDs). It uses a mock signing function to create identities based on a user's DID.
    *   `orbitdb-did-access-controller.ts`: Implements a custom `AccessController` that grants database write permissions based on a list of authorized DIDs. This is the core of the application's decentralized permission model.
    *   `userPreferences.ts`: A key service that manages user-specific metadata, such as registered data tables and saved view definitions. It stores this information in a user-private, DID-controlled OrbitDB key-value store.
*   **`store/`**:
    *   `auth.ts`: A Pinia store for managing authentication state. It currently uses a mock user with a hardcoded DID (`did:example:123456789abcdefghi`), which is fundamental for initializing the P2P services.
*   **`pages/`**: Contains the application's routes and views.
    *   `editor/view-editor.vue`: A complex page for visually designing database views by joining tables, selecting fields, and defining criteria. It saves these view definitions as documents in OrbitDB.
    *   `testing/orbitdb-test.vue`: A utility page for testing OrbitDB functionality, including creating/writing to Key-Value and Document stores, and testing the DID-based access control rules.
*   **`composables/`**:
    *   `useOrbitDb.ts`: A Vue composable that simplifies the process of accessing and initializing an owner-controlled OrbitDB Key-Value database within a Vue component.
*   **`layouts/`**:
    *   `default.vue`: The main application layout, including the navigation drawer and app bar. It fetches and saves user settings (like theme and drawer width) using the `userPreferences` service.

### `packages/upGrid/`

This is a local package that provides a reusable, data-agnostic grid component.

*   **`components/UpGrid.vue`**: A powerful and themeable data grid component with features for sorting, filtering, pagination, column resizing/reordering, and inline editing.
*   **`index.ts`**: Exports the `UpGrid` component and its associated types, making them available to the main `gridable-app`.

## 2. Core Components

*   **`app.vue`**: The root Vue component that renders the Nuxt layout and pages.
*   **`layouts/default.vue`**: Provides the main UI structure. It dynamically builds navigation links and uses the `userPreferences` service to persist UI state like the navigation drawer width to a user's OrbitDB store.
*   **Pages**:
    *   `pages/index.vue`: Redirects to the main documentation page.
    *   `pages/editor/view-editor.vue`: The application's most complex feature. It allows users to load table metadata from their `userPreferences` store, design views by dragging tables, and save the resulting view definition to a new, DID-controlled OrbitDB document store.
    *   `pages/testing/orbitdb-test.vue`: A comprehensive testbed for the P2P stack. It demonstrates initializing different database types and includes test cases to verify that the `CustomDIDAccessController` correctly denies write access to unauthorized DIDs.
*   **Composables**:
    *   `composables/useOrbitDb.ts`: Provides a clean, reusable hook for components to get a reactive reference to an owner-controlled OrbitDB database.

## 3. Services

The services in `gridable-app/services/` form the backbone of the application's decentralized functionality.

*   **P2P Initialization (`p2p.client.ts`)**: This plugin runs on the client after a user is authenticated (i.e., has a DID). It creates a Helia (IPFS) node and then an OrbitDB instance on top of it. Crucially, it configures OrbitDB to use the custom DID-based identity provider and access controller.
*   **`orbitdb-did-identity-provider.ts`**: Instead of using default OrbitDB keys, this service creates a user identity directly from their DID string (e.g., `did:example:123...`). All database entries created by the user are signed with this DID-based identity.
*   **`orbitdb-did-access-controller.ts`**: This service enforces permissions. When a database is created, it can be configured with a list of DIDs that are allowed to write to it. When a new entry arrives, this controller checks two things:
    1.  **Authorization**: Is the writer's DID in the allowed list?
    2.  **Authentication**: Is the entry's signature valid for the writer's claimed DID?
    Both must be true for the write to be accepted. This is demonstrated effectively in the `orbitdb-test.vue` page.
*   **`orbitdb.ts`**: This service acts as a high-level API for the rest of the app to interact with the P2P layer, a-bstacting away the direct complexities of the OrbitDB core API.
*   **`userPreferences.ts`**: This service manages all user-specific metadata that is not part of a view definition itself. It uses a single, user-owned OrbitDB key-value database to store:
    *   A manifest of "registered" data tables.
    *   A manifest of saved view definitions, mapping a view name to its OrbitDB address.
    *   Global application settings like the UI theme.

## 4. upGrid Package

The `upGrid` package, located at `packages/upGrid`, is a self-contained, reusable Vue component.

*   **Functionality**: It provides a feature-rich data grid used throughout the application (e.g., in `orbitdb-test.vue` and `view-editor.vue`) to display data.
*   **Purpose**: By encapsulating the grid into a local package, it promotes code reuse and separation of concerns. The main application can focus on data management and business logic, while `upGrid` handles the complexities of data presentation and interaction. It is configured as a Nuxt Layer in the main app's `nuxt.config.ts`.

## 5. State Management

Application state is managed at two distinct levels:

*   **Global UI State (Pinia)**: The Pinia store (`store/auth.ts`) is used for traditional, ephemeral client-side state. Its primary role in the current architecture is to manage the user's authentication status and mock profile, including the all-important DID which is the entry point for the entire P2P system.
*   **Decentralized Data State (OrbitDB)**: All persistent application data is managed by OrbitDB. This is not a centralized state store but a collection of distributed, user-owned databases.
    *   The `userPreferences.ts` service acts as a "manager" for a user's primary data, storing manifests of their tables and saved views in a private key-value database.
    *   The `view-editor.vue` page creates new document store databases for each view definition, making each view a self-contained, shareable, and DID-controlled OrbitDB database.
    *   State is synchronized across peers automatically by OrbitDB, providing a decentralized and resilient data layer.