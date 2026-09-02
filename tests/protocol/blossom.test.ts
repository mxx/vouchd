/**
 * BUD-11 auth-token construction, plus the shared-token cache in
 * `fetchAuthorizedBlob` (see blossom.ts's module docblock for why one
 * server-scoped token is reused across every picture on that host rather
 * than a fresh scoped-to-one-blob token per image) -- that caching is
 * exactly the kind of branch this house's rules want a check on, so `sign`
 * and `fetch` are mocked to assert it actually reuses, and actually stops
 * reusing across signers and across hosts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blobAuthHeader, buildBlobGetAuth, fetchAuthorizedBlob } from "@/protocol/blossom";
import type { SignedEvent } from "@/protocol/relayMessages";
import type { SignEvent } from "@/signer/nip07Signer";

describe("buildBlobGetAuth", () => {
  it("tags the verb, an expiration, and the scoped server host", () => {
    const template = buildBlobGetAuth("buzz.fudu.space", 1_700_000_000);
    expect(template.kind).toBe(24242);
    expect(template.tags).toEqual([
      ["t", "get"],
      ["expiration", "1700000060"],
      ["server", "buzz.fudu.space"],
    ]);
  });
});

function fixtureSignedEvent(overrides: Partial<SignedEvent> = {}): SignedEvent {
  return {
    id: "0".repeat(64),
    pubkey: "1".repeat(64),
    created_at: 1_700_000_000,
    kind: 24242,
    tags: [["t", "get"]],
    content: "vouchd: fetch a profile picture",
    sig: "2".repeat(128),
    ...overrides,
  };
}

describe("fetchAuthorizedBlob", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob() }));
    // Spy on createObjectURL rather than stubbing the whole `URL` global --
    // fetchAuthorizedBlob's server-scoping needs the real `new URL()` constructor.
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("signs once and reuses the shared token across multiple blobs for the same signer", async () => {
    const sign: SignEvent = vi.fn().mockResolvedValue(fixtureSignedEvent());
    await fetchAuthorizedBlob("https://buzz.fudu.space/media/a.png", sign);
    await fetchAuthorizedBlob("https://buzz.fudu.space/media/b.png", sign);
    expect(sign).toHaveBeenCalledTimes(1);
  });

  it("signs again for a different signer -- switching identity doesn't reuse the old token", async () => {
    const signA: SignEvent = vi.fn().mockResolvedValue(fixtureSignedEvent());
    const signB: SignEvent = vi.fn().mockResolvedValue(fixtureSignedEvent({ pubkey: "3".repeat(64) }));
    await fetchAuthorizedBlob("https://buzz.fudu.space/media/a.png", signA);
    await fetchAuthorizedBlob("https://buzz.fudu.space/media/b.png", signB);
    expect(signA).toHaveBeenCalledTimes(1);
    expect(signB).toHaveBeenCalledTimes(1);
  });

  it("signs again for a different server host -- a token scoped to one host doesn't cover another", async () => {
    const sign: SignEvent = vi.fn().mockResolvedValue(fixtureSignedEvent());
    await fetchAuthorizedBlob("https://buzz.fudu.space/media/a.png", sign);
    await fetchAuthorizedBlob("https://other.example/media/b.png", sign);
    expect(sign).toHaveBeenCalledTimes(2);
  });
});

describe("blobAuthHeader", () => {
  it("base64url-encodes the signed event under the Nostr scheme", () => {
    const signed: SignedEvent = {
      id: "0".repeat(64),
      pubkey: "1".repeat(64),
      created_at: 1_700_000_000,
      kind: 24242,
      tags: [["t", "get"]],
      content: "vouchd: fetch a profile picture",
      sig: "2".repeat(128),
    };
    const header = blobAuthHeader(signed);
    expect(header).toMatch(/^Nostr [A-Za-z0-9_-]+$/);
    const decoded = JSON.parse(
      Buffer.from(header.slice("Nostr ".length), "base64url").toString("utf8"),
    );
    expect(decoded).toEqual(signed);
  });
});
