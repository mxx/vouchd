# protocol/events/

Tag-array builders for the kinds this app publishes. Each returns an unsigned
`EventTemplate` for a signer to finalize.

- `membership.ts` — add (9000), remove (9001), join (9021), leave (9022)
- `channel.ts` — create channel (9007)
- `profile.ts` — kind:0 (for the operator's own identity; this app never
  publishes an *agent's* profile, because it never holds an agent's key)
- `presence.ts` — kind:20001
- `auth.ts` — the NIP-42 AUTH event, optionally carrying a NIP-OA tag
- `authTag.ts` — attaching an attestation to an outgoing event (what an
  agent does, documented here for agent authors)

Deliberately a subset of `buzz-sdk/src/builders.rs`, not a port of it: NIP-07
signs any well-formed event regardless of shape. Add one when a feature needs
it, and confirm the kind number against the Rust source first.
