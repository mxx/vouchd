/**
 * NIP-OA `<conditions>` clause grammar (docs/nips/NIP-OA.md in the Buzz repo).
 *
 * `<conditions>` is either the empty string, or `clause` / `clause&clause&...`.
 * Each clause is one of:
 *   - kind=<decimal>                 (0..=65535)
 *   - created_at<<unix-timestamp>    (0..=4294967295)
 *   - created_at><unix-timestamp>    (0..=4294967295)
 *
 * Rules that matter for correctness, not just style:
 * - No whitespace anywhere.
 * - No leading/trailing/double `&`, no empty clauses.
 * - Decimal encoding must be canonical: no leading zeros except a bare "0".
 * - Clause order is part of the signed preimage -- callers MUST NOT reorder,
 *   dedupe, or normalize a conditions string before signing or verifying.
 *   This module never does that; it only validates.
 */

export type Clause =
  | { type: "kind"; value: number }
  | { type: "created_at_lt"; value: number }
  | { type: "created_at_gt"; value: number };

export class ConditionsError extends Error {}

const KIND_MAX = 65535;
const TIMESTAMP_MAX = 4294967295;

function isCanonicalDecimal(raw: string): boolean {
  if (raw === "0") return true;
  return /^[1-9][0-9]*$/.test(raw);
}

function parseCanonicalDecimal(raw: string, max: number, label: string): number {
  if (!isCanonicalDecimal(raw)) {
    throw new ConditionsError(`${label}: not a canonical decimal: "${raw}"`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new ConditionsError(`${label}: out of range 0..=${max}: "${raw}"`);
  }
  return value;
}

function parseClause(raw: string): Clause {
  if (raw.length === 0) throw new ConditionsError("empty clause");
  if (/\s/.test(raw)) throw new ConditionsError(`whitespace not permitted: "${raw}"`);

  if (raw.startsWith("kind=")) {
    return { type: "kind", value: parseCanonicalDecimal(raw.slice(5), KIND_MAX, "kind=") };
  }
  if (raw.startsWith("created_at<")) {
    return {
      type: "created_at_lt",
      value: parseCanonicalDecimal(raw.slice(11), TIMESTAMP_MAX, "created_at<"),
    };
  }
  if (raw.startsWith("created_at>")) {
    return {
      type: "created_at_gt",
      value: parseCanonicalDecimal(raw.slice(11), TIMESTAMP_MAX, "created_at>"),
    };
  }
  throw new ConditionsError(`unsupported clause: "${raw}"`);
}

/**
 * Parse and validate a `<conditions>` string. Throws `ConditionsError` on
 * anything malformed. Returns `[]` for the empty string (no constraints).
 */
export function parseConditions(conditions: string): Clause[] {
  if (conditions === "") return [];
  if (conditions.startsWith("&") || conditions.endsWith("&") || conditions.includes("&&")) {
    throw new ConditionsError(`malformed separators: "${conditions}"`);
  }
  return conditions.split("&").map(parseClause);
}

/** Validate only; throws on malformed input, returns void on success. */
export function validateConditions(conditions: string): void {
  parseConditions(conditions);
}

/**
 * Evaluate parsed conditions against a candidate event. This is the
 * "verifiers MUST evaluate every clause" half of NIP-OA client behavior --
 * separate from signature verification (see nipOA.ts), because checking a
 * *signature* only proves the owner issued this tag for this agent+conditions
 * string; it says nothing about whether a specific later event satisfies it.
 */
export function satisfiesConditions(
  clauses: Clause[],
  event: { kind: number; created_at: number },
): boolean {
  return clauses.every((clause) => {
    switch (clause.type) {
      case "kind":
        return event.kind === clause.value;
      case "created_at_lt":
        return event.created_at < clause.value;
      case "created_at_gt":
        return event.created_at > clause.value;
    }
  });
}
