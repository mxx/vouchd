/**
 * What the local projection stores.
 *
 * Every field here is derived from a relay event — nothing is invented
 * locally and nothing is authoritative. If this database is deleted, a fresh
 * subscription rebuilds it. That property is the reason the shapes stay
 * close to the events they come from rather than becoming a convenient
 * private schema that quietly accumulates state the relay never saw.
 */

/** A pubkey whose kind:0 profile carries a *verified* NIP-OA attestation. */
export interface AgentRecord {
  pubkey: string;
  /** Recovered from the auth tag's signature, not taken on faith. */
  ownerPubkey: string;
  conditions: string;
  displayName?: string;
  picture?: string;
  about?: string;
  /** `created_at` of the profile event this was projected from. */
  observedAt: number;
}

/**
 * Plain NIP-01 metadata for any pubkey the relay showed us a valid kind:0
 * for -- unlike AgentRecord, no owner attestation is required, because
 * nothing here claims a relationship, only "this pubkey calls itself X".
 * Exists so a pubkey that is never an agent (an owner authorizing from its
 * own key, a channel member) can still get a display name instead of a
 * wall of hex -- see AuditPanel's "authorized by" column.
 */
export interface ProfileRecord {
  pubkey: string;
  displayName?: string;
  picture?: string;
  about?: string;
  observedAt: number;
}

export interface ChannelRecord {
  channelId: string;
  name: string;
  visibility?: string;
  channelType?: string;
  about?: string;
  observedAt: number;
  /**
   * Joined in from the separate `channelArchive` store at query time
   * (queries.ts's listChannels), not projected directly onto this record --
   * a kind:9002 archive/unarchive event carries no `name`, so it can't be
   * merged into a full ChannelRecord the way projectChannel() builds one
   * from scratch. Mirrors presence's own separate-store-joined-at-read-time
   * shape for the same reason. Absent/false both mean "not archived".
   */
  archived?: boolean;
}

/** One channel's latest archived flag (kind:9002) -- see ChannelRecord.archived. */
export interface ChannelArchiveRecord {
  channelId: string;
  archived: boolean;
  observedAt: number;
}

export interface MemberRecord {
  channelId: string;
  pubkey: string;
  role?: string;
  observedAt: number;
}

/**
 * One channel's roster as the *relay* states it (kind:39002), kept whole
 * rather than exploded into `members` rows.
 *
 * A snapshot and a stream of add/remove events are different kinds of claim
 * and merging them would lose that: `members` holds the memberships this
 * client happened to observe, which is a subset bounded by the backfill
 * window and by whichever events the relay still serves. This is the
 * complete list at a moment in time, signed by the key the relay advertises
 * as `self`. queries.ts prefers it where present -- see effectiveMembers.
 *
 * Stored as one record per channel so a later snapshot replaces the previous
 * one wholesale, which is what a snapshot means: no per-member reconciling,
 * and no way for a stale add to survive underneath a newer roster.
 */
export interface ChannelRosterRecord {
  channelId: string;
  members: MemberRecord[];
  observedAt: number;
}

/**
 * Presence is a lease, not a flag: the relay expires it if the publisher
 * stops renewing. We store what was seen and when, and let queries decide
 * whether it is still fresh — a stored "online" that nobody re-published is
 * exactly the stale dot the protocol warns about.
 */
export interface PresenceRecord {
  pubkey: string;
  status: string;
  observedAt: number;
}

/**
 * One entry in the audit trail (kind:7373): an owner authorizing or
 * renewing an agent. `ownerPubkey` here is the event's own signer, already
 * cross-checked against the embedded auth tag's recovered owner in
 * projector.ts -- an audit entry only exists in this store if that matched.
 */
export interface AuditRecord {
  id: string;
  agentPubkey: string;
  ownerPubkey: string;
  action: "register" | "renew";
  conditions: string;
  observedAt: number;
}
