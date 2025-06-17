import { Helia, createHelia } from 'helia';
import { createOrbitDB, IPFSAccessController, OrbitDBAccessController } from '@orbitdb/core';
import { Libp2p } from 'libp2p';

// Import custom providers
import { CustomDIDIdentityProvider, type DidSigningFunction, type DidVerificationFunction } from './orbitdb-did-identity-provider';
import { CustomDIDAccessController } from './orbitdb-did-access-controller';

import { useAuthStore } from '~/store/auth'; // To get current user's DID

// --- Mock DID Signing and Verification Functions ---
export const mockDidSigningFunction: (did: string) => DidSigningFunction = (did: string) => {
  return async (data: string | Uint8Array): Promise<string> => {
    const dataStr = typeof data === 'string' ? data : new TextDecoder().decode(data);
    console.log(`[MockSign] DID ${did} signing data: "${dataStr.substring(0,50)}..."`);
    // console.log("[DID_IP] Data to sign (raw):", data); // Already uncommented in IP
    return `signed(${dataStr})-by(${did})`;
  };
};

export const mockDidVerificationFunction: DidVerificationFunction = async (
  signature: string,
  data: string | Uint8Array,
  did: string
): Promise<boolean> => {
  const dataStr = typeof data === 'string' ? data : new TextDecoder().decode(data);
  const expectedSignature = `signed(${dataStr})-by(${did})`;
  const isValid = signature === expectedSignature;
  console.log(`[MockVerify] Verifying for DID ${did}, data: "${dataStr.substring(0,50)}...", sig: "${signature.substring(0,50)}..." -> ${isValid}`);
  // console.log("[DID_IP] Data to verify (raw):", data, "Signature:", signature); // Already uncommented in IP
  return isValid;
};
// --- End Mock Functions ---


export interface KeyValueEntry { id: string; [key: string]: any; }

let orbitdb: any = null;
let heliaNode: Helia | null = null;
let currentOrbitDBUserDID: string | null = null;

const DEFAULT_KV_DB_NAME = 'gridable_default_kv_table';

async function getHelia(): Promise<Helia> {
  if (heliaNode) return heliaNode;
  heliaNode = await createHelia({ /* ... helia options ... */ });
  console.log('Helia node created/retrieved. Peer ID:', heliaNode.libp2p.peerId.toString());
  return heliaNode;
}

/**
 * Retrieves or initializes the global OrbitDB instance for the currently authenticated user.
 * This instance is configured with a `CustomDIDIdentityProvider` based on the user's DID
 * from the `authStore`. It also registers the `CustomDIDAccessController`.
 * If the authenticated user changes, the existing OrbitDB instance is stopped and a new
 * one is created for the new user.
 *
 * @throws {Error} If the user is not authenticated or if Libp2p is not available on the Helia node.
 * @returns {Promise<any>} A promise that resolves to the OrbitDB instance.
 */
export async function getOrbitDBInstance() {
  const authStore = useAuthStore();
  const userDid = authStore.currentUser?.did;

  if (!userDid) {
    console.warn("getOrbitDBInstance: No authenticated user DID. Operations requiring user identity may fail.");
    if (orbitdb && !currentOrbitDBUserDID) return orbitdb;
    throw new Error("User not authenticated. Cannot initialize user-specific OrbitDB instance.");
  }

  if (orbitdb && currentOrbitDBUserDID === userDid) {
    return orbitdb;
  }

  if (orbitdb) {
    await orbitdb.stop();
    orbitdb = null;
    console.log("Stopped existing OrbitDB instance for user:", currentOrbitDBUserDID);
  }

  const ipfs = await getHelia();
  if (!ipfs.libp2p) throw new Error('Libp2p is not available on the Helia node.');

  const identityProvider = new CustomDIDIdentityProvider({
    did: userDid,
    signingFunction: mockDidSigningFunction(userDid)
  });

  console.log(`Initializing OrbitDB instance for DID: ${userDid}`);
  console.log("[OrbitDB_Service] Using Identity Provider type:", CustomDIDIdentityProvider.type); // Using static type
  orbitdb = await createOrbitDB({
    ipfs,
    identity: identityProvider,
    AccessControllers: {
      [CustomDIDAccessController.type]: CustomDIDAccessController
    },
    directory: `./orbitdb/${userDid.replace(/[^a-zA-Z0-9]/g, '_')}`
  });

  currentOrbitDBUserDID = userDid;
  console.log(`OrbitDB instance created for DID: ${userDid}`);
  return orbitdb;
}

/**
 * Opens or creates a key-value database with specified access control.
 *
 * This function allows for flexible access control configuration:
 * 1.  If `accessControllerOptions` are provided, they take precedence.
 * 2.  If `ownerControlled` is `true` and no `accessControllerOptions` are given,
 *     the database is configured with `CustomDIDAccessController` to restrict write
 *     access exclusively to the `currentOrbitDBUserDID` (the authenticated user).
 *     The `verificationFunction` for the AC is also set to `mockDidVerificationFunction`.
 * 3.  Otherwise (no `accessControllerOptions` and `ownerControlled` is `false`),
 *     the database defaults to public write access (`{ write: ['*'] }`), implicitly
 *     using `IPFSAccessController`.
 *
 * @param {string} [dbName=DEFAULT_KV_DB_NAME] - The name of the key-value database.
 * @param {any} [accessControllerOptions] - Explicit access controller options to configure the database.
 *                                          If provided, these settings will be used directly.
 * @param {boolean} [ownerControlled=false] - If `true` and `accessControllerOptions` are not provided,
 *                                            configures the DB for owner-only write access using
 *                                            `CustomDIDAccessController` and the current user's DID.
 * @returns {Promise<any>} A promise that resolves to the opened key-value database instance.
 * @throws {Error} If `getOrbitDBInstance` fails (e.g., user not authenticated).
 */
export async function getKeyValueDatabase(
  dbName: string = DEFAULT_KV_DB_NAME,
  accessControllerOptions?: any,
  ownerControlled: boolean = false
) {
  const odb = await getOrbitDBInstance();
  console.log(`Opening/creating key-value database: ${dbName} for user ${currentOrbitDBUserDID}`);

  let acToUse: any;

  if (accessControllerOptions) {
    acToUse = accessControllerOptions;
    if (acToUse.type === CustomDIDAccessController.type && !acToUse.verificationFunction) {
      acToUse.verificationFunction = mockDidVerificationFunction;
    }
    console.log(`[OrbitDB_Service] Using explicit accessControllerOptions for KV DB '${dbName}'.`);
  } else if (ownerControlled && currentOrbitDBUserDID) {
    acToUse = {
      type: CustomDIDAccessController.type,
      write: [currentOrbitDBUserDID], // Automatically set owner's DID
      verificationFunction: mockDidVerificationFunction, // Provide the verification function
    };
    console.log(`[OrbitDB_Service] KV DB '${dbName}' configured as owner-controlled for DID: ${currentOrbitDBUserDID}.`);
  } else {
    acToUse = { write: ['*'] }; // Default public access
    console.warn(`[OrbitDB_Service] KV DB '${dbName}' opening with default PUBLIC access controller (implicitly IPFSAccessController). Missing explicit AC options or ownerControlled flag/user DID.`);
  }

  console.log(`[OrbitDB_Service] Opening KV DB '${dbName}' with AC Options: ${JSON.stringify(acToUse)}`);
  const db = await odb.open(dbName, {
    type: 'keyvalue',
    accessController: acToUse
  });

  console.log(`KV Database ${dbName} (${db.address.toString()}) opened for user ${currentOrbitDBUserDID}`);
  await db.load();
  return db;
}

/**
 * Opens or creates a document store database with specified access control.
 *
 * This function follows the same access control logic as `getKeyValueDatabase`:
 * 1.  If `accessControllerOptions` are provided, they take precedence.
 * 2.  If `ownerControlled` is `true` and no `accessControllerOptions` are given,
 *     the database is configured with `CustomDIDAccessController` to restrict write
 *     access exclusively to the `currentOrbitDBUserDID` (the authenticated user).
 *     The `verificationFunction` for the AC is also set to `mockDidVerificationFunction`.
 * 3.  Otherwise (no `accessControllerOptions` and `ownerControlled` is `false`),
 *     the database defaults to public write access (`{ write: ['*'] }`), implicitly
 *     using `IPFSAccessController`.
 *
 * @param {string} dbName - The name of the document store database.
 * @param {any} [accessControllerOptions] - Explicit access controller options to configure the database.
 *                                          If provided, these settings will be used directly.
 * @param {boolean} [ownerControlled=false] - If `true` and `accessControllerOptions` are not provided,
 *                                            configures the DB for owner-only write access using
 *                                            `CustomDIDAccessController` and the current user's DID.
 * @returns {Promise<any>} A promise that resolves to the opened document store database instance.
 * @throws {Error} If `getOrbitDBInstance` fails (e.g., user not authenticated).
 */
export async function getDocumentStoreDatabase(
  dbName: string,
  accessControllerOptions?: any,
  ownerControlled: boolean = false
) {
  const odb = await getOrbitDBInstance();
  console.log(`Opening/creating document store: ${dbName} for user ${currentOrbitDBUserDID}`);

  let acToUse: any;

  if (accessControllerOptions) {
    acToUse = accessControllerOptions;
    if (acToUse.type === CustomDIDAccessController.type && !acToUse.verificationFunction) {
      acToUse.verificationFunction = mockDidVerificationFunction;
    }
    console.log(`[OrbitDB_Service] Using explicit accessControllerOptions for DocStore '${dbName}'.`);
  } else if (ownerControlled && currentOrbitDBUserDID) {
    acToUse = {
      type: CustomDIDAccessController.type,
      write: [currentOrbitDBUserDID], // Automatically set owner's DID
      verificationFunction: mockDidVerificationFunction, // Provide the verification function
    };
    console.log(`[OrbitDB_Service] DocStore '${dbName}' configured as owner-controlled for DID: ${currentOrbitDBUserDID}.`);
  } else {
    acToUse = { write: ['*'] }; // Default public access
    console.warn(`[OrbitDB_Service] DocStore '${dbName}' opening with default PUBLIC access controller (implicitly IPFSAccessController). Missing explicit AC options or ownerControlled flag/user DID.`);
  }

  console.log(`[OrbitDB_Service] Opening DocStore '${dbName}' with AC Options: ${JSON.stringify(acToUse)}`);
  const db = await odb.open(dbName, {
    type: 'documents',
    accessController: acToUse
  });

  console.log(`Document Store ${dbName} (${db.address.toString()}) opened for user ${currentOrbitDBUserDID}`);
  await db.load();
  return db;
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
  return await db.put(key, value);
}
export async function getAllDataFromDB(dbName: string): Promise<KeyValueEntry[]> {
  const db = await getKeyValueDatabase(dbName);
  return (await db.all()).map((e: any) => e.value);
}
export async function deleteDataFromDB(dbName: string, key: string) {
  const db = await getKeyValueDatabase(dbName);
  return await db.del(key);
}

export async function closeOrbitDB() {
  if (orbitdb) {
    await orbitdb.stop(); orbitdb = null; currentOrbitDBUserDID = null;
    console.log('OrbitDB instance stopped.');
  }
  if (heliaNode) {
    await heliaNode.stop(); heliaNode = null;
    console.log('Helia node stopped.');
  }
}

export { CustomDIDIdentityProvider, CustomDIDAccessController };
export type { DidSigningFunction, DidVerificationFunction };
