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
import { useT } from "../../i18n";
import { Panel } from "../../shared/ui/Panel";

function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
}

function AuditRowView({ entry }: { entry: AuditRecord }) {
  const t = useT();
  return (
    <tr>
      <td>{new Date(entry.observedAt * 1000).toLocaleString()}</td>
      <td>{entry.action}</td>
      <td className="mono" title={entry.ownerPubkey}>
        {shortKey(entry.ownerPubkey)}
      </td>
      <td className="mono">{entry.conditions || t.audit.none}</td>
    </tr>
  );
}

function AuditTable({ entries }: { entries: AuditRecord[] }) {
  const t = useT();
  if (entries.length === 0) {
    return <p className="hint">{t.audit.empty}</p>;
  }
  return (
    <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>{t.audit.colWhen}</th>
          <th>{t.audit.colAction}</th>
          <th>{t.audit.colAuthorizedBy}</th>
          <th>{t.audit.colConditions}</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <AuditRowView entry={entry} key={entry.id} />
        ))}
      </tbody>
    </table>
    </div>
  );
}

export function AuditPanel({
  agentPubkey,
  entries,
}: {
  agentPubkey?: string;
  entries: AuditRecord[];
}) {
  const t = useT();
  if (!agentPubkey) return null;
  return (
    <Panel title={t.audit.title(shortKey(agentPubkey))}>
      <AuditTable entries={entries} />
    </Panel>
  );
}
