/**
 * Shared vocabulary for the event builders.
 *
 * The string values here are wire format, not display labels — they are what
 * the relay stores and matches on. They were read out of the Buzz sources
 * rather than invented: `MemberRole` and `ChannelVisibility`/`ChannelType`
 * mirror `buzz-core/src/channel.rs`, whose `as_str()` is documented there as
 * "matches DB enum and Nostr tags". Changing a value here silently breaks
 * interop with every other client on the relay.
 */

/** An unsigned event, shaped for a signer (NIP-07 or nostr-tools) to finalize. */
export interface EventTemplate {
  kind: number;
  tags: string[][];
  content: string;
  created_at: number;
}

/** Channel member roles. Bot is a designation, not a rung in the hierarchy. */
export type MemberRole = "owner" | "admin" | "member" | "guest" | "bot";

/** Open = searchable and joinable without invite; private = invite-only. */
export type ChannelVisibility = "open" | "private";

/** The functional type of a channel. */
export type ChannelType = "stream" | "forum" | "dm" | "workflow";

/** Seconds since the Unix epoch, the only time unit Nostr events use. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
