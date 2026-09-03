/**
 * Display-only string formatting shared across panels. Was four identical
 * private `shortKey` copies (AgentsPanel, MembershipPanel, ChannelDetailPanel,
 * AuditPanel) -- pulled out once a fifth call site (PubkeyChip) made the
 * duplication worth naming instead of copying again.
 */

/** A pubkey truncated for display -- never for comparison or storage. */
export function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
}
