/**
 * Everything this app has observed about one channel: its own record in
 * full (including the `channelId` and first-observed time ChannelsPanel's
 * summary table leaves out) plus its member roster -- `listMembers` has
 * existed in readmodel/queries.ts since channels shipped, unused by any
 * panel until now.
 *
 * Renders nothing until a channel is focused, the same steady state
 * AuditPanel already establishes for "nothing selected yet" -- not a
 * loading state, the correct state before a channel has been picked.
 */

import type { ChannelRecord, MemberRecord, ProfileRecord } from "../../readmodel/records";
import { useT } from "../../i18n";
import { Panel } from "../../shared/ui/Panel";

function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
}

function MemberRowView({
  member,
  profiles,
}: {
  member: MemberRecord;
  profiles: Map<string, ProfileRecord>;
}) {
  const name = profiles.get(member.pubkey)?.displayName;
  const t = useT();
  return (
    <tr>
      <td className="mono" title={member.pubkey}>{name ?? shortKey(member.pubkey)}</td>
      <td className="mono">{member.role ?? t.channels.unset}</td>
      <td>{new Date(member.observedAt * 1000).toLocaleString()}</td>
    </tr>
  );
}

function MembersTable({
  members,
  profiles,
}: {
  members: MemberRecord[];
  profiles: Map<string, ProfileRecord>;
}) {
  const t = useT();
  if (members.length === 0) return <p className="hint">{t.channelDetail.noMembers}</p>;
  return (
    <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>{t.channelDetail.colMember}</th>
          <th>{t.channelDetail.colRole}</th>
          <th>{t.channelDetail.colFirstSeen}</th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <MemberRowView key={member.pubkey} member={member} profiles={profiles} />
        ))}
      </tbody>
    </table>
    </div>
  );
}

export function ChannelDetailPanel({
  channel,
  members,
  profiles,
  onBack,
}: {
  channel: ChannelRecord | undefined;
  members: MemberRecord[];
  profiles: Map<string, ProfileRecord>;
  onBack: () => void;
}) {
  const t = useT();
  if (!channel) return null;
  return (
    <Panel id="channels" title={t.channelDetail.title(channel.name)}>
      <button className="secondary" onClick={onBack}>
        {t.channelDetail.back}
      </button>
      <p className="status">
        {t.channelDetail.idLabel} <code>{channel.channelId}</code>
      </p>
      <p className="status">{t.channelDetail.visibilityLabel} {channel.visibility ?? t.channels.unset}</p>
      <p className="status">{t.channelDetail.typeLabel} {channel.channelType ?? t.channels.unset}</p>
      <p className="status">{t.channelDetail.aboutLabel} {channel.about ?? t.channels.unset}</p>
      <p className="hint">{t.channelDetail.firstSeen(new Date(channel.observedAt * 1000).toLocaleString())}</p>
      <h3>{t.channelDetail.membersTitle(members.length)}</h3>
      <MembersTable members={members} profiles={profiles} />
    </Panel>
  );
}
