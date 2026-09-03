/**
 * Live facts about this browser's state, read from the same data the
 * panels below already show -- never a separate source of truth. Exists
 * because a HUD that greets you with numbers it made up is worse than no
 * HUD at all; every value here is derivable from `rows`, `relayStatus`,
 * `ownerPubkey`, or (for the community blurb) the relay's own NIP-11
 * document (see protocol/nip11.ts) -- nothing is authored by this app.
 */

import type { AgentRow } from "../../features/agents/AgentsPanel";
import type { RelayInfo } from "../../protocol/nip11";
import type { ConnectionStatus } from "../../protocol/relayClient";
import { useT } from "../../i18n";

// Mirrors the connected-status check useVouchdApp.ts computes for
// navigation gating, kept separate on purpose: this one only decides a
// tile's color, a narrower and purely cosmetic concern not worth coupling
// to the gating predicate.
const CONNECTED: ConnectionStatus[] = ["open", "authenticated"];

function CommunityBlurb({ relayInfo, label }: { relayInfo: RelayInfo; label: string }) {
  if (!relayInfo.name && !relayInfo.description) return null;
  return (
    <div className="community-blurb">
      <div className="stat-label">{label}</div>
      {relayInfo.name ? <p className="blurb-name">{relayInfo.name}</p> : null}
      {relayInfo.description ? <p className="blurb-description">{relayInfo.description}</p> : null}
    </div>
  );
}

export function StatBar({
  rows,
  relayStatus,
  ownerPubkey,
  relayInfo,
}: {
  rows: AgentRow[];
  relayStatus: ConnectionStatus;
  ownerPubkey: string | null;
  relayInfo?: RelayInfo | null;
}) {
  const t = useT();
  const onlineNow = rows.filter((row) => row.presence === "online").length;
  const relayConnected = CONNECTED.includes(relayStatus);

  return (
    <>
      {relayInfo ? <CommunityBlurb label={t.stats.about} relayInfo={relayInfo} /> : null}
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
    </>
  );
}
