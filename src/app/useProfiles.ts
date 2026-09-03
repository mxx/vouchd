/**
 * A live pubkey -> display metadata lookup over *both* stores a kind:0 can
 * land in.
 *
 * Reading only `profiles` was a bug with a confusing symptom: projectProfile
 * routes an attested kind:0 to `agents` and an unattested one to `profiles`,
 * never both, so an agent -- the exact thing this app exists to name -- had
 * no entry here at all and every lookup fell through to a bare pubkey. The
 * two stores differ in what they *prove* (an AgentRecord carries a verified
 * owner attestation), not in what they display, and AgentRecord is a
 * structural superset of ProfileRecord, so one merged map is the honest
 * shape for a caller that only wants a name. Callers that care about the
 * attestation read the agents store directly.
 *
 * Agents are merged last: for a pubkey that somehow has both, the record
 * whose provenance was verified should be the one shown.
 */

import { useEffect, useState } from "react";
import type { ReadModelDb } from "../readmodel/db";
import { listAgents, listProfiles } from "../readmodel/queries";
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
      const [profiles, agents] = await Promise.all([
        listProfiles(db as ReadModelDb),
        listAgents(db as ReadModelDb),
      ]);
      if (live) setProfiles(new Map([...profiles, ...agents].map((record) => [record.pubkey, record])));
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
