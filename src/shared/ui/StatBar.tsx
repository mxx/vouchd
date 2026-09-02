/**
 * Four live facts about this browser's state, read from the same data the
 * panels below already show -- never a separate source of truth. Exists
 * because a HUD that greets you with numbers it made up is worse than no
 * HUD at all; every value here is derivable from `rows`, `relayStatus` and
 * `ownerPubkey` alone.
 */

import type { AgentRow } from "../../features/agents/AgentsPanel";
import type { ConnectionStatus } from "../../protocol/relayClient";
import { useT } from "../../i18n";

const CONNECTED: ConnectionStatus[] = ["open", "authenticated"];

export function StatBar({
  rows,
  relayStatus,
  ownerPubkey,
}: {
  rows: AgentRow[];
  relayStatus: ConnectionStatus;
  ownerPubkey: string | null;
}) {
  const t = useT();
  const onlineNow = rows.filter((row) => row.presence === "online").length;
  const relayConnected = CONNECTED.includes(relayStatus);

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-label">{t.stats.onlineNow}</div>
        <div className={`stat-value ${onlineNow > 0 ? "mint" : ""}`}>{onlineNow}</div>
      </div>
      <div className="stat">
        <div className="stat-label">{t.stats.totalAgents}</div>
        <div className="stat-value">{rows.length}</div>
      </div>
      <div className="stat">
        <div className="stat-label">{t.stats.relay}</div>
        <div className={`stat-value small ${relayConnected ? "mint" : ""}`}>{relayStatus}</div>
      </div>
      <div className="stat">
        <div className="stat-label">{t.stats.ownerKey}</div>
        <div className="stat-value small">{ownerPubkey ? t.stats.locked : t.stats.empty}</div>
      </div>
    </div>
  );
}
