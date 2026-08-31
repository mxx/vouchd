/**
 * Nostr/Buzz event kind constants actually used by this app.
 *
 * Source of truth for numbers is `buzz/crates/buzz-core/src/kind.rs` in the
 * Buzz repo (a sibling project) -- only add a constant here after confirming
 * it there. Do not guess kind numbers; a wrong one is a silent protocol bug,
 * not a compile error.
 */

/** NIP-01 metadata (profile). Standard Nostr kind. */
export const KIND_PROFILE = 0;

/** Buzz channel message. Confirmed via buzz-sdk builders.rs (build_message). */
export const KIND_MESSAGE = 9;

/** Buzz "add member to channel". Confirmed via buzz-sdk builders.rs (build_add_member). */
export const KIND_ADD_MEMBER = 9000;

/** Buzz "remove member from channel". Confirmed via buzz-sdk builders.rs (build_remove_member). */
export const KIND_REMOVE_MEMBER = 9001;

/** Buzz "join channel" (self-add). Confirmed via buzz-sdk builders.rs (build_join). */
export const KIND_JOIN_CHANNEL = 9021;

/** Buzz "leave channel" (self-remove). Confirmed via buzz-sdk builders.rs (build_leave). */
export const KIND_LEAVE_CHANNEL = 9022;

/** Buzz "create channel". Confirmed via buzz-sdk builders.rs (build_create_channel). */
export const KIND_CREATE_CHANNEL = 9007;

/** Per-pubkey channel_add_policy declaration. Confirmed via buzz-relay handlers/side_effects.rs. */
export const KIND_CHANNEL_ADD_POLICY = 10100;

/** Ephemeral presence update (online/away/offline). Confirmed: buzz-core kind.rs = 20001. */
export const KIND_PRESENCE_UPDATE = 20001;

/** NIP-42 AUTH. Standard Nostr kind, used for relay authentication handshake. */
export const KIND_AUTH = 22242;

/**
 * TODO (not yet assigned): a platform-local kind for publishing our own
 * audit trail ("owner X authorized agent Y at T with conditions C") as a
 * relay event instead of a local database -- see docs/ARCHITECTURE.md.
 * Pick a number in Nostr's addressable/regular custom range and register it
 * here once decided; do not invent one silently in feature code.
 */
export const KIND_VOUCHD_AUDIT_TODO = undefined;
