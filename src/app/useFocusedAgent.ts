/**
 * Which agent is currently in view -- set by clicking "Re-authorize" on an
 * existing row, or automatically after minting a fresh one -- plus its
 * audit trail. Bundled together because nothing in this app ever wants the
 * pubkey without also wanting the entries that go with it: "which agent am
 * I working with right now" is one idea, not two pieces of state.
 */

import { useState } from "react";
import type { ReadModelDb } from "../readmodel/db";
import type { AuditRecord } from "../readmodel/records";
import { useAuditEntries } from "./useAuditEntries";
import type { VouchdSession } from "./session";

export interface FocusedAgent {
  focusedAgent: string | undefined;
  setFocusedAgent: (pubkey: string | undefined) => void;
  auditEntries: AuditRecord[];
}

export function useFocusedAgent(db: ReadModelDb | null, session: VouchdSession | null): FocusedAgent {
  const [focusedAgent, setFocusedAgent] = useState<string | undefined>(undefined);
  const auditEntries = useAuditEntries(db, session, focusedAgent);
  return { focusedAgent, setFocusedAgent, auditEntries };
}
