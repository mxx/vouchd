/**
 * NIP-19 bech32 decoding for the two key formats users actually paste:
 * `npub1...` (a public key) and `nsec1...` (a secret key). Nothing on the
 * wire is ever bech32 -- every event, tag, and signature elsewhere in this
 * codebase is raw hex -- so this exists purely to meet users where their
 * keys already are: every Nostr client displays npub/nsec, never raw hex,
 * and asking someone to hand-convert before pasting is a needless failure
 * point this app can just not have.
 *
 * Each function also rejects the *other* prefix explicitly, rather than
 * letting it fall through to a generic "not valid hex" error further down
 * the call chain. Pasting a secret key into a public-key field (or the
 * reverse) is exactly the kind of mistake worth naming plainly, since the
 * generic error would otherwise read as "hex was wrong" and hide what
 * actually happened.
 */

import { nip19 } from "nostr-tools";

export class KeyFormatError extends Error {}

/** Accepts `npub1...` or 64-char hex (case as given; callers normalize case). */
export function decodePubkeyInput(input: string): string {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("nsec1")) {
    throw new KeyFormatError("this is a secret key (nsec), not a public key");
  }
  if (!lower.startsWith("npub1")) return trimmed;
  const decoded = decodeBech32(trimmed);
  if (decoded.type !== "npub") throw new KeyFormatError(`expected npub, got ${decoded.type}`);
  return decoded.data;
}

/** Accepts `nsec1...` or a hex/byte secret, passed through unchanged either way. */
export function decodeSecretKeyInput(input: string): Uint8Array | string {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("npub1")) {
    throw new KeyFormatError("this is a public key (npub), not a secret key");
  }
  if (!lower.startsWith("nsec1")) return trimmed;
  const decoded = decodeBech32(trimmed);
  if (decoded.type !== "nsec") throw new KeyFormatError(`expected nsec, got ${decoded.type}`);
  return decoded.data;
}

function decodeBech32(value: string): ReturnType<typeof nip19.decode> {
  try {
    return nip19.decode(value);
  } catch (error) {
    throw new KeyFormatError(`not a valid ${value.slice(0, 4)} key: ${(error as Error).message}`);
  }
}
