/**
 * NIP-11: a relay's own self-description, fetched as a plain HTTPS GET
 * against its own origin (same host as the `wss://` URL, `Accept:
 * application/nostr+json`) rather than anything this app invents. Vouchd
 * has no other concept of "what is this community" -- a community *is* a
 * relay URL (see CommunityPanel's own docblock) -- so this is the one
 * honest source for a name/description to show alongside it.
 *
 * Fails silently on purpose: a missing document, a non-OK response, a CORS
 * refusal, or unparseable JSON all just mean "nothing to show", the same
 * fails-quiet posture `useAuthorizedImage` already takes for Blossom's own
 * CORS gaps (see CHANGELOG.md's entry for that fix). Nothing here retries
 * or surfaces the failure -- a stat-bar nicety isn't worth an error state.
 */

export interface RelayInfo {
  name?: string;
  description?: string;
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
