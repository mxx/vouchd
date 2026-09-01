/**
 * The audit trail: an ordinary relay event recording that an owner minted
 * or renewed a NIP-OA attestation for an agent. Signed as a normal event --
 * through whichever signing capability the connection is using (NIP-07 or
 * the owner keystore, see docs/ARCHITECTURE.md's "Two signing operations,
 * one chosen identity") -- never with the keystore's *other*, raw-preimage
 * signature that produced the attestation itself. That distinction is a
 * hard boundary regardless of which capability is doing the day-to-day
 * signing: the keystore's raw-preimage output is only ever that one Schnorr
 * signature, so it stays untouched here even though this event describes
 * what that signature was for.
 *
 * There is no "revoke" action. NIP-OA has no real revocation (see
 * nipOA.ts / NIP-OA.md's own security note), so there is nothing true an
 * event could assert beyond what `renew` already means: the owner chose not
 * to extend it. features/audit/README.md tracks a public "revoke" notice as
 * a deliberately deferred decision, not an oversight.
 */

import { KIND_AUDIT_LOG } from "../kinds";
import type { AuthTag } from "../nipOA";
import { type EventTemplate, nowSeconds } from "./types";

export type AuditAction = "register" | "renew";

/** The embedded `auth` tag is the evidence: readers can verify it themselves. */
export function buildAuditEntry(
  action: AuditAction,
  agentPubkeyHex: string,
  authTag: AuthTag,
  createdAt: number = nowSeconds(),
): EventTemplate {
  const tags: string[][] = [["p", agentPubkeyHex], ["action", action], [...authTag]];
  return { kind: KIND_AUDIT_LOG, tags, content: "", created_at: createdAt };
}
