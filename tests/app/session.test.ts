import { describe, expect, it, vi } from "vitest";
import { finalizeEvent } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { computeAuthTag } from "@/protocol/nipOA";
import type { SignedEvent } from "@/protocol/relayMessages";
import type { WebSocketLike } from "@/protocol/relayClient";
import type { ReadModelDb } from "@/readmodel/db";
import { KIND_DELETE_CHANNEL, KIND_JOIN_CHANNEL } from "@/protocol/kinds";
import { SessionError, STRUCTURAL_BACKFILL_LIMIT, VouchdSession } from "@/app/session";

const OWNER_SECRET = "0000000000000000000000000000000000000000000000000000000000000001";
const OWNER_PUBKEY = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const AGENT_SECRET = "0000000000000000000000000000000000000000000000000000000000000002";
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
  return finalizeEvent(
    {
      created_at: 1_700_000_000,
      kind: 0,
      tags: [[...authTag]],
      content: JSON.stringify({ display_name: "Release Bot" }),
    },
    hexToBytes(AGENT_SECRET),
  ) as SignedEvent;
}

/** A self-act join is the cheapest event that produces a `members` mutation. */
function joinChannelEvent(secret: string): SignedEvent {
  return finalizeEvent(
    { created_at: 1_700_000_000, kind: KIND_JOIN_CHANNEL, tags: [["h", "general"]], content: "" },
    hexToBytes(secret),
  ) as SignedEvent;
}

/**
 * Only `event.kind` needs to be real for the structural backfill's own event
 * count (see session.ts: the count is incremented before the event reaches
 * `projectEvent`), so a truncation test can use 500 of these instead of 500
 * real signatures.
 */
function unmodeledStructuralEvent(id: string): SignedEvent {
  return { id, pubkey: "0".repeat(64), created_at: 0, kind: KIND_JOIN_CHANNEL, tags: [], content: "", sig: "0".repeat(128) };
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
  it("subscribes to the structural kinds and presence first, profile only after that EOSE", async () => {
    const { sockets } = await startedSession();
    const req = JSON.parse(sockets[0].sent[0]);
    expect(req[0]).toBe("REQ");
    expect(req[2]).toEqual({
      kinds: [9007, 9002, 9008, 9000, 9001, 9021, 9022, 7373],
      limit: STRUCTURAL_BACKFILL_LIMIT,
    });
    expect(req[3]).toEqual({ kinds: [20001] });
    expect(sockets[0].sent).toHaveLength(1);

    sockets[0].emit(["EOSE", "sub0"]);
    await Promise.resolve();

    const profileReq = JSON.parse(sockets[0].sent[1]);
    expect(profileReq[0]).toBe("REQ");
    // No pubkeys were discovered (no structural events arrived), so only the
    // permanent unscoped live-only filter goes out.
    expect(profileReq.slice(2)).toEqual([{ kinds: [0], limit: 0 }]);
  });

  it("scopes the profile backfill to pubkeys discovered in the structural phase", async () => {
    const { sockets } = await startedSession();
    sockets[0].emit(["EVENT", "sub0", joinChannelEvent(AGENT_SECRET)]);
    await Promise.resolve();
    sockets[0].emit(["EOSE", "sub0"]);
    await Promise.resolve();

    const profileReq = JSON.parse(sockets[0].sent[1]);
    expect(profileReq.slice(2)).toEqual([
      { kinds: [0], authors: [AGENT_PUBKEY], limit: 1 },
      { kinds: [0], limit: 0 },
    ]);
  });

  it("flags history as possibly incomplete once the structural backfill hits its cap", async () => {
    const onHistoryTruncated = vi.fn();
    const { sockets } = await startedSession({ onHistoryTruncated });
    for (let i = 0; i < STRUCTURAL_BACKFILL_LIMIT; i++) {
      sockets[0].emit(["EVENT", "sub0", unmodeledStructuralEvent(i.toString(16).padStart(64, "0"))]);
    }
    sockets[0].emit(["EOSE", "sub0"]);
    await Promise.resolve();
    expect(onHistoryTruncated).toHaveBeenCalledOnce();
  });

  it("does not flag truncation when the structural backfill returns fewer than the cap", async () => {
    const onHistoryTruncated = vi.fn();
    const { sockets } = await startedSession({ onHistoryTruncated });
    sockets[0].emit(["EVENT", "sub0", joinChannelEvent(AGENT_SECRET)]);
    sockets[0].emit(["EOSE", "sub0"]);
    await Promise.resolve();
    expect(onHistoryTruncated).not.toHaveBeenCalled();
  });

  it("projects an attested profile into the read model and notifies listeners", async () => {
    const { session, sockets, puts } = await startedSession();
    const changed = vi.fn();
    session.onChange(changed);

    // Profile events only arrive on the second (post-EOSE) subscription.
    sockets[0].emit(["EOSE", "sub0"]);
    await Promise.resolve();
    sockets[0].emit(["EVENT", "sub1", attestedProfile()]);
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

  it("projects what it publishes, so a deletion the relay will never echo back still leaves the list", async () => {
    const signed = finalizeEvent(
      { created_at: 1_700_000_000, kind: KIND_DELETE_CHANNEL, tags: [["h", "general"]], content: "" },
      hexToBytes(AGENT_SECRET),
    ) as SignedEvent;
    const signEvent = vi.fn(async () => signed);
    const { session, sockets, deletes } = await startedSession({ signEvent });

    const published = session.publish({ kind: KIND_DELETE_CHANNEL, tags: [], content: "", created_at: 1 });
    await vi.waitFor(() => expect(sockets[0].sent).toHaveLength(2));
    sockets[0].emit(["OK", signed.id, true, ""]);
    await published;

    expect(deletes).toEqual([{ store: "channels", key: "general" }]);
  });

  it("projects nothing for a publish the relay refuses", async () => {
    const signed = finalizeEvent(
      { created_at: 1_700_000_000, kind: KIND_DELETE_CHANNEL, tags: [["h", "general"]], content: "" },
      hexToBytes(AGENT_SECRET),
    ) as SignedEvent;
    const { session, sockets, deletes } = await startedSession({ signEvent: async () => signed });

    const published = session.publish({ kind: KIND_DELETE_CHANNEL, tags: [], content: "", created_at: 1 });
    await vi.waitFor(() => expect(sockets[0].sent).toHaveLength(2));
    sockets[0].emit(["OK", signed.id, false, "restricted: not the owner"]);

    await expect(published).rejects.toThrow();
    expect(deletes).toHaveLength(0);
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
