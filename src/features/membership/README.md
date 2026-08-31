# features/membership/

Adding a pubkey to a channel — an ordinary membership act signed as *you*
(NIP-07), deliberately separate from minting an attestation.

Keeping them apart preserves an honest distinction: an agent can be trusted
by its owner and still not belong in your channel. Whether the publish is
accepted is the relay's call (`channel_add_policy`); refusals surface
verbatim rather than being pre-guessed here.
