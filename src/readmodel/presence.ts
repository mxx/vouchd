/**
 * Deciding whether a presence record still means anything.
 *
 * The relay expires presence after `PRESENCE_TTL_SECS` (180s in Buzz's
 * relay, `buzz-pubsub/src/presence.rs`) because presence is a lease the
 * publisher renews, not a flag it sets. An agent whose machine vanished
 * without a graceful exit keeps its last "online" record until that window
 * closes — bounded wrong, never indefinitely wrong.
 *
 * We apply the same window locally rather than trusting the stored status,
 * so a UI built on this can never show a dot that outlives the protocol's
 * own guarantee. Pure functions, so the boundary is testable without a clock.
 */

import type { PresenceRecord } from "./records";

/** Matches the relay's own expiry window. Changing this desynchronizes the UI from the truth. */
export const PRESENCE_TTL_SECONDS = 180;

export type EffectivePresence = "online" | "away" | "offline" | "unknown";

/**
 * `unknown` and `offline` are different answers: offline is something the
 * agent said, unknown is something we never heard. Collapsing them would
 * turn "we have no information" into a claim.
 */
export function effectivePresence(
  record: PresenceRecord | undefined,
  nowSeconds: number,
): EffectivePresence {
  if (!record) return "unknown";
  if (nowSeconds - record.observedAt > PRESENCE_TTL_SECONDS) return "unknown";
  if (record.status === "online" || record.status === "away" || record.status === "offline") {
    return record.status;
  }
  return "unknown";
}

export function isFresh(record: PresenceRecord, nowSeconds: number): boolean {
  return nowSeconds - record.observedAt <= PRESENCE_TTL_SECONDS;
}
