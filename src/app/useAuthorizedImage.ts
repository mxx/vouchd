/**
 * Loads one image through Blossom's BUD-11 get-auth when a signer is
 * available -- see protocol/blossom.ts for why a plain `<img src>` 401s
 * against this relay's media host. Always revokes its own object URL when
 * the source changes or the caller unmounts, since nothing else ever will.
 *
 * `failed` is its own field, not folded into `src: undefined`, so a caller
 * can tell "nothing to show" (no picture, or no signer yet) apart from
 * "there's a picture and we tried, but this relay's media host refused
 * it" -- a browser without CORS support for this host, a token this
 * server's BUD-11 check rejects, or any other fetch failure all land here
 * the same way (fetchAuthorizedBlob swallows the specific cause; see its
 * docblock). Deliberately not diagnosed further in the UI: the causes are a
 * moving target as this relay's media host changes, and a wrong guess is
 * worse than none.
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
