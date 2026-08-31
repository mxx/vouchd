import { describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { computeAuthTag, NipOaError, verifyAuthTag } from "@/protocol/nipOA";
import { ConditionsError } from "@/protocol/conditions";

// Official NIP-OA.md test vector (docs/nips/NIP-OA.md in the Buzz repo).
// owner_secret = 32-byte-hex ...0001, agent_secret = ...0002.
const OWNER_PUBKEY = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const AGENT_PUBKEY = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
const OWNER_SECRET = "0000000000000000000000000000000000000000000000000000000000000001";
const CONDITIONS = "kind=1&created_at<1713957000";
const EXPECTED_SHA256_PREIMAGE = "08cdecd55af4c28d3801fd69615dcf5cc04fab3bc134b38a840bf157197069a6";
const VECTOR_TAG = [
  "auth",
  OWNER_PUBKEY,
  CONDITIONS,
  "8b7df2575caf0a108374f8471722b233c53f9ff827a8b0f91861966c3b9dd5cb2e189eae9f49d72187674c2f5bd244145e10ff86c9f257ffe65a1ee5f108b369",
] as const;

describe("nipOA: preimage construction (deterministic, no signing randomness)", () => {
  it("matches the spec's exact domain separator + layout", () => {
    // Reconstructed inline rather than importing the private `preimage()`
    // helper -- this is exactly the string a correct implementation must
    // produce, byte for byte, independent of any signature.
    const preimage = utf8ToBytes(`nostr:agent-auth:${AGENT_PUBKEY}:${CONDITIONS}`);
    expect(bytesToHex(sha256(preimage))).toBe(EXPECTED_SHA256_PREIMAGE);
  });
});

describe("nipOA: verifying the official vector", () => {
  it("accepts the spec's literal tag and recovers the owner pubkey", () => {
    expect(verifyAuthTag(VECTOR_TAG, AGENT_PUBKEY)).toBe(OWNER_PUBKEY);
  });

  it("rejects the same tag against a different agent pubkey", () => {
    const wrongAgent = "0".repeat(63) + "1";
    expect(() => verifyAuthTag(VECTOR_TAG, wrongAgent)).toThrow(NipOaError);
  });

  it("rejects a tampered signature", () => {
    const tampered: string[] = [...VECTOR_TAG];
    tampered[3] = "0".repeat(128);
    expect(() => verifyAuthTag(tampered, AGENT_PUBKEY)).toThrow(NipOaError);
  });
});

describe("nipOA: compute -> verify round trip (signature itself is nondeterministic)", () => {
  // BIP-340 Schnorr signing draws fresh auxiliary randomness by default, so
  // computeAuthTag() will NOT reproduce the vector's exact sig_hex byte for
  // byte -- that is correct, expected behavior, not a bug. Round-tripping
  // through verifyAuthTag is the right way to assert correctness here.
  it("round-trips and recovers the owner pubkey", () => {
    const tag = computeAuthTag(OWNER_SECRET, AGENT_PUBKEY, CONDITIONS);
    expect(verifyAuthTag(tag, AGENT_PUBKEY)).toBe(OWNER_PUBKEY);
    expect(tag[1]).toBe(OWNER_PUBKEY);
    expect(tag[2]).toBe(CONDITIONS);
  });

  it("rejects self-attestation", () => {
    expect(() => computeAuthTag(OWNER_SECRET, OWNER_PUBKEY, CONDITIONS)).toThrow(NipOaError);
  });

  it("rejects malformed conditions before ever signing", () => {
    expect(() => computeAuthTag(OWNER_SECRET, AGENT_PUBKEY, "&kind=1")).toThrow(ConditionsError);
    expect(() => computeAuthTag(OWNER_SECRET, AGENT_PUBKEY, "kind=01")).toThrow(ConditionsError);
    expect(() => computeAuthTag(OWNER_SECRET, AGENT_PUBKEY, "kind=99999")).toThrow(ConditionsError);
  });

  it("accepts empty conditions (no constraints -- an indefinite grant)", () => {
    const tag = computeAuthTag(OWNER_SECRET, AGENT_PUBKEY, "");
    expect(verifyAuthTag(tag, AGENT_PUBKEY)).toBe(OWNER_PUBKEY);
  });
});
