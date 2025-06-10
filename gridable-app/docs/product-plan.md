# Gridable - Product Plan and Progress

## I. Initial Development Phase (Completed)

This phase focused on establishing the foundational structure of the Gridable application, including core UI components, basic data handling, and placeholders for major features.

- [x] **1. Project Setup and Configuration:**
  - [x] Initialized a new Nuxt 3 project (`gridable-app`).
  - [x] Installed and configured Vuetify for Material Design components.
  - [x] Set up Pinia for state management.
  - [x] Established a CSS:Grid-based layout philosophy in `assets/css/layouts/main.css` and `layouts/default.vue`.
  - [x] Configured Nuxt 3 layers conceptually (created `layers` directory).

- [x] **2. Core UI Framework - Grid Component (Advanced):**
  - [x] Developed a foundational `GridableGrid.vue` component using CSS:Grid (`components/core/GridableGrid.vue`).
  - [x] Implemented basic data rendering (props: `columnDefs`, `rowData`).
  - [x] Added features: sorting, pagination, basic column width/order/visibility concepts.
  - [x] Explicitly noted the goal to emulate AG Grid Enterprise features, with placeholders for advanced capabilities.
  - [x] Created a test page `pages/testing/grid-test.vue`.

- [x] **3. OrbitDB Integration - Basic Table Functionality:**
  - [x] Installed `orbit-db`, `helia`, and related IPFS dependencies.
  - [x] Created an OrbitDB service (`services/orbitdb.ts`) for Helia initialization, OrbitDB instance creation, and basic key-value database operations (CRUD).
  - [x] Developed a test page (`pages/testing/orbitdb-test.vue`) to interact with the OrbitDB service and display data using `GridableGrid.vue`.

- [x] **4. View Editor GUI (Placeholder & AG Grid Feature Alignment):**
  - [x] Created a placeholder UI for the View Editor (`pages/editor/view-editor.vue`).
  - [x] Designed a three-pane layout (Available Tables, Design Surface, Criteria Grid) inspired by Microsoft Access.
  - [x] The Criteria Grid section uses the `GridableGrid.vue` component, aligning with the AG Grid feature goal.
  - [x] Included placeholder data and TODOs for future interactivity (drag-and-drop, relationship drawing).

- [x] **5. Theming Engine (Basic):**
  - [x] Implemented basic theming capabilities for `GridableGrid.vue`.
  - [x] Added a `theme` prop and `GridTheme` interface (`components/core/GridableGridTheme.ts`) to control colors, borders, etc.
  - [x] Updated `grid-test.vue` with UI controls to demonstrate and test theme changes.

- [x] **6. Authentication System (DID Placeholder):**
  - [x] Set up a mock DID-based authentication system using a Pinia store (`store/auth.ts`).
  - [x] Created UI components for login/logout (`LoginButton.vue`) and user profile display (`UserProfileChip.vue`).
  - [x] Developed placeholder pages for User Profile (`pages/user/profile.vue`) and Settings (`pages/user/settings.vue`).
  - [x] Integrated authentication display and controls into the main application layout header.
  - [x] Created placeholder directories for Nuxt 3 authentication layers.

- [x] **7. Sharing and Collaboration (Placeholder):**
  - [x] Added a "Share View" button and a placeholder dialog to `view-editor.vue`.
  - [x] The dialog outlines conceptual options for recipient DID and theme selection when sharing a view.
  - [x] Documented a conceptual data model (in comments) for a "SharedViewLink" object to be stored in OrbitDB, representing sharing instances.

- [x] **8. Internal Configuration Storage (User Preferences & Grid State):**
  - [x] Outlined a conceptual structure for storing user preferences and grid-specific UI states in OrbitDB (`services/userPreferences.ts`). This includes global settings and per-view customizations (column order, sort, items per page, etc.).
  - [x] Enhanced `GridableGrid.vue` to accept an `initialGridState` prop and emit a `grid-state-change` event for persisting user customizations.
  - [x] Added UI for items-per-page selection in the grid's pagination.
  - [x] Updated `grid-test.vue` to demonstrate simulating the loading and saving of grid states.

## II. Next Development Phase (Proposed)

This phase will focus on building out the core functionalities, making the placeholders interactive, and implementing the decentralized aspects of the application.

### A. Core Functionality & Interactivity

- [x] **1. Full OrbitDB Implementation for User & View Configurations (Client-side services and component integration complete; Server-side/OrbitDB Access Control is a critical remaining part for security):**
  - [x] Implement actual OrbitDB read/write operations in `services/userPreferences.ts` for global and view-specific grid states, linked to the authenticated user's DID. (Completed for KV and Document stores, table metadata, view definitions).
  - [x] Store and retrieve table definitions/schemas from OrbitDB. (Completed via Table Metadata in `userPreferences.ts`).
  - [x] Store and retrieve view definitions (designed in View Editor) from OrbitDB. (Completed for single doc per DB).

- [x] **2. View Editor - Full Functionality (Core features for single-table views implemented):**
  - [ ] **Visual Design Surface:**
    - [x] Implement drag-and-drop of available OrbitDB tables onto the design surface. (Basic implementation done).
    - [ ] Enable visual linking (drawing lines) between fields of different tables to define relationships (joins).
    - [ ] Persist table positions and relationships as part of the view definition. (Positions are saved).
  - [ ] **Criteria Grid & View Definition:**
    - [x] Dynamically populate the criteria grid with fields from tables added to the design surface.
    - [x] Allow users to select fields for output, define aliases, set sorting orders, and specify complex filter criteria (AG Grid-like). (Basic output toggle, alias, sort, filter implemented).
    - [ ] Implement grouping and aggregation capabilities.
    - [x] Save the complete view definition (tables, relationships, criteria) to its own OrbitDB store. (Implemented for current feature set).
    - [x] Load existing view definitions from OrbitDB into the editor. (Implemented).
  - [x] Minimal Viable View Execution (single-table, basic criteria). (Implemented in `pages/execute/view.vue`).

- [x] **3. GridableGrid.vue - Advanced AG Grid Features (Key UI interactions implemented):**
  - [x] Implement robust column resizing with persistence.
  - [x] Implement robust column reordering (drag & drop) with persistence.
  - [x] Implement basic advanced filtering (per column, text/number) with persistence.
  - [x] Implement column visibility toggle with persistence.
  - [ ] Implement row selection (single, multiple) with programmatic access.
  - [ ] Implement inline cell editing for data in tables (OrbitDB backend).
  - [ ] Investigate and implement strategies for handling large datasets (e.g., virtual scrolling, data windowing if OrbitDB supports it efficiently).
  - [ ] Support custom cell renderers (e.g., for displaying images, links, or custom Vue components within cells). (Basic checkbox renderer implemented).


- [x] **4. Testing and Refinement for Phase 2 (Initial pass focusing on GridableGrid state):**
  - [x] Enhanced `pages/testing/grid-test.vue` to comprehensively test `GridableGrid` state persistence (filters, column visibility, sort, order, width) including robust re-initialization via key-swapping.
  - [ ] TODO: Review and enhance `pages/testing/orbitdb-test.vue` for document store operations.
  - [ ] TODO: Perform basic usability review of `pages/editor/view-editor.vue` and `pages/execute/view.vue`.
  - [ ] TODO: Prioritize and implement DID-based Access Control for OrbitDB (critical for security of user data persistence).

### B. Decentralization & Security

- [ ] **4. Real DID-Based Authentication:**
  - [ ] Select and integrate a DID library/protocol suitable for web applications (e.g., Ceramic, Key DID, ION).
  - [ ] Replace mock authentication in `store/auth.ts` with the chosen DID solution.
  - [ ] Implement secure key management for DIDs.
  - [ ] Structure DID authentication using Nuxt 3 layers as initially planned.
  - [ ] Develop DID profile management features (e.g., updating display name, avatar linked to DID).

- [ ] **5. Third-Party Authenticators (via Nuxt Layers):**
  - [ ] Design and implement the system for linking third-party authentications (Google, GitHub, etc.) to a primary DID.
  - [ ] Develop separate Nuxt 3 layers for each major third-party authenticator.
  - [ ] Manage credentials and sessions securely.
  - [ ] Update the Settings page to allow users to connect/disconnect these authenticators.

- [ ] **6. View Sharing & Collaboration (OrbitDB & Helia/IPFS):**
  - [ ] Implement the "SharedViewLink" concept:
    - [ ] When a user shares a view, create a "SharedViewLink" record in an OrbitDB store (either the owner's or a shared one).
    - [ ] This record will point to the view's OrbitDB address and include recipient DIDs and theme/permission settings.
  - [ ] Publish the view definition (and optionally theme) to IPFS via Helia, making its OrbitDB address shareable.
  - [ ] Implement a mechanism for recipients to discover and open views shared with their DID.
  - [ ] Handle permissions (e.g., read-only access for shared views).

### C. Theming & User Experience

- [ ] **7. Advanced Theming Engine & Editor:**
  - [ ] Develop the system-level grid theming editor:
    - [ ] Allow users to customize every visual aspect of `GridableGrid.vue`.
    - [ ] Save themes as OrbitDB objects.
    - [ ] Manage a library of themes.
  - [ ] Develop the view-level theming editor:
    - [ ] Allow styling of specific views when published.
  - [ ] Support background images and advanced CSS properties in themes.
  - [ ] Allow sharing of views with or without specific themes, or letting recipients choose.

- [ ] **8. UI/UX Refinements:**
  - [ ] Conduct thorough testing of all user flows.
  - [ ] Implement comprehensive error handling and user feedback.
  - [ ] Optimize performance, especially for grid rendering and OrbitDB interactions.
  - [ ] Ensure responsive design across different screen sizes.
  - [ ] Add internationalization (i18n) support.

### D. Storage & Administration (Internal)

- [ ] **9. OrbitDB Table Management:**
  - [ ] Implement a UI for creating new OrbitDB tables (defining schema: field names, types).
  - [ ] UI for viewing and editing OrbitDB table schemas.
  - [ ] UI for directly adding, editing, and deleting data within OrbitDB tables (using `GridableGrid.vue`).
  - [ ] Manage OrbitDB table properties (e.g., access controllers, replication settings).

- [ ] **10. Gridable Configuration Storage:**
  - [ ] Use OrbitDB to store all internal configurations of Gridable itself (e.g., list of known tables, user-created views, themes, sharing links, etc.), associated with the user's DID.

- [ ] **11. GUI for Managing OrbitDB Access Control (NEW):**
    - [ ] Design and implement a user interface for managing Access Controller settings for user-owned OrbitDB databases (e.g., view/table definitions).
    - [ ] Allow users to view current permissions (e.g., who has write access - typically just themselves for private DBs initially).
    - [ ] For databases intended for sharing, provide functionality to grant or revoke write/read access to other DIDs (this ties into the "View Sharing & Collaboration" features).

### E. Componentization & Reusability (New)

- [ ] **1. Package GridableGrid as an NPM Module (`upGrid`):**
  - [ ] Refactor `GridableGrid.vue` and its dependencies (like `GridableGridTheme.ts`, and potentially some base types) into a structure suitable for publishing as an independent npm package.
  - [ ] Define a clear public API for `upGrid`.
  - [ ] Set up a separate build process for the `upGrid` package (e.g., using Vite library mode or similar).
  - [ ] Implement comprehensive unit and integration tests for `upGrid`.
  - [ ] Publish `upGrid` to npm (initially as a private package if desired, or public).
  - [ ] **Integrate `upGrid` back into the main Gridable project**: Replace the local `components/core/GridableGrid.vue` with the imported `upGrid` package from npm.
  - [ ] Establish a workflow for developing and versioning `upGrid` alongside or independently of the main Gridable application.

This detailed plan provides a roadmap for transforming the current foundational application into the full-featured Gridable platform.
