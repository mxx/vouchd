/**
 * Setting up the owner key this browser will sign attestations with.
 *
 * This is the one screen where a raw secret key is typed into the page, so
 * it says why out loud rather than presenting it as routine: NIP-07 cannot
 * produce a NIP-OA signature (see src/signer/nip07Signer.ts), and no
 * attestation can be minted without a key this page can reach.
 */

import { useEffect, useState } from "react";
import type { OwnerKeystore } from "../../signer/ownerKeystore";
import { Field } from "../../shared/ui/Field";
import { ErrorText, Panel } from "../../shared/ui/Panel";

function StoredKeyView({
  ownerPubkey,
  onForget,
}: {
  ownerPubkey: string;
  onForget: () => void;
}) {
  return (
    <Panel title="Owner key">
      <p className="status">
        Encrypted in this browser: <code>{ownerPubkey}</code>
      </p>
      <p className="hint">
        It is decrypted only for the moment an attestation is signed, then wiped.
      </p>
      <button className="secondary" onClick={onForget}>
        Forget this key
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
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  return (
    <Panel title="Owner key">
      <p className="hint caveat">
        Attestations are raw Schnorr signatures over a non-event preimage, which a NIP-07
        extension cannot produce. That is why this key has to live here — encrypted at rest,
        decrypted only for the instant it signs. Pasting an already-encrypted key (ncryptsec)
        stores it as-is; the passphrase below is only checked, not re-applied.
      </p>
      <Field
        id="owner-secret"
        label="Owner secret key (64 hex, nsec, or an encrypted ncryptsec)"
        mono
        onChange={setSecret}
        type="password"
        value={secret}
      />
      <Field
        id="owner-pass"
        label="Passphrase (to encrypt it with, or to unlock an ncryptsec paste)"
        onChange={setPassphrase}
        type="password"
        value={passphrase}
      />
      <button
        disabled={!secret.trim() || !passphrase}
        onClick={() => onStore(secret.trim(), passphrase)}
      >
        Store owner key
      </button>
      <ErrorText error={error} />
    </Panel>
  );
}

export function OwnerKeyPanel({ keystore }: { keystore: OwnerKeystore }) {
  const [ownerPubkey, setOwnerPubkey] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    void keystore.ownerPubkey().then(setOwnerPubkey);
  }, [keystore]);

  async function store(secret: string, passphrase: string) {
    setError(null);
    try {
      setOwnerPubkey(await keystore.store(secret, passphrase));
    } catch (caught) {
      setError(caught);
    }
  }

  async function forget() {
    await keystore.clear();
    setOwnerPubkey(null);
  }

  if (ownerPubkey) {
    return <StoredKeyView onForget={() => void forget()} ownerPubkey={ownerPubkey} />;
  }
  return <ImportKeyForm error={error} onStore={(s, p) => void store(s, p)} />;
}
