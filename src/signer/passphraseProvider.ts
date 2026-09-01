/**
 * The interface between "a signer needs the owner's passphrase" and
 * "however this app currently asks for one" -- decoupled so today's plain
 * `<input type="password">` prompt (src/app/useOwnerPassphrasePrompt.ts) can
 * later be replaced or supplemented (e.g. a QR-code-based input device)
 * without touching any signing code that depends on this module.
 *
 * `ownerKeystoreSigner` is the other half: it turns an `OwnerKeystore` plus
 * a `PassphraseProvider` into a plain `SignEvent`, so call sites (relay
 * AUTH, day-to-day publish -- see src/app/useCommunityConnection.ts) don't
 * know or care that a human has to type something first. It asks fresh on
 * every call, never caching a passphrase across signs -- the same
 * decrypt-per-operation discipline `OwnerKeystore` itself enforces
 * (src/signer/ownerKeystore.ts), extended to the layer that asks the human
 * for it.
 */

import { finalizeEvent } from "nostr-tools/pure";
import type { EventTemplate } from "../protocol/events/types";
import type { SignedEvent } from "../protocol/relayMessages";
import type { SignEvent } from "./nip07Signer";
import type { OwnerKeystore } from "./ownerKeystore";

/** What a passphrase prompt needs to show: why it's asking, nothing more. */
export interface PassphraseRequest {
  reason: string;
}

/** Resolves with the passphrase the human typed, or rejects if they decline. */
export type PassphraseProvider = (request: PassphraseRequest) => Promise<string>;

/**
 * A `SignEvent` backed by the owner's encrypted key instead of a NIP-07
 * extension. Each call prompts fresh -- if `requestPassphrase` rejects (the
 * human cancelled, or isn't there to answer), this rejects too, which is
 * what lets an unattended auto-reconnect's AUTH attempt fail cleanly into
 * `RelayClient`'s existing `authRejected` handling instead of needing
 * bespoke failure plumbing here.
 */
export function ownerKeystoreSigner(
  keystore: OwnerKeystore,
  requestPassphrase: PassphraseProvider,
  reason: string,
): SignEvent {
  return async (template: EventTemplate): Promise<SignedEvent> => {
    const passphrase = await requestPassphrase({ reason });
    return keystore.withOwnerSecret(passphrase, (secret) => finalizeEvent(template, secret));
  };
}
