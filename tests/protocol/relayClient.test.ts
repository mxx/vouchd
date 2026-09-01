import { describe, expect, it, vi } from "vitest";
import { RelayClient, type WebSocketLike } from "@/protocol/relayClient";
import type { SignedEvent } from "@/protocol/relayMessages";

const URL = "wss://relay.example";

const EVENT: SignedEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "hi",
  sig: "c".repeat(128),
};

/** A WebSocket stand-in the test drives by hand: nothing is timing-dependent. */
class FakeSocket implements WebSocketLike {
  sent: string[] = [];
  closed = false;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  /** Test helpers. */
  open(): void {
    this.onopen?.({});
  }
  emit(frame: unknown[]): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
  drop(): void {
    this.onclose?.({});
  }
  frames(): unknown[][] {
    return this.sent.map((raw) => JSON.parse(raw));
  }
}

function connectedClient(options = {}) {
  const sockets: FakeSocket[] = [];
  const client = new RelayClient(URL, {
    webSocketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    maxBackoffMs: 10,
    ...options,
  });
  const connected = client.connect();
  sockets[0].open();
  return { client, sockets, connected };
}

describe("connection lifecycle", () => {
  it("resolves connect() when the socket opens and reports status", async () => {
    const { client, connected } = connectedClient();
    await connected;
    expect(client.status()).toBe("open");
  });

  it("close() stops reconnection", async () => {
    vi.useFakeTimers();
    const { client, sockets, connected } = connectedClient();
    await connected;
    client.close();
    sockets[0].drop();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(1);
    expect(client.status()).toBe("closed");
    vi.useRealTimers();
  });
});

describe("subscription routing", () => {
  it("sends a REQ frame carrying the caller's filters", async () => {
    const { client, sockets, connected } = connectedClient();
    await connected;
    client.subscribe([{ kinds: [1] }], { onEvent: () => undefined });
    expect(sockets[0].frames()[0]).toEqual(["REQ", "sub0", { kinds: [1] }]);
  });

  it("delivers matching events to the subscription that asked", async () => {
    const { client, sockets, connected } = connectedClient();
    await connected;
    const received: SignedEvent[] = [];
    client.subscribe([{ kinds: [1] }], { onEvent: (event) => received.push(event) });
    sockets[0].emit(["EVENT", "sub0", EVENT]);
    expect(received).toEqual([EVENT]);
  });

  it("signals end-of-stored-events", async () => {
    const { client, sockets, connected } = connectedClient();
    await connected;
    let eosed = false;
    client.subscribe([{ kinds: [1] }], {
      onEvent: () => undefined,
      onEose: () => {
        eosed = true;
      },
    });
    sockets[0].emit(["EOSE", "sub0"]);
    expect(eosed).toBe(true);
  });

  it("reports a relay-side CLOSED with its reason", async () => {
    const { client, sockets, connected } = connectedClient();
    await connected;
    let closedWith = "";
    client.subscribe([{ kinds: [1] }], {
      onEvent: () => undefined,
      onClosed: (message) => {
        closedWith = message;
      },
    });
    sockets[0].emit(["CLOSED", "sub0", "auth-required"]);
    expect(closedWith).toBe("auth-required");
  });

  it("re-sends every live subscription after a reconnect", async () => {
    vi.useFakeTimers();
    const { client, sockets, connected } = connectedClient();
    await connected;
    client.subscribe([{ kinds: [20001] }], { onEvent: () => undefined });

    sockets[0].drop();
    vi.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(2);
    sockets[1].open();

    expect(sockets[1].frames()[0]).toEqual(["REQ", "sub0", { kinds: [20001] }]);
    vi.useRealTimers();
  });

  it("stops delivering after the caller closes the subscription", async () => {
    const { client, sockets, connected } = connectedClient();
    await connected;
    const received: SignedEvent[] = [];
    const subscription = client.subscribe([{ kinds: [1] }], {
      onEvent: (event) => received.push(event),
    });
    subscription.close();
    sockets[0].emit(["EVENT", "sub0", EVENT]);
    expect(received).toEqual([]);
    expect(sockets[0].frames()[1]).toEqual(["CLOSE", "sub0"]);
  });
});

describe("retrying a subscription the relay closed for lacking AUTH", () => {
  /** A caller can legitimately subscribe before this client's own AUTH
   * exchange finishes -- see relayClient.ts's header comment on why that
   * is a real race, not a hypothetical one. */
  function authenticate(sockets: FakeSocket[], signAuthEvent: ReturnType<typeof vi.fn>) {
    sockets[0].emit(["AUTH", "challenge-123"]);
    return vi
      .waitFor(() => expect(signAuthEvent).toHaveBeenCalled())
      .then(() => sockets[0].emit(["OK", "auth-id", true, "authenticated"]));
  }

  it("resends it once AUTH succeeds, instead of leaving it dropped", async () => {
    const signAuthEvent = vi.fn(async (template) => ({ ...EVENT, ...template, id: "auth-id" }));
    const { client, sockets, connected } = connectedClient({ signAuthEvent });
    await connected;

    client.subscribe([{ kinds: [1] }], { onEvent: () => undefined });
    sockets[0].emit(["CLOSED", "sub0", "auth-required: authenticate before subscribing"]);

    await authenticate(sockets, signAuthEvent);
    await vi.waitFor(() => expect(client.status()).toBe("authenticated"));

    expect(sockets[0].frames().filter((frame) => frame[0] === "REQ")).toEqual([
      ["REQ", "sub0", { kinds: [1] }],
      ["REQ", "sub0", { kinds: [1] }],
    ]);
  });

  it("does not resend a subscription closed for a different reason", async () => {
    const signAuthEvent = vi.fn(async (template) => ({ ...EVENT, ...template, id: "auth-id" }));
    const { client, sockets, connected } = connectedClient({ signAuthEvent });
    await connected;

    client.subscribe([{ kinds: [1] }], { onEvent: () => undefined });
    sockets[0].emit(["CLOSED", "sub0", "restricted: insufficient scope"]);

    await authenticate(sockets, signAuthEvent);
    await vi.waitFor(() => expect(client.status()).toBe("authenticated"));

    expect(sockets[0].frames().filter((frame) => frame[0] === "REQ")).toHaveLength(1);
  });

  it("does not resend a subscription the caller already gave up on", async () => {
    const signAuthEvent = vi.fn(async (template) => ({ ...EVENT, ...template, id: "auth-id" }));
    const { client, sockets, connected } = connectedClient({ signAuthEvent });
    await connected;

    const subscription = client.subscribe([{ kinds: [1] }], { onEvent: () => undefined });
    sockets[0].emit(["CLOSED", "sub0", "auth-required"]);
    subscription.close();

    await authenticate(sockets, signAuthEvent);
    await vi.waitFor(() => expect(client.status()).toBe("authenticated"));

    expect(sockets[0].frames().filter((frame) => frame[0] === "REQ")).toHaveLength(1);
  });
});

describe("publishing", () => {
  it("resolves on OK true and rejects on OK false", async () => {
    const { client, sockets, connected } = connectedClient();
    await connected;

    const accepted = client.publish(EVENT);
    sockets[0].emit(["OK", EVENT.id, true, "stored"]);
    await expect(accepted).resolves.toBeUndefined();

    const refused = client.publish(EVENT);
    sockets[0].emit(["OK", EVENT.id, false, "blocked: not a member"]);
    await expect(refused).rejects.toThrow(/blocked: not a member/);
  });

  it("rejects immediately when offline instead of queueing a stale event", async () => {
    const client = new RelayClient(URL, { webSocketFactory: () => new FakeSocket() });
    await expect(client.publish(EVENT)).rejects.toThrow(/not queued/);
  });

  it("rejects in-flight publishes when the connection drops", async () => {
    vi.useFakeTimers();
    const { client, sockets, connected } = connectedClient();
    await connected;
    const inFlight = client.publish(EVENT);
    sockets[0].drop();
    await expect(inFlight).rejects.toThrow(/connection closed/);
    vi.useRealTimers();
  });
});

describe("NIP-42 authentication", () => {
  it("signs the relay's challenge and sends it back with relay + challenge tags", async () => {
    const signAuthEvent = vi.fn(async (template) => ({ ...EVENT, ...template, id: "auth-id" }));
    const { client, sockets, connected } = connectedClient({ signAuthEvent });
    await connected;

    sockets[0].emit(["AUTH", "challenge-123"]);
    await vi.waitFor(() => expect(signAuthEvent).toHaveBeenCalled());

    const template = signAuthEvent.mock.calls[0][0];
    expect(template.kind).toBe(22242);
    expect(template.tags).toEqual([
      ["relay", URL],
      ["challenge", "challenge-123"],
    ]);

    // Sending the AUTH frame is not the same as being authenticated — the
    // relay still has to confirm it, tied to the AUTH event's own id.
    expect(client.status()).toBe("open");
    sockets[0].emit(["OK", "auth-id", true, "authenticated"]);
    await vi.waitFor(() => expect(client.status()).toBe("authenticated"));
  });

  it("stays open and reports why when the relay rejects the AUTH event", async () => {
    const signAuthEvent = vi.fn(async (template) => ({ ...EVENT, ...template, id: "auth-id" }));
    const notices: string[] = [];
    const { client, sockets, connected } = connectedClient({
      signAuthEvent,
      onNotice: (message: string) => notices.push(message),
    });
    await connected;

    sockets[0].emit(["AUTH", "challenge-123"]);
    await vi.waitFor(() => expect(signAuthEvent).toHaveBeenCalled());
    sockets[0].emit(["OK", "auth-id", false, "blocked: unknown pubkey"]);

    await vi.waitFor(() => expect(notices).toContainEqual(expect.stringMatching(/blocked: unknown pubkey/)));
    expect(client.status()).toBe("open");
  });

  it("carries a NIP-OA auth tag on the AUTH event when configured", async () => {
    const authTag = ["auth", "d".repeat(64), "kind=1", "e".repeat(128)] as never;
    const signAuthEvent = vi.fn(async (template) => ({ ...EVENT, ...template }));
    const { sockets, connected } = connectedClient({ signAuthEvent, authTag });
    await connected;

    sockets[0].emit(["AUTH", "challenge-123"]);
    await vi.waitFor(() => expect(signAuthEvent).toHaveBeenCalled());
    expect(signAuthEvent.mock.calls[0][0].tags[2]).toEqual([...authTag]);
  });

  it("stays unauthenticated but usable when no signer is configured", async () => {
    const notices: string[] = [];
    const { client, sockets, connected } = connectedClient({
      onNotice: (message: string) => notices.push(message),
    });
    await connected;
    sockets[0].emit(["AUTH", "challenge-123"]);
    expect(client.status()).toBe("open");
    expect(notices[0]).toMatch(/no signer/);
  });
});

describe("resilience", () => {
  it("reports an unparseable frame as a notice and keeps the connection", async () => {
    const notices: string[] = [];
    const { client, sockets, connected } = connectedClient({
      onNotice: (message: string) => notices.push(message),
    });
    await connected;
    sockets[0].onmessage?.({ data: "definitely not json" });
    expect(notices[0]).toMatch(/unparseable frame/);
    expect(client.status()).toBe("open");
  });
});

describe("stopping reconnect after a confirmed AUTH rejection", () => {
  /** Drives one AUTH challenge through to a confirmed rejection. */
  async function rejectAuth(
    sockets: FakeSocket[],
    connected: Promise<void>,
    signAuthEvent: ReturnType<typeof vi.fn>,
  ): Promise<void> {
    await connected;
    sockets[0].emit(["AUTH", "challenge-123"]);
    await vi.waitFor(() => expect(signAuthEvent).toHaveBeenCalled());
    sockets[0].emit(["OK", "auth-id", false, "blocked: not a member"]);
  }

  it("does not schedule a reconnect once the relay has confirmed the rejection", async () => {
    vi.useFakeTimers();
    const signAuthEvent = vi.fn(async (template) => ({ ...EVENT, ...template, id: "auth-id" }));
    const { client, sockets, connected } = connectedClient({ signAuthEvent });
    await connected;
    sockets[0].emit(["AUTH", "challenge-123"]);
    await vi.waitFor(() => expect(signAuthEvent).toHaveBeenCalled());
    sockets[0].emit(["OK", "auth-id", false, "blocked: not a member"]);

    sockets[0].drop();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    expect(client.status()).toBe("closed");
    vi.useRealTimers();
  });

  it("still reconnects on a plain drop that never involved AUTH", async () => {
    vi.useFakeTimers();
    const { client, sockets, connected } = connectedClient();
    await connected;

    sockets[0].drop();
    vi.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(2);
    expect(client.status()).toBe("connecting");
    vi.useRealTimers();
  });

  it("stops reconnecting when the local signer declines to sign, not just on a relay OK false", async () => {
    vi.useFakeTimers();
    const signAuthEvent = vi.fn(async () => {
      throw new Error("window.nostr call cancelled");
    });
    const { client, sockets, connected } = connectedClient({ signAuthEvent });
    await connected;
    sockets[0].emit(["AUTH", "challenge-123"]);
    await vi.waitFor(() => expect(signAuthEvent).toHaveBeenCalled());

    sockets[0].drop();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    expect(client.status()).toBe("closed");
    vi.useRealTimers();
  });

  it("gives a fresh attempt its own chance once the caller connects again", async () => {
    vi.useFakeTimers();
    const signAuthEvent = vi.fn(async (template) => ({ ...EVENT, ...template, id: "auth-id" }));
    const { client, sockets, connected } = connectedClient({ signAuthEvent });
    await rejectAuth(sockets, connected, signAuthEvent);
    sockets[0].drop();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);

    // The user clicks "Connect" again -- a deliberate new attempt, not the
    // auto-reconnect loop -- and this round never touches AUTH at all.
    const retried = client.connect();
    sockets[1].open();
    await retried;
    sockets[1].drop();
    vi.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(3);
    vi.useRealTimers();
  });
});
