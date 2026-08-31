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
 */

import { useState } from "react";
import { buildAddMember } from "../../protocol/events/membership";
import type { MemberRole } from "../../protocol/events/types";
import type { ChannelRecord } from "../../readmodel/records";
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
  return (
    <>
      <label htmlFor="channel">Channel</label>
      <select id="channel" onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">
          {channels.length === 0 ? "no channels observed yet" : "choose a channel"}
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

function RoleSelect({ value, onChange }: { value: MemberRole; onChange: (r: MemberRole) => void }) {
  return (
    <>
      <label htmlFor="role">Role</label>
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
  canPublish,
  onAddMember,
}: {
  channels: ChannelRecord[];
  canPublish: boolean;
  onAddMember: (template: ReturnType<typeof buildAddMember>) => Promise<void>;
}) {
  const [channelId, setChannelId] = useState("");
  const [pubkey, setPubkey] = useState("");
  const [role, setRole] = useState<MemberRole>("bot");
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

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
    <Panel title="Add to a channel">
      {!canPublish ? (
        <p className="hint caveat">
          Connect a NIP-07 extension to publish. Attestations don&apos;t need one; membership
          changes are signed as you.
        </p>
      ) : null}
      <ChannelSelect channels={channels} onChange={setChannelId} value={channelId} />
      <Field id="member-pubkey" label="Pubkey to add" mono onChange={setPubkey} value={pubkey} />
      <RoleSelect onChange={setRole} value={role} />
      <button disabled={!canPublish || !channelId || !pubkey.trim()} onClick={() => void add()}>
        Add to channel
      </button>
      {done ? <p className="hint">Relay accepted the membership event.</p> : null}
      <ErrorText error={error} />
    </Panel>
  );
}
