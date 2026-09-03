/**
 * Owns the session lifecycle so App stays a composition root.
 *
 * The signer is wired in here rather than inside VouchdSession: the session
 * takes signing as a dependency (protocol code must never reach for a key on
 * its own), and this is the layer that legitimately knows which identity
 * this connection uses.
 *
 * `IdentitySource` is decided by `connect()`'s caller (see CommunityPanel:
 * NIP-07 whenever it's present, the owner key otherwise -- there's no
 * manual override left, because a human choosing "owner key" while an
 * extension was available never did anything but ask for a passphrase it
 * didn't need). What matters is that the choice is still *shown*, not made
 * silently: NIP-07 and OwnerKeystore are both a raw signing capability
 * living in this browser, and the owner can always see which one a
 * connection is about to use. The SAME signer is used for both NIP-42 AUTH
 * and every event this app publishes afterward -- one connection is one
 * identity, not two.
 */

import { type Dispatch, type SetStateAction, useState } from "react";
import { useT } from "../i18n";
import type { ConnectionStatus } from "../protocol/relayClient";
import type { ReadModelDb } from "../readmodel/db";
import { hasNip07, signEventWithNip07, type SignEvent } from "../signer/nip07Signer";
import type { OwnerKeystore } from "../signer/ownerKeystore";
import { ownerKeystoreSigner, type PassphraseProvider } from "../signer/passphraseProvider";
import { VouchdSession } from "./session";

/** Which signing capability this connection's AUTH and publishes go through. */
export type IdentitySource = "nip07" | "ownerKey";

export interface CommunityConnection {
  session: VouchdSession | null;
  status: ConnectionStatus;
  error: unknown;
  /**
   * The relay's most recent NOTICE text (often the reason AUTH or a publish
   * was rejected). `status` alone can only show *that* the connection
   * bounced, not *why* -- this is why. Cleared on every fresh connect.
   */
  notice: string | null;
  /**
   * Whether the current session was connected with a signer that can
   * actually publish -- e.g. `identitySource: "nip07"` chosen while no
   * extension is installed still opens a read-only connection, and callers
   * (useVouchdApp's `canPublish`) need to tell that apart from `session`
   * merely being non-null.
   */
  canPublish: boolean;
  /** The signer this connection's AUTH and publishes actually use, if any
   *  -- e.g. picture-loading (AgentsPanel) reuses it rather than assuming
   *  NIP-07, since owner-key connections sign just as validly. */
  signer: SignEvent | undefined;
  /**
   * Set once if the session's structural backfill (channels, membership,
   * audit log) appears to have hit its page-sized limit -- see
   * `session.ts`'s `onHistoryTruncated`. Distinct from `notice`: this is
   * this client's own inference from an event count, not something the
   * relay said.
   */
  historyMayBeIncomplete: boolean;
  /** The relay this connection is (or was) talking to, or null before a first connect() -- e.g. for a NIP-11 fetch. */
  relayUrl: string | null;
  connect: (relayUrl: string, identitySource: IdentitySource) => void;
  disconnect: () => void;
}

/** No NIP-07 signer is offered when no extension is present -- read-only, not a thrown error. */
function buildSigner(
  identitySource: IdentitySource,
  keystore: OwnerKeystore,
  requestPassphrase: PassphraseProvider,
  authReason: string,
): SignEvent | undefined {
  if (identitySource === "nip07") return hasNip07() ? signEventWithNip07 : undefined;
  return ownerKeystoreSigner(keystore, requestPassphrase, authReason);
}

function buildSessionDeps(
  db: ReadModelDb,
  signer: SignEvent | undefined,
  setStatus: (status: ConnectionStatus) => void,
  setNotice: (notice: string | null) => void,
  setHistoryMayBeIncomplete: (value: boolean) => void,
): ConstructorParameters<typeof VouchdSession>[1] {
  return {
    db,
    signEvent: signer,
    signAuthEvent: signer,
    onStatusChange: setStatus,
    onNotice: setNotice,
    onHistoryTruncated: () => setHistoryMayBeIncomplete(true),
  };
}

/** connect()'s full body, extracted so the hook itself stays under the 40-line limit (AGENTS.md rule 2). */
function startConnection(
  db: ReadModelDb,
  keystore: OwnerKeystore,
  requestPassphrase: PassphraseProvider,
  authReason: string,
  relayUrl: string,
  identitySource: IdentitySource,
  setters: {
    setSession: (session: VouchdSession | null) => void;
    setStatus: (status: ConnectionStatus) => void;
    setError: (error: unknown) => void;
    setNotice: (notice: string | null) => void;
    setCanPublish: (value: boolean) => void;
    // Dispatch, not a plain setter: signer is itself a function, so the
    // call below stores it via the updater-form overload (see the comment
    // there) -- a plain `(signer) => void` param type loses that overload
    // and makes TS check the updater arrow against `SignEvent` itself.
    setSigner: Dispatch<SetStateAction<SignEvent | undefined>>;
    setHistoryMayBeIncomplete: (value: boolean) => void;
    setRelayUrl: (relayUrl: string | null) => void;
  },
): void {
  setters.setError(null);
  setters.setNotice(null);
  setters.setHistoryMayBeIncomplete(false);
  setters.setRelayUrl(relayUrl);
  const signer = buildSigner(identitySource, keystore, requestPassphrase, authReason);
  setters.setCanPublish(Boolean(signer));
  // A plain `setSigner(signer)` would be wrong: signer is itself a
  // function, and React's setState treats a function argument as an
  // updater `(prev) => next`, not a value to store -- it would call
  // signer(prevSigner) instead of ever storing it. Wrapping it in an
  // arrow makes the *arrow* the updater, returning signer as the value.
  setters.setSigner(() => signer);
  const deps = buildSessionDeps(db, signer, setters.setStatus, setters.setNotice, setters.setHistoryMayBeIncomplete);
  const next = new VouchdSession(relayUrl, deps);
  setters.setSession(next);
  void next.start().catch(setters.setError);
}

/** Shared by disconnect() and a fresh connect(): every piece of connection state, back to its rest value. */
function resetConnectionState(setters: {
  setSession: (session: VouchdSession | null) => void;
  setStatus: (status: ConnectionStatus) => void;
  setNotice: (notice: string | null) => void;
  setCanPublish: (value: boolean) => void;
  setSigner: (signer: SignEvent | undefined) => void;
  setHistoryMayBeIncomplete: (value: boolean) => void;
  setRelayUrl: (relayUrl: string | null) => void;
}): void {
  setters.setSession(null);
  setters.setStatus("closed");
  setters.setNotice(null);
  setters.setCanPublish(false);
  setters.setSigner(undefined);
  setters.setHistoryMayBeIncomplete(false);
  setters.setRelayUrl(null);
}

export function useCommunityConnection(
  db: ReadModelDb | null,
  keystore: OwnerKeystore,
  requestPassphrase: PassphraseProvider,
): CommunityConnection {
  const [session, setSession] = useState<VouchdSession | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("closed");
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [signer, setSigner] = useState<SignEvent | undefined>(undefined);
  const [historyMayBeIncomplete, setHistoryMayBeIncomplete] = useState(false);
  const [relayUrl, setRelayUrl] = useState<string | null>(null);
  const t = useT();
  // One bag, reused by both connect() and disconnect() (and passed straight
  // through to startConnection()/resetConnectionState()) rather than each
  // re-listing the same eight setters -- see those functions for why each
  // needs the full set.
  const setters = {
    setSession, setStatus, setError, setNotice, setCanPublish, setSigner, setHistoryMayBeIncomplete, setRelayUrl,
  };

  function connect(relayUrl: string, identitySource: IdentitySource) {
    if (!db) return;
    startConnection(db, keystore, requestPassphrase, t.community.authReason, relayUrl, identitySource, setters);
  }

  function disconnect() {
    session?.stop();
    resetConnectionState(setters);
  }

  return {
    session,
    status,
    error,
    notice,
    canPublish,
    signer,
    historyMayBeIncomplete,
    relayUrl,
    connect,
    disconnect,
  };
}
