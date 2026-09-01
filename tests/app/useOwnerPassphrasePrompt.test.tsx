// @vitest-environment jsdom

/**
 * useOwnerPassphrasePrompt: the React-side half of PassphraseProvider. What
 * matters here is the state machine (one pending request, resolved or
 * rejected by the human, with a second concurrent asker joining the first
 * rather than opening a second prompt) -- not React itself, so this is a
 * hook test, not a render test.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOwnerPassphrasePrompt } from "@/app/useOwnerPassphrasePrompt";

const REASON = "sign in to the community relay";

describe("useOwnerPassphrasePrompt", () => {
  it("has nothing pending until something asks", () => {
    const { result } = renderHook(() => useOwnerPassphrasePrompt());
    expect(result.current.pending).toBeNull();
  });

  it("surfaces a request as pending, and resolves the caller on submit", async () => {
    const { result } = renderHook(() => useOwnerPassphrasePrompt());
    let asked: Promise<string> = Promise.resolve("");
    act(() => {
      asked = result.current.requestPassphrase({ reason: REASON });
    });
    expect(result.current.pending?.reason).toBe(REASON);
    act(() => result.current.pending?.submit("hunter2"));
    await expect(asked).resolves.toBe("hunter2");
    expect(result.current.pending).toBeNull();
  });

  it("rejects the caller on cancel", async () => {
    const { result } = renderHook(() => useOwnerPassphrasePrompt());
    let asked: Promise<string> = Promise.resolve("");
    act(() => {
      asked = result.current.requestPassphrase({ reason: REASON });
    });
    act(() => result.current.pending?.cancel());
    await expect(asked).rejects.toThrow(/cancelled/);
    expect(result.current.pending).toBeNull();
  });

  it("hands a second concurrent ask the same in-flight request, not a new prompt", async () => {
    const { result } = renderHook(() => useOwnerPassphrasePrompt());
    let first: Promise<string> = Promise.resolve("");
    let second: Promise<string> = Promise.resolve("");
    act(() => {
      first = result.current.requestPassphrase({ reason: REASON });
      second = result.current.requestPassphrase({ reason: "a different reason" });
    });
    // One answer settles both askers -- there was only ever one prompt.
    act(() => result.current.pending?.submit("hunter2"));
    await expect(first).resolves.toBe("hunter2");
    await expect(second).resolves.toBe("hunter2");
  });

  it("opens a fresh prompt for the next ask once the previous one settled", async () => {
    const { result } = renderHook(() => useOwnerPassphrasePrompt());
    act(() => {
      void result.current.requestPassphrase({ reason: REASON });
    });
    act(() => result.current.pending?.submit("hunter2"));
    let second: Promise<string> = Promise.resolve("");
    act(() => {
      second = result.current.requestPassphrase({ reason: REASON });
    });
    expect(result.current.pending).not.toBeNull();
    act(() => result.current.pending?.submit("hunter3"));
    await expect(second).resolves.toBe("hunter3");
  });
});
