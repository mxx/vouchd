// @vitest-environment jsdom

/**
 * connect() must store the real signer as state, not the result of calling
 * it: `signer` is itself a function, and React's setState overload that
 * takes a function treats it as an updater `(prevState) => newState`
 * rather than a literal value to store. `setSigner(signer)` looked correct
 * but silently invoked the signer with the previous state (`undefined`) as
 * its `template` argument instead of ever storing it -- which is exactly
 * how AgentsPanel's "no avatar, no error" surfaced: `connection.signer`
 * was never a callable signer at all. `setSigner(() => signer)` is the fix;
 * this pins the footgun down so it can't come back the same way.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCommunityConnection } from "@/app/useCommunityConnection";
import { LanguageProvider } from "@/i18n";
import type { ReadModelDb } from "@/readmodel/db";
import { createMemoryStorage, OwnerKeystore } from "@/signer/ownerKeystore";

const SECRET = "0000000000000000000000000000000000000000000000000000000000000001";
const PASSPHRASE = "correct horse battery staple";

/** connect()'s db is only ever null-checked before a real session exists. */
const fakeDb = {} as ReadModelDb;

describe("useCommunityConnection", () => {
  it("connect() stores the signer itself, callable, not the result of calling it", async () => {
    const keystore = new OwnerKeystore(createMemoryStorage());
    await keystore.store(SECRET, PASSPHRASE);

    const { result } = renderHook(
      () => useCommunityConnection(fakeDb, keystore, async () => PASSPHRASE),
      { wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider> },
    );

    act(() => {
      result.current.connect("wss://example.invalid", "ownerKey");
    });

    expect(typeof result.current.signer).toBe("function");
  });
});
