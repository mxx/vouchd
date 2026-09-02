# Changelog

Every entry here is a real, reviewed change -- not a commit-message dump.
`docs/ARCHITECTURE.md` is the present-tense snapshot of *why* the app is
shaped the way it is; this file is the past-tense record of *when* each
piece arrived, kept because "what does vouchd do today" used to live as a
bullet list in `README.md` and that list only ever grew stale.

## [Unreleased]

### Added

- The UI was reskinned to "Terminal Grid": a dark, monospace-forward console
  theme (hairline grid background, mint/cyan accents, corner-bracketed panels)
  in place of the old auto light/dark muted-green theme, plus a sidebar app
  shell (brand, jump links to every panel grouped by what they're actually for,
  the NIP-07 identity chip, a live stat bar of online/total agents, relay
  status and owner-key status). The sidebar's nav is anchor links into the
  same one-page layout, not a router -- every panel still renders together,
  same as before; a tab that hid the others would be fake affordance for a
  thing this app doesn't do.
- The shell is responsive down to phone widths: the sidebar collapses from a
  sticky full-height rail into a horizontal block above the content, the stat
  bar drops from four columns to two, and both scrolling tables (agents,
  audit trail) sit in their own horizontal-scroll container instead of
  squeezing the page.
- The app now speaks English or Simplified Chinese, switchable from a
  dropdown next to the page title and persisted in localStorage (no
  browser-language auto-detect -- see `src/i18n/LanguageContext.tsx` for why).
  A dropdown rather than a button per language, on purpose: `LANGUAGES`
  (`src/i18n/messages.ts`) is meant to grow past two, and each language's own
  name is shown in its own script via `LANGUAGE_LABELS`, not translated into
  whichever language is currently active. Every panel's UI copy moved into
  a `Messages` dictionary (`src/i18n/messages.ts`) that TypeScript checks both
  languages against, so a missing or mis-shaped translation fails `tsc -b`
  rather than rendering blank. Thrown `Error` messages from the protocol/signer
  layers are out of scope for this pass and remain English-only -- translating
  those needs error codes, not string translation, and is separate work.
- `conditionsBuilder.ts`'s `describeConditions` now takes the caller's
  `conditions` messages instead of owning English copy itself, keeping protocol
  logic (this module) from depending on i18n (the app layer) in the wrong
  direction.

- `OwnerKeystore`'s at-rest format is now NIP-49 (`ncryptsec1...`) instead of
  a bespoke PBKDF2+AES-GCM scheme -- a real Nostr standard other clients
  already export/import, so pasting an already-encrypted key now stores it
  verbatim (the passphrase is only checked, never re-applied through a
  second encryption layer). No migration from the old format: nothing built
  on it was ever released, so a leftover old-format record is simply treated
  as if no key were stored.
- The owner secret key field also accepts an `ncryptsec1...` import, in
  addition to hex and nsec; pasting one there routes to the keystore's new
  encrypted-import path rather than being decoded as a raw secret.
- The Community panel now asks which identity should sign for a connection
  ("Sign in as": browser extension, or the owner key) instead of always
  preferring NIP-07 when an extension happens to be present -- an installed
  extension is its own standing, un-auditable signing capability, not a
  strictly safer default, so the choice is the owner's every time, not this
  app's. The chosen signer covers both NIP-42 AUTH and every event this app
  publishes afterward, so a connection has exactly one identity.
- Owner-key-backed signing (relay AUTH, day-to-day publishing) now asks for
  the passphrase interactively, per operation, through a small modal
  (`PassphraseProvider` / `useOwnerPassphrasePrompt`) rather than caching it
  -- the same decrypt-per-operation discipline `OwnerKeystore` already
  applied to minting, extended to these two call sites. An unanswered or
  declined prompt fails the sign the same way a NIP-07 extension declining
  already did, so it stops auto-reconnect through the existing mechanism
  rather than needing new failure handling.
- Key inputs (agent pubkey, owner secret) now accept `npub1...`/`nsec1...`
  bech32 (NIP-19), not just raw hex -- every Nostr client displays npub/nsec,
  never hex, so requiring hex meant hand-converting before every paste.
  Passing a key to the wrong field (an nsec where a pubkey was expected, or
  the reverse) is now a clear error instead of a generic "not valid hex" one.
- The Community panel shows the relay's last NOTICE text, so a rejected
  NIP-42 AUTH (or any other relay-side refusal) has a visible reason instead
  of just an unexplained status change.
- `projectEvent()` now verifies a raw event's own signature (its `id`
  matches its canonical hash, and `sig` verifies against `pubkey`) before
  projecting it into the read-model, closing a gap where nothing in this
  codebase checked that at all -- a malformed or unsigned event previously
  projected exactly like a real one as long as its shape matched.

### Fixed

- A subscription sent the instant a socket opens, on a relay that requires
  AUTH for every REQ, used to be dropped for good: the relay closes it with
  `auth-required` before this client's own AUTH exchange finishes, and
  nothing ever resent it once AUTH succeeded -- the connection would settle
  into `status: authenticated` with an empty read-model and no visible
  error, because the rejection notice arrives and gets superseded by later,
  unrelated NOTICEs. `RelayClient` now retries exactly the subscriptions the
  relay bounced for lacking AUTH once AUTH actually succeeds, without
  resending subscriptions that were never rejected. Found via a real
  connection to a relay requiring auth for every REQ, not a hypothetical.
- `RelayClient` also stops auto-reconnecting when the *local* signer
  declines to sign the AUTH event -- a NIP-07 extension's prompt dismissed,
  or the extension self-locked after a prior dismissal -- not just when the
  relay's `OK` confirms a rejection. The signer throwing was previously
  indistinguishable from a plain network drop, so it kept retrying (and
  re-triggering the extension's own popup) on every backoff tick: the other
  half of the status flickering between `open` and `closed`.
- `RelayClient` no longer retries forever after the relay has *confirmed* an
  AUTH rejection (`OK ... false`) -- that identity was refused, not dropped,
  and retrying with the same credentials was never going to succeed. It
  previously reconnected with exponential backoff regardless of the reason a
  socket closed, which looked like the status flickering between `open` and
  `closed` with no explanation. A plain network drop still reconnects
  automatically; a confirmed AUTH rejection now stops and waits for the user
  to click Connect again.

## 2026-09-01

### Added

- Audit trail (kind `7373`, a regular/permanent Nostr kind, chosen by
  checking the live nostr-protocol/nips registry for a free slot): every
  `register`/`renew` mint publishes a signed entry, the read-model projects
  it only after re-verifying the embedded NIP-OA `auth` tag against the
  event's actual signer (closing a spoofing path where someone could
  otherwise republish a valid tag inside a self-authored audit entry), and
  the UI shows the history for whichever agent is currently in view.
- A live (network-touching) check that an owner-minted NIP-OA attestation
  round-trips against a real relay, kept deliberately out of `npm test` --
  see `tests/live/`.

### Fixed

- `RelayClient` no longer flips to `"authenticated"` the moment it *sends*
  the NIP-42 AUTH event -- it waits for the relay's `OK` to confirm the
  event was actually accepted, matching how every other published event is
  already confirmed.

## 2026-08-31

### Added

- Initial scaffold: connect to a relay by URL, with NIP-42 AUTH when the
  relay challenges and automatic reconnect that replays subscriptions.
- Store an owner key encrypted at rest (AES-GCM under a PBKDF2-derived key),
  decrypted only for the instant it signs an attestation, then wiped.
- Mint a NIP-OA `auth` tag for an agent's public key, with an expiry window,
  copyable for the agent operator's own environment (e.g. `BUZZ_AUTH_TAG`).
- Add a member to a channel, publishing a membership event signed as the
  owner via a NIP-07 browser extension.
- Agent directory: every agent whose profile carries an attestation that
  *verified*, with presence that expires the way the protocol says it
  should rather than showing a stale dot forever.
- Renewal (re-mint an existing agent's attestation) and channel creation,
  plus a smoke test that the app actually mounts.
