# Gridable - Product Plan and Progress

This document outlines the plan and current progress for the Gridable application, reflecting the state as of the last architecture review.

## I. Core Architecture & P2P Foundation (Completed)

This phase established the foundational, decentralized architecture of the Gridable application.

- [x] **1. Project Setup and Configuration:**
  - [x] Initialized a Nuxt 3 project (`gridable-app`).
  - [x] Configured the app for **Client-Side Rendering only** (`ssr: false` in `nuxt.config.ts`), a critical requirement for browser-based P2P libraries.
  - [x] Integrated Vuetify for the UI component library and Pinia for ephemeral state management.
  - [x] Established the `upGrid` component as a reusable Nuxt Layer.

- [x] **2. Core P2P Stack Integration:**
  - [x] Integrated **Helia** (IPFS) and **OrbitDB** as the core of the data layer.
  - [x] Created a client-side plugin (`plugins/p2p.client.ts`) to initialize the P2P stack upon user authentication.
  - [x] Developed a high-level service (`services/orbitdb.ts`) to simplify interactions with OrbitDB.

- [x] **3. Decentralized Identity (DID) and Access Control:**
  - [x] Implemented a mock authentication system (`store/auth.ts`) using a hardcoded DID, serving as the entry point for all P2P services.
  - [x] Created a custom **DID-based Identity Provider** (`services/orbitdb-did-identity-provider.ts`) to sign database entries with the user's DID.
  - [x] Implemented a custom **DID-based Access Controller** (`services/orbitdb-did-access-controller.ts`) to enforce write permissions on OrbitDB databases based on an allow-list of DIDs.
  - [x] Built a comprehensive test page (`pages/testing/orbitdb-test.vue`) to validate the entire P2P stack, including identity and access control rules.

- [x] **4. User-Specific Data Persistence:**
  - [x] Implemented the `userPreferences.ts` service to manage user-specific metadata in a private, DID-controlled OrbitDB key-value store.
  - [x] This service handles persisting the user's registered data tables, saved view definitions, and UI settings (e.g., theme, drawer width).
  - [x] Integrated this service into the `default.vue` layout to persist UI state.

- [x] **5. Core Feature: View Editor:**
  - [x] Developed the `pages/editor/view-editor.vue` page, a complex interface for visually designing database views.
  - [x] The editor allows users to load table metadata from their `userPreferences` store.
  - [x] Users can design views by joining tables, selecting fields, and defining criteria.
  - [x] Completed view definitions are saved as documents in their own new, DID-controlled OrbitDB document store.

## II. Next Development Phase (Proposed)

This phase will focus on replacing mock implementations with real ones, enhancing core features, and building out sharing and collaboration capabilities.

### A. Decentralization & Security

- [ ] **1. Real DID-Based Authentication:**
  - [ ] Select and integrate a full-featured DID library/protocol (e.g., Ceramic, Key DID, ION) to replace the current mock implementation.
  - [ ] Allow users to sign in with their own DIDs and manage their profiles.
  - [ ] Implement secure, client-side key management for user DIDs.

- [ ] **2. View Sharing & Collaboration:**
  - [ ] Design and implement a mechanism for sharing view definitions with other users via their DIDs.
  - [ ] Use the `orbitdb-did-access-controller` to grant read-only or write access to shared databases.
  - [ ] Develop a system for users to discover and open views that have been shared with them.

### B. Feature Enhancements

- [ ] **1. Advanced View Execution:**
  - [ ] Enhance the view execution engine to support more complex joins, aggregations, and filtering logic defined in the `view-editor`.
  - [ ] Optimize query performance against OrbitDB data.

- [ ] **2. Data Source Management:**
  - [ ] Build a UI for users to create and manage their own OrbitDB tables (define schemas, add/edit data directly).
  - [ ] Implement the functionality to import data from external sources (as proposed in `external-data-sources-proposal.md`) and store it in user-managed OrbitDB tables.

- [ ] **3. Theming Engine:**
  - [ ] Develop a UI for users to create, save, and apply custom themes to the `upGrid` component.
  - [ ] Store theme definitions in the user's `userPreferences` OrbitDB store.

### C. UI/UX Refinements

- [ ] **4. Usability and Error Handling:**
  - [ ] Conduct a thorough usability review of the `view-editor` and data management flows.
  - [ ] Implement comprehensive error handling and user feedback, especially for P2P network operations.
  - [ ] Ensure the application is fully responsive and accessible.
