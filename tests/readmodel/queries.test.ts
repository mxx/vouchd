/**
 * The one rule worth pinning in queries.ts: a channel the relay has given us
 * a roster for is described by that roster and nothing else, while a channel
 * it hasn't keeps the memberships reconstructed from add/remove events.
 */

import { describe, expect, it } from "vitest";
import type { ReadModelDb } from "@/readmodel/db";
import type { ChannelRecord, ChannelRosterRecord, MemberRecord } from "@/readmodel/records";
import { channelNamesByPubkey, listMembers } from "@/readmodel/queries";

const SNAPSHOTTED = "channel-with-roster";
const DERIVED = "channel-without-roster";
const AT = 1_700_000_000;

function member(channelId: string, pubkey: string, role?: string): MemberRecord {
  return role ? { channelId, pubkey, role, observedAt: AT } : { channelId, pubkey, observedAt: AT };
}

function fakeDb(stores: {
  members?: MemberRecord[];
  channelRoster?: ChannelRosterRecord[];
  channels?: ChannelRecord[];
}): ReadModelDb {
  return {
    getAll: async (store: string) => (stores as Record<string, unknown[]>)[store] ?? [],
  } as unknown as ReadModelDb;
}

describe("listMembers", () => {
  it("answers from the relay's roster, ignoring stale rows for that channel", async () => {
    const db = fakeDb({
      members: [member(SNAPSHOTTED, "a".repeat(64)), member(SNAPSHOTTED, "b".repeat(64))],
      channelRoster: [
        { channelId: SNAPSHOTTED, observedAt: AT, members: [member(SNAPSHOTTED, "b".repeat(64), "owner")] },
      ],
    });

    // "a" was observed joining and never observed leaving; the relay says it
    // is not a member. The relay wins -- a removal we never saw is exactly
    // the gap a snapshot exists to close.
    expect(await listMembers(db, SNAPSHOTTED)).toEqual([member(SNAPSHOTTED, "b".repeat(64), "owner")]);
  });

  it("falls back to observed memberships for a channel with no roster", async () => {
    const db = fakeDb({
      members: [member(DERIVED, "a".repeat(64))],
      channelRoster: [{ channelId: SNAPSHOTTED, observedAt: AT, members: [] }],
    });
    expect(await listMembers(db, DERIVED)).toEqual([member(DERIVED, "a".repeat(64))]);
  });

  it("reports an empty roster as empty rather than falling back", async () => {
    const db = fakeDb({
      members: [member(SNAPSHOTTED, "a".repeat(64))],
      channelRoster: [{ channelId: SNAPSHOTTED, observedAt: AT, members: [] }],
    });
    expect(await listMembers(db, SNAPSHOTTED)).toEqual([]);
  });
});

describe("channelNamesByPubkey", () => {
  it("reads the same membership the member list does, so the two can't disagree", async () => {
    const db = fakeDb({
      members: [member(SNAPSHOTTED, "a".repeat(64))],
      channelRoster: [
        { channelId: SNAPSHOTTED, observedAt: AT, members: [member(SNAPSHOTTED, "b".repeat(64))] },
      ],
      channels: [{ channelId: SNAPSHOTTED, name: "welcome", observedAt: AT }],
    });

    const names = await channelNamesByPubkey(db);
    expect(names.get("b".repeat(64))).toEqual(["welcome"]);
    expect(names.has("a".repeat(64))).toBe(false);
  });
});
