// @vitest-environment jsdom

/**
 * `failed` has to mean "we tried and this host refused it", not just
 * "src is empty" -- AgentsPanel uses the distinction to show a placeholder
 * only when there was something to explain (see the hook's own docblock
 * for the buzz.fudu.space CORS gap that makes `failed` a real, expected
 * case rather than a bug). Mocks fetchAuthorizedBlob directly: the
 * fetch/sign/CORS layer itself is blossom.ts's job and its own tests.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAuthorizedImage } from "@/app/useAuthorizedImage";
import * as blossom from "@/protocol/blossom";
import type { SignEvent } from "@/signer/nip07Signer";

const sign = vi.fn() as unknown as SignEvent;

describe("useAuthorizedImage", () => {
  it("is neither loaded nor failed when there's no url or no signer yet", () => {
    const { result } = renderHook(() => useAuthorizedImage(undefined, sign));
    expect(result.current).toEqual({ src: undefined, failed: false });
  });

  it("reports the object URL on success, not failed", async () => {
    vi.spyOn(blossom, "fetchAuthorizedBlob").mockResolvedValue("blob:ok");
    const { result } = renderHook(() => useAuthorizedImage("https://x/a.png", sign));
    await waitFor(() => expect(result.current.src).toBe("blob:ok"));
    expect(result.current.failed).toBe(false);
  });

  it("reports failed, not just an empty src, when the fetch resolves to undefined", async () => {
    vi.spyOn(blossom, "fetchAuthorizedBlob").mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuthorizedImage("https://x/a.png", sign));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.src).toBeUndefined();
  });
});
