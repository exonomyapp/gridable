// Import the Identity Provider and verification function type
import { CustomDIDIdentityProvider, DidVerificationFunction } from './orbitdb-did-identity-provider';

interface AccessControllerOptions {
  write: string[]; // Array of DIDs that have write access (typically just the owner's DID for private DBs)
  admin?: string[]; // Optional: DIDs that can modify access (more advanced)
  // The verification function needs to be accessible here.
  // It could be passed in, or assumed to be globally available via a DID utility class.
  verificationFunction: DidVerificationFunction;
}

/**
 * Custom DID Access Controller for OrbitDB.
 * Grants write access based on a list of authorized DIDs and verifies
 * entry signatures using the CustomDIDIdentityProvider.
 */
export class CustomDIDAccessController {
  private writeAccess: Set<string>;
  private adminAccess: Set<string>;
  private verificationFunction: DidVerificationFunction;
  private orbitdb: any; // OrbitDB instance, passed for context if needed by underlying systems

  public static get type() { return 'custom-did-ac'; } // Unique type for this AC

  constructor(orbitdbInstance: any, options: AccessControllerOptions) {
    if (!options || !options.write || !options.write.length) {
      throw new Error("Write access list (array of DIDs) is required in options.");
    }
    if (!options.verificationFunction) {
      throw new Error("Verification function is required in options.");
    }

    this.orbitdb = orbitdbInstance; // Useful for accessing OrbitDB utils or identity anagement
    this.writeAccess = new Set(options.write);
    this.adminAccess = new Set(options.admin || options.write); // Admins default to those with write access
    this.verificationFunction = options.verificationFunction;
    console.log(`[DID_AC] New CustomDIDAccessController created. Write Access: ${JSON.stringify(Array.from(this.writeAccess))}, Admin Access: ${JSON.stringify(Array.from(this.adminAccess))}`);
  }

  /**
   * Determines if an identity (DID) can append an entry to the database.
   * This is the core method called by OrbitDB.
   * @param entry The OrbitDB log entry to be appended.
   * @param identityProvider The identity provider instance that can verify signatures.
   * @returns A Promise that resolves to true if access is granted, false otherwise.
   */
  async canAppend(entry: any, identityProvider: CustomDIDIdentityProvider): Promise<boolean> {
    console.log("[DID_AC] canAppend called. Entry ID:", entry.id, "Entry Hash:", entry.hash);
    console.log("[DID_AC] Entry Identity Details:", entry.identity);
    console.log("[DID_AC] Entry Signature:", entry.sig);
    // 1. Get the DID of the writer from the entry's identity
    //    The entry.identity object is created by the identityProvider.getId() and related signing.
    //    So, entry.identity.id should be the DID string.
    const writerDID = entry.identity.id;
    console.log("[DID_AC] Writer DID from entry identity:", writerDID);
    if (!writerDID) {
      console.warn("CustomDIDAccessController: Writer DID not found in entry identity.");
      return false;
    }

    // 2. Check if the writer's DID is in the allowed write access list
    if (!this.writeAccess.has(writerDID)) {
      console.warn(`[DID_AC] Write DENIED: ${writerDID} not in allowed list: ${JSON.stringify(Array.from(this.writeAccess))}`);
      console.warn(`CustomDIDAccessController: DID ${writerDID} not in write access list for this database.`);
      return false;
    }

    // 3. Verify the signature of the entry
    //    - entry.sig: The signature of the entry's payload/hash.
    //    - entry.key: The public key associated with the identity (might be the DID itself or a linked key).
    //    - entry.payload: The actual data/payload of the entry.
    //    - entry.hash: The hash of the entry (often what's actually signed).
    //    The identityProvider's static verifyIdentity method is suitable here.
    try {
      // Data that was signed is typically entry.hash or some canonical form of the entry.
      // This depends on how OrbitDB structures entries for signing.
      // Let's assume entry.hash is what needs to be verified against entry.sig using writerDID.
      // The CustomDIDIdentityProvider's verifyIdentity expects (signature, did, data, verificationFn)
      const dataToVerify = entry.hash;
      if (!dataToVerify) {
          console.warn("CustomDIDAccessController: No hash found on entry to verify signature against.");
          return false;
      }

      console.log(`[DID_AC] Verifying signature: sig=${entry.sig}, did=${writerDID}, data=${dataToVerify}`);
      const isValidSignature = await CustomDIDIdentityProvider.verifyIdentity(
        entry.sig,          // The signature on the entry
        writerDID,          // The DID that supposedly signed it
        dataToVerify,       // The data (hash) that was signed
        this.verificationFunction // The function to perform DID-specific verification
      );

      if (!isValidSignature) {
        console.warn(`[DID_AC] Write DENIED: Signature invalid for DID ${writerDID}.`);
        console.warn(`CustomDIDAccessController: Invalid signature for DID ${writerDID} on entry.`);
        return false;
      }
    } catch (e) {
      console.error("CustomDIDAccessController: Error during signature verification:", e);
      return false;
    }

    // If all checks pass, grant access
    console.log(`[DID_AC] Write GRANTED for DID ${writerDID}.`);
    return true;
  }

  /**
   * Optional: Grant write access to a DID.
   * Requires the caller to have admin privileges.
   * This is more advanced as it requires this AC to modify its own state,
   * which usually means the DB manifest needs to be updatable by admins.
   */
  async grant(identityProvider: CustomDIDIdentityProvider, capability: 'write' | 'admin', didToGrant: string) {
    const callerDID = await identityProvider.getId({});
    if (!this.adminAccess.has(callerDID)) {
      throw new Error(`DID ${callerDID} is not authorized to grant capabilities.`);
    }
    if (capability === 'write') {
      this.writeAccess.add(didToGrant);
    } else if (capability === 'admin') {
      this.adminAccess.add(didToGrant);
    }
    // TODO: Persist this change (e.g., update the database manifest if this AC is stored there).
    // This is non-trivial as ACs are typically instantiated with static permissions per DB session.
    // Modifying live AC permissions often involves a more complex setup (e.g., specific "admin" operations
    // that update the AC's configuration entry in the DB manifest).
    console.log(`Capability '${capability}' granted to ${didToGrant} (requires persistence layer).`);
  }

  /**
   * Optional: Revoke write access from a DID.
   */
  async revoke(identityProvider: CustomDIDIdentityProvider, capability: 'write' | 'admin', didToRevoke: string) {
    const callerDID = await identityProvider.getId({});
    if (!this.adminAccess.has(callerDID)) {
      throw new Error(`DID ${callerDID} is not authorized to revoke capabilities.`);
    }
     if (capability === 'write') {
      this.writeAccess.delete(didToRevoke);
    } else if (capability === 'admin') {
      this.adminAccess.delete(didToRevoke);
    }
    // TODO: Persist this change.
    console.log(`Capability '${capability}' revoked from ${didToRevoke} (requires persistence layer).`);
  }

  // Method to return the manifest parameters, used by OrbitDB when loading the DB
  get manifestParams() {
    return {
      write: Array.from(this.writeAccess), // OrbitDB expects this in the manifest
      admin: Array.from(this.adminAccess),
      // Note: verificationFunction cannot be directly serialized.
      // The type of this AC ('custom-did-ac') implies which verification logic to use.
      // The actual verification function would be provided globally or at OrbitDB initialization.
    };
  }

  // Static method used by OrbitDB to create an instance from a manifest
  static async create(orbitdbInstance: any, options: AccessControllerOptions) {
    // When OrbitDB loads a database, if it finds this AC type in the manifest,
    // it will call this 'create' method with the options stored in the manifest.
    // We need to ensure the verificationFunction is available here.
    // This might mean 'options' needs to include a way to get it, or it's globally registered.
    if (!options.verificationFunction) {
        // This is a tricky part: the verification function isn't part of the serialized manifest.
        // It needs to be re-associated when the AC is created upon DB load.
        // One way is to have a global registry or pass it via orbitdbInstance._options or similar.
        // For now, we'll assume it's passed in options, which means the DB loading logic
        // needs to be smart enough to provide it.
        console.warn("CustomDIDAccessController.create: verificationFunction not provided in options. Using placeholder.");
        options.verificationFunction = async () => false; // Placeholder
    }
    return new CustomDIDAccessController(orbitdbInstance, options);
  }
}

/*
  How this would be used (conceptually):

  1. OrbitDB Setup (e.g., in services/orbitdb.ts, during getOrbitDBInstance or db creation):
     - const orbitdb = await createOrbitDB({
         ipfs: heliaNode,
         identity: didIdentityProviderInstance,
         // Register the custom Access Controller type with OrbitDB
         AccessControllers: { [CustomDIDAccessController.type]: CustomDIDAccessController }
       });

  2. Creating a new User-Specific Database (e.g., in services/userPreferences.ts):
     - const userDID = authStore.currentUser.did;
     - const verificationFunction = getGlobalVerificationFunction(); // Get from a central place
     - const db = await orbitdb.open('user-preferences-db-name', {
         type: 'keyvalue', // or 'documents'
         AccessController: {
           type: CustomDIDAccessController.type, // Use our custom AC type
           write: [userDID], // Only this user can write
           admin: [userDID], // Only this user can (conceptually) manage permissions
           verificationFunction: verificationFunction // Pass the verifier
         },
         // ... other db options
       });
*/
