/**
 * Composition root: assembles the panels and owns nothing else.
 *
 * Exactly one screen renders at a time now (`activeScreen`, driven by
 * Sidebar's nav) -- a deliberate reversal of this file's earlier "every
 * panel stays on one page" design. That design existed because a fake tab
 * switch would misrepresent panels with independent live state as
 * something that stops existing when you're not "on" its tab; the reversal
 * is safe here because only one thing in this tree ever had that property
 * (the relay connection), and it now drives the gating itself: every
 * screen but "identity" requires `connected`, so nothing hidden by
 * switching screens was ever doing anything a disconnected operator could
 * observe anyway. See Sidebar.tsx's own header comment for the fuller
 * version of this reasoning, and useScreenNavigation.ts for where
 * `activeScreen` and the connected-loss reset live.
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

import { LanguageProvider } from "../i18n";
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
import { Sidebar } from "../shared/ui/Sidebar";
import { StatBar } from "../shared/ui/StatBar";
import { useVouchdApp, type VouchdAppState } from "./useVouchdApp";

/** Community + Owner key: the only screen reachable before a connection exists. */
function IdentityScreen({ app }: { app: VouchdAppState }) {
  const { connection, nip07, keystore, ownerPubkey, refreshOwnerPubkey } = app;
  return (
    <>
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
    </>
  );
}

/**
 * AuditPanel has no sidebar link of its own -- its own docblock already
 * frames it as shared context between exactly two flows, re-authorizing
 * an existing member here and a fresh mint on the Register screen, so it
 * renders on both rather than picking one arbitrarily.
 */
function RegisterScreen({ app }: { app: VouchdAppState }) {
  const { keystore, passphrasePrompt, canPublish, publish, focusedAgent, setFocusedAgent, auditEntries, profiles } = app;
  return (
    <>
      <RegisterAgentPanel
        canPublish={canPublish}
        keystore={keystore}
        onMinted={setFocusedAgent}
        onPublish={publish}
        prefillPubkey={focusedAgent}
        requestPassphrase={passphrasePrompt.requestPassphrase}
      />
      <AuditPanel agentPubkey={focusedAgent} entries={auditEntries} profiles={profiles} />
    </>
  );
}

function AgentsScreen({ app }: { app: VouchdAppState }) {
  const { rows, profiles, connection, setFocusedAgent, focusedAgent, auditEntries } = app;
  return (
    <>
      <AgentsPanel onReauthorize={setFocusedAgent} profiles={profiles} rows={rows} sign={connection.signer} />
      <AuditPanel agentPubkey={focusedAgent} entries={auditEntries} profiles={profiles} />
    </>
  );
}

/** The existing list ⇄ detail toggle, unchanged -- see ChannelDetailPanel's own docblock. */
function ChannelsScreen({ app }: { app: VouchdAppState }) {
  const { channels, focusedChannel, setFocusedChannel, channelMembers, profiles } = app;
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
  return <ChannelsPanel channels={channels} onSelectChannel={setFocusedChannel} />;
}

/** Exported for tests: exercises screen switching against a hand-built
 *  `VouchdAppState`, without needing a real or faked relay connection to
 *  drive `Sidebar`'s `connected` gating (see App.render.test.tsx). */
export function AppScreens({ app }: { app: VouchdAppState }) {
  switch (app.activeScreen) {
    case "identity":
      return <IdentityScreen app={app} />;
    case "register":
      return <RegisterScreen app={app} />;
    case "agents":
      return <AgentsScreen app={app} />;
    case "channels":
      return <ChannelsScreen app={app} />;
    case "create-channel":
      return <CreateChannelPanel canPublish={app.canPublish} onCreate={app.publish} />;
    case "membership":
      return <MembershipPanel canPublish={app.canPublish} channels={app.channels} onAddMember={app.publish} rows={app.rows} />;
  }
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
  const { connection, passphrasePrompt, rows, nip07, ownerPubkey, activeScreen, setActiveScreen } = app;

  return (
    <div className="shell">
      {passphrasePrompt.pending ? <PassphrasePrompt request={passphrasePrompt.pending} /> : null}
      <Sidebar activeScreen={activeScreen} connected={app.connected} nip07={nip07} onNavigate={setActiveScreen} />
      <div className="content">
        {app.connected ? (
          <StatBar
            ownerPubkey={ownerPubkey}
            relayInfo={app.relayInfo}
            relayStatus={connection.status}
            rows={rows}
          />
        ) : null}
        <AppScreens app={app} />
      </div>
    </div>
  );
}
