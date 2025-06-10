# Gridable

**Gridable** is a decentralized data management application inspired by the comprehensive nature of phpMyAdmin and the user-friendly interface of Microsoft Access. It leverages OrbitDB as its core database technology, providing a powerful, web-based solution for creating, managing, and sharing data tables and views directly on the IPFS network.

Our vision is to deliver a feature-rich experience comparable to AG Grid Enterprise for data viewing and manipulation, coupled with a robust theming engine for ultimate customization.

## Core Vision & Analogy

Imagine a tool that combines:
*   The database management depth of **phpMyAdmin**.
*   The intuitive GUI and "View" building capabilities of **Microsoft Access**.
*   The advanced data grid features of **AG Grid Enterprise**.
*   All built on a **decentralized foundation** using OrbitDB and IPFS.

Gridable allows users to manage OrbitDB tables directly and construct complex "Views" (queries/data representations) using a visual editor reminiscent of MS Access. These views, powered by a highly-configurable grid component, can also feature master-detail relationships, both within the same table and across multiple OrbitDB tables.

## Key Features

*   **Decentralized Database Management:**
    *   Full CRUD (Create, Read, Update, Delete) operations for OrbitDB tables.
    *   Schema definition and management for tables.
*   **Powerful View Editor:**
    *   Visually design "Views" using a drag-and-drop interface similar to Microsoft Access.
    *   Define relationships (joins) between tables visually.
    *   Select output fields, define aliases, set sorting orders, and specify filter criteria.
    *   (Planned) Grouping and aggregation capabilities.
*   **Advanced Grid Component (`upGrid`):**
    *   A homegrown UI component aiming for feature parity with AG Grid Enterprise.
    *   Used for displaying both raw table data and composed Views.
    *   Supports sorting, filtering, pagination, column resizing/reordering/visibility, and (planned) row selection, inline editing.
    *   (Planned) Master-detail views and custom cell renderers.
*   **Robust Theming Engine:**
    *   **System-Level Grid Theming Editor:** Customize every visual aspect of the grid component for a consistent look and feel during development and administration.
    *   **View-Level Theming Editor:** Style specific Views when they are published or shared, allowing for unique presentations.
    *   Themes can include custom colors, borders, fonts, and even background images where applicable.
*   **Decentralized Sharing & Collaboration:**
    *   Publish Views (and their underlying data structure) via Helia (IPFS).
    *   Share Views with other users (DIDs) similar to sharing documents in Google Docs.
    *   Control whether Views are shared with or without specific themes, or allow recipients to choose.
*   **Bi-Level Authentication:**
    *   **Primary Accounts via DIDs:** Universal Decentralized Identifiers (DIDs) for first-class citizen accounts.
    *   **Linked Third-Party Authenticators:** Associate multiple third-party authenticators (e.g., Google, GitHub, Supabase, Amazon) to a primary DID in a one-to-many relationship.
    *   User profiles and settings pages for managing DIDs and linked accounts.
*   **Configuration Storage:**
    *   All Gridable configurations (known tables, user-created views, themes, sharing links, etc.) are stored in OrbitDB, associated with the user's DID.

## Technology Stack

*   **Frontend Framework:** [Nuxt 3](https://nuxt.com/)
*   **UI Library:** [Vuetify 3](https://vuetifyjs.com/) (Material Design)
*   **Layout Philosophy:** CSS:Grid
*   **State Management:** [Pinia](https://pinia.vuejs.org/)
*   **Database:** [OrbitDB](https://orbitdb.org/)
*   **IPFS Implementation:** [Helia](https://helia.io/)
*   **Authentication:** DIDs (specific library TBD), Nuxt 3 Layers for third-party authenticators.

## Project Status

This project is under active development. For detailed progress and planned features, please see the [Product Plan](./docs/product-plan.md).

## Getting Started (Development)

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/installation) to learn more.

### Setup

Make sure to install the dependencies:

```bash
# yarn
yarn install

# npm
npm install

# pnpm
pnpm install
```

### Development Server

Start the development server on `http://localhost:3000`:

```bash
npm run dev
```

### Production

Build the application for production:

```bash
npm run build
```

Locally preview production build:

```bash
npm run preview
```
