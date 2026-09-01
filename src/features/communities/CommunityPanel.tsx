/**
 * Which relay this app is pointed at, and whether it's connected.
 *
 * A relay URL *is* a community in Buzz's model — the host selects it — so
 * this panel is the closest thing the app has to a "workspace picker". The
 * URL is remembered in localStorage because retyping a relay on every reload
 * is friction with no upside; nothing secret is stored there.
 */

import { useState } from "react";
import type { ConnectionStatus } from "../../protocol/relayClient";
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
  onConnect,
  onDisconnect,
}: {
  status: ConnectionStatus;
  error: unknown;
  /** The relay's last NOTICE, if any -- see useCommunityConnection. */
  notice?: string | null;
  onConnect: (relayUrl: string) => void;
  onDisconnect: () => void;
}) {
  const [relayUrl, setRelayUrl] = useState(loadRelayUrl());
  const connected = status === "open" || status === "authenticated";

  function connect() {
    rememberRelayUrl(relayUrl);
    onConnect(relayUrl.trim());
  }

  return (
    <Panel title="Community">
      <div className="row">
        <div>
          <label htmlFor="relay-url">Relay URL</label>
          <input
            className="mono"
            disabled={connected}
            id="relay-url"
            onChange={(event) => setRelayUrl(event.target.value)}
            placeholder="wss://relay.example"
            value={relayUrl}
          />
        </div>
        <button onClick={connected ? onDisconnect : connect} disabled={!relayUrl.trim()}>
          {connected ? "Disconnect" : "Connect"}
        </button>
      </div>
      <p className="status">Status: {status}</p>
      {notice ? <p className="hint">Relay says: {notice}</p> : null}
      <ErrorText error={error} />
    </Panel>
  );
}
