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
 *
 * This controller grants write access based on a list of authorized DIDs, which are
 * provided during database creation via the `options.write` array. These DIDs are
 * stored in the `writeAccess` set.
 * It then verifies entry signatures using the `CustomDIDIdentityProvider` and a
 * provided `verificationFunction` to ensure the authenticity of the writer's DID.
 */
export class CustomDIDAccessController {
  private writeAccess: Set<string>; // Set of DIDs explicitly granted write access
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
   * This is the core method called by OrbitDB when an entry is to be added.
   *
   * The process involves two main checks:
   * 1.  **Authorization**: Is the writer's DID (extracted from `entry.identity.id`)
   *     present in the `this.writeAccess` set? This set is initialized from the
   *     `options.write` array provided when the database access controller was configured.
   * 2.  **Authentication**: Is the signature on the entry (`entry.sig`) valid for the
   *     writer's claimed DID and the entry's data (hash)? This is verified using
   *     `CustomDIDIdentityProvider.verifyIdentity` and the `this.verificationFunction`.
   *
   * Both checks must pass for write access to be granted.
   *
   * @param entry The OrbitDB log entry to be appended. It includes identity, signature, and payload.
   * @param identityProvider The identity provider instance (e.g., `CustomDIDIdentityProvider`)
   *                         that OrbitDB uses, which helps in interpreting the entry's identity.
   * @returns A Promise that resolves to `true` if access is granted, `false` otherwise.
   */
  async canAppend(entry: any, identityProvider: CustomDIDIdentityProvider): Promise<boolean> {
    console.log("[DID_AC] canAppend called. Entry ID:", entry.id, "Entry Hash:", entry.hash);
    console.log("[DID_AC] Entry Identity Details:", entry.identity); // Contains { id: writerDID, publicKey, sig: idSignature }
    console.log("[DID_AC] Entry Signature:", entry.sig);
    // Step 1: Extract the writer's DID from the entry's identity.
    // The `entry.identity.id` field should contain the DID string of the purported writer,
    // as populated by the CustomDIDIdentityProvider during entry creation.
    const writerDID = entry.identity.id;
    console.log("[DID_AC] Writer DID from entry identity:", writerDID);
    if (!writerDID) {
      console.warn("[DID_AC] Write DENIED: Writer DID not found in entry identity.");
      return false;
    }

    // Step 2: Authorization Check.
    // Verify if the extracted writer's DID is present in the `writeAccess` set.
    // This set contains DIDs that were explicitly granted write permission when this DB was opened/created.
    if (!this.writeAccess.has(writerDID)) {
      console.warn(`[DID_AC] Write DENIED: DID ${writerDID} is not in the allowed writeAccess list: ${JSON.stringify(Array.from(this.writeAccess))}`);
      return false;
    }

    // Step 3: Authentication Check.
    // Verify the signature of the entry to ensure the writer is authentic and owns the claimed DID.
    // - `entry.sig`: The signature of the entry's hash (or payload).
    // - `entry.hash`: The hash of the entry, typically what is signed.
    // - `this.verificationFunction`: The function (e.g., `mockDidVerificationFunction`) provided during
    //   AC setup, capable of verifying a signature against a DID and data.
    try {
      const dataToVerify = entry.hash; // OrbitDB entries are typically signed over their hash.
      if (!dataToVerify) {
          console.warn("[DID_AC] Write DENIED: No hash found on entry to verify signature against.");
          return false;
      }
      if (!entry.sig) {
        console.warn("[DID_AC] Write DENIED: No signature found on entry.");
        return false;
      }

      console.log(`[DID_AC] Verifying signature: sig=${entry.sig.substring(0,10)}..., did=${writerDID}, dataHash=${dataToVerify.substring(0,10)}...`);
      const isValidSignature = await CustomDIDIdentityProvider.verifyIdentity(
        entry.sig,                // The signature from the entry
        writerDID,                // The DID that supposedly signed the entry
        dataToVerify,             // The data (hash) that was signed
        this.verificationFunction // The verification function passed during AC initialization
      );

      if (!isValidSignature) {
        console.warn(`[DID_AC] Write DENIED: Signature invalid for DID ${writerDID}.`);
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
