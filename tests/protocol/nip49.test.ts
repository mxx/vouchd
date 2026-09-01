/**
 * NIP-49 (`ncryptsec1...`) round-trips and the shape of its failures --
 * mirrors of what tests/signer/ownerKeystore.test.ts relies on this module
 * for, tested in isolation from the keystore's own storage/lifecycle logic.
 */

import { describe, expect, it } from "vitest";
import { hexToBytes } from "@noble/hashes/utils";
import {
  decryptSecretKey,
  EncryptedKeyError,
  encryptSecretKey,
  isEncryptedSecretKey,
} from "@/protocol/nip49";

const SECRET = hexToBytes(
  "0000000000000000000000000000000000000000000000000000000000000001",
);
const PASSPHRASE = "correct horse battery staple";

describe("encryptSecretKey / decryptSecretKey", () => {
  it("round-trips a secret through the correct passphrase", () => {
    const ncryptsec = encryptSecretKey(SECRET, PASSPHRASE);
    expect(decryptSecretKey(ncryptsec, PASSPHRASE)).toEqual(SECRET);
  });

  it("produces a bech32 ncryptsec1... string", () => {
    expect(encryptSecretKey(SECRET, PASSPHRASE)).toMatch(/^ncryptsec1[023456789acdefghjklmnpqrstuvwxyz]+$/);
  });

  it("refuses to decrypt under the wrong passphrase", () => {
    const ncryptsec = encryptSecretKey(SECRET, PASSPHRASE);
    expect(() => decryptSecretKey(ncryptsec, "not it")).toThrow(EncryptedKeyError);
  });

  it("refuses to decrypt a blob that isn't valid ncryptsec at all", () => {
    expect(() => decryptSecretKey("nsec1notanncryptsec", PASSPHRASE)).toThrow(EncryptedKeyError);
  });

  it("never encrypts the same secret to the same blob twice", () => {
    // NIP-49 draws a fresh random salt and nonce per call; two encryptions
    // of the same secret under the same passphrase must not be comparable
    // ciphertext-to-ciphertext.
    expect(encryptSecretKey(SECRET, PASSPHRASE)).not.toBe(encryptSecretKey(SECRET, PASSPHRASE));
  });
});

describe("isEncryptedSecretKey", () => {
  it("recognizes a real ncryptsec blob", () => {
    expect(isEncryptedSecretKey(encryptSecretKey(SECRET, PASSPHRASE))).toBe(true);
  });

  it("rejects an nsec -- a different key shape, not an encrypted one", () => {
    expect(isEncryptedSecretKey("nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsmhltgl")).toBe(
      false,
    );
  });

  it("rejects raw hex", () => {
    expect(
      isEncryptedSecretKey("0000000000000000000000000000000000000000000000000000000000000001"),
    ).toBe(false);
  });

  it("trims surrounding whitespace before checking", () => {
    const ncryptsec = encryptSecretKey(SECRET, PASSPHRASE);
    expect(isEncryptedSecretKey(`  ${ncryptsec}  `)).toBe(true);
  });
});
