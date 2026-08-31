/**
 * The core flow: attest to an agent, then hand its operator the credential.
 *
 * Note what the success state is. It is not "the agent has been added" —
 * this app cannot add an agent anywhere, because it never holds the agent's
 * key. It is a string to copy. The agent's operator pastes it into their own
 * process (as BUZZ_AUTH_TAG, if they run the Buzz harness) and the agent
 * carries it on the events it signs itself, wherever it happens to run.
 */

import { useState } from "react";
import { EXPIRY_CAVEAT, describeConditions } from "./conditionsBuilder";
import { registerAgent, type RegisterAgentResult } from "./registerAgent";
import type { OwnerKeystore } from "../../signer/ownerKeystore";
import { Field } from "../../shared/ui/Field";
import { ErrorText, Panel } from "../../shared/ui/Panel";

function IssuedCredential({ result }: { result: RegisterAgentResult }) {
  return (
    <>
      <p className="hint">
        Give this to whoever runs the agent — it goes in the agent&apos;s environment (e.g.
        <code> BUZZ_AUTH_TAG</code>), and the agent attaches it to the events it signs.
      </p>
      <pre className="result">{result.authTagJson}</pre>
      <ul className="hint">
        {describeConditions(result.conditions).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="hint caveat">{EXPIRY_CAVEAT}</p>
    </>
  );
}

function MintForm({
  agentPubkey,
  expiresInDays,
  passphrase,
  onChange,
  onSubmit,
}: {
  agentPubkey: string;
  expiresInDays: string;
  passphrase: string;
  onChange: (patch: { agentPubkey?: string; expiresInDays?: string; passphrase?: string }) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <Field
        id="agent-pubkey"
        label="Agent public key (64 hex)"
        mono
        onChange={(value) => onChange({ agentPubkey: value })}
        placeholder="the key its operator generated — never its secret"
        value={agentPubkey}
      />
      <Field
        id="expires"
        label="Valid for (days, 0 for no expiry)"
        min="0"
        onChange={(value) => onChange({ expiresInDays: value })}
        type="number"
        value={expiresInDays}
      />
      <Field
        id="mint-pass"
        label="Owner key passphrase"
        onChange={(value) => onChange({ passphrase: value })}
        type="password"
        value={passphrase}
      />
      <button disabled={!agentPubkey.trim() || !passphrase} onClick={onSubmit}>
        Sign attestation
      </button>
    </>
  );
}

interface MintDraft {
  agentPubkey: string;
  expiresInDays: string;
  passphrase: string;
}

const EMPTY_DRAFT: MintDraft = { agentPubkey: "", expiresInDays: "90", passphrase: "" };

export function RegisterAgentPanel({ keystore }: { keystore: OwnerKeystore }) {
  const [draft, setDraft] = useState<MintDraft>(EMPTY_DRAFT);
  const [result, setResult] = useState<RegisterAgentResult | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function mint() {
    setError(null);
    setResult(null);
    try {
      const days = Number(draft.expiresInDays);
      const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000) : undefined;
      setResult(
        await registerAgent(keystore, {
          agentPubkey: draft.agentPubkey,
          conditions: { expiresAt },
          passphrase: draft.passphrase,
        }),
      );
      setDraft({ ...draft, passphrase: "" });
    } catch (caught) {
      setError(caught);
    }
  }

  return (
    <Panel title="Authorize an agent">
      <MintForm
        {...draft}
        onChange={(patch) => setDraft({ ...draft, ...patch })}
        onSubmit={() => void mint()}
      />
      <ErrorText error={error} />
      {result ? <IssuedCredential result={result} /> : null}
    </Panel>
  );
}
