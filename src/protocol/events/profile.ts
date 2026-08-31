/**
 * Profile metadata (kind:0), ported from `buzz-sdk/src/builders.rs`
 * (build_profile).
 *
 * Scope boundary worth stating, because it is the whole product thesis:
 * this app does NOT publish an *agent's* profile. A kind:0 event is authored
 * by the key it describes, and this app never holds an agent's secret key —
 * the agent publishes its own profile from wherever it runs. This builder is
 * for the operator's own identity, and as a reference shape for agent
 * authors who want to match what other Buzz clients expect.
 */

import { KIND_PROFILE } from "../kinds";
import { type EventTemplate, nowSeconds } from "./types";

export interface ProfileFields {
  display_name?: string;
  name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
}

/** Only the fields actually supplied are serialized — an absent key and an
 *  empty-string key mean different things to clients rendering a profile. */
export function buildProfile(
  fields: ProfileFields,
  createdAt: number = nowSeconds(),
): EventTemplate {
  const present = Object.entries(fields).filter(([, value]) => value !== undefined);
  return {
    kind: KIND_PROFILE,
    tags: [],
    content: JSON.stringify(Object.fromEntries(present)),
    created_at: createdAt,
  };
}
