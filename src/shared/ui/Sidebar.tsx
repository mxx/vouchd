/**
 * The app shell's left rail: brand, jump links to every panel (grouped the
 * way the panels are actually related, not alphabetically), and which
 * identity a NIP-07 extension is offering. The language picker lives in
 * App.tsx's header instead (src/shared/ui/LanguageSelect.tsx) -- see that
 * file for why.
 *
 * Nav entries are anchor links to each panel's `id` (Panel.tsx), not a
 * router: every panel already renders on this one page (see App.tsx's own
 * header comment on why), so a real tab that hid the others would be
 * fake affordance for a thing this app doesn't do. A jump link is the
 * honest version of "a sidebar that goes somewhere."
 */

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

export function Sidebar({ nip07 }: { nip07: Nip07State }) {
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
          <a className="nav-link" href="#community"><IconCommunity /> {t.nav.community}</a>
          <a className="nav-link" href="#owner-key"><IconOwnerKey /> {t.nav.ownerKey}</a>
        </div>

        <div className="nav-group">
          <p className="nav-group-label">{t.nav.groupAgents}</p>
          <a className="nav-link" href="#agents"><IconAgents /> {t.nav.agents}</a>
          <a className="nav-link" href="#register"><IconAgents /> {t.nav.register}</a>
        </div>

        <div className="nav-group">
          <p className="nav-group-label">{t.nav.groupChannels}</p>
          <a className="nav-link" href="#create-channel"><IconChannels /> {t.nav.createChannel}</a>
          <a className="nav-link" href="#membership"><IconChannels /> {t.nav.membership}</a>
        </div>
      </div>

      <div className="sidebar-foot">
        <IdentityChip nip07={nip07} />
        <p className="foot-tag">{t.app.noBackend}</p>
      </div>
    </nav>
  );
}
