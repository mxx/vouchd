/**
 * BUD-11 auth-token construction, plus the shared-token cache in
 * `fetchAuthorizedBlob` (see blossom.ts's module docblock for why one
 * unscoped token is reused across every picture rather than a fresh
 * scoped one per blob) -- that caching is exactly the kind of branch this
 * house's rules want a check on, so `sign` and `fetch` are mocked to
 * assert it actually reuses, and actually stops reusing across signers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blobAuthHeader, buildBlobGetAuth, fetchAuthorizedBlob, sha256FromUrl } from "@/protocol/blossom";
import type { SignedEvent } from "@/protocol/relayMessages";
import type { SignEvent } from "@/signer/nip07Signer";

const SHA256 = "4a64f32d2375ccfe44c0880416bc72b809b055f0fb7d9dddeb8bb3dd6b80c297";

describe("sha256FromUrl", () => {
  it("extracts the hash from a Blossom-shaped media URL", () => {
    expect(sha256FromUrl(`https://buzz.fudu.space/media/${SHA256}.png`)).toBe(SHA256);
  });

  it("ignores a URL with no hash-shaped path segment", () => {
    expect(sha256FromUrl("https://example.com/avatar.png")).toBeUndefined();
  });
});

describe("buildBlobGetAuth", () => {
  it("tags the verb, an expiration, and the scoped blob hash", () => {
    const template = buildBlobGetAuth(SHA256, 1_700_000_000);
    expect(template.kind).toBe(24242);
    expect(template.tags).toEqual([
      ["t", "get"],
      ["expiration", "1700000060"],
      ["x", SHA256],
    ]);
  });

  it("omits the `x` tag when no blob is scoped (unscoped, server-wide auth)", () => {
    const template = buildBlobGetAuth(undefined, 1_700_000_000);
    expect(template.tags).toEqual([
      ["t", "get"],
      ["expiration", "1700000060"],
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
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock") });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
