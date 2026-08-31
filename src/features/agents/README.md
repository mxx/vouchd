# features/agents/

The core of the product: an owner vouching for an agent, and the directory of
who has been vouched for.

- `registerAgent.ts` — the use case. Unlocks the owner key just long enough
  to sign, mints the tag, returns it. Generates no key, publishes nothing.
- `conditionsBuilder.ts` — turns "valid for 90 days" into a NIP-OA
  conditions string and back into words, including the caveat that an expiry
  binds well-behaved verifiers, not a compromised agent.
- `OwnerKeyPanel.tsx` — import/encrypt/forget the owner key.
- `RegisterAgentPanel.tsx` — mint an attestation and hand it over as a string.
- `AgentsPanel.tsx` — agents observed on the relay, with live presence.
  Shows agents anyone authorized, not just ones minted here.
