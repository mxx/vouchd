/**
 * NIP-49 encrypted secret keys (`ncryptsec1...`) -- the format some Nostr
 * clients (and hardware/paper backups) export a secret key in: already
 * password-protected, not plaintext. This is also vouchd's own at-rest
 * format now (see src/signer/ownerKeystore.ts) -- storing a key means
 * storing exactly this, so importing one already in this shape needs no
 * decrypt-then-re-encrypt round trip through a second, vouchd-specific
 * scheme. It is already in the form vouchd wants to keep.
 *
 * `nostr-tools/nip49` supplies the primitives (scrypt + XChaCha20-Poly1305);
 * this module is a thin, typed wrapper plus the one choice nostr-tools
 * leaves to the caller: which "key security byte" to claim.
 */

import { NostrTypeGuard } from "nostr-tools/nip19";
import { decrypt as nip49Decrypt, encrypt as nip49Encrypt } from "nostr-tools/nip49";

export class EncryptedKeyError extends Error {}

/**
 * NIP-49's disclosure byte: 0x00 claims the key has never left secure
 * storage unencrypted, 0x01 admits the opposite, 0x02 says "unknown". vouchd
 * cannot honestly claim 0x00 -- its entire import flow is a user pasting a
 * raw secret into a text field -- so every key it encrypts is marked 0x02
 * rather than overstating a guarantee it has no way to back up.
 */
const KEY_SECURITY_UNKNOWN = 0x02;

/** True for `ncryptsec1...` input -- an already-encrypted secret key. */
export function isEncryptedSecretKey(input: string): boolean {
  return NostrTypeGuard.isNcryptsec(input.trim());
}

/** Encrypt a raw 32-byte secret into the ncryptsec blob vouchd stores. */
export function encryptSecretKey(secret: Uint8Array, passphrase: string): string {
  return nip49Encrypt(secret, passphrase, undefined, KEY_SECURITY_UNKNOWN);
}

/**
 * Decrypt an ncryptsec blob. `nostr-tools` throws a plain `Error` for both
 * a wrong passphrase and a malformed blob (an AEAD failure looks the same
 * either way); wrapped here so every caller catches one error type from
 * this module instead of reaching into nostr-tools' own error shape.
 */
export function decryptSecretKey(ncryptsec: string, passphrase: string): Uint8Array {
  try {
    return nip49Decrypt(ncryptsec, passphrase);
  } catch (error) {
    throw new EncryptedKeyError(`could not decrypt: ${(error as Error).message}`);
  }
}
