/**
 * The NIP-42 AUTH event (kind:22242) a client signs to answer a relay's
 * challenge.
 *
 * Buzz-specific detail worth knowing: this relay also reads a NIP-OA `auth`
 * tag off the *signed AUTH event* (see buzz-relay `handlers/auth.rs`), which
 * is how an agent gains relay membership through its owner's attestation
 * rather than being listed as a member itself. That is why `authTag` is a
 * parameter here and not an afterthought — for an agent connecting on its
 * own key, it is the difference between being let in and being refused.
 */

import { KIND_AUTH } from "../kinds";
import type { AuthTag } from "../nipOA";
import { type EventTemplate, nowSeconds } from "./types";

export function buildAuthEvent(
  relayUrl: string,
  challenge: string,
  authTag?: AuthTag,
  createdAt: number = nowSeconds(),
): EventTemplate {
  const tags: string[][] = [
    ["relay", relayUrl],
    ["challenge", challenge],
  ];
  if (authTag) tags.push([...authTag]);
  return { kind: KIND_AUTH, tags, content: "", created_at: createdAt };
}
