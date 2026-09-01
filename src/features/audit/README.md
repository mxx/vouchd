# features/audit/

Publishes and displays vouchd's own audit trail (kind:7373, `KIND_AUDIT_LOG`
in `src/protocol/kinds.ts`) -- "owner X authorized/renewed agent Y at time T
under conditions C" -- as ordinary relay events. See "Why audit trail lives
on the relay, not in a local database" in `docs/ARCHITECTURE.md` for the
reasoning, and `src/protocol/events/audit.ts` for the event shape.

The UI lives in `AuditPanel.tsx`, wired into `App.tsx` against whichever
agent is currently "in focus" (see `App.tsx`'s `focusedAgent`) -- there is
no cross-agent feed yet, only per-agent history.

Deliberately not built: a "revoke" action. NIP-OA has no real revocation, so
a revoke event could only ever be a public notice ("I no longer vouch for
this agent"), not an enforced one -- see `conditionsBuilder.ts`'s
`EXPIRY_CAVEAT`. Worth adding once there's a UI affordance that means that,
but inventing one now, unasked, would be scope creep dressed as completeness.
