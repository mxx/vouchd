/**
 * Encrypted storage for the OWNER's secret key — the one piece of secret
 * material this app must handle itself.
 *
 * Why this exists at all, given NIP-07: minting a NIP-OA `auth` tag is a raw
 * BIP-340 signature over a non-event preimage, and NIP-07's `signEvent` only
 * signs well-formed Nostr events. There is no standard extension call that
 * produces this signature, so the owner's key has to be reachable by this
 * page for that one operation. Everything else this app signs goes through
 * NIP-07 and never touches a raw key (src/signer/nip07Signer.ts).
 *
 * The API is shaped to bound the exposure rather than to trust discipline:
 * there is no `unlock()` that hands you a key and hopes you forget it. The
 * only way to reach the secret is `withOwnerSecret(passphrase, use)`, which
 * decrypts, runs your callback, and zeroes the bytes in a `finally` — so the
 * plaintext's lifetime is a call stack, not a session.
 *
 * Honest limits, because overstating these would be worse than not having
 * them written down:
 * - The secret exists in page memory for the duration of the callback. An
 *   XSS during that window can read it. Bounded, not eliminated.
 * - Bytes are zeroed; any string a caller derives from them cannot be — JS
 *   strings are immutable. That is why the callback receives a `Uint8Array`.
 * - `ownerPubkey` is stored in the clear so the UI can say whose key is
 *   locked here without asking for a passphrase. That links this browser
 *   profile to a pubkey for anyone who can read its IndexedDB. Deliberate
 *   trade; if it ever isn't wanted, encrypt it with the rest.
 */

import { schnorr } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

export class KeystoreError extends Error {}

/** The at-rest record. Everything but `ownerPubkey` is opaque without the passphrase. */
export interface EncryptedSecret {
  version: 1;
  ownerPubkey: string;
  salt: string;
  iv: string;
  ciphertext: string;
  iterations: number;
}

/** Where the record lives. Injectable so the crypto is testable without IndexedDB. */
export interface KeystoreStorage {
  load(): Promise<EncryptedSecret | null>;
  save(record: EncryptedSecret): Promise<void>;
  clear(): Promise<void>;
}

/**
 * PBKDF2-HMAC-SHA256. The iteration count is stored per record rather than
 * hardcoded at read time, so raising it later doesn't lock anyone out of a
 * key they stored under the old cost.
 */
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export class OwnerKeystore {
  constructor(private readonly storage: KeystoreStorage) {}

  /** "empty" or "locked" — there is deliberately no "unlocked" state to be in. */
  async status(): Promise<"empty" | "locked"> {
    return (await this.storage.load()) ? "locked" : "empty";
  }

  /** Whose key is stored here, readable without the passphrase. */
  async ownerPubkey(): Promise<string | null> {
    return (await this.storage.load())?.ownerPubkey ?? null;
  }

  /** Encrypt and store an owner secret, replacing whatever was there. */
  async store(ownerSecret: Uint8Array | string, passphrase: string): Promise<string> {
    const secretBytes =
      typeof ownerSecret === "string" ? hexToBytes(ownerSecret) : Uint8Array.from(ownerSecret);
    if (secretBytes.length !== 32) {
      throw new KeystoreError(`owner secret must be 32 bytes, got ${secretBytes.length}`);
    }
    const ownerPubkey = bytesToHex(schnorr.getPublicKey(secretBytes));
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(passphrase, salt, ITERATIONS);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      secretBytes as BufferSource,
    );
    secretBytes.fill(0);
    await this.storage.save({
      version: 1,
      ownerPubkey,
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(ciphertext)),
      iterations: ITERATIONS,
    });
    return ownerPubkey;
  }

  /**
   * The only path to the plaintext. Decrypts, runs `use`, zeroes the bytes
   * before returning — including when `use` throws.
   */
  async withOwnerSecret<T>(
    passphrase: string,
    use: (ownerSecret: Uint8Array) => T | Promise<T>,
  ): Promise<T> {
    const record = await this.storage.load();
    if (!record) throw new KeystoreError("no owner key is stored in this browser");
    const secret = await this.decrypt(record, passphrase);
    try {
      return await use(secret);
    } finally {
      secret.fill(0);
    }
  }

  async clear(): Promise<void> {
    await this.storage.clear();
  }

  private async decrypt(record: EncryptedSecret, passphrase: string): Promise<Uint8Array> {
    const key = await deriveKey(passphrase, fromBase64(record.salt), record.iterations);
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(record.iv) as BufferSource },
        key,
        fromBase64(record.ciphertext) as BufferSource,
      );
      return new Uint8Array(plaintext);
    } catch {
      // AES-GCM authentication failure is indistinguishable from a wrong
      // passphrase, and saying so plainly is more useful than "decrypt failed".
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
