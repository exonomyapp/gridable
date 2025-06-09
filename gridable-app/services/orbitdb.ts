import { Helia, createHelia } from 'helia';
import { createOrbitDB, IPFSAccessController, OrbitDBAccessController } from '@orbitdb/core'; // Added OrbitDBAccessController
import { Libp2p } from 'libp2p';
// import { سطح } from 'datastore-level'; // if using level for Helia persistence

// Define a type for our database entries for clarity (generic example)
export interface KeyValueEntry {
  id: string; // key
  [key: string]: any; // value can be anything
}

let orbitdb: any = null;
let heliaNode: Helia | null = null;

// Default DB name for generic key-value, not typically used by userPreferences directly
const DEFAULT_KV_DB_NAME = 'gridable_default_kv_table';

async function getHelia(): Promise<Helia> {
  if (heliaNode) return heliaNode;
  heliaNode = await createHelia({ /* ... helia options ... */ });
  console.log('Helia node created/retrieved. Peer ID:', heliaNode.libp2p.peerId.toString());
  return heliaNode;
}

export async function getOrbitDBInstance() {
  if (orbitdb) return orbitdb;
  const ipfs = await getHelia();
  if (!ipfs.libp2p) throw new Error('Libp2p is not available on the Helia node.');

  orbitdb = await createOrbitDB({
    ipfs,
    id: 'gridable-orbitdb-id',
    directory: './orbitdb'
  });
  console.log('OrbitDB instance created.');
  return orbitdb;
}

// --- Key-Value Store Specific Functions ---
export async function getKeyValueDatabase(dbName: string = DEFAULT_KV_DB_NAME, accessControllerOptions?: any) {
  const odb = await getOrbitDBInstance();
  console.log(`Opening/creating key-value database: ${dbName}`);

  // IMPORTANT: AccessController needs to be chosen based on security needs.
  // IPFSAccessController({ write: ['*'] }) is public.
  // For user-specific DBs, a DID-based AC is needed.
  const ac = accessControllerOptions || IPFSAccessController({ write: ['*'] });

  const db = await odb.open(dbName, {
    type: 'keyvalue',
    AccessController: ac
  });

  console.log(`KV Database ${dbName} opened at address:`, db.address);
  await db.load();
  return db;
}

// --- Document Store Specific Functions ---
// Suitable for storing objects like ViewDefinitions where each doc has a unique _id
export async function getDocumentStoreDatabase(dbName: string, accessControllerOptions?: any) {
  const odb = await getOrbitDBInstance();
  console.log(`Opening/creating document store: ${dbName}`);

  const ac = accessControllerOptions || IPFSAccessController({ write: ['*'] });

  const db = await odb.open(dbName, {
    type: 'documents', // Use 'documents' type for document store
    AccessController: ac
  });

  console.log(`Document Store ${dbName} opened at address:`, db.address);
  await db.load();
  return db;
}

// Example function to put a document into a document store.
// Documents are typically objects and will be assigned an _id if not provided.
export async function putDocument(docStore: any, doc: any): Promise<string> {
  const hash = await docStore.put(doc); // Returns CID of the operation
  // To get the document's _id (if auto-generated or you need to confirm):
  // After putting, you might need to query to get the _id if it was auto-generated.
  // Or, if your 'doc' has a unique 'id' or '_id' field you manage, that's simpler.
  // For this example, we assume 'put' might return something identifiable or we use a known ID.
  // OrbitDB's document store assigns a unique _id field.
  console.log(`Document put. Operation hash: ${hash}. Document _id (if new): ${doc._id}`);
  return doc._id || hash; // Return _id if available, else hash. Client needs to handle this.
}

// Example function to get a document by its _id from a document store.
export async function getDocumentById(docStore: any, id: string): Promise<any | null> {
  // The 'get' method in a document store retrieves documents that match a query.
  // To get by _id, the query is simple.
  const results = await docStore.get(id); // Pass the _id directly
  if (results && results.length > 0) {
    return results[0]; // Assuming _id is unique, return the first match
  }
  return null;
}

// Example function to query documents (more general)
export async function queryDocuments(docStore: any, queryFn: (doc: any) => boolean): Promise<any[]> {
    return await docStore.query(queryFn);
}


export async function closeOrbitDB() {
  if (orbitdb) { await orbitdb.stop(); orbitdb = null; console.log('OrbitDB stopped.'); }
  if (heliaNode) { await heliaNode.stop(); heliaNode = null; console.log('Helia node stopped.'); }
}
