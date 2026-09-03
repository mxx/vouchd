/**
 * `fetchRelayInfo` fails silently by design (see its own docblock) -- these
 * cover both halves: a relay that actually serves a NIP-11 document, and
 * every way "nothing to show" can happen, all collapsing to `null`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRelayInfo } from "@/protocol/nip11";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRelayInfo", () => {
  it("returns the parsed document on success, requesting it over https with the NIP-11 accept header", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ name: "Test Relay", description: "a relay for tests" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const info = await fetchRelayInfo("wss://relay.example");

    expect(info).toEqual({ name: "Test Relay", description: "a relay for tests" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://relay.example");
    expect(init?.headers).toEqual({ Accept: "application/nostr+json" });
  });

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    expect(await fetchRelayInfo("wss://relay.example")).toBeNull();
  });

  it("returns null when the request itself rejects (network error, CORS refusal)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await fetchRelayInfo("wss://relay.example")).toBeNull();
  });

  it("returns null when the response body isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      })),
    );
    expect(await fetchRelayInfo("wss://relay.example")).toBeNull();
  });
});
