/**
 * NIP-11: a relay's own self-description, fetched as a plain HTTPS GET
 * against its own origin (same host as the `wss://` URL, `Accept:
 * application/nostr+json`) rather than anything this app invents. Vouchd
 * has no other concept of "what is this community" -- a community *is* a
 * relay URL (see CommunityPanel's own docblock) -- so this is the one
 * honest source for a name/description to show alongside it.
 *
 * It is also the only place a relay states its own signing pubkey, which is
 * why `self` matters well beyond display: see the field's own note.
 *
 * Fails silently on purpose: a missing document, a non-OK response, a CORS
 * refusal, or unparseable JSON all just mean "nothing to show", the same
 * fails-quiet posture `useAuthorizedImage` already takes for Blossom's own
 * CORS gaps (see CHANGELOG.md's entry for that fix). Nothing here retries
 * or surfaces the failure -- a stat-bar nicety isn't worth an error state,
 * and the one non-cosmetic caller treats a missing `self` as "trust nothing
 * extra", which is what this app did before it ever asked.
 */

export interface RelayInfo {
  name?: string;
  description?: string;
  /**
   * The relay's own signing pubkey (hex), when it has a stable key --
   * buzz-relay's nip11.rs calls this "the relay's own signing pubkey (NIP-11
   * `self` field, NIP-43)" and refuses to advertise NIP-43 without one,
   * because those events "must be verifiable against `self`".
   *
   * The trust anchor for events the relay signs *about* a community rather
   * than relays on someone's behalf. Without it a relay-generated kind:39002
   * roster can't be told apart from one any member published -- see
   * projectChannelRoster.
   */
  self?: string;
}

export async function fetchRelayInfo(relayUrl: string, signal?: AbortSignal): Promise<RelayInfo | null> {
  try {
    const infoUrl = relayUrl.replace(/^ws/, "http");
    const response = await fetch(infoUrl, { headers: { Accept: "application/nostr+json" }, signal });
    if (!response.ok) return null;
    return (await response.json()) as RelayInfo;
  } catch {
    return null;
  }
}
