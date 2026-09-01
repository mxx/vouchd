/**
 * The audit trail: an ordinary relay event recording that an owner minted
 * or renewed a NIP-OA attestation for an agent. Signed by the owner's
 * day-to-day identity (NIP-07) -- never by the keystore that produced the
 * attestation's raw signature. That split is the two-signing-path rule from
 * docs/ARCHITECTURE.md: the keystore's only output is ever that one Schnorr
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
