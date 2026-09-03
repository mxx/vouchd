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
import { useT } from "../../i18n";
import { Field } from "../../shared/ui/Field";
import { ErrorText, Panel } from "../../shared/ui/Panel";

function VisibilitySelect({
  value,
  onChange,
}: {
  value: ChannelVisibility;
  onChange: (v: ChannelVisibility) => void;
}) {
  const t = useT();
  return (
    <>
      <label htmlFor="visibility">{t.createChannel.visibilityLabel}</label>
      <select
        id="visibility"
        onChange={(event) => onChange(event.target.value as ChannelVisibility)}
        value={value}
      >
        <option value="open">{t.createChannel.openOption}</option>
        <option value="private">{t.createChannel.privateOption}</option>
      </select>
    </>
  );
}

/** The form fields, extracted so the panel's own body stays under AGENTS.md's 40-line rule. */
function ChannelForm({
  name,
  visibility,
  canPublish,
  onNameChange,
  onVisibilityChange,
  onSubmit,
}: {
  name: string;
  visibility: ChannelVisibility;
  canPublish: boolean;
  onNameChange: (name: string) => void;
  onVisibilityChange: (v: ChannelVisibility) => void;
  onSubmit: () => void;
}) {
  const t = useT();
  return (
    <>
      <Field
        id="channel-name"
        label={t.createChannel.nameLabel}
        onChange={onNameChange}
        placeholder={t.createChannel.namePlaceholder}
        value={name}
      />
      <VisibilitySelect onChange={onVisibilityChange} value={visibility} />
      <button disabled={!canPublish || !name.trim()} onClick={onSubmit}>
        {t.createChannel.submit}
      </button>
    </>
  );
}

export function CreateChannelPanel({
  canPublish,
  onCreate,
}: {
  canPublish: boolean;
  onCreate: (template: ReturnType<typeof buildCreateChannel>) => Promise<void>;
}) {
  const t = useT();
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
    <Panel title={t.createChannel.title}>
      <ChannelForm
        canPublish={canPublish}
        name={name}
        onNameChange={setName}
        onSubmit={() => void create()}
        onVisibilityChange={setVisibility}
        visibility={visibility}
      />
      {created ? (
        <p className="hint">
          {t.createChannel.createdPrefix} <code>{created}</code>
        </p>
      ) : null}
      <ErrorText error={error} />
    </Panel>
  );
}
