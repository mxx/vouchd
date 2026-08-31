/**
 * The day-to-day signer: a browser extension implementing NIP-07.
 *
 * Everything this app publishes as its own identity goes through here, and
 * nothing here ever sees a raw secret key — the extension holds it and
 * returns signed events. That is the whole point of preferring this path.
 *
 * What it deliberately cannot do: mint a NIP-OA `auth` tag. NIP-07 exposes
 * `signEvent`, which signs a *Nostr event*; the NIP-OA credential is a raw
 * Schnorr signature over `nostr:agent-auth:<pubkey>:<conditions>`, which is
 * not an event and has a different preimage. You cannot smuggle it through
 * `signEvent` by wrapping it in a fake event — the hash the extension signs
 * would be the event's id, not the NIP-OA preimage, and the resulting tag
 * would verify against nothing. That gap is why src/signer/ownerKeystore.ts
 * exists; it is not an oversight to be optimized away later.
 */

import type { EventTemplate } from "../protocol/events/types";
import type { SignedEvent } from "../protocol/relayMessages";

export class Nip07Error extends Error {}

/** The subset of the NIP-07 provider this app uses. */
export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<SignedEvent>;
}

/** Anything that can turn an unsigned template into a signed event. */
export type SignEvent = (template: EventTemplate) => Promise<SignedEvent>;

function provider(): Nip07Provider {
  const injected = (globalThis as { nostr?: Nip07Provider }).nostr;
  if (!injected) {
    throw new Nip07Error(
      "no NIP-07 extension found — install one (Alby, nos2x, …) and reload",
    );
  }
  return injected;
}

/** True when an extension is present. Use it to gate UI, not to skip errors. */
export function hasNip07(): boolean {
  return Boolean((globalThis as { nostr?: Nip07Provider }).nostr);
}

export async function getPublicKey(): Promise<string> {
  try {
    return await provider().getPublicKey();
  } catch (error) {
    // A rejection here is usually the user declining the extension's prompt,
    // which is a normal answer, not a failure of this app.
    throw new Nip07Error(`extension did not return a public key: ${(error as Error).message}`);
  }
}

export const signEventWithNip07: SignEvent = async (template) => {
  try {
    return await provider().signEvent(template);
  } catch (error) {
    throw new Nip07Error(`extension declined to sign: ${(error as Error).message}`);
  }
};
