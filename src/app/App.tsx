/**
 * Composition root: assembles the panels and owns nothing else.
 *
 * Every panel below works on its own terms — the owner-key and attestation
 * panels never touch the relay, and the directory never touches a key. That
 * separation isn't incidental; it's the two-signing-path rule from
 * docs/ARCHITECTURE.md showing up in the component tree.
 */

import { useMemo, useState } from "react";
import { createIndexedDbStorage } from "../signer/indexedDbStorage";
import { OwnerKeystore } from "../signer/ownerKeystore";
import { AgentsPanel } from "../features/agents/AgentsPanel";
import { OwnerKeyPanel } from "../features/agents/OwnerKeyPanel";
import { RegisterAgentPanel } from "../features/agents/RegisterAgentPanel";
import { CommunityPanel } from "../features/communities/CommunityPanel";
import { CreateChannelPanel } from "../features/membership/CreateChannelPanel";
import { MembershipPanel } from "../features/membership/MembershipPanel";
import type { VouchdSession } from "./session";
import { useAgentRows } from "./useAgentRows";
import { useChannels } from "./useChannels";
import { useCommunityConnection } from "./useCommunityConnection";
import { useNip07 } from "./useNip07";
import { useReadModel } from "./useReadModel";

function IdentityLine({ pubkey, available }: { pubkey: string | null; available: boolean }) {
  if (!available) return <p className="status">No NIP-07 extension: read-only.</p>;
  if (!pubkey) return <p className="status">Extension found; awaiting permission.</p>;
  return <p className="status">Signing as {pubkey.slice(0, 12)}…</p>;
}

export function App() {
  const db = useReadModel();
  const keystore = useMemo(() => new OwnerKeystore(createIndexedDbStorage()), []);
  const connection = useCommunityConnection(db);
  const rows = useAgentRows(db, connection.session);
  const channels = useChannels(db, connection.session);
  const nip07 = useNip07();
  const [reauthorizing, setReauthorizing] = useState<string | undefined>(undefined);
  const canPublish = Boolean(connection.session && nip07.available);

  /** Publishing needs both a live session and an extension to sign as you. */
  const publish = (template: Parameters<VouchdSession["publish"]>[0]) =>
    connection.session
      ? connection.session.publish(template)
      : Promise.reject(new Error("not connected to a community"));

  return (
    <div className="shell">
      <header>
        <h1>vouchd</h1>
        <p>Authorize agents to speak in your community, wherever they run.</p>
        <IdentityLine available={nip07.available} pubkey={nip07.pubkey} />
      </header>
      <CommunityPanel
        error={connection.error}
        onConnect={connection.connect}
        onDisconnect={connection.disconnect}
        status={connection.status}
      />
      <OwnerKeyPanel keystore={keystore} />
      <RegisterAgentPanel keystore={keystore} prefillPubkey={reauthorizing} />
      <CreateChannelPanel canPublish={canPublish} onCreate={publish} />
      <MembershipPanel
        canPublish={canPublish}
        channels={channels}
        onAddMember={publish}
      />
      <AgentsPanel onReauthorize={setReauthorizing} rows={rows} />
    </div>
  );
}
