/**
 * Loads one image through Blossom's BUD-11 get-auth when a signer is
 * available -- see protocol/blossom.ts for why a plain `<img src>` 401s
 * against this relay's media host. Always revokes its own object URL when
 * the source changes or the caller unmounts, since nothing else ever will.
 *
 * `failed` is its own field, not folded into `src: undefined`, so a caller
 * can tell "nothing to show" (no picture, or no signer yet) apart from
 * "there's a picture and we tried, but this relay's media host won't serve
 * it to a browser" -- known to happen for buzz.fudu.space specifically: its
 * BUD-11-authorized GET works from curl but its CORS preflight never sends
 * back Access-Control-Allow-Origin, so the browser refuses the real
 * request before this app's code ever sees a response. That's a server
 * config gap outside this app's control, not something a retry fixes.
 */

import { useEffect, useState } from "react";
import { fetchAuthorizedBlob } from "../protocol/blossom";
import type { SignEvent } from "../signer/nip07Signer";

export interface AuthorizedImage {
  src: string | undefined;
  failed: boolean;
}

const NOT_LOADED: AuthorizedImage = { src: undefined, failed: false };

export function useAuthorizedImage(
  url: string | undefined,
  sign: SignEvent | undefined,
): AuthorizedImage {
  const [image, setImage] = useState<AuthorizedImage>(NOT_LOADED);

  useEffect(() => {
    setImage(NOT_LOADED);
    if (!url || !sign) return;
    let live = true;
    let created: string | undefined;

    void fetchAuthorizedBlob(url, sign).then((result) => {
      if (!live) {
        if (result) URL.revokeObjectURL(result);
        return;
      }
      created = result;
      setImage({ src: result, failed: result === undefined });
    });

    return () => {
      live = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, sign]);

  return image;
}
