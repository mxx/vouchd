/**
 * Putting an authorized agent into a channel.
 *
 * This is the step people expect "registration" to include and it
 * deliberately isn't part of it: minting an attestation is the owner
 * vouching for an agent, while adding it to a channel is an ordinary
 * membership act by whoever has the standing to do it. Separating them keeps
 * an honest distinction — an agent can be trusted by its owner and still not
 * belong in your channel, and both facts should be expressible.
 *
 * Whether this publish is accepted is the relay's call (it checks the
 * target's `channel_add_policy`). We surface the refusal verbatim instead of
 * pre-guessing a policy we don't hold.
 *
 * The pubkey field stays free-text -- there's always a legitimate target
 * this app has never seen an attestation for -- but once a channel is
 * picked, `KnownAgentSelect` offers a shortcut for the common case: an
 * already-registered agent that just isn't in *this* channel yet. It's a
 * write-only picker (selecting fills the pubkey field, then resets to its
 * own placeholder) rather than a second piece of state to keep in sync.
 */

import { useState } from "react";
import type { AgentRow } from "../agents/AgentsPanel";
import { buildAddMember } from "../../protocol/events/membership";
import type { MemberRole } from "../../protocol/events/types";
import type { ChannelRecord } from "../../readmodel/records";
import { useT } from "../../i18n";
import { shortKey } from "../../shared/format";
import { Field } from "../../shared/ui/Field";
import { ErrorText, Panel } from "../../shared/ui/Panel";

const ROLES: MemberRole[] = ["bot", "member", "guest", "admin"];

function ChannelSelect({
  channels,
  value,
  onChange,
}: {
  channels: ChannelRecord[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useT();
  return (
    <>
      <label htmlFor="channel">{t.membership.channelLabel}</label>
      <select id="channel" onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">
          {channels.length === 0 ? t.membership.noChannelsOption : t.membership.chooseChannelOption}
        </option>
        {channels.map((channel) => (
          <option key={channel.channelId} value={channel.channelId}>
            {channel.name}
          </option>
        ))}
      </select>
    </>
  );
}

/** Known agents not already in the selected channel -- a shortcut, not a replacement for the pubkey field. */
function KnownAgentSelect({
  agents,
  channelChosen,
  onSelect,
}: {
  agents: AgentRow[];
  channelChosen: boolean;
  onSelect: (pubkey: string) => void;
}) {
  const t = useT();
  const placeholder = !channelChosen
    ? t.membership.pickChannelFirstOption
    : agents.length === 0
      ? t.membership.noKnownAgentsOption
      : t.membership.chooseKnownAgentOption;
  return (
    <>
      <label htmlFor="known-agent">{t.membership.knownAgentLabel}</label>
      <select
        disabled={!channelChosen || agents.length === 0}
        id="known-agent"
        onChange={(event) => {
          if (event.target.value) onSelect(event.target.value);
        }}
        value=""
      >
        <option value="">{placeholder}</option>
        {agents.map((row) => (
          <option key={row.agent.pubkey} value={row.agent.pubkey}>
            {row.agent.displayName ?? shortKey(row.agent.pubkey)}
          </option>
        ))}
      </select>
    </>
  );
}

function RoleSelect({ value, onChange }: { value: MemberRole; onChange: (r: MemberRole) => void }) {
  const t = useT();
  return (
    <>
      <label htmlFor="role">{t.membership.roleLabel}</label>
      <select id="role" onChange={(event) => onChange(event.target.value as MemberRole)} value={value}>
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </>
  );
}

export function MembershipPanel({
  channels,
  rows,
  canPublish,
  onAddMember,
}: {
  channels: ChannelRecord[];
  /** The agent directory, so a known agent can be picked instead of typed -- see KnownAgentSelect. */
  rows: AgentRow[];
  canPublish: boolean;
  onAddMember: (template: ReturnType<typeof buildAddMember>) => Promise<void>;
}) {
  const t = useT();
  const [channelId, setChannelId] = useState("");
  const [pubkey, setPubkey] = useState("");
  const [role, setRole] = useState<MemberRole>("bot");
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  const channelName = channels.find((channel) => channel.channelId === channelId)?.name;
  const availableAgents = channelName
    ? rows.filter((row) => !row.channelNames.includes(channelName))
    : [];

  async function add() {
    setError(null);
    setDone(false);
    try {
      await onAddMember(buildAddMember(channelId, pubkey, role));
      setDone(true);
      setPubkey("");
    } catch (caught) {
      setError(caught);
    }
  }

  return (
    <Panel title={t.membership.title}>
      {!canPublish ? <p className="hint caveat">{t.membership.noExtensionCaveat}</p> : null}
      <ChannelSelect channels={channels} onChange={setChannelId} value={channelId} />
      <KnownAgentSelect agents={availableAgents} channelChosen={Boolean(channelId)} onSelect={setPubkey} />
      <Field id="member-pubkey" label={t.membership.pubkeyLabel} mono onChange={setPubkey} value={pubkey} />
      <RoleSelect onChange={setRole} value={role} />
      <button disabled={!canPublish || !channelId || !pubkey.trim()} onClick={() => void add()}>
        {t.membership.submit}
      </button>
      {done ? <p className="hint">{t.membership.done}</p> : null}
      <ErrorText error={error} />
    </Panel>
  );
}
