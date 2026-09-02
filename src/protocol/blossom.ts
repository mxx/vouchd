/**
 * BUD-11 Blossom authorization: the `kind:24242` signed Nostr event a
 * Blossom media server can require before it will serve a blob over plain
 * HTTP. Buzz's media store is Blossom (BUD-01 GET, BUD-02 upload -- see
 * buzz/NOSTR.md in the Buzz repo), and BUD-11 leaves requiring it on GET as
 * a per-server choice, not a protocol mandate -- this app only needs it
 * because a given relay's media host has turned it on.
 *
 * 24242 is not a Buzz kind (kinds.ts's own doc comment reserves that file
 * for buzz-core/src/kind.rs numbers) -- it's the Blossom spec's own kind,
 * unrelated to Buzz, so it lives here instead.
 *
 * Deliberately narrow: only the `get` verb, because fetching a profile
 * picture (AgentsPanel's name cell) is the only blob vouchd ever reads.
 * `upload`/`list`/`delete` are a different app's problem -- vouchd never
 * writes media, the same boundary profile.ts draws for kind:0 itself.
 *
 * One token, shared across every picture: the first version of this file
 * minted a fresh token scoped to each blob (an `x` tag), signed once per
 * image. Silent for NIP-07, but a passphrase prompt *per avatar* for
 * ownerKeystoreSigner -- unusable, and the actual reason owner-key signing
 * was left out of picture-loading at first (see AgentsPanel's git history).
 * The fix is an unscoped token (no `x` tag, valid for every blob on this
 * server) reused for SHARED_AUTH_TTL_SECONDS. That does cache a signed
 * artifact across calls, which passphraseProvider.ts's signer deliberately
 * never does -- but what's cached here is a short-lived, read-only bearer
 * token, never the passphrase or the secret it decrypts. ownerKeystoreSigner
 * itself still asks fresh, and still forgets, on every call.
 */

import type { EventTemplate } from "./events/types";
import type { SignedEvent } from "./relayMessages";
import type { SignEvent } from "../signer/nip07Signer";

const KIND_BLOSSOM_AUTH = 24242;

/** How long a minted token is accepted -- BUD-11 requires *some* expiration, not this specific window. */
const TOKEN_TTL_SECONDS = 60;

/** How long the shared, unscoped token (see module docblock) is reused
 *  before re-signing. Longer than TOKEN_TTL_SECONDS on purpose: one
 *  passphrase prompt should cover a whole visit's worth of avatars, not
 *  expire mid-render. */
const SHARED_AUTH_TTL_SECONDS = 300;

/** A BUD-11 `get` authorization, scoped to one blob when its sha256 is known. */
export function buildBlobGetAuth(sha256: string | undefined, createdAt: number): EventTemplate {
  const tags: string[][] = [
    ["t", "get"],
    ["expiration", String(createdAt + TOKEN_TTL_SECONDS)],
  ];
  if (sha256) tags.push(["x", sha256]);
  return {
    kind: KIND_BLOSSOM_AUTH,
    tags,
    content: "vouchd: fetch a profile picture",
    created_at: createdAt,
  };
}

const SHA256_IN_PATH = /\/([0-9a-f]{64})\.[a-z0-9]+(?:[?#]|$)/i;

/** Pulls the blob's sha256 out of a Blossom-shaped URL (`.../{sha256}.{ext}`), if there is one. */
export function sha256FromUrl(url: string): string | undefined {
  return SHA256_IN_PATH.exec(url)?.[1];
}

/** Base64url per BUD-11: standard base64, then made URL-safe and unpadded, as JWTs do. */
function base64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The `Authorization: Nostr <token>` header value BUD-11 defines. */
export function blobAuthHeader(signed: SignedEvent): string {
  return `Nostr ${base64Url(JSON.stringify(signed))}`;
}

let sharedAuth: { signer: SignEvent; signed: SignedEvent; expiresAt: number } | undefined;

/**
 * One unscoped get-auth token per signer, reused until it's near expiry
 * (module docblock has the why). Keyed by the signer's own identity, not
 * just "is one cached": useCommunityConnection hands out a fresh
 * `ownerKeystoreSigner` closure per connect(), so switching identity
 * invalidates the old token for free.
 */
async function sharedGetAuth(sign: SignEvent): Promise<SignedEvent> {
  const now = Math.floor(Date.now() / 1000);
  if (sharedAuth && sharedAuth.signer === sign && sharedAuth.expiresAt > now) {
    return sharedAuth.signed;
  }
  const signed = await sign(buildBlobGetAuth(undefined, now));
  sharedAuth = { signer: sign, signed, expiresAt: now + SHARED_AUTH_TTL_SECONDS };
  return signed;
}

/**
 * Fetches one blob using the shared get-auth token, handing back an object
 * URL the caller owns (and must revoke -- see useAuthorizedImage, the one
 * caller). Undefined on any failure: a picture is decoration, never worth
 * surfacing an error banner over.
 */
export async function fetchAuthorizedBlob(url: string, sign: SignEvent): Promise<string | undefined> {
  try {
    const signed = await sharedGetAuth(sign);
    const response = await fetch(url, { headers: { Authorization: blobAuthHeader(signed) } });
    if (!response.ok) return undefined;
    return URL.createObjectURL(await response.blob());
  } catch {
    return undefined;
  }
}
