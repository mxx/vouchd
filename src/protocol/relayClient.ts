/**
 * A WebSocket client for one relay: connect, authenticate (NIP-42),
 * subscribe, publish.
 *
 * One client per relay by design. A community *is* a relay URL in Buzz's
 * model (the host selects the community), so multiplexing several relays
 * behind one object would blur exactly the boundary this app cares most
 * about keeping sharp.
 *
 * Signing is injected, never imported. `protocol/` must stay ignorant of
 * where keys live — see AGENTS.md and docs/ARCHITECTURE.md's "Two signing
 * operations, one chosen identity". A relay client that could reach into
 * the keystore would be one refactor away from signing something the user
 * never approved, or never chose this connection to sign with.
 *
 * Two deliberate non-behaviors, both of which look like missing features
 * until you need the guarantee:
 *
 * - **Publishes are not queued across disconnects.** Publishing while the
 *   socket is down rejects immediately instead of buffering. A signed event
 *   carries its own `created_at`; holding one for a minute and flushing it
 *   on reconnect publishes something the user may no longer mean, timestamped
 *   when they no longer meant it. Callers that want retry can retry — with a
 *   freshly signed event.
 * - **Subscriptions ARE re-established across reconnects**, because a
 *   subscription is a standing question, not a one-time act, and silently
 *   losing one produces a UI that looks live and is actually frozen. The
 *   same guarantee covers a subscription the relay bounced only for lacking
 *   AUTH (`CLOSED ... "auth-required: ..."`) -- a real, observed race, not
 *   a hypothetical one: a caller can send REQ the instant the socket opens,
 *   before this client's own AUTH exchange (kicked off by the relay's own
 *   AUTH challenge) has finished, on a relay that requires it for every
 *   REQ. That subscription is retried once AUTH succeeds, not abandoned --
 *   see `resendAuthRequiredSubscriptions()`.
 */

import { buildAuthEvent } from "./events/auth";
import type { EventTemplate } from "./events/types";
import type { AuthTag } from "./nipOA";
import {
  encodeAuth,
  encodeClose,
  encodeEvent,
  encodeReq,
  type Filter,
  parseRelayMessage,
  type RelayMessage,
  type SignedEvent,
} from "./relayMessages";

export type ConnectionStatus = "closed" | "connecting" | "open" | "authenticated";

/** The slice of the browser WebSocket API this client uses, so tests can fake it. */
export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface SubscriptionHandlers {
  onEvent: (event: SignedEvent) => void;
  /** End of stored events: everything after this is live. */
  onEose?: () => void;
  /** The relay dropped this subscription (often: authentication required). */
  onClosed?: (message: string) => void;
}

export interface RelayClientOptions {
  /** Signs the NIP-42 AUTH event. Without it, the client stays unauthenticated. */
  signAuthEvent?: (template: EventTemplate) => Promise<SignedEvent>;
  /** NIP-OA attestation to carry on the AUTH event (agent-on-owner's-behalf). */
  authTag?: AuthTag;
  onNotice?: (message: string) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  webSocketFactory?: (url: string) => WebSocketLike;
  /** Reconnect backoff ceiling. Tests pass a small value; humans never set it. */
  maxBackoffMs?: number;
}

export class RelayClientError extends Error {}

interface PendingPublish {
  resolve: () => void;
  reject: (error: Error) => void;
}

interface ActiveSubscription {
  filters: Filter[];
  handlers: SubscriptionHandlers;
}

const DEFAULT_MAX_BACKOFF_MS = 30_000;

export class RelayClient {
  private socket: WebSocketLike | null = null;
  private currentStatus: ConnectionStatus = "closed";
  private readonly subscriptions = new Map<string, ActiveSubscription>();
  /**
   * Subscription ids the relay closed for lacking AUTH, kept separately
   * from `subscriptions` (which they remain *in*) so `resubscribeAll()` --
   * used on a full reconnect, when everything needs resending regardless of
   * why the last socket died -- doesn't have to special-case them, while
   * `resendAuthRequiredSubscriptions()` can retry exactly this set instead
   * of resending every live subscription (most of which were never
   * rejected) on every AUTH success.
   */
  private readonly authRequiredRetries = new Set<string>();
  private readonly pendingPublishes = new Map<string, PendingPublish>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByCaller = false;
  /**
   * Set whenever an AUTH attempt is confirmed not to be going anywhere --
   * either the relay's OK rejects it, or producing/sending it fails locally
   * (the signer throws, e.g. the user dismissed the extension's prompt, or
   * the extension has locked itself out after a prior dismissal). Cleared
   * by the next explicit connect(). Either way, retrying immediately can't
   * produce a different outcome -- the same doomed credentials, or the same
   * declined prompt -- so it stops the auto-reconnect loop instead of
   * hammering the relay (and re-triggering the extension's own popup) on
   * every backoff tick. (If a socket stays open after this -- reading is
   * often still allowed unauthenticated -- and only closes much later for
   * an unrelated reason, this flag can still be stale true; accepted as a
   * rare corner case rather than tracked precisely.)
   */
  private authRejected = false;
  private nextSubscriptionId = 0;
  private pendingAuthEventId: string | null = null;

  constructor(
    readonly url: string,
    private readonly options: RelayClientOptions = {},
  ) {}

  status(): ConnectionStatus {
    return this.currentStatus;
  }

  /** Opens the socket. Resolves when the relay accepts the connection. */
  connect(): Promise<void> {
    this.closedByCaller = false;
    this.authRejected = false;
    if (this.currentStatus === "open" || this.currentStatus === "authenticated") {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this.setStatus("connecting");
      const socket = this.createSocket();
      this.socket = socket;
      socket.onopen = () => {
        this.reconnectAttempt = 0;
        this.setStatus("open");
        this.resubscribeAll();
        resolve();
      };
      socket.onmessage = (event) => this.receive(String(event.data));
      socket.onclose = () => this.handleClose();
      socket.onerror = () => reject(new RelayClientError(`websocket error: ${this.url}`));
    });
  }

  /** Closes for good: no reconnect, all subscriptions dropped. */
  close(): void {
    this.closedByCaller = true;
    this.clearReconnectTimer();
    this.subscriptions.clear();
    this.authRequiredRetries.clear();
    this.pendingAuthEventId = null;
    this.failPending(new RelayClientError("relay client closed"));
    this.socket?.close();
    this.socket = null;
    this.setStatus("closed");
  }

  subscribe(filters: Filter[], handlers: SubscriptionHandlers): { close(): void } {
    const id = `sub${this.nextSubscriptionId++}`;
    this.subscriptions.set(id, { filters, handlers });
    this.trySend(encodeReq(id, filters));
    return {
      close: () => {
        this.subscriptions.delete(id);
        this.authRequiredRetries.delete(id);
        this.trySend(encodeClose(id));
      },
    };
  }

  /** Resolves when the relay says OK; rejects if it refuses or we're offline. */
  publish(event: SignedEvent): Promise<void> {
    if (!this.isConnected()) {
      return Promise.reject(new RelayClientError("not connected (publishes are not queued)"));
    }
    return new Promise((resolve, reject) => {
      this.pendingPublishes.set(event.id, { resolve, reject });
      this.trySend(encodeEvent(event));
    });
  }

  private createSocket(): WebSocketLike {
    const factory =
      this.options.webSocketFactory ??
      ((url: string) => new WebSocket(url) as unknown as WebSocketLike);
    return factory(this.url);
  }

  private isConnected(): boolean {
    return this.currentStatus === "open" || this.currentStatus === "authenticated";
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    this.options.onStatusChange?.(status);
  }

  private trySend(payload: string): void {
    if (!this.socket || !this.isConnected()) return;
    this.socket.send(payload);
  }

  private receive(raw: string): void {
    let message: RelayMessage;
    try {
      message = parseRelayMessage(raw);
    } catch (error) {
      // A frame we can't parse is the relay's bug or a protocol drift, not a
      // reason to tear down a working connection — surface it and continue.
      this.options.onNotice?.(`unparseable frame: ${(error as Error).message}`);
      return;
    }
    this.dispatch(message);
  }

  private dispatch(message: RelayMessage): void {
    switch (message.type) {
      case "EVENT":
        this.subscriptions.get(message.subscriptionId)?.handlers.onEvent(message.event);
        return;
      case "EOSE":
        this.subscriptions.get(message.subscriptionId)?.handlers.onEose?.();
        return;
      case "CLOSED":
        this.handleSubscriptionClosed(message.subscriptionId, message.message);
        return;
      case "OK":
        this.settleAuthOrPublish(message.eventId, message.accepted, message.message);
        return;
      case "NOTICE":
        this.options.onNotice?.(message.message);
        return;
      case "AUTH":
        void this.answerChallenge(message.challenge);
        return;
    }
  }

  private settlePublish(eventId: string, accepted: boolean, message: string): void {
    const pending = this.pendingPublishes.get(eventId);
    if (!pending) return;
    this.pendingPublishes.delete(eventId);
    if (accepted) pending.resolve();
    else pending.reject(new RelayClientError(`relay rejected event: ${message}`));
  }

  /**
   * NIP-42: sending an AUTH frame is not the same as being authenticated —
   * the relay confirms (or refuses) it with an OK tied to the AUTH event's
   * id, exactly like any other event. Flipping to "authenticated" the
   * moment we send it would tell the rest of the app something the relay
   * never actually agreed to.
   */
  private settleAuthOrPublish(eventId: string, accepted: boolean, message: string): void {
    if (eventId !== this.pendingAuthEventId) {
      this.settlePublish(eventId, accepted, message);
      return;
    }
    this.pendingAuthEventId = null;
    if (accepted) {
      this.authRejected = false;
      this.setStatus("authenticated");
      this.resendAuthRequiredSubscriptions();
    } else {
      this.authRejected = true;
      this.options.onNotice?.(`AUTH rejected: ${message}`);
    }
  }

  /**
   * A CLOSED for lacking AUTH is kept, not abandoned -- see this class's
   * own header comment and `authRequiredRetries`'s. Any other reason
   * (`restricted: ...`, an explicit server-side unsubscribe, ...) means
   * resending the identical REQ would not produce a different outcome, so
   * that case is dropped exactly as before.
   */
  private handleSubscriptionClosed(subscriptionId: string, reason: string): void {
    this.subscriptions.get(subscriptionId)?.handlers.onClosed?.(reason);
    if (reason.split(":")[0].trim() === "auth-required") {
      this.authRequiredRetries.add(subscriptionId);
    } else {
      this.subscriptions.delete(subscriptionId);
    }
  }

  /** Retries exactly the subscriptions AUTH unblocks, not every live one. */
  private resendAuthRequiredSubscriptions(): void {
    for (const id of this.authRequiredRetries) {
      const subscription = this.subscriptions.get(id);
      if (subscription) this.trySend(encodeReq(id, subscription.filters));
    }
    this.authRequiredRetries.clear();
  }

  /**
   * NIP-42: the relay may challenge at any time, including again after a
   * reconnect. Without a signer we stay unauthenticated rather than failing
   * — read-only access to an open community is a legitimate mode.
   */
  private async answerChallenge(challenge: string): Promise<void> {
    const sign = this.options.signAuthEvent;
    if (!sign) {
      this.options.onNotice?.("relay requested AUTH but no signer is configured");
      return;
    }
    try {
      const template = buildAuthEvent(this.url, challenge, this.options.authTag);
      const signed = await sign(template);
      this.pendingAuthEventId = signed.id;
      this.trySend(encodeAuth(signed));
    } catch (error) {
      this.authRejected = true;
      this.options.onNotice?.(`AUTH failed: ${(error as Error).message}`);
    }
  }

  private resubscribeAll(): void {
    for (const [id, subscription] of this.subscriptions) {
      this.trySend(encodeReq(id, subscription.filters));
    }
  }

  /**
   * `closedByCaller` distinguishes "we hung up" from "the relay did" (only
   * the latter reconnects); `authRejected` distinguishes "network hiccup"
   * from "AUTH is confirmed not to be working right now, whether the relay
   * said so or our own signer did" (only the former retries -- see the
   * field's own comment for why).
   */
  private handleClose(): void {
    this.socket = null;
    this.pendingAuthEventId = null;
    this.failPending(new RelayClientError("connection closed before the relay replied"));
    this.setStatus("closed");
    if (!this.closedByCaller && !this.authRejected) this.scheduleReconnect();
  }

  private failPending(error: Error): void {
    for (const pending of this.pendingPublishes.values()) pending.reject(error);
    this.pendingPublishes.clear();
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const ceiling = this.options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, ceiling);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      // A reconnect that fails schedules the next one through onclose; the
      // rejection here has no caller waiting on it, so it must be swallowed
      // or it surfaces as an unhandled rejection in the console.
      void this.connect().catch(() => undefined);
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}

export function createRelayClient(url: string, options?: RelayClientOptions): RelayClient {
  return new RelayClient(url, options);
}
