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

## The one hard problem: two signing operations, one chosen identity

Most Nostr apps have exactly one signing story ("call `window.nostr.signEvent`").
This app has two operations that need a signature, and they are not
symmetric — one of them can legitimately go through either of two signing
*capabilities*, and the other can only ever go through one:

1. **Day-to-day event signing** — relay AUTH (NIP-42) and every event this
   app publishes as its own pubkey (a member-add, a profile update, …).
   Either signing capability can do this: a NIP-07 extension, or
   `OwnerKeystore` producing a normal `finalizeEvent`-signed event from the
   decrypted owner key. **Which one is used is the owner's explicit choice
   per connection** (`CommunityPanel`'s "Sign in as" selector, wired through
   `useCommunityConnection.ts`'s `IdentitySource`), never an automatic
   preference — see "Why neither signer is preferred" below for why picking
   silently would be wrong even though NIP-07 sounds like the safer default.
2. **NIP-OA `auth` tag minting** (`src/protocol/nipOA.ts`) — this is a raw
   BIP-340 Schnorr signature over a *non-event* preimage
   (`nostr:agent-auth:<agent_pubkey>:<conditions>`). Standard NIP-07's
   `signEvent` cannot produce this — it only signs well-formed Nostr events.
   Minting therefore requires the **owner's raw secret key in page memory**
   for this one operation, with no alternative. `src/signer/ownerKeystore.ts`
   is the only place in this codebase where that secret key exists in
   plaintext; it should stay that way. Treat any change that lets owner
   secret material flow through any other module as a regression.

### Why neither signer is preferred

The instinct is to default day-to-day signing to NIP-07 whenever an
extension is present, since it never puts a raw key in this page's memory.
That instinct undersells NIP-07's own exposure: an installed extension holds
*standing* signing capability for as long as it's installed and unlocked —
an attacker who compromises this page (XSS, a poisoned dependency) can ask
it to sign anything, any time, for as long as the tab is open. `OwnerKeystore`
by contrast holds nothing between calls: `withOwnerSecret()` decrypts, signs,
and zeroes the bytes before returning, so the same compromise only gets a
window measured in one call, not the tab's whole lifetime.

Neither is strictly safer, so this app makes neither the default. The owner
picks, every time, which capability signs for a given connection.

### Two threats, and which of these defends against which

This distinction only matters once it's clear what's actually being
defended against, because the two designs below answer two different
threats:

- **A compromised page** (XSS, a poisoned dependency) — independent of who
  is legitimately operating this app. `OwnerKeystore`'s decrypt-per-operation
  discipline is the defense: it bounds *how long* a compromise can reach
  plaintext, to one call instead of a standing capability.
- **An unauthorized second operator** — someone other than the owner using
  this UI. This app assumes only the owner ever does (there's no multi-user
  concept here at all: whoever opens this page can read anything it can
  read, including, transiently, the owner's key), so this threat is out of
  scope by that premise, not defended against by a mechanism.

`OwnerKeystore`'s API is shaped for the first threat and only the first —
see its own header comment.

### Per-operation passphrase, never cached

Following from the same discipline: nothing in this app holds a passphrase
in memory between signs, even across several signs in the same minute.
`src/signer/passphraseProvider.ts`'s `ownerKeystoreSigner` asks fresh via a
`PassphraseProvider` on *every* call it makes, and `withOwnerSecret()` zeroes
the decrypted key in a `finally` every time — so an `OwnerKeystore`-backed
connection prompts for the passphrase on every AUTH and every publish, not
once per session. `src/app/useOwnerPassphrasePrompt.ts` is today's concrete
`PassphraseProvider`: a plain `<input type="password">` modal
(`src/shared/ui/PassphrasePrompt.tsx`). The `PassphraseProvider` interface
exists specifically so that a future input method (e.g. reading a passphrase
off a QR code) can replace or supplement it without touching any signer.

A prompt that goes unanswered (the owner stepped away during an unattended
auto-reconnect) is not new failure machinery: the signer's promise simply
never resolves until someone answers, or rejects if they cancel — and a
rejection there is indistinguishable, to `RelayClient`, from a NIP-07
extension declining to sign. Both land in the same `authRejected`-stops-
reconnect path documented in `relayClient.ts`'s own comments and in
`CHANGELOG.md` (the fix for the status flicker between `open` and `closed`).

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
  nip07Signer.ts      one signing capability; never sees a raw secret key
  ownerKeystore.ts    the other. NIP-49 (ncryptsec) at rest -- a real Nostr
                       standard, so an already-encrypted key from elsewhere
                       imports verbatim, no re-encrypt round trip. Only way
                       to the plaintext is withOwnerSecret(), wiped after.
  passphraseProvider.ts  ownerKeystoreSigner: OwnerKeystore + a passphrase
                       ask -> a plain SignEvent, so callers don't know a
                       human is involved. Never caches the passphrase.
  indexedDbStorage.ts  its own database, separate from the disposable one

src/readmodel/    local IndexedDB projection. Cache, not authority.
  projector.ts      pure: relay event -> mutations. An agent is recorded only
                     when its profile's auth tag *verifies*.
  presence.ts       the relay's own 180s TTL, applied locally so the UI can
                     never outlive the protocol's guarantee
  db.ts / queries.ts / records.ts   schema, reads, shapes

src/app/          composition. Session owns relay+projection; hooks adapt it
                   to React; App wires panels together and nothing more.
  useCommunityConnection.ts  builds the chosen signer (IdentitySource) and
                   owns the relay session's lifecycle.
  useOwnerPassphrasePrompt.ts  the concrete PassphraseProvider: one pending
                   request at a time, resolved/rejected by the human.

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

The entry is a normal event (`src/protocol/events/audit.ts`) signed through
whichever signing capability the connection is using -- NIP-07 or the
keystore, see "Two signing operations, one chosen identity" above -- never
by the keystore's *other*, raw-preimage signature that produced the minted
`auth` tag in the first place. It carries that same `auth` tag, so anyone
reading it can verify the attestation themselves rather than trusting the
claim. `readmodel/projector.ts` only records an entry when that embedded
tag verifies *and* the pubkey it recovers matches whoever actually signed
the audit event — otherwise someone could republish another owner's valid
tag inside their own audit entry. This is why the two signing capabilities
are expected to be the same owner identity, not two different people's: the
check would otherwise reject every audit entry signed by whichever
capability didn't mint the tag.

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
