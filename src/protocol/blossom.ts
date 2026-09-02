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
 * Scoped by `server`, not `x`: BUD-11 itself treats a per-blob `x` tag as
 * merely optional on GET, but Buzz's own relay is stricter -- it rejects a
 * token that carries neither a matching `x` nor a matching `server` tag
 * (buzz-media's `verify_blossom_get_auth`, `MediaError::InsufficientScope`).
 * An `x` tag would mean minting (and, for ownerKeystoreSigner, prompting
 * for a passphrase) once per blob; `server` scopes the token to every blob
 * on one host instead, so one signed token covers a whole visit's worth of
 * avatars. This mirrors exactly what Buzz's own desktop client sends
 * (`sign_blossom_get_auth_header` in buzz-desktop's commands/media.rs) --
 * not a vouchd invention, the one shape this server is known to accept.
 *
 * One token per (signer, server host), reused until near expiry: caches a
 * signed artifact across calls, which passphraseProvider.ts's signer
 * deliberately never does -- but what's cached here is a short-lived,
 * read-only bearer token, never the passphrase or the secret it decrypts.
 * ownerKeystoreSigner itself still asks fresh, and still forgets, on every
 * call.
 */

import type { EventTemplate } from "./events/types";
import type { SignedEvent } from "./relayMessages";
import type { SignEvent } from "../signer/nip07Signer";

const KIND_BLOSSOM_AUTH = 24242;

/** How long a minted token is accepted -- BUD-11 requires *some* expiration, not this specific window. */
const TOKEN_TTL_SECONDS = 60;

/** How long the shared, server-scoped token (see module docblock) is reused
 *  before re-signing. Longer than TOKEN_TTL_SECONDS on purpose: one
 *  passphrase prompt should cover a whole visit's worth of avatars, not
 *  expire mid-render. */
const SHARED_AUTH_TTL_SECONDS = 300;

/** A BUD-11 `get` authorization, scoped to every blob on `server` (host[:port], no scheme). */
export function buildBlobGetAuth(server: string, createdAt: number): EventTemplate {
  return {
    kind: KIND_BLOSSOM_AUTH,
    tags: [
      ["t", "get"],
      ["expiration", String(createdAt + TOKEN_TTL_SECONDS)],
      ["server", server],
    ],
    content: "vouchd: fetch a profile picture",
    created_at: createdAt,
  };
}

/** Base64url per BUD-11: standard base64, then made URL-safe and unpadded, as JWTs do. */
function base64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The `Authorization: Nostr <token>` header value BUD-11 defines. */
export function blobAuthHeader(signed: SignedEvent): string {
  return `Nostr ${base64Url(JSON.stringify(signed))}`;
}

let sharedAuth: { signer: SignEvent; server: string; signed: SignedEvent; expiresAt: number } | undefined;

/**
 * One get-auth token per (signer, server host), reused until it's near
 * expiry (module docblock has the why). Keyed by the signer's own identity
 * too, not just the host: useCommunityConnection hands out a fresh
 * `ownerKeystoreSigner` closure per connect(), so switching identity
 * invalidates the old token for free.
 */
async function sharedGetAuth(sign: SignEvent, server: string): Promise<SignedEvent> {
  const now = Math.floor(Date.now() / 1000);
  if (sharedAuth && sharedAuth.signer === sign && sharedAuth.server === server && sharedAuth.expiresAt > now) {
    return sharedAuth.signed;
  }
  const signed = await sign(buildBlobGetAuth(server, now));
  sharedAuth = { signer: sign, server, signed, expiresAt: now + SHARED_AUTH_TTL_SECONDS };
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
    const signed = await sharedGetAuth(sign, new URL(url).host);
    const response = await fetch(url, { headers: { Authorization: blobAuthHeader(signed) } });
    if (!response.ok) return undefined;
    return URL.createObjectURL(await response.blob());
  } catch {
    return undefined;
  }
}
