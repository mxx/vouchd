# TODO

Ideas and follow-ups not yet scheduled. Unlike `CHANGELOG.md` (a past-tense
record of what shipped) and `docs/ARCHITECTURE.md` (why the app is shaped
the way it is today), this file is future-tense and allowed to go stale --
prune entries once they're done or abandoned.

## Owner key import via NIP-AB device pairing

Right now `OwnerKeyPanel.tsx` only accepts a pasted secret (hex, `nsec1...`,
or an already-encrypted `ncryptsec1...`). Worth adding a second import path:
scan a QR code from a paired device (e.g. buzz) instead of typing/pasting
the raw key.

Spec: `block/buzz`, `crates/buzz-core/src/pairing/NIP-AB.md` (+
`NIP-AB.spthy` Tamarin model). Status there is `draft` `optional` -- this is
buzz's own candidate protocol, not an accepted nostr-protocol/nips entry
yet, and only buzz-core implements it so far. Adopting it here is really
about "get a key from buzz into vouchd safely," not "support a
widely-interoperable standard."

Why it fits vouchd specifically:

- vouchd only needs the **target** role (scan QR, never generates one) --
  buzz is the source and already does the QR-display/offer-acceptance half.
- The `nsec` payload type is defined as NIP-49 `ncryptsec1...` (recommended)
  or `nsec1...` -- both already accepted verbatim by
  `OwnerKeystore.store()` / `decodeSecretKeyInput` / `isEncryptedSecretKey`.
  So the wire-up is: decrypt payload -> pass the string to `store()`
  unchanged. No storage-layer changes.
- Crypto/transport pieces already in the dependency tree: `@noble/curves`
  (ephemeral keypair + ECDH, already used for schnorr pubkeys in
  `ownerKeystore.ts`), `@noble/hashes` (HKDF), `nostr-tools/nip44`
  (in package.json via nostr-tools@2.23.3, not yet imported anywhere --
  `grep nip44 src` is currently empty), and `relayClient.ts`'s generic
  `subscribe(filters)` / `publish(event)` for the new `kind:24134` events.

Net-new work: QR scan UI (camera + decode, plus a paste-the-URI fallback
for no-camera browsers), the SAS display/confirm-deny UI, and the pairing
state machine itself (offer -> sas-confirm -> payload -> complete/abort,
with the 120s session / 30s per-step timeouts). The spec's pseudocode and
test vectors (`session_secret`/`sas_code`/`transcript_hash` fixed values)
can validate the crypto layer before wiring up UI.

Watch out for: the ECDH output NIP-AB wants is the **unhashed** x-only
shared point -- confirm what `@noble/curves`' `getSharedSecret` actually
returns before relying on it, since many secp256k1 bindings hash by
default and the spec calls this out explicitly as a common bug.
