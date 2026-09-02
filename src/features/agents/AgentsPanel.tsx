/**
 * Every agent the relay has shown us, with its live status.
 *
 * "Shown us" is precise: an agent appears here because its own profile
 * carried an owner attestation that verified — not because this browser
 * issued it. An agent someone else authorized in the same community shows up
 * too, which is the point. A directory that only listed what this device did
 * would be a local notebook, not a view of the community.
 */

import type { AgentRecord } from "../../readmodel/records";
import type { EffectivePresence } from "../../readmodel/presence";
import { useT } from "../../i18n";
import { Panel } from "../../shared/ui/Panel";

export interface AgentRow {
  agent: AgentRecord;
  presence: EffectivePresence;
}

function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
}

function PresenceCell({ presence }: { presence: EffectivePresence }) {
  const t = useT();
  const label = presence === "unknown" ? t.agents.notSeen : presence;
  return (
    <span title={presence === "unknown" ? t.agents.presenceHint : label}>
      <span className={`dot ${presence}`} />
      {label}
    </span>
  );
}

function AgentRowView({
  row,
  onReauthorize,
}: {
  row: AgentRow;
  onReauthorize?: (pubkey: string) => void;
}) {
  const t = useT();
  const { agent, presence } = row;
  return (
    <tr>
      <td>{agent.displayName ?? <span className="status">{t.agents.unnamed}</span>}</td>
      <td className="mono" title={agent.pubkey}>{shortKey(agent.pubkey)}</td>
      <td className="mono" title={agent.ownerPubkey}>{shortKey(agent.ownerPubkey)}</td>
      <td><PresenceCell presence={presence} /></td>
      <td>
        {onReauthorize ? (
          <button className="secondary" onClick={() => onReauthorize(agent.pubkey)}>
            {t.agents.reauthorize}
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function EmptyDirectory() {
  const t = useT();
  return (
    <Panel id="agents" title={t.agents.emptyTitle}>
      <p className="hint">{t.agents.empty}</p>
    </Panel>
  );
}

export function AgentsPanel({
  rows,
  onReauthorize,
}: {
  rows: AgentRow[];
  onReauthorize?: (pubkey: string) => void;
}) {
  const t = useT();
  if (rows.length === 0) return <EmptyDirectory />;

  return (
    <Panel id="agents" title={t.agents.title(rows.length)}>
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t.agents.colName}</th>
            <th>{t.agents.colAgent}</th>
            <th>{t.agents.colAuthorizedBy}</th>
            <th>{t.agents.colStatus}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <AgentRowView key={row.agent.pubkey} onReauthorize={onReauthorize} row={row} />
          ))}
        </tbody>
      </table>
      </div>
    </Panel>
  );
}
