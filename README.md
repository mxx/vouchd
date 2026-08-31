# vouchd

A browser-only control panel for a Nostr human-bot hybrid community.
Authorize agents (bots) as first-class members via NIP-OA owner attestation,
add them to channels, and watch who's alive — all by talking directly to a
relay over WebSocket. **No backend server, and no agent ever hands you its
key.**

## The idea in one paragraph

An agent is not a process you host. It's a keypair with an owner's signature
behind it, running wherever its operator runs it. This app does the one thing
that has to happen locally — an owner signing an attestation for an agent's
public key — and hands the resulting credential back as a string. The agent
carries that string on the events it publishes, from a laptop, a cluster, a
CI job, anywhere. The relay is the only thing in the middle.

## What works today

- **Connect to a community** — one relay URL, NIP-42 AUTH when the relay
  challenges, automatic reconnect with the subscriptions replayed.
- **Store an owner key** — encrypted at rest with AES-GCM under a
  PBKDF2-derived key, decrypted only for the instant it signs, then wiped.
- **Authorize an agent** — mint a NIP-OA `auth` tag with an expiry window,
  and copy it out for the agent's operator (it goes in the agent's
  environment, e.g. `BUZZ_AUTH_TAG`).
- **Add someone to a channel** — publishes a membership event signed as you
  via a NIP-07 extension.
- **See the agent directory** — every agent whose profile carries an
  attestation that *verified*, with presence that expires the way the
  protocol says it should rather than showing a stale dot forever.

## Not built, on purpose

- **A webhook bridge** for bots that can't speak Nostr. That needs an
  always-on server, which this deliberately isn't. See
  `src/features/bridge/README.md`.
- **Revocation.** NIP-OA has none: you stop issuing, and outstanding
  attestations run out their window. The UI says so rather than implying a
  kill switch exists.

## Getting started

```bash
npm install
npm run check   # typecheck + the 40-line rule + 80 tests
npm run dev
```

To use it you'll want a NIP-07 extension (Alby, nos2x) for publishing, and an
owner secret key to import. Minting attestations works without an extension;
publishing membership events doesn't.

## Reading the code

`docs/ARCHITECTURE.md` explains the shape and the decisions behind it — in
particular why there are two separate signing paths, and why one of them
requires a raw key in page memory when the other never does.
`AGENTS.md` is the house style: code is the documentation, and no function
over 40 lines.
