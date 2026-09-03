/**
 * A pubkey rendered as a small rounded "bubble" instead of plain inline
 * text. Originally for the spot a table cell fell back to a bare truncated
 * key when no display name was known -- that fallback looked like an
 * unstyled name, which misrepresented "we don't know who this is" as an
 * ordinary label. The bubble reads as a key either way, which is why
 * ChannelDetailPanel now shows one *next to* a name rather than instead of
 * it. The full pubkey stays reachable via the native `title` tooltip, same
 * mechanism the old plain-text fallback relied on.
 */

import { shortKey } from "../format";

export function PubkeyChip({ pubkey }: { pubkey: string }) {
  return (
    <span className="pubkey-chip" title={pubkey}>
      {shortKey(pubkey)}
    </span>
  );
}
