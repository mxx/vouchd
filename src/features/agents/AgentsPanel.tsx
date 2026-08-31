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
import { Panel } from "../../shared/ui/Panel";

export interface AgentRow {
  agent: AgentRecord;
  presence: EffectivePresence;
}

function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
}

function PresenceCell({ presence }: { presence: EffectivePresence }) {
  const label = presence === "unknown" ? "not seen" : presence;
  return (
    <span title={presence === "unknown" ? "no presence within the relay's 180s window" : label}>
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
  const { agent, presence } = row;
  return (
    <tr>
      <td>{agent.displayName ?? <span className="status">unnamed</span>}</td>
      <td className="mono" title={agent.pubkey}>{shortKey(agent.pubkey)}</td>
      <td className="mono" title={agent.ownerPubkey}>{shortKey(agent.ownerPubkey)}</td>
      <td><PresenceCell presence={presence} /></td>
      <td>
        {onReauthorize ? (
          <button className="secondary" onClick={() => onReauthorize(agent.pubkey)}>
            Re-authorize
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function EmptyDirectory() {
  return (
    <Panel title="Agents">
      <p className="hint">
        None observed yet. Agents appear here once they publish a profile carrying a valid
        owner attestation.
      </p>
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
  if (rows.length === 0) return <EmptyDirectory />;

  return (
    <Panel title={`Agents (${rows.length})`}>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Agent</th>
            <th>Authorized by</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <AgentRowView key={row.agent.pubkey} onReauthorize={onReauthorize} row={row} />
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
