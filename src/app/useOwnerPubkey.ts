/**
 * Whose owner key is stored in this browser, if any.
 *
 * Lifted out of OwnerKeyPanel (which used to own this as local state) once
 * the stat bar also needed the same fact: reading it here once and passing
 * it down means both places show the same truth instead of each polling
 * the keystore independently and risking a render where they briefly
 * disagree.
 */

import { useCallback, useEffect, useState } from "react";
import type { OwnerKeystore } from "../signer/ownerKeystore";

export interface OwnerPubkeyState {
  ownerPubkey: string | null;
  /** Re-reads the keystore -- call after a store() or clear(). */
  refresh: () => void;
}

export function useOwnerPubkey(keystore: OwnerKeystore): OwnerPubkeyState {
  const [ownerPubkey, setOwnerPubkey] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void keystore.ownerPubkey().then(setOwnerPubkey);
  }, [keystore]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ownerPubkey, refresh };
}
