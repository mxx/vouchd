# features/audit/

Not built yet, and blocked on one decision rather than on effort.

The plan (docs/ARCHITECTURE.md) is to publish authorization actions as relay
events, so the relay is the shared, durable, cross-device audit log instead
of a local database that every operator's browser holds a different version
of. That needs a kind number assigned first — see `KIND_VOUCHD_AUDIT_TODO` in
`src/protocol/kinds.ts`. Pick one deliberately; don't invent one inside
feature code.
