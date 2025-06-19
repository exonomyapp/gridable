import { useNuxtApp } from '#app';

export interface KeyValueEntry { id: string; [key: string]: any; }

const DEFAULT_KV_DB_NAME = 'gridable_default_kv_table';

export function getOrbitDBInstance() {
  const { $getOrbitDBInstance } = useNuxtApp();
  return $getOrbitDBInstance();
}

export function getKeyValueDatabase(
  dbName: string = DEFAULT_KV_DB_NAME,
  accessControllerOptions?: any,
  ownerControlled: boolean = false
) {
  const { $getKeyValueDatabase } = useNuxtApp();
  return $getKeyValueDatabase(dbName, accessControllerOptions, ownerControlled);
}

export function getDocumentStoreDatabase(
  dbName: string,
  accessControllerOptions?: any,
  ownerControlled: boolean = false
) {
  const { $getDocumentStoreDatabase } = useNuxtApp();
  return $getDocumentStoreDatabase(dbName, accessControllerOptions, ownerControlled);
}

export async function putDocument(docStore: any, doc: any): Promise<string> {
  const hash = await docStore.put(doc);
  console.log(`Doc put. Op hash: ${hash}. Doc _id: ${doc._id}`);
  return doc._id || hash;
}

export async function getDocumentById(docStore: any, id: string): Promise<any | null> {
  const results = await docStore.get(id);
  return (results && results.length > 0) ? results[0] : null;
}

export async function queryDocuments(docStore: any, queryFn: (doc: any) => boolean): Promise<any[]> {
  return await docStore.query(queryFn);
}

export async function addDataToDB(dbName: string, key: string, value: KeyValueEntry) {
  const db = await getKeyValueDatabase(dbName);
  if (!db) return Promise.resolve(null);
  return await db.put(key, value);
}

export async function getAllDataFromDB(dbName: string): Promise<KeyValueEntry[]> {
  const db = await getKeyValueDatabase(dbName);
  if (!db) return Promise.resolve([]);
  return (await db.all()).map((e: any) => e.value);
}

export async function deleteDataFromDB(dbName: string, key: string) {
  const db = await getKeyValueDatabase(dbName);
  if (!db) return Promise.resolve(null);
  return await db.del(key);
}

export async function closeOrbitDB() {
  const { $orbitdb, $ipfs } = useNuxtApp();
  if ($orbitdb) {
    await $orbitdb.stop();
  }
  if ($ipfs) {
    await $ipfs.stop();
  }
}
