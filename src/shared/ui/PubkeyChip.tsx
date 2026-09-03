/**
 * A pubkey rendered as a small rounded "bubble" instead of plain inline
 * text, for the exact spot a table cell used to fall back to a bare
 * truncated key when no display name was known -- that fallback used to
 * look like an unstyled name, which misrepresented "we don't know who this
 * is" as an ordinary label. The full pubkey stays reachable via the native
 * `title` tooltip, same mechanism the old plain-text fallback relied on.
 */

import { shortKey } from "../format";

export function PubkeyChip({ pubkey }: { pubkey: string }) {
  return (
    <span className="pubkey-chip" title={pubkey}>
      {shortKey(pubkey)}
    </span>
  );
}
