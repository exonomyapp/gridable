import { Helia, createHelia } from 'helia';
import { createOrbitDB, OrbitDBAccessController, IPFSAccessController } from '@orbitdb/core';
import { Libp2p } from 'libp2p';
// import { bitswap } from '@helia/block-brokers'; // Potential for Helia 1.x
// import { سطح } from 'datastore-level'; // if using level

// Define a type for our database entries for clarity
export interface MyDataItem {
  id: string;
  name: string;
  value: any;
  // Add other fields as needed
}

let orbitdb: any = null; // To hold the OrbitDB instance
let heliaNode: Helia | null = null;

const DB_NAME = 'gridable_default_table'; // Example DB name

async function getHelia(): Promise<Helia> {
  if (heliaNode) {
    return heliaNode;
  }

  // Create a new Helia node
  // For browser, libp2p might need specific configuration if not using defaults
  // This is a basic setup; more advanced config might be needed (e.g., for bootstrapping)
  heliaNode = await createHelia({
    // datastore: سطح('helia-data'), // Example if using persistent storage with level
    // blockBrokers: [bitswap()]       // Example for Helia 1.x
  });

  console.log('Helia node created/retrieved. Peer ID:', heliaNode.libp2p.peerId.toString());
  return heliaNode;
}

export async function getOrbitDBInstance() {
  if (orbitdb) {
    return orbitdb;
  }

  const ipfs = await getHelia();

  // Ensure libp2p is available on ipfs for OrbitDB
  if (!ipfs.libp2p) {
    throw new Error('Libp2p is not available on the Helia node. OrbitDB requires it.');
  }

  // Create OrbitDB instance
  // The type for IPFSAccessController might need adjustment based on '@orbitdb/core' version
  orbitdb = await createOrbitDB({
    ipfs,
    id: 'gridable-orbitdb-id', // Optional unique ID for this OrbitDB instance
    directory: './orbitdb' // Directory for OrbitDB metadata (browser storage)
  });

  console.log('OrbitDB instance created.');
  return orbitdb;
}

// Function to open or create a key-value database
export async function getKeyValueDatabase(dbName: string = DB_NAME) {
  const odb = await getOrbitDBInstance();
  console.log(`Opening/creating key-value database: ${dbName}`);

  // Using IPFSAccessController for public write access initially
  // For more complex scenarios, custom access controllers would be needed
  const db = await odb.open(dbName, {
    type: 'keyvalue', // or 'documents', 'events', etc.
    AccessController: IPFSAccessController({ write: ['*'] }) // Allow anyone to write for now
  });

  console.log(`Database ${dbName} opened at address:`, db.address);
  await db.load(); // Load data from IPFS
  return db;
}

// Example function to add data
export async function addDataToDB(dbName: string = DB_NAME, key: string, value: MyDataItem) {
  const db = await getKeyValueDatabase(dbName);
  const hash = await db.put(key, value);
  console.log(`Added data with key '${key}'. Hash: ${hash}`);
  return hash;
}

// Example function to get data
export async function getDataFromDB(dbName: string = DB_NAME, key: string): Promise<MyDataItem | null> {
  const db = await getKeyValueDatabase(dbName);
  const value = await db.get(key);
  return value as MyDataItem | null;
}

// Example function to get all data (for keyvalue, this gets all records)
export async function getAllDataFromDB(dbName: string = DB_NAME): Promise<MyDataItem[]> {
  const db = await getKeyValueDatabase(dbName);
  const allEntries = await db.all();
  // For keyvalue, 'all' returns an array of objects like { hash, key, value }
  // We might want to transform this to just an array of values (MyDataItem)
  return allEntries.map((entry: any) => entry.value);
}

// Example function to delete data
export async function deleteDataFromDB(dbName: string = DB_NAME, key: string) {
  const db = await getKeyValueDatabase(dbName);
  const hash = await db.del(key);
  console.log(`Deleted data with key '${key}'. Hash: ${hash}`);
  return hash;
}

// You might want to add a cleanup function for Helia/OrbitDB when app closes or on navigation
export async function closeOrbitDB() {
  if (orbitdb) {
    await orbitdb.stop();
    orbitdb = null;
    console.log('OrbitDB stopped.');
  }
  if (heliaNode) {
    await heliaNode.stop();
    heliaNode = null;
    console.log('Helia node stopped.');
  }
}
