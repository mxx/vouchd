/**
 * Setting up the owner key this browser will sign attestations with.
 *
 * This is the one screen where a raw secret key is typed into the page, so
 * it says why out loud rather than presenting it as routine: NIP-07 cannot
 * produce a NIP-OA signature (see src/signer/nip07Signer.ts), and no
 * attestation can be minted without a key this page can reach.
 *
 * `ownerPubkey` is passed in (src/app/useOwnerPubkey.ts) rather than read
 * here directly: the stat bar needs the same fact, and reading it in two
 * places risked the two disagreeing for a render.
 */

import { useState } from "react";
import type { OwnerKeystore } from "../../signer/ownerKeystore";
import { useT } from "../../i18n";
import { Field } from "../../shared/ui/Field";
import { ErrorText, Panel } from "../../shared/ui/Panel";

function StoredKeyView({
  ownerPubkey,
  onForget,
}: {
  ownerPubkey: string;
  onForget: () => void;
}) {
  const t = useT();
  return (
    <Panel title={t.ownerKey.title}>
      <p className="status">
        {t.ownerKey.storedPrefix} <code>{ownerPubkey}</code>
      </p>
      <p className="hint">{t.ownerKey.decryptHint}</p>
      <button className="secondary" onClick={onForget}>
        {t.ownerKey.forget}
      </button>
    </Panel>
  );
}

function ImportKeyForm({
  onStore,
  error,
}: {
  onStore: (secret: string, passphrase: string) => void;
  error: unknown;
}) {
  const t = useT();
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  return (
    <Panel title={t.ownerKey.title}>
      <p className="hint caveat">{t.ownerKey.caveat}</p>
      <Field
        id="owner-secret"
        label={t.ownerKey.secretLabel}
        mono
        onChange={setSecret}
        type="password"
        value={secret}
      />
      <Field
        id="owner-pass"
        label={t.ownerKey.passphraseLabel}
        onChange={setPassphrase}
        type="password"
        value={passphrase}
      />
      <button
        disabled={!secret.trim() || !passphrase}
        onClick={() => onStore(secret.trim(), passphrase)}
      >
        {t.ownerKey.store}
      </button>
      <ErrorText error={error} />
    </Panel>
  );
}

export function OwnerKeyPanel({
  keystore,
  ownerPubkey,
  onChanged,
}: {
  keystore: OwnerKeystore;
  /** Null when no key is stored yet -- see src/app/useOwnerPubkey.ts. */
  ownerPubkey: string | null;
  /** Called after a successful store() or clear(), so the parent can refresh. */
  onChanged: () => void;
}) {
  const [error, setError] = useState<unknown>(null);

  async function store(secret: string, passphrase: string) {
    setError(null);
    try {
      await keystore.store(secret, passphrase);
      onChanged();
    } catch (caught) {
      setError(caught);
    }
  }

  async function forget() {
    await keystore.clear();
    onChanged();
  }

  if (ownerPubkey) {
    return <StoredKeyView onForget={() => void forget()} ownerPubkey={ownerPubkey} />;
  }
  return <ImportKeyForm error={error} onStore={(s, p) => void store(s, p)} />;
}
