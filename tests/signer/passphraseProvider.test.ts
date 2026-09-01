/**
 * `ownerKeystoreSigner`: turns an OwnerKeystore + a PassphraseProvider into
 * a plain SignEvent. Exercised here without any DOM, per this codebase's
 * rule that logic testable without one should live (and be tested) where
 * one isn't needed -- see useCommunityConnection.ts's header comment.
 */

import { describe, expect, it, vi } from "vitest";
import { verifyEvent } from "nostr-tools/pure";
import { createMemoryStorage, OwnerKeystore } from "@/signer/ownerKeystore";
import { ownerKeystoreSigner, type PassphraseRequest } from "@/signer/passphraseProvider";
import { nowSeconds } from "@/protocol/events/types";

const SECRET = "0000000000000000000000000000000000000000000000000000000000000001";
const OWNER_PUBKEY = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const PASSPHRASE = "correct horse battery staple";
const REASON = "sign in to the community relay";

async function storedKeystore(): Promise<OwnerKeystore> {
  const keystore = new OwnerKeystore(createMemoryStorage());
  await keystore.store(SECRET, PASSPHRASE);
  return keystore;
}

function template() {
  return { kind: 1, tags: [], content: "hello", created_at: nowSeconds() };
}

describe("ownerKeystoreSigner", () => {
  it("signs with the stored owner key once the passphrase is supplied", async () => {
    const keystore = await storedKeystore();
    const sign = ownerKeystoreSigner(keystore, async () => PASSPHRASE, REASON);
    const signed = await sign(template());
    expect(signed.pubkey).toBe(OWNER_PUBKEY);
    expect(verifyEvent(signed)).toBe(true);
  });

  it("passes the given reason to the passphrase request", async () => {
    const keystore = await storedKeystore();
    const requestPassphrase = vi.fn(async (request: PassphraseRequest) => {
      expect(request.reason).toBe(REASON);
      return PASSPHRASE;
    });
    await ownerKeystoreSigner(keystore, requestPassphrase, REASON)(template());
    expect(requestPassphrase).toHaveBeenCalledTimes(1);
  });

  it("asks fresh on every call rather than caching the passphrase", async () => {
    const keystore = await storedKeystore();
    const requestPassphrase = vi.fn().mockResolvedValue(PASSPHRASE);
    const sign = ownerKeystoreSigner(keystore, requestPassphrase, REASON);
    await sign(template());
    await sign(template());
    expect(requestPassphrase).toHaveBeenCalledTimes(2);
  });

  it("rejects when the human declines the prompt, instead of hanging or retrying", async () => {
    const keystore = await storedKeystore();
    const decline = () => Promise.reject(new Error("passphrase entry cancelled"));
    await expect(ownerKeystoreSigner(keystore, decline, REASON)(template())).rejects.toThrow(
      "passphrase entry cancelled",
    );
  });

  it("rejects when the passphrase is wrong", async () => {
    const keystore = await storedKeystore();
    const sign = ownerKeystoreSigner(keystore, async () => "wrong", REASON);
    await expect(sign(template())).rejects.toThrow(/wrong passphrase/);
  });
});
