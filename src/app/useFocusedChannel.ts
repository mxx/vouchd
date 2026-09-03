/**
 * Which channel is currently drilled into (ChannelsPanel's "View" button)
 * plus its member roster -- the same one-idea-not-two pairing as
 * useFocusedAgent, for the channel-detail toggle instead of the audit one.
 */

import { useState } from "react";
import type { ReadModelDb } from "../readmodel/db";
import type { MemberRecord } from "../readmodel/records";
import { useChannelMembers } from "./useChannelMembers";
import type { VouchdSession } from "./session";

export interface FocusedChannel {
  focusedChannel: string | undefined;
  setFocusedChannel: (channelId: string | undefined) => void;
  channelMembers: MemberRecord[];
}

export function useFocusedChannel(db: ReadModelDb | null, session: VouchdSession | null): FocusedChannel {
  const [focusedChannel, setFocusedChannel] = useState<string | undefined>(undefined);
  const channelMembers = useChannelMembers(db, session, focusedChannel);
  return { focusedChannel, setFocusedChannel, channelMembers };
}
