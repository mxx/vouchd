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
import { ChannelDetailPanel } from "../features/channels/ChannelDetailPanel";
import { ChannelsPanel } from "../features/channels/ChannelsPanel";
import { CommunityPanel } from "../features/communities/CommunityPanel";
import { CreateChannelPanel } from "../features/membership/CreateChannelPanel";
import { MembershipPanel } from "../features/membership/MembershipPanel";
import { PassphrasePrompt } from "../shared/ui/PassphrasePrompt";
import { LanguageSelect } from "../shared/ui/LanguageSelect";
import { Sidebar } from "../shared/ui/Sidebar";
import { StatBar } from "../shared/ui/StatBar";
import { useVouchdApp, type VouchdAppState } from "./useVouchdApp";

/**
 * The three channel-related panels, grouped under one name so AppShell's
 * render stays one call per concern instead of growing a line per panel --
 * this cluster (list, create, add-member) is the "Channels" nav group, so
 * it reads as one idea in App.tsx too.
 *
 * `focusedChannel` set swaps the *whole cluster* for ChannelDetailPanel,
 * the one deliberate exception to this file's "every panel stays on the
 * page" rule (see this file's own header comment). It's a narrower
 * exception than it looks: nothing here has independent live state the way
 * CommunityPanel's connection or a pending passphrase prompt does, so
 * swapping list-view for detail-view over the same data is an honest
 * master-detail toggle, not a fake tab hiding something still running.
 * ChannelDetailPanel keeps ChannelsPanel's own `id="channels"` so the
 * sidebar's "Channel list" link still lands somewhere either way.
 */
function ChannelPanels({ app }: { app: VouchdAppState }) {
  const { channels, rows, canPublish, publish, focusedChannel, setFocusedChannel, channelMembers, profiles } = app;
  if (focusedChannel) {
    return (
      <ChannelDetailPanel
        channel={channels.find((channel) => channel.channelId === focusedChannel)}
        members={channelMembers}
        onBack={() => setFocusedChannel(undefined)}
        profiles={profiles}
      />
    );
  }
  return (
    <>
      <ChannelsPanel channels={channels} onSelectChannel={setFocusedChannel} />
      <CreateChannelPanel canPublish={canPublish} onCreate={publish} />
      <MembershipPanel canPublish={canPublish} channels={channels} onAddMember={publish} rows={rows} />
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
  const { rows, nip07, canPublish, publish, focusedAgent, setFocusedAgent, auditEntries, profiles } = app;
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
          historyMayBeIncomplete={connection.historyMayBeIncomplete}
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
        <ChannelPanels app={app} />
        <AgentsPanel onReauthorize={setFocusedAgent} profiles={profiles} rows={rows} sign={connection.signer} />
      </div>
    </div>
  );
}
