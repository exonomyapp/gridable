import {
  getOrbitDBInstance,
  getKeyValueDatabase,
  closeOrbitDB
} from './orbitdb';
import { useAuthStore } from '~/store/auth';

// --- Data Structures for User Preferences ---
export interface GlobalAppSettings {
  defaultThemeId?: string;
  defaultItemsPerPage?: number;
}

export interface GridState {
  columnOrder?: string[];
  columnVisibility?: { [field: string]: boolean };
  columnWidths?: { [field: string]: number };
  sortState?: { field: string | null; direction: 'asc' | 'desc' };
  filterModel?: any;
  itemsPerPage?: number;
}

// --- Data Structure for Table Metadata ---
export interface TableFieldSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array'; // Add more as needed
  // Potentially other constraints: required, unique, etc.
}
export interface TableMetadata {
  tableId: string; // A unique ID for this table entry, could be its OrbitDB address or a UUID
  tableName: string; // User-defined name for the table
  orbitDBAddress: string; // The actual OrbitDB address of the table data
  schemaDefinition: TableFieldSchema[]; // Array defining fields and their types
  ownerDID: string; // DID of the user who owns this table
  createdTimestamp: number;
  description?: string;
}

const USER_PREFS_DB_PREFIX = 'user-prefs-';
const ACTUAL_VIEW_STATE_DB_PREFIX = 'actual-view-state-';
const TABLES_MANIFEST_KEY = 'tablesManifest'; // Key within user-prefs DB to store the manifest

// Helper to get user's main preferences DB name
function getUserPrefsDbName(): string | null {
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated || !authStore.currentUser?.did) {
    console.warn('[UserPrefsService] User not authenticated. Cannot determine preferences DB name.');
    return null;
  }
  const safeDid = authStore.currentUser.did.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${USER_PREFS_DB_PREFIX}${safeDid}`;
}

// Helper to get the DB name for a specific view's settings
function getActualViewSettingsDbName(viewOrbitDbAddress: string): string | null {
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated || !authStore.currentUser?.did) {
    console.warn('[UserPrefsService] User not authenticated. Cannot determine view settings DB name.');
    return null;
  }
  const safeUserDid = authStore.currentUser.did.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeViewAddr = viewOrbitDbAddress.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${ACTUAL_VIEW_STATE_DB_PREFIX}${safeViewAddr}-${safeUserDid}`;
}

// --- Global App Settings ---
export async function getGlobalAppSettings(): Promise<GlobalAppSettings | null> {
  const userPrefsDbName = getUserPrefsDbName();
  if (!userPrefsDbName) return null;
  try {
    const db = await getKeyValueDatabase(userPrefsDbName);
    const settings = await db.get("globalAppSettings");
    return settings || {} as GlobalAppSettings;
  } catch (error) {
    console.error(`[UserPrefsService] Error fetching global app settings from ${userPrefsDbName}:`, error);
    return null;
  }
}

export async function saveGlobalAppSettings(settings: GlobalAppSettings): Promise<void> {
  const userPrefsDbName = getUserPrefsDbName();
  if (!userPrefsDbName) return;
  try {
    const db = await getKeyValueDatabase(userPrefsDbName);
    await db.put("globalAppSettings", settings);
  } catch (error) {
    console.error(`[UserPrefsService] Error saving global app settings to ${userPrefsDbName}:`, error);
  }
}

// --- View Grid State ---
export async function getViewGridState(viewOrbitDbAddress: string): Promise<GridState | null> {
  const actualViewSettingsDbName = getActualViewSettingsDbName(viewOrbitDbAddress);
  if (!actualViewSettingsDbName) return null;
  try {
    const db = await getKeyValueDatabase(actualViewSettingsDbName);
    const state = await db.get("gridState");
    return state || {} as GridState;
  } catch (error) {
    console.error(`[UserPrefsService] Error fetching grid state for view ${viewOrbitDbAddress} from ${actualViewSettingsDbName}:`, error);
    return null;
  }
}

export async function saveViewGridState(viewOrbitDbAddress: string, gridState: GridState): Promise<void> {
  const actualViewSettingsDbName = getActualViewSettingsDbName(viewOrbitDbAddress);
  if (!actualViewSettingsDbName) return;
  try {
    const db = await getKeyValueDatabase(actualViewSettingsDbName);
    await db.put("gridState", gridState);
  } catch (error) {
    console.error(`[UserPrefsService] Error saving grid state for view ${viewOrbitDbAddress} to ${actualViewSettingsDbName}:`, error);
  }
}

// --- Table Metadata Management ---

/**
 * Retrieves the tables manifest (a map of tableId to TableMetadata) for the current user.
 * The manifest itself is stored within the user's main preferences DB.
 */
async function getTablesManifest(): Promise<Record<string, TableMetadata>> {
  const userPrefsDbName = getUserPrefsDbName();
  if (!userPrefsDbName) return {};
  try {
    const db = await getKeyValueDatabase(userPrefsDbName);
    const manifest = await db.get(TABLES_MANIFEST_KEY);
    return manifest || {};
  } catch (error) {
    console.error(`[UserPrefsService] Error fetching tables manifest from ${userPrefsDbName}:`, error);
    return {};
  }
}

/**
 * Saves the entire tables manifest for the current user.
 */
async function saveTablesManifest(manifest: Record<string, TableMetadata>): Promise<void> {
  const userPrefsDbName = getUserPrefsDbName();
  if (!userPrefsDbName) return;
  try {
    const db = await getKeyValueDatabase(userPrefsDbName);
    await db.put(TABLES_MANIFEST_KEY, manifest);
  } catch (error) {
    console.error(`[UserPrefsService] Error saving tables manifest to ${userPrefsDbName}:`, error);
  }
}

/**
 * Registers a new table or updates an existing one in the user's manifest.
 */
export async function registerTable(metadata: TableMetadata): Promise<void> {
  const authStore = useAuthStore();
  if (!authStore.currentUser?.did || authStore.currentUser.did !== metadata.ownerDID) {
    console.error("[UserPrefsService] Cannot register table: User not authenticated or not owner.");
    // Potentially throw an error here
    return;
  }
  if (!metadata.tableId) {
    console.error("[UserPrefsService] Cannot register table: tableId is required.");
    return;
  }

  const manifest = await getTablesManifest();
  manifest[metadata.tableId] = metadata;
  await saveTablesManifest(manifest);
  console.log(`[UserPrefsService] Table '${metadata.tableName}' (ID: ${metadata.tableId}) registered/updated.`);
}

/**
 * Retrieves metadata for a specific table by its tableId from the user's manifest.
 */
export async function getTableMetadata(tableId: string): Promise<TableMetadata | null> {
  const manifest = await getTablesManifest();
  return manifest[tableId] || null;
}

/**
 * Retrieves all table metadata objects for the current user.
 * Returns an array of TableMetadata.
 */
export async function getAllTableMetadata(): Promise<TableMetadata[]> {
  const manifest = await getTablesManifest();
  return Object.values(manifest);
}

/**
 * Unregisters a table (removes its metadata) from the user's manifest by its tableId.
 */
export async function unregisterTable(tableId: string): Promise<void> {
  const manifest = await getTablesManifest();
  if (manifest[tableId]) {
    // Optional: Check ownership again if needed, though manifest is user-specific.
    // const authStore = useAuthStore();
    // if (!authStore.currentUser?.did || authStore.currentUser.did !== manifest[tableId].ownerDID) {
    //   console.error("[UserPrefsService] Cannot unregister table: User not owner of manifest entry.");
    //   return;
    // }
    delete manifest[tableId];
    await saveTablesManifest(manifest);
    console.log(`[UserPrefsService] Table with ID '${tableId}' unregistered.`);
  } else {
    console.warn(`[UserPrefsService] Table with ID '${tableId}' not found in manifest for unregistration.`);
  }
}

/*
Reminder on Access Control for userPrefsDbName and individual table OrbitDB addresses:
- The userPrefsDbName (e.g., 'user-prefs-did_example_123') needs DID-based access control
  so only user 'did:example:123' can write to it.
- Similarly, the actual OrbitDB tables (whose addresses are stored in TableMetadata.orbitDBAddress)
  also need their own access control, typically set at creation time, restricting write access to the ownerDID.
*/
