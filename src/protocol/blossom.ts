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
 */

import type { EventTemplate } from "./events/types";
import type { SignedEvent } from "./relayMessages";
import type { SignEvent } from "../signer/nip07Signer";

const KIND_BLOSSOM_AUTH = 24242;

/** How long a minted token is accepted -- BUD-11 requires *some* expiration, not this specific window. */
const TOKEN_TTL_SECONDS = 60;

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

/**
 * Signs a fresh get-auth token and fetches one blob with it, handing back
 * an object URL the caller owns (and must revoke -- see useAuthorizedImage,
 * the one caller). Undefined on any failure: a picture is decoration, never
 * worth surfacing an error banner over.
 */
export async function fetchAuthorizedBlob(url: string, sign: SignEvent): Promise<string | undefined> {
  try {
    const template = buildBlobGetAuth(sha256FromUrl(url), Math.floor(Date.now() / 1000));
    const signed = await sign(template);
    const response = await fetch(url, { headers: { Authorization: blobAuthHeader(signed) } });
    if (!response.ok) return undefined;
    return URL.createObjectURL(await response.blob());
  } catch {
    return undefined;
  }
}
