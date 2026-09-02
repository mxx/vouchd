/**
 * Composition root: assembles the panels and owns nothing else.
 *
 * Every panel still renders on this one page, in the order it always has
 * -- the sidebar (Sidebar.tsx) is jump links into that same page, not a
 * router, because nothing here actually stops existing when you're not
 * "on" its tab. See Sidebar.tsx's own header comment for why a fake tab
 * switch would be dishonest UI for an app that documents its absences
 * (AGENTS.md rule 1, `src/features/bridge/README.md`).
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

import { LanguageProvider, useT } from "../i18n";
import { AgentsPanel } from "../features/agents/AgentsPanel";
import { OwnerKeyPanel } from "../features/agents/OwnerKeyPanel";
import { RegisterAgentPanel } from "../features/agents/RegisterAgentPanel";
import { AuditPanel } from "../features/audit/AuditPanel";
import { ChannelsPanel } from "../features/channels/ChannelsPanel";
import { CommunityPanel } from "../features/communities/CommunityPanel";
import { CreateChannelPanel } from "../features/membership/CreateChannelPanel";
import { MembershipPanel } from "../features/membership/MembershipPanel";
import { PassphrasePrompt } from "../shared/ui/PassphrasePrompt";
import { LanguageSelect } from "../shared/ui/LanguageSelect";
import { Sidebar } from "../shared/ui/Sidebar";
import { StatBar } from "../shared/ui/StatBar";
import type { EventTemplate } from "../protocol/events/types";
import type { ChannelRecord } from "../readmodel/records";
import { useVouchdApp } from "./useVouchdApp";

/**
 * The three channel-related panels, grouped under one name so AppShell's
 * render stays one call per concern instead of growing a line per panel --
 * this cluster (list, create, add-member) is the "Channels" nav group, so
 * it reads as one idea in App.tsx too.
 */
function ChannelPanels({
  channels,
  canPublish,
  onCreate,
  onAddMember,
}: {
  channels: ChannelRecord[];
  canPublish: boolean;
  onCreate: (template: EventTemplate) => Promise<void>;
  onAddMember: (template: EventTemplate) => Promise<void>;
}) {
  return (
    <>
      <ChannelsPanel channels={channels} />
      <CreateChannelPanel canPublish={canPublish} onCreate={onCreate} />
      <MembershipPanel canPublish={canPublish} channels={channels} onAddMember={onAddMember} />
    </>
  );
}

/**
 * `<LanguageProvider>` lives here, wrapping everything else, rather than
 * in main.tsx: it keeps `<App/>` a fully self-contained composition root
 * that works the same way whether it's mounted by main.tsx or by a test
 * that renders `<App/>` directly (tests/app/App.render.test.tsx) -- no
 * caller has to remember to also wrap it in a provider.
 */
export function App() {
  return (
    <LanguageProvider>
      <AppShell />
    </LanguageProvider>
  );
}

function AppShell() {
  const app = useVouchdApp();
  const { keystore, ownerPubkey, refreshOwnerPubkey, connection, passphrasePrompt } = app;
  const { rows, channels, nip07, canPublish, publish, focusedAgent, setFocusedAgent, auditEntries, profiles } = app;
  const t = useT();

  return (
    <div className="shell">
      {passphrasePrompt.pending ? <PassphrasePrompt request={passphrasePrompt.pending} /> : null}
      <Sidebar nip07={nip07} />
      <div className="content">
        <header>
          <div className="title-row">
            <h1>{t.app.title}</h1>
            <LanguageSelect />
          </div>
        </header>
        <StatBar ownerPubkey={ownerPubkey} relayStatus={connection.status} rows={rows} />
        <CommunityPanel
          error={connection.error}
          nip07Available={nip07.available}
          notice={connection.notice}
          onConnect={connection.connect}
          onDisconnect={connection.disconnect}
          status={connection.status}
        />
        <OwnerKeyPanel keystore={keystore} onChanged={refreshOwnerPubkey} ownerPubkey={ownerPubkey} />
        <RegisterAgentPanel
          canPublish={canPublish}
          keystore={keystore}
          onMinted={setFocusedAgent}
          onPublish={publish}
          prefillPubkey={focusedAgent}
          requestPassphrase={passphrasePrompt.requestPassphrase}
        />
        <AuditPanel agentPubkey={focusedAgent} entries={auditEntries} profiles={profiles} />
        <ChannelPanels canPublish={canPublish} channels={channels} onAddMember={publish} onCreate={publish} />
        <AgentsPanel onReauthorize={setFocusedAgent} profiles={profiles} rows={rows} />
      </div>
    </div>
  );
}
