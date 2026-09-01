import { describe, expect, it } from "vitest";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  createMemoryStorage,
  KeystoreError,
  OwnerKeystore,
  type EncryptedSecret,
  type KeystoreStorage,
} from "@/signer/ownerKeystore";
import { encryptSecretKey } from "@/protocol/nip49";
import { computeAuthTag, verifyAuthTag } from "@/protocol/nipOA";

const SECRET = "0000000000000000000000000000000000000000000000000000000000000001";
const OWNER_PUBKEY = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const AGENT_PUBKEY = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
const PASSPHRASE = "correct horse battery staple";

function keystore() {
  return new OwnerKeystore(createMemoryStorage());
}

describe("storing and unlocking", () => {
  it("starts empty and becomes locked once a key is stored", async () => {
    const store = keystore();
    expect(await store.status()).toBe("empty");
    expect(await store.store(SECRET, PASSPHRASE)).toBe(OWNER_PUBKEY);
    expect(await store.status()).toBe("locked");
  });

  it("returns the same secret it was given", async () => {
    const store = keystore();
    await store.store(SECRET, PASSPHRASE);
    const roundTripped = await store.withOwnerSecret(PASSPHRASE, (secret) => bytesToHex(secret));
    expect(roundTripped).toBe(SECRET);
  });

  it("exposes whose key is stored without needing the passphrase", async () => {
    const store = keystore();
    await store.store(SECRET, PASSPHRASE);
    expect(await store.ownerPubkey()).toBe(OWNER_PUBKEY);
  });

  it("says plainly that the passphrase is wrong", async () => {
    const store = keystore();
    await store.store(SECRET, PASSPHRASE);
    await expect(store.withOwnerSecret("wrong", () => undefined)).rejects.toThrow(
      /wrong passphrase/,
    );
  });

  it("refuses to unlock when nothing is stored", async () => {
    await expect(keystore().withOwnerSecret(PASSPHRASE, () => undefined)).rejects.toThrow(
      KeystoreError,
    );
  });

  it("rejects a secret that isn't 32 bytes", async () => {
    await expect(keystore().store("00", PASSPHRASE)).rejects.toThrow(KeystoreError);
  });

  it("accepts an nsec, since that is what every Nostr client actually shows", async () => {
    const store = keystore();
    expect(await store.store("nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsmhltgl", PASSPHRASE)).toBe(OWNER_PUBKEY);
    const roundTripped = await store.withOwnerSecret(PASSPHRASE, (secret) => bytesToHex(secret));
    expect(roundTripped).toBe(SECRET);
  });

  it("forgets the key on clear()", async () => {
    const store = keystore();
    await store.store(SECRET, PASSPHRASE);
    await store.clear();
    expect(await store.status()).toBe("empty");
  });
});

describe("bounding the plaintext's lifetime", () => {
  it("zeroes the secret bytes after the callback returns", async () => {
    const store = keystore();
    await store.store(SECRET, PASSPHRASE);
    let escaped: Uint8Array = new Uint8Array();
    await store.withOwnerSecret(PASSPHRASE, (secret) => {
      escaped = secret;
      expect(bytesToHex(secret)).toBe(SECRET);
    });
    expect(escaped).toHaveLength(32);
    expect(escaped.every((byte) => byte === 0)).toBe(true);
  });

  it("zeroes the secret even when the callback throws", async () => {
    const store = keystore();
    await store.store(SECRET, PASSPHRASE);
    let escaped: Uint8Array = new Uint8Array();
    await expect(
      store.withOwnerSecret(PASSPHRASE, (secret) => {
        escaped = secret;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(escaped.every((byte) => byte === 0)).toBe(true);
  });

  it("leaves the caller's own input array untouched", async () => {
    const store = keystore();
    const input = hexToBytes(SECRET);
    await store.store(input, PASSPHRASE);
    // store() copies before encrypting: wiping a buffer the caller still
    // owns would be a surprising side effect, not a security win.
    expect(bytesToHex(input)).toBe(SECRET);
  });
});

describe("importing an already-encrypted key", () => {
  it("accepts an ncryptsec whose passphrase checks out, storing it verbatim", async () => {
    const ncryptsec = encryptSecretKey(hexToBytes(SECRET), PASSPHRASE);
    const store = keystore();
    expect(await store.store(ncryptsec, PASSPHRASE)).toBe(OWNER_PUBKEY);
    const roundTripped = await store.withOwnerSecret(PASSPHRASE, (secret) => bytesToHex(secret));
    expect(roundTripped).toBe(SECRET);
  });

  it("rejects an ncryptsec import when the passphrase doesn't unlock it", async () => {
    const ncryptsec = encryptSecretKey(hexToBytes(SECRET), PASSPHRASE);
    await expect(keystore().store(ncryptsec, "wrong")).rejects.toThrow(KeystoreError);
  });
});

describe("an old-format (pre-NIP-49) record", () => {
  function storageWithV1Record(): KeystoreStorage {
    // Shaped like the bespoke PBKDF2+AES-GCM record this keystore used to
    // write, before NIP-49 became the at-rest format. There is no migration
    // path (see EncryptedSecret's doc comment) -- this simulates whatever is
    // still sitting in a browser's IndexedDB from before that switch.
    let record: unknown = {
      version: 1,
      ownerPubkey: OWNER_PUBKEY,
      salt: "not-real",
      iv: "not-real",
      ciphertext: "not-real",
      iterations: 600_000,
    };
    return {
      load: async () => record as EncryptedSecret | null,
      save: async (next) => {
        record = next;
      },
      clear: async () => {
        record = null;
      },
    };
  }

  it("is treated as absent, not as a record to migrate", async () => {
    const store = new OwnerKeystore(storageWithV1Record());
    expect(await store.status()).toBe("empty");
    expect(await store.ownerPubkey()).toBeNull();
    await expect(store.withOwnerSecret(PASSPHRASE, () => undefined)).rejects.toThrow(
      KeystoreError,
    );
  });
});

describe("end to end: keystore feeds NIP-OA minting", () => {
  it("mints an auth tag that verifies against the stored owner key", async () => {
    const store = keystore();
    await store.store(SECRET, PASSPHRASE);
    const tag = await store.withOwnerSecret(PASSPHRASE, (secret) =>
      computeAuthTag(secret, AGENT_PUBKEY, "kind=1&created_at<1913957000"),
    );
    expect(verifyAuthTag(tag, AGENT_PUBKEY)).toBe(OWNER_PUBKEY);
  });
});
