# Documentation Deletion Proposals

- [ ] **From: `gridable-app/docs/external-data-sources-proposal.md`**
      > ## Deep Dive: The GraphQL-to-OrbitDB Bridge
      > 
      > While the native IPFS/OrbitDB stack provides a robust foundation for decentralized data storage and synchronization, a GraphQL-to-OrbitDB bridge would introduce a powerful layer of abstraction and querying capabilities that are not natively present. This bridge would not replace OrbitDB but rather complement it, unlocking significant advantages for Gridable in terms of data querying, developer experience, and data federation.
      > 
      > ### 1. Advanced, Declarative Data Querying
      > 
      > OrbitDB's native query capabilities are limited. For `key-value` stores, you can fetch a value by its key. For `log` stores, you can iterate through entries. For `document` stores, you can perform basic `find` queries. These are often insufficient for complex application views.
      > 
      > A GraphQL bridge would allow developers to:
      > 
      > *   **Request Exactly What's Needed:** Clients can formulate precise queries, specifying the exact fields they need. This eliminates the over-fetching common with simpler database interfaces, where an entire record must be retrieved to access a single field. This is especially critical in a P2P environment where bandwidth can be variable and costly.
      > *   **Perform Complex Queries and Relations:** GraphQL resolvers can be designed to traverse relationships between different OrbitDB databases. For example, a single query could fetch a user's profile, their 10 most recent posts from a `log` store, and the corresponding comments from a separate `document` store, all in one request. Achieving this with native OrbitDB would require multiple manual lookups and client-side joins.
      > *   **Aggregate and Transform Data:** Resolvers can perform on-the-fly data aggregation and transformation. For instance, a query could ask for the total number of "likes" for a post, a value that isn't stored directly but can be computed by iterating through a related database of reactions.
      > 
      > ### 2. Enhanced Developer Experience (DX)
      > 
      > A well-defined GraphQL schema serves as a contract between the frontend and the data layer, providing significant benefits for developers.
      > 
      > *   **Strongly-Typed API:** The GraphQL schema is strongly typed. This enables powerful developer tooling, including auto-completion, static analysis, and query validation directly in the IDE. Developers know exactly what data is available and what shape it's in, reducing runtime errors and improving productivity.
      > *   **Single, Unified Endpoint:** Instead of interacting with multiple OrbitDB instances, each with its own address and store type, developers interact with a single, consistent GraphQL endpoint. This simplifies application logic, as all data access flows through a unified interface, regardless of how it's stored or structured in the underlying OrbitDB databases.
      > *   **Decoupling Frontend from Storage:** The bridge decouples the UI components from the underlying data storage architecture. Frontend developers can build features against the GraphQL schema without needing to understand the intricacies of OrbitDB's different store types or how data is replicated. If the underlying OrbitDB structure changes, only the GraphQL resolvers need to be updated, not the UI components.
      > 
      > ### 3. Seamless Data Federation
      > 
      > GraphQL's real power shines in its ability to federate data from multiple, disparate sources into a single, unified API. A GraphQL-to-OrbitDB bridge is the key to unlocking this for Gridable.
      > 
      > *   **Combining Decentralized and Centralized Data:** A single GraphQL query could seamlessly merge data from a user's local, private OrbitDB instance with data from a public REST API, another user's OrbitDB, or a traditional centralized GraphQL endpoint. For example, a component could display a user's personal notes (from their local OrbitDB) alongside relevant public information fetched from Wikipedia's API.
      > *   **Unified View of the P2P Network:** The bridge could present data from multiple peers as a single, queryable graph. A resolver could query several peers for a specific piece of data, merge the results, and return a unified response. This abstracts away the complexity of peer discovery and multi-peer data fetching from the application developer.
      > *   **Composable Data Sources:** Gridable could treat every data source—whether it's an OrbitDB, a REST API, or an RSS feed—as a composable "sub-graph." The GraphQL bridge would act as the gateway that stitches these sub-graphs together, allowing users and developers to create powerful, custom views that combine data from across the web and the P2P network in novel ways.
      > 
      > In summary, the GraphQL-to-OrbitDB bridge is not just a convenience but a strategic component that would elevate Gridable from a simple P2P data application to a sophisticated platform for decentralized data integration and consumption. It provides the missing query layer needed for modern, data-intensive applications while enhancing developer productivity and enabling a truly federated data landscape.

- [ ] **From: `gridable-app/docs/gridable-style-guide.md`**
      > ### Anatomy of the Font-Size Slider
      > 
      > This table details the structure, styling, and state management for each of the component's three primary modes.
      > 
      > | Feature | Expanded (Active) | Readiness (Collapsed) | Dormant |
      > | :--- | :--- | :--- | :--- |
      > | **Trigger** | Mouse enters `.slider-container` | Mouse leaves `.slider-container` | 5-second inactivity timer (`resetInactivityTimer`) |
      > | **Key State** | `isHovering = true` | `isHovering = false` | `isDormant = true` |
      > | **Appearance** | - Card is `400px` wide.<br>- `v-slider` is visible (`isSliderVisible = true`).<br>- Icon is offset to the left. | - Card is `72px` wide.<br>- `v-slider` is hidden.<br>- Icon is centered. | - Card is scaled to 50% and moved to the top-right corner. |
      > | **Key CSS** | `.slider-card.is-active` | `.slider-card` (default state) | `.slider-card.is-dormant` |
      > | **Behavior** | Allows user to change `fontSize`. Icon is positioned to the left to make space for the slider. | The default, resting state of the control. Awaits user interaction. | A low-profile state to avoid distracting the user when they are not interacting with the control. |