/**
 * Input guards shared by the builders.
 *
 * These run at build time, before anything is signed, because a malformed
 * tag that reaches the relay is rejected without a useful error — and a
 * malformed one that is *accepted* (a wrong-case pubkey, say) silently fails
 * to match anyone. Catching it here turns a distributed debugging session
 * into a stack trace.
 */

export class EventBuildError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Pubkeys go on the wire lowercase. Buzz's own builders call
 * `to_ascii_lowercase()` rather than rejecting mixed case, so we normalize
 * too — a caller pasting an uppercase hex key from another tool is a
 * routine mistake, not a protocol violation worth failing on.
 */
export function normalizePubkey(pubkey: string, label = "pubkey"): string {
  const normalized = pubkey.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new EventBuildError(`${label} must be 64 hex chars, got: "${pubkey}"`);
  }
  return normalized;
}

/** Channel ids are UUIDs, serialized hyphenated and lowercase (Rust's `Uuid::to_string`). */
export function assertChannelId(channelId: string): string {
  const normalized = channelId.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new EventBuildError(`channel_id must be a UUID, got: "${channelId}"`);
  }
  return normalized;
}

/**
 * Mirrors `buzz_core::channel::canonical_channel_name`: strip leading `#`
 * and whitespace, trim the tail. Users type "#general"; the wire carries
 * "general". Diverging from the Rust here would create channels whose names
 * don't match what other clients produce for the same input.
 */
export function canonicalChannelName(name: string): string {
  const canonical = name.replace(/^[#\s]+/, "").trimEnd();
  if (canonical === "") {
    throw new EventBuildError("channel name is required");
  }
  return canonical;
}
