/**
 * Composition root: assembles the panels and owns nothing else.
 *
 * The owner-key panel is the only place a raw secret is ever typed; every
 * other panel that needs that key to sign something (Community's relay
 * connection, RegisterAgentPanel's minting) asks for a *passphrase*, never
 * the secret itself -- OwnerKeystore is the only holder of plaintext, for
 * the duration of one call (docs/ARCHITECTURE.md). The single
 * `<PassphrasePrompt>` rendered here is that one ask, shared by every
 * caller (relay AUTH, day-to-day publish, minting) rather than each
 * growing its own inline field -- minting used to have one, and it meant
 * typing the same passphrase twice in a row whenever its audit entry also
 * needed the owner key to publish.
 */

import { AgentsPanel } from "../features/agents/AgentsPanel";
import { OwnerKeyPanel } from "../features/agents/OwnerKeyPanel";
import { RegisterAgentPanel } from "../features/agents/RegisterAgentPanel";
import { AuditPanel } from "../features/audit/AuditPanel";
import { CommunityPanel } from "../features/communities/CommunityPanel";
import { CreateChannelPanel } from "../features/membership/CreateChannelPanel";
import { MembershipPanel } from "../features/membership/MembershipPanel";
import { PassphrasePrompt } from "../shared/ui/PassphrasePrompt";
import { useVouchdApp } from "./useVouchdApp";

function IdentityLine({ pubkey, available }: { pubkey: string | null; available: boolean }) {
  if (!available) return <p className="status">No NIP-07 extension: read-only.</p>;
  if (!pubkey) return <p className="status">Extension found; awaiting permission.</p>;
  return <p className="status">Signing as {pubkey.slice(0, 12)}…</p>;
}

export function App() {
  const app = useVouchdApp();
  const { keystore, connection, passphrasePrompt, rows, channels, nip07, canPublish, publish } = app;
  const { focusedAgent, setFocusedAgent, auditEntries } = app;

  return (
    <div className="shell">
      {passphrasePrompt.pending ? <PassphrasePrompt request={passphrasePrompt.pending} /> : null}
      <header>
        <h1>vouchd</h1>
        <p>Authorize agents to speak in your community, wherever they run.</p>
        <IdentityLine available={nip07.available} pubkey={nip07.pubkey} />
      </header>
      <CommunityPanel
        error={connection.error}
        notice={connection.notice}
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
        requestPassphrase={passphrasePrompt.requestPassphrase}
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
