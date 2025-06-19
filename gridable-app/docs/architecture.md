# Gridable Application: Architecture Overview

This document provides a high-level overview of the Gridable application's architecture, key components, and core design decisions.

## 1. Core Philosophy: Decentralized & Client-Side

The fundamental architectural choice for Gridable is to operate as a fully decentralized, client-side application. This decision is driven by the core requirement to use peer-to-peer (P2P) technologies that run exclusively in the browser.

### Rendering Mode: Client-Side Only (SPA)

**Decision:** The Gridable application is configured to run exclusively as a Single-Page Application (SPA) with Server-Side Rendering (SSR) disabled. This is configured in `nuxt.config.ts` via the `ssr: false` flag.

**Reasoning:** The application's backbone is built on **Helia** (an IPFS implementation) and **OrbitDB**. These libraries are designed to run in a browser environment and require access to browser-specific APIs (like `window`, `indexedDB`, etc.) that are not available in a Node.js server environment. Disabling SSR ensures full compatibility with our P2P stack, avoids complex workarounds, and simplifies the overall architecture by consolidating logic on the client.

## 2. Project Structure

The Gridable project is a monorepo containing the main Nuxt application (`gridable-app`) and a local, reusable UI package (`packages/upGrid`).

### `gridable-app/`

This is the primary Nuxt 3 application. Key directories include:

*   **`services/`**: Contains the core application logic, decoupled from the UI. This is the heart of the application's decentralized functionality.
*   **`plugins/`**: Initializes key services and injects them into the Nuxt app context.
*   **`store/`**: Manages global, ephemeral UI state using Pinia.
*   **`pages/`**: Contains the application's routes and primary views.
*   **`composables/`**: Provides reusable Vue composables for interacting with services.
*   **`layouts/`**: Defines the main application layout structure.

### `packages/upGrid/`

This is a local Nuxt Layer that provides a reusable, data-agnostic grid component. By encapsulating the grid, we promote code reuse and separate data presentation concerns from the main application's business logic.

## 3. Decentralized Services (`gridable-app/services/`)

The services form the backbone of the application's P2P functionality.

*   **P2P Initialization (`plugins/p2p.client.ts`)**: This client-side plugin runs after a user is authenticated (i.e., has a DID). It initializes a Helia (IPFS) node and then an OrbitDB instance on top of it. Crucially, it configures OrbitDB to use our custom DID-based identity and access control systems.

*   **DID-Based Identity (`orbitdb-did-identity-provider.ts`)**: This service implements a custom OrbitDB `IdentityProvider`. Instead of using default OrbitDB keys, it creates a user identity directly from their DID string (e.g., `did:example:123...`). All database entries created by the user are cryptographically signed with this DID-based identity, ensuring data provenance.

*   **DID-Based Access Control (`orbitdb-did-access-controller.ts`)**: This service implements a custom `AccessController` to enforce database permissions. When a database is created, it can be configured with a list of DIDs that are allowed to write to it. When a new entry arrives, this controller verifies both **Authorization** (is the writer's DID in the allowed list?) and **Authentication** (is the entry's signature valid for the writer's claimed DID?). Both must be true for a write to be accepted.

*   **High-Level OrbitDB API (`orbitdb.ts`)**: This service acts as a simplified, high-level API for the rest of the app to interact with the P2P layer, abstracting away the direct complexities of the OrbitDB core API. It provides reusable functions like `getKeyValueDatabase` and `putDocument`.

*   **User Metadata Management (`userPreferences.ts`)**: This service manages all user-specific metadata. It uses a single, user-owned, and DID-controlled OrbitDB key-value database to store:
    *   A manifest of the user's "registered" data tables.
    *   A manifest of saved view definitions, mapping a view name to its OrbitDB address.
    *   Global application settings like the UI theme and navigation drawer width.

## 4. State Management

Application state is managed at two distinct levels:

*   **Global UI State (Pinia)**: The Pinia store (`store/auth.ts`) is used for traditional, ephemeral client-side state. Its primary role is to manage the user's authentication status and mock profile, including the DID that serves as the entry point for the entire P2P system.

*   **Decentralized Data State (OrbitDB)**: All persistent application data is managed by OrbitDB. This is not a centralized state store but a collection of distributed, user-owned databases. State is synchronized across peers automatically by OrbitDB, providing a decentralized and resilient data layer.
    *   The `userPreferences.ts` service manages a user's primary metadata.
    *   The `pages/editor/view-editor.vue` page creates new, self-contained document store databases for each view definition.