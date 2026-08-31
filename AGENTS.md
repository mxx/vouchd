# vouchd — how we write code here

Two rules. Both are enforced, not aspirational: rule 2 by
`scripts/check-function-length.mjs` (wired into `npm run check`), rule 1 by
review. They are meant to reinforce each other — see "Why the two rules
don't fight" at the bottom.

---

## Rule 1 — Code is the documentation

There is no separate document that explains what this code does. The code
explains itself, or it isn't finished. Concretely, that means:

**Every module opens with a docblock stating its responsibility and its
boundary.** Not a restatement of the filename — the thing a reader can't
infer from the code below it. `src/protocol/nipOA.ts` is the reference
example: it says what the module does, where the spec lives, why it's
hand-written TypeScript instead of compiled from the Rust SDK, and — most
importantly — that minting requires a raw secret key in page memory, which
is the one fact a reader must not miss.

**Comments explain why, never what.** The code already says what. A comment
that says what is noise that rots. A comment that says why is the only place
that information exists at all:

```ts
// Deliberately NOT using nostr-tools' SimplePool here even though it's a
// dependency: SimplePool manages multiple relays with shared assumptions
// this app's per-community connection model may not want.
```

That comment is load-bearing. Delete it and the next person "fixes" the code
by adding SimplePool.

**Names are the primary documentation.** `computeAuthTag` /
`satisfiesConditions` / `ownerKeystore` need no gloss. If a name needs a
comment to be understood, rename it instead of commenting it.

**Types encode invariants.** `AuthTag` is a 4-tuple with named positions,
not `string[]`. No `any`. Where a string has a shape (64-hex pubkey), the
validator that enforces it lives next to the type and runs at the boundary.

**Decisions that look arbitrary carry a one-line rationale.** Every "why is
it like this?" a reader could reasonably ask should already be answered in
place. If the answer is long, it goes in `docs/ARCHITECTURE.md` and the code
points at it.

**Absence is documented too.** `src/features/bridge/README.md` exists to say
the bridge is deliberately not built and why. A missing thing with no
explanation reads as an oversight; a missing thing with a reason reads as a
decision.

**Tests are executable documentation.** Test names state the property, not
the mechanics: `"rejects self-attestation"`, `"accepts empty conditions (no
constraints — an indefinite grant)"`. A reader should be able to learn the
protocol's rules by reading the test file.

---

## Rule 2 — No function over 40 lines

Counted as the function body, **excluding blank lines and comment-only
lines**. Enforced by `npm run check:fn`.

When a function crosses the line, the fix is extraction, not compression:
pull out the named sub-step (`assertHex64`, `parseCanonicalDecimal`,
`parseClause`) — each extraction is also a naming opportunity, which serves
rule 1. Never "fix" it by deleting comments or collapsing lines; that trades
a real quality (readability) for a proxy metric.

If a function genuinely cannot be split — a flat dispatch table, an
exhaustive `switch` over protocol kinds — say so in a comment above it and
raise the case in review rather than silently disabling the check. The
escape hatch is a conversation, not a config flag.

---

## Why the two rules don't fight

A line budget usually punishes documentation: writers delete comments to fit
the limit. That's why the counter ignores blank and comment-only lines. You
can write as much explanation as the code deserves and it costs you nothing
against rule 2. The 40 lines are for *logic* — and 40 lines of logic that
needs 30 lines of explanation is usually two functions wearing a trench
coat.
