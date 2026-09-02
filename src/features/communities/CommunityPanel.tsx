/**
 * Which relay this app is pointed at, whether it's connected, and -- since
 * that decision must never be made silently (docs/ARCHITECTURE.md) -- which
 * identity signs for this connection.
 *
 * A relay URL *is* a community in Buzz's model — the host selects it — so
 * this panel is the closest thing the app has to a "workspace picker". The
 * URL is remembered in localStorage because retyping a relay on every reload
 * is friction with no upside; nothing secret is stored there.
 *
 * The identity is no longer a manual choice: a NIP-07 extension, when
 * present, is strictly more capable (no passphrase prompt, no plaintext
 * secret ever touches this page) and is always preferred; the owner key is
 * the fallback for a browser with no extension. There was never a real
 * decision for the owner to make here -- picking "owner key" while an
 * extension was available just meant typing a passphrase for no reason, and
 * picking "NIP-07" with none installed silently produced a read-only
 * connection. Auto-selecting removes a control with only one sensible
 * setting; the identity is still shown below, not hidden, so "which key
 * signs" stays visible even though it's no longer clicked.
 */

import { useState } from "react";
import type { ConnectionStatus } from "../../protocol/relayClient";
import type { IdentitySource } from "../../app/useCommunityConnection";
import { useT } from "../../i18n";
import { ErrorText, Panel } from "../../shared/ui/Panel";

const STORAGE_KEY = "vouchd.relayUrl";

export function loadRelayUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberRelayUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url);
  } catch {
    // A browser with storage disabled is still perfectly usable; the URL
    // just won't survive a reload. Not worth interrupting the user over.
  }
}

export function CommunityPanel({
  status,
  error,
  notice,
  historyMayBeIncomplete,
  nip07Available,
  onConnect,
  onDisconnect,
}: {
  status: ConnectionStatus;
  error: unknown;
  /** The relay's last NOTICE, if any -- see useCommunityConnection. */
  notice?: string | null;
  /**
   * Set once the structural backfill looks like it hit its page-sized
   * limit -- see useCommunityConnection. Rendered as its own hint, not
   * folded into `notice`: that phrase means "the relay said X", and this
   * is a client-side inference the relay never stated.
   */
  historyMayBeIncomplete?: boolean;
  /** Whether a NIP-07 extension is present -- see src/app/useNip07.ts. */
  nip07Available: boolean;
  onConnect: (relayUrl: string, identitySource: IdentitySource) => void;
  onDisconnect: () => void;
}) {
  const t = useT();
  const [relayUrl, setRelayUrl] = useState(loadRelayUrl());
  const connected = status === "open" || status === "authenticated";
  // NIP-07 wins whenever it's there (see header comment); the owner key
  // fallback still needs a key stored to actually sign anything, but that
  // failure (no key yet) is reported the same way it already was when this
  // was a manual choice, so it isn't special-cased here.
  const identitySource: IdentitySource = nip07Available ? "nip07" : "ownerKey";
  const identityLabel = nip07Available ? t.community.nip07Option : t.community.ownerKeyOption;

  function connect() {
    rememberRelayUrl(relayUrl);
    onConnect(relayUrl.trim(), identitySource);
  }

  return (
    <Panel id="community" title={t.community.title}>
      <div className="row">
        <div>
          <label htmlFor="relay-url">{t.community.relayUrlLabel}</label>
          <input
            className="mono"
            disabled={connected}
            id="relay-url"
            onChange={(event) => setRelayUrl(event.target.value)}
            placeholder={t.community.relayUrlPlaceholder}
            value={relayUrl}
          />
        </div>
        <button onClick={connected ? onDisconnect : connect} disabled={!relayUrl.trim()}>
          {connected ? t.community.disconnect : t.community.connect}
        </button>
      </div>
      <p className="hint">
        {t.community.signInAsLabel}: {identityLabel}
      </p>
      <p className="status">{t.community.status(status)}</p>
      {notice ? <p className="hint">{t.community.relaySays(notice)}</p> : null}
      {historyMayBeIncomplete ? <p className="hint">{t.community.historyMayBeIncomplete}</p> : null}
      <ErrorText error={error} />
    </Panel>
  );
}
