/**
 * NIP-OA (Owner Attestation) -- mint and verify the `auth` tag.
 *
 * Spec: docs/nips/NIP-OA.md in the Buzz repo (test vectors there were used
 * to validate this implementation -- see tests/protocol/nipOA.test.ts).
 *
 * Deliberately reimplemented in TypeScript rather than compiled from the
 * Buzz Rust `buzz-sdk` crate to WASM: that path was prototyped and abandoned
 * (secp256k1-sys's C build needs a wasm-capable clang, getrandom/uuid need
 * explicit backend wiring on wasm32, and a transitive `idna`/ICU4X data
 * table alone added >1MB to the binary) for a protocol surface this small.
 * `@noble/curves` is the same audited secp256k1/Schnorr implementation
 * `nostr-tools` itself depends on, so this introduces no new crypto library
 * into the page.
 *
 * Signing boundary, important: this is a raw BIP-340 Schnorr signature over
 * a *non-event* preimage. A standard NIP-07 browser extension's `signEvent`
 * cannot produce it -- NIP-07 only signs well-formed Nostr events. Minting
 * therefore requires the owner's raw secret key in page memory for this one
 * operation (see src/signer/ownerKeystore.ts), unlike every other signed
 * event this app publishes, which should go through NIP-07.
 */

import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { validateConditions } from "./conditions";

const DOMAIN_SEPARATOR = "nostr:agent-auth:";

export class NipOaError extends Error {}

export type AuthTag = readonly [tag: "auth", ownerPubkeyHex: string, conditions: string, sigHex: string];

function preimage(agentPubkeyHex: string, conditions: string): Uint8Array {
  return utf8ToBytes(`${DOMAIN_SEPARATOR}${agentPubkeyHex}:${conditions}`);
}

function assertHex64(value: string, label: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new NipOaError(`${label} must be 64 lowercase hex chars, got: "${value}"`);
  }
}

/**
 * Sign a NIP-OA `auth` tag: the owner attests that `agentPubkeyHex` may
 * publish events subject to `conditions`.
 *
 * @param ownerSecret - the OWNER's raw secret key, as bytes (preferred) or
 *   32-byte hex. Never the agent's key. Bytes are preferred because a
 *   `Uint8Array` can be zeroed after use and a JavaScript string cannot --
 *   see src/signer/ownerKeystore.ts, which hands bytes and wipes them.
 * @param agentPubkeyHex - the agent's public key (32-byte x-only hex).
 * @param conditions - NIP-OA conditions string; validated before signing.
 */
export function computeAuthTag(
  ownerSecret: Uint8Array | string,
  agentPubkeyHex: string,
  conditions: string,
): AuthTag {
  assertHex64(agentPubkeyHex, "agent_pubkey");
  validateConditions(conditions); // throws ConditionsError on malformed input

  const ownerSecretBytes =
    typeof ownerSecret === "string" ? hexToBytes(ownerSecret) : ownerSecret;
  const ownerPubkeyHex = bytesToHex(schnorr.getPublicKey(ownerSecretBytes));

  if (ownerPubkeyHex === agentPubkeyHex) {
    throw new NipOaError("owner and agent pubkeys must differ (self-attestation rejected)");
  }

  const message = sha256(preimage(agentPubkeyHex, conditions));
  const sig = schnorr.sign(message, ownerSecretBytes);
  return ["auth", ownerPubkeyHex, conditions, bytesToHex(sig)] as const;
}

/**
 * Verify a NIP-OA `auth` tag against a claimed agent pubkey. Checks only
 * signature validity + well-formedness -- it does NOT evaluate the
 * conditions against any specific event (see conditions.ts#satisfiesConditions
 * for that, which callers should run separately against the event they
 * actually received before trusting it).
 *
 * @returns the owner's pubkey (hex) on success.
 * @throws NipOaError on malformed tag or invalid signature.
 */
export function verifyAuthTag(tag: unknown, agentPubkeyHex: string): string {
  assertHex64(agentPubkeyHex, "agent_pubkey");

  if (!Array.isArray(tag) || tag.length !== 4) {
    throw new NipOaError(`auth tag must have exactly 4 elements, got: ${JSON.stringify(tag)}`);
  }
  const [label, ownerPubkeyHex, conditions, sigHex] = tag as string[];
  if (label !== "auth") {
    throw new NipOaError(`first element must be "auth", got: "${label}"`);
  }
  assertHex64(ownerPubkeyHex, "owner_pubkey");
  if (typeof conditions !== "string") {
    throw new NipOaError("conditions must be a string");
  }
  if (!/^[0-9a-f]{128}$/.test(sigHex)) {
    throw new NipOaError(`sig must be 128 lowercase hex chars, got: "${sigHex}"`);
  }
  if (ownerPubkeyHex === agentPubkeyHex) {
    throw new NipOaError("self-attestation rejected");
  }
  // Spec requires evaluating every clause but does NOT require conditions to
  // be re-derived/normalized -- verification must use the exact string from
  // the tag. We only check it parses (malformed conditions = invalid tag);
  // the caller runs satisfiesConditions() against a real event separately.
  validateConditions(conditions);

  const message = sha256(preimage(agentPubkeyHex, conditions));
  const ok = schnorr.verify(hexToBytes(sigHex), message, hexToBytes(ownerPubkeyHex));
  if (!ok) {
    throw new NipOaError("invalid signature");
  }
  return ownerPubkeyHex;
}
