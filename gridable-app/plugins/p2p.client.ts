import { defineNuxtPlugin } from '#app'
import { createHelia, type Helia } from 'helia'
import { createOrbitDB, type OrbitDB, type KeyValue, type DocumentStore } from '@orbitdb/core'
import { CustomDIDIdentityProvider, mockDidSigningFunction, mockDidVerificationFunction, type DidVerificationFunction } from '~/services/orbitdb-did-identity-provider'
import { CustomDIDAccessController } from '~/services/orbitdb-did-access-controller'
import { useAuthStore } from '~/store/auth'

export default defineNuxtPlugin(async (nuxtApp) => {
  const authStore = useAuthStore()
  const userDid = authStore.currentUser?.did

  if (!process.client || !userDid) {
    return {
      provide: {
        ipfs: null as Helia | null,
        orbitdb: null as OrbitDB | null,
        getOrbitDBInstance: () => null as OrbitDB | null,
        getKeyValueDatabase: async (dbName: string, accessControllerOptions?: any, ownerControlled: boolean = false): Promise<KeyValue<any> | null> => null,
        getDocumentStoreDatabase: async (dbName: string, accessControllerOptions?: any, ownerControlled: boolean = false): Promise<DocumentStore<any> | null> => null,
        currentOrbitDBUserDID: null as string | null,
        mockDidVerificationFunction: null as DidVerificationFunction | null,
      }
    };
  }

  console.log('P2P Plugin: Initializing Helia and OrbitDB...');

  const heliaNode = await createHelia({ /* ... helia options ... */ });
  console.log('P2P Plugin: Helia node created. Peer ID:', heliaNode.libp2p.peerId.toString());

  if (!heliaNode.libp2p) {
    throw new Error('P2P Plugin: Libp2p is not available on the Helia node.');
  }

  const identityProvider = new CustomDIDIdentityProvider({
    did: userDid,
    signingFunction: mockDidSigningFunction(userDid)
  });

  const orbitdb = await createOrbitDB({
    ipfs: heliaNode,
    identity: identityProvider,
    AccessControllers: {
      [CustomDIDAccessController.type]: (orbitdb: any, options: any) => new CustomDIDAccessController(orbitdb, options)
    },
    directory: `./orbitdb/${userDid.replace(/[^a-zA-Z0-9]/g, '_')}`
  });

  console.log(`P2P Plugin: OrbitDB instance created for DID: ${userDid}`);

  const getOrbitDBInstance = (): OrbitDB => orbitdb;

  const getKeyValueDatabase = async (dbName: string, accessControllerOptions?: any, ownerControlled: boolean = false): Promise<KeyValue<any>> => {
    let acToUse: any;
    if (accessControllerOptions) {
      acToUse = accessControllerOptions;
    } else if (ownerControlled && userDid) {
      acToUse = {
        type: CustomDIDAccessController.type,
        write: [userDid],
        verificationFunction: mockDidVerificationFunction,
      };
    } else {
      acToUse = { write: ['*'] };
    }
    return await orbitdb.open(dbName, { type: 'keyvalue', accessController: acToUse }) as KeyValue<any>;
  };

  const getDocumentStoreDatabase = async (dbName: string, accessControllerOptions?: any, ownerControlled: boolean = false): Promise<DocumentStore<any>> => {
    let acToUse: any;
    if (accessControllerOptions) {
      acToUse = accessControllerOptions;
    } else if (ownerControlled && userDid) {
      acToUse = {
        type: CustomDIDAccessController.type,
        write: [userDid],
        verificationFunction: mockDidVerificationFunction,
      };
    } else {
      acToUse = { write: ['*'] };
    }
    return await orbitdb.open(dbName, { type: 'documents', accessController: acToUse }) as DocumentStore<any>;
  };

  return {
    provide: {
      ipfs: heliaNode,
      orbitdb,
      getOrbitDBInstance,
      getKeyValueDatabase,
      getDocumentStoreDatabase,
      currentOrbitDBUserDID: userDid,
      mockDidVerificationFunction
    }
  }
})