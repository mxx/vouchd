/**
 * Owns the session lifecycle so App stays a composition root.
 *
 * The signer is wired in here rather than inside VouchdSession: the session
 * takes signing as a dependency (protocol code must never reach for a key on
 * its own), and this is the layer that legitimately knows whether a browser
 * extension is present.
 */

import { useState } from "react";
import type { ConnectionStatus } from "../protocol/relayClient";
import type { ReadModelDb } from "../readmodel/db";
import { hasNip07, signEventWithNip07 } from "../signer/nip07Signer";
import { VouchdSession } from "./session";

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
  connect: (relayUrl: string) => void;
  disconnect: () => void;
}

export function useCommunityConnection(db: ReadModelDb | null): CommunityConnection {
  const [session, setSession] = useState<VouchdSession | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("closed");
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function connect(relayUrl: string) {
    if (!db) return;
    setError(null);
    setNotice(null);
    const signer = hasNip07() ? signEventWithNip07 : undefined;
    const next = new VouchdSession(relayUrl, {
      db,
      signEvent: signer,
      signAuthEvent: signer,
      onStatusChange: setStatus,
      onNotice: setNotice,
    });
    setSession(next);
    void next.start().catch(setError);
  }

  function disconnect() {
    session?.stop();
    setSession(null);
    setStatus("closed");
    setNotice(null);
  }

  return { session, status, error, notice, connect, disconnect };
}
