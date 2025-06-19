declare module '@orbitdb/core' {
  import { type Helia } from 'helia';

  export interface KeyValue<T> {
    get(key: string): Promise<T | undefined>;
    put(key: string, value: T): Promise<string>;
    del(key: string): Promise<string>;
    all(): Promise<{ key: string; value: T; hash: string }[]>;
  }

  export interface DocumentStore<T> {
    get(key:string): Promise<T[]>;
    put(doc: T): Promise<string>;
    del(key: string): Promise<string>;
    query(queryFn: (doc: T) => boolean): Promise<T[]>;
  }

  export interface OrbitDB {
    open(address: string, options?: any): Promise<KeyValue<any> | DocumentStore<any>>;
    stop(): Promise<void>;
  }

  export function createOrbitDB(options: { ipfs: Helia;[key: string]: any }): Promise<OrbitDB>;
}