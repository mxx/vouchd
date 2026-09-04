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

## Relationship to Buzz

vouchd is inspired by Buzz, a Nostr human-bot hybrid relay/platform, and
speaks NIP-OA -- Buzz's own custom NIP for owner attestation -- along
with a few of Buzz's custom event kinds where a standard one doesn't
exist. It is a separate, standalone client, not a fork: it never modifies
`buzz-relay`, `buzz-desktop`, `buzz-core`, or `buzz-sdk`, and does not
assume it's the only client talking to a given community. See
`docs/ARCHITECTURE.md`'s "Not a fork of Buzz" section for the full
boundary between the two.

## Provenance

Every line of code in this repository was written by Claude (Anthropic),
directed and reviewed turn by turn by its owner -- not generated once from a
prompt and left alone. The architecture, the two house rules in `AGENTS.md`
(code as documentation, no function over 40 lines), and every tradeoff
recorded in `docs/ARCHITECTURE.md` were decisions made explicitly, checked
against the actual Buzz source and the real NIP-OA spec, not left to the
model's discretion. This app custodies an owner's secret key, even if only
briefly and in memory -- if you're evaluating whether to trust it with a
real one, read `docs/ARCHITECTURE.md` and `AGENTS.md` first, and treat this
note as a reason to look closer, not a reason to skip looking.

## What's implemented

Tracked in `CHANGELOG.md` rather than as a bullet list here, so it stays a
record of what changed and why instead of a snapshot that quietly goes
stale the next time a feature is added.

## Not built, on purpose

- **A webhook bridge** for bots that can't speak Nostr. That needs an
  always-on server, which this deliberately isn't. See
  `src/features/bridge/README.md`.
- **Revocation.** NIP-OA has none: you stop issuing, and outstanding
  attestations run out their window. The UI says so rather than implying a
  kill switch exists.

## Known limitations

- **Profile pictures depend on the relay's media host sending CORS headers,
  or on a browser extension that relaxes CORS for you.** Blossom media hosts
  (BUD-11) can require a signed `Authorization: Nostr <token>` on every image
  fetch, and a relay that turns this on but doesn't also answer the preflight
  with `Access-Control-Allow-Origin` leaves the browser refusing the real GET
  before this app's code ever sees a response -- a server-side config gap,
  not something client-side code can route around (see
  `src/app/useAuthorizedImage.ts`'s docblock). A CORS-relaxing extension in
  your own browser (e.g. "CORS Unblock") works around this for you locally;
  it fixes nothing for anyone else, and isn't something vouchd ships,
  installs, or configures on your behalf. The token itself also has to be
  scoped the way the specific relay's media host expects -- see
  `src/protocol/blossom.ts`'s docblock and `CHANGELOG.md` for buzz.fudu.space's
  own (stricter-than-BUD-11-spec) requirement.

## Getting started

```bash
npm install
npm run check   # typecheck + the 40-line rule + unit tests
npm run dev
```

To use it you'll want a NIP-07 extension (Alby, nos2x) for publishing, and an
owner secret key to import. Minting attestations works without an extension;
publishing membership events doesn't.

## Release

A release is one directly-openable HTML file:

```bash
npm ci
npm run check
npm run build
```

Distribute `dist/index.html` as-is. A recipient can double-click that file, or
the same file can be uploaded to any static host. The repository-root
`index.html` is Vite's source entry and will not work when opened directly.

The GitLab pipeline runs the checks and builds on merge requests and the
default branch, but it has no deployment job: a successful pipeline verifies
the release file; it does not publish it anywhere.

### Local CORS extension workaround

If profile pictures fail because a Blossom media host does not return the
required CORS headers, a browser extension that relaxes CORS (for example,
"CORS Unblock") can make them load for that browser only:

1. Install an extension you trust and inspect the site-access permissions it
   requests.
2. If opening `dist/index.html` from disk, enable the extension's "Allow access
   to file URLs" setting.
3. Enable the workaround, reload vouchd, and disable it again when finished.

Keep the extension off during unrelated or sensitive browsing; CORS extensions
may have permission to inspect or modify traffic across many sites. If the
extension supports a site allowlist, limit it to the affected Blossom media
host. This workaround does not repair the server for other users. A NIP-07
signing extension also needs its own file-URL access enabled; that is separate
from relaxing CORS.

## Reading the code

`docs/ARCHITECTURE.md` explains the shape and the decisions behind it — in
particular why there are two separate signing paths, and why one of them
requires a raw key in page memory when the other never does.
`AGENTS.md` is the house style: code is the documentation, and no function
over 40 lines.
