/**
 * All of App's derived state and callbacks, gathered in one hook so App.tsx
 * itself stays pure composition — see its own header comment. Nothing here
 * is new behavior; it's exactly what used to sit inline in App(), moved out
 * once the panel list (and the audit trail's `focusedAgent` wiring) made
 * that function too long to read as one piece.
 */

import { useMemo, useState } from "react";
import { createIndexedDbStorage } from "../signer/indexedDbStorage";
import { OwnerKeystore } from "../signer/ownerKeystore";
import type { EventTemplate } from "../protocol/events/types";
import { type CommunityConnection, useCommunityConnection } from "./useCommunityConnection";
import { useAgentRows } from "./useAgentRows";
import { useAuditEntries } from "./useAuditEntries";
import { useChannelMembers } from "./useChannelMembers";
import { useChannels } from "./useChannels";
import { useNip07, type Nip07State } from "./useNip07";
import {
  type OwnerPassphrasePrompt,
  useOwnerPassphrasePrompt,
} from "./useOwnerPassphrasePrompt";
import { useOwnerPubkey } from "./useOwnerPubkey";
import { useProfiles } from "./useProfiles";
import { useReadModel } from "./useReadModel";
import type { AgentRow } from "../features/agents/AgentsPanel";
import type { AuditRecord, ChannelRecord, MemberRecord, ProfileRecord } from "../readmodel/records";

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
  // The agent currently in view: set by clicking "Re-authorize" on an
  // existing row, or automatically after minting a fresh one — "which
  // agent am I working with right now" is one idea, not two pieces of state.
  const [focusedAgent, setFocusedAgent] = useState<string | undefined>(undefined);
  const auditEntries = useAuditEntries(db, connection.session, focusedAgent);
  const [focusedChannel, setFocusedChannel] = useState<string | undefined>(undefined);
  const channelMembers = useChannelMembers(db, connection.session, focusedChannel);
  const profiles = useProfiles(db, connection.session);

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
    focusedAgent,
    setFocusedAgent,
    auditEntries,
    focusedChannel,
    setFocusedChannel,
    channelMembers,
    profiles,
    canPublish: connection.canPublish,
    publish,
  };
}
