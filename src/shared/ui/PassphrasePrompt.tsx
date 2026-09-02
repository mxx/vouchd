/**
 * The one place a passphrase (never the secret it unlocks) is typed outside
 * a feature panel's own form -- rendered from App.tsx whenever
 * `useOwnerPassphrasePrompt` has a pending request, from any signer built by
 * `ownerKeystoreSigner` (src/signer/passphraseProvider.ts). A modal rather
 * than an inline field because the request can originate from a background
 * reconnect, with no panel of its own already on screen to hold it.
 */

import { useState } from "react";
import type { PendingPassphraseRequest } from "../../app/useOwnerPassphrasePrompt";
import { useT } from "../../i18n";

export function PassphrasePrompt({ request }: { request: PendingPassphraseRequest }) {
  const t = useT();
  const [passphrase, setPassphrase] = useState("");

  function submit() {
    request.submit(passphrase);
    setPassphrase("");
  }

  return (
    <div className="modal-overlay">
      <div className="modal panel">
        <h2>{t.passphrasePrompt.title}</h2>
        <p className="hint">{request.reason}</p>
        <label htmlFor="owner-passphrase-prompt">{t.passphrasePrompt.label}</label>
        <input
          autoFocus
          id="owner-passphrase-prompt"
          onChange={(event) => setPassphrase(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && passphrase && submit()}
          type="password"
          value={passphrase}
        />
        <div className="row">
          <button disabled={!passphrase} onClick={submit}>
            {t.passphrasePrompt.unlock}
          </button>
          <button className="secondary" onClick={() => request.cancel()}>
            {t.passphrasePrompt.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
