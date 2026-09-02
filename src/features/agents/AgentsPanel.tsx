/**
 * Every member the relay has shown us -- pubkeys whose own profile carried
 * an owner attestation that verified -- with its live status.
 *
 * "Shown us" is precise: a row appears here because its own profile
 * verified, not because this browser issued it. One authorized in the same
 * community by someone else shows up too, which is the point. A directory
 * that only listed what this device did would be a local notebook, not a
 * view of the community. (The type underneath is still called AgentRecord
 * -- see records.ts -- "member" here is display wording only, chosen so
 * this panel reads like the rest of the app; it isn't a rename of the
 * NIP-OA concept, and it isn't MemberRecord, which is channel membership.)
 */

import type { AgentRecord, ProfileRecord } from "../../readmodel/records";
import type { EffectivePresence } from "../../readmodel/presence";
import { useT } from "../../i18n";
import { Panel } from "../../shared/ui/Panel";

export interface AgentRow {
  agent: AgentRecord;
  presence: EffectivePresence;
  /** `created_at` of the last presence event we saw, regardless of TTL --
   *  what "last seen" reports even after `presence` itself has expired to
   *  "unknown". Absent if we've never seen one at all. */
  lastSeen?: number;
  /** Every channel (by name) this pubkey currently belongs to. */
  channelNames: string[];
}

function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
}

function NameCell({ agent }: { agent: AgentRecord }) {
  const t = useT();
  return (
    <td title={agent.pubkey}>
      {agent.picture ? (
        <img alt="" className="avatar" src={agent.picture} />
      ) : null}
      {agent.displayName ?? <span className="status">{t.agents.unnamed}</span>}
    </td>
  );
}

function PresenceCell({ presence, lastSeen }: { presence: EffectivePresence; lastSeen?: number }) {
  const t = useT();
  const label = presence === "unknown" ? t.agents.notSeen : presence;
  return (
    <span title={presence === "unknown" ? t.agents.presenceHint : label}>
      <span className={`dot ${presence}`} />
      {label}
      {presence !== "online" && lastSeen !== undefined ? (
        <span className="hint"> ({t.agents.lastSeen(new Date(lastSeen * 1000).toLocaleString())})</span>
      ) : null}
    </span>
  );
}

function AgentRowView({
  row,
  profiles,
  onReauthorize,
}: {
  row: AgentRow;
  profiles: Map<string, ProfileRecord>;
  onReauthorize?: (pubkey: string) => void;
}) {
  const t = useT();
  const { agent, presence, lastSeen, channelNames } = row;
  // The owner is never itself an agent, so its name (if any) only ever
  // comes from the profiles store, not this row's own AgentRecord.
  const ownerName = profiles.get(agent.ownerPubkey)?.displayName;
  return (
    <tr>
      <NameCell agent={agent} />
      <td className="mono">{channelNames.length > 0 ? channelNames.join(", ") : t.agents.noChannels}</td>
      <td className="mono" title={agent.ownerPubkey}>{ownerName ?? shortKey(agent.ownerPubkey)}</td>
      <td><PresenceCell lastSeen={lastSeen} presence={presence} /></td>
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
  profiles,
  onReauthorize,
}: {
  rows: AgentRow[];
  profiles: Map<string, ProfileRecord>;
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
            <th>{t.agents.colChannel}</th>
            <th>{t.agents.colAuthorizedBy}</th>
            <th>{t.agents.colStatus}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <AgentRowView key={row.agent.pubkey} onReauthorize={onReauthorize} profiles={profiles} row={row} />
          ))}
        </tbody>
      </table>
      </div>
    </Panel>
  );
}
