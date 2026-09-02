/**
 * Every channel this app has observed a create-channel event for.
 *
 * A listing, not an action: creating one is CreateChannelPanel's job,
 * joining one is MembershipPanel's -- this only answers "what channels
 * does the community have", the same split AgentsPanel draws between
 * authorizing a member and merely showing the ones already authorized.
 */

import type { ChannelRecord } from "../../readmodel/records";
import { useT } from "../../i18n";
import { Panel } from "../../shared/ui/Panel";

function ChannelRowView({ channel }: { channel: ChannelRecord }) {
  const t = useT();
  return (
    <tr>
      <td>{channel.name}</td>
      <td className="mono">{channel.visibility ?? t.channels.unset}</td>
      <td className="mono">{channel.channelType ?? t.channels.unset}</td>
      <td>{channel.about ?? t.channels.unset}</td>
    </tr>
  );
}

function EmptyChannels() {
  const t = useT();
  return (
    <Panel id="channels" title={t.channels.emptyTitle}>
      <p className="hint">{t.channels.empty}</p>
    </Panel>
  );
}

export function ChannelsPanel({ channels }: { channels: ChannelRecord[] }) {
  const t = useT();
  if (channels.length === 0) return <EmptyChannels />;

  return (
    <Panel id="channels" title={t.channels.title(channels.length)}>
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t.channels.colName}</th>
            <th>{t.channels.colVisibility}</th>
            <th>{t.channels.colType}</th>
            <th>{t.channels.colAbout}</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((channel) => (
            <ChannelRowView channel={channel} key={channel.channelId} />
          ))}
        </tbody>
      </table>
      </div>
    </Panel>
  );
}
