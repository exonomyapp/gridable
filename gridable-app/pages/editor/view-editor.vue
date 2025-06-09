<template>
  <v-container fluid class="view-editor-container">
    <v-row>
      <v-col cols="12" class="d-flex justify-space-between align-center">
        <div>
          <h2>View Editor (Conceptual Design)</h2>
          <p class="text-caption">
            Design views, define relationships, and set criteria.
          </p>
        </div>
        <v-btn color="primary" @click="shareDialog = true" prepend-icon="mdi-share-variant">
          Share View
        </v-btn>
      </v-col>
    </v-row>

    <!-- Share Dialog Placeholder -->
    <v-dialog v-model="shareDialog" max-width="600px">
      <v-card>
        <v-card-title>
          <span class="text-h5">Share View: {{ currentViewName || 'Untitled View' }}</span>
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-4">
            This is a placeholder for sharing functionality. Views will be published via Helia/IPFS,
            allowing sharing with other DIDs.
          </p>

          <v-text-field
            v-model="recipientDid"
            label="Recipient DID (did:example:...)"
            placeholder="Enter the DID of the user to share with"
            class="mb-3"
          ></v-text-field>

          <v-select
            v-model="selectedThemeForSharing"
            :items="availableThemesForSharing"
            item-title="name"
            item-value="id"
            label="Theme to Share With View"
            placeholder="Share with a specific theme, or allow recipient to choose"
            class="mb-3"
            clearable
          >
            <template v-slot:prepend-item>
              <v-list-item title="Share without specific theme" @click="selectedThemeForSharing = null"></v-list-item>
              <v-divider class="mt-2"></v-divider>
            </template>
          </v-select>

          <v-checkbox
            v-model="allowRecipientThemeSelection"
            label="Allow recipient to select from their own themes"
            :disabled="!!selectedThemeForSharing"
          ></v-checkbox>

          <p class="text-caption mt-4">
            <strong>Conceptual Data for Sharing (to be stored in OrbitDB):</strong>
            <ul>
              <li>View Definition OrbitDB Address</li>
              <li>Owner DID</li>
              <li>Recipient DIDs list (or public flag)</li>
              <li>Permissions per recipient (e.g., read-only, can_copy) - Advanced</li>
              <li>Shared Theme OrbitDB Address (optional)</li>
              <li>Flag: Allow recipient to use their own themes</li>
            </ul>
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" text @click="shareDialog = false">Close</v-btn>
          <v-btn color="blue-darken-1" variant="tonal" @click="handleShareConfirm" :disabled="!recipientDid">
            Share (Placeholder)
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-row class="editor-panes">
      <!-- Pane 1: Available Tables/Sources (Left Sidebar) -->
      <v-col cols="12" md="3" class="tables-pane">
        <v-card class="fill-height">
          <v-card-title>Available Tables</v-card-title>
          <v-card-text>
            <v-list dense>
              <v-list-item
                v-for="table in availableTables"
                :key="table.id"
                @click="() => addTableToDesign(table)"
                link
              >
                <v-list-item-title>{{ table.name }}</v-list-item-title>
                <v-tooltip activator="parent" location="end">Drag or click to add to design</v-tooltip>
              </v-list-item>
            </v-list>
            <p v-if="availableTables.length === 0" class="text-caption">
              No OrbitDB tables found or loaded. (Placeholder)
            </p>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Pane 2: Visual Design Surface (Center) -->
      <v-col cols="12" md="9" class="design-surface-pane">
        <v-card class="fill-height">
          <v-card-title>View Design Surface</v-card-title>
          <v-card-text class="design-surface">
            <p class="text-h6 text-center grey--text" v-if="designedTables.length === 0">
              Add tables from the left panel to start designing your view.
            </p>
            <div
              v-for="table in designedTables"
              :key="table.id"
              class="designed-table-representation"
              :style="{ top: table.y + 'px', left: table.x + 'px' }"
            >
              <strong>{{ table.name }}</strong>
              <ul>
                <li v-for="field in table.fields" :key="field.name">
                  {{ field.name }} ({{ field.type }})
                </li>
              </ul>
            </div>
            <p class="text-caption mt-4">
              Future: Drag tables here, draw lines between fields to create relationships.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="criteria-pane-row mt-4">
      <!-- Pane 3: Criteria Grid (Bottom, AG Grid like) -->
      <v-col cols="12">
        <v-card>
          <v-card-title>Field Selection & Criteria Grid</v-card-title>
          <v-card-text>
            <p class="text-caption mb-2">
              Define output fields, aliases, sort order, filter criteria, and grouping.
            </p>
            <GridableGrid
              :column-defs="criteriaGridColDefs"
              :row-data="criteriaGridRowData"
              :items-per-page="10"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import GridableGrid from '~/components/core/GridableGrid.vue';

// --- Dialog State ---
const shareDialog = ref(false);
const recipientDid = ref('');
const currentViewName = ref('My Sample View'); // Placeholder for actual view name

interface ThemeOption {
  id: string;
  name: string;
}
const selectedThemeForSharing = ref<string | null>(null);
const availableThemesForSharing = ref<ThemeOption[]>([ // Placeholder themes
  { id: 'theme1', name: 'Dark Mode Grid' },
  { id: 'theme2', name: 'Light Professional' },
  { id: 'theme3', name: 'High Contrast' },
]);
const allowRecipientThemeSelection = ref(true);


// --- Placeholder Data & Methods (from previous step, condensed for brevity) ---
interface TableField { name: string; type: string; }
interface TableSource { id: string; name: string; fields: TableField[]; x?: number; y?: number; }
interface CriteriaRow { field: string; table: string; alias?: string; output?: boolean; sort?: 'asc' | 'desc' | ''; filter?: string; group?: boolean; }

const availableTables = ref<TableSource[]>([
  { id: 'table1', name: 'Customers', fields: [{name: 'CustomerID', type: 'string'}, {name: 'Name', type: 'string'}] },
  { id: 'table2', name: 'Orders', fields: [{name: 'OrderID', type: 'string'}, {name: 'CustomerID', type: 'string'}] },
]);
const designedTables = ref<TableSource[]>([]);
let tableCounter = 0;
const criteriaGridColDefs = ref([ { headerName: 'Field', field: 'field' }, { headerName: 'Table', field: 'table' }]);
const criteriaGridRowData = ref<CriteriaRow[]>([]);

const addTableToDesign = (table: TableSource) => {
  if (!designedTables.value.find(t => t.id === table.id)) {
    designedTables.value.push({ ...table, x: (tableCounter % 3) * 220 + 20, y: Math.floor(tableCounter / 3) * 150 + 20 });
    tableCounter++;
    table.fields.forEach(field => {
      if (!criteriaGridRowData.value.find(r => r.field === field.name && r.table === table.name)) {
        criteriaGridRowData.value.push({ field: field.name, table: table.name, output: true, sort: '', filter: '', group: false });
      }
    });
  }
};

const handleShareConfirm = () => {
  if (!recipientDid.value) {
    alert('Please enter a recipient DID.');
    return;
  }
  alert(`Sharing (placeholder action):
    View: ${currentViewName.value}
    To DID: ${recipientDid.value}
    Theme ID: ${selectedThemeForSharing.value || 'None specified'}
    Allow Recipient Themes: ${allowRecipientThemeSelection.value}
  `);
  shareDialog.value = false;
  // Actual sharing logic via OrbitDB/Helia will be implemented later.
};

/*
Conceptual Data Model for a "SharedViewLink" object (stored in an OrbitDB database, perhaps one per user or a global one):
{
  sharedViewId: string; // Unique ID for this sharing instance
  originalViewOrbitDBAddress: string; // Address of the actual view definition
  ownerDid: string; // DID of the user who owns/created the view
  recipientDid: string; // DID of the user this view is shared with (or '*' for public)
  sharedTimestamp: number; // Timestamp of when it was shared

  // Theme information for the recipient
  specifiedThemeOrbitDBAddress?: string; // Optional: OrbitDB address of a specific theme to apply
  allowRecipientThemeSelection: boolean; // If true, recipient can use their own themes or default

  // Permissions (Future Enhancement)
  // permissions: {
  //   canRead: boolean; // Always true for a share
  //   canCopyDefinition: boolean; // Can the recipient duplicate the view structure?
  //   canReshare: boolean; // Can the recipient share it with others?
  // }

  // Optional: A message from the sharer
  message?: string;

  // Status (e.g., pending, accepted, revoked by owner) - Advanced
  // status: 'pending' | 'active' | 'revoked';
}

This "SharedViewLink" object would then be accessible by the recipientDid, allowing their Gridable client
to discover and load the originalViewOrbitDBAddress. The ownerDid would also have a list of these links
to manage who they've shared views with.
*/

</script>

<style scoped>
.view-editor-container {
  height: calc(100vh - 64px); /* Adjust based on actual header height */
  display: flex;
  flex-direction: column;
}
.editor-panes { flex-grow: 1; min-height: 300px; }
.tables-pane .v-card, .design-surface-pane .v-card { display: flex; flex-direction: column; height: 100%; }
.tables-pane .v-card-text, .design-surface-pane .v-card-text { flex-grow: 1; overflow-y: auto; }
.design-surface { position: relative; border: 1px dashed #ccc; background-color: #f9f9f9; min-height: 250px; }
.designed-table-representation { position: absolute; background-color: white; border: 1px solid #aeaeae; border-radius: 4px; padding: 8px; width: 200px; box-shadow: 2px 2px 5px rgba(0,0,0,0.1); cursor: grab; }
.designed-table-representation ul { list-style-type: none; padding-left: 0; margin-top: 5px; font-size: 0.9em; }
.designed-table-representation ul li { padding: 2px 0; border-bottom: 1px dotted #eee; }
.designed-table-representation ul li:last-child { border-bottom: none; }
.fill-height { height: 100%; }
</style>
