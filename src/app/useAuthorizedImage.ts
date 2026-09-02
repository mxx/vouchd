/**
 * Loads one image through Blossom's BUD-11 get-auth when a signer is
 * available -- see protocol/blossom.ts for why a plain `<img src>` 401s
 * against this relay's media host. Returns undefined until (or unless) the
 * signed fetch succeeds, and always revokes its own object URL when the
 * source changes or the caller unmounts, since nothing else ever will.
 */

import { useEffect, useState } from "react";
import { fetchAuthorizedBlob } from "../protocol/blossom";
import type { SignEvent } from "../signer/nip07Signer";

export function useAuthorizedImage(
  url: string | undefined,
  sign: SignEvent | undefined,
): string | undefined {
  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    setObjectUrl(undefined);
    if (!url || !sign) return;
    let live = true;
    let created: string | undefined;

    void fetchAuthorizedBlob(url, sign).then((result) => {
      if (!live) {
        if (result) URL.revokeObjectURL(result);
        return;
      }
      created = result;
      setObjectUrl(result);
    });

    return () => {
      live = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, sign]);

  return objectUrl;
}
