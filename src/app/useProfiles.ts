/**
 * A live pubkey -> ProfileRecord lookup, straight off the `profiles` store.
 *
 * Exists for one job: the audit trail's "authorized by" pubkey is an owner,
 * never an agent, so it can't be resolved through useAgentRows. Kept as a
 * plain map over every observed profile (not owner-specific) since nothing
 * about the store itself is owner-only -- see records.ts's ProfileRecord.
 */

import { useEffect, useState } from "react";
import type { ReadModelDb } from "../readmodel/db";
import { listProfiles } from "../readmodel/queries";
import type { ProfileRecord } from "../readmodel/records";
import type { VouchdSession } from "./session";

export function useProfiles(
  db: ReadModelDb | null,
  session: VouchdSession | null,
): Map<string, ProfileRecord> {
  const [profiles, setProfiles] = useState<Map<string, ProfileRecord>>(new Map());

  useEffect(() => {
    if (!db) return;
    let live = true;

    async function reload() {
      const all = await listProfiles(db as ReadModelDb);
      if (live) setProfiles(new Map(all.map((profile) => [profile.pubkey, profile])));
    }

    void reload();
    const unsubscribe = session?.onChange(() => void reload());
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [db, session]);

  return profiles;
}
