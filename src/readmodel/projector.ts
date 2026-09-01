/**
 * Relay event -> local mutations. Pure: no database, no clock, no network.
 *
 * Keeping this pure is what makes the projection trustworthy — every rule
 * about how an event changes local state is exercised in tests with plain
 * objects, and the IndexedDB layer underneath (db.ts) is left with nothing
 * to decide.
 *
 * Unknown kinds project to nothing. A relay carries far more traffic than
 * this app models (messages, git events, workflows); silently ignoring them
 * is correct, not lossy.
 */

import {
  KIND_ADD_MEMBER,
  KIND_AUDIT_LOG,
  KIND_CREATE_CHANNEL,
  KIND_JOIN_CHANNEL,
  KIND_LEAVE_CHANNEL,
  KIND_PRESENCE_UPDATE,
  KIND_PROFILE,
  KIND_REMOVE_MEMBER,
} from "../protocol/kinds";
import { verifyAuthTag } from "../protocol/nipOA";
import type { SignedEvent } from "../protocol/relayMessages";
import type { AgentRecord, AuditRecord, ChannelRecord, MemberRecord, PresenceRecord } from "./records";
import { validateEvent, verifiedSymbol, verifyEvent } from "nostr-tools/pure";

export type Mutation =
  | { store: "agents"; op: "put"; value: AgentRecord }
  | { store: "channels"; op: "put"; value: ChannelRecord }
  | { store: "members"; op: "put"; value: MemberRecord }
  | { store: "members"; op: "delete"; channelId: string; pubkey: string }
  | { store: "presence"; op: "put"; value: PresenceRecord }
  | { store: "auditLog"; op: "put"; value: AuditRecord };

function tagValue(event: SignedEvent, name: string): string | undefined {
  return event.tags.find((tag) => tag[0] === name)?.[1];
}

/**
 * A relay is allowed to forward an event without checking its NIP-OA tag, but
 * the client must still check the event itself before treating that tag as
 * provenance. `validateEvent` checks the NIP-01 shape; `verifyEvent` checks
 * that the id is the canonical hash and the Schnorr signature belongs to the
 * declared pubkey. Keeping this gate here means every projection path gets
 * the same trust boundary, including audit entries and presence updates.
 */
function isValidNostrEvent(event: unknown): event is SignedEvent {
  if (!validateEvent(event)) return false;
  const candidate = event as SignedEvent;
  if (!Number.isSafeInteger(candidate.kind) || !Number.isSafeInteger(candidate.created_at)) {
    return false;
  }
  if (!/^[0-9a-f]{64}$/.test(candidate.id) || !/^[0-9a-f]{128}$/.test(candidate.sig)) {
    return false;
  }
  // Verify a copy so `verifyEvent` cannot trust a cached verified-symbol flag
  // left on an object that a caller mutated after it was signed.
  const copy = { ...candidate } as Parameters<typeof verifyEvent>[0];
  delete copy[verifiedSymbol];
  return verifyEvent(copy);
}

/**
 * An agent is a pubkey whose profile carries an owner's attestation — the
 * same test buzz-acp applies (`PromptProfile::is_agent`). We verify the
 * signature before recording it: NIP-OA says a client MUST NOT display owner
 * provenance for an invalid tag, and an unverified one is worth strictly
 * less than no claim at all.
 */
function projectProfile(event: SignedEvent): Mutation[] {
  const authTag = event.tags.find((tag) => tag[0] === "auth");
  if (!authTag) return [];
  let ownerPubkey: string;
  try {
    ownerPubkey = verifyAuthTag(authTag, event.pubkey);
  } catch {
    return [];
  }
  const metadata = parseProfileContent(event.content);
  return [
    {
      store: "agents",
      op: "put",
      value: {
        pubkey: event.pubkey,
        ownerPubkey,
        conditions: authTag[2],
        displayName: metadata.display_name ?? metadata.name,
        picture: metadata.picture,
        about: metadata.about,
        observedAt: event.created_at,
      },
    },
  ];
}

function parseProfileContent(content: string): Record<string, string | undefined> {
  try {
    const parsed: unknown = JSON.parse(content);
    return typeof parsed === "object" && parsed ? (parsed as Record<string, string>) : {};
  } catch {
    // A profile with unparseable content is still a valid attestation of who
    // the agent is; only its display metadata is lost.
    return {};
  }
}

function projectChannel(event: SignedEvent): Mutation[] {
  const channelId = tagValue(event, "h");
  const name = tagValue(event, "name");
  if (!channelId || !name) return [];
  return [
    {
      store: "channels",
      op: "put",
      value: {
        channelId,
        name,
        visibility: tagValue(event, "visibility"),
        channelType: tagValue(event, "channel_type"),
        about: tagValue(event, "about"),
        observedAt: event.created_at,
      },
    },
  ];
}

function projectMembership(event: SignedEvent): Mutation[] {
  const channelId = tagValue(event, "h");
  if (!channelId) return [];
  const isSelfAct = event.kind === KIND_JOIN_CHANNEL || event.kind === KIND_LEAVE_CHANNEL;
  const pubkey = isSelfAct ? event.pubkey : tagValue(event, "p");
  if (!pubkey) return [];
  const removes = event.kind === KIND_REMOVE_MEMBER || event.kind === KIND_LEAVE_CHANNEL;
  if (removes) return [{ store: "members", op: "delete", channelId, pubkey }];
  const value: MemberRecord = { channelId, pubkey, observedAt: event.created_at };
  const role = tagValue(event, "role");
  if (role) value.role = role;
  return [{ store: "members", op: "put", value }];
}

function projectPresence(event: SignedEvent): Mutation[] {
  const status = tagValue(event, "status") ?? event.content;
  if (!status) return [];
  return [
    {
      store: "presence",
      op: "put",
      value: { pubkey: event.pubkey, status, observedAt: event.created_at },
    },
  ];
}

function isAuditAction(value: string | undefined): value is "register" | "renew" {
  return value === "register" || value === "renew";
}

/**
 * An audit entry is trusted only as far as its embedded evidence checks
 * out: the `auth` tag must verify against the `p`-tagged agent, AND the
 * pubkey that signature recovers must be the pubkey that signed *this*
 * event. Without that second check, anyone could republish someone else's
 * valid auth tag inside their own audit entry and misattribute the action.
 */
function projectAuditEntry(event: SignedEvent): Mutation[] {
  const agentPubkey = tagValue(event, "p");
  const action = tagValue(event, "action");
  const authTag = event.tags.find((tag) => tag[0] === "auth");
  if (!agentPubkey || !authTag || !isAuditAction(action)) return [];
  let ownerPubkey: string;
  try {
    ownerPubkey = verifyAuthTag(authTag, agentPubkey);
  } catch {
    return [];
  }
  if (ownerPubkey !== event.pubkey) return [];
  return [
    {
      store: "auditLog",
      op: "put",
      value: {
        id: event.id,
        agentPubkey,
        ownerPubkey,
        action,
        conditions: authTag[2],
        observedAt: event.created_at,
      },
    },
  ];
}

export function projectEvent(event: SignedEvent): Mutation[] {
  if (!isValidNostrEvent(event)) return [];
  switch (event.kind) {
    case KIND_PROFILE:
      return projectProfile(event);
    case KIND_CREATE_CHANNEL:
      return projectChannel(event);
    case KIND_ADD_MEMBER:
    case KIND_REMOVE_MEMBER:
    case KIND_JOIN_CHANNEL:
    case KIND_LEAVE_CHANNEL:
      return projectMembership(event);
    case KIND_PRESENCE_UPDATE:
      return projectPresence(event);
    case KIND_AUDIT_LOG:
      return projectAuditEntry(event);
    default:
      return [];
  }
}
