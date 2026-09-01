/**
 * Encrypted storage for the OWNER's secret key -- the one piece of secret
 * material this app must handle itself.
 *
 * Why this exists at all, given NIP-07: minting a NIP-OA `auth` tag is a raw
 * BIP-340 signature over a non-event preimage, and NIP-07's `signEvent` only
 * signs well-formed Nostr events. There is no standard extension call that
 * produces this signature, so the owner's key has to be reachable by this
 * page for that one operation. Per the security-boundary redesign recorded
 * in docs/ARCHITECTURE.md, this keystore is now also usable for relay AUTH
 * and day-to-day publish signing -- not because NIP-07 stopped working, but
 * because a NIP-07 extension is its own standing, un-auditable leak point:
 * it holds signing capability for as long as it's installed, not for the
 * duration of one call the way this keystore does. Widening *who* calls
 * this keystore doesn't change its core discipline below.
 *
 * The API is shaped to bound the exposure rather than to trust discipline:
 * there is no `unlock()` that hands you a key and hopes you forget it. The
 * only way to reach the secret is `withOwnerSecret(passphrase, use)`, which
 * decrypts, runs your callback, and zeroes the bytes in a `finally` -- so
 * the plaintext's lifetime is a call stack, not a session.
 *
 * At-rest format is NIP-49 (`ncryptsec1...`, src/protocol/nip49.ts) rather
 * than a bespoke scheme: it's a real Nostr standard other clients already
 * export/import, so `store()` can accept an already-encrypted key exactly
 * as-is (verbatim, no decrypt-then-re-encrypt round trip through a second,
 * vouchd-specific format) alongside raw key material this keystore encrypts
 * itself.
 *
 * Honest limits, because overstating these would be worse than not having
 * them written down:
 * - The secret exists in page memory for the duration of the callback. An
 *   XSS during that window can read it. Bounded, not eliminated.
 * - Bytes are zeroed; any string a caller derives from them cannot be -- JS
 *   strings are immutable. That is why the callback receives a `Uint8Array`.
 * - `ownerPubkey` is stored in the clear so the UI can say whose key is
 *   locked here without asking for a passphrase. That links this browser
 *   profile to a pubkey for anyone who can read its IndexedDB. Deliberate
 *   trade; if it ever isn't wanted, encrypt it with the rest.
 */

import { schnorr } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { decodeSecretKeyInput } from "../protocol/nip19";
import { decryptSecretKey, encryptSecretKey, isEncryptedSecretKey } from "../protocol/nip49";

export class KeystoreError extends Error {}

/**
 * The at-rest record. `ncryptsec` is opaque without the passphrase.
 *
 * There is no migration from v1 (the old bespoke PBKDF2+AES-GCM scheme):
 * nothing built on v1 was ever publicly released, so `loadUsableRecord()`
 * below just treats a v1 record already sitting in someone's IndexedDB as
 * if nothing were stored, rather than carrying migration code for a format
 * no real user has.
 */
export interface EncryptedSecret {
  version: 2;
  ownerPubkey: string;
  ncryptsec: string;
}

/** Where the record lives. Injectable so the crypto is testable without IndexedDB. */
export interface KeystoreStorage {
  load(): Promise<EncryptedSecret | null>;
  save(record: EncryptedSecret): Promise<void>;
  clear(): Promise<void>;
}

export class OwnerKeystore {
  constructor(private readonly storage: KeystoreStorage) {}

  /** "empty" or "locked" -- there is deliberately no "unlocked" state to be in. */
  async status(): Promise<"empty" | "locked"> {
    return (await this.loadUsableRecord()) ? "locked" : "empty";
  }

  /** Whose key is stored here, readable without the passphrase. */
  async ownerPubkey(): Promise<string | null> {
    return (await this.loadUsableRecord())?.ownerPubkey ?? null;
  }

  /**
   * Store an owner secret, replacing whatever was there. `ownerSecret` is
   * either raw key material (hex, nsec, or 32 bytes) to encrypt fresh, or
   * an `ncryptsec1...` blob already encrypted elsewhere -- told apart by
   * content, not by a separate flag, since both paths converge on the same
   * question either way: "does this passphrase open it?"
   */
  async store(ownerSecret: Uint8Array | string, passphrase: string): Promise<string> {
    if (typeof ownerSecret === "string" && isEncryptedSecretKey(ownerSecret)) {
      return this.storeEncrypted(ownerSecret, passphrase);
    }
    return this.storeRaw(ownerSecret, passphrase);
  }

  /**
   * The only path to the plaintext. Decrypts, runs `use`, zeroes the bytes
   * before returning -- including when `use` throws.
   */
  async withOwnerSecret<T>(
    passphrase: string,
    use: (ownerSecret: Uint8Array) => T | Promise<T>,
  ): Promise<T> {
    const record = await this.loadUsableRecord();
    if (!record) throw new KeystoreError("no owner key is stored in this browser");
    const secret = this.decrypt(record.ncryptsec, passphrase);
    try {
      return await use(secret);
    } finally {
      secret.fill(0);
    }
  }

  async clear(): Promise<void> {
    await this.storage.clear();
  }

  /** Encrypt fresh key material and store it. */
  private async storeRaw(ownerSecret: Uint8Array | string, passphrase: string): Promise<string> {
    const decoded =
      typeof ownerSecret === "string" ? decodeSecretKeyInput(ownerSecret) : ownerSecret;
    const secretBytes = typeof decoded === "string" ? hexToBytes(decoded) : Uint8Array.from(decoded);
    if (secretBytes.length !== 32) {
      throw new KeystoreError(`owner secret must be 32 bytes, got ${secretBytes.length}`);
    }
    const ownerPubkey = bytesToHex(schnorr.getPublicKey(secretBytes));
    const ncryptsec = encryptSecretKey(secretBytes, passphrase);
    secretBytes.fill(0);
    await this.storage.save({ version: 2, ownerPubkey, ncryptsec });
    return ownerPubkey;
  }

  /**
   * Store an already-encrypted import verbatim. Still has to decrypt it
   * once here, though: the only way to know `passphrase` actually opens
   * this blob -- and to learn the pubkey it belongs to -- is to open it.
   */
  private async storeEncrypted(ncryptsec: string, passphrase: string): Promise<string> {
    const secretBytes = this.decrypt(ncryptsec, passphrase);
    const ownerPubkey = bytesToHex(schnorr.getPublicKey(secretBytes));
    secretBytes.fill(0);
    await this.storage.save({ version: 2, ownerPubkey, ncryptsec });
    return ownerPubkey;
  }

  /** A v1 (pre-NIP-49) record is treated as absent, not migrated. */
  private async loadUsableRecord(): Promise<EncryptedSecret | null> {
    const record = await this.storage.load();
    return record?.version === 2 ? record : null;
  }

  private decrypt(ncryptsec: string, passphrase: string): Uint8Array {
    try {
      return decryptSecretKey(ncryptsec, passphrase);
    } catch {
      // Wrong passphrase and a corrupt/foreign blob look identical here
      // (NIP-49's AEAD authentication fails the same way either way);
      // saying so plainly is more useful than surfacing nostr-tools' text.
      throw new KeystoreError("wrong passphrase (or the stored key is corrupt)");
    }
  }
}

/** In-memory storage: for tests, and for a deliberately non-persistent session. */
export function createMemoryStorage(): KeystoreStorage {
  let record: EncryptedSecret | null = null;
  return {
    load: async () => record,
    save: async (next) => {
      record = next;
    },
    clear: async () => {
      record = null;
    },
  };
}
