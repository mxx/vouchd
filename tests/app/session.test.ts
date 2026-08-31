import { describe, expect, it, vi } from "vitest";
import { computeAuthTag } from "@/protocol/nipOA";
import type { SignedEvent } from "@/protocol/relayMessages";
import type { WebSocketLike } from "@/protocol/relayClient";
import type { ReadModelDb } from "@/readmodel/db";
import { SessionError, VouchdSession } from "@/app/session";

const OWNER_SECRET = "0000000000000000000000000000000000000000000000000000000000000001";
const OWNER_PUBKEY = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const AGENT_PUBKEY = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";

class FakeSocket implements WebSocketLike {
  sent: string[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
  open() {
    this.onopen?.({});
  }
  emit(frame: unknown[]) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

/** Records writes instead of touching IndexedDB — applyMutations only calls put/delete. */
function fakeDb() {
  const puts: { store: string; value: unknown }[] = [];
  const deletes: { store: string; key: unknown }[] = [];
  const db = {
    put: async (store: string, value: unknown) => {
      puts.push({ store, value });
    },
    delete: async (store: string, key: unknown) => {
      deletes.push({ store, key });
    },
  } as unknown as ReadModelDb;
  return { db, puts, deletes };
}

function attestedProfile(): SignedEvent {
  const authTag = computeAuthTag(OWNER_SECRET, AGENT_PUBKEY, "kind=1");
  return {
    id: "a".repeat(64),
    pubkey: AGENT_PUBKEY,
    created_at: 1_700_000_000,
    kind: 0,
    tags: [[...authTag]],
    content: JSON.stringify({ display_name: "Release Bot" }),
    sig: "c".repeat(128),
  };
}

async function startedSession(overrides = {}) {
  const { db, puts, deletes } = fakeDb();
  const sockets: FakeSocket[] = [];
  const session = new VouchdSession("wss://relay.example", { db, ...overrides });
  // The socket factory lives on RelayClient; reach it the same way production
  // does, by letting the session build one and driving the fake it created.
  const patched = session as unknown as { relay: { options: { webSocketFactory?: unknown } } };
  patched.relay.options.webSocketFactory = () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  };
  const started = session.start();
  await Promise.resolve();
  sockets[0].open();
  await started;
  return { session, sockets, puts, deletes };
}

describe("VouchdSession", () => {
  it("subscribes to exactly the kinds it projects", async () => {
    const { sockets } = await startedSession();
    const req = JSON.parse(sockets[0].sent[0]);
    expect(req[0]).toBe("REQ");
    expect(req[2].kinds).toEqual([0, 9007, 9000, 9001, 9021, 9022, 20001]);
  });

  it("projects an attested profile into the read model and notifies listeners", async () => {
    const { session, sockets, puts } = await startedSession();
    const changed = vi.fn();
    session.onChange(changed);

    sockets[0].emit(["EVENT", "sub0", attestedProfile()]);
    // Wait on the notification, not the write: the listener fires one
    // microtask after the put lands, so asserting on `puts` first would race.
    await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());

    expect(puts).toHaveLength(1);
    expect(puts[0].store).toBe("agents");
    expect(puts[0].value).toMatchObject({ pubkey: AGENT_PUBKEY, ownerPubkey: OWNER_PUBKEY });
  });

  it("writes nothing for events it does not model", async () => {
    const { session, sockets, puts } = await startedSession();
    const changed = vi.fn();
    session.onChange(changed);
    sockets[0].emit(["EVENT", "sub0", { ...attestedProfile(), kind: 9, tags: [] }]);
    await Promise.resolve();
    expect(puts).toHaveLength(0);
    expect(changed).not.toHaveBeenCalled();
  });

  it("refuses to publish without a signer instead of failing silently", async () => {
    const { session } = await startedSession();
    await expect(
      session.publish({ kind: 9000, tags: [], content: "", created_at: 1 }),
    ).rejects.toThrow(SessionError);
  });

  it("signs and publishes through the injected signer", async () => {
    const signed = { ...attestedProfile(), id: "b".repeat(64) };
    const signEvent = vi.fn(async () => signed);
    const { session, sockets } = await startedSession({ signEvent });

    const published = session.publish({ kind: 9000, tags: [], content: "", created_at: 1 });
    await vi.waitFor(() => expect(sockets[0].sent).toHaveLength(2));
    sockets[0].emit(["OK", signed.id, true, ""]);

    await expect(published).resolves.toBeUndefined();
    expect(signEvent).toHaveBeenCalledOnce();
    expect(JSON.parse(sockets[0].sent[1])[0]).toBe("EVENT");
  });
});
