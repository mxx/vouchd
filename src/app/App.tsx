/**
 * Composition root: assembles the panels and owns nothing else.
 *
 * Every panel below works on its own terms — the owner-key and attestation
 * panels never touch the relay, and the directory never touches a key. That
 * separation isn't incidental; it's the two-signing-path rule from
 * docs/ARCHITECTURE.md showing up in the component tree. All the state and
 * wiring behind these props lives in useVouchdApp — this function's only
 * job is deciding what's on screen.
 */

import { AgentsPanel } from "../features/agents/AgentsPanel";
import { OwnerKeyPanel } from "../features/agents/OwnerKeyPanel";
import { RegisterAgentPanel } from "../features/agents/RegisterAgentPanel";
import { AuditPanel } from "../features/audit/AuditPanel";
import { CommunityPanel } from "../features/communities/CommunityPanel";
import { CreateChannelPanel } from "../features/membership/CreateChannelPanel";
import { MembershipPanel } from "../features/membership/MembershipPanel";
import { useVouchdApp } from "./useVouchdApp";

function IdentityLine({ pubkey, available }: { pubkey: string | null; available: boolean }) {
  if (!available) return <p className="status">No NIP-07 extension: read-only.</p>;
  if (!pubkey) return <p className="status">Extension found; awaiting permission.</p>;
  return <p className="status">Signing as {pubkey.slice(0, 12)}…</p>;
}

export function App() {
  const app = useVouchdApp();
  const { keystore, connection, rows, channels, nip07, canPublish, publish } = app;
  const { focusedAgent, setFocusedAgent, auditEntries } = app;

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
      <RegisterAgentPanel
        canPublish={canPublish}
        keystore={keystore}
        onMinted={setFocusedAgent}
        onPublish={publish}
        prefillPubkey={focusedAgent}
      />
      <AuditPanel agentPubkey={focusedAgent} entries={auditEntries} />
      <CreateChannelPanel canPublish={canPublish} onCreate={publish} />
      <MembershipPanel
        canPublish={canPublish}
        channels={channels}
        onAddMember={publish}
      />
      <AgentsPanel onReauthorize={setFocusedAgent} rows={rows} />
    </div>
  );
}
