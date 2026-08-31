/**
 * Channels observed on the relay. Read-through from the projection, refreshed
 * when the session reports a change — no polling, because unlike presence a
 * channel doesn't expire on its own.
 */

import { useEffect, useState } from "react";
import type { ReadModelDb } from "../readmodel/db";
import { listChannels } from "../readmodel/queries";
import type { ChannelRecord } from "../readmodel/records";
import type { VouchdSession } from "./session";

export function useChannels(db: ReadModelDb | null, session: VouchdSession | null): ChannelRecord[] {
  const [channels, setChannels] = useState<ChannelRecord[]>([]);

  useEffect(() => {
    if (!db) return;
    let live = true;
    const reload = () => {
      void listChannels(db).then((next) => live && setChannels(next));
    };
    reload();
    const unsubscribe = session?.onChange(reload);
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [db, session]);

  return channels;
}
