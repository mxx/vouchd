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

import { useAuthorizedImage } from "../../app/useAuthorizedImage";
import type { AgentRecord, ProfileRecord } from "../../readmodel/records";
import type { EffectivePresence } from "../../readmodel/presence";
import type { SignEvent } from "../../signer/nip07Signer";
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

function NameCell({ agent, sign }: { agent: AgentRecord; sign: SignEvent | undefined }) {
  const t = useT();
  // This relay's media host requires BUD-11 authorization on GET (see
  // protocol/blossom.ts) -- a plain <img src={agent.picture}> just 401s.
  // No signer means no picture at all, not a broken-image glyph in its
  // place; `failed` (signer present, fetch tried, this host refused it --
  // see useAuthorizedImage's docblock) gets its own placeholder instead,
  // since that one's worth explaining rather than staying silent about.
  const { src, failed } = useAuthorizedImage(agent.picture, sign);
  return (
    <td title={agent.pubkey}>
      {src ? (
        <img alt="" className="avatar" src={src} />
      ) : failed ? (
        <span aria-hidden="true" className="avatar avatar-placeholder" title={t.agents.avatarUnavailable}>
          👤
        </span>
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
  sign,
  onReauthorize,
}: {
  row: AgentRow;
  profiles: Map<string, ProfileRecord>;
  sign: SignEvent | undefined;
  onReauthorize?: (pubkey: string) => void;
}) {
  const t = useT();
  const { agent, presence, lastSeen, channelNames } = row;
  // The owner is never itself an agent, so its name (if any) only ever
  // comes from the profiles store, not this row's own AgentRecord.
  const ownerName = profiles.get(agent.ownerPubkey)?.displayName;
  return (
    <tr>
      <NameCell agent={agent} sign={sign} />
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
    <Panel title={t.agents.emptyTitle}>
      <p className="hint">{t.agents.empty}</p>
    </Panel>
  );
}

export function AgentsPanel({
  rows,
  profiles,
  sign,
  onReauthorize,
}: {
  rows: AgentRow[];
  profiles: Map<string, ProfileRecord>;
  /** The active connection's signer, if any -- the same one used for AUTH
   *  and every publish (useCommunityConnection). No signer means no
   *  pictures (see NameCell); which identity it is doesn't matter here,
   *  only that it's shared with everything else that signs. */
  sign: SignEvent | undefined;
  onReauthorize?: (pubkey: string) => void;
}) {
  const t = useT();
  if (rows.length === 0) return <EmptyDirectory />;

  return (
    <Panel title={t.agents.title(rows.length)}>
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
            <AgentRowView key={row.agent.pubkey} onReauthorize={onReauthorize} profiles={profiles} row={row} sign={sign} />
          ))}
        </tbody>
      </table>
      </div>
    </Panel>
  );
}
