/**
 * The audit trail for one agent, read-through from the projection.
 *
 * Scoped to a single agent on purpose, not "every action on the relay": an
 * operator who clicked one agent's row is asking "what happened to this
 * one", and an unbounded feed would answer a question nobody asked.
 */

import { useEffect, useState } from "react";
import type { ReadModelDb } from "../readmodel/db";
import { listAuditEntries } from "../readmodel/queries";
import type { AuditRecord } from "../readmodel/records";
import type { VouchdSession } from "./session";

export function useAuditEntries(
  db: ReadModelDb | null,
  session: VouchdSession | null,
  agentPubkey: string | undefined,
): AuditRecord[] {
  const [entries, setEntries] = useState<AuditRecord[]>([]);

  useEffect(() => {
    if (!db || !agentPubkey) {
      setEntries([]);
      return;
    }
    let live = true;
    const reload = () => {
      void listAuditEntries(db, agentPubkey).then((next) => live && setEntries(next));
    };
    reload();
    const unsubscribe = session?.onChange(reload);
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [db, session, agentPubkey]);

  return entries;
}
