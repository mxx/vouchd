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

export interface ChannelRecord {
  channelId: string;
  name: string;
  visibility?: string;
  channelType?: string;
  about?: string;
  observedAt: number;
}

export interface MemberRecord {
  channelId: string;
  pubkey: string;
  role?: string;
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
