# vouchd — architecture

Browser-only control panel for a Nostr human-bot hybrid community. Registers
and authorizes agents (bots) as first-class members alongside humans, using
NIP-OA owner attestation. Talks directly to a relay (e.g. a Buzz relay) over
WebSocket. **No backend server for the core product.**

This document exists so the decisions made while designing this (long
back-and-forth, not reproduced here) aren't lost. If a decision below looks
arbitrary, it probably had a reason — check with whoever wrote it before
changing it silently.

## Non-goals / deliberate exclusions

- **Not a fork of Buzz.** This reads/writes the relay purely over standard
  Nostr protocol (NIP-01, NIP-42, NIP-OA, plus Buzz's own custom kinds where
  needed). It does not modify `buzz-relay` or `buzz-desktop`, and does not
  assume it's the only client talking to a given community.
- **Agents run wherever their operator wants.** This app never holds an
  agent's private key, never spawns or deploys an agent process, and has no
  concept of "where an agent runs." An agent is just a pubkey + a NIP-OA
  attestation from its owner. See `buzz/VISION_REMOTE_AGENTS.md` and
  `buzz/docs/remote-agents.md` §Launchers for why this is a legitimate,
  already-supported model at the protocol layer, independent of Buzz's own
  desktop-managed-agent feature.

## The one hard problem: two signing paths, not one

Most Nostr apps have exactly one signing story ("call `window.nostr.signEvent`").
This app has two, and mixing them up is a real security bug, not a style
choice:

1. **Day-to-day event signing** (publishing a member-add, a profile update,
   whatever this app itself does as its own pubkey) — goes through NIP-07
   (`src/signer/nip07Signer.ts`). The extension holds the key; this app never
   sees it.
2. **NIP-OA `auth` tag minting** (`src/protocol/nipOA.ts`) — this is a raw
   BIP-340 Schnorr signature over a *non-event* preimage
   (`nostr:agent-auth:<agent_pubkey>:<conditions>`). Standard NIP-07's
   `signEvent` cannot produce this — it only signs well-formed Nostr events.
   Minting therefore requires the **owner's raw secret key in page memory**
   for this one operation. `src/signer/ownerKeystore.ts` is the only place
   in this codebase where that secret key exists in plaintext; it should stay
   that way. Treat any change that lets owner secret material flow through
   any other module as a regression.

## Module map

```
src/protocol/     pure logic, no React, no UI state. Portable to a future
                   CLI tool for headless/bulk agent registration if needed.
  kinds.ts          event kind constants (source of truth: buzz-core/src/kind.rs)
  conditions.ts     NIP-OA <conditions> grammar: parse / validate / evaluate
  nipOA.ts          computeAuthTag / verifyAuthTag, against the spec's vectors
  relayMessages.ts  pure encode/decode of the NIP-01 wire frames
  relayClient.ts    socket, NIP-42 AUTH, subscriptions, publish. Signing is
                     injected, never imported.
  events/           tag-array builders for the kinds this app publishes:
                     membership (9000/9001/9021/9022), channel (9007),
                     profile (0), presence (20001), NIP-42 AUTH (22242),
                     the audit trail (7373, vouchd's own, not Buzz's), and
                     attachAuthTag for agents carrying an attestation.
                     Deliberately a subset of buzz-sdk's builders.rs.

src/signer/       the ONLY place secret material touches this app.
  nip07Signer.ts    day-to-day signing; never sees a raw secret key
  ownerKeystore.ts  AES-GCM at rest under a PBKDF2 key; the only way to the
                     plaintext is withOwnerSecret(), which wipes in a finally
  indexedDbStorage.ts  its own database, separate from the disposable one

src/readmodel/    local IndexedDB projection. Cache, not authority.
  projector.ts      pure: relay event -> mutations. An agent is recorded only
                     when its profile's auth tag *verifies*.
  presence.ts       the relay's own 180s TTL, applied locally so the UI can
                     never outlive the protocol's guarantee
  db.ts / queries.ts / records.ts   schema, reads, shapes

src/app/          composition. Session owns relay+projection; hooks adapt it
                   to React; App wires panels together and nothing more.

src/features/     communities/ (relay URL + status), agents/ (owner key,
                   minting, directory), membership/ (add to channel),
                   audit/ + bridge/ (see below).
```

## Why audit trail lives on the relay, not in a local database

A pure-browser app has no shared server-side database. Rather than accept
"every operator's browser has its own untrustworthy local audit log,"
authorization actions (owner X authorized agent Y at time T under conditions
C) are published as their own relay event, kind:7373 (`KIND_AUDIT_LOG` in
`src/protocol/kinds.ts` — see that file's comment for how the number was
chosen). This makes the relay the single shared, durable, cross-device audit
source — consistent with the rest of this ecosystem's philosophy that "the
relay was the management plane all along."

The entry is signed by the owner's day-to-day NIP-07 identity, not the
keystore (`src/protocol/events/audit.ts`), and carries the same `auth` tag
that was minted, so anyone reading it can verify the attestation themselves
rather than trusting the claim. `readmodel/projector.ts` only records an
entry when that embedded tag verifies *and* recovers the pubkey that
actually signed the event — otherwise someone could republish another
owner's valid tag inside their own audit entry.

Current UI limitation, not a protocol one: the audit panel only shows
history for the agent currently "in focus" (just minted, or clicked via
"re-authorize") — see `App.tsx`'s `focusedAgent` state. A full cross-agent
audit feed is possible (the events are all on the relay) but wasn't asked
for yet.

## Deployment

Static build (`npm run build` → `dist/`), deployable to any static host.
No server-side component required for the core product. Optionally, once
stable, the built assets could be served by a relay the same way Buzz's own
`admin-web`/`web` are (`ServeDir` + an env var pointing at the `dist/`
directory) — this is a packaging convenience decided later, not an
architectural dependency; nothing here assumes it.
