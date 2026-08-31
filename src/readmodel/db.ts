/**
 * The IndexedDB side of the projection: schema, and applying mutations.
 *
 * Everything interesting already happened in projector.ts — this layer makes
 * no decisions, which is why it has almost no tests and doesn't need them.
 * Deliberately a separate database from the keystore (src/signer): this one
 * is safe to delete and rebuild, and that must never become true of a key.
 */

import { type DBSchema, type IDBPDatabase, deleteDB, openDB } from "idb";
import type { Mutation } from "./projector";
import type { AgentRecord, ChannelRecord, MemberRecord, PresenceRecord } from "./records";

const DB_NAME = "vouchd-readmodel";
const DB_VERSION = 1;

interface ReadModelSchema extends DBSchema {
  agents: { key: string; value: AgentRecord };
  channels: { key: string; value: ChannelRecord };
  members: { key: [string, string]; value: MemberRecord };
  presence: { key: string; value: PresenceRecord };
}

export type ReadModelDb = IDBPDatabase<ReadModelSchema>;

export async function openReadModel(): Promise<ReadModelDb> {
  return openDB<ReadModelSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("agents", { keyPath: "pubkey" });
      db.createObjectStore("channels", { keyPath: "channelId" });
      db.createObjectStore("members", { keyPath: ["channelId", "pubkey"] });
      db.createObjectStore("presence", { keyPath: "pubkey" });
    },
  });
}

export async function applyMutations(db: ReadModelDb, mutations: Mutation[]): Promise<void> {
  for (const mutation of mutations) {
    if (mutation.op === "delete") {
      await db.delete("members", [mutation.channelId, mutation.pubkey]);
      continue;
    }
    await db.put(mutation.store, mutation.value as never);
  }
}

/**
 * Drop the whole projection. This is a routine recovery step, not a
 * destructive one: a fresh subscription rebuilds it from the relay.
 */
export async function resetReadModel(db?: ReadModelDb): Promise<void> {
  db?.close();
  await deleteDB(DB_NAME);
}
