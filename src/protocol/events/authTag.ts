/**
 * Attaching a NIP-OA `auth` tag to an outgoing event.
 *
 * Who needs this: an *agent*, on every event it publishes, to carry its
 * owner's attestation. This app mints the tag (src/protocol/nipOA.ts) and
 * hands the string to the agent's operator; the agent itself — running
 * wherever its operator runs it, holding its own key — attaches it here (or
 * in whatever client library it uses) and signs.
 *
 * The tag is a reusable capability: the same tag may ride many events by the
 * same agent key, provided each event satisfies the tag's conditions. It is
 * NOT an identity override — the event stays authored by the agent's own
 * pubkey, and a client that rendered the owner as the author would be
 * violating the NIP.
 */

import type { AuthTag } from "../nipOA";
import type { EventTemplate } from "./types";

export class AuthTagError extends Error {}

/**
 * Returns a copy of `template` carrying exactly one `auth` tag.
 *
 * Refuses rather than replaces when a tag is already present: NIP-OA says an
 * event with more than one `auth` tag MUST be treated as having none, so
 * silently overwriting one caller's attestation with another's would produce
 * an event that looks signed-and-attested but verifies as neither.
 */
export function attachAuthTag(template: EventTemplate, authTag: AuthTag): EventTemplate {
  if (template.tags.some((tag) => tag[0] === "auth")) {
    throw new AuthTagError("event already carries an auth tag (NIP-OA permits at most one)");
  }
  return { ...template, tags: [...template.tags, [...authTag]] };
}
