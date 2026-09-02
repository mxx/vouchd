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
 *
 * `describeConditions` takes the caller's `conditions` dictionary
 * (`Messages["conditions"]`, src/i18n/messages.ts) rather than owning
 * English copy itself: this module is protocol logic, not UI, and the
 * words it produces have to change with the app's chosen language. Passing
 * the dictionary in — rather than this module importing one language's
 * strings — keeps that direction honest: i18n depends on protocol logic,
 * protocol logic never depends on i18n.
 */

import { parseConditions } from "../../protocol/conditions";
import type { Messages } from "../../i18n/messages";

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

/**
 * Human-readable lines for a confirmation screen, in whichever language
 * `messages` was drawn from. Throws if the string is malformed.
 */
export function describeConditions(conditions: string, messages: Messages["conditions"]): string[] {
  const clauses = parseConditions(conditions);
  if (clauses.length === 0) return [messages.none];
  return clauses.map((clause) => {
    switch (clause.type) {
      case "kind":
        return messages.onlyKind(clause.value);
      case "created_at_lt":
        return messages.onlyBefore(new Date(clause.value * 1000).toISOString());
      case "created_at_gt":
        return messages.onlyAfter(new Date(clause.value * 1000).toISOString());
    }
  });
}
