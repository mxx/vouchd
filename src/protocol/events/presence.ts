/**
 * Presence (kind:20001), ported from `buzz-sdk/src/builders.rs`
 * (build_presence_update). Ephemeral: relays forward it and forget it.
 *
 * This app mostly *reads* presence rather than publishing it — presence is
 * how it learns whether a remotely-run agent is alive, since it holds no
 * management channel to wherever that agent runs. Publishing is here for
 * completeness and for the operator's own client identity.
 *
 * Reader beware: presence is a lease the publisher renews, not a flag it
 * sets. An agent killed without ceremony stays "online" until the relay's
 * TTL expires it (180s in Buzz's relay, `PRESENCE_TTL_SECS`). Treat a stale
 * dot as bounded-wrong, never as proof of life.
 */

import { KIND_PRESENCE_UPDATE } from "../kinds";
import { type EventTemplate, nowSeconds } from "./types";

export type PresenceStatus = "online" | "away" | "offline";

export function buildPresenceUpdate(
  status: PresenceStatus,
  createdAt: number = nowSeconds(),
): EventTemplate {
  return {
    kind: KIND_PRESENCE_UPDATE,
    tags: [["status", status]],
    content: status,
    created_at: createdAt,
  };
}
