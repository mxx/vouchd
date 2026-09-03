/**
 * All of App's derived state and callbacks, gathered in one hook so App.tsx
 * itself stays pure composition — see its own header comment. Nothing here
 * is new behavior; it's exactly what used to sit inline in App(), moved out
 * once the panel list (and the audit trail's `focusedAgent` wiring) made
 * that function too long to read as one piece.
 */

import { useMemo } from "react";
import { createIndexedDbStorage } from "../signer/indexedDbStorage";
import { OwnerKeystore } from "../signer/ownerKeystore";
import type { EventTemplate } from "../protocol/events/types";
import type { RelayInfo } from "../protocol/nip11";
import { type CommunityConnection, useCommunityConnection } from "./useCommunityConnection";
import { useAgentRows } from "./useAgentRows";
import { useChannels } from "./useChannels";
import { useFocusedAgent } from "./useFocusedAgent";
import { useFocusedChannel } from "./useFocusedChannel";
import { useNip07, type Nip07State } from "./useNip07";
import {
  type OwnerPassphrasePrompt,
  useOwnerPassphrasePrompt,
} from "./useOwnerPassphrasePrompt";
import { useOwnerPubkey } from "./useOwnerPubkey";
import { useProfiles } from "./useProfiles";
import { useReadModel } from "./useReadModel";
import { useRelayInfo } from "./useRelayInfo";
import { useScreenNavigation, type Screen } from "./useScreenNavigation";
import type { AgentRow } from "../features/agents/AgentsPanel";
import type { AuditRecord, ChannelRecord, MemberRecord, ProfileRecord } from "../readmodel/records";

export type { Screen } from "./useScreenNavigation";

export interface VouchdAppState {
  keystore: OwnerKeystore;
  ownerPubkey: string | null;
  refreshOwnerPubkey: () => void;
  connection: CommunityConnection;
  /** The pending owner-passphrase prompt (if any) for App to render. */
  passphrasePrompt: OwnerPassphrasePrompt;
  rows: AgentRow[];
  channels: ChannelRecord[];
  nip07: Nip07State;
  focusedAgent: string | undefined;
  setFocusedAgent: (pubkey: string | undefined) => void;
  auditEntries: AuditRecord[];
  /** The channel currently drilled into (ChannelsPanel's "View" button), if any -- App.tsx
   *  swaps the whole Channels cluster for ChannelDetailPanel while this is set. */
  focusedChannel: string | undefined;
  setFocusedChannel: (channelId: string | undefined) => void;
  channelMembers: MemberRecord[];
  profiles: Map<string, ProfileRecord>;
  canPublish: boolean;
  publish: (template: EventTemplate) => Promise<void>;
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
  /** `connection.status` is "open" or "authenticated" -- computed once here so
   *  Sidebar's gating, StatBar's visibility, and useScreenNavigation's reset
   *  effect all read the same value instead of each re-deriving it. */
  connected: boolean;
  /** The relay's own NIP-11 self-description, when it serves one -- see protocol/nip11.ts. */
  relayInfo: RelayInfo | null;
}

export function useVouchdApp(): VouchdAppState {
  const db = useReadModel();
  const keystore = useMemo(() => new OwnerKeystore(createIndexedDbStorage()), []);
  const { ownerPubkey, refresh: refreshOwnerPubkey } = useOwnerPubkey(keystore);
  const passphrasePrompt = useOwnerPassphrasePrompt();
  const connection = useCommunityConnection(db, keystore, passphrasePrompt.requestPassphrase);
  const rows = useAgentRows(db, connection.session);
  const channels = useChannels(db, connection.session);
  const nip07 = useNip07();
  const focusedAgent = useFocusedAgent(db, connection.session);
  const focusedChannel = useFocusedChannel(db, connection.session);
  const profiles = useProfiles(db, connection.session);
  const connected = connection.status === "open" || connection.status === "authenticated";
  const relayInfo = useRelayInfo(connection.relayUrl, connected);
  const screenNav = useScreenNavigation(connected);

  const publish = (template: EventTemplate) =>
    connection.session
      ? connection.session.publish(template)
      : Promise.reject(new Error("not connected to a community"));

  return {
    keystore,
    ownerPubkey,
    refreshOwnerPubkey,
    connection,
    passphrasePrompt,
    rows,
    channels,
    nip07,
    ...focusedAgent,
    ...focusedChannel,
    profiles,
    canPublish: connection.canPublish,
    publish,
    ...screenNav,
    connected,
    relayInfo,
  };
}
