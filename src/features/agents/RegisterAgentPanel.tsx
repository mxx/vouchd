/**
 * The core flow: attest to an agent, then hand its operator the credential.
 *
 * Note what the success state is. It is not "the agent has been added" —
 * this app cannot add an agent anywhere, because it never holds the agent's
 * key. It is a string to copy. The agent's operator pastes it into their own
 * process (as BUZZ_AUTH_TAG, if they run the Buzz harness) and the agent
 * carries it on the events it signs itself, wherever it happens to run.
 *
 * Minting works fully offline (see registerAgent.ts) — publishing an audit
 * entry afterward is a separate, best-effort step layered on top here, not
 * inside it. A disconnected operator still gets their credential; they just
 * don't get an entry in the relay's audit trail until they connect.
 */

import { useEffect, useState } from "react";
import { buildAuditEntry, type AuditAction } from "../../protocol/events/audit";
import type { EventTemplate } from "../../protocol/events/types";
import { EXPIRY_CAVEAT, describeConditions } from "./conditionsBuilder";
import {
  registerAgent,
  type RegisterAgentRequest,
  type RegisterAgentResult,
} from "./registerAgent";
import type { OwnerKeystore } from "../../signer/ownerKeystore";
import { Field } from "../../shared/ui/Field";
import { ErrorText, Panel } from "../../shared/ui/Panel";

type AuditStatus = "idle" | "not-connected" | "published" | "failed";

/** Pure: turns the form draft into what registerAgent.ts actually needs. */
function buildMintRequest(draft: MintDraft, agentPubkey: string): RegisterAgentRequest {
  const days = Number(draft.expiresInDays);
  const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000) : undefined;
  return { agentPubkey, conditions: { expiresAt }, passphrase: draft.passphrase };
}

interface RecordAuditArgs {
  agentPubkey: string;
  mint: RegisterAgentResult;
  action: AuditAction;
  canPublish: boolean;
  onPublish?: (template: EventTemplate) => Promise<void>;
  setAuditStatus: (status: AuditStatus) => void;
}

/**
 * Lifted out of the component (not just a nested closure) so it counts
 * against its own 40-line budget instead of the component's — see
 * AGENTS.md rule 2. Takes everything as arguments on purpose: no closures
 * over component state, so it reads the same as registerAgent.ts's own
 * pure style.
 */
async function recordAudit({
  agentPubkey,
  mint,
  action,
  canPublish,
  onPublish,
  setAuditStatus,
}: RecordAuditArgs): Promise<void> {
  if (!canPublish || !onPublish) {
    setAuditStatus("not-connected");
    return;
  }
  try {
    await onPublish(buildAuditEntry(action, agentPubkey, mint.authTag));
    setAuditStatus("published");
  } catch {
    setAuditStatus("failed");
  }
}

function AuditNote({ status }: { status: AuditStatus }) {
  if (status === "published") return <p className="hint">Recorded on the relay&apos;s audit trail.</p>;
  if (status === "not-connected") {
    return <p className="hint caveat">Not connected — this action was not recorded on the relay.</p>;
  }
  if (status === "failed") {
    return <p className="hint caveat">Could not record this on the relay&apos;s audit trail.</p>;
  }
  return null;
}

function IssuedCredential({
  result,
  auditStatus,
}: {
  result: RegisterAgentResult;
  auditStatus: AuditStatus;
}) {
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
      <AuditNote status={auditStatus} />
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

export function RegisterAgentPanel({
  keystore,
  prefillPubkey,
  canPublish,
  onPublish,
  onMinted,
}: {
  keystore: OwnerKeystore;
  /**
   * Set when the operator clicks "re-authorize" on an agent. Renewal is the
   * only way to narrow trust over time — NIP-OA has no revocation — so the
   * flow that the copy recommends has to be one click, not a re-paste. Its
   * presence also decides the audit action: "renew" instead of "register".
   */
  prefillPubkey?: string;
  /** Whether a relay connection and a signer are available to record this mint on the audit trail. */
  canPublish: boolean;
  onPublish?: (template: EventTemplate) => Promise<void>;
  /** Called after a successful mint, so the app can bring that agent's audit trail into view. */
  onMinted?: (agentPubkey: string) => void;
}) {
  const [draft, setDraft] = useState<MintDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (prefillPubkey) setDraft({ ...EMPTY_DRAFT, agentPubkey: prefillPubkey });
  }, [prefillPubkey]);

  const [result, setResult] = useState<RegisterAgentResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatus>("idle");

  async function mint(): Promise<void> {
    setError(null);
    setResult(null);
    setAuditStatus("idle");
    const agentPubkey = draft.agentPubkey.trim().toLowerCase();
    try {
      const minted = await registerAgent(keystore, buildMintRequest(draft, agentPubkey));
      setResult(minted);
      setDraft({ ...draft, passphrase: "" });
      onMinted?.(agentPubkey);
      await recordAudit({
        agentPubkey,
        mint: minted,
        action: prefillPubkey ? "renew" : "register",
        canPublish,
        onPublish,
        setAuditStatus,
      });
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
      {result ? <IssuedCredential auditStatus={auditStatus} result={result} /> : null}
    </Panel>
  );
}
