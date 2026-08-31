# features/presence/

Empty by design — a signpost, not a stub.

Presence has no feature of its own: the logic that matters is the TTL rule in
`src/readmodel/presence.ts` (pure, tested), and it renders inside the agent
directory in `src/features/agents/AgentsPanel.tsx`. A separate "presence
panel" would be a screen showing dots with nothing to do.
