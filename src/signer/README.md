# signer/

The only directory where secret key material touches this app. Two paths,
deliberately separate — see docs/ARCHITECTURE.md "the one hard problem."

- `nip07Signer.ts` — day-to-day event signing via `window.nostr`. Never sees
  a raw secret key. Everything this app publishes as its own identity goes
  here.
- `ownerKeystore.ts` — the owner's secret key, AES-GCM encrypted at rest
  under a PBKDF2-derived key. There is no `unlock()`: the only route to the
  plaintext is `withOwnerSecret()`, which wipes the bytes in a `finally`.
  It exists because NIP-OA attestation is a raw Schnorr signature over a
  non-event preimage, which NIP-07 cannot produce.
- `indexedDbStorage.ts` — its own database, never the read model's. Losing
  the read model is a routine recovery; losing this is not.
