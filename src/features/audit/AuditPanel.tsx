/**
 * The audit trail for the agent currently in focus (the same pubkey the
 * "re-authorize" flow prefills, and the one a fresh mint brings into view)
 * -- a permanent history read from the relay, not a client-side log.
 *
 * Renders nothing until an agent is selected. That is not a loading state;
 * it is the correct steady state before an operator has picked someone to
 * look at.
 */

import type { AuditRecord } from "../../readmodel/records";
import { Panel } from "../../shared/ui/Panel";

function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
}

function AuditRowView({ entry }: { entry: AuditRecord }) {
  return (
    <tr>
      <td>{new Date(entry.observedAt * 1000).toLocaleString()}</td>
      <td>{entry.action}</td>
      <td className="mono" title={entry.ownerPubkey}>
        {shortKey(entry.ownerPubkey)}
      </td>
      <td className="mono">{entry.conditions || "(none)"}</td>
    </tr>
  );
}

function AuditTable({ entries }: { entries: AuditRecord[] }) {
  if (entries.length === 0) {
    return <p className="hint">No recorded authorization actions yet for this agent on this relay.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>When</th>
          <th>Action</th>
          <th>Authorized by</th>
          <th>Conditions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <AuditRowView entry={entry} key={entry.id} />
        ))}
      </tbody>
    </table>
  );
}

export function AuditPanel({
  agentPubkey,
  entries,
}: {
  agentPubkey?: string;
  entries: AuditRecord[];
}) {
  if (!agentPubkey) return null;
  return (
    <Panel title={`Audit trail: ${shortKey(agentPubkey)}`}>
      <AuditTable entries={entries} />
    </Panel>
  );
}
