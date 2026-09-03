/**
 * Wires the three layers together for one community: relay in, projection
 * out, listeners notified.
 *
 * Deliberately not a React thing. The rule everywhere else in this codebase
 * — logic that can be tested without a DOM should live where a DOM isn't
 * needed — applies hardest to the piece that owns a socket and a database.
 * `useSession` is a thin adapter on top of this, not the other way round.
 *
 * Subscription scope is two phases, not one, because kind:0 (profile) is
 * fundamentally different from the rest of what this app projects: it's an
 * ecosystem-wide, unscoped-by-nature kind, so any shared backfill limit it
 * competes for is mostly spent on identities with nothing to do with this
 * community. The structural kinds (channels, membership, audit log) go out
 * first, bounded by `STRUCTURAL_BACKFILL_LIMIT`; once that subscription's
 * EOSE reports which pubkeys actually showed up, a second subscription asks
 * for exactly those authors' profiles (a one-shot backfill, since kind:0 is
 * NIP-01-replaceable — at most one per author) plus a permanent unscoped
 * `limit: 0` filter so a profile published later by *any* pubkey, including
 * one never seen in the structural phase, is still caught live. See
 * `onHistoryTruncated` for the other half of this: narrowing scope helps
 * profile specifically, but membership/audit history has no noise to narrow
 * away, so a large enough community can still exceed the structural limit.
 * True `until`-cursor pagination would remove that ceiling; deferred, not
 * overlooked — see TODO.md.
 */

import {
  KIND_ADD_MEMBER,
  KIND_AUDIT_LOG,
  KIND_CREATE_CHANNEL,
  KIND_DELETE_CHANNEL,
  KIND_EDIT_CHANNEL_METADATA,
  KIND_JOIN_CHANNEL,
  KIND_LEAVE_CHANNEL,
  KIND_PRESENCE_UPDATE,
  KIND_PROFILE,
  KIND_REMOVE_MEMBER,
} from "../protocol/kinds";
import type { EventTemplate } from "../protocol/events/types";
import { type ConnectionStatus, RelayClient } from "../protocol/relayClient";
import type { Filter } from "../protocol/relayMessages";
import type { SignEvent } from "../signer/nip07Signer";
import { applyMutations, type ReadModelDb } from "../readmodel/db";
import { type Mutation, projectEvent } from "../readmodel/projector";

/**
 * Everything this app projects except profile — see the module docblock.
 * Missing a kind here isn't just "that data doesn't backfill": it means an
 * event of that kind we *publish ourselves* never comes back on this same
 * subscription either, so projectEvent() never runs for it and the local
 * view silently stops matching the relay (e.g. a deleted channel that
 * still shows in the list). KIND_EDIT_CHANNEL_METADATA/KIND_DELETE_CHANNEL
 * were added here together with their projector cases, not before —
 * archive/delete looked "wired up" without this and weren't.
 */
const STRUCTURAL_KINDS = [
  KIND_CREATE_CHANNEL,
  KIND_EDIT_CHANNEL_METADATA,
  KIND_DELETE_CHANNEL,
  KIND_ADD_MEMBER,
  KIND_REMOVE_MEMBER,
  KIND_JOIN_CHANNEL,
  KIND_LEAVE_CHANNEL,
  KIND_AUDIT_LOG,
];

/**
 * Kept at the same order of magnitude as this project's original single
 * limit, deliberately: a page-based table is a thing a human scans, and
 * human review of a flat list doesn't get more useful past a few hundred
 * rows regardless of how large the community is. A future agent/API-driven
 * management interface isn't bound by that and can page through everything;
 * this page can't, so it isn't the place to chase community-completeness by
 * inflating this number.
 */
export const STRUCTURAL_BACKFILL_LIMIT = 500;

export class SessionError extends Error {}

export interface SessionDeps {
  db: ReadModelDb;
  /**
   * Signs events this app publishes as its own identity (NIP-07). Absent it,
   * the session is read-only — a legitimate mode, and the right default for
   * anyone who just wants to look at a community.
   */
  signEvent?: SignEvent;
  signAuthEvent?: SignEvent;
  onStatusChange?: (status: ConnectionStatus) => void;
  onNotice?: (message: string) => void;
  /**
   * Fires once, after the structural backfill's EOSE, if the number of
   * structural events received hit `STRUCTURAL_BACKFILL_LIMIT` exactly —
   * the signal that a relay's true history for this community is likely
   * larger than what fit in this page's window. Not called `onNotice`:
   * that channel means "the relay said X"; this is a client-side inference
   * from an event count, and conflating the two would misattribute it.
   */
  onHistoryTruncated?: () => void;
}

/**
 * Pulls the pubkeys a batch of already-validated mutations names, so the
 * profile phase can be scoped to identities this community actually has.
 * Reads mutations, never raw event tags — a mutation only exists because
 * `projectEvent` already checked signature and shape.
 */
function pubkeysIn(mutations: Mutation[]): string[] {
  const pubkeys: string[] = [];
  for (const mutation of mutations) {
    if (mutation.store === "members") {
      pubkeys.push(mutation.op === "put" ? mutation.value.pubkey : mutation.pubkey);
    } else if (mutation.store === "auditLog" && mutation.op === "put") {
      pubkeys.push(mutation.value.agentPubkey, mutation.value.ownerPubkey);
    }
  }
  return pubkeys;
}

export class VouchdSession {
  private readonly relay: RelayClient;
  private readonly listeners = new Set<() => void>();
  private structuralSubscription: { close(): void } | null = null;
  private profileSubscription: { close(): void } | null = null;

  constructor(
    readonly relayUrl: string,
    private readonly deps: SessionDeps,
  ) {
    this.relay = new RelayClient(relayUrl, {
      signAuthEvent: deps.signAuthEvent,
      onStatusChange: deps.onStatusChange,
      onNotice: deps.onNotice,
    });
  }

  status(): ConnectionStatus {
    return this.relay.status();
  }

  async start(): Promise<void> {
    await this.relay.connect();
    const knownPubkeys = new Set<string>();
    let structuralEventCount = 0;
    let backfillDone = false;

    this.structuralSubscription = this.relay.subscribe(
      [{ kinds: STRUCTURAL_KINDS, limit: STRUCTURAL_BACKFILL_LIMIT }, { kinds: [KIND_PRESENCE_UPDATE] }],
      {
        onEvent: (event) => {
          if (!backfillDone && STRUCTURAL_KINDS.includes(event.kind)) structuralEventCount++;
          void this.ingest(event, (mutations) => {
            for (const pubkey of pubkeysIn(mutations)) knownPubkeys.add(pubkey);
          });
        },
        onEose: () => {
          backfillDone = true;
          if (structuralEventCount >= STRUCTURAL_BACKFILL_LIMIT) this.deps.onHistoryTruncated?.();
          this.startProfileSubscription(knownPubkeys);
        },
      },
    );
  }

  /**
   * Author-scoped one-shot backfill for the pubkeys the structural phase
   * actually found, sized to exactly that count since kind:0 is
   * NIP-01-replaceable (at most one matching event per author) — plus a
   * permanent unscoped `limit: 0` filter (backfill-free, live-only) so a
   * profile from a pubkey outside that set is still caught going forward.
   */
  private startProfileSubscription(knownPubkeys: Set<string>): void {
    const filters: Filter[] = [];
    if (knownPubkeys.size > 0) {
      filters.push({ kinds: [KIND_PROFILE], authors: Array.from(knownPubkeys), limit: knownPubkeys.size });
    }
    filters.push({ kinds: [KIND_PROFILE], limit: 0 });
    this.profileSubscription = this.relay.subscribe(filters, {
      onEvent: (event) => void this.ingest(event),
    });
  }

  stop(): void {
    this.structuralSubscription?.close();
    this.structuralSubscription = null;
    this.profileSubscription?.close();
    this.profileSubscription = null;
    this.relay.close();
  }

  /**
   * Signs a template with this app's own identity and publishes it. Rejects
   * rather than queueing when offline — see relayClient's note on why a
   * signed event should not be held and flushed later.
   */
  async publish(template: EventTemplate): Promise<void> {
    if (!this.deps.signEvent) {
      throw new SessionError("read-only session: no signing extension is connected");
    }
    await this.relay.publish(await this.deps.signEvent(template));
  }

  /** Fires after any event changes the projection, so views can re-read. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async ingest(
    event: Parameters<typeof projectEvent>[0],
    onMutations?: (mutations: Mutation[]) => void,
  ): Promise<void> {
    const mutations = projectEvent(event);
    if (mutations.length === 0) return;
    onMutations?.(mutations);
    await applyMutations(this.deps.db, mutations);
    for (const listener of this.listeners) listener();
  }
}
