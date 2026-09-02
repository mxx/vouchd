/**
 * BUD-11 auth-token construction: the pieces that don't need a real signer
 * or a real network call. `fetchAuthorizedBlob` itself (signs, then fetches)
 * is exercised through the app, not here -- there's no local behavior left
 * to assert on once those two delegate calls are mocked out.
 */

import { describe, expect, it } from "vitest";
import { blobAuthHeader, buildBlobGetAuth, sha256FromUrl } from "@/protocol/blossom";
import type { SignedEvent } from "@/protocol/relayMessages";

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
