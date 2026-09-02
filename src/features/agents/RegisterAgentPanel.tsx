/**
 * The core flow: attest to a member's key, then hand its operator the
 * credential.
 *
 * NIP-OA doesn't care whether the pubkey being attested is a bot or a
 * person operating semi-autonomously -- "the owner vouches for this key
 * under these conditions" is the whole primitive, and Buzz's own framing
 * of the *agent* case (a process that can't produce an interactive NIP-07
 * signature the way a human's browser extension can) is just the first,
 * most common reason to reach for it, not a restriction this panel needs
 * to enforce. Hence "member", not "agent", in the copy below.
 *
 * Note what the success state is. It is not "the member has been added" —
 * this app cannot add anyone anywhere, because it never holds their key.
 * It is a string to copy. Its operator pastes it into their own process (as
 * BUZZ_AUTH_TAG, if they run the Buzz harness) and carries it on the events
 * they sign themselves, wherever that happens to run.
 *
 * Minting works fully offline (see registerAgent.ts) — publishing an audit
 * entry afterward is a separate, best-effort step layered on top here, not
 * inside it. A disconnected operator still gets their credential; they just
 * don't get an entry in the relay's audit trail until they connect.
 *
 * The passphrase needed to mint is asked for through the shared
 * `<PassphrasePrompt>` (`requestPassphrase`, rendered once from App.tsx),
 * not an inline field here: a field here just meant re-typing it a second
 * time whenever this mint's audit entry also happened to need one (day-to-
 * day publishing, when the connection's chosen identity is the owner key)
 * -- two prompts for one passphrase, with no indication why.
 */

import { useEffect, useState } from "react";
import { buildAuditEntry, type AuditAction } from "../../protocol/events/audit";
import type { EventTemplate } from "../../protocol/events/types";
import { describeConditions } from "./conditionsBuilder";
import {
  registerAgent,
  type RegisterAgentRequest,
  type RegisterAgentResult,
} from "./registerAgent";
import type { OwnerKeystore } from "../../signer/ownerKeystore";
import type { PassphraseProvider } from "../../signer/passphraseProvider";
import { useT } from "../../i18n";
import type { Messages } from "../../i18n/messages";
import { Field } from "../../shared/ui/Field";
import { normalizePubkey } from "../../protocol/events/validate";
import { ErrorText, Panel } from "../../shared/ui/Panel";

type AuditStatus = "idle" | "not-connected" | "published" | "failed";

/** Pure: turns the form draft into what registerAgent.ts actually needs. */
function buildMintRequest(draft: MintDraft, agentPubkey: string, passphrase: string): RegisterAgentRequest {
  const days = Number(draft.expiresInDays);
  const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000) : undefined;
  return { agentPubkey, conditions: { expiresAt }, passphrase };
}

interface MintAndRecordArgs {
  draft: MintDraft;
  prefillPubkey?: string;
  keystore: OwnerKeystore;
  requestPassphrase: PassphraseProvider;
  canPublish: boolean;
  onPublish?: (template: EventTemplate) => Promise<void>;
  onMinted?: (agentPubkey: string) => void;
  reasonFor: Messages["register"]["reasonNew"];
  setResult: (result: RegisterAgentResult) => void;
  setError: (error: unknown) => void;
  setAuditStatus: (status: AuditStatus) => void;
  setAuditError: (error: unknown) => void;
}

/**
 * Lifted out of the component (not just a nested closure) so it counts
 * against its own 40-line budget instead of the component's — see
 * AGENTS.md rule 2 and recordAudit()'s own comment just below.
 */
async function mintAndRecord({
  draft,
  prefillPubkey,
  keystore,
  requestPassphrase,
  canPublish,
  onPublish,
  onMinted,
  reasonFor,
  setResult,
  setError,
  setAuditStatus,
  setAuditError,
}: MintAndRecordArgs): Promise<void> {
  try {
    const agentPubkey = normalizePubkey(draft.agentPubkey);
    const reason = reasonFor(agentPubkey.slice(0, 12));
    const passphrase = await requestPassphrase({ reason });
    const minted = await registerAgent(keystore, buildMintRequest(draft, agentPubkey, passphrase));
    setResult(minted);
    onMinted?.(agentPubkey);
    await recordAudit({
      agentPubkey,
      mint: minted,
      action: prefillPubkey ? "renew" : "register",
      canPublish,
      onPublish,
      setAuditStatus,
      setAuditError,
    });
  } catch (caught) {
    setError(caught);
  }
}

interface RecordAuditArgs {
  agentPubkey: string;
  mint: RegisterAgentResult;
  action: AuditAction;
  canPublish: boolean;
  onPublish?: (template: EventTemplate) => Promise<void>;
  setAuditStatus: (status: AuditStatus) => void;
  setAuditError: (error: unknown) => void;
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
  setAuditError,
}: RecordAuditArgs): Promise<void> {
  if (!canPublish || !onPublish) {
    setAuditStatus("not-connected");
    return;
  }
  try {
    await onPublish(buildAuditEntry(action, agentPubkey, mint.authTag));
    setAuditStatus("published");
  } catch (caught) {
    setAuditStatus("failed");
    setAuditError(caught);
  }
}

function AuditNote({ status, error }: { status: AuditStatus; error: unknown }) {
  const t = useT();
  if (status === "published") return <p className="hint">{t.register.auditPublished}</p>;
  if (status === "not-connected") {
    return <p className="hint caveat">{t.register.auditNotConnected}</p>;
  }
  if (status === "failed") {
    return (
      <>
        <p className="hint caveat">{t.register.auditFailedIntro}</p>
        <ErrorText error={error} />
      </>
    );
  }
  return null;
}

function IssuedCredential({
  result,
  auditStatus,
  auditError,
}: {
  result: RegisterAgentResult;
  auditStatus: AuditStatus;
  auditError: unknown;
}) {
  const t = useT();
  return (
    <>
      <p className="hint">
        {t.register.giveToPrefix}
        <code> BUZZ_AUTH_TAG</code>
        {t.register.giveToSuffix}
      </p>
      <pre className="result">{result.authTagJson}</pre>
      <ul className="hint">
        {describeConditions(result.conditions, t.conditions).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="hint caveat">{t.conditions.expiryCaveat}</p>
      <AuditNote error={auditError} status={auditStatus} />
    </>
  );
}

function MintForm({
  agentPubkey,
  expiresInDays,
  onChange,
  onSubmit,
}: {
  agentPubkey: string;
  expiresInDays: string;
  onChange: (patch: { agentPubkey?: string; expiresInDays?: string }) => void;
  onSubmit: () => void;
}) {
  const t = useT();
  return (
    <>
      <Field
        id="agent-pubkey"
        label={t.register.pubkeyLabel}
        mono
        onChange={(value) => onChange({ agentPubkey: value })}
        placeholder={t.register.pubkeyPlaceholder}
        value={agentPubkey}
      />
      <Field
        id="expires"
        label={t.register.expiresLabel}
        min="0"
        onChange={(value) => onChange({ expiresInDays: value })}
        type="number"
        value={expiresInDays}
      />
      <button disabled={!agentPubkey.trim()} onClick={onSubmit}>
        {t.register.submit}
      </button>
    </>
  );
}

interface MintDraft {
  agentPubkey: string;
  expiresInDays: string;
}

const EMPTY_DRAFT: MintDraft = { agentPubkey: "", expiresInDays: "90" };

export function RegisterAgentPanel({
  keystore,
  requestPassphrase,
  prefillPubkey,
  canPublish,
  onPublish,
  onMinted,
}: {
  keystore: OwnerKeystore;
  /** Asks for the owner passphrase through the shared modal -- see this file's header comment. */
  requestPassphrase: PassphraseProvider;
  /**
   * Set when the operator clicks "re-authorize" on an existing row. Renewal
   * is the only way to narrow trust over time — NIP-OA has no revocation —
   * so the flow that the copy recommends has to be one click, not a
   * re-paste. Its presence also decides the audit action: "renew" instead
   * of "register".
   */
  prefillPubkey?: string;
  /** Whether a relay connection and a signer are available to record this mint on the audit trail. */
  canPublish: boolean;
  onPublish?: (template: EventTemplate) => Promise<void>;
  /** Called after a successful mint, so the app can bring that member's audit trail into view. */
  onMinted?: (agentPubkey: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<MintDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (prefillPubkey) setDraft({ ...EMPTY_DRAFT, agentPubkey: prefillPubkey });
  }, [prefillPubkey]);

  const [result, setResult] = useState<RegisterAgentResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatus>("idle");
  const [auditError, setAuditError] = useState<unknown>(null);

  async function mint(): Promise<void> {
    setError(null);
    setResult(null);
    setAuditStatus("idle");
    setAuditError(null);
    await mintAndRecord({
      canPublish,
      draft,
      keystore,
      onMinted,
      onPublish,
      prefillPubkey,
      reasonFor: prefillPubkey ? t.register.reasonRenew : t.register.reasonNew,
      requestPassphrase,
      setAuditError,
      setAuditStatus,
      setError,
      setResult,
    });
  }

  return (
    <Panel id="register" title={t.register.title}>
      <MintForm
        {...draft}
        onChange={(patch) => setDraft({ ...draft, ...patch })}
        onSubmit={() => void mint()}
      />
      <ErrorText error={error} />
      {result ? <IssuedCredential auditError={auditError} auditStatus={auditStatus} result={result} /> : null}
    </Panel>
  );
}
