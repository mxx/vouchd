/**
 * The member roster for one channel, read-through from the projection.
 *
 * Scoped to a single channel on purpose, exactly like useAuditEntries is
 * scoped to a single agent: an operator who opened one channel's detail
 * view is asking "who's in this one", not "every membership on the relay".
 */

import { useEffect, useState } from "react";
import type { ReadModelDb } from "../readmodel/db";
import { listMembers } from "../readmodel/queries";
import type { MemberRecord } from "../readmodel/records";
import type { VouchdSession } from "./session";

export function useChannelMembers(
  db: ReadModelDb | null,
  session: VouchdSession | null,
  channelId: string | undefined,
): MemberRecord[] {
  const [members, setMembers] = useState<MemberRecord[]>([]);

  useEffect(() => {
    if (!db || !channelId) {
      setMembers([]);
      return;
    }
    let live = true;
    const reload = () => {
      void listMembers(db, channelId).then((next) => live && setMembers(next));
    };
    reload();
    const unsubscribe = session?.onChange(reload);
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [db, session, channelId]);

  return members;
}
