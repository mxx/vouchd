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
import type { AgentRecord, AuditRecord, ChannelRecord, MemberRecord, PresenceRecord } from "./records";

const DB_NAME = "vouchd-readmodel";
// v2 added `auditLog`. Bumping this without guarding each createObjectStore
// call below would throw on every browser that already has a v1 database --
// see the `contains` checks in upgrade().
const DB_VERSION = 2;

interface ReadModelSchema extends DBSchema {
  agents: { key: string; value: AgentRecord };
  channels: { key: string; value: ChannelRecord };
  members: { key: [string, string]; value: MemberRecord };
  presence: { key: string; value: PresenceRecord };
  auditLog: { key: string; value: AuditRecord };
}

export type ReadModelDb = IDBPDatabase<ReadModelSchema>;

/**
 * idb re-runs this whole function on every version bump, not just the
 * delta, so each store creation has to be guarded -- otherwise upgrading a
 * browser that already has a v1 database throws "store already exists" on
 * the four stores that predate `auditLog`.
 */
export async function openReadModel(): Promise<ReadModelDb> {
  return openDB<ReadModelSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const names = db.objectStoreNames;
      if (!names.contains("agents")) db.createObjectStore("agents", { keyPath: "pubkey" });
      if (!names.contains("channels")) db.createObjectStore("channels", { keyPath: "channelId" });
      if (!names.contains("members")) {
        db.createObjectStore("members", { keyPath: ["channelId", "pubkey"] });
      }
      if (!names.contains("presence")) db.createObjectStore("presence", { keyPath: "pubkey" });
      if (!names.contains("auditLog")) db.createObjectStore("auditLog", { keyPath: "id" });
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
