/**
 * The relay's own NIP-11 self-description for the current connection, if it
 * serves one -- see protocol/nip11.ts for why this fails silently instead
 * of surfacing an error state.
 */

import { useEffect, useState } from "react";
import { fetchRelayInfo, type RelayInfo } from "../protocol/nip11";

export function useRelayInfo(relayUrl: string | null, connected: boolean): RelayInfo | null {
  const [info, setInfo] = useState<RelayInfo | null>(null);

  useEffect(() => {
    if (!connected || !relayUrl) {
      setInfo(null);
      return;
    }
    let live = true;
    void fetchRelayInfo(relayUrl).then((next) => live && setInfo(next));
    return () => {
      live = false;
    };
  }, [relayUrl, connected]);

  return info;
}
