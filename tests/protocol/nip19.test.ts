/**
 * decodePubkeyInput / decodeSecretKeyInput: the two functions standing
 * between "whatever a user pasted" and the raw hex/bytes the rest of this
 * codebase assumes. Every Nostr client shows npub/nsec, never hex, so these
 * are on the path for every key a person types into this app.
 */

import { describe, expect, it } from "vitest";
import { bytesToHex } from "@noble/hashes/utils";
import { decodePubkeyInput, decodeSecretKeyInput, KeyFormatError } from "@/protocol/nip19";

const AGENT_PUBKEY = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
const AGENT_NPUB = "npub1ccz8l9zpa47k6vz9gphftsrumpw80rjt3nhnefat4symjhrsnmjs38mnyd";
const OWNER_SECRET_HEX = "0000000000000000000000000000000000000000000000000000000000000001";
const OWNER_NSEC = "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsmhltgl";
const AGENT_NSEC = "nsec1ccz8l9zpa47k6vz9gphftsrumpw80rjt3nhnefat4symjhrsnmjsa3sjzc";

describe("decodePubkeyInput", () => {
  it("passes raw hex through unchanged", () => {
    expect(decodePubkeyInput(AGENT_PUBKEY)).toBe(AGENT_PUBKEY);
  });

  it("decodes an npub to the hex it encodes", () => {
    expect(decodePubkeyInput(AGENT_NPUB)).toBe(AGENT_PUBKEY);
  });

  it("trims surrounding whitespace before checking the prefix", () => {
    expect(decodePubkeyInput(`  ${AGENT_NPUB}  `)).toBe(AGENT_PUBKEY);
  });

  it("rejects an nsec where a pubkey was expected", () => {
    expect(() => decodePubkeyInput(AGENT_NSEC)).toThrow(/secret key \(nsec\)/);
  });

  it("rejects a corrupted npub", () => {
    expect(() => decodePubkeyInput("npub1notreallyabech32string")).toThrow(KeyFormatError);
  });
});

describe("decodeSecretKeyInput", () => {
  it("passes raw hex through unchanged", () => {
    expect(decodeSecretKeyInput(OWNER_SECRET_HEX)).toBe(OWNER_SECRET_HEX);
  });

  it("decodes an nsec to the bytes it encodes", () => {
    const decoded = decodeSecretKeyInput(OWNER_NSEC);
    expect(decoded).not.toBeTypeOf("string");
    expect(bytesToHex(decoded as Uint8Array)).toBe(OWNER_SECRET_HEX);
  });

  it("rejects an npub where a secret key was expected", () => {
    expect(() => decodeSecretKeyInput(AGENT_NPUB)).toThrow(/public key \(npub\)/);
  });

  it("rejects a corrupted nsec", () => {
    expect(() => decodeSecretKeyInput("nsec1notreallyabech32string")).toThrow(KeyFormatError);
  });
});
