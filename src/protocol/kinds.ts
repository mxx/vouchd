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

/**
 * Buzz's generic NIP-29 "edit group metadata" event. This app only ever
 * writes the `archived` field through it so far (see buildSetChannelArchived
 * in protocol/events/channel.ts) -- the kind itself is more general in Buzz,
 * but nothing here needs the rest of it yet. Confirmed via buzz-sdk
 * builders.rs (build_archive/build_unarchive) and buzz-core's kind.rs
 * (KIND_NIP29_EDIT_METADATA).
 */
export const KIND_EDIT_CHANNEL_METADATA = 9002;

/**
 * Buzz "delete channel". The relay soft-deletes (state.db.soft_delete_channel)
 * rather than hard-removing rows, but from this app's side there is no
 * "undelete" for it the way kind 9002 has archive/unarchive -- treat it as
 * permanent. Confirmed via buzz-sdk builders.rs (build_delete_channel) and
 * buzz-relay's handlers/side_effects.rs (handle_delete_group).
 */
export const KIND_DELETE_CHANNEL = 9008;

/** Per-pubkey channel_add_policy declaration. Confirmed via buzz-relay handlers/side_effects.rs. */
export const KIND_CHANNEL_ADD_POLICY = 10100;

/** Ephemeral presence update (online/away/offline). Confirmed: buzz-core kind.rs = 20001. */
export const KIND_PRESENCE_UPDATE = 20001;

/** NIP-42 AUTH. Standard Nostr kind, used for relay authentication handshake. */
export const KIND_AUTH = 22242;

/**
 * vouchd's own audit trail: publishing NIP-OA authorization actions ("owner
 * X authorized/renewed agent Y at T with conditions C") as an ordinary relay
 * event instead of a local database -- see docs/ARCHITECTURE.md and
 * features/audit/README.md for why. This is NOT a Buzz kind: buzz-core's
 * kind.rs has no entry for it, because it's a vouchd-only concept layered on
 * top of Buzz's protocol, not part of Buzz itself.
 *
 * 7373 was chosen deliberately, not invented on the spot: checked against
 * the nostr-protocol/nips kind registry (github.com/nostr-protocol/nips) on
 * 2026-08-31 -- unclaimed by any NIP, sitting in the wide-open 5000-8999 gap
 * where new official kinds are unlikely to land, and well clear of both the
 * official NIP-29 9000-9030 block and this app's own 9000/9001/9007/9021/
 * 9022/10100/20001/22242. It is a *regular* kind (not replaceable, ephemeral,
 * or addressable) on purpose: an audit trail's entire point is a permanent,
 * appendable history, and any other event class would let the relay quietly
 * discard everything but the latest entry.
 */
export const KIND_AUDIT_LOG = 7373;
