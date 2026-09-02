/**
 * Every channel this app has observed a create-channel event for.
 *
 * A listing, not an action: creating one is CreateChannelPanel's job,
 * joining one is MembershipPanel's -- this only answers "what channels
 * does the community have", the same split AgentsPanel draws between
 * authorizing a member and merely showing the ones already authorized.
 *
 * `onSelectChannel` is optional and, when given, adds a trailing "View"
 * button per row -- the same optional-trailing-action-column shape
 * AgentsPanel already uses for its "Re-authorize" button. App.tsx wires it
 * to drill into ChannelDetailPanel (see that file, and App.tsx's
 * ChannelPanels, for why that's a whole-cluster swap rather than a row
 * expanding in place).
 */

import type { ChannelRecord } from "../../readmodel/records";
import { useT } from "../../i18n";
import { Panel } from "../../shared/ui/Panel";

function ChannelRowView({
  channel,
  onSelectChannel,
}: {
  channel: ChannelRecord;
  onSelectChannel?: (channelId: string) => void;
}) {
  const t = useT();
  return (
    <tr>
      <td>{channel.name}</td>
      <td className="mono">{channel.visibility ?? t.channels.unset}</td>
      <td className="mono">{channel.channelType ?? t.channels.unset}</td>
      <td>{channel.about ?? t.channels.unset}</td>
      <td>
        {onSelectChannel ? (
          <button className="secondary" onClick={() => onSelectChannel(channel.channelId)}>
            {t.channels.view}
          </button>
        ) : null}
      </td>
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

export function ChannelsPanel({
  channels,
  onSelectChannel,
}: {
  channels: ChannelRecord[];
  onSelectChannel?: (channelId: string) => void;
}) {
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
            <th />
          </tr>
        </thead>
        <tbody>
          {channels.map((channel) => (
            <ChannelRowView channel={channel} key={channel.channelId} onSelectChannel={onSelectChannel} />
          ))}
        </tbody>
      </table>
      </div>
    </Panel>
  );
}
