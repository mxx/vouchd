/**
 * Which identity the browser extension is offering, if any.
 *
 * Asked once on mount rather than on every action: `getPublicKey()` can
 * prompt the user, and a component that re-asked on each render would turn a
 * one-time permission into a nagging loop.
 */

import { useEffect, useState } from "react";
import { getPublicKey, hasNip07 } from "../signer/nip07Signer";

export interface Nip07State {
  available: boolean;
  pubkey: string | null;
  error: unknown;
}

export function useNip07(): Nip07State {
  const [state, setState] = useState<Nip07State>({
    available: hasNip07(),
    pubkey: null,
    error: null,
  });

  useEffect(() => {
    if (!hasNip07()) return;
    let live = true;
    void getPublicKey()
      .then((pubkey) => live && setState({ available: true, pubkey, error: null }))
      .catch((error) => live && setState({ available: true, pubkey: null, error }));
    return () => {
      live = false;
    };
  }, []);

  return state;
}
