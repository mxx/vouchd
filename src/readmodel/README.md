# readmodel/

Local IndexedDB projection of relay events. A CACHE, never the authority —
it must always be safe to drop and rebuild from a fresh subscription.

- `projector.ts` — pure: relay event in, mutations out. No database, no
  clock, no network, which is why its rules are exhaustively tested with
  plain objects. An agent is recorded only when its profile's NIP-OA tag
  actually verifies.
- `presence.ts` — pure: applies the relay's own 180s TTL, so a UI built on
  this can't show a dot the protocol has already disowned. Distinguishes
  "offline" (something the agent said) from "unknown" (we never heard).
- `db.ts` — schema and mutation application. Makes no decisions.
- `queries.ts` / `records.ts` — typed reads and shapes.
