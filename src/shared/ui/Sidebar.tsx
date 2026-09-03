/**
 * The app shell's left rail: brand, screen switcher (grouped the way the
 * panels are actually related, not alphabetically), and which identity a
 * NIP-07 extension is offering. The language picker lives in App.tsx's
 * header instead (src/shared/ui/LanguageSelect.tsx) -- see that file for
 * why.
 *
 * Nav entries used to be anchor links into one long page, deliberately not
 * a router -- every panel rendered simultaneously, so no tab could
 * meaningfully hide anything, and a fake tab switch would have been
 * dishonest UI. That's no longer true: App.tsx now renders exactly one
 * screen at a time (`activeScreen`), so an anchor would silently do
 * nothing. This is a deliberate reversal of that earlier decision, not a
 * lapse back into "fake tabs" -- requested explicitly because most screens
 * have nothing meaningful to show before a relay connection succeeds, and
 * gating navigation on that says so instead of exposing empty or broken
 * panels. Only "identity" (Community + Owner key) is reachable before a
 * connection exists; it's also where a lost connection falls back to (see
 * useScreenNavigation.ts's reset effect).
 */

import type { ReactNode } from "react";
import type { Screen } from "../../app/useVouchdApp";
import type { Nip07State } from "../../app/useNip07";
import { useT } from "../../i18n";
import { IconAgents, IconChannels, IconCommunity, IconOwnerKey } from "./icons";

function IdentityChip({ nip07 }: { nip07: Nip07State }) {
  const t = useT();
  const text = !nip07.available
    ? t.identity.readOnly
    : nip07.pubkey
      ? t.identity.signingAs(nip07.pubkey.slice(0, 12))
      : t.identity.awaitingPermission;
  return (
    <div className="identity-chip">
      <span className={`dot ${nip07.pubkey ? "online" : "offline"}`} />
      {text}
    </div>
  );
}

/** "identity" is the only screen reachable without a connection -- every other one is gated on `connected`. */
function NavItem({
  screen,
  icon,
  label,
  activeScreen,
  connected,
  onNavigate,
}: {
  screen: Screen;
  icon: ReactNode;
  label: string;
  activeScreen: Screen;
  connected: boolean;
  onNavigate: (screen: Screen) => void;
}) {
  const t = useT();
  const disabled = screen !== "identity" && !connected;
  return (
    <button
      aria-current={activeScreen === screen ? "page" : undefined}
      className="nav-link"
      disabled={disabled}
      onClick={() => onNavigate(screen)}
      title={disabled ? t.nav.connectFirst : undefined}
      type="button"
    >
      {icon} {label}
    </button>
  );
}

/** One `<NavItem>` call, its five identical props factored out of every call site below. */
function navItem(
  screen: Screen,
  icon: ReactNode,
  label: string,
  activeScreen: Screen,
  connected: boolean,
  onNavigate: (screen: Screen) => void,
) {
  return (
    <NavItem
      activeScreen={activeScreen}
      connected={connected}
      icon={icon}
      label={label}
      onNavigate={onNavigate}
      screen={screen}
    />
  );
}

export function Sidebar({
  nip07,
  activeScreen,
  connected,
  onNavigate,
}: {
  nip07: Nip07State;
  activeScreen: Screen;
  connected: boolean;
  onNavigate: (screen: Screen) => void;
}) {
  const t = useT();

  return (
    <nav className="sidebar">
      <div className="sidebar-main">
        <div className="brand">
          <div className="brand-glyph">V</div>
          <p className="brand-name">{t.app.title}</p>
        </div>
        <p className="brand-tag">{t.app.tagline}</p>

        <div className="nav-group">
          <p className="nav-group-label">{t.nav.groupIdentity}</p>
          {navItem("identity", <IconCommunity />, t.nav.community, activeScreen, connected, onNavigate)}
          {navItem("identity", <IconOwnerKey />, t.nav.ownerKey, activeScreen, connected, onNavigate)}
        </div>

        <div className="nav-group">
          <p className="nav-group-label">{t.nav.groupAgents}</p>
          {navItem("agents", <IconAgents />, t.nav.agents, activeScreen, connected, onNavigate)}
          {navItem("register", <IconAgents />, t.nav.register, activeScreen, connected, onNavigate)}
        </div>

        <div className="nav-group">
          <p className="nav-group-label">{t.nav.groupChannels}</p>
          {navItem("channels", <IconChannels />, t.nav.channelList, activeScreen, connected, onNavigate)}
          {navItem("create-channel", <IconChannels />, t.nav.createChannel, activeScreen, connected, onNavigate)}
          {navItem("membership", <IconChannels />, t.nav.membership, activeScreen, connected, onNavigate)}
        </div>
      </div>

      <div className="sidebar-foot">
        <IdentityChip nip07={nip07} />
        <p className="foot-tag">{t.app.noBackend}</p>
      </div>
    </nav>
  );
}
