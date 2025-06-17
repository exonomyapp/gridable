<template>
  <v-container>
    <v-row>
      <v-col>
        <h1>Data Sources</h1>
      </v-col>
      <v-col class="text-right">
        <v-btn color="primary" @click="openAddDialog">Add New Data Source</v-btn>
      </v-col>
    </v-row>

    <v-data-table
      :headers="headers"
      :items="dataSources"
      class="elevation-1"
    >
      <template v-slot:item.actions="{ item }">
        <v-icon small class="mr-2" @click="openEditDialog(item)">
          mdi-pencil
        </v-icon>
        <v-icon small @click="deleteDataSource(item)">
          mdi-delete
        </v-icon>
      </template>
    </v-data-table>

    <v-dialog v-model="dialog" max-width="600px">
      <v-card>
        <v-card-title>
          <span class="headline">{{ formTitle }}</span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <v-row>
              <v-col cols="12">
                <v-text-field v-model="editedItem.name" label="Name"></v-text-field>
              </v-col>
               <v-col cols="12">
                <v-select
                  v-model="editedItem.type"
                  :items="['REST', 'RSS']"
                  label="Type"
                ></v-select>
              </v-col>
              <v-col cols="12">
                <v-text-field v-model="editedItem.url" label="URL"></v-text-field>
              </v-col>
              <v-col v-if="editedItem.type === 'REST'" cols="12">
                <v-textarea v-model="headersString" label="Headers (JSON)"></v-textarea>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="closeDialog">Cancel</v-btn>
          <v-btn color="blue darken-1" text @click="saveDataSource">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { DataSourceManagerService } from '~/services/dataSourceManager';
import type { AnyDataSourceConfig, RestDataSourceConfig } from '~/types/dataSource';
import { useOrbitDb } from '~/composables/useOrbitDb';
import { v4 as uuidv4 } from 'uuid';

const DATA_SOURCES_DB_NAME = 'data_sources_kv';
const { db, isDbReady } = useOrbitDb(DATA_SOURCES_DB_NAME);

const dataSourceManager = new DataSourceManagerService();

const dataSources = ref<AnyDataSourceConfig[]>([]);
const dialog = ref(false);
const editedIndex = ref(-1);
const editedItem = ref<Partial<AnyDataSourceConfig>>({
  id: '',
  name: '',
  type: 'REST',
  url: '',
  headers: {},
  pollingIntervalSeconds: 60,
  targetDbAddress: '',
});

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'type' },
  { title: 'URL', key: 'url' },
  { title: 'Polling Interval (s)', key: 'pollingIntervalSeconds' },
  { title: 'Target DB', key: 'targetDbAddress' },
  { title: 'Actions', key: 'actions', sortable: false },
];

const formTitle = computed(() => (editedIndex.value === -1 ? 'New Data Source' : 'Edit Data Source'));

const headersString = computed({
  get: () => {
    if (editedItem.value.type === 'REST' && (editedItem.value as Partial<RestDataSourceConfig>).headers) {
      return JSON.stringify((editedItem.value as Partial<RestDataSourceConfig>).headers, null, 2);
    }
    return '{}';
  },
  set: (value) => {
    try {
      if (editedItem.value.type === 'REST') {
        (editedItem.value as Partial<RestDataSourceConfig>).headers = JSON.parse(value);
      }
    } catch (e) {
      // Do nothing, keep last valid value
    }
  },
});

watch(isDbReady, async (ready) => {
  if (ready && db.value) {
    await dataSourceManager.initialize(db.value.orbitdb, DATA_SOURCES_DB_NAME);
    await loadDataSources();
  }
});

async function loadDataSources() {
  if (!isDbReady.value) return;
  dataSources.value = await dataSourceManager.getAllDataSources();
}

function openAddDialog() {
  editedIndex.value = -1;
  editedItem.value = {
    id: uuidv4(),
    name: '',
    type: 'REST',
    url: '',
    headers: {},
    pollingIntervalSeconds: 60,
    targetDbAddress: '',
  };
  dialog.value = true;
}

function openEditDialog(item: AnyDataSourceConfig) {
  editedIndex.value = dataSources.value.findIndex(ds => ds.id === item.id);
  editedItem.value = { ...item };
  dialog.value = true;
}

function closeDialog() {
  dialog.value = false;
}

async function saveDataSource() {
  if (!editedItem.value.id || !editedItem.value.type) return;

  const baseConfig = {
    id: editedItem.value.id,
    name: editedItem.value.name || '',
    url: editedItem.value.url || '',
    pollingIntervalSeconds: editedItem.value.pollingIntervalSeconds,
    targetDbAddress: editedItem.value.targetDbAddress || '',
  };

  let config: AnyDataSourceConfig;

  if (editedItem.value.type === 'RSS') {
    config = {
      ...baseConfig,
      type: 'RSS',
    };
  } else {
    config = {
      ...baseConfig,
      type: 'REST',
      headers: (editedItem.value as RestDataSourceConfig).headers || {},
    } as RestDataSourceConfig;
  }


  if (editedIndex.value > -1) {
    // Update
    const { id, ...updateData } = config;
    await dataSourceManager.updateDataSource(id, updateData);
  } else {
    // Add
    await dataSourceManager.addDataSource(config);
  }
  await loadDataSources();
  closeDialog();
}

async function deleteDataSource(item: AnyDataSourceConfig) {
  if (confirm('Are you sure you want to delete this data source?')) {
    await dataSourceManager.removeDataSource(item.id);
    await loadDataSources();
  }
}
</script>