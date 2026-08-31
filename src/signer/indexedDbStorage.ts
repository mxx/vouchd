/**
 * The browser-side home for the encrypted owner key.
 *
 * One record, one key ("owner"), in its own database — deliberately not
 * shared with the read-model database (src/readmodel/db.ts). The read model
 * is disposable: dropping and rebuilding it from the relay is a routine
 * recovery step. Losing the keystore is not recoverable, so it must never be
 * inside something we treat as safe to delete.
 */

import { type IDBPDatabase, openDB } from "idb";
import type { EncryptedSecret, KeystoreStorage } from "./ownerKeystore";

const DB_NAME = "vouchd-keystore";
const STORE = "keystore";
const RECORD_KEY = "owner";

async function database(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE);
    },
  });
}

export function createIndexedDbStorage(): KeystoreStorage {
  return {
    async load() {
      const db = await database();
      return ((await db.get(STORE, RECORD_KEY)) as EncryptedSecret | undefined) ?? null;
    },
    async save(record) {
      const db = await database();
      await db.put(STORE, record, RECORD_KEY);
    },
    async clear() {
      const db = await database();
      await db.delete(STORE, RECORD_KEY);
    },
  };
}
