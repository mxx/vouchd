/**
 * The agent directory, refreshed on two triggers.
 *
 * Events are the obvious one. The other is time: presence expires after the
 * relay's 180s window whether or not anything arrives, so a view that only
 * re-read on events would keep showing a dot the protocol has already
 * disowned. The interval is what makes "bounded wrong" actually bounded on
 * screen.
 */

import { useEffect, useState } from "react";
import type { VouchdSession } from "./session";
import type { ReadModelDb } from "../readmodel/db";
import { effectivePresence } from "../readmodel/presence";
import { channelNamesByPubkey, listAgents } from "../readmodel/queries";
import type { AgentRow } from "../features/agents/AgentsPanel";

const PRESENCE_REFRESH_MS = 20_000;

export function useAgentRows(db: ReadModelDb | null, session: VouchdSession | null): AgentRow[] {
  const [rows, setRows] = useState<AgentRow[]>([]);

  useEffect(() => {
    if (!db) return;
    let live = true;

    async function reload() {
      const now = Math.floor(Date.now() / 1000);
      const agents = await listAgents(db as ReadModelDb);
      const presence = await Promise.all(
        agents.map((agent) => (db as ReadModelDb).get("presence", agent.pubkey)),
      );
      const channelNames = await channelNamesByPubkey(db as ReadModelDb);
      if (!live) return;
      setRows(
        agents.map((agent, index) => ({
          agent,
          presence: effectivePresence(presence[index], now),
          lastSeen: presence[index]?.observedAt,
          channelNames: channelNames.get(agent.pubkey) ?? [],
        })),
      );
    }

    void reload();
    const unsubscribe = session?.onChange(() => void reload());
    const timer = setInterval(() => void reload(), PRESENCE_REFRESH_MS);
    return () => {
      live = false;
      unsubscribe?.();
      clearInterval(timer);
    };
  }, [db, session]);

  return rows;
}
