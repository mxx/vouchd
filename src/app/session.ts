/**
 * Wires the three layers together for one community: relay in, projection
 * out, listeners notified.
 *
 * Deliberately not a React thing. The rule everywhere else in this codebase
 * — logic that can be tested without a DOM should live where a DOM isn't
 * needed — applies hardest to the piece that owns a socket and a database.
 * `useSession` is a thin adapter on top of this, not the other way round.
 *
 * Subscription scope, stated because it is the first thing that will need
 * revisiting at scale: we ask for the kinds this app projects, with a bounded
 * `limit`. Subscribing to every kind:0 on a busy relay is wasteful, and the
 * right fix is to narrow profiles to pubkeys already seen as members. That
 * refinement is deferred, not overlooked.
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
import type { EventTemplate } from "../protocol/events/types";
import { type ConnectionStatus, RelayClient } from "../protocol/relayClient";
import type { SignEvent } from "../signer/nip07Signer";
import { applyMutations, type ReadModelDb } from "../readmodel/db";
import { projectEvent } from "../readmodel/projector";

const PROJECTED_KINDS = [
  KIND_PROFILE,
  KIND_CREATE_CHANNEL,
  KIND_ADD_MEMBER,
  KIND_REMOVE_MEMBER,
  KIND_JOIN_CHANNEL,
  KIND_LEAVE_CHANNEL,
  KIND_PRESENCE_UPDATE,
  KIND_AUDIT_LOG,
];

const BACKFILL_LIMIT = 500;

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
}

export class VouchdSession {
  private readonly relay: RelayClient;
  private readonly listeners = new Set<() => void>();
  private subscription: { close(): void } | null = null;

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
    this.subscription = this.relay.subscribe([{ kinds: PROJECTED_KINDS, limit: BACKFILL_LIMIT }], {
      onEvent: (event) => void this.ingest(event),
    });
  }

  stop(): void {
    this.subscription?.close();
    this.subscription = null;
    this.relay.close();
  }

  /**
   * Signs a template with this app's own identity and publishes it. Rejects
   * rather than queueing when offline — see relayClient's note on why a
   * signed event should not be held and flushed later.
   */
  async publish(template: EventTemplate): Promise<void> {
    if (!this.deps.signEvent) {
      throw new SessionError("read-only session: no NIP-07 extension is connected");
    }
    await this.relay.publish(await this.deps.signEvent(template));
  }

  /** Fires after any event changes the projection, so views can re-read. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async ingest(event: Parameters<typeof projectEvent>[0]): Promise<void> {
    const mutations = projectEvent(event);
    if (mutations.length === 0) return;
    await applyMutations(this.deps.db, mutations);
    for (const listener of this.listeners) listener();
  }
}
