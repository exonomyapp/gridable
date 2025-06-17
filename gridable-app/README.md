# Gridable

**Gridable** is a decentralized data management application inspired by the comprehensive nature of phpMyAdmin and the user-friendly interface of Microsoft Access. It leverages OrbitDB as its core database technology and integrates the powerful `upGrid` component to provide a rich, web-based solution for creating, managing, and sharing data tables and views directly on the IPFS network.

Our vision is to deliver a sophisticated data management experience, combining deep database control with an intuitive, highly customizable user interface.

## Core Vision & Analogy

Imagine a tool that combines:
*   The database management depth of **phpMyAdmin**.
*   The intuitive GUI and "View" building capabilities of **Microsoft Access**.
*   The advanced data grid features of **AG Grid Enterprise**, delivered via our `upGrid` component.
*   All built on a **decentralized foundation** using OrbitDB and IPFS.

Gridable allows users to manage OrbitDB tables directly and construct complex "Views" (queries/data representations) using a visual editor. These views are then rendered and interacted with through the `upGrid` component, which can also feature master-detail relationships, both within the same table and across multiple OrbitDB tables.

## Key Features of Gridable

Gridable's features are divided between the core application logic and the specialized UI components it utilizes.

### Gridable Application Features

*   **Decentralized Database Management & Data Ownership:**
    *   **DID-Owned Data Tables:** All OrbitDB data tables created within Gridable are owned by and cryptographically associated with the user's DID. This ensures data sovereignty and isolation.
    *   **User-Scoped Data:** When a user signs in with their DID, they only see and interact with the tables and data they created or have been explicitly granted access to.
    *   Full CRUD (Create, Read, Update, Delete) operations for these DID-owned OrbitDB tables.
    *   Schema definition and management for these tables.
*   **Powerful View Editor:**
    *   Visually design "Views" using a drag-and-drop interface similar to Microsoft Access.
    *   Define relationships (joins) between tables visually.
    *   Select output fields, define aliases, set sorting orders, and specify filter criteria.
    *   (Planned) Grouping and aggregation capabilities.
*   **Decentralized Sharing & Collaboration:**
    *   Publish Views (and their underlying data structure) via Helia (IPFS).
    *   Share Views with other users (DIDs) similar to sharing documents in Google Docs.
    *   Control whether Views are shared with or without specific themes, or allow recipients to choose.
*   **Authentication & Access Control:**
    *   **Multiple Primary DID Accounts:** Gridable supports multiple distinct user accounts, each authenticated via their unique Decentralized Identifier (DID).
    *   **DID-Exclusive Sign-In:** Sign-in to Gridable is *exclusively* handled by DIDs. Users authenticate directly with their DID to access their Gridable environment.
    *   **Linked Third-Party Authenticators (for External Resources):** While not used for Gridable sign-in, users can link third-party authenticators (e.g., Google, GitHub) to their primary DID. This is intended for Gridable to potentially access or interact with external resources on behalf of the user in the future.
    *   User profiles and settings pages for managing DIDs and potentially linked authenticators.
*   **DID-Specific Configuration Storage:**
    *   All Gridable configurations (definitions of known tables, user-created views, themes, sharing links, etc.) are stored in OrbitDB and are associated with the specific user's DID, ensuring configurations are also isolated per user.

### Advanced Data Grid Features (via `upGrid`)

Gridable uses `upGrid`, a homegrown, feature-rich UI component, for displaying both raw table data and composed Views. `upGrid` provides the following features:

*   **Advanced Interactivity:**
    *   Sorting, filtering, and pagination.
    *   Column resizing, reordering, and visibility toggles.
    *   Row selection (single and multiple).
    *   (Planned) Inline cell editing.
    *   (Planned) Master-detail views and custom cell renderers.
*   **Robust Theming Engine:**
    *   **System-Level Grid Theming:** Customize every visual aspect of every upGrid implementation for a consistent yet customizable look and feel.
    *   **View-Level Theming:** Style specific Views when they are published or shared, allowing for unique presentations.
    *   Themes can include custom colors, borders, fonts, buttons, icons, and even background images or videos.

## Technology Stack

*   **Frontend Framework:** [Nuxt 3](https://nuxt.com/)
*   **UI Library:** [Vuetify 3](https://vuetifyjs.com/) (Material Design)
*   **Grid Component:** `upGrid` (in-house)
*   **Layout Philosophy:** CSS:Grid
*   **State Management:** [Pinia](https://pinia.vuejs.org/)
*   **Database:** [OrbitDB](https://orbitdb.org/)
*   **IPFS Implementation:** [Helia](https://helia.io/)
*   **Authentication:** DIDs (specific library TBD), Nuxt 3 Layers for third-party authenticators.

## Project Status

This project is under active development. For detailed progress and planned features, please see the [Product Plan](./docs/gridable-product-plan.md).

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
