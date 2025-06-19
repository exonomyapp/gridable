import { useNuxtApp } from '#app';
import { getKeyValueDatabase } from './orbitdb';
import { useAuthStore } from '~/store/auth';
import { CustomDIDAccessController } from './orbitdb-did-access-controller';

// --- Data Structures (existing) ---
export interface GlobalAppSettings { defaultThemeId?: string; defaultItemsPerPage?: number; navDrawerWidth?: number; }
export interface GridState { columnOrder?: string[]; columnVisibility?: { [field: string]: boolean }; columnWidths?: { [field: string]: number }; sortState?: { field: string | null; direction: 'asc' | 'desc' }; filterModel?: any; itemsPerPage?: number; }
export interface TableFieldSchema { name: string; type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array'; }
export interface TableMetadata { tableId: string; tableName: string; orbitDBAddress: string; schemaDefinition: TableFieldSchema[]; ownerDID: string; createdTimestamp: number; description?: string; }

// --- Data Structure for Saved View Info ---
export interface SavedViewInfo {
  viewId: string; // Unique identifier for the view (could be its primary key in its own DB, or a UUID, or its OrbitDB address if unique per view def)
  viewName: string;
  viewAddress: string; // OrbitDB address of the view definition's document store
  createdTimestamp: number;
  lastAccessedTimestamp?: number; // Optional: for sorting by recently used
  description?: string; // Optional
}

const USER_PREFS_DB_PREFIX = 'user-prefs-';
const ACTUAL_VIEW_STATE_DB_PREFIX = 'actual-view-state-';
const TABLES_MANIFEST_KEY = 'tablesManifest';
const SAVED_VIEWS_MANIFEST_KEY = 'savedViewsManifest'; // New key for the list of saved views

// Helper to get user's main preferences DB name (existing)
function getUserPrefsDbName(): string | null {
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated || !authStore.currentUser?.did) { return null; }
  const safeDid = authStore.currentUser.did.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${USER_PREFS_DB_PREFIX}${safeDid}`;
}

// Helper to get AC options for user-private DBs (existing)
function getUserPrivateAccessControllerOptions(): any | null {
  const authStore = useAuthStore();
  const { $mockDidVerificationFunction } = useNuxtApp();
  if (!authStore.isAuthenticated || !authStore.currentUser?.did) { return null; }
  return {
    type: CustomDIDAccessController.type,
    write: [authStore.currentUser.did],
    admin: [authStore.currentUser.did],
    verificationFunction: $mockDidVerificationFunction
  };
}

// --- Global App Settings (existing, ensure correct AC usage) ---
export async function getGlobalAppSettings(): Promise<GlobalAppSettings | null> {
  if (process.server) return null;
  const userPrefsDbName = getUserPrefsDbName(); if (!userPrefsDbName) return null;
  const acOptions = getUserPrivateAccessControllerOptions(); if (!acOptions) return null;
  try {
    const db = await getKeyValueDatabase(userPrefsDbName, acOptions);
    if (!db) return null;
    const settings = await db.get("globalAppSettings");
    return settings || {} as GlobalAppSettings;
  }
  catch (error) { console.error(`[UserPrefsService] Error fetching global app settings from ${userPrefsDbName}:`, error); return null; }
}
export async function saveGlobalAppSettings(settings: GlobalAppSettings): Promise<void> {
  if (process.server) return;
  const userPrefsDbName = getUserPrefsDbName(); if (!userPrefsDbName) return;
  const acOptions = getUserPrivateAccessControllerOptions(); if (!acOptions) return;
  try {
    const db = await getKeyValueDatabase(userPrefsDbName, acOptions);
    if (!db) return;
    await db.put("globalAppSettings", settings);
  }
  catch (error) { console.error(`[UserPrefsService] Error saving global app settings to ${userPrefsDbName}:`, error); }
}

// --- View Grid State (existing, ensure correct AC usage) ---
export async function getViewGridState(viewOrbitDbAddress: string): Promise<GridState | null> {
  if (process.server) return null;
  const viewSettingsDbName = `${ACTUAL_VIEW_STATE_DB_PREFIX}${viewOrbitDbAddress.replace(/[^a-zA-Z0-9_-]/g, '_')}-${getUserPrefsDbName()?.split(USER_PREFS_DB_PREFIX)[1]}`; // Simplified, ensure unique per user per view
  if (!getUserPrefsDbName()) return null; // Check auth
  const acOptions = getUserPrivateAccessControllerOptions(); if (!acOptions) return null;
  try {
    const db = await getKeyValueDatabase(viewSettingsDbName, acOptions);
    if (!db) return null;
    const state = await db.get("gridState");
    return state || {} as GridState;
  }
  catch (error) { console.error(`[UserPrefsService] Error fetching grid state for view ${viewOrbitDbAddress} from ${viewSettingsDbName}:`, error); return null; }
}
export async function saveViewGridState(viewOrbitDbAddress: string, gridState: GridState): Promise<void> {
  if (process.server) return;
  const viewSettingsDbName = `${ACTUAL_VIEW_STATE_DB_PREFIX}${viewOrbitDbAddress.replace(/[^a-zA-Z0-9_-]/g, '_')}-${getUserPrefsDbName()?.split(USER_PREFS_DB_PREFIX)[1]}`;
  if (!getUserPrefsDbName()) return;
  const acOptions = getUserPrivateAccessControllerOptions(); if (!acOptions) return;
  try {
    const db = await getKeyValueDatabase(viewSettingsDbName, acOptions);
    if (!db) return;
    await db.put("gridState", gridState);
  }
  catch (error) { console.error(`[UserPrefsService] Error saving grid state for view ${viewOrbitDbAddress} to ${viewSettingsDbName}:`, error); }
}

// --- Table Metadata Management (existing, ensure correct AC usage) ---
async function getTablesManifest(): Promise<Record<string, TableMetadata>> {
  if (process.server) return {};
  const userPrefsDbName = getUserPrefsDbName(); if (!userPrefsDbName) return {};
  const acOptions = getUserPrivateAccessControllerOptions(); if (!acOptions) return {};
  try {
    const db = await getKeyValueDatabase(userPrefsDbName, acOptions);
    if (!db) return {};
    const m = await db.get(TABLES_MANIFEST_KEY);
    return m || {};
  }
  catch (e) { console.error(`[UserPrefsService] Error in getTablesManifest: ${e}`); return {}; }
}
async function saveTablesManifest(manifest: Record<string, TableMetadata>): Promise<void> {
  if (process.server) return;
  const userPrefsDbName = getUserPrefsDbName(); if (!userPrefsDbName) return;
  const acOptions = getUserPrivateAccessControllerOptions(); if (!acOptions) return;
  try {
    const db = await getKeyValueDatabase(userPrefsDbName, acOptions);
    if (!db) return;
    await db.put(TABLES_MANIFEST_KEY, manifest);
  }
  catch (e) { console.error(`[UserPrefsService] Error in saveTablesManifest: ${e}`); }
}
export async function registerTable(metadata: TableMetadata): Promise<void> {
  if (process.server) return;
  const authStore = useAuthStore(); if (!authStore.currentUser?.did || authStore.currentUser.did !== metadata.ownerDID || !metadata.tableId) { console.error("Pre-condition failed for registerTable"); return; }
  const manifest = await getTablesManifest(); manifest[metadata.tableId] = metadata; await saveTablesManifest(manifest);
  console.log(`[UserPrefsService] Table '${metadata.tableName}' (ID: ${metadata.tableId}) registered/updated.`);
}
export async function getTableMetadata(tableId: string): Promise<TableMetadata | null> {
  if (process.server) return null;
  const manifest = await getTablesManifest(); return manifest[tableId] || null;
}
export async function getAllTableMetadata(): Promise<TableMetadata[]> {
  if (process.server) return [];
  const manifest = await getTablesManifest(); return Object.values(manifest);
}
export async function unregisterTable(tableId: string): Promise<void> {
  if (process.server) return;
  const manifest = await getTablesManifest(); if (manifest[tableId]) { delete manifest[tableId]; await saveTablesManifest(manifest); console.log(`[UserPrefsService] Table with ID '${tableId}' unregistered.`); }
  else { console.warn(`[UserPrefsService] Table with ID '${tableId}' not found for unregistration.`);}
}


// --- Saved Views Manifest Management ---

/**
 * Retrieves the list of saved views for the current user.
 * @returns A Promise resolving to an array of SavedViewInfo objects.
 */
export async function listSavedViews(): Promise<SavedViewInfo[]> {
  if (process.server) return [];
  const userPrefsDbName = getUserPrefsDbName();
  if (!userPrefsDbName) return [];
  const acOptions = getUserPrivateAccessControllerOptions();
  if (!acOptions) return [];

  try {
    const db = await getKeyValueDatabase(userPrefsDbName, acOptions);
    if (!db) return [];
    const viewsList = await db.get(SAVED_VIEWS_MANIFEST_KEY);
    return Array.isArray(viewsList) ? viewsList : [];
  } catch (error) {
    console.error(`[UserPrefsService] Error fetching saved views manifest from ${userPrefsDbName}:`, error);
    return [];
  }
}

/**
 * Adds or updates a view in the user's saved views list.
 * If a view with the same viewId already exists, it's updated. Otherwise, it's added.
 * @param viewInfo The SavedViewInfo object for the view to add/update.
 */
export async function addSavedView(viewInfo: SavedViewInfo): Promise<void> {
  if (process.server) return;
  if (!viewInfo || !viewInfo.viewId || !viewInfo.viewName || !viewInfo.viewAddress) {
    console.error("[UserPrefsService] Invalid viewInfo provided for addSavedView.");
    return;
  }
  const userPrefsDbName = getUserPrefsDbName();
  if (!userPrefsDbName) return;
  const acOptions = getUserPrivateAccessControllerOptions();
  if (!acOptions) return;

  try {
    const views = await listSavedViews();
    const existingViewIndex = views.findIndex(v => v.viewId === viewInfo.viewId || v.viewAddress === viewInfo.viewAddress); // Check address too

    if (existingViewIndex !== -1) {
      views[existingViewIndex] = { ...views[existingViewIndex], ...viewInfo, lastAccessedTimestamp: Date.now() };
      console.log(`[UserPrefsService] Updated saved view: ${viewInfo.viewName}`);
    } else {
      views.push({ ...viewInfo, lastAccessedTimestamp: Date.now() });
      console.log(`[UserPrefsService] Added new saved view: ${viewInfo.viewName}`);
    }

    const db = await getKeyValueDatabase(userPrefsDbName, acOptions);
    if (!db) return;
    await db.put(SAVED_VIEWS_MANIFEST_KEY, views);
  } catch (error) {
    console.error(`[UserPrefsService] Error saving view to manifest in ${userPrefsDbName}:`, error);
  }
}

/**
 * Retrieves a specific saved view by its viewId or viewAddress.
 * @param idOrAddress The ID or OrbitDB Address of the view to retrieve.
 * @returns A Promise resolving to SavedViewInfo or null if not found.
 */
export async function getSavedView(idOrAddress: string): Promise<SavedViewInfo | null> {
  if (process.server) return null;
  if (!idOrAddress) return null;
  const views = await listSavedViews();
  return views.find(v => v.viewId === idOrAddress || v.viewAddress === idOrAddress) || null;
}

/**
 * Removes a view from the user's saved views list by its viewId or viewAddress.
 * @param idOrAddress The ID or OrbitDB Address of the view to remove.
 */
export async function removeSavedView(idOrAddress: string): Promise<void> {
  if (process.server) return;
  if (!idOrAddress) {
    console.error("[UserPrefsService] Invalid idOrAddress provided for removeSavedView.");
    return;
  }
  const userPrefsDbName = getUserPrefsDbName();
  if (!userPrefsDbName) return;
  const acOptions = getUserPrivateAccessControllerOptions();
  if (!acOptions) return;

  try {
    let views = await listSavedViews();
    const initialLength = views.length;
    views = views.filter(v => v.viewId !== idOrAddress && v.viewAddress !== idOrAddress);

    if (views.length < initialLength) {
      const db = await getKeyValueDatabase(userPrefsDbName, acOptions);
      if (!db) return;
      await db.put(SAVED_VIEWS_MANIFEST_KEY, views);
      console.log(`[UserPrefsService] Removed view with ID/Address: ${idOrAddress} from manifest.`);
    } else {
      console.warn(`[UserPrefsService] View with ID/Address: ${idOrAddress} not found in manifest for removal.`);
    }
  } catch (error) {
    console.error(`[UserPrefsService] Error removing view from manifest in ${userPrefsDbName}:`, error);
  }
}

// Reminder on Access Control for userPrefsDbName and individual table OrbitDB addresses:
// - The userPrefsDbName (e.g., 'user-prefs-did_example_123') needs DID-based access control
//   so only user 'did:example:123' can write to it.
// - Similarly, the actual OrbitDB tables (whose addresses are stored in TableMetadata.orbitDBAddress)
//   also need their own access control, typically set at creation time, restricting write access to the ownerDID.
