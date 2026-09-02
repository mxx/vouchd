/**
 * Which relay this app is pointed at, whether it's connected, and -- since
 * that decision must never be made silently (docs/ARCHITECTURE.md) -- which
 * identity signs for this connection.
 *
 * A relay URL *is* a community in Buzz's model — the host selects it — so
 * this panel is the closest thing the app has to a "workspace picker". The
 * URL is remembered in localStorage because retyping a relay on every reload
 * is friction with no upside; nothing secret is stored there. The identity
 * choice is NOT remembered: picking it is exactly the moment the owner
 * decides which signing capability to trust for this session, and defaulting
 * it from a previous visit would quietly make that decision for them again.
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

function IdentityChoice({
  value,
  onChange,
  disabled,
}: {
  value: IdentitySource;
  onChange: (next: IdentitySource) => void;
  disabled: boolean;
}) {
  const t = useT();
  return (
    <div>
      <label htmlFor="identity-source">{t.community.signInAsLabel}</label>
      <select
        disabled={disabled}
        id="identity-source"
        onChange={(event) => onChange(event.target.value as IdentitySource)}
        value={value}
      >
        <option value="nip07">{t.community.nip07Option}</option>
        <option value="ownerKey">{t.community.ownerKeyOption}</option>
      </select>
    </div>
  );
}

export function CommunityPanel({
  status,
  error,
  notice,
  onConnect,
  onDisconnect,
}: {
  status: ConnectionStatus;
  error: unknown;
  /** The relay's last NOTICE, if any -- see useCommunityConnection. */
  notice?: string | null;
  onConnect: (relayUrl: string, identitySource: IdentitySource) => void;
  onDisconnect: () => void;
}) {
  const t = useT();
  const [relayUrl, setRelayUrl] = useState(loadRelayUrl());
  const [identitySource, setIdentitySource] = useState<IdentitySource>("nip07");
  const connected = status === "open" || status === "authenticated";

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
        <IdentityChoice disabled={connected} onChange={setIdentitySource} value={identitySource} />
        <button onClick={connected ? onDisconnect : connect} disabled={!relayUrl.trim()}>
          {connected ? t.community.disconnect : t.community.connect}
        </button>
      </div>
      <p className="status">{t.community.status(status)}</p>
      {notice ? <p className="hint">{t.community.relaySays(notice)}</p> : null}
      <ErrorText error={error} />
    </Panel>
  );
}
