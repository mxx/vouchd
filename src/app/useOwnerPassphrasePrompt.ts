/**
 * The React side of `PassphraseProvider` (src/signer/passphraseProvider.ts):
 * holds at most one pending request as state, so `<PassphrasePrompt>` has
 * something to render, and resolves/rejects the caller's promise when the
 * human submits or cancels.
 *
 * At most one prompt is ever on screen. A slow human and a fast auto-
 * reconnect can legitimately race -- the relay's AUTH challenge times out
 * server-side and a second `RelayClient` reconnect attempt calls
 * `requestPassphrase` again before the first prompt was answered. Rather
 * than stacking a second modal over the first (confusing, and pointless --
 * both calls want the same passphrase for the same owner key), a request
 * already in flight is handed back verbatim: every caller waiting on it
 * settles together, from the one answer the human actually gives.
 */

import { useCallback, useRef, useState } from "react";
import type { PassphraseProvider, PassphraseRequest } from "../signer/passphraseProvider";

/** What `<PassphrasePrompt>` needs: the request, and how to answer it. */
export interface PendingPassphraseRequest extends PassphraseRequest {
  submit: (passphrase: string) => void;
  cancel: () => void;
}

export interface OwnerPassphrasePrompt {
  /** Null when nothing is asking for a passphrase right now. */
  pending: PendingPassphraseRequest | null;
  requestPassphrase: PassphraseProvider;
}

export function useOwnerPassphrasePrompt(): OwnerPassphrasePrompt {
  const [pending, setPending] = useState<PendingPassphraseRequest | null>(null);
  const inFlight = useRef<Promise<string> | null>(null);

  const requestPassphrase = useCallback((request: PassphraseRequest): Promise<string> => {
    if (inFlight.current) return inFlight.current;
    const promise = new Promise<string>((resolve, reject) => {
      const settle = (run: () => void) => {
        inFlight.current = null;
        setPending(null);
        run();
      };
      setPending({
        ...request,
        submit: (passphrase) => settle(() => resolve(passphrase)),
        cancel: () => settle(() => reject(new Error("passphrase entry cancelled"))),
      });
    });
    inFlight.current = promise;
    return promise;
  }, []);

  return { pending, requestPassphrase };
}
