/**
 * Creating a channel to put agents in.
 *
 * The channel id is generated here, client-side, because Buzz treats it as a
 * caller-chosen UUID — which means the id is known before the relay has
 * acknowledged anything, and a follow-up "add member" can reference it
 * immediately instead of waiting for a round trip and a projection.
 */

import { useState } from "react";
import { buildCreateChannel } from "../../protocol/events/channel";
import type { ChannelVisibility } from "../../protocol/events/types";
import { Field } from "../../shared/ui/Field";
import { ErrorText, Panel } from "../../shared/ui/Panel";

export function CreateChannelPanel({
  canPublish,
  onCreate,
}: {
  canPublish: boolean;
  onCreate: (template: ReturnType<typeof buildCreateChannel>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<ChannelVisibility>("open");
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function create() {
    setError(null);
    setCreated(null);
    try {
      const channelId = crypto.randomUUID();
      await onCreate(buildCreateChannel(channelId, name, { visibility }));
      setCreated(channelId);
      setName("");
    } catch (caught) {
      setError(caught);
    }
  }

  return (
    <Panel title="Create a channel">
      <Field id="channel-name" label="Name" onChange={setName} placeholder="general" value={name} />
      <label htmlFor="visibility">Visibility</label>
      <select
        id="visibility"
        onChange={(event) => setVisibility(event.target.value as ChannelVisibility)}
        value={visibility}
      >
        <option value="open">open — searchable, joinable without an invite</option>
        <option value="private">private — invite only</option>
      </select>
      <button disabled={!canPublish || !name.trim()} onClick={() => void create()}>
        Create channel
      </button>
      {created ? <p className="hint">Created. Channel id: <code>{created}</code></p> : null}
      <ErrorText error={error} />
    </Panel>
  );
}
