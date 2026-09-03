/**
 * Everything this app has observed about one channel: its own record in
 * full (including the `channelId` and first-observed time ChannelsPanel's
 * summary table leaves out) plus its member roster -- `listMembers` has
 * existed in readmodel/queries.ts since channels shipped, unused by any
 * panel until now.
 *
 * Also the home for this app's channel-management writes: removing a
 * member, archiving/unarchiving, and deleting the channel outright. Gated
 * only on `canPublish`, the same flag every other write action in this app
 * uses -- whether the relay actually accepts one of these (it enforces its
 * own owner-only rule for delete; see buzz-relay's side_effects.rs) is its
 * call, not a policy this client tries to pre-compute (MembershipPanel's
 * own docblock already establishes this precedent). Delete asks for one
 * native confirmation first, since kind:9008 is a relay-side soft delete
 * with no "undelete" the way archive/unarchive has.
 *
 * Renders nothing until a channel is focused, the same steady state
 * AuditPanel already establishes for "nothing selected yet" -- not a
 * loading state, the correct state before a channel has been picked.
 */

import { useState } from "react";
import { buildDeleteChannel, buildSetChannelArchived } from "../../protocol/events/channel";
import { buildRemoveMember } from "../../protocol/events/membership";
import type { EventTemplate } from "../../protocol/events/types";
import type { ChannelRecord, MemberRecord, ProfileRecord } from "../../readmodel/records";
import { useT } from "../../i18n";
import { ErrorText, Panel } from "../../shared/ui/Panel";
import { PubkeyChip } from "../../shared/ui/PubkeyChip";

function MemberRowView({
  member,
  profiles,
  canPublish,
  onRemove,
}: {
  member: MemberRecord;
  profiles: Map<string, ProfileRecord>;
  canPublish: boolean;
  onRemove: (pubkey: string) => void;
}) {
  const name = profiles.get(member.pubkey)?.displayName;
  const t = useT();
  return (
    <tr>
      {/* Name and key together, not one-or-the-other: in a roster you act on
          (this is the panel with the remove button) the name says who you are
          about to remove and the key is what actually identifies them. */}
      <td className="identity">
        {name ? <span>{name}</span> : null}
        <PubkeyChip pubkey={member.pubkey} />
      </td>
      <td className="mono">{member.role ?? t.channels.unset}</td>
      <td>{new Date(member.observedAt * 1000).toLocaleString()}</td>
      <td>
        {canPublish ? (
          <button className="secondary" onClick={() => onRemove(member.pubkey)}>
            {t.channelDetail.removeMember}
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function MembersTable({
  members,
  profiles,
  canPublish,
  onRemove,
}: {
  members: MemberRecord[];
  profiles: Map<string, ProfileRecord>;
  canPublish: boolean;
  onRemove: (pubkey: string) => void;
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
          <th />
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <MemberRowView
            canPublish={canPublish}
            key={member.pubkey}
            member={member}
            onRemove={onRemove}
            profiles={profiles}
          />
        ))}
      </tbody>
    </table>
    </div>
  );
}

/** The two channel-level admin actions -- separated from the exported panel
 *  purely so its own error state doesn't have to share a slot with the
 *  member table's (a failed archive shouldn't blank out a just-shown remove
 *  error, or vice versa). */
function ChannelActions({
  channel,
  canPublish,
  onPublish,
  onDeleted,
}: {
  channel: ChannelRecord;
  canPublish: boolean;
  onPublish: (template: EventTemplate) => Promise<void>;
  onDeleted: () => void;
}) {
  const t = useT();
  const [error, setError] = useState<unknown>(null);

  async function toggleArchived() {
    setError(null);
    try {
      await onPublish(buildSetChannelArchived(channel.channelId, !channel.archived));
    } catch (caught) {
      setError(caught);
    }
  }

  async function requestDelete() {
    if (!window.confirm(t.channelDetail.deleteConfirm(channel.name))) return;
    setError(null);
    try {
      await onPublish(buildDeleteChannel(channel.channelId));
      onDeleted();
    } catch (caught) {
      setError(caught);
    }
  }

  return (
    <>
      <div className="row">
        <button className="secondary" disabled={!canPublish} onClick={() => void toggleArchived()}>
          {channel.archived ? t.channelDetail.unarchive : t.channelDetail.archive}
        </button>
        <button className="secondary" disabled={!canPublish} onClick={() => void requestDelete()}>
          {t.channelDetail.delete}
        </button>
      </div>
      <ErrorText error={error} />
    </>
  );
}

export function ChannelDetailPanel({
  channel,
  members,
  profiles,
  canPublish,
  onPublish,
  onBack,
}: {
  channel: ChannelRecord | undefined;
  members: MemberRecord[];
  profiles: Map<string, ProfileRecord>;
  canPublish: boolean;
  onPublish: (template: EventTemplate) => Promise<void>;
  onBack: () => void;
}) {
  const t = useT();
  const [removeError, setRemoveError] = useState<unknown>(null);
  if (!channel) return null;

  async function removeMember(pubkey: string) {
    setRemoveError(null);
    try {
      await onPublish(buildRemoveMember(channel!.channelId, pubkey));
    } catch (caught) {
      setRemoveError(caught);
    }
  }

  return (
    <Panel title={t.channelDetail.title(channel.name)}>
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
      <ChannelActions canPublish={canPublish} channel={channel} onDeleted={onBack} onPublish={onPublish} />
      <h3>{t.channelDetail.membersTitle(members.length)}</h3>
      <MembersTable
        canPublish={canPublish}
        members={members}
        onRemove={(pubkey) => void removeMember(pubkey)}
        profiles={profiles}
      />
      <ErrorText error={removeError} />
    </Panel>
  );
}
