/**
 * Turning what an operator means ("this bot may post for 90 days") into the
 * NIP-OA `conditions` string, and back into words for display.
 *
 * The honesty this module owes the user, straight from the spec's own
 * security notes: a `created_at<` clause constrains the event's *self-
 * declared* timestamp, and the agent declares it. A misbehaving agent can
 * backdate an event to satisfy an expired window. So an expiry here is a
 * statement of intent that well-behaved verifiers enforce — not a wall-clock
 * kill switch. `describeConditions` says so out loud, because a UI that
 * renders "expires in 90 days" without that caveat is teaching the operator
 * something false about what they just signed.
 */

import { parseConditions } from "../../protocol/conditions";

export interface ConditionsDraft {
  /** Restrict the attestation to a single event kind. */
  kind?: number;
  /** Attestation is invalid for events dated at or after this instant. */
  expiresAt?: Date;
  /** Attestation is invalid for events dated at or before this instant. */
  notBefore?: Date;
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Clause order is part of the signed preimage, so it is fixed here rather
 * than left to object-key iteration: two callers describing the same intent
 * must produce the same string, or they produce different signatures.
 */
export function buildConditions(draft: ConditionsDraft): string {
  const clauses: string[] = [];
  if (draft.kind !== undefined) clauses.push(`kind=${draft.kind}`);
  if (draft.notBefore) clauses.push(`created_at>${unixSeconds(draft.notBefore)}`);
  if (draft.expiresAt) clauses.push(`created_at<${unixSeconds(draft.expiresAt)}`);
  return clauses.join("&");
}

/** Human-readable lines for a confirmation screen. Throws if the string is malformed. */
export function describeConditions(conditions: string): string[] {
  const clauses = parseConditions(conditions);
  if (clauses.length === 0) {
    return ["No restrictions: valid for any event, with no expiry."];
  }
  return clauses.map((clause) => {
    switch (clause.type) {
      case "kind":
        return `Only events of kind ${clause.value}.`;
      case "created_at_lt":
        return `Only events dated before ${new Date(clause.value * 1000).toISOString()}.`;
      case "created_at_gt":
        return `Only events dated after ${new Date(clause.value * 1000).toISOString()}.`;
    }
  });
}

/**
 * The caveat that belongs next to any expiry a UI displays. Kept here so it
 * can't drift out of sync with the clause that made it necessary.
 */
export const EXPIRY_CAVEAT =
  "Expiry constrains the timestamp an agent puts on its own events, so it binds " +
  "well-behaved verifiers, not a compromised agent. There is no revocation in " +
  "NIP-OA: to withdraw trust sooner, issue short windows and stop renewing them.";
